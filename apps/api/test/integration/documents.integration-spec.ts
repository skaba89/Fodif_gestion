/**
 * Real-PostgreSQL + real-S3 integration coverage for the secure document workflow (Sprint
 * Enterprise 0, Lot 2 - docs/14-ROADMAP-SAAS-PREMIUM.md axe E2, follow-up to financings, committee,
 * administration and partner). `test/documents.service.spec.ts` mocks both the repository and the
 * storage client - it proves the branching logic in isolation but can't prove any of the things
 * that only exist once bytes actually leave the process: that an uploaded file round-trips through
 * object storage unmodified, that DocumentsService#downloadVerified's SHA-256 recheck genuinely
 * catches storage-layer corruption (not just a mismatched mock return value), or that the PME
 * ownership scope (dossier_documents joined to dossiers_financement.entreprise_id) actually keeps
 * one company's documents unreachable to another over a real join. This spec wires the real
 * DocumentsService to a real DatabaseService (support/database.ts) and a real DocumentStorageService
 * (support/storage.ts) and exercises both unmodified.
 */
import { createHash } from 'node:crypto';
import { BadRequestException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { AuthenticatedUser } from '../../src/auth/auth-user.interface';
import { DocumentsRepository } from '../../src/documents/documents.repository';
import { DocumentsService } from '../../src/documents/documents.service';
import { seedEditableDossier, seedUser } from './support/fixtures';
import { IntegrationDatabase, startIntegrationDatabase } from './support/database';
import { corruptStoredObject, IntegrationStorage, startIntegrationStorage } from './support/storage';

// %PDF- signature only - document-policy.js's detectFileType sniffs the first bytes, it never
// parses PDF structure, so this is a valid "PDF" as far as the module under test is concerned.
const pdfBytes = Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3\nintegration test payload\n', 'binary');
const jpegBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('fake jpeg payload for integration test')]);

function multerFile(buffer: Buffer, mimetype = 'application/pdf', originalname = 'piece.pdf'): Express.Multer.File {
  return { buffer, size: buffer.length, mimetype, originalname } as Express.Multer.File;
}

describe('Secure documents (real PostgreSQL + real S3)', () => {
  let integrationDb: IntegrationDatabase;
  let integrationStorage: IntegrationStorage;
  let repository: DocumentsRepository;
  let service: DocumentsService;
  let agent: { sub: string };

  beforeAll(async () => {
    [integrationDb, integrationStorage] = await Promise.all([startIntegrationDatabase(), startIntegrationStorage()]);
    repository = new DocumentsRepository(integrationDb.db);
    service = new DocumentsService(repository, integrationStorage.storage);
  }, 180_000);

  afterAll(async () => {
    await Promise.all([integrationDb.stop(), integrationStorage.stop()]);
  });

  beforeEach(async () => {
    await Promise.all([integrationDb.reset(), integrationStorage.reset()]);
    agent = { sub: (await seedUser(integrationDb.pool)).id };
  });

  function pmeUser(entrepriseId: string): AuthenticatedUser {
    return { sub: agent.sub, email: 'pme@fodip.test', roles: ['PME'], permissions: [], entrepriseId };
  }

  function agentUser(): AuthenticatedUser {
    return { sub: agent.sub, email: 'agent@fodip.test', roles: ['AGENT_FODIP'], permissions: [] };
  }

  describe('uploadOwn / downloadOwn round trip', () => {
    it('stores the exact bytes in real S3 and returns them unmodified on download, with the right filename and content type', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool);
      const uploaded = await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes, 'application/pdf', 'Registre RCCM.pdf'));

      const downloaded = await service.downloadOwn(pmeUser(dossier.entrepriseId), (uploaded as unknown as { id: string }).id);

      expect(downloaded.buffer.equals(pdfBytes)).toBe(true);
      expect(downloaded.contentType).toBe('application/pdf');
      expect(downloaded.fileName).toBe('Registre RCCM.pdf');
    });

    it('persists a checksum matching the real uploaded content, and stores the object at the announced storage key', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool);
      const uploaded = await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'NIF', multerFile(jpegBytes, 'image/jpeg', 'piece.jpg')) as unknown as {
        id: string; storageKey: string; checksumSha256: string;
      };

      const objects = await integrationStorage.client.send(new ListObjectsV2Command({ Bucket: integrationStorage.bucket }));
      const keys = objects.Contents?.map((object) => object.Key) ?? [];
      expect(keys).toContain(uploaded.storageKey);

      expect(uploaded.checksumSha256).toBe(createHash('sha256').update(jpegBytes).digest('hex'));
    });
  });

  describe('storage integrity check', () => {
    it('downloadOwn refuses corrupted storage content even though the DB metadata is untouched', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool);
      const uploaded = await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes)) as unknown as {
        id: string; storageKey: string;
      };

      // Simulates real storage-layer corruption (bit rot, a bad replica, tampering) - the object at
      // the same key now has different bytes than what checksum_sha256 in Postgres records.
      await corruptStoredObject(integrationStorage.client, integrationStorage.bucket, uploaded.storageKey, Buffer.from('%PDF-1.7\ncorrupted'));

      await expect(service.downloadOwn(pmeUser(dossier.entrepriseId), uploaded.id)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('downloadForReview is equally protected by the same integrity check', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool);
      const uploaded = await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes)) as unknown as {
        id: string; storageKey: string;
      };
      await corruptStoredObject(integrationStorage.client, integrationStorage.bucket, uploaded.storageKey, Buffer.from('%PDF-1.7\ncorrupted'));

      await expect(service.downloadForReview(agentUser(), uploaded.id)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('PME ownership isolation', () => {
    it("never returns another company's document to downloadOwn - not found, not the real data", async () => {
      const ownerDossier = await seedEditableDossier(integrationDb.pool);
      const otherDossier = await seedEditableDossier(integrationDb.pool);
      const uploaded = await service.uploadOwn(pmeUser(ownerDossier.entrepriseId), ownerDossier.dossierId, 'RCCM', multerFile(pdfBytes)) as unknown as { id: string };

      await expect(service.downloadOwn(pmeUser(otherDossier.entrepriseId), uploaded.id)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("excludes another company's documents from listOwn even when scoped to the right dossier id would otherwise match", async () => {
      const ownerDossier = await seedEditableDossier(integrationDb.pool);
      const otherDossier = await seedEditableDossier(integrationDb.pool);
      await service.uploadOwn(pmeUser(ownerDossier.entrepriseId), ownerDossier.dossierId, 'RCCM', multerFile(pdfBytes));

      const list = await service.listOwn(pmeUser(otherDossier.entrepriseId), ownerDossier.dossierId);
      expect(list).toHaveLength(0);
    });

    it('refuses an upload against a dossier owned by another company (application not found for this PME)', async () => {
      const ownerDossier = await seedEditableDossier(integrationDb.pool);
      const otherDossier = await seedEditableDossier(integrationDb.pool);

      await expect(
        service.uploadOwn(pmeUser(otherDossier.entrepriseId), ownerDossier.dossierId, 'RCCM', multerFile(pdfBytes)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('upload guards', () => {
    it('refuses an upload once the application has left the editable statuses (e.g. already submitted)', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool, { statut: 'PRET_COMITE' });

      await expect(
        service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses a document type outside the allowed list', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool);

      await expect(
        service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'NOT_A_REAL_TYPE', multerFile(pdfBytes)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a file whose bytes do not match any known signature, even with an allowed mimetype claimed', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool);
      const notAFile = multerFile(Buffer.from('just some plain text, not a real document'), 'application/pdf');

      await expect(
        service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', notAFile),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a file whose claimed mimetype does not match its real (sniffed) signature - spoofing protection', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool);
      // Real bytes are a JPEG, but the claimed mimetype says PDF - MIME_SIGNATURE_MISMATCH.
      const spoofed = multerFile(jpegBytes, 'application/pdf', 'piece.pdf');

      await expect(
        service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', spoofed),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('never leaves a stored object behind in S3 when the upload is rejected before reaching storage', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool, { statut: 'PRET_COMITE' });
      await expect(
        service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes)),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const objects = await integrationStorage.client
        .send(new ListObjectsV2Command({ Bucket: integrationStorage.bucket }))
        .catch(() => ({ Contents: undefined }));
      expect(objects.Contents ?? []).toHaveLength(0);
    });
  });

  describe('verify workflow', () => {
    it('records the verification decision and writes an audit trail from A_VERIFIER to VALIDE', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool);
      const uploaded = await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes)) as unknown as { id: string };

      const result = await service.verify(agentUser(), uploaded.id, 'VALIDE');
      expect(result.statutVerification).toBe('VALIDE');

      const row = await integrationDb.pool.query(
        `SELECT statut_verification AS "statutVerification", verified_by AS "verifiedBy", verified_at AS "verifiedAt"
         FROM dossier_documents WHERE id = $1`,
        [uploaded.id],
      );
      expect(row.rows[0].statutVerification).toBe('VALIDE');
      expect(row.rows[0].verifiedBy).toBe(agent.sub);
      expect(row.rows[0].verifiedAt).not.toBeNull();

      const audit = await integrationDb.pool.query(
        `SELECT old_values AS "oldValues", new_values AS "newValues" FROM audit_logs
         WHERE entity_type = 'DOSSIER_DOCUMENT' AND action = 'DOCUMENT_VERIFY' AND entity_id = $1`,
        [uploaded.id],
      );
      expect(audit.rows).toHaveLength(1);
      expect(audit.rows[0].oldValues.statutVerification).toBe('A_VERIFIER');
      expect(audit.rows[0].newValues.statutVerification).toBe('VALIDE');
    });

    it('requires a comment when rejecting a document (A_COMPLETER) and stores it', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool);
      const uploaded = await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes)) as unknown as { id: string };

      await expect(service.verify(agentUser(), uploaded.id, 'A_COMPLETER')).rejects.toBeInstanceOf(BadRequestException);

      const result = await service.verify(agentUser(), uploaded.id, 'A_COMPLETER', 'Document illisible, merci de renvoyer un scan net');
      expect(result.verificationComment).toBe('Document illisible, merci de renvoyer un scan net');

      const row = await integrationDb.pool.query(`SELECT verification_comment AS "verificationComment" FROM dossier_documents WHERE id = $1`, [uploaded.id]);
      expect(row.rows[0].verificationComment).toBe('Document illisible, merci de renvoyer un scan net');
    });
  });

  describe('access audit logging', () => {
    it('logs a DOCUMENT_DOWNLOAD_PME entry when the owning PME downloads its own document', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool);
      const uploaded = await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes)) as unknown as { id: string };

      await service.downloadOwn(pmeUser(dossier.entrepriseId), uploaded.id);

      const audit = await integrationDb.pool.query(
        `SELECT action FROM audit_logs WHERE entity_type = 'DOSSIER_DOCUMENT' AND entity_id = $1 AND action = 'DOCUMENT_DOWNLOAD_PME'`,
        [uploaded.id],
      );
      expect(audit.rows).toHaveLength(1);
    });

    it('logs a DOCUMENT_DOWNLOAD_AGENT entry, distinct from the PME action, when an agent reviews the document', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool);
      const uploaded = await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes)) as unknown as { id: string };

      await service.downloadForReview(agentUser(), uploaded.id);

      const audit = await integrationDb.pool.query(
        `SELECT action FROM audit_logs WHERE entity_type = 'DOSSIER_DOCUMENT' AND entity_id = $1 AND action = 'DOCUMENT_DOWNLOAD_AGENT'`,
        [uploaded.id],
      );
      expect(audit.rows).toHaveLength(1);
    });
  });
});

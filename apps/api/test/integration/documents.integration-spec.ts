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
import { createServer, Server, Socket } from 'node:net';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { AuthenticatedUser } from '../../src/auth/auth-user.interface';
import { ClamAvService } from '../../src/documents/clamav.service';
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

// A fake ConfigService - ClamAvService only ever calls .get(key), no other NestJS ConfigService
// surface, so a plain object is enough to construct a real one without pulling in the whole
// ConfigModule for a test.
function configOf(values: Record<string, string>) {
  return { get: (key: string) => values[key] } as never;
}

// Off (no CLAMAV_HOST), matching the local Docker demo stack's own default (docker-compose.yml) -
// used by every test below except the ones under "ClamAV scanning" that deliberately configure a
// (fake) daemon to exercise the real wire protocol.
const clamavDisabled = new ClamAvService(configOf({}));

describe('Secure documents (real PostgreSQL + real S3)', () => {
  let integrationDb: IntegrationDatabase;
  let integrationStorage: IntegrationStorage;
  let repository: DocumentsRepository;
  let service: DocumentsService;
  let agent: { sub: string };

  beforeAll(async () => {
    [integrationDb, integrationStorage] = await Promise.all([startIntegrationDatabase(), startIntegrationStorage()]);
    repository = new DocumentsRepository(integrationDb.db);
    service = new DocumentsService(repository, integrationStorage.storage, clamavDisabled);
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

  // Axe E6 (versioning, docs/14-ROADMAP-SAAS-PREMIUM.md) - closes a real bug: before this, an agent
  // could still act (Valider/Complément) on a document the PME had since replaced, because
  // agent-applications.repository.ts and committee.repository.ts each ran their own unfiltered
  // query against dossier_documents. These tests prove the supersession chain end to end against a
  // real DB, not just the mocked unit spec (test/documents.service.spec.ts).
  describe('document versioning (axe E6)', () => {
    it('marks the prior document of the same type as superseded when a newer one is uploaded, leaving the new one current', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool);
      const first = await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes, 'application/pdf', 'rccm-v1.pdf')) as unknown as { id: string };
      const second = await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes, 'application/pdf', 'rccm-v2.pdf')) as unknown as { id: string };

      const rows = await integrationDb.pool.query(
        `SELECT id, superseded_by AS "supersededBy" FROM dossier_documents WHERE dossier_id = $1 ORDER BY created_at ASC`,
        [dossier.dossierId],
      );
      expect(rows.rows).toHaveLength(2);
      expect(rows.rows[0].id).toBe(first.id);
      expect(rows.rows[0].supersededBy).toBe(second.id);
      expect(rows.rows[1].id).toBe(second.id);
      expect(rows.rows[1].supersededBy).toBeNull();
    });

    it('does not touch a document of a different type or a different dossier when superseding', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool);
      const otherDossier = await seedEditableDossier(integrationDb.pool);
      const otherType = await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'NIF', multerFile(jpegBytes, 'image/jpeg', 'nif.jpg')) as unknown as { id: string };
      const otherDossierDoc = await service.uploadOwn(pmeUser(otherDossier.entrepriseId), otherDossier.dossierId, 'RCCM', multerFile(pdfBytes)) as unknown as { id: string };

      await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes));

      const rows = await integrationDb.pool.query(
        `SELECT superseded_by AS "supersededBy" FROM dossier_documents WHERE id = ANY($1::uuid[])`,
        [[otherType.id, otherDossierDoc.id]],
      );
      expect(rows.rows.every((row) => row.supersededBy === null)).toBe(true);
    });

    it('excludes a superseded document from listForReview, keeping only the current version', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool);
      await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes, 'application/pdf', 'rccm-v1.pdf'));
      const second = await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes, 'application/pdf', 'rccm-v2.pdf')) as unknown as { id: string };

      const pending = await service.listForReview() as unknown as Array<{ id: string; dossierId: string }>;
      const forThisDossier = pending.filter((doc) => doc.dossierId === dossier.dossierId);
      expect(forThisDossier).toHaveLength(1);
      expect(forThisDossier[0].id).toBe(second.id);
    });

    it('refuses to verify a superseded document with a conflict, rather than silently recording a decision nobody will see', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool);
      const first = await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes, 'application/pdf', 'rccm-v1.pdf')) as unknown as { id: string };
      await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes, 'application/pdf', 'rccm-v2.pdf'));

      await expect(service.verify(agentUser(), first.id, 'VALIDE')).rejects.toBeInstanceOf(ConflictException);

      const row = await integrationDb.pool.query(`SELECT statut_verification AS "statutVerification" FROM dossier_documents WHERE id = $1`, [first.id]);
      expect(row.rows[0].statutVerification).toBe('A_VERIFIER');
    });

    it('still verifies the current version normally after an older version has been superseded', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool);
      await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes, 'application/pdf', 'rccm-v1.pdf'));
      const second = await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes, 'application/pdf', 'rccm-v2.pdf')) as unknown as { id: string };

      const result = await service.verify(agentUser(), second.id, 'VALIDE');
      expect(result.statutVerification).toBe('VALIDE');

      const row = await integrationDb.pool.query(`SELECT statut_verification AS "statutVerification" FROM dossier_documents WHERE id = $1`, [second.id]);
      expect(row.rows[0].statutVerification).toBe('VALIDE');
    });

    it('still lists every version (current and superseded) in listOwn, so a PME can see its own upload history', async () => {
      const dossier = await seedEditableDossier(integrationDb.pool);
      await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes, 'application/pdf', 'rccm-v1.pdf'));
      await service.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes, 'application/pdf', 'rccm-v2.pdf'));

      const list = await service.listOwn(pmeUser(dossier.entrepriseId), dossier.dossierId);
      expect(list).toHaveLength(2);
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

  // Axe E6 (docs/14-ROADMAP-SAAS-PREMIUM.md, gestion documentaire entreprise) - a real ClamAV
  // daemon isn't available in every environment this suite runs in, but ClamAvService's own wire
  // protocol (clamd's INSTREAM command) is fully our own code and fully testable without one: a
  // small in-process TCP server that speaks the real protocol (length-prefixed chunks, one-line
  // reply) proves the implementation end to end - byte parsing included - not just its branching
  // logic in isolation.
  describe('ClamAV scanning (axe E6)', () => {
    // The real, industry-standard EICAR antivirus test string (https://www.eicar.org/) - not a
    // virus, every real antivirus (including ClamAV) is designed to flag it as
    // "Eicar-Test-Signature", exactly so this kind of test can exist without a genuine payload.
    // Embedded after a real `%PDF-` signature, not uploaded on its own: document-policy.js's own
    // magic-byte check runs before the antivirus scan and would otherwise reject a bare EICAR
    // string as UNSUPPORTED_FILE_SIGNATURE before ClamAV ever sees it (found the hard way, a
    // first version of this test asserted the wrong rejection reason) - real ClamAV scans full
    // file content for the signature regardless of surrounding bytes, so this is also the more
    // realistic threat model for this endpoint (a payload embedded in what looks like a valid
    // PDF), not merely a workaround.
    const eicarSignature = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
    const eicar = Buffer.concat([Buffer.from('%PDF-1.7\n'), eicarSignature]);

    function startFakeClamd(reply: (received: Buffer) => string): Promise<{ port: number; close: () => Promise<void> }> {
      return new Promise((resolve, reject) => {
        const server: Server = createServer((socket: Socket) => {
          let sawCommand = false;
          let pending = Buffer.alloc(0);
          const chunks: Buffer[] = [];
          socket.on('data', (data) => {
            pending = Buffer.concat([pending, data]);
            if (!sawCommand) {
              const terminator = pending.indexOf(0);
              if (terminator === -1) return;
              pending = pending.subarray(terminator + 1);
              sawCommand = true;
            }
            for (;;) {
              if (pending.length < 4) return;
              const length = pending.readUInt32BE(0);
              if (length === 0) {
                socket.end(reply(Buffer.concat(chunks)));
                return;
              }
              if (pending.length < 4 + length) return;
              chunks.push(pending.subarray(4, 4 + length));
              pending = pending.subarray(4 + length);
            }
          });
        });
        server.listen(0, '127.0.0.1', () => {
          const address = server.address();
          if (address && typeof address === 'object') resolve({ port: address.port, close: () => new Promise((res) => server.close(() => res())) });
          else reject(new Error('failed to bind fake clamd'));
        });
        server.on('error', reject);
      });
    }

    it('rejects the EICAR test file as infected, before it ever reaches object storage', async () => {
      const fake = await startFakeClamd((received) => `stream: ${received.includes(eicarSignature) ? 'Eicar-Test-Signature FOUND' : 'OK'}\0`);
      try {
        const clamav = new ClamAvService(configOf({ CLAMAV_HOST: '127.0.0.1', CLAMAV_PORT: String(fake.port) }));
        const scannedService = new DocumentsService(repository, integrationStorage.storage, clamav);
        const dossier = await seedEditableDossier(integrationDb.pool);

        await expect(scannedService.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(eicar)))
          .rejects.toThrow(/Eicar-Test-Signature/);

        // Rejected before the application-lookup/storage-write step even runs (scanForMalware
        // is the very first thing uploadOwn does after basic file validation) - no orphan row.
        const rows = await integrationDb.pool.query(`SELECT id FROM dossier_documents WHERE dossier_id = $1`, [dossier.dossierId]);
        expect(rows.rows).toHaveLength(0);
      } finally {
        await fake.close();
      }
    });

    it('accepts and stores a real file ClamAV reports clean', async () => {
      const fake = await startFakeClamd(() => 'stream: OK\0');
      try {
        const clamav = new ClamAvService(configOf({ CLAMAV_HOST: '127.0.0.1', CLAMAV_PORT: String(fake.port) }));
        const scannedService = new DocumentsService(repository, integrationStorage.storage, clamav);
        const dossier = await seedEditableDossier(integrationDb.pool);

        const uploaded = await scannedService.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes)) as unknown as { id: string };
        expect(uploaded.id).toBeTruthy();
      } finally {
        await fake.close();
      }
    });

    it('fails closed (does not upload) when the daemon reports a scan ERROR', async () => {
      const fake = await startFakeClamd(() => 'stream: /tmp/x: Access denied. ERROR\0');
      try {
        const clamav = new ClamAvService(configOf({ CLAMAV_HOST: '127.0.0.1', CLAMAV_PORT: String(fake.port) }));
        const scannedService = new DocumentsService(repository, integrationStorage.storage, clamav);
        const dossier = await seedEditableDossier(integrationDb.pool);

        await expect(scannedService.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes)))
          .rejects.toBeInstanceOf(ServiceUnavailableException);
      } finally {
        await fake.close();
      }
    });

    it('fails closed (does not upload) when no daemon is listening on the configured port', async () => {
      const fake = await startFakeClamd(() => 'stream: OK\0');
      const deadPort = fake.port;
      await fake.close(); // now nothing is listening on deadPort
      const clamav = new ClamAvService(configOf({ CLAMAV_HOST: '127.0.0.1', CLAMAV_PORT: String(deadPort) }));
      const scannedService = new DocumentsService(repository, integrationStorage.storage, clamav);
      const dossier = await seedEditableDossier(integrationDb.pool);

      await expect(scannedService.uploadOwn(pmeUser(dossier.entrepriseId), dossier.dossierId, 'RCCM', multerFile(pdfBytes)))
        .rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});

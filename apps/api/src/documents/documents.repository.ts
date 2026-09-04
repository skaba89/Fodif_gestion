import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface DocumentMetadataInput {
  id: string;
  dossierId: string;
  typeDocument: string;
  nomFichier: string;
  storageKey: string;
  mimeType: string;
  tailleOctets: number;
  checksumSha256: string;
  uploadedBy: string;
}

const DOCUMENT_SELECT = `SELECT
  doc.id,
  doc.dossier_id AS "dossierId",
  doc.type_document AS "typeDocument",
  doc.nom_fichier AS "nomFichier",
  doc.storage_key AS "storageKey",
  doc.mime_type AS "mimeType",
  doc.taille_octets AS "tailleOctets",
  doc.checksum_sha256 AS "checksumSha256",
  doc.statut_verification AS "statutVerification",
  doc.verification_comment AS "verificationComment",
  doc.verified_by AS "verifiedBy",
  doc.verified_at AS "verifiedAt",
  doc.superseded_by AS "supersededBy",
  doc.created_at AS "createdAt",
  doc.updated_at AS "updatedAt"`;

// Axe E6 (versioning, docs/14-ROADMAP-SAAS-PREMIUM.md) - a discriminated result for verify():
// NOT_FOUND and SUPERSEDED need two different responses, not one generic 404 - an agent trying to
// verify a document the PME has since replaced needs to be told that, not just "not found".
export type VerifyDocumentOutcome =
  | { outcome: 'NOT_FOUND' }
  | { outcome: 'SUPERSEDED' }
  | { outcome: 'OK'; id: string };

@Injectable()
export class DocumentsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findOwnedApplication(dossierId: string, entrepriseId: string) {
    const result = await this.db.query(
      `SELECT id, entreprise_id AS "entrepriseId", statut
       FROM dossiers_financement
       WHERE id = $1 AND entreprise_id = $2
       LIMIT 1`,
      [dossierId, entrepriseId],
    );
    return result.rows[0] ?? null;
  }

  async listOwned(dossierId: string, entrepriseId: string) {
    const result = await this.db.query(
      `${DOCUMENT_SELECT}
       FROM dossier_documents doc
       JOIN dossiers_financement d ON d.id = doc.dossier_id
       WHERE doc.dossier_id = $1 AND d.entreprise_id = $2
       ORDER BY doc.created_at DESC`,
      [dossierId, entrepriseId],
    );
    return result.rows;
  }

  async findOwnedById(documentId: string, entrepriseId: string) {
    const result = await this.db.query(
      `${DOCUMENT_SELECT}
       FROM dossier_documents doc
       JOIN dossiers_financement d ON d.id = doc.dossier_id
       WHERE doc.id = $1 AND d.entreprise_id = $2
       LIMIT 1`,
      [documentId, entrepriseId],
    );
    return result.rows[0] ?? null;
  }

  async listForReview() {
    const result = await this.db.query(
      `${DOCUMENT_SELECT},
        d.numero_dossier AS "numeroDossier",
        e.raison_sociale AS "raisonSociale"
       FROM dossier_documents doc
       JOIN dossiers_financement d ON d.id = doc.dossier_id
       JOIN entreprises e ON e.id = d.entreprise_id
       WHERE doc.statut_verification IN ('A_VERIFIER', 'A_COMPLETER') AND doc.superseded_by IS NULL
       ORDER BY doc.created_at ASC`,
    );
    return result.rows;
  }

  async findById(documentId: string) {
    const result = await this.db.query(
      `${DOCUMENT_SELECT}
       FROM dossier_documents doc
       WHERE doc.id = $1
       LIMIT 1`,
      [documentId],
    );
    return result.rows[0] ?? null;
  }

  async recordAccess(documentId: string, userId: string, action: string) {
    await this.db.query(
      `INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id)
       VALUES ($1, $2, 'DOSSIER_DOCUMENT', $3)`,
      [userId, action, documentId],
    );
  }

  async create(input: DocumentMetadataInput) {
    return this.db.transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO dossier_documents (
          id, dossier_id, type_document, nom_fichier, storage_key, mime_type,
          taille_octets, checksum_sha256, statut_verification, uploaded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'A_VERIFIER', $9)
        RETURNING id`,
        [
          input.id,
          input.dossierId,
          input.typeDocument,
          input.nomFichier,
          input.storageKey,
          input.mimeType,
          input.tailleOctets,
          input.checksumSha256,
          input.uploadedBy,
        ],
      );
      const documentId = inserted.rows[0].id;

      // Axe E6 (versioning, docs/14-ROADMAP-SAAS-PREMIUM.md) - whatever was the current document
      // of this same type in this dossier is superseded by the one just inserted. Scoped to
      // superseded_by IS NULL so an already-superseded row's history is never rewritten - only the
      // (at most one) row that was still current a moment ago is touched.
      await client.query(
        `UPDATE dossier_documents SET superseded_by = $1, updated_at = NOW()
         WHERE dossier_id = $2 AND type_document = $3 AND id <> $1 AND superseded_by IS NULL`,
        [documentId, input.dossierId, input.typeDocument],
      );

      await client.query(
        `INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, new_values)
         VALUES ($1, 'DOCUMENT_UPLOAD', 'DOSSIER_DOCUMENT', $2, $3)`,
        [input.uploadedBy, documentId, JSON.stringify({ dossierId: input.dossierId, typeDocument: input.typeDocument, checksumSha256: input.checksumSha256 })],
      );

      return { id: documentId };
    });
  }

  async verify(documentId: string, userId: string, statut: string, commentaire?: string): Promise<VerifyDocumentOutcome> {
    return this.db.transaction(async (client) => {
      // Axe E6 (versioning) - locked and read first so a document the PME has since replaced
      // (superseded_by set after this row was loaded into an agent's screen) is reported as such,
      // not silently "verified" while the actually-current version sits untouched.
      const locked = await client.query<{ statutVerification: string; supersededBy: string | null }>(
        'SELECT statut_verification AS "statutVerification", superseded_by AS "supersededBy" FROM dossier_documents WHERE id = $1 FOR UPDATE',
        [documentId],
      );
      if (!locked.rows[0]) return { outcome: 'NOT_FOUND' };
      if (locked.rows[0].supersededBy) return { outcome: 'SUPERSEDED' };

      await client.query(
        `UPDATE dossier_documents
         SET statut_verification = $2, verification_comment = $3, verified_by = $4, verified_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [documentId, statut, commentaire ?? null, userId],
      );
      await client.query(
        `INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, old_values, new_values)
         VALUES ($1, 'DOCUMENT_VERIFY', 'DOSSIER_DOCUMENT', $2, $3, $4)`,
        [
          userId, documentId,
          JSON.stringify({ statutVerification: locked.rows[0].statutVerification }),
          JSON.stringify({ statutVerification: statut, commentaire: commentaire ?? null }),
        ],
      );
      return { outcome: 'OK', id: documentId };
    });
  }
}

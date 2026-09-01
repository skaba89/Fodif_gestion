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
  doc.created_at AS "createdAt",
  doc.updated_at AS "updatedAt"`;

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
       WHERE doc.statut_verification IN ('A_VERIFIER', 'A_COMPLETER')
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
    const result = await this.db.query(
      `WITH inserted AS (
        INSERT INTO dossier_documents (
          id, dossier_id, type_document, nom_fichier, storage_key, mime_type,
          taille_octets, checksum_sha256, statut_verification, uploaded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'A_VERIFIER', $9)
        RETURNING id
      ), audit AS (
        INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, new_values)
        SELECT $9, 'DOCUMENT_UPLOAD', 'DOSSIER_DOCUMENT', id,
          jsonb_build_object('dossierId', $2, 'typeDocument', $3, 'checksumSha256', $8)
        FROM inserted
      )
      SELECT id FROM inserted`,
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
    return result.rows[0] ?? null;
  }

  async verify(documentId: string, userId: string, statut: string, commentaire?: string) {
    const result = await this.db.query(
      `WITH previous AS (
        SELECT id, statut_verification FROM dossier_documents WHERE id = $1
      ), updated AS (
        UPDATE dossier_documents doc
        SET statut_verification = $3,
            verification_comment = $4,
            verified_by = $2,
            verified_at = NOW(),
            updated_at = NOW()
        FROM previous
        WHERE doc.id = previous.id
        RETURNING doc.id, previous.statut_verification AS old_status
      ), audit AS (
        INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, old_values, new_values)
        SELECT $2, 'DOCUMENT_VERIFY', 'DOSSIER_DOCUMENT', id,
          jsonb_build_object('statutVerification', old_status),
          jsonb_build_object('statutVerification', $3, 'commentaire', $4)
        FROM updated
      )
      SELECT id FROM updated`,
      [documentId, userId, statut, commentaire ?? null],
    );
    return result.rows[0] ?? null;
  }
}

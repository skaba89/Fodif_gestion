import { Injectable } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

interface MissingDocumentsRow extends QueryResultRow {
  dossiers: number;
  montant: string;
  piecesManquantes: number;
}

export type MissingDocumentsExecutiveAlert = {
  id: 'documents-manquants';
  severite: 'attention';
  titre: string;
  explication: string;
  dossiers: number;
  montant: number;
  action: string;
  lien: string;
};

/**
 * Executive alert backed by the same documentary truth as ApplicationsRepository:
 * - a submitted dossier uses its immutable programme rule/checklist snapshot;
 * - an unlocked draft would use the active rule version, then legacy requirements only if no
 *   version exists (drafts are excluded from this executive alert, but the fallback keeps the
 *   query safe for pre-versioning fixtures/imports);
 * - only the current document version (superseded_by IS NULL) counts;
 * - a rejected document never satisfies a requirement.
 *
 * Drafts are deliberately excluded: the PME is still preparing them. Rejected/cancelled dossiers
 * are also excluded because they have left the active decision pipeline. A programme with no
 * configured mandatory checklist can never create a false positive.
 */
@Injectable()
export class MissingDocumentsAlertService {
  constructor(private readonly db: DatabaseService) {}

  async build(query: DashboardQueryDto): Promise<MissingDocumentsExecutiveAlert | null> {
    const values = [query.regionId ?? null, query.programmeId ?? null, query.secteurId ?? null];
    const result = await this.db.query<MissingDocumentsRow>(
      `SELECT
        COUNT(*)::int AS dossiers,
        COALESCE(SUM(portfolio.montant_demande), 0)::text AS montant,
        COALESCE(SUM(missing.missing_count), 0)::int AS "piecesManquantes"
       FROM analytics.vw_dossier_portfolio portfolio
       JOIN dossiers_financement dossier ON dossier.id = portfolio.dossier_id
       JOIN LATERAL (
         SELECT COUNT(*)::int AS missing_count
         FROM (
           SELECT versioned.type_document
           FROM programme_regle_documents versioned
           WHERE versioned.regle_version_id = COALESCE(
             dossier.programme_regle_version_id,
             (
               SELECT version.id
               FROM programme_regles_versions version
               WHERE version.programme_id = portfolio.programme_id
                 AND version.statut = 'ACTIVE'
                 AND version.effective_from <= NOW()
                 AND (version.effective_to IS NULL OR version.effective_to > NOW())
               ORDER BY version.version DESC
               LIMIT 1
             )
           )
             AND versioned.obligatoire = TRUE

           UNION ALL

           SELECT legacy.type_document
           FROM programme_documents_requis legacy
           WHERE dossier.programme_regle_version_id IS NULL
             AND legacy.programme_id = portfolio.programme_id
             AND legacy.actif = TRUE
             AND legacy.obligatoire = TRUE
             AND NOT EXISTS (
               SELECT 1
               FROM programme_regles_versions version
               WHERE version.programme_id = portfolio.programme_id
                 AND version.statut = 'ACTIVE'
                 AND version.effective_from <= NOW()
                 AND (version.effective_to IS NULL OR version.effective_to > NOW())
             )
         ) requirement
         WHERE NOT EXISTS (
           SELECT 1
           FROM dossier_documents document
           WHERE document.dossier_id = portfolio.dossier_id
             AND document.type_document = requirement.type_document
             AND document.superseded_by IS NULL
             AND document.statut_verification <> 'REJETE'
         )
       ) missing ON missing.missing_count > 0
       WHERE ($1::uuid IS NULL OR portfolio.region_id = $1)
         AND ($2::uuid IS NULL OR portfolio.programme_id = $2)
         AND ($3::uuid IS NULL OR portfolio.secteur_id = $3)
         AND portfolio.statut NOT IN ('BROUILLON', 'REJETE', 'ANNULE')`,
      values,
    );

    const row = result.rows[0];
    if (!row || row.dossiers <= 0) return null;

    return {
      id: 'documents-manquants',
      severite: 'attention',
      titre: 'Dossiers avec pièces obligatoires manquantes',
      explication: `${row.dossiers} dossier(s) engagé(s) dans le processus présentent ${row.piecesManquantes} pièce(s) obligatoire(s) encore manquante(s).`,
      dossiers: row.dossiers,
      montant: Number(row.montant),
      action: 'Relancer les PME concernées et régulariser les pièces avant la prochaine étape décisionnelle.',
      lien: '/direction/tableau-de-bord#pipeline',
    };
  }
}

/**
 * Minimal, self-contained fixture builders for the financings integration specs. Each helper
 * generates its own unique identifiers (code_fodip / numero_dossier collide across tests
 * otherwise, since `reset()` truncates rows but never touches unique constraints) so tests can run
 * in any order without clashing.
 */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

/**
 * Every write path in FinancingsRepository stores `created_by` (financements, decaissements,
 * remboursements, audit_logs all have a FK to utilisateurs) - a fixture-generated UUID that
 * doesn't reference a real row would fail with a foreign key violation unrelated to whatever the
 * test is actually exercising, so every integration spec needs one real utilisateur row.
 */
export async function seedUser(pool: Pool): Promise<{ id: string }> {
  const unique = randomUUID().slice(0, 8);
  const result = await pool.query<{ id: string }>(
    `INSERT INTO utilisateurs (email, nom, actif) VALUES ($1, 'Agent Test', TRUE) RETURNING id`,
    [`agent-test-${unique}@fodip.test`],
  );
  return result.rows[0];
}

/**
 * Inserts a user already carrying the given role codes (all seeded by database/002_auth_rbac.sql,
 * applied before any test runs) - direct SQL rather than going through
 * AdministrationService.createUser, since the administration integration specs need pre-existing
 * users in a known state (e.g. two active SUPER_ADMIN accounts) rather than exercising creation
 * itself for every fixture.
 */
/** Inserts a partner bank row (database/011_partner_banks.sql) - the entity partner-scoped fixtures attach financings/PME portfolios to. */
export async function seedPartnerBank(pool: Pool): Promise<{ id: string }> {
  const unique = randomUUID().slice(0, 8);
  const result = await pool.query<{ id: string }>(
    `INSERT INTO partenaires_bancaires (code, raison_sociale, actif) VALUES ($1, $2, TRUE) RETURNING id`,
    [`PARTNER-TEST-${unique}`, `Banque Partenaire Test ${unique}`],
  );
  return result.rows[0];
}

export async function seedUserWithRoles(pool: Pool, roleCodes: string[], options: { actif?: boolean } = {}): Promise<{ id: string }> {
  const unique = randomUUID().slice(0, 8);
  const user = await pool.query<{ id: string }>(
    `INSERT INTO utilisateurs (email, nom, actif, password_hash) VALUES ($1, 'Utilisateur Test', $2, 'x') RETURNING id`,
    [`role-test-${unique}@fodip.test`, options.actif ?? true],
  );
  const userId = user.rows[0].id;
  await pool.query(
    `INSERT INTO utilisateur_roles (utilisateur_id, role_id) SELECT $1, id FROM roles WHERE code = ANY($2::text[])`,
    [userId, roleCodes],
  );
  return { id: userId };
}

export interface EligibleDossierOptions {
  montantApprouve?: number;
  tauxInteret?: number;
  dureeMois?: number;
  montantDemande?: number;
}

export interface EligibleDossier {
  entrepriseId: string;
  dossierId: string;
  decisionId: string;
  montantApprouve: number;
  tauxInteret: number;
  dureeMois: number;
}

/**
 * Inserts an entreprise + dossier + APPROUVE decision matching exactly the eligibility criteria
 * FinancingsRepository.findEligibleApplication / listEligibleApplications require (dossier
 * APPROUVE, decision APPROUVE, montant_approuve > 0, duree_mois in [1, 120], no existing
 * financement yet) - so `financingsService.createFromApplication(...)` can be called against it
 * unmodified.
 */
export async function seedEligibleDossier(pool: Pool, options: EligibleDossierOptions = {}): Promise<EligibleDossier> {
  const unique = randomUUID().slice(0, 8);
  const montantApprouve = options.montantApprouve ?? 1_000_000;
  const tauxInteret = options.tauxInteret ?? 6;
  const dureeMois = options.dureeMois ?? 12;
  const montantDemande = options.montantDemande ?? montantApprouve;

  const entreprise = await pool.query<{ id: string }>(
    `INSERT INTO entreprises (code_fodip, raison_sociale, statut)
     VALUES ($1, $2, 'ACTIVE') RETURNING id`,
    [`FODIP-TEST-${unique}`, `Entreprise Test ${unique}`],
  );
  const entrepriseId = entreprise.rows[0].id;

  const dossier = await pool.query<{ id: string }>(
    `INSERT INTO dossiers_financement (numero_dossier, entreprise_id, montant_demande, objet_financement, statut)
     VALUES ($1, $2, $3, 'Fonds de roulement (fixture de test)', 'APPROUVE') RETURNING id`,
    [`DOS-TEST-${unique}`, entrepriseId, montantDemande],
  );
  const dossierId = dossier.rows[0].id;

  const decision = await pool.query<{ id: string }>(
    `INSERT INTO decisions_comite (dossier_id, decision, montant_approuve, taux_interet, duree_mois, date_decision)
     VALUES ($1, 'APPROUVE', $2, $3, $4, NOW()) RETURNING id`,
    [dossierId, montantApprouve, tauxInteret, dureeMois],
  );

  return { entrepriseId, dossierId, decisionId: decision.rows[0].id, montantApprouve, tauxInteret, dureeMois };
}

export interface EditableDossierOptions {
  statut?: string;
}

export interface EditableDossier {
  entrepriseId: string;
  dossierId: string;
}

/**
 * Inserts a bare entreprise + dossier at a status DocumentsService#uploadOwn accepts
 * (EDITABLE_APPLICATION_STATUSES in document-policy.js - defaults to BROUILLON), with no decision
 * or scoring rows since the documents module doesn't need them. `entrepriseId` is what
 * DocumentsRepository's queries join dossier_documents against, so it's what an
 * AuthenticatedUser.entrepriseId fixture must match to exercise PME-owned document access.
 */
export async function seedEditableDossier(pool: Pool, options: EditableDossierOptions = {}): Promise<EditableDossier> {
  const unique = randomUUID().slice(0, 8);
  const statut = options.statut ?? 'BROUILLON';

  const entreprise = await pool.query<{ id: string }>(
    `INSERT INTO entreprises (code_fodip, raison_sociale, statut)
     VALUES ($1, $2, 'ACTIVE') RETURNING id`,
    [`FODIP-TEST-${unique}`, `Entreprise Test ${unique}`],
  );
  const entrepriseId = entreprise.rows[0].id;

  const dossier = await pool.query<{ id: string }>(
    `INSERT INTO dossiers_financement (numero_dossier, entreprise_id, montant_demande, objet_financement, statut)
     VALUES ($1, $2, 500000, 'Fonds de roulement (fixture de test)', $3) RETURNING id`,
    [`DOS-TEST-${unique}`, entrepriseId, statut],
  );

  return { entrepriseId, dossierId: dossier.rows[0].id };
}

export interface DossierReadyForCommitteeOptions {
  montantDemande?: number;
  scoreTotal?: number;
}

export interface DossierReadyForCommittee {
  entrepriseId: string;
  dossierId: string;
  montantDemande: number;
}

/**
 * Inserts an entreprise + dossier at exactly the state CommitteeRepository.list/decide requires
 * (statut = 'PRET_COMITE', a scored dossier - CommitteeService.decide rejects an unscored one)
 * plus the modele_scoring + scores_dossier rows a real score needs to exist at all (scores_dossier
 * FKs to both). Self-contained and uniquely-named per call, same reasoning as seedEligibleDossier.
 */
export async function seedDossierReadyForCommittee(
  pool: Pool, options: DossierReadyForCommitteeOptions = {},
): Promise<DossierReadyForCommittee> {
  const unique = randomUUID().slice(0, 8);
  const montantDemande = options.montantDemande ?? 1_000_000;
  const scoreTotal = options.scoreTotal ?? 78;

  const entreprise = await pool.query<{ id: string }>(
    `INSERT INTO entreprises (code_fodip, raison_sociale, statut)
     VALUES ($1, $2, 'ACTIVE') RETURNING id`,
    [`FODIP-TEST-${unique}`, `Entreprise Test ${unique}`],
  );
  const entrepriseId = entreprise.rows[0].id;

  const dossier = await pool.query<{ id: string }>(
    `INSERT INTO dossiers_financement (numero_dossier, entreprise_id, montant_demande, objet_financement, statut)
     VALUES ($1, $2, $3, 'Fonds de roulement (fixture de test)', 'PRET_COMITE') RETURNING id`,
    [`DOS-TEST-${unique}`, entrepriseId, montantDemande],
  );
  const dossierId = dossier.rows[0].id;

  const modele = await pool.query<{ id: string }>(
    `INSERT INTO modeles_scoring (code, nom, version, actif) VALUES ($1, 'Modèle de test', 1, TRUE) RETURNING id`,
    [`MODELE-TEST-${unique}`],
  );

  await pool.query(
    `INSERT INTO scores_dossier (dossier_id, modele_id, score_total, niveau_risque, recommandation)
     VALUES ($1, $2, $3, 'MODERE', 'FAVORABLE')`,
    [dossierId, modele.rows[0].id, scoreTotal],
  );

  return { entrepriseId, dossierId, montantDemande };
}

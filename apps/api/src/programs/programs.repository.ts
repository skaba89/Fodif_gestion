import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { CreateProgramDto, ProgramDocumentDto, UpdateProgramDto, UpdateProgramRuleDto } from './dto/program.dto';

@Injectable()
export class ProgramsRepository {
  constructor(private readonly db: DatabaseService) {}

  private activeSelect(extraWhere = '') {
    return `SELECT
      p.id,
      p.code,
      p.nom,
      p.description,
      COALESCE(rule.montant_min, p.montant_min) AS "montantMin",
      COALESCE(rule.montant_max, p.montant_max) AS "montantMax",
      p.enveloppe_totale AS "enveloppeTotale",
      COALESCE(rule.apport_min_pct, p.apport_min_pct) AS "apportMinPct",
      COALESCE(rule.anciennete_min_mois, p.anciennete_min_mois) AS "ancienneteMinMois",
      COALESCE(rule.rccm_requis, p.rccm_requis) AS "rccmRequis",
      COALESCE(rule.nif_requis, p.nif_requis) AS "nifRequis",
      COALESCE(rule.sla_instruction_jours, p.sla_instruction_jours) AS "slaInstructionJours",
      rule.id AS "regleVersionId",
      rule.version AS "regleVersion",
      p.date_debut AS "dateDebut",
      p.date_fin AS "dateFin",
      CASE
        WHEN rule.id IS NOT NULL THEN COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'code', requirement.code,
              'libelle', requirement.libelle,
              'typeDocument', requirement.type_document,
              'obligatoire', requirement.obligatoire,
              'validiteJours', requirement.validite_jours,
              'ordreAffichage', requirement.ordre_affichage
            )
            ORDER BY requirement.ordre_affichage ASC, requirement.libelle ASC
          )
          FROM programme_regle_documents requirement
          WHERE requirement.regle_version_id = rule.id
        ), '[]'::jsonb)
        ELSE COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'code', requirement.code,
              'libelle', requirement.libelle,
              'typeDocument', requirement.type_document,
              'obligatoire', requirement.obligatoire,
              'validiteJours', requirement.validite_jours,
              'ordreAffichage', requirement.ordre_affichage
            )
            ORDER BY requirement.ordre_affichage ASC, requirement.libelle ASC
          )
          FROM programme_documents_requis requirement
          WHERE requirement.programme_id = p.id
            AND requirement.actif = TRUE
        ), '[]'::jsonb)
      END AS "documentsRequis"
    FROM programmes_fodip p
    LEFT JOIN LATERAL (
      SELECT version.*
      FROM programme_regles_versions version
      WHERE version.programme_id = p.id
        AND version.statut = 'ACTIVE'
        AND version.effective_from <= NOW()
        AND (version.effective_to IS NULL OR version.effective_to > NOW())
      ORDER BY version.version DESC
      LIMIT 1
    ) rule ON TRUE
    WHERE p.statut = 'ACTIVE'
      AND (p.date_debut IS NULL OR p.date_debut <= CURRENT_DATE)
      AND (p.date_fin IS NULL OR p.date_fin >= CURRENT_DATE)
      ${extraWhere}`;
  }

  async listActive() {
    const result = await this.db.query(`${this.activeSelect()} ORDER BY p.nom ASC`);
    return result.rows;
  }

  async getActive(id: string) {
    const result = await this.db.query(`${this.activeSelect('AND p.id = $1')} LIMIT 1`, [id]);
    if (!result.rows[0]) throw new NotFoundException('Programme actif introuvable');
    return result.rows[0];
  }

  async listManagement() {
    const result = await this.db.query(`
      SELECT
        p.id,
        p.code,
        p.nom,
        p.description,
        p.statut,
        p.enveloppe_totale AS "enveloppeTotale",
        p.date_debut AS "dateDebut",
        p.date_fin AS "dateFin",
        active.version AS "versionActive",
        draft.version AS "versionBrouillon",
        draft.submitted_at AS "brouillonSoumisAt",
        draft.approved_at AS "brouillonApprouveAt",
        (SELECT COUNT(*)::int FROM dossiers_financement d WHERE d.programme_id = p.id) AS "nombreDossiers",
        (SELECT COUNT(*)::int FROM dossiers_financement d WHERE d.programme_id = p.id AND d.statut <> 'BROUILLON') AS "nombreDossiersEngages"
      FROM programmes_fodip p
      LEFT JOIN LATERAL (
        SELECT v.version FROM programme_regles_versions v
        WHERE v.programme_id = p.id AND v.statut = 'ACTIVE'
        ORDER BY v.version DESC LIMIT 1
      ) active ON TRUE
      LEFT JOIN LATERAL (
        SELECT v.version, v.submitted_at, v.approved_at FROM programme_regles_versions v
        WHERE v.programme_id = p.id AND v.statut = 'BROUILLON'
        ORDER BY v.version DESC LIMIT 1
      ) draft ON TRUE
      ORDER BY p.created_at DESC, p.nom ASC
    `);
    return result.rows;
  }

  async getManagement(id: string) {
    const programResult = await this.db.query(`
      SELECT
        p.id, p.code, p.nom, p.description, p.statut,
        p.enveloppe_totale AS "enveloppeTotale",
        p.date_debut AS "dateDebut", p.date_fin AS "dateFin",
        p.created_at AS "createdAt", p.updated_at AS "updatedAt",
        (SELECT COUNT(*)::int FROM dossiers_financement d WHERE d.programme_id = p.id) AS "nombreDossiers",
        (SELECT COUNT(*)::int FROM dossiers_financement d WHERE d.programme_id = p.id AND d.statut <> 'BROUILLON') AS "nombreDossiersEngages"
      FROM programmes_fodip p
      WHERE p.id = $1
    `, [id]);
    const program = programResult.rows[0] as Record<string, unknown> | undefined;
    if (!program) throw new NotFoundException('Programme introuvable');

    const versionsResult = await this.db.query(`
      SELECT
        v.id, v.version, v.statut,
        v.effective_from AS "effectiveFrom", v.effective_to AS "effectiveTo",
        v.montant_min AS "montantMin", v.montant_max AS "montantMax",
        v.apport_min_pct AS "apportMinPct", v.anciennete_min_mois AS "ancienneteMinMois",
        v.rccm_requis AS "rccmRequis", v.nif_requis AS "nifRequis",
        v.sla_instruction_jours AS "slaInstructionJours",
        v.prepared_by AS "preparedBy", preparer.email AS "preparedByEmail",
        v.submitted_by AS "submittedBy", submitter.email AS "submittedByEmail",
        v.submitted_at AS "submittedAt",
        v.approved_by AS "approvedBy", approver.email AS "approvedByEmail",
        v.approved_at AS "approvedAt",
        v.created_at AS "createdAt", v.updated_at AS "updatedAt",
        (SELECT COUNT(*)::int FROM dossiers_financement d WHERE d.programme_regle_version_id = v.id) AS "nombreDossiers"
      FROM programme_regles_versions v
      LEFT JOIN utilisateurs preparer ON preparer.id = v.prepared_by
      LEFT JOIN utilisateurs submitter ON submitter.id = v.submitted_by
      LEFT JOIN utilisateurs approver ON approver.id = v.approved_by
      WHERE v.programme_id = $1
      ORDER BY v.version DESC
    `, [id]);

    const versionIds = versionsResult.rows.map((row) => row.id as string);
    const docsResult = versionIds.length
      ? await this.db.query(`
          SELECT
            d.regle_version_id AS "regleVersionId",
            d.code, d.libelle, d.type_document AS "typeDocument",
            d.obligatoire, d.validite_jours AS "validiteJours", d.ordre_affichage AS "ordreAffichage"
          FROM programme_regle_documents d
          WHERE d.regle_version_id = ANY($1::uuid[])
          ORDER BY d.ordre_affichage ASC, d.libelle ASC
        `, [versionIds])
      : { rows: [] as Array<Record<string, unknown>> };

    const documentsByVersion = new Map<string, Array<Record<string, unknown>>>();
    for (const document of docsResult.rows as Array<Record<string, unknown>>) {
      const versionId = document.regleVersionId as string;
      const documents = documentsByVersion.get(versionId) ?? [];
      documents.push(document);
      documentsByVersion.set(versionId, documents);
    }

    return {
      ...program,
      versions: versionsResult.rows.map((version) => ({
        ...version,
        documents: documentsByVersion.get(version.id as string) ?? [],
      })),
    };
  }

  async createProgram(actorId: string, dto: CreateProgramDto) {
    this.validateRule(dto);
    this.validateDocuments(dto.documents ?? []);
    this.validateDates(dto.dateDebut, dto.dateFin);
    try {
      const id = await this.db.transaction(async (client) => {
        const programResult = await client.query<{ id: string }>(`
          INSERT INTO programmes_fodip (
            code, nom, description, montant_min, montant_max, enveloppe_totale,
            apport_min_pct, anciennete_min_mois, rccm_requis, nif_requis,
            sla_instruction_jours, date_debut, date_fin, statut
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'BROUILLON')
          RETURNING id
        `, [
          dto.code.trim().toUpperCase(), dto.nom.trim(), dto.description ?? null,
          dto.montantMin ?? null, dto.montantMax ?? null, dto.enveloppeTotale ?? null,
          dto.apportMinPct ?? null, dto.ancienneteMinMois ?? null,
          dto.rccmRequis ?? false, dto.nifRequis ?? false, dto.slaInstructionJours ?? null,
          dto.dateDebut ?? null, dto.dateFin ?? null,
        ]);
        const programId = programResult.rows[0].id;
        const versionResult = await client.query<{ id: string }>(`
          INSERT INTO programme_regles_versions (
            programme_id, version, statut, montant_min, montant_max, apport_min_pct,
            anciennete_min_mois, rccm_requis, nif_requis, sla_instruction_jours, prepared_by
          ) VALUES ($1,1,'BROUILLON',$2,$3,$4,$5,$6,$7,$8,$9)
          RETURNING id
        `, [
          programId, dto.montantMin ?? null, dto.montantMax ?? null, dto.apportMinPct ?? null,
          dto.ancienneteMinMois ?? null, dto.rccmRequis ?? false, dto.nifRequis ?? false,
          dto.slaInstructionJours ?? null, actorId,
        ]);
        await this.replaceVersionDocuments(client, versionResult.rows[0].id, dto.documents ?? []);
        await this.audit(client, actorId, 'PROGRAM_CREATED', 'programme', programId, null, {
          code: dto.code.trim().toUpperCase(), nom: dto.nom.trim(), version: 1,
        });
        return programId;
      });
      return this.getManagement(id);
    } catch (error) {
      this.rethrowConstraint(error, 'Un programme avec ce code existe déjà');
    }
  }

  async updateProgram(actorId: string, id: string, dto: UpdateProgramDto) {
    const resultId = await this.db.transaction(async (client) => {
      const currentResult = await client.query(`SELECT * FROM programmes_fodip WHERE id = $1 FOR UPDATE`, [id]);
      const current = currentResult.rows[0] as Record<string, unknown> | undefined;
      if (!current) throw new NotFoundException('Programme introuvable');

      const next = {
        nom: dto.nom === undefined ? current.nom : dto.nom.trim(),
        description: dto.description === undefined ? current.description : dto.description,
        enveloppeTotale: dto.enveloppeTotale === undefined ? current.enveloppe_totale : dto.enveloppeTotale,
        dateDebut: dto.dateDebut === undefined ? current.date_debut : dto.dateDebut,
        dateFin: dto.dateFin === undefined ? current.date_fin : dto.dateFin,
        statut: dto.statut === undefined ? current.statut : dto.statut,
      };
      this.validateDates(next.dateDebut as string | null | undefined, next.dateFin as string | null | undefined);

      await client.query(`
        UPDATE programmes_fodip
        SET nom = $2, description = $3, enveloppe_totale = $4,
            date_debut = $5, date_fin = $6, statut = $7, updated_at = NOW()
        WHERE id = $1
      `, [id, next.nom, next.description, next.enveloppeTotale, next.dateDebut, next.dateFin, next.statut]);
      await this.audit(client, actorId, 'PROGRAM_UPDATED', 'programme', id, current, next);
      return id;
    });
    return this.getManagement(resultId);
  }

  async createDraftVersion(actorId: string, programId: string) {
    const versionNumber = await this.db.transaction(async (client) => {
      const program = await client.query(`SELECT id FROM programmes_fodip WHERE id = $1 FOR UPDATE`, [programId]);
      if (!program.rows[0]) throw new NotFoundException('Programme introuvable');

      const existingDraft = await client.query(`
        SELECT version FROM programme_regles_versions
        WHERE programme_id = $1 AND statut = 'BROUILLON'
        ORDER BY version DESC LIMIT 1
      `, [programId]);
      if (existingDraft.rows[0]) {
        throw new ConflictException(`La version ${existingDraft.rows[0].version} est déjà en brouillon`);
      }

      const sourceResult = await client.query(`
        SELECT * FROM programme_regles_versions
        WHERE programme_id = $1
        ORDER BY CASE WHEN statut = 'ACTIVE' THEN 0 ELSE 1 END, version DESC
        LIMIT 1
      `, [programId]);
      const maxResult = await client.query<{ max: number | null }>(
        `SELECT MAX(version)::int AS max FROM programme_regles_versions WHERE programme_id = $1`, [programId],
      );
      const nextVersion = (maxResult.rows[0].max ?? 0) + 1;
      const source = sourceResult.rows[0] as Record<string, unknown> | undefined;

      let defaults = source;
      if (!defaults) {
        const legacy = await client.query(`SELECT * FROM programmes_fodip WHERE id = $1`, [programId]);
        defaults = legacy.rows[0] as Record<string, unknown>;
      }

      const inserted = await client.query<{ id: string }>(`
        INSERT INTO programme_regles_versions (
          programme_id, version, statut, montant_min, montant_max, apport_min_pct,
          anciennete_min_mois, rccm_requis, nif_requis, sla_instruction_jours, prepared_by
        ) VALUES ($1,$2,'BROUILLON',$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id
      `, [
        programId, nextVersion, defaults.montant_min ?? null, defaults.montant_max ?? null,
        defaults.apport_min_pct ?? null, defaults.anciennete_min_mois ?? null,
        defaults.rccm_requis ?? false, defaults.nif_requis ?? false,
        defaults.sla_instruction_jours ?? null, actorId,
      ]);

      if (source?.id) {
        await client.query(`
          INSERT INTO programme_regle_documents (
            regle_version_id, code, libelle, type_document, obligatoire, validite_jours, ordre_affichage
          )
          SELECT $1, code, libelle, type_document, obligatoire, validite_jours, ordre_affichage
          FROM programme_regle_documents WHERE regle_version_id = $2
        `, [inserted.rows[0].id, source.id]);
      } else {
        await client.query(`
          INSERT INTO programme_regle_documents (
            regle_version_id, code, libelle, type_document, obligatoire, validite_jours, ordre_affichage
          )
          SELECT $1, code, libelle, type_document, obligatoire, validite_jours, ordre_affichage
          FROM programme_documents_requis WHERE programme_id = $2 AND actif = TRUE
        `, [inserted.rows[0].id, programId]);
      }

      await this.audit(client, actorId, 'PROGRAM_RULE_DRAFT_CREATED', 'programme_rule_version', inserted.rows[0].id, null, {
        programmeId: programId, version: nextVersion,
      });
      return nextVersion;
    });
    const program = await this.getManagement(programId);
    return { ...program, createdVersion: versionNumber };
  }

  async updateDraftVersion(actorId: string, programId: string, version: number, dto: UpdateProgramRuleDto) {
    this.validateRule(dto);
    if (dto.documents !== undefined) this.validateDocuments(dto.documents);
    await this.db.transaction(async (client) => {
      const currentResult = await client.query(`
        SELECT * FROM programme_regles_versions
        WHERE programme_id = $1 AND version = $2
        FOR UPDATE
      `, [programId, version]);
      const current = currentResult.rows[0] as Record<string, unknown> | undefined;
      if (!current) throw new NotFoundException('Version de règles introuvable');
      if (current.statut !== 'BROUILLON') throw new ConflictException('Seule une version en brouillon peut être modifiée');

      const value = (key: keyof UpdateProgramRuleDto, dbKey: string) =>
        dto[key] === undefined ? current[dbKey] : dto[key];
      const next = {
        montantMin: value('montantMin', 'montant_min'),
        montantMax: value('montantMax', 'montant_max'),
        apportMinPct: value('apportMinPct', 'apport_min_pct'),
        ancienneteMinMois: value('ancienneteMinMois', 'anciennete_min_mois'),
        rccmRequis: value('rccmRequis', 'rccm_requis'),
        nifRequis: value('nifRequis', 'nif_requis'),
        slaInstructionJours: value('slaInstructionJours', 'sla_instruction_jours'),
      };
      this.validateRule(next as UpdateProgramRuleDto);

      await client.query(`
        UPDATE programme_regles_versions
        SET montant_min = $3, montant_max = $4, apport_min_pct = $5,
            anciennete_min_mois = $6, rccm_requis = $7, nif_requis = $8,
            sla_instruction_jours = $9, prepared_by = $10,
            submitted_by = NULL, submitted_at = NULL, approved_by = NULL, approved_at = NULL,
            updated_at = NOW()
        WHERE programme_id = $1 AND version = $2
      `, [
        programId, version, next.montantMin, next.montantMax, next.apportMinPct,
        next.ancienneteMinMois, next.rccmRequis, next.nifRequis, next.slaInstructionJours, actorId,
      ]);
      if (dto.documents !== undefined) {
        await this.replaceVersionDocuments(client, current.id as string, dto.documents);
      }
      await this.audit(client, actorId, 'PROGRAM_RULE_UPDATED', 'programme_rule_version', current.id as string, current, next);
    });
    return this.getManagement(programId);
  }

  async submitVersion(actorId: string, programId: string, version: number) {
    await this.db.transaction(async (client) => {
      const result = await client.query(`
        SELECT * FROM programme_regles_versions
        WHERE programme_id = $1 AND version = $2 FOR UPDATE
      `, [programId, version]);
      const current = result.rows[0] as Record<string, unknown> | undefined;
      if (!current) throw new NotFoundException('Version de règles introuvable');
      if (current.statut !== 'BROUILLON') throw new ConflictException('Seul un brouillon peut être soumis en revue');
      await client.query(`
        UPDATE programme_regles_versions
        SET submitted_by = $3, submitted_at = NOW(), approved_by = NULL, approved_at = NULL, updated_at = NOW()
        WHERE programme_id = $1 AND version = $2
      `, [programId, version, actorId]);
      await this.audit(client, actorId, 'PROGRAM_RULE_SUBMITTED', 'programme_rule_version', current.id as string, null, {
        programmeId: programId, version,
      });
    });
    return this.getManagement(programId);
  }

  async approveVersion(actorId: string, programId: string, version: number) {
    await this.db.transaction(async (client) => {
      const result = await client.query(`
        SELECT * FROM programme_regles_versions
        WHERE programme_id = $1 AND version = $2 FOR UPDATE
      `, [programId, version]);
      const current = result.rows[0] as Record<string, unknown> | undefined;
      if (!current) throw new NotFoundException('Version de règles introuvable');
      if (current.statut !== 'BROUILLON' || !current.submitted_at) {
        throw new ConflictException('La version doit d’abord être soumise en revue');
      }
      if (current.prepared_by === actorId || current.submitted_by === actorId) {
        throw new ConflictException('La validation doit être réalisée par un second acteur Direction');
      }
      await client.query(`
        UPDATE programme_regles_versions
        SET approved_by = $3, approved_at = NOW(), updated_at = NOW()
        WHERE programme_id = $1 AND version = $2
      `, [programId, version, actorId]);
      await this.audit(client, actorId, 'PROGRAM_RULE_APPROVED', 'programme_rule_version', current.id as string, null, {
        programmeId: programId, version,
      });
    });
    return this.getManagement(programId);
  }

  async activateVersion(actorId: string, programId: string, version: number) {
    await this.db.transaction(async (client) => {
      const program = await client.query(`SELECT * FROM programmes_fodip WHERE id = $1 FOR UPDATE`, [programId]);
      if (!program.rows[0]) throw new NotFoundException('Programme introuvable');
      const targetResult = await client.query(`
        SELECT * FROM programme_regles_versions
        WHERE programme_id = $1 AND version = $2 FOR UPDATE
      `, [programId, version]);
      const target = targetResult.rows[0] as Record<string, unknown> | undefined;
      if (!target) throw new NotFoundException('Version de règles introuvable');
      if (target.statut !== 'BROUILLON') throw new ConflictException('Seul un brouillon validé peut être activé');
      if (!target.approved_by || !target.approved_at) {
        throw new ConflictException('La version doit être validée par un second acteur avant activation');
      }

      const previousResult = await client.query(`
        SELECT id, version FROM programme_regles_versions
        WHERE programme_id = $1 AND statut = 'ACTIVE' FOR UPDATE
      `, [programId]);
      await client.query(`
        UPDATE programme_regles_versions
        SET statut = 'ARCHIVEE', effective_to = NOW(), updated_at = NOW()
        WHERE programme_id = $1 AND statut = 'ACTIVE' AND version <> $2
      `, [programId, version]);
      await client.query(`
        UPDATE programme_regles_versions
        SET statut = 'ACTIVE', effective_from = NOW(), effective_to = NULL, updated_at = NOW()
        WHERE programme_id = $1 AND version = $2
      `, [programId, version]);
      await client.query(`
        UPDATE programmes_fodip
        SET statut = 'ACTIVE', montant_min = $2, montant_max = $3, apport_min_pct = $4,
            anciennete_min_mois = $5, rccm_requis = $6, nif_requis = $7,
            sla_instruction_jours = $8, updated_at = NOW()
        WHERE id = $1
      `, [
        programId, target.montant_min, target.montant_max, target.apport_min_pct,
        target.anciennete_min_mois, target.rccm_requis, target.nif_requis, target.sla_instruction_jours,
      ]);

      await client.query(`DELETE FROM programme_documents_requis WHERE programme_id = $1`, [programId]);
      await client.query(`
        INSERT INTO programme_documents_requis (
          programme_id, code, libelle, type_document, obligatoire, validite_jours, ordre_affichage, actif
        )
        SELECT $1, code, libelle, type_document, obligatoire, validite_jours, ordre_affichage, TRUE
        FROM programme_regle_documents WHERE regle_version_id = $2
      `, [programId, target.id]);

      await this.audit(client, actorId, 'PROGRAM_RULE_ACTIVATED', 'programme', programId, {
        previousVersions: previousResult.rows.map((row) => row.version),
      }, { version });
    });
    return this.getManagement(programId);
  }

  private validateRule(dto: UpdateProgramRuleDto | CreateProgramDto) {
    const min = dto.montantMin;
    const max = dto.montantMax;
    if (min != null && max != null && Number(min) > Number(max)) {
      throw new BadRequestException('Le montant minimal ne peut pas dépasser le montant maximal');
    }
  }

  private validateDates(start?: string | Date | null, end?: string | Date | null) {
    if (start && end && new Date(start).getTime() > new Date(end).getTime()) {
      throw new BadRequestException('La date de début ne peut pas être postérieure à la date de fin');
    }
  }

  private validateDocuments(documents: ProgramDocumentDto[]) {
    const codes = new Set<string>();
    const types = new Set<string>();
    for (const document of documents) {
      const code = document.code.trim().toUpperCase();
      if (codes.has(code)) throw new BadRequestException(`Code de document dupliqué : ${code}`);
      if (types.has(document.typeDocument)) {
        throw new BadRequestException(`Type documentaire dupliqué : ${document.typeDocument}`);
      }
      codes.add(code);
      types.add(document.typeDocument);
    }
  }

  private async replaceVersionDocuments(client: PoolClient, versionId: string, documents: ProgramDocumentDto[]) {
    await client.query(`DELETE FROM programme_regle_documents WHERE regle_version_id = $1`, [versionId]);
    for (const document of documents) {
      await client.query(`
        INSERT INTO programme_regle_documents (
          regle_version_id, code, libelle, type_document, obligatoire, validite_jours, ordre_affichage
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        versionId, document.code.trim().toUpperCase(), document.libelle.trim(), document.typeDocument,
        document.obligatoire ?? true, document.validiteJours ?? null, document.ordreAffichage ?? 0,
      ]);
    }
  }

  private async audit(
    client: PoolClient,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    oldValues: unknown,
    newValues: unknown,
  ) {
    await client.query(`
      INSERT INTO audit_logs (utilisateur_id, action, entity_type, entity_id, old_values, new_values)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)
    `, [actorId, action, entityType, entityId, JSON.stringify(oldValues), JSON.stringify(newValues)]);
  }

  private rethrowConstraint(error: unknown, message: string): never {
    if ((error as { code?: string })?.code === '23505') throw new ConflictException(message);
    throw error;
  }
}

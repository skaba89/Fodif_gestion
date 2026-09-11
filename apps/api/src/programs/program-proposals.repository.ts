import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { CreateProgramDto, ProgramDocumentDto, UpdateProgramDto, UpdateProgramRuleDto } from './dto/program.dto';

@Injectable()
export class ProgramProposalsRepository {
  constructor(private readonly db: DatabaseService) {}

  async references() {
    const [regions, secteurs] = await Promise.all([
      this.db.query(`SELECT id, code, nom FROM regions ORDER BY nom ASC`),
      this.db.query(`SELECT id, code, nom FROM secteurs_activite WHERE actif = TRUE ORDER BY nom ASC`),
    ]);
    return { regions: regions.rows, secteurs: secteurs.rows };
  }

  async listOwn(actorId: string) {
    const result = await this.db.query(`
      SELECT
        p.id, p.code, p.nom, p.description, p.statut,
        p.enveloppe_totale AS "enveloppeTotale",
        p.date_debut AS "dateDebut", p.date_fin AS "dateFin",
        p.is_default AS "isDefault", p.created_at AS "createdAt",
        draft.version AS "versionBrouillon",
        draft.submitted_at AS "submittedAt",
        draft.approved_at AS "approvedAt",
        CASE
          WHEN draft.approved_at IS NOT NULL THEN 'VALIDE'
          WHEN draft.submitted_at IS NOT NULL THEN 'SOUMIS'
          ELSE 'BROUILLON'
        END AS "workflowStatus"
      FROM programmes_fodip p
      LEFT JOIN LATERAL (
        SELECT v.version, v.submitted_at, v.approved_at
        FROM programme_regles_versions v
        WHERE v.programme_id = p.id AND v.statut = 'BROUILLON'
        ORDER BY v.version DESC LIMIT 1
      ) draft ON TRUE
      WHERE p.created_by = $1
      ORDER BY p.created_at DESC
    `, [actorId]);
    return result.rows;
  }

  async getOwn(actorId: string, id: string) {
    const programResult = await this.db.query(`
      SELECT
        p.id, p.code, p.nom, p.description, p.statut,
        p.enveloppe_totale AS "enveloppeTotale",
        p.date_debut AS "dateDebut", p.date_fin AS "dateFin",
        p.is_default AS "isDefault", p.source_reference AS "sourceReference",
        p.created_at AS "createdAt", p.updated_at AS "updatedAt",
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', r.id, 'code', r.code, 'nom', r.nom) ORDER BY r.nom)
          FROM programme_regions pr JOIN regions r ON r.id = pr.region_id
          WHERE pr.programme_id = p.id
        ), '[]'::jsonb) AS regions,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', s.id, 'code', s.code, 'nom', s.nom) ORDER BY s.nom)
          FROM programme_secteurs ps JOIN secteurs_activite s ON s.id = ps.secteur_id
          WHERE ps.programme_id = p.id
        ), '[]'::jsonb) AS secteurs
      FROM programmes_fodip p
      WHERE p.id = $1 AND p.created_by = $2
    `, [id, actorId]);
    const program = programResult.rows[0] as Record<string, unknown> | undefined;
    if (!program) throw new NotFoundException('Proposition de programme introuvable');

    const versionsResult = await this.db.query(`
      SELECT
        v.id, v.version, v.statut,
        v.montant_min AS "montantMin", v.montant_max AS "montantMax",
        v.apport_min_pct AS "apportMinPct", v.anciennete_min_mois AS "ancienneteMinMois",
        v.rccm_requis AS "rccmRequis", v.nif_requis AS "nifRequis",
        v.sla_instruction_jours AS "slaInstructionJours",
        v.submitted_at AS "submittedAt", v.approved_at AS "approvedAt",
        submitter.email AS "submittedByEmail", approver.email AS "approvedByEmail",
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'code', d.code,
            'libelle', d.libelle,
            'typeDocument', d.type_document,
            'obligatoire', d.obligatoire,
            'validiteJours', d.validite_jours,
            'ordreAffichage', d.ordre_affichage
          ) ORDER BY d.ordre_affichage, d.libelle)
          FROM programme_regle_documents d WHERE d.regle_version_id = v.id
        ), '[]'::jsonb) AS documents
      FROM programme_regles_versions v
      LEFT JOIN utilisateurs submitter ON submitter.id = v.submitted_by
      LEFT JOIN utilisateurs approver ON approver.id = v.approved_by
      WHERE v.programme_id = $1
      ORDER BY v.version DESC
    `, [id]);

    return { ...program, versions: versionsResult.rows };
  }

  async create(actorId: string, dto: CreateProgramDto) {
    this.validateRule(dto);
    this.validateDates(dto.dateDebut, dto.dateFin);
    this.validateDocuments(dto.documents ?? []);

    try {
      const id = await this.db.transaction(async (client) => {
        await this.validateScope(client, dto.regionIds ?? [], dto.secteurIds ?? []);
        const programResult = await client.query<{ id: string }>(`
          INSERT INTO programmes_fodip (
            code, nom, description, montant_min, montant_max, enveloppe_totale,
            apport_min_pct, anciennete_min_mois, rccm_requis, nif_requis,
            sla_instruction_jours, date_debut, date_fin, statut, created_by, is_default
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'BROUILLON',$14,FALSE)
          RETURNING id
        `, [
          dto.code.trim().toUpperCase(), dto.nom.trim(), dto.description ?? null,
          dto.montantMin ?? null, dto.montantMax ?? null, dto.enveloppeTotale ?? null,
          dto.apportMinPct ?? null, dto.ancienneteMinMois ?? null,
          dto.rccmRequis ?? false, dto.nifRequis ?? false, dto.slaInstructionJours ?? null,
          dto.dateDebut ?? null, dto.dateFin ?? null, actorId,
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
        await this.replaceDocuments(client, versionResult.rows[0].id, dto.documents ?? []);
        await this.replaceScope(client, programId, dto.regionIds ?? [], dto.secteurIds ?? []);
        await this.audit(client, actorId, 'PROGRAM_PROPOSAL_CREATED', 'programme', programId, {
          code: dto.code.trim().toUpperCase(), regionIds: dto.regionIds ?? [], secteurIds: dto.secteurIds ?? [],
        });
        return programId;
      });
      return this.getOwn(actorId, id);
    } catch (error) {
      if ((error as { code?: string })?.code === '23505') {
        throw new ConflictException('Un programme avec ce code existe déjà');
      }
      throw error;
    }
  }

  async update(actorId: string, id: string, dto: UpdateProgramDto) {
    await this.db.transaction(async (client) => {
      const result = await client.query(`
        SELECT p.*,
               v.id AS draft_id, v.submitted_at
        FROM programmes_fodip p
        LEFT JOIN LATERAL (
          SELECT id, submitted_at FROM programme_regles_versions
          WHERE programme_id = p.id AND statut = 'BROUILLON'
          ORDER BY version DESC LIMIT 1
        ) v ON TRUE
        WHERE p.id = $1 AND p.created_by = $2
        FOR UPDATE OF p
      `, [id, actorId]);
      const current = result.rows[0] as Record<string, unknown> | undefined;
      if (!current) throw new NotFoundException('Proposition de programme introuvable');
      if (current.statut !== 'BROUILLON') throw new ConflictException('Un programme déjà publié ne peut plus être modifié par son proposant');
      if (current.submitted_at) throw new ConflictException('Une proposition soumise ne peut plus être modifiée avant décision');

      const nextStart = dto.dateDebut === undefined ? current.date_debut : dto.dateDebut;
      const nextEnd = dto.dateFin === undefined ? current.date_fin : dto.dateFin;
      this.validateDates(nextStart as string | null | undefined, nextEnd as string | null | undefined);
      if (dto.regionIds !== undefined || dto.secteurIds !== undefined) {
        await this.validateScope(client, dto.regionIds ?? [], dto.secteurIds ?? []);
      }

      await client.query(`
        UPDATE programmes_fodip
        SET nom = COALESCE($3, nom),
            description = CASE WHEN $4::boolean THEN $5 ELSE description END,
            enveloppe_totale = CASE WHEN $6::boolean THEN $7 ELSE enveloppe_totale END,
            date_debut = CASE WHEN $8::boolean THEN $9::date ELSE date_debut END,
            date_fin = CASE WHEN $10::boolean THEN $11::date ELSE date_fin END,
            updated_at = NOW()
        WHERE id = $1 AND created_by = $2
      `, [
        id, actorId, dto.nom ?? null,
        dto.description !== undefined, dto.description ?? null,
        dto.enveloppeTotale !== undefined, dto.enveloppeTotale ?? null,
        dto.dateDebut !== undefined, dto.dateDebut ?? null,
        dto.dateFin !== undefined, dto.dateFin ?? null,
      ]);

      if (dto.regionIds !== undefined || dto.secteurIds !== undefined) {
        const currentRegions = dto.regionIds === undefined
          ? (await client.query<{ id: string }>('SELECT region_id AS id FROM programme_regions WHERE programme_id = $1', [id])).rows.map((row) => row.id)
          : dto.regionIds;
        const currentSectors = dto.secteurIds === undefined
          ? (await client.query<{ id: string }>('SELECT secteur_id AS id FROM programme_secteurs WHERE programme_id = $1', [id])).rows.map((row) => row.id)
          : dto.secteurIds;
        await this.replaceScope(client, id, currentRegions, currentSectors);
      }
      await this.audit(client, actorId, 'PROGRAM_PROPOSAL_UPDATED', 'programme', id, dto);
    });
    return this.getOwn(actorId, id);
  }

  async updateRules(actorId: string, programId: string, version: number, dto: UpdateProgramRuleDto) {
    this.validateRule(dto);
    if (dto.documents !== undefined) this.validateDocuments(dto.documents);
    await this.db.transaction(async (client) => {
      const result = await client.query(`
        SELECT v.*
        FROM programme_regles_versions v
        JOIN programmes_fodip p ON p.id = v.programme_id
        WHERE p.id = $1 AND p.created_by = $2 AND p.statut = 'BROUILLON' AND v.version = $3
        FOR UPDATE OF v
      `, [programId, actorId, version]);
      const current = result.rows[0] as Record<string, unknown> | undefined;
      if (!current) throw new NotFoundException('Version de proposition introuvable');
      if (current.statut !== 'BROUILLON') throw new ConflictException('Seul un brouillon peut être modifié');
      if (current.submitted_at) throw new ConflictException('Une proposition soumise ne peut plus être modifiée avant décision');

      const value = (key: keyof UpdateProgramRuleDto, dbKey: string) => dto[key] === undefined ? current[dbKey] : dto[key];
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
        SET montant_min = $4, montant_max = $5, apport_min_pct = $6,
            anciennete_min_mois = $7, rccm_requis = $8, nif_requis = $9,
            sla_instruction_jours = $10, prepared_by = $2, updated_at = NOW()
        WHERE programme_id = $1 AND version = $3
      `, [programId, actorId, version, next.montantMin, next.montantMax, next.apportMinPct,
        next.ancienneteMinMois, next.rccmRequis, next.nifRequis, next.slaInstructionJours]);
      if (dto.documents !== undefined) await this.replaceDocuments(client, current.id as string, dto.documents);
      await this.audit(client, actorId, 'PROGRAM_PROPOSAL_RULES_UPDATED', 'programme_rule_version', current.id as string, dto);
    });
    return this.getOwn(actorId, programId);
  }

  async submit(actorId: string, programId: string, version: number) {
    await this.db.transaction(async (client) => {
      const result = await client.query(`
        SELECT v.*
        FROM programme_regles_versions v
        JOIN programmes_fodip p ON p.id = v.programme_id
        WHERE p.id = $1 AND p.created_by = $2 AND p.statut = 'BROUILLON' AND v.version = $3
        FOR UPDATE OF v
      `, [programId, actorId, version]);
      const current = result.rows[0] as Record<string, unknown> | undefined;
      if (!current) throw new NotFoundException('Version de proposition introuvable');
      if (current.statut !== 'BROUILLON') throw new ConflictException('Seul un brouillon peut être soumis');
      if (current.submitted_at) throw new ConflictException('Cette proposition est déjà soumise à la hiérarchie');
      await client.query(`
        UPDATE programme_regles_versions
        SET submitted_by = $2, submitted_at = NOW(), approved_by = NULL, approved_at = NULL, updated_at = NOW()
        WHERE programme_id = $1 AND version = $3
      `, [programId, actorId, version]);
      await this.audit(client, actorId, 'PROGRAM_PROPOSAL_SUBMITTED', 'programme_rule_version', current.id as string, {
        programmeId: programId, version, approverRole: 'DIRECTION_FODIP',
      });
    });
    return this.getOwn(actorId, programId);
  }

  private validateRule(dto: UpdateProgramRuleDto | CreateProgramDto) {
    if (dto.montantMin != null && dto.montantMax != null && Number(dto.montantMin) > Number(dto.montantMax)) {
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
      if (types.has(document.typeDocument)) throw new BadRequestException(`Type documentaire dupliqué : ${document.typeDocument}`);
      codes.add(code);
      types.add(document.typeDocument);
    }
  }

  private async validateScope(client: PoolClient, regionIds: string[], secteurIds: string[]) {
    const uniqueRegions = [...new Set(regionIds)];
    const uniqueSectors = [...new Set(secteurIds)];
    if (uniqueRegions.length) {
      const count = await client.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM regions WHERE id = ANY($1::uuid[])', [uniqueRegions]);
      if (count.rows[0].count !== uniqueRegions.length) throw new BadRequestException('Une ou plusieurs régions sont inconnues');
    }
    if (uniqueSectors.length) {
      const count = await client.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM secteurs_activite WHERE actif = TRUE AND id = ANY($1::uuid[])', [uniqueSectors]);
      if (count.rows[0].count !== uniqueSectors.length) throw new BadRequestException('Un ou plusieurs secteurs sont inconnus ou inactifs');
    }
  }

  private async replaceScope(client: PoolClient, programId: string, regionIds: string[], secteurIds: string[]) {
    await client.query('DELETE FROM programme_regions WHERE programme_id = $1', [programId]);
    await client.query('DELETE FROM programme_secteurs WHERE programme_id = $1', [programId]);
    for (const regionId of [...new Set(regionIds)]) {
      await client.query('INSERT INTO programme_regions(programme_id, region_id) VALUES ($1,$2)', [programId, regionId]);
    }
    for (const secteurId of [...new Set(secteurIds)]) {
      await client.query('INSERT INTO programme_secteurs(programme_id, secteur_id) VALUES ($1,$2)', [programId, secteurId]);
    }
  }

  private async replaceDocuments(client: PoolClient, versionId: string, documents: ProgramDocumentDto[]) {
    await client.query('DELETE FROM programme_regle_documents WHERE regle_version_id = $1', [versionId]);
    for (const document of documents) {
      await client.query(`
        INSERT INTO programme_regle_documents(
          regle_version_id, code, libelle, type_document, obligatoire, validite_jours, ordre_affichage
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [versionId, document.code.trim().toUpperCase(), document.libelle.trim(), document.typeDocument,
        document.obligatoire ?? true, document.validiteJours ?? null, document.ordreAffichage ?? 0]);
    }
  }

  private async audit(client: PoolClient, actorId: string, action: string, entityType: string, entityId: string, values: unknown) {
    await client.query(`
      INSERT INTO audit_logs(utilisateur_id, action, entity_type, entity_id, old_values, new_values)
      VALUES ($1,$2,$3,$4,NULL,$5::jsonb)
    `, [actorId, action, entityType, entityId, JSON.stringify(values)]);
  }
}

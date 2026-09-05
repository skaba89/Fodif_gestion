import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { IdempotencyService } from '../common/idempotency.service';
import { BankReconciliationsRepository } from './bank-reconciliations.repository';
import { CreateBankStatementEntryDto } from './dto/create-bank-statement-entry.dto';
import { ListBankReconciliationsDto } from './dto/list-bank-reconciliations.dto';
import { MatchBankStatementEntryDto } from './dto/match-bank-statement-entry.dto';

const numericKeys = new Set(['montant', 'montantOperation', 'montantARapprocher']);

function normalize<T>(value: T): T {
  if (Array.isArray(value)) return value.map(normalize) as T;
  if (value instanceof Date || !value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key, numericKeys.has(key) && child !== null ? Number(child) : normalize(child),
  ])) as T;
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

@Injectable()
export class BankReconciliationsService {
  constructor(
    private readonly repository: BankReconciliationsRepository,
    private readonly idempotency: IdempotencyService,
  ) {}

  async overview(query: ListBankReconciliationsDto) {
    return normalize(await this.repository.overview(query));
  }

  async createEntry(user: AuthenticatedUser, dto: CreateBankStatementEntryDto, idempotencyKey?: string) {
    return this.idempotency.run('bank_reconciliations.create_entry', idempotencyKey, user.sub, dto, async () => {
      try {
        const id = await this.repository.createEntry(user.sub, dto);
        if (!id) throw new NotFoundException('Banque partenaire active introuvable.');
        return { id };
      } catch (error) {
        if (isUniqueConflict(error)) {
          throw new ConflictException('Cette référence bancaire existe déjà pour cette banque.');
        }
        throw error;
      }
    });
  }

  async matchEntry(user: AuthenticatedUser, entryId: string, dto: MatchBankStatementEntryDto, idempotencyKey?: string) {
    return this.idempotency.run('bank_reconciliations.match_entry', idempotencyKey, user.sub, { entryId, dto }, async () => {
      const result = await this.repository.matchEntry(user.sub, entryId, dto);
      switch (result.outcome) {
        case 'ENTRY_NOT_FOUND': throw new NotFoundException('Mouvement bancaire introuvable.');
        case 'ENTRY_ALREADY_MATCHED': throw new ConflictException('Ce mouvement bancaire est déjà rapproché.');
        case 'OPERATION_NOT_FOUND': throw new NotFoundException('Opération financière introuvable.');
        case 'OPERATION_ALREADY_MATCHED': throw new ConflictException('Cette opération financière est déjà rapprochée.');
        case 'OPERATION_NOT_EXECUTED': throw new ConflictException('Seul un décaissement effectivement exécuté peut être rapproché.');
        case 'BANK_MISMATCH': throw new BadRequestException('La banque du relevé ne correspond pas à celle du financement.');
        case 'DIRECTION_MISMATCH': throw new BadRequestException('Le sens bancaire ne correspond pas au type de l’opération.');
        case 'AMOUNT_MISMATCH':
          throw new BadRequestException(
            `Écart de montant : relevé ${result.statementAmount} GNF, opération ${result.operationAmount} GNF.`,
          );
        case 'OK': return { id: result.id, statut: 'RAPPROCHE' };
      }
    });
  }
}

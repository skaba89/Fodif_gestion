import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { buildAmortizationSchedule, validateAvailableAmount, validateImpact } from '../finance-policy';
import { CreateFinancingDto } from './dto/create-financing.dto';
import { CreateRepaymentDto } from './dto/create-repayment.dto';
import { ExecuteDisbursementDto } from './dto/execute-disbursement.dto';
import { ListFinancingsDto } from './dto/list-financings.dto';
import { PlanDisbursementDto } from './dto/plan-disbursement.dto';
import { SaveImpactDto } from './dto/save-impact.dto';
import { FinancingsRepository } from './financings.repository';

const numericKeys = new Set([
  'montantAccorde', 'montantDecaisse', 'montantDu', 'montantRembourse', 'impaye',
  'tauxInteret', 'montant', 'capitalDu', 'interetDu', 'montantTotalDu', 'montantPaye',
  'resteAPayer', 'chiffreAffaires', 'chiffreExport', 'productionLocale',
]);

export interface FinancingDetail {
  id: string;
  entrepriseId: string;
  montantAccorde: number;
  disbursements: Array<{ id: string; statut: string; montant: number }>;
  installments: Array<{ id: string; montantPaye: number; montantTotalDu: number }>;
  impact: unknown[];
  audit: unknown[];
  [key: string]: unknown;
}

function normalize<T>(value: T): T {
  if (Array.isArray(value)) return value.map(normalize) as T;
  if (value instanceof Date || !value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key, numericKeys.has(key) && child !== null ? Number(child) : normalize(child),
  ])) as T;
}

function isDatabaseConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

@Injectable()
export class FinancingsService {
  constructor(private readonly financings: FinancingsRepository) {}

  async list(query: ListFinancingsDto) {
    return normalize(await this.financings.list(query));
  }

  async listEligibleApplications() {
    return normalize(await this.financings.listEligibleApplications());
  }

  async get(id: string): Promise<FinancingDetail> {
    const financing = await this.financings.findById(id);
    if (!financing) throw new NotFoundException('Financing not found');
    return normalize(financing) as unknown as FinancingDetail;
  }

  async createFromApplication(user: AuthenticatedUser, applicationId: string, dto: CreateFinancingDto) {
    const application = await this.financings.findEligibleApplication(applicationId);
    if (!application) throw new ConflictException('Application is not approved or already has a financing');
    const schedule = buildAmortizationSchedule(
      Number(application.montantApprouve), Number(application.tauxInteret ?? 0), application.dureeMois, dto.dateDebut,
    );
    try {
      const id = await this.financings.createFromApplication(application, user.sub, dto.dateSignature, dto.dateDebut, schedule);
      return this.get(id);
    } catch (error) {
      if (isDatabaseConflict(error)) throw new ConflictException('Application already has a financing');
      throw error;
    }
  }

  async planDisbursement(user: AuthenticatedUser, id: string, dto: PlanDisbursementDto) {
    const financing = await this.get(id);
    const committed = financing.disbursements
      .filter((item) => item.statut !== 'ANNULE')
      .reduce((sum, item) => sum + item.montant, 0);
    const error = validateAvailableAmount(dto.montant, committed, financing.montantAccorde, 'Disbursement');
    if (error) throw new BadRequestException(error);
    const inserted = await this.financings.planDisbursement(id, user.sub, dto);
    if (!inserted) throw new ConflictException('Financing balance changed before disbursement planning');
    return this.get(id);
  }

  async executeDisbursement(user: AuthenticatedUser, id: string, disbursementId: string, dto: ExecuteDisbursementDto) {
    await this.get(id);
    const updated = await this.financings.executeDisbursement(id, disbursementId, user.sub, dto);
    if (!updated) throw new ConflictException('Disbursement is not in PREVU status');
    return this.get(id);
  }

  async createRepayment(user: AuthenticatedUser, id: string, dto: CreateRepaymentDto) {
    const financing = await this.get(id);
    const installment = financing.installments.find((item) => item.id === dto.echeanceId);
    if (!installment) throw new NotFoundException('Installment not found for this financing');
    const error = validateAvailableAmount(dto.montant, installment.montantPaye, installment.montantTotalDu, 'Repayment');
    if (error) throw new BadRequestException(error);
    const inserted = await this.financings.createRepayment(id, user.sub, dto);
    if (!inserted) throw new ConflictException('Installment balance changed before repayment');
    return this.get(id);
  }

  async saveImpact(user: AuthenticatedUser, id: string, dto: SaveImpactDto) {
    const financing = await this.get(id);
    const error = validateImpact(dto as unknown as Record<string, unknown>);
    if (error) throw new BadRequestException(error);
    await this.financings.saveImpact(id, financing.entrepriseId, user.sub, dto);
    return this.get(id);
  }
}

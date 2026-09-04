import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { IdempotencyService } from '../common/idempotency.service';
import { validateAvailableAmount } from '../finance-policy';
import { CreateRepaymentDto } from '../financings/dto/create-repayment.dto';
import { CreatePartnerDisbursementDto } from './dto/create-partner-disbursement.dto';
import { ListPartnerFinancingsDto } from './dto/list-partner-financings.dto';
import { PartnerRepository } from './partner.repository';

const numericKeys = new Set([
  'montantAccorde', 'tauxInteret', 'montant', 'capitalDu', 'interetDu', 'montantTotalDu', 'montantPaye', 'resteAPayer',
]);

export interface PartnerFinancingDetail {
  id: string;
  montantAccorde: number;
  disbursements: Array<{ statut: string; montant: number }>;
  installments: Array<{ id: string; montantPaye: number; montantTotalDu: number }>;
  [key: string]: unknown;
}

function normalize<T>(value: T): T {
  if (Array.isArray(value)) return value.map(normalize) as T;
  if (value instanceof Date || !value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key, numericKeys.has(key) && child !== null ? Number(child) : normalize(child),
  ])) as T;
}

@Injectable()
export class PartnerService {
  constructor(
    private readonly partner: PartnerRepository,
    private readonly idempotency: IdempotencyService,
  ) {}

  private partnerId(user: AuthenticatedUser): string {
    if (!user.partenaireBancaireId) throw new ForbiddenException('Partner bank scope is required');
    return user.partenaireBancaireId;
  }

  async list(user: AuthenticatedUser, query: ListPartnerFinancingsDto) {
    return normalize(await this.partner.list(this.partnerId(user), query));
  }

  async get(user: AuthenticatedUser, id: string): Promise<PartnerFinancingDetail> {
    const financing = await this.partner.findById(this.partnerId(user), id);
    if (!financing) throw new NotFoundException('Financing not found');
    return normalize(financing) as unknown as PartnerFinancingDetail;
  }

  async createDisbursement(user: AuthenticatedUser, id: string, dto: CreatePartnerDisbursementDto, idempotencyKey?: string) {
    const partnerId = this.partnerId(user);
    return this.idempotency.run('partner.create_disbursement', idempotencyKey, user.sub, { id, dto }, async () => {
      const financing = await this.get(user, id);
      const committed = financing.disbursements
        .filter((item) => item.statut !== 'ANNULE')
        .reduce((sum, item) => sum + item.montant, 0);
      const error = validateAvailableAmount(dto.montant, committed, financing.montantAccorde, 'Disbursement');
      if (error) throw new BadRequestException(error);
      const inserted = await this.partner.createDisbursement(partnerId, id, user.sub, dto);
      if (!inserted) throw new ConflictException('Financing balance changed before disbursement declaration');
      return this.get(user, id);
    });
  }

  async createRepayment(user: AuthenticatedUser, id: string, dto: CreateRepaymentDto, idempotencyKey?: string) {
    const partnerId = this.partnerId(user);
    return this.idempotency.run('partner.create_repayment', idempotencyKey, user.sub, { id, dto }, async () => {
      const financing = await this.get(user, id);
      const installment = financing.installments.find((item) => item.id === dto.echeanceId);
      if (!installment) throw new NotFoundException('Installment not found for this financing');
      const error = validateAvailableAmount(dto.montant, installment.montantPaye, installment.montantTotalDu, 'Repayment');
      if (error) throw new BadRequestException(error);
      const inserted = await this.partner.createRepayment(partnerId, id, user.sub, dto);
      if (!inserted) throw new ConflictException('Installment balance changed before repayment declaration');
      return this.get(user, id);
    });
  }
}

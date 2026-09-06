import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { normalizeRoleCodes, validateUserScope } from '../admin-policy';
import { AdministrationRepository } from './administration.repository';
import { CreateEnterpriseDto } from './dto/create-enterprise.dto';
import { CreatePartnerBankDto } from './dto/create-partner-bank.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class AdministrationService {
  constructor(private readonly administration: AdministrationRepository) {}

  listUsers(search?: string) { return this.administration.listUsers(search); }
  listRoles() { return this.administration.listRoles(); }
  listEnterprises() { return this.administration.listEnterprises(); }
  listPartnerBanks() { return this.administration.listPartnerBanks(); }

  async createEnterprise(actorId: string, dto: CreateEnterpriseDto) {
    try {
      return await this.administration.createEnterprise(actorId, {
        codeFodip: dto.codeFodip.trim().toUpperCase(),
        raisonSociale: dto.raisonSociale.trim(),
        nomCommercial: dto.nomCommercial?.trim() || undefined,
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        throw new ConflictException('ENTERPRISE_CODE_ALREADY_EXISTS');
      }
      throw error;
    }
  }

  async createPartnerBank(actorId: string, dto: CreatePartnerBankDto) {
    try {
      return await this.administration.createPartnerBank(actorId, {
        code: dto.code.trim().toUpperCase(),
        raisonSociale: dto.raisonSociale.trim(),
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        throw new ConflictException('PARTNER_BANK_CODE_ALREADY_EXISTS');
      }
      throw error;
    }
  }

  async createUser(actorId: string, dto: CreateUserDto) {
    const roles = normalizeRoleCodes(dto.roles);
    const scopeError = validateUserScope(roles, dto.entrepriseId, dto.partenaireBancaireId);
    if (scopeError) throw new BadRequestException(scopeError);
    try {
      const result = await this.administration.create(actorId, {
        ...dto, roles, passwordHash: await hash(dto.password, 12), mfaRequired: dto.mfaRequired ?? false,
      });
      if ('error' in result) throw new BadRequestException(result.error);
      return result;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        throw new ConflictException('EMAIL_ALREADY_EXISTS');
      }
      throw error;
    }
  }

  async updateUser(actorId: string, id: string, dto: UpdateUserDto) {
    const roles = dto.roles ? normalizeRoleCodes(dto.roles) : undefined;
    if (roles) {
      const scopeError = validateUserScope(roles, dto.entrepriseId, dto.partenaireBancaireId);
      if (scopeError) throw new BadRequestException(scopeError);
    }
    const result = await this.administration.update(actorId, id, { ...dto, roles });
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') throw new NotFoundException('User not found');
      if (result.error === 'PROTECTED_SUPER_ADMIN') throw new ForbiddenException(result.error);
      throw new BadRequestException(result.error);
    }
    return result;
  }
}

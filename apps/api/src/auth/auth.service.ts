import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { UsersRepository } from '../users/users.repository';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.users.findForAuthentication(dto.email);
    if (!user || !user.actif || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const validPassword = await compare(dto.password, user.passwordHash);
    if (!validPassword) throw new UnauthorizedException('Invalid credentials');

    if (user.mfaRequired) {
      throw new ForbiddenException('MFA_REQUIRED');
    }

    if (user.roles.includes('PME') && !user.entrepriseId) {
      throw new ForbiddenException('PME_ENTERPRISE_SCOPE_REQUIRED');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      entrepriseId: user.entrepriseId,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    await this.users.updateLastLogin(user.id);

    return {
      tokenType: 'Bearer',
      accessToken,
      expiresIn: '15m',
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        entrepriseId: user.entrepriseId,
        roles: user.roles,
        permissions: user.permissions,
      },
    };
  }
}

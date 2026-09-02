import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { compare } from 'bcryptjs';
import { UsersRepository } from '../users/users.repository';
import { LoginDto } from './dto/login.dto';
import { MfaService } from './mfa/mfa.service';
import { SessionTokenService } from './session-token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly mfa: MfaService,
    private readonly sessions: SessionTokenService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.users.findForAuthentication(dto.email);
    if (!user || !user.actif || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const validPassword = await compare(dto.password, user.passwordHash);
    if (!validPassword) throw new UnauthorizedException('Invalid credentials');

    if (user.roles.includes('PME') && !user.entrepriseId) {
      throw new ForbiddenException('PME_ENTERPRISE_SCOPE_REQUIRED');
    }

    if (user.mfaRequired) {
      // Neither branch issues a real access token yet: the caller must complete enrollment
      // (POST /auth/mfa/confirm) or verification (POST /auth/mfa/verify) first.
      return this.mfa.beginChallenge(user);
    }

    return this.sessions.issue(user);
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthUserRecord, UsersRepository } from '../users/users.repository';

/**
 * Issues the final, fully-privileged access token once a login is complete - whether that
 * happened directly (no MFA required) or after a successful TOTP challenge.
 */
@Injectable()
export class SessionTokenService {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async issue(user: AuthUserRecord) {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      entrepriseId: user.entrepriseId,
      partenaireBancaireId: user.partenaireBancaireId,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    await this.users.updateLastLogin(user.id);

    return {
      tokenType: 'Bearer',
      accessToken,
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        entrepriseId: user.entrepriseId,
        partenaireBancaireId: user.partenaireBancaireId,
        roles: user.roles,
        permissions: user.permissions,
      },
    };
  }
}

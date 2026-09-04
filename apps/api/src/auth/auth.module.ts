import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { parseDurationSeconds, resolveJwtSigningKeys } from '../security-policy';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtKeyResolverService } from './jwt-key-resolver.service';
import { MfaController } from './mfa/mfa.controller';
import { MfaService } from './mfa/mfa.service';
import { OidcController } from './oidc/oidc.controller';
import { OidcService } from './oidc/oidc.service';
import { SessionTokenService } from './session-token.service';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      // Axe E4 (docs/14-ROADMAP-SAAS-PREMIUM.md) - key rotation: new tokens are always signed
      // with the CURRENT key, tagged with its `kid` (signOptions.keyid) so JwtAuthGuard can tell
      // which key to verify them against later, even after a rotation moves "current" to a
      // different secret. Calls resolveJwtSigningKeys directly (the same pure function
      // JwtKeyResolverService below wraps for the guard) rather than injecting that service here:
      // registerAsync's factory can only inject providers reachable from ITS OWN `imports`, not
      // arbitrary sibling providers declared in this module - ConfigService (global) sidesteps
      // that entirely and keeps this in exact agreement with the guard, since both read the same
      // env vars through the same function.
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { currentKid, keys } = resolveJwtSigningKeys(
          config.get<string>('JWT_SECRET'),
          config.get<string>('JWT_SECRET_PREVIOUS'),
          config.get<string>('NODE_ENV'),
        );
        return {
          secret: keys[currentKid],
          signOptions: {
            keyid: currentKid,
            expiresIn: parseDurationSeconds(config.get<string>('JWT_ACCESS_TTL'), 900),
            issuer: config.get<string>('JWT_ISSUER') ?? 'fodip-digital-2030',
            audience: config.get<string>('JWT_AUDIENCE') ?? 'fodip-web',
          },
        };
      },
    }),
  ],
  controllers: [AuthController, MfaController, OidcController],
  providers: [AuthService, MfaService, SessionTokenService, OidcService, JwtKeyResolverService],
  exports: [JwtModule, JwtKeyResolverService],
})
export class AuthModule {}

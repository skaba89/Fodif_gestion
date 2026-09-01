import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { parseDurationSeconds, resolveJwtSecret } from '../security-policy';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: resolveJwtSecret(config.get<string>('JWT_SECRET'), config.get<string>('NODE_ENV')),
        signOptions: {
          expiresIn: parseDurationSeconds(config.get<string>('JWT_ACCESS_TTL'), 900),
          issuer: config.get<string>('JWT_ISSUER') ?? 'fodip-digital-2030',
          audience: config.get<string>('JWT_AUDIENCE') ?? 'fodip-web',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule],
})
export class AuthModule {}

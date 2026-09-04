import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthenticatedUser } from '../../auth/auth-user.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RevocationService } from '../revocation/revocation.service';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly revocation: RevocationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    let user: AuthenticatedUser;
    try {
      user = await this.jwtService.verifyAsync<AuthenticatedUser>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Axe E4 (session revocation, docs/14-ROADMAP-SAAS-PREMIUM.md) - a signature/expiry check
    // alone can't reflect an explicit logout (POST /auth/logout) before the token's own natural
    // expiry. Tokens issued before this axis (or built by hand in a test) have no jti and are
    // simply not revocable, same as before - never blocked on that basis alone.
    if (user.jti && (await this.revocation.isRevoked(user.jti))) {
      throw new UnauthorizedException('Token has been revoked');
    }

    request.user = user;
    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

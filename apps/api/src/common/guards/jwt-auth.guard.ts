import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthenticatedUser } from '../../auth/auth-user.interface';
import { JwtKeyResolverService } from '../../auth/jwt-key-resolver.service';
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
    private readonly jwtKeys: JwtKeyResolverService,
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
      // Axe E4 (key rotation, docs/14-ROADMAP-SAAS-PREMIUM.md) - the token's own (unverified at
      // this point) header names which key signed it, so a token signed just before a rotation
      // still verifies against the key that actually produced it, not only the newest one. decode()
      // only parses the header/payload, it proves nothing about authenticity by itself - the
      // secret resolved from that `kid` is what verifyAsync below actually checks the signature
      // against, and an unrecognized `kid` simply falls back to the current secret (see
      // JwtKeyResolverService), so a forged `kid` can never pick a key that isn't already ours.
      const decoded = this.jwtService.decode<{ header: { kid?: string } }>(token, { complete: true });
      const secret = this.jwtKeys.resolveVerificationSecret(decoded?.header?.kid);
      user = await this.jwtService.verifyAsync<AuthenticatedUser>(token, { secret });
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

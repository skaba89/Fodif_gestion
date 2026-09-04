import { Global, Module } from '@nestjs/common';
import { RevocationService } from './revocation.service';

// Global, matching DatabaseModule's own pattern: JwtAuthGuard (a root-level APP_GUARD in
// app.module.ts) and AuthController (in auth.module.ts) both need RevocationService, and neither
// should have to import a feature module to get it.
@Global()
@Module({
  providers: [RevocationService],
  exports: [RevocationService],
})
export class RevocationModule {}

export interface AuthenticatedUser {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  entrepriseId?: string | null;
  partenaireBancaireId?: string | null;
  // Present on tokens issued after axe E4's session revocation (docs/14-ROADMAP-SAAS-PREMIUM.md):
  // jti identifies this specific token for revocation (RevocationService), exp is the standard JWT
  // expiry claim (seconds since epoch) a revocation needs to know how long to keep its record.
  // Optional because JwtAuthGuard's own unit tests and any other AuthenticatedUser built by hand
  // (not through a real signed JWT) may not set them.
  jti?: string;
  exp?: number;
}

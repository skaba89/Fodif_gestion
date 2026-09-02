'use strict';

// openid-client is ESM-only ("type": "module") and Jest's CommonJS test runtime can't load it
// directly ("Cannot use import statement outside a module") the way plain `node dist/main.js`
// can at real runtime. Every test that boots the whole AppModule (app.e2e-spec.ts,
// pme-isolation.e2e-spec.ts, ...) transitively imports OidcService and would hit this, even
// though none of them exercise real OIDC behavior. jest.config.cjs maps the package to this stub
// globally; test/oidc.service.spec.ts overrides it per-file with its own jest.mock(), which takes
// precedence, for real assertions on OidcService's own logic.
function notImplemented() {
  throw new Error('openid-client is stubbed out in tests - see jest.config.cjs moduleNameMapper');
}

module.exports = {
  discovery: notImplemented,
  randomPKCECodeVerifier: notImplemented,
  calculatePKCECodeChallenge: notImplemented,
  randomState: notImplemented,
  randomNonce: notImplemented,
  buildAuthorizationUrl: notImplemented,
  authorizationCodeGrant: notImplemented,
};

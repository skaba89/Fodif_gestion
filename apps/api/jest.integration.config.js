// Separate from jest.config.js on purpose: these specs start a real postgres:16.10-alpine
// container per file via Testcontainers (apps/api/test/integration/support/database.ts), which
// needs a working Docker daemon and takes several seconds per file to spin up - unlike the
// mocked-repository unit tests `pnpm test` runs, they must never be picked up by the fast
// `unit-tests` CI job (or by `pnpm test` during local development without Docker running). Run
// them explicitly via `pnpm test:integration` (wired into CI's dedicated `integration-tests` job).
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.integration-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^openid-client$': '<rootDir>/test/stubs/openid-client.stub.js',
  },
  // Sprint Enterprise 0 - mission "niveau 80-85/100" Lot 2 (axe 5.1, couverture combinée) : a
  // separate coverageDirectory from jest.config.cjs's default `coverage/` (used by the unit
  // suite) so a full `pnpm test && pnpm test:integration --coverage` run doesn't have one suite's
  // `--coverage` overwrite the other's raw data before scripts/merge-coverage.js combines them -
  // see that script's own comment for why a raw per-run coverage-final.json, not each run's own
  // rendered report, is what actually gets merged.
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: 'coverage-integration',
  testEnvironment: 'node',
  // Container startup + real transactions/locking are slower than the mocked unit tests' default
  // 5s budget; comfortably above what a healthy run needs, still low enough that a genuinely
  // hung/deadlocked test fails fast instead of hanging the CI job.
  testTimeout: 60_000,
};

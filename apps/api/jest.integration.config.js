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
  testEnvironment: 'node',
  // Container startup + real transactions/locking are slower than the mocked unit tests' default
  // 5s budget; comfortably above what a healthy run needs, still low enough that a genuinely
  // hung/deadlocked test fails fast instead of hanging the CI job.
  testTimeout: 60_000,
};

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.(e2e-)?spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    // openid-client is ESM-only; see test/stubs/openid-client.stub.js for why this is needed.
    '^openid-client$': '<rootDir>/test/stubs/openid-client.stub.js',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  // Sprint Enterprise 0 - fondations entreprise, axe P0 5.1 (couverture anti-régression) : lock in
  // where the unit suite already stands (measured with `pnpm --filter @fodip/api test --
  // --coverage` on this exact suite: 65.51/38.75/45.63/66.55) rather than the mission's eventual
  // 80/80/75/75 targets, which this PR alone can't responsibly claim to have earned - the number
  // below only has to be no worse than today, not good. A small buffer under the measured value
  // absorbs incidental byte-for-byte non-determinism (e.g. a branch only reachable via a code path
  // this PR doesn't touch) without hiding a genuine drop. Raise these numbers, never lower them,
  // as real coverage grows in a later PR - this is a floor, not a target.
  coverageThreshold: {
    global: {
      statements: 65,
      branches: 38,
      functions: 45,
      lines: 66,
    },
  },
};

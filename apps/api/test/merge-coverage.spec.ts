import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCombinedMap, checkThreshold, readCoverageFile, THRESHOLD } from '../scripts/merge-coverage.js';

describe('readCoverageFile', () => {
  it('throws a clear error naming the missing file and which side of the merge it was for', () => {
    const missing = join(mkdtempSync(join(tmpdir(), 'fodip-coverage-')), 'does-not-exist.json');
    expect(() => readCoverageFile({ name: 'unit', file: missing })).toThrow(/does not exist.*"unit"/s);
  });

  it('refuses a coverage file that exists but covers zero files, rather than merging an empty run silently', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fodip-coverage-'));
    try {
      const file = join(dir, 'coverage-final.json');
      writeFileSync(file, '{}');
      expect(() => readCoverageFile({ name: 'unit', file })).toThrow(/covers zero files/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('parses a real coverage-final.json shape', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fodip-coverage-'));
    try {
      const file = join(dir, 'coverage-final.json');
      const data = { '/repo/src/foo.ts': fileCoverage({ '0': 1 }) };
      writeFileSync(file, JSON.stringify(data));
      expect(readCoverageFile({ name: 'unit', file })).toEqual(data);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// A minimal, valid istanbul raw file-coverage object: two statements (0 and 1) in one file, with
// `hits` controlling which are marked covered - just enough shape for istanbul-lib-coverage's
// CoverageMap to merge and summarize for real, not a mock of what merging does.
function fileCoverage(hits: Record<string, number>) {
  return {
    path: '/repo/src/foo.ts',
    statementMap: {
      '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
      '1': { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
    },
    fnMap: {},
    branchMap: {},
    s: { '0': hits['0'] ?? 0, '1': hits['1'] ?? 0 },
    f: {},
    b: {},
  };
}

describe('buildCombinedMap', () => {
  it('unions coverage from both sources - a statement covered in only one of them counts as covered in the combined map', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fodip-coverage-'));
    try {
      // "unit" run covers statement 0 only; "integration" run covers statement 1 only - neither
      // source alone reaches 100%, but real code with real behaviour reachable only from one of
      // the two suites is exactly what this combined report exists to give credit for.
      const unitFile = join(dir, 'unit.json');
      const integrationFile = join(dir, 'integration.json');
      writeFileSync(unitFile, JSON.stringify({ '/repo/src/foo.ts': fileCoverage({ '0': 1 }) }));
      writeFileSync(integrationFile, JSON.stringify({ '/repo/src/foo.ts': fileCoverage({ '1': 1 }) }));

      const map = buildCombinedMap([
        { name: 'unit', file: unitFile },
        { name: 'integration', file: integrationFile },
      ]);
      const summary = map.getCoverageSummary().toJSON();

      expect(summary.statements).toEqual({ total: 2, covered: 2, skipped: 0, pct: 100 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('propagates the missing-file error from readCoverageFile when either source is absent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fodip-coverage-'));
    try {
      const unitFile = join(dir, 'unit.json');
      writeFileSync(unitFile, JSON.stringify({ '/repo/src/foo.ts': fileCoverage({ '0': 1 }) }));
      expect(() =>
        buildCombinedMap([
          { name: 'unit', file: unitFile },
          { name: 'integration', file: join(dir, 'missing.json') },
        ]),
      ).toThrow(/does not exist/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('checkThreshold', () => {
  const summaryAt = (statements: number, branches: number, functions: number, lines: number) => ({
    statements: { pct: statements },
    branches: { pct: branches },
    functions: { pct: functions },
    lines: { pct: lines },
  });

  it('passes silently when every metric meets its floor', () => {
    const atFloor = summaryAt(THRESHOLD.statements, THRESHOLD.branches, THRESHOLD.functions, THRESHOLD.lines);
    expect(checkThreshold(atFloor)).toEqual([]);
  });

  it('reports every metric that falls below its floor, naming the metric and both numbers', () => {
    const failures = checkThreshold(summaryAt(THRESHOLD.statements - 1, THRESHOLD.branches, THRESHOLD.functions - 5, THRESHOLD.lines));
    expect(failures).toHaveLength(2);
    expect(failures[0]).toMatch(/statements/);
    expect(failures[1]).toMatch(/functions/);
  });

  it('never reports success for a metric with a non-numeric pct (Jest/istanbul use "Unknown" for a zero-total metric)', () => {
    const failures = checkThreshold({
      statements: { pct: 'Unknown' },
      branches: { pct: THRESHOLD.branches },
      functions: { pct: THRESHOLD.functions },
      lines: { pct: THRESHOLD.lines },
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/statements/);
  });
});

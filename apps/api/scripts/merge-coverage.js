#!/usr/bin/env node
'use strict';

/**
 * Merges the unit suite's and the integration suite's separately-collected raw coverage data into
 * one combined report, and enforces a single anti-regression threshold against the *combined*
 * numbers.
 *
 * Sprint Enterprise 0 - "niveau 80-85/100" mission, Lot 2 (section 5, "rapport de couverture
 * combiné"): `pnpm --filter @fodip/api test` and `pnpm --filter @fodip/api test:integration` are
 * two independent Jest invocations (deliberately - jest.integration.config.js's own comment
 * explains why: the integration suite needs a working Postgres/MinIO and takes several seconds
 * per file, so it must never be picked up by the fast unit-test run). Jest has no built-in way to
 * combine coverage across two separate invocations, and `apps/api/jest.config.cjs`'s own
 * `coverageThreshold` only ever sees whichever single run it's attached to - it cannot see what
 * the two suites reach *together* (a line only exercised by an integration test, e.g. a real
 * unique-constraint conflict under row locking, counts as covered here even though the unit suite
 * alone never touches it). This script fills that gap: it reads each suite's raw per-file
 * coverage-final.json (produced by Jest's `json` reporter, not the aggregated `json-summary` -
 * only the raw form carries enough detail to be merged correctly), unions them via
 * istanbul-lib-coverage's CoverageMap (a line/branch/function is "covered" in the merge if either
 * suite's run count for it is > 0), renders the same report formats the unit suite already
 * produces (text-summary/json-summary/lcov+html), and - unless --no-check is passed - fails
 * loudly (non-zero exit, one line per metric below floor) if the combined numbers regress below a
 * floor, the same anti-regression contract jest.config.cjs's own coverageThreshold applies to the
 * unit suite alone.
 *
 * Usage:
 *   node scripts/merge-coverage.js            # merge, write reports, enforce the threshold below
 *   node scripts/merge-coverage.js --no-check # merge and write reports only, skip the threshold
 *
 * In CI (apps/api/scripts/merge-coverage.js.step in .github/workflows/ci.yml) this runs inside
 * the `integration-tests` job, right after that job's own `test:integration --coverage` step and
 * a fresh `test --coverage` run of the unit suite - both raw coverage-final.json files need to
 * exist in the same checkout before this can merge them; see that workflow file for why this
 * lives in that job rather than a separate one (avoiding a third job that would otherwise need to
 * download-artifact both suites' raw coverage data across jobs, an action this codebase has no
 * SHA-pinned reference for yet).
 */

const fs = require('node:fs');
const path = require('node:path');
const libCoverage = require('istanbul-lib-coverage');
const libReport = require('istanbul-lib-report');
const reports = require('istanbul-reports');

const ROOT = path.resolve(__dirname, '..');
const SOURCES = [
  { name: 'unit (pnpm test)', file: path.join(ROOT, 'coverage', 'coverage-final.json') },
  { name: 'integration (pnpm test:integration)', file: path.join(ROOT, 'coverage-integration', 'coverage-final.json') },
];
const OUTPUT_DIR = path.join(ROOT, 'coverage-combined');

// Anti-regression floor for the *combined* unit+integration coverage, deliberately below the
// value actually measured when this was introduced (statements 74.76% / branches 56.38% /
// functions 56.1% / lines 76.1% - `node scripts/merge-coverage.js --no-check` printed these
// exactly, not estimated) so incidental noise (a branch only reachable via a code path neither
// suite's own local run happens to hit that particular time) doesn't false-fail CI. Raise these,
// never lower them, as real coverage grows - a floor, not a target; the mission's eventual targets
// (80/80/75/75 global, 90/90 for financial/RBAC modules) are a later, separate step once more
// integration tests exist to actually earn them (see docs/22-COUVERTURE-COMBINEE.md).
const THRESHOLD = {
  statements: 74,
  branches: 55,
  functions: 55,
  lines: 75,
};

function readCoverageFile({ name, file }) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `${file} does not exist (needed for the "${name}" side of the combined report). ` +
      'Run that suite with `--coverage --coverageReporters=json` first - see this script\'s own usage comment.',
    );
  }
  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  if (Object.keys(data).length === 0) {
    throw new Error(`${file} exists but covers zero files - refusing to merge an empty coverage run as if it were real.`);
  }
  return data;
}

// `sources` defaults to the real unit+integration paths but is overridable so unit tests can
// prove the actual merge semantics (a statement covered in one source and not the other ends up
// covered in the combined map) against small, hand-built fixtures instead of the real multi-MB
// coverage-final.json files this repo's own suites produce.
function buildCombinedMap(sources = SOURCES) {
  const map = libCoverage.createCoverageMap({});
  for (const source of sources) {
    map.merge(readCoverageFile(source));
  }
  return map;
}

function writeReports(map) {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const context = libReport.createContext({ dir: OUTPUT_DIR, coverageMap: map });
  for (const reporter of ['text-summary', 'json-summary', 'lcov']) {
    reports.create(reporter).execute(context);
  }
}

function checkThreshold(summary) {
  const failures = [];
  for (const [metric, floor] of Object.entries(THRESHOLD)) {
    const pct = summary[metric].pct;
    if (typeof pct !== 'number' || pct < floor) {
      failures.push(`  ${metric}: ${pct}% is below the ${floor}% floor (combined unit+integration coverage regressed)`);
    }
  }
  return failures;
}

function writeGithubStepSummary(summary) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return; // not running in a GitHub Actions step - nothing to append to
  const row = (label, metric) => `| ${label} | ${metric.covered}/${metric.total} | ${metric.pct}% |`;
  const markdown = [
    '## Couverture combinée (unit + intégration PostgreSQL/MinIO)',
    '',
    '| Métrique | Couvert / Total | % |',
    '|---|---|---|',
    row('Statements', summary.statements),
    row('Branches', summary.branches),
    row('Functions', summary.functions),
    row('Lines', summary.lines),
    '',
  ].join('\n');
  fs.appendFileSync(summaryFile, markdown + '\n');
}

function main() {
  const check = !process.argv.includes('--no-check');
  const map = buildCombinedMap();
  writeReports(map);
  const summary = map.getCoverageSummary().toJSON();

  console.log(`Combined coverage report written to ${path.relative(process.cwd(), OUTPUT_DIR)}/`);
  writeGithubStepSummary(summary);

  if (!check) return;
  const failures = checkThreshold(summary);
  if (failures.length > 0) {
    console.error('Combined coverage threshold not met:');
    for (const line of failures) console.error(line);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { buildCombinedMap, checkThreshold, readCoverageFile, THRESHOLD };

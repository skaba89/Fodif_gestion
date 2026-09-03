"""Sprint Enterprise 0, Lot 1 - license policy guard for scripts/test-prepush.sh and CI.

FODIP Digital 2030 is UNLICENSED/propriétaire (see LICENSE): a dependency whose own license
requires derivative works to be released under the same terms (GPL/AGPL-family "strong" copyleft)
would be incompatible with that, and a non-commercial or share-alike clause (CC-BY-NC/SA) would
block the institutional use case outright. Everything currently in the tree is Apache-2.0/MIT/
BSD/ISC/0BSD/Unlicense or weak-copyleft-but-fine-to-consume-as-a-dependency (LGPL, MPL) - this is
a regression guard against a *future* addition, not a report on what is already there.

Reads `pnpm licenses list --json` (already resolves the full pnpm workspace, dev included, so a
disallowed devDependency is caught too, not just what would ship to production).
"""
from __future__ import annotations

import json
import subprocess
import sys

# Substring match against the license identifier (SPDX-ish, as pnpm reports it) - covers version
# suffixes like "GPL-3.0-or-later" and OR-expressions like "(GPL-2.0 OR MIT)" without needing a
# full SPDX expression parser for a short denylist.
DISALLOWED_SUBSTRINGS = [
    'AGPL',
    'GPL-1', 'GPL-2', 'GPL-3',  # plain "GPL-x" alone (not LGPL/AGPL, already listed separately
                                 # above and excluded below) still matches "GPL-3" as a substring,
                                 # which is exactly the point: only LGPL/AGPL are allow-listed.
    'SSPL',
    'BUSL',
    'NC-',       # Creative Commons NonCommercial variants (CC-BY-NC, CC-BY-NC-SA, ...)
    'CC-BY-SA',  # ShareAlike: fine for content, not for code we redistribute inside the platform
]
# Explicitly fine despite containing "GPL" as a substring: weak copyleft, safe to consume as an
# unmodified npm dependency (no obligation to release this codebase's own source).
ALLOWLIST_OVERRIDE_PREFIXES = ['LGPL']


def is_disallowed(license_id: str) -> bool:
    if any(license_id.startswith(prefix) for prefix in ALLOWLIST_OVERRIDE_PREFIXES):
        return False
    return any(bad in license_id for bad in DISALLOWED_SUBSTRINGS)


def main() -> None:
    result = subprocess.run(
        ['pnpm', 'licenses', 'list', '--json'],
        capture_output=True, text=True, check=False,
    )
    if result.returncode != 0:
        print(result.stderr or result.stdout, file=sys.stderr)
        raise SystemExit(f'pnpm licenses list failed (exit {result.returncode})')

    try:
        by_license = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise SystemExit(f'Could not parse `pnpm licenses list --json` output: {error}')

    violations: list[str] = []
    for license_id, packages in by_license.items():
        if not is_disallowed(license_id):
            continue
        for package in packages:
            name = package.get('name', '?')
            versions = ', '.join(package.get('versions', []) or ['?'])
            violations.append(f'{name}@{versions}: {license_id}')

    if violations:
        print('Disallowed license(s) found (see scripts/check-licenses.py for the policy):', file=sys.stderr)
        for line in sorted(violations):
            print(f'  - {line}', file=sys.stderr)
        raise SystemExit(1)

    total = sum(len(packages) for packages in by_license.values())
    print(f'License check passed: {total} package(s) across {len(by_license)} license(s), none disallowed.')


if __name__ == '__main__':
    main()

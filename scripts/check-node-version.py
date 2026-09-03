"""
Fails if the Node.js version pinned across the repo's various tools disagrees anywhere - the exact
class of drift this check exists to catch (Sprint Enterprise 0, Lot 1): before this, CI ran Node
22 while both Dockerfiles had already moved to node:26-bookworm-slim via an independent Dependabot
PR, and nothing failed loudly - the two just silently disagreed about what "the project's Node
version" was. Every source below must name the same major version.

Sources checked:
  - .nvmrc                                   (what a contributor's `nvm use` picks up)
  - package.json "engines"."node"            (what `npm`/`pnpm` warn about on a mismatch)
  - apps/api/Dockerfile, apps/web/Dockerfile  (every FROM node:X-... stage, build and runtime)
  - .github/workflows/ci.yml                 (env.NODE_VERSION, what actions/setup-node installs)
  - netlify.toml                             (build.environment.NODE_VERSION, the web deploy target)
"""
from pathlib import Path
import json
import re
import sys

errors = []


def major(version_string):
    match = re.match(r'^v?(\d+)', version_string.strip())
    return match.group(1) if match else None


versions = {}

nvmrc = Path('.nvmrc')
if not nvmrc.exists():
    errors.append('.nvmrc is missing')
else:
    versions['.nvmrc'] = major(nvmrc.read_text(encoding='utf-8'))

package_json = Path('package.json')
if not package_json.exists():
    errors.append('package.json is missing')
else:
    engines = json.loads(package_json.read_text(encoding='utf-8')).get('engines', {})
    node_range = engines.get('node')
    if not node_range:
        errors.append('package.json "engines"."node" is missing')
    else:
        # Expected shape: ">=24 <25" - the lower bound names the pinned major.
        match = re.match(r'^>=(\d+)', node_range.strip())
        versions['package.json engines.node'] = match.group(1) if match else None

for dockerfile_path in ('apps/api/Dockerfile', 'apps/web/Dockerfile'):
    dockerfile = Path(dockerfile_path)
    if not dockerfile.exists():
        errors.append(f'{dockerfile_path} is missing')
        continue
    from_lines = re.findall(r'^FROM\s+node:(\d+)-', dockerfile.read_text(encoding='utf-8'), re.MULTILINE)
    if not from_lines:
        errors.append(f'{dockerfile_path}: no "FROM node:X-..." stage found')
    for i, found in enumerate(from_lines):
        versions[f'{dockerfile_path} (FROM node:X stage {i + 1})'] = found

ci_workflow = Path('.github/workflows/ci.yml')
if not ci_workflow.exists():
    errors.append('.github/workflows/ci.yml is missing')
else:
    match = re.search(r'^\s*NODE_VERSION:\s*["\']?(\d+)', ci_workflow.read_text(encoding='utf-8'), re.MULTILINE)
    if not match:
        errors.append('.github/workflows/ci.yml: no env.NODE_VERSION found')
    else:
        versions['.github/workflows/ci.yml env.NODE_VERSION'] = match.group(1)

netlify_toml = Path('netlify.toml')
if not netlify_toml.exists():
    errors.append('netlify.toml is missing')
else:
    match = re.search(r'NODE_VERSION\s*=\s*"(\d+)"', netlify_toml.read_text(encoding='utf-8'))
    if not match:
        errors.append('netlify.toml: no build.environment.NODE_VERSION found')
    else:
        versions['netlify.toml NODE_VERSION'] = match.group(1)

unresolved = [name for name, value in versions.items() if value is None]
if unresolved:
    errors.append(f'could not parse a Node major version from: {", ".join(unresolved)}')

resolved = {name: value for name, value in versions.items() if value is not None}
distinct = set(resolved.values())
if len(distinct) > 1:
    lines = '\n'.join(f'  - {name}: Node {value}' for name, value in resolved.items())
    errors.append(f'Node version mismatch across the repo:\n{lines}')

if errors:
    print('\n'.join(errors), file=sys.stderr)
    raise SystemExit(1)

print(f'Node version consistent across {len(resolved)} sources: Node {distinct.pop()}.')

from pathlib import Path
import sys
import yaml

compose_path = Path('docker-compose.yml')
errors = []

if not compose_path.exists():
    errors.append('docker-compose.yml is missing')
else:
    compose = yaml.safe_load(compose_path.read_text(encoding='utf-8'))
    services = compose.get('services', {})
    required = {'web', 'api', 'postgres', 'migrations', 'seed', 'minio'}
    missing = sorted(required - set(services))
    if missing:
        errors.append(f'missing Docker services: {", ".join(missing)}')
    for name, service in services.items():
        image = service.get('image')
        if image and (':' not in image or image.endswith(':latest')):
            errors.append(f'{name}: image must use a pinned non-latest tag')
    flattened = compose_path.read_text(encoding='utf-8').upper()
    if 'AZURE_' in flattened:
        errors.append('Docker runtime must not depend on Azure variables')

for dockerfile in ('apps/api/Dockerfile', 'apps/web/Dockerfile'):
    if not Path(dockerfile).exists():
        errors.append(f'{dockerfile} is missing')

# Regression guard for a real bug this caught once: apps/web/public/ (manifest, icons, service
# worker - axe D2) exists on disk but Next.js reads it straight from the working directory at
# request time rather than bundling it into .next/ - the runtime stage's COPY list had never
# included it, so every file under public/ 404'd in the actual container while working fine in
# every non-Docker verification, which starts from the full checkout with public/ already there.
web_public = Path('apps/web/public')
web_dockerfile = Path('apps/web/Dockerfile')
if web_public.is_dir() and any(web_public.iterdir()) and web_dockerfile.exists():
    if 'apps/web/public' not in web_dockerfile.read_text(encoding='utf-8'):
        errors.append(
            'apps/web/public/ has files but apps/web/Dockerfile has no COPY for it - '
            'they will 404 in the actual container (see docs/18-PWA-HORS-LIGNE.md)'
        )

if not Path('scripts/docker-smoke.sh').exists():
    errors.append('scripts/docker-smoke.sh is missing')

if errors:
    print('\n'.join(errors), file=sys.stderr)
    raise SystemExit(1)

print('Docker topology validated: web, API, PostgreSQL, migrations, seed and MinIO.')

from pathlib import Path
import sys
import yaml


path = Path("render.yaml")
errors = []

if not path.exists():
    errors.append("render.yaml is missing")
else:
    blueprint = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    services = {service.get("name"): service for service in blueprint.get("services", [])}
    for name in ("fodip-api", "fodip-web"):
        service = services.get(name)
        if not service:
            errors.append(f"{name}: service is missing")
            continue
        if service.get("runtime") != "docker":
            errors.append(f"{name}: runtime must be docker")
        if service.get("plan") != "free":
            errors.append(f"{name}: qualification Blueprint must explicitly use the free plan")
        if service.get("plan") == "free" and "maxShutdownDelaySeconds" in service:
            errors.append(f"{name}: maxShutdownDelaySeconds is not supported by Render's free plan")
        if service.get("autoDeployTrigger") != "checksPass":
            errors.append(f"{name}: deploys must wait for GitHub checks")

    api = services.get("fodip-api", {})
    api_env = {item.get("key"): item for item in api.get("envVars", [])}
    required_api_env = {
        "APP_ENV", "DATABASE_URL", "DATABASE_URL_UNPOOLED", "DATABASE_SSL", "JWT_SECRET",
        "BOOTSTRAP_ADMIN_EMAIL", "BOOTSTRAP_ADMIN_NOM", "BOOTSTRAP_ADMIN_PASSWORD",
        "STORAGE_ENDPOINT", "STORAGE_REGION", "STORAGE_BUCKET", "STORAGE_ACCESS_KEY",
        "STORAGE_SECRET_KEY", "WEB_BASE_URL",
        "METRICS_TOKEN",
    }
    missing = sorted(required_api_env - set(api_env))
    if missing:
        errors.append(f"fodip-api: missing environment variables: {', '.join(missing)}")
    if api_env.get("APP_ENV", {}).get("value") != "QUALIFICATION":
        errors.append("fodip-api: Render/Neon must stay explicitly labelled APP_ENV=QUALIFICATION")
    if not api_env.get("METRICS_TOKEN", {}).get("generateValue"):
        errors.append("fodip-api: METRICS_TOKEN must be generated and never committed")
    command = api.get("dockerCommand", "")
    if command != "/bin/bash scripts/start-render.sh":
        errors.append("fodip-api: dockerCommand must invoke the quote-safe Render startup script")
    start_script = Path("apps/api/scripts/start-render.sh")
    if not start_script.exists():
        errors.append("fodip-api: apps/api/scripts/start-render.sh is missing")
    else:
        start_content = start_script.read_text(encoding="utf-8")
        for required in ("run-migrations.js", "bootstrap-super-admin.js", "exec node dist/main.js"):
            if required not in start_content:
                errors.append(f"fodip-api: start-render.sh must include {required}")

        # Hosted startup is deliberately tiny and allow-listed. In particular, schema migrations
        # must run WITHOUT --seed: database/seeds are local/CI fixtures and are never a hosted data
        # source. Comparing the complete executable sequence makes a future seed command (or any
        # other hidden startup side effect) fail CI instead of silently reaching qualification or
        # a future production environment.
        executable_lines = [
            line.strip()
            for line in start_content.splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        ]
        expected_startup = [
            "set -euo pipefail",
            'metrics_token="${METRICS_TOKEN:-}"',
            'if (( ${#metrics_token} < 32 )); then',
            'echo "FATAL: METRICS_TOKEN must contain at least 32 characters before starting fodip-api." >&2',
            "exit 1",
            "fi",
            "node scripts/run-migrations.js",
            "node scripts/bootstrap-super-admin.js",
            "exec node dist/main.js",
        ]
        if executable_lines != expected_startup:
            errors.append(
                "fodip-api: hosted startup must remain exactly migrations (without --seed), "
                "one-time admin bootstrap, then API"
            )
    if api.get("healthCheckPath") != "/api/v1/health/ready":
        errors.append("fodip-api: health check must verify database and object storage readiness")

    web = services.get("fodip-web", {})
    web_env = {item.get("key"): item for item in web.get("envVars", [])}
    if web_env.get("APP_ENV", {}).get("value") != "QUALIFICATION":
        errors.append("fodip-web: Render/Neon must stay explicitly labelled APP_ENV=QUALIFICATION")
    if web_env.get("DEMO_MODE", {}).get("value") != "false":
        errors.append("fodip-web: hosted environments must explicitly disable DEMO_MODE")

    web_start_script = Path("apps/web/scripts/start-web.sh")
    if not web_start_script.exists():
        errors.append("fodip-web: apps/web/scripts/start-web.sh is missing")
    else:
        web_start_content = web_start_script.read_text(encoding="utf-8")
        for required in ("PPD|PROD", "DEMO_MODE", "exit 1"):
            if required not in web_start_content:
                errors.append(f"fodip-web: start-web.sh must enforce the production demo guard ({required})")

if errors:
    print("\n".join(errors), file=sys.stderr)
    raise SystemExit(1)

print("Render/Neon qualification Blueprint validated.")


production_path = Path("render.production.yaml")
production_errors = []
if not production_path.exists():
    production_errors.append("render.production.yaml is missing")
else:
    production = yaml.safe_load(production_path.read_text(encoding="utf-8")) or {}
    production_services = {service.get("name"): service for service in production.get("services", [])}
    expected_services = {"fodip-api-prod", "fodip-web-prod"}
    if set(production_services) != expected_services:
        production_errors.append("production Blueprint must contain only the dedicated API and web services")

    for name in expected_services:
        service = production_services.get(name, {})
        if service.get("plan") == "free":
            production_errors.append(f"{name}: free plan is forbidden in production")
        if service.get("numInstances", 0) < 2:
            production_errors.append(f"{name}: production requires at least two instances")
        if service.get("autoDeployTrigger") != "checksPass":
            production_errors.append(f"{name}: production deploys must wait for GitHub checks")
        if service.get("branch") != "main":
            production_errors.append(f"{name}: production must deploy only main")

    production_api = production_services.get("fodip-api-prod", {})
    production_api_env = {item.get("key"): item for item in production_api.get("envVars", [])}
    required_production_secrets = {
        "DATABASE_URL", "DATABASE_URL_UNPOOLED", "JWT_SECRET", "METRICS_TOKEN",
        "PII_ENCRYPTION_KEY", "MFA_SECRET_ENCRYPTION_KEY", "MFA_CHALLENGE_SECRET",
        "OIDC_FLOW_SECRET", "OIDC_DELIVERY_SECRET", "WEB_BASE_URL", "STORAGE_ENDPOINT",
        "STORAGE_REGION", "STORAGE_BUCKET", "STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY",
        "CLAMAV_HOST", "OIDC_ISSUER_URL", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET",
        "OIDC_REDIRECT_URI",
    }
    missing = sorted(required_production_secrets - set(production_api_env))
    if missing:
        production_errors.append(f"fodip-api-prod: missing production variables: {', '.join(missing)}")
    for forbidden in ("BOOTSTRAP_ADMIN_EMAIL", "BOOTSTRAP_ADMIN_PASSWORD"):
        if forbidden in production_api_env:
            production_errors.append(f"fodip-api-prod: {forbidden} must not persist in the production Blueprint")
    if production_api_env.get("APP_ENV", {}).get("value") != "PROD":
        production_errors.append("fodip-api-prod: APP_ENV must be PROD")

    production_web = production_services.get("fodip-web-prod", {})
    production_web_env = {item.get("key"): item for item in production_web.get("envVars", [])}
    if production_web_env.get("APP_ENV", {}).get("value") != "PROD":
        production_errors.append("fodip-web-prod: APP_ENV must be PROD")
    if production_web_env.get("DEMO_MODE", {}).get("value") != "false":
        production_errors.append("fodip-web-prod: DEMO_MODE must be false")
    if production.get("previews", {}).get("generation") != "off":
        production_errors.append("production Blueprint must not create preview environments")

if production_errors:
    print("\n".join(production_errors), file=sys.stderr)
    raise SystemExit(1)

print("Render national production Blueprint validated.")

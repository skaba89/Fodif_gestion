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
        "DATABASE_URL", "DATABASE_URL_UNPOOLED", "DATABASE_SSL", "JWT_SECRET",
        "BOOTSTRAP_ADMIN_EMAIL", "BOOTSTRAP_ADMIN_NOM", "BOOTSTRAP_ADMIN_PASSWORD",
        "STORAGE_ENDPOINT", "STORAGE_REGION", "STORAGE_BUCKET", "STORAGE_ACCESS_KEY",
        "STORAGE_SECRET_KEY", "WEB_BASE_URL",
    }
    missing = sorted(required_api_env - set(api_env))
    if missing:
        errors.append(f"fodip-api: missing environment variables: {', '.join(missing)}")
    command = api.get("dockerCommand", "")
    for required in ("run-migrations.js", "bootstrap-super-admin.js", "exec node dist/main.js"):
        if required not in command:
            errors.append(f"fodip-api: dockerCommand must include {required}")
    if api.get("healthCheckPath") != "/api/v1/health/ready":
        errors.append("fodip-api: health check must verify database and object storage readiness")

    web = services.get("fodip-web", {})
    web_env = {item.get("key"): item for item in web.get("envVars", [])}
    if web_env.get("DEMO_MODE", {}).get("value") != "true":
        errors.append("fodip-web: DEMO_MODE must remain true on the qualification environment")

if errors:
    print("\n".join(errors), file=sys.stderr)
    raise SystemExit(1)

print("Render/Neon qualification Blueprint validated.")

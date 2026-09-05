#!/usr/bin/env python3
"""Generate the auditable CI evidence manifest for an institutional candidate release."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]

CONTROLS = (
    ("invariants", "RESULT_INVARIANTS", "Qualité, lint et invariants pré-push"),
    ("unit_tests", "RESULT_UNIT_TESTS", "Tests unitaires API"),
    ("integration_tests", "RESULT_INTEGRATION_TESTS", "Tests d'intégration PostgreSQL/MinIO"),
    ("build", "RESULT_BUILD", "Builds API et Web"),
    ("security", "RESULT_SECURITY", "Audit, licences, dépendances et secrets"),
    ("docker", "RESULT_DOCKER", "Docker, Trivy, SBOM, restauration et Playwright"),
)

GOVERNANCE_DOCUMENTS = (
    "docs/26-CADRE-INSTITUTIONNEL.md",
    "docs/27-NOTE-DIRECTEUR-HOMOLOGATION.md",
    "docs/28-REGISTRE-DECISIONS-HOMOLOGATION.md",
    "docs/templates/DECISION-INSTITUTIONNELLE.md",
    "docs/templates/PV-RECETTE-INSTITUTIONNELLE.md",
    "docs/templates/PV-GO-NO-GO.md",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def generated_at() -> str:
    epoch = os.environ.get("SOURCE_DATE_EPOCH")
    instant = datetime.fromtimestamp(int(epoch), timezone.utc) if epoch else datetime.now(timezone.utc)
    return instant.isoformat().replace("+00:00", "Z")


def material(relative_path: str) -> dict[str, str]:
    path = ROOT / relative_path
    if not path.is_file():
        raise FileNotFoundError(f"required evidence material is missing: {relative_path}")
    return {"path": relative_path, "sha256": sha256(path)}


def build_manifest() -> dict[str, object]:
    repository = os.environ.get("GITHUB_REPOSITORY", "local/fodip-gestion")
    server_url = os.environ.get("GITHUB_SERVER_URL", "https://github.com").rstrip("/")
    run_id = os.environ.get("GITHUB_RUN_ID", "local")
    controls = {
        key: {"label": label, "status": os.environ.get(variable, "unknown")}
        for key, variable, label in CONTROLS
    }
    all_green = all(control["status"] == "success" for control in controls.values())
    migrations = [material(str(path.relative_to(ROOT))) for path in sorted((ROOT / "database").glob("[0-9][0-9][0-9]_*.sql"))]

    return {
        "schema_version": 1,
        "generated_at": generated_at(),
        "source": {
            "repository": repository,
            "commit_sha": os.environ.get("GITHUB_SHA", "local"),
            "ref": os.environ.get("GITHUB_REF_NAME", "local"),
            "workflow": os.environ.get("GITHUB_WORKFLOW", "local"),
            "run_id": run_id,
            "run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT", "1"),
            "run_url": f"{server_url}/{repository}/actions/runs/{run_id}" if run_id != "local" else None,
        },
        "technical_controls": controls,
        "codeql": {
            "status": "external-required",
            "reason": "CodeQL est exécuté par un workflow séparé et doit être joint au dossier Go/No-Go.",
            "evidence_url": f"{server_url}/{repository}/security/code-scanning",
        },
        "materials": {
            "migrations": migrations,
            "governance_documents": [material(path) for path in GOVERNANCE_DOCUMENTS],
        },
        "qualification": {
            "technical_ci_complete": all_green,
            "homologation_granted": False,
            "statement": (
                "Contrôles CI techniques réussis ; homologation toujours soumise aux portes G1 à G9."
                if all_green
                else "Dossier CI incomplet ou en échec ; version non candidate à l'homologation."
            ),
        },
    }


def render_markdown(manifest: dict[str, object]) -> str:
    source = manifest["source"]
    controls = manifest["technical_controls"]
    qualification = manifest["qualification"]
    lines = [
        "# Dossier de preuves techniques CI",
        "",
        "> Ce document ne constitue pas une homologation. Il apporte les preuves techniques CI",
        "> à joindre aux validations métier, finance, sécurité, juridique et exploitation.",
        "",
        f"- Dépôt : `{source['repository']}`",
        f"- Commit : `{source['commit_sha']}`",
        f"- Référence : `{source['ref']}`",
        f"- Généré le : `{manifest['generated_at']}`",
        f"- Exécution : {source['run_url'] or 'locale'}",
        "",
        "## Contrôles techniques",
        "",
        "| Contrôle | État |",
        "|---|---|",
    ]
    lines.extend(f"| {control['label']} | **{control['status']}** |" for control in controls.values())
    lines.extend([
        "",
        "## Conclusion",
        "",
        qualification["statement"],
        "",
        "CodeQL reste une preuve externe obligatoire : " + manifest["codeql"]["evidence_url"],
        "",
        f"Migrations inventoriées : {len(manifest['materials']['migrations'])}.",
        f"Documents de gouvernance inventoriés : {len(manifest['materials']['governance_documents'])}.",
        "",
    ])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", default="release-evidence")
    parser.add_argument("--require-success", action="store_true")
    args = parser.parse_args()

    try:
        manifest = build_manifest()
    except (FileNotFoundError, ValueError) as error:
        print(f"Evidence generation failed: {error}", file=sys.stderr)
        return 1

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output_dir / "SUMMARY.md").write_text(render_markdown(manifest), encoding="utf-8")
    print(f"Institutional evidence written to {output_dir}")

    if args.require_success and not manifest["qualification"]["technical_ci_complete"]:
        print("Institutional evidence is incomplete: at least one required CI control is not successful.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

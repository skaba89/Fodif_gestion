#!/usr/bin/env python3
"""Validate institutional positioning and documentation invariants."""

from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]


def read(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


errors: list[str] = []

required_files = [
    "CONTRIBUTING.md",
    "docs/01-SOCLE-FONCTIONNEL-INITIAL.md",
    "docs/24-DEPLOIEMENT-PRODUCTION-OCI-K8S.md",
    "docs/25-RAPPROCHEMENT-BANCAIRE.md",
    "docs/26-CADRE-INSTITUTIONNEL.md",
    "docs/27-NOTE-DIRECTEUR-HOMOLOGATION.md",
    "docs/28-REGISTRE-DECISIONS-HOMOLOGATION.md",
    "docs/templates/DECISION-INSTITUTIONNELLE.md",
    "docs/templates/PV-RECETTE-INSTITUTIONNELLE.md",
    "docs/templates/PV-GO-NO-GO.md",
    "k8s/07-network-policies.yaml",
    "k8s/08-pod-disruption-budgets.yaml",
    "k8s/kustomization.yaml",
    ".github/workflows/release-oci.yml",
    "docs/29-CHAINE-RELEASE-OCI.md",
    "scripts/validate-k8s-schemas.sh",
]
for relative_path in required_files:
    if not (ROOT / relative_path).is_file():
        errors.append(f"document institutionnel manquant: {relative_path}")

expectations = {
    "README.md": [
        "Statut : plateforme institutionnelle en qualification",
        "docs/26-CADRE-INSTITUTIONNEL.md",
        "docs/27-NOTE-DIRECTEUR-HOMOLOGATION.md",
        "docs/28-REGISTRE-DECISIONS-HOMOLOGATION.md",
    ],
    "apps/api/README.md": ["Backend transactionnel institutionnel"],
    ".github/pull_request_template.md": ["Impact institutionnel"],
    "docs/14-ROADMAP-SAAS-PREMIUM.md": [
        "SBOM CycloneDX signés",
        "docs/24-DEPLOIEMENT-PRODUCTION-OCI-K8S.md",
    ],
}
for relative_path, fragments in expectations.items():
    content = read(relative_path)
    for fragment in fragments:
        if fragment not in content:
            errors.append(f"{relative_path}: mention obligatoire absente: {fragment}")

forbidden = {
    "README.md": ["Statut : MVP"],
    "apps/api/README.md": ["MVP transactionnel"],
    "docs/14-ROADMAP-SAAS-PREMIUM.md": [
        "Reste : SBOM signé",
        "docs/24-RAPPROCHEMENT-BANCAIRE.md",
    ],
}
for relative_path, fragments in forbidden.items():
    content = read(relative_path)
    for fragment in fragments:
        if fragment in content:
            errors.append(f"{relative_path}: mention obsolète interdite: {fragment}")

ci_workflow = read(".github/workflows/ci.yml")
for fragment in [
    "Dossier de preuves institutionnel",
    "scripts/generate-release-evidence.py",
    "institutional-evidence-${{ github.run_id }}",
    "scripts/validate-k8s-schemas.sh",
]:
    if fragment not in ci_workflow:
        errors.append(f".github/workflows/ci.yml: preuve institutionnelle absente: {fragment}")

numbers: dict[str, list[str]] = {}
for path in (ROOT / "docs").glob("[0-9][0-9]-*.md"):
    match = re.match(r"(\d{2})-", path.name)
    if match:
        numbers.setdefault(match.group(1), []).append(path.name)
for number, names in sorted(numbers.items()):
    if len(names) > 1:
        errors.append(f"numéro de document dupliqué {number}: {', '.join(sorted(names))}")

if errors:
    print("Institutional readiness check failed:", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    raise SystemExit(1)

print("Institutional readiness check passed")

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
]
for relative_path in required_files:
    if not (ROOT / relative_path).is_file():
        errors.append(f"document institutionnel manquant: {relative_path}")

expectations = {
    "README.md": [
        "Statut : plateforme institutionnelle en qualification",
        "docs/26-CADRE-INSTITUTIONNEL.md",
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

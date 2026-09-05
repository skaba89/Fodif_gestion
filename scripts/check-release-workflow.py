#!/usr/bin/env python3
"""Protect the non-negotiable controls of the institutional OCI release workflow."""

from pathlib import Path
import re
import sys


workflow = Path(".github/workflows/release-oci.yml").read_text(encoding="utf-8")
errors: list[str] = []

required = [
    'tags:\n      - "v*.*.*"',
    "packages: write",
    "id-token: write",
    "attestations: write",
    'git merge-base --is-ancestor "$GITHUB_SHA" origin/main',
    'Dossier de preuves institutionnel',
    'Analyze (javascript-typescript)',
    "push: true",
    "sbom: true",
    "actions/attest-build-provenance@977bb373ede98d70efdf65b84cb5f73e068dcc2a",
    "cosign sign --yes",
    "cosign verify --certificate-identity",
    "release-manifest.sigstore.json",
]
for fragment in required:
    if fragment not in workflow:
        errors.append(f"release workflow invariant missing: {fragment}")

for action_ref in re.findall(r"^\s*uses:\s*([^\s#]+)", workflow, re.MULTILINE):
    if not re.search(r"@[0-9a-f]{40}$", action_ref):
        errors.append(f"GitHub Action is not pinned to an immutable SHA: {action_ref}")

if ":latest" in workflow:
    errors.append("mutable 'latest' image tags are forbidden in institutional releases")

if errors:
    print("OCI release workflow check failed:", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    raise SystemExit(1)

print("OCI release workflow check passed")

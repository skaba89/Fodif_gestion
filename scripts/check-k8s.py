#!/usr/bin/env python3
"""Fail fast when production Kubernetes safety invariants regress.

This intentionally uses only the Python standard library so it runs in the existing CI image.
Kubernetes schema validation remains a release/cluster gate; these checks protect the repository's
institutional baseline before a manifest reaches that gate.
"""

from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
K8S = ROOT / "k8s"
errors: list[str] = []


def read(name: str) -> str:
    path = K8S / name
    if not path.is_file():
        errors.append(f"manifest missing: k8s/{name}")
        return ""
    content = path.read_text(encoding="utf-8")
    if "\t" in content:
        errors.append(f"k8s/{name}: tabs are forbidden in YAML")
    return content


expected = {
    "00-namespace.yaml": [
        "pod-security.kubernetes.io/enforce: restricted",
        "pod-security.kubernetes.io/audit: restricted",
        "pod-security.kubernetes.io/warn: restricted",
    ],
    "01-configmap.yaml": [
        'NODE_ENV: production',
        'DEMO_MODE: "false"',
        'DATABASE_SSL: "true"',
        'COOKIE_SECURE: "true"',
    ],
    "03-migration-job.yaml": [
        "automountServiceAccountToken: false",
        "readOnlyRootFilesystem: true",
        'drop: ["ALL"]',
        "type: RuntimeDefault",
    ],
    "04-api-deployment.yaml": [
        "replicas: 2",
        "maxUnavailable: 0",
        "maxSurge: 1",
        "automountServiceAccountToken: false",
        "path: /api/v1/health/ready",
        "path: /api/v1/health/live",
        "readOnlyRootFilesystem: true",
        'drop: ["ALL"]',
        "type: RuntimeDefault",
    ],
    "05-web-deployment.yaml": [
        "replicas: 2",
        "maxUnavailable: 0",
        "maxSurge: 1",
        "automountServiceAccountToken: false",
        "readOnlyRootFilesystem: true",
        'drop: ["ALL"]',
        "type: RuntimeDefault",
    ],
    "07-network-policies.yaml": [
        "name: default-deny-ingress",
        "name: allow-ingress-to-web",
        "name: allow-web-to-api",
        "policyTypes:",
    ],
    "08-pod-disruption-budgets.yaml": [
        "kind: PodDisruptionBudget",
        "minAvailable: 1",
        "app: fodip-api",
        "app: fodip-web",
    ],
}

for filename, fragments in expected.items():
    content = read(filename)
    for fragment in fragments:
        if fragment not in content:
            errors.append(f"k8s/{filename}: required safety invariant missing: {fragment}")

kustomization = read("kustomization.yaml")
for filename in expected:
    if filename not in kustomization:
        errors.append(f"k8s/kustomization.yaml: resource missing: {filename}")
for template in ("02-secret.example.yaml", "06-ingress.example.yaml"):
    if re.search(rf"^\s*-\s+{re.escape(template)}\s*$", kustomization, re.MULTILINE):
        errors.append(f"k8s/kustomization.yaml: example must not be deployed: {template}")

for path in sorted(K8S.glob("*.yaml")):
    if path.name.endswith(".example.yaml"):
        continue
    content = path.read_text(encoding="utf-8")
    if re.search(r"DEMO_MODE:\s*[\"']?true", content, re.IGNORECASE):
        errors.append(f"k8s/{path.name}: demo mode is forbidden in production manifests")

if errors:
    print("Kubernetes production baseline check failed:", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    raise SystemExit(1)

print("Kubernetes production baseline check passed")

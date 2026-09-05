#!/usr/bin/env bash
set -euo pipefail

# Validate against the oldest Kubernetes minor still accepted by the institutional baseline.
# Tool versions and archive checksums come from their official GitHub release assets.
KUBERNETES_VERSION="1.35.0"
KUSTOMIZE_VERSION="5.8.1"
KUSTOMIZE_SHA256="029a7f0f4e1932c52a0476cf02a0fd855c0bb85694b82c338fc648dcb53a819d"
KUBECONFORM_VERSION="0.8.0"
KUBECONFORM_SHA256="9bc2bffbf71f261128533edaf912153948b7ff238f9a531ae6d34466ec287883"

task_dir="$(mktemp -d)"
trap 'rm -rf "$task_dir"' EXIT

download_and_verify() {
  local url="$1"
  local output="$2"
  local checksum="$3"
  curl --fail --silent --show-error --location --retry 3 "$url" --output "$output"
  printf '%s  %s\n' "$checksum" "$output" | sha256sum --check --status
}

download_and_verify \
  "https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize/v${KUSTOMIZE_VERSION}/kustomize_v${KUSTOMIZE_VERSION}_linux_amd64.tar.gz" \
  "$task_dir/kustomize.tar.gz" \
  "$KUSTOMIZE_SHA256"
download_and_verify \
  "https://github.com/yannh/kubeconform/releases/download/v${KUBECONFORM_VERSION}/kubeconform-linux-amd64.tar.gz" \
  "$task_dir/kubeconform.tar.gz" \
  "$KUBECONFORM_SHA256"

tar --no-same-owner -xzf "$task_dir/kustomize.tar.gz" -C "$task_dir" kustomize
tar --no-same-owner -xzf "$task_dir/kubeconform.tar.gz" -C "$task_dir" kubeconform

"$task_dir/kustomize" build k8s > "$task_dir/rendered.yaml"
"$task_dir/kubeconform" \
  -strict \
  -summary \
  -kubernetes-version "$KUBERNETES_VERSION" \
  "$task_dir/rendered.yaml"

echo "Kustomize render and Kubernetes ${KUBERNETES_VERSION} schema validation passed"

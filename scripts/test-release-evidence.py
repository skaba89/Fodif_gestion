#!/usr/bin/env python3
"""Regression tests for the institutional release evidence generator."""

from pathlib import Path
import json
import os
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / "scripts/generate-release-evidence.py"
BASE_ENV = {
    "GITHUB_REPOSITORY": "skaba89/Fodif_gestion",
    "GITHUB_SHA": "a" * 40,
    "GITHUB_REF_NAME": "test-candidate",
    "GITHUB_WORKFLOW": "CI",
    "GITHUB_RUN_ID": "123456",
    "GITHUB_RUN_ATTEMPT": "2",
    "GITHUB_SERVER_URL": "https://github.com",
    "SOURCE_DATE_EPOCH": "1788566400",
    "RESULT_INVARIANTS": "success",
    "RESULT_UNIT_TESTS": "success",
    "RESULT_INTEGRATION_TESTS": "success",
    "RESULT_BUILD": "success",
    "RESULT_SECURITY": "success",
    "RESULT_DOCKER": "success",
}


def run(output_dir: Path, **overrides: str) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment.update(BASE_ENV)
    environment.update(overrides)
    return subprocess.run(
        [sys.executable, str(GENERATOR), "--output-dir", str(output_dir), "--require-success"],
        cwd=ROOT,
        env=environment,
        text=True,
        capture_output=True,
        check=False,
    )


with tempfile.TemporaryDirectory() as directory:
    output = Path(directory) / "green"
    result = run(output)
    assert result.returncode == 0, result.stderr
    manifest = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
    summary = (output / "SUMMARY.md").read_text(encoding="utf-8")
    assert manifest["schema_version"] == 1
    assert manifest["source"]["commit_sha"] == "a" * 40
    assert manifest["source"]["run_url"].endswith("/actions/runs/123456")
    assert manifest["qualification"]["technical_ci_complete"] is True
    assert manifest["qualification"]["homologation_granted"] is False
    assert len(manifest["materials"]["migrations"]) == len(list((ROOT / "database").glob("[0-9][0-9][0-9]_*.sql")))
    assert all(len(item["sha256"]) == 64 for item in manifest["materials"]["migrations"])
    assert "ne constitue pas une homologation" in summary

    failed_output = Path(directory) / "failed"
    failed = run(failed_output, RESULT_SECURITY="failure")
    assert failed.returncode == 1
    failed_manifest = json.loads((failed_output / "manifest.json").read_text(encoding="utf-8"))
    assert failed_manifest["qualification"]["technical_ci_complete"] is False
    assert failed_manifest["technical_controls"]["security"]["status"] == "failure"

print("Institutional release evidence tests passed")

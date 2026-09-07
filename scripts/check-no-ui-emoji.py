#!/usr/bin/env python3
"""Fail CI when emoji or dingbat characters are introduced into the Web interface.

The institutional UI uses the shared SVG icon set instead of platform-dependent emoji glyphs.
This check targets source files that can render or style the Web experience; documentation and
backend logs are outside this visual design contract.
"""
from __future__ import annotations

import pathlib
import re
import sys

ROOTS = [pathlib.Path("apps/web/app"), pathlib.Path("apps/web/public")]
EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".html", ".svg"}

# Emoji pictographs, regional indicators, miscellaneous symbols and dingbats. Variation selectors
# are included so text-style symbols cannot silently become emoji presentation in the browser.
EMOJI_RE = re.compile(
    r"[\U0001F1E6-\U0001F1FF\U0001F300-\U0001FAFF\u2600-\u27BF\uFE0F]"
)

violations: list[str] = []
for root in ROOTS:
    if not root.exists():
        continue
    for path in sorted(p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in EXTENSIONS):
        text = path.read_text(encoding="utf-8")
        for line_number, line in enumerate(text.splitlines(), start=1):
            match = EMOJI_RE.search(line)
            if match:
                violations.append(f"{path}:{line_number}: forbidden UI symbol {match.group(0)!r}")

if violations:
    print("Emoji and dingbat characters are forbidden in the institutional Web UI; use shared SVG icons instead.", file=sys.stderr)
    for violation in violations:
        print(f" - {violation}", file=sys.stderr)
    raise SystemExit(1)

print("UI emoji invariant: OK")

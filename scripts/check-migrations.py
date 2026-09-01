from pathlib import Path
import re
import sys

forbidden = [r"\bDROP\s+TABLE\b", r"\bTRUNCATE\b", r"\bCREATE\s+OR\s+REPLACE\s+TABLE\b"]
errors = []
files = sorted(Path('database').rglob('*.sql'))
if not files:
    errors.append('No SQL migrations found')

for path in files:
    text = path.read_text(encoding='utf-8')
    for pattern in forbidden:
        if re.search(pattern, text, flags=re.IGNORECASE):
            errors.append(f'{path}: forbidden destructive pattern {pattern}')
    if text.count('(') != text.count(')'):
        errors.append(f'{path}: unbalanced parentheses')
    if not text.rstrip().endswith(';'):
        errors.append(f'{path}: file must end with a semicolon')

if errors:
    print('\n'.join(errors), file=sys.stderr)
    raise SystemExit(1)

print(f'Validated {len(files)} migration file(s): no destructive DDL detected.')

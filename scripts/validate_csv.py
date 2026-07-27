from __future__ import annotations
import csv
import sys
from pathlib import Path

REQUIRED = {
    "nodes": {"canonical_name","node_type","status","country_code","latitude","longitude"},
    "sources": {"title","publisher","source_type","url"},
    "assertions": {"source_url","claim_text","provenance","source_quality","recency_score","directness_score","corroboration_score","extraction_quality"},
}

def validate(kind: str, path: Path) -> int:
    if kind not in REQUIRED:
        raise SystemExit(f"Unknown kind: {kind}")
    with path.open(newline='', encoding='utf-8-sig') as fh:
        reader = csv.DictReader(fh)
        missing_columns = REQUIRED[kind] - set(reader.fieldnames or [])
        if missing_columns:
            print(f"Missing columns: {sorted(missing_columns)}")
            return 1
        errors = 0
        for row_no, row in enumerate(reader, 2):
            for field in REQUIRED[kind]:
                if not (row.get(field) or '').strip():
                    print(f"Row {row_no}: missing {field}")
                    errors += 1
            if kind == 'nodes':
                try:
                    lat, lon = float(row['latitude']), float(row['longitude'])
                    if not -90 <= lat <= 90 or not -180 <= lon <= 180:
                        raise ValueError
                except ValueError:
                    print(f"Row {row_no}: invalid coordinates")
                    errors += 1
        print(f"Validated {path}: {errors} error(s)")
        return 1 if errors else 0

if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Usage: python scripts/validate_csv.py <nodes|sources|assertions> <file.csv>')
    raise SystemExit(validate(sys.argv[1], Path(sys.argv[2])))

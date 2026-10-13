#!/usr/bin/env bash
# Deletes backups in R2 older than RETENTION_DAYS. Intentionally a flat
# retention window, not grandfather-father-son tiering — simplest policy
# that still bounds storage growth; revisit only if storage cost or
# compliance actually calls for tiered retention later.
#
# Required env: R2_BUCKET, R2_ENDPOINT, AWS_ACCESS_KEY_ID,
#   AWS_SECRET_ACCESS_KEY, RETENTION_DAYS (defaults to 14).
set -uo pipefail

RETENTION_DAYS="${RETENTION_DAYS:-14}"
CUTOFF_EPOCH=$(date -u -d "-${RETENTION_DAYS} days" +%s)

aws s3api list-objects-v2 --bucket "${R2_BUCKET}" --prefix "db-backups/" --endpoint-url "${R2_ENDPOINT}" \
  --query "Contents[].{Key:Key,LastModified:LastModified}" --output json > /tmp/r2-objects.json

if [ $? -ne 0 ]; then
  echo "ERROR=failed to list R2 objects for rotation" >&2
  exit 1
fi

COUNT=$(python3 -c "
import json, sys
from datetime import datetime, timezone

cutoff = ${CUTOFF_EPOCH}
objects = json.load(open('/tmp/r2-objects.json')) or []
deleted = 0
for obj in objects:
    key = obj.get('Key')
    last_modified = obj.get('LastModified')
    if not key or not last_modified:
        continue
    ts = datetime.fromisoformat(last_modified.replace('Z', '+00:00')).timestamp()
    if ts < cutoff:
        print(key)
        deleted += 1
print(f'::deleted_count::{deleted}', file=sys.stderr)
" 2>/tmp/rotate-count.log)

while IFS= read -r KEY; do
  [ -z "$KEY" ] && continue
  aws s3 rm "s3://${R2_BUCKET}/${KEY}" --endpoint-url "${R2_ENDPOINT}"
done <<< "$COUNT"

echo "ROTATED=$(grep -o '[0-9]*$' /tmp/rotate-count.log || echo 0)"

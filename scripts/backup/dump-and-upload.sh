#!/usr/bin/env bash
# Dumps the database with pg_dump and uploads the compressed dump to R2.
# Run from GitHub Actions (.github/workflows/db-backup.yml) via `bash`, not
# executed directly, so its executable bit doesn't matter on checkout.
#
# Required env: DATABASE_URL_DIRECT, R2_BUCKET, R2_ENDPOINT,
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (R2's S3-compatible credentials —
#   the AWS CLI reads these var names regardless of the actual provider).
#
# Prints three lines to stdout on success, consumed by the workflow:
#   DUMP_FILE=<local path to the uncompressed .dump, kept for verify-restore.sh>
#   OBJECT_KEY=<R2 key the compressed dump was uploaded to>
#   SIZE_BYTES=<size of the uploaded .gz file>
set -uo pipefail

DATE_TAG=$(date -u +%Y%m%d-%H%M%S)
DUMP_FILE="/tmp/tbj-backup-${DATE_TAG}.dump"
OBJECT_KEY="db-backups/backup-${DATE_TAG}.dump.gz"

pg_dump "${DATABASE_URL_DIRECT}" --format=custom --no-owner --no-privileges -f "${DUMP_FILE}"
if [ $? -ne 0 ] || [ ! -s "${DUMP_FILE}" ]; then
  echo "ERROR=pg_dump failed or produced an empty file" >&2
  exit 1
fi

gzip -kf "${DUMP_FILE}" # -k keeps the uncompressed copy around for verify-restore.sh
GZ_FILE="${DUMP_FILE}.gz"

aws s3 cp "${GZ_FILE}" "s3://${R2_BUCKET}/${OBJECT_KEY}" --endpoint-url "${R2_ENDPOINT}"
if [ $? -ne 0 ]; then
  echo "ERROR=upload to R2 failed" >&2
  exit 1
fi

SIZE_BYTES=$(wc -c < "${GZ_FILE}")

echo "DUMP_FILE=${DUMP_FILE}"
echo "OBJECT_KEY=${OBJECT_KEY}"
echo "SIZE_BYTES=${SIZE_BYTES}"

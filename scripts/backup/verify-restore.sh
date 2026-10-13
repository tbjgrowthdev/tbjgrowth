#!/usr/bin/env bash
# Proves the backup is actually restorable, not just uploaded: creates a
# throwaway Neon branch (copy-on-write, seconds not minutes), restores the
# dump into it, sanity-checks a couple of row counts, then deletes the
# branch. This is the one step that would have caught a corrupt or
# incompatible dump before anyone needed it for a real restore.
#
# Required env: DATABASE_URL_DIRECT, DUMP_FILE (uncompressed .dump path from
#   dump-and-upload.sh), NEON_API_KEY, NEON_PROJECT_ID.
# Prints: VERIFIED=true|false
set -uo pipefail

NEON_API="https://console.neon.tech/api/v2"
BRANCH_NAME="backup-verify-$(date -u +%Y%m%d-%H%M%S)"

CREATE_RESPONSE=$(curl -fsS -X POST "${NEON_API}/projects/${NEON_PROJECT_ID}/branches" \
  -H "Authorization: Bearer ${NEON_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"branch\": {\"name\": \"${BRANCH_NAME}\"}, \"endpoints\": [{\"type\": \"read_write\"}]}")

if [ $? -ne 0 ] || [ -z "${CREATE_RESPONSE}" ]; then
  echo "ERROR=failed to create Neon verification branch" >&2
  echo "VERIFIED=false"
  exit 1
fi

BRANCH_ID=$(echo "${CREATE_RESPONSE}" | python3 -c "import json,sys; print(json.load(sys.stdin)['branch']['id'])")
RESTORE_URL=$(echo "${CREATE_RESPONSE}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['connection_uris'][0]['connection_uri'])")

cleanup() {
  if [ -n "${BRANCH_ID:-}" ]; then
    curl -fsS -X DELETE "${NEON_API}/projects/${NEON_PROJECT_ID}/branches/${BRANCH_ID}" \
      -H "Authorization: Bearer ${NEON_API_KEY}" > /dev/null 2>&1
  fi
}
trap cleanup EXIT

if [ -z "${BRANCH_ID}" ] || [ -z "${RESTORE_URL}" ]; then
  echo "ERROR=could not parse Neon branch creation response" >&2
  echo "VERIFIED=false"
  exit 1
fi

# New compute endpoints take a few seconds to become reachable.
for i in $(seq 1 10); do
  psql "${RESTORE_URL}" -c "SELECT 1;" > /dev/null 2>&1 && break
  sleep 3
done

pg_restore --no-owner --no-privileges -d "${RESTORE_URL}" "${DUMP_FILE}"
RESTORE_EXIT=$?
if [ ${RESTORE_EXIT} -ne 0 ]; then
  echo "ERROR=pg_restore into verification branch failed (exit ${RESTORE_EXIT})" >&2
  echo "VERIFIED=false"
  exit 1
fi

# Sanity check: a couple of core tables should have roughly the same row
# counts in the restored branch as in the live database. Not every table —
# just enough to catch "the dump was empty/truncated/corrupt," which is the
# failure mode this step exists to catch.
SOURCE_COUNT=$(psql "${DATABASE_URL_DIRECT}" -t -A -c 'SELECT count(*) FROM "Post";' 2>/dev/null | tr -d '[:space:]')
RESTORED_COUNT=$(psql "${RESTORE_URL}" -t -A -c 'SELECT count(*) FROM "Post";' 2>/dev/null | tr -d '[:space:]')

if [ -z "${SOURCE_COUNT}" ] || [ -z "${RESTORED_COUNT}" ] || [ "${SOURCE_COUNT}" != "${RESTORED_COUNT}" ]; then
  echo "ERROR=row count mismatch after restore (source Post count=${SOURCE_COUNT}, restored=${RESTORED_COUNT})" >&2
  echo "VERIFIED=false"
  exit 1
fi

echo "VERIFIED=true"

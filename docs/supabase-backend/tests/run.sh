#!/bin/sh
# Runs schema.sql against a throwaway database on a local Postgres (14+) and checks the access rules.
# Usage: ./run.sh   (uses the usual PGHOST/PGUSER/... environment variables; needs createdb rights)
set -e
cd "$(dirname "$0")"
DB=${DB:-bibliofeed_test}
dropdb --if-exists "$DB"
createdb "$DB"
cat supabase-stub.sql ../schema.sql access-rules.sql | psql -q -v ON_ERROR_STOP=1 -d "$DB"
dropdb "$DB"

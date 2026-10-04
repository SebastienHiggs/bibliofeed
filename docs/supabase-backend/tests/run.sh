#!/bin/sh
# Runs schema.sql against a throwaway database on a local Postgres (14+) and checks the access rules.
# Usage: ./run.sh            (uses the usual PGHOST/PGUSER/... environment variables; needs createdb rights)
#        SCALE=1 ./run.sh    also fills the database with 100,000 users and prints query timings (scale.sql)
set -e
cd "$(dirname "$0")"
DB=${DB:-bibliofeed_test}
dropdb --if-exists "$DB"
createdb "$DB"
cat supabase-stub.sql ../schema.sql access-rules.sql | psql -q -v ON_ERROR_STOP=1 -d "$DB"
if [ -n "$SCALE" ]; then
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f scale.sql | grep -E '^--|^ [a-z]|Execution Time|rows=[0-9]+ loops=1\)$' | grep -vE '^\s+->'
fi
dropdb "$DB"

#!/bin/sh
# Checks the access rules in ../migrations/ against a database.
#
#   ./run.sh            the local Supabase stack: `supabase db reset` applies every migration to a
#                       clean database, then the checks run against it (through psql inside the
#                       stack's database container, so nothing needs installing). Needs `supabase start`.
#   ./run.sh --plain    a throwaway database on a plain local Postgres (14+), with supabase-stub.sql
#                       standing in for the parts of Supabase the schema uses. Quick, but it proves
#                       the rules' logic only, not the Supabase specifics. Uses PGHOST/PGUSER/...
#
#   SCALE=1 ./run.sh    additionally fills the database with 100,000 users and prints query timings
#                       (scale.sql). Allow ten minutes.
set -e
cd "$(dirname "$0")"

# Keeps only the headings and timings of scale.sql's output.
summarise() { grep -E '^--|^ [a-z]|Execution Time|rows=[0-9]+ loops=1\)$' | grep -vE '^\s+->'; }

if [ "$1" = "--plain" ]; then
  DB=${DB:-bibliofeed_test}
  dropdb --if-exists "$DB"
  createdb "$DB"
  cat supabase-stub.sql ../migrations/*.sql access-rules.sql | psql -q -v ON_ERROR_STOP=1 -d "$DB"
  [ -n "$SCALE" ] && psql -q -v ON_ERROR_STOP=1 -d "$DB" -f scale.sql | summarise
  dropdb "$DB"
else
  (cd .. && npx supabase db reset)
  PROJECT=$(sed -n 's/^project_id = "\(.*\)"$/\1/p' ../config.toml)
  run() { tr -d '\r' < "$1" | docker exec -i "supabase_db_$PROJECT" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres; }
  run access-rules.sql
  [ -n "$SCALE" ] && run scale.sql | summarise
  echo "Note: the local database now holds the test users. Run 'supabase db reset' before using it for development."
fi

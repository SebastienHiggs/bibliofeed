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

# The reserved author usernames in the migration must match the handles the app
# derives from web/js/books.js; otherwise an author's handle could be taken.
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  import { ALL_AUTHORS, handle } from "../../web/js/books.js";
  const sql = readFileSync("../migrations/20261005130000_reserve_author_names.sql", "utf8");
  const missing = [...new Set(ALL_AUTHORS.map(handle))].filter((h) => !sql.includes(`\x27${h}\x27`));
  if (missing.length) { console.error("Author handles not reserved in the migration:", missing.join(", ")); process.exit(1); }
  console.log("ok: every author handle is a reserved username");
'

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
  # The first project_id is the local stack's; [remotes.production] has another.
  PROJECT=$(sed -n 's/^project_id = "\(.*\)"$/\1/p' ../config.toml | head -1)
  DB="supabase_db_$PROJECT"
  START=$(date -u +%Y-%m-%dT%H:%M:%S)
  (cd .. && npx supabase db reset)
  # The reset recreates the database container shortly *after* it returns. Give the new
  # container up to 20s to appear, then wait until it answers.
  for i in $(seq 1 20); do
    [ "$(docker inspect -f '{{.State.StartedAt}}' "$DB" 2>/dev/null | cut -c1-19)" \> "$START" ] && break
    sleep 1
  done
  for i in $(seq 1 30); do docker exec "$DB" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
  run() { tr -d '\r' < "$1" | docker exec -i "$DB" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres; }
  run access-rules.sql
  [ -n "$SCALE" ] && run scale.sql | summarise
  echo "Note: the local database now holds the test users. Run 'supabase db reset' before using it for development."
fi

// Where the backend lives. Both values are public by design: the database's
// row-level security decides who may read and change what, not the key
// (see docs/supabase-backend/README.md). Leave both empty and the app runs
// with no accounts at all, exactly as it did before there was a backend.
//
// While developing, put the local stack's values (`npx supabase status`) in
// js/config.local.js, which isn't committed; server.js serves it in place of
// this file.
export const SUPABASE_URL = '';
export const SUPABASE_KEY = '';

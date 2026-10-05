// Where the backend lives. Both values are public by design: the database's
// row-level security decides who may read and change what, not the key
// (see docs/supabase-backend/README.md). Leave both empty and the app runs
// with no accounts at all, exactly as it did before there was a backend.
//
// While developing, put the local stack's values (`npx supabase status`) in
// js/config.local.js, which isn't committed; server.js serves it in place of
// this file.
export const SUPABASE_URL = 'https://qtbcnuaveggytezonxle.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Qj_aiJ_MJZxsrkuXMiuaMg_vEpPPtsh';

// Cloudflare Turnstile on the sign-in form (js/captcha.js). The site key is
// public; the matching secret lives only in the Supabase project's auth
// settings (supabase/config.toml, [remotes.production.auth.captcha]). Empty
// means no bot check, which is how the local stack runs.
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFON5Oo_tItcGWqn';

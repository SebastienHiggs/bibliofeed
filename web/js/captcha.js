// Cloudflare Turnstile on the sign-in form, so the code-email endpoint can't
// be used to spam addresses. The widget runs Cloudflare's check in the
// background and only shows itself if it needs the person to do something;
// Supabase Auth verifies the token it produces. With no site key configured
// (the local stack, by default) nothing here loads and take() resolves to
// undefined, which supabase-js leaves out of the request.
import { TURNSTILE_SITE_KEY } from './config.js';

export const enabled = Boolean(TURNSTILE_SITE_KEY);
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=turnstileReady';
const WAIT = 20_000; // ms to wait for a token before giving up

let library = null; // promise of window.turnstile
function load() {
  return (library ??= new Promise((resolve, reject) => {
    window.turnstileReady = () => resolve(window.turnstile);
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onerror = () => { library = null; reject(new Error('Couldn’t load the bot check. Check your connection, or anything blocking challenges.cloudflare.com, and reload.')); };
    document.head.append(s);
  }));
}

let widget = null;  // the rendered widget's id
let token = null;   // a token nobody has taken yet
let waiting = [];   // callers of take() waiting for the next token
const settle = (fn) => { const w = waiting; waiting = []; w.forEach(fn); };

// Renders the widget into `container`, replacing any earlier one (the sign-in
// form redraws itself between steps). Resolves once the library has loaded.
export async function mount(container) {
  if (!enabled) return;
  const t = await load();
  if (widget !== null) { t.remove(widget); widget = null; }
  token = null;
  if (!container.isConnected) return;
  widget = t.render(container, {
    sitekey: TURNSTILE_SITE_KEY,
    size: 'flexible',
    theme: document.documentElement.dataset.theme || 'auto',
    appearance: 'interaction-only',
    callback: (tk) => {
      if (waiting.length) { settle(({ resolve }) => resolve(tk)); t.reset(widget); } // taken at once; start the next
      else token = tk;
    },
    'expired-callback': () => { token = null; },
    'error-callback': (code) => {
      token = null;
      settle(({ reject }) => reject(new Error(`The bot check failed (Turnstile error ${code}). Reload the page and try again.`)));
      return true; // handled: Turnstile needn't log it too
    },
  });
}

// A token for one request. Tokens are single use, so taking one starts the
// next check straight away (a resend, or a retry after an error, needs its own).
export function take() {
  if (!enabled) return Promise.resolve(undefined);
  if (token) {
    const tk = token;
    token = null;
    window.turnstile.reset(widget);
    return Promise.resolve(tk);
  }
  return new Promise((resolve, reject) => {
    const entry = {
      resolve: (tk) => { clearTimeout(timer); resolve(tk); },
      reject: (err) => { clearTimeout(timer); reject(err); },
    };
    const timer = setTimeout(() => {
      waiting = waiting.filter((w) => w !== entry);
      reject(new Error('The bot check didn’t finish. Reload the page and try again.'));
    }, WAIT);
    waiting.push(entry);
    load().catch(entry.reject);
  });
}

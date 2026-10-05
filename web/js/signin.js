// Sign in: your email, then the 6-digit code it receives, then (the first
// time) a username and display name.
import * as backend from './backend.js';
import * as captcha from './captcha.js';
import { esc, toast } from './ui.js';

const view = document.getElementById('signin-view');
let email = '';
let step = 'email'; // 'email' | 'code' | 'profile'

export async function showSignin() {
  view.hidden = false;
  view.innerHTML = '<div class="sentinel"><div class="spinner"></div></div>';
  await backend.ready;
  if (view.hidden) return;
  if (!backend.configured || backend.signedIn()) {
    location.replace('#/me');
    return;
  }
  if (backend.me) step = 'profile'; // signed in, but no profile yet
  else if (step === 'profile') step = 'email';
  render();
  window.scrollTo({ top: 0 });
}

export function hideSignin() {
  view.hidden = true;
  view.innerHTML = '';
}

const STEPS = {
  email: () => `
    <h2>Sign in</h2>
    <p class="muted">Enter your email and we’ll send you a 6-digit code. There’s no password. A new email makes a new account.</p>
    <label>Email <input name="email" type="email" required autocomplete="email" inputmode="email" placeholder="you@example.com" value="${esc(email)}"></label>
    <div class="turnstile"></div>
    <button class="primary-btn" type="submit">Send code</button>`,
  code: () => `
    <h2>Check your email</h2>
    <p class="muted">We sent a code to <b>${esc(email)}</b>. It works for 10 minutes.</p>
    <label>Code <input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required placeholder="123456"></label>
    <div class="turnstile"></div>
    <button class="primary-btn" type="submit">Sign in</button>
    <p class="auth-links"><button type="button" class="link" data-action="resend">Send a new code</button> · <button type="button" class="link" data-action="change">Use a different email</button></p>`,
  profile: () => `
    <h2>Choose your name</h2>
    <p class="muted">Your username is your address, <b>@username</b>; friends find you by it. Your display name is what they see.</p>
    <label>Username <input name="username" required pattern="[a-z0-9_]{3,20}" maxlength="20" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="e.g. mary_m"></label>
    <small>3–20 characters: lowercase letters, numbers and underscores.</small>
    <label>Display name <input name="display" required maxlength="40" autocomplete="name" placeholder="e.g. Mary M"></label>
    <button class="primary-btn" type="submit">Create profile</button>`,
};

// What to tell the user when the backend says no.
function explain(err) {
  if (err.code === '23505') return 'That username is taken.';
  if (err.code === '23514') return 'That username isn’t allowed.';
  if (/captcha/i.test(err.message)) return 'The bot check didn’t pass. Reload the page and try again.';
  if (/expired|invalid/i.test(err.message)) return 'That code isn’t right, or it has expired. Ask for a new one.';
  return err.message || 'Something went wrong. Please try again.';
}

function render() {
  view.innerHTML = `<form class="auth" novalidate>${STEPS[step]()}<p class="auth-error" hidden></p></form>`;
  const form = view.querySelector('form');
  const error = form.querySelector('.auth-error');
  const button = form.querySelector('.primary-btn');
  form.querySelector('input')?.focus();
  form.querySelector('[name="username"]')?.addEventListener('input', (e) => { e.target.value = e.target.value.toLowerCase(); });
  // The bot check sits on the two steps that can send an email (the code step can resend).
  const slot = form.querySelector('.turnstile');
  if (slot) captcha.mount(slot).catch((err) => { console.error(err); error.textContent = err.message; error.hidden = false; });

  form.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'change') { step = 'email'; render(); }
    if (action === 'resend') submit('resend');
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });

  async function submit(action) {
    if (action !== 'resend' && !form.reportValidity()) return; // resending doesn't need the code filled in
    error.hidden = true;
    button.disabled = true;
    try {
      if (step === 'email' || action === 'resend') {
        if (step === 'email') email = form.email.value.trim();
        await backend.requestCode(email, await captcha.take());
        if (action === 'resend') toast('New code sent');
        else { step = 'code'; render(); return; }
      } else if (step === 'code') {
        await backend.verifyCode(email, form.code.value.trim());
        if (backend.signedIn()) finish(`Signed in as ${backend.me.profile.displayName}`);
        else { step = 'profile'; render(); return; }
      } else {
        await backend.createProfile(form.username.value.trim(), form.display.value.trim());
        finish(`Welcome, ${backend.me.profile.displayName}`);
      }
    } catch (err) {
      console.error(err);
      error.textContent = explain(err);
      error.hidden = false;
    }
    button.disabled = false;
  }
}

function finish(message) {
  step = 'email';
  toast(message);
  location.replace('#/me');
}

/**
 * Username rules, shared by the register form and the settings screen.
 *
 * Kept deliberately narrow — letters, numbers, and three separators. People
 * were signing up with their email address in the username field, which then
 * showed up as their public handle on every post and comment they made, so an
 * address is called out by name rather than left to fail the character rule
 * with a message about which punctuation is allowed.
 *
 * The server enforces the same rules in horacio's `validateUsername`; this is
 * here so the message arrives while you're still typing.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** Letters, numbers, and `_ - .` — nothing else. */
const ALLOWED = /^[A-Za-z0-9._-]+$/;
/** A handle reads as a name, so it can't open or close on punctuation. */
const EDGES = /^[A-Za-z0-9].*[A-Za-z0-9]$|^[A-Za-z0-9]$/;
const DOUBLE_SEPARATOR = /[._-]{2}/;

/**
 * Does this look like someone typed an email address?
 *
 * Deliberately loose: anything with an `@`, and anything whose tail looks like
 * a domain (`name.com`, `name.co.uk`). A real handle ending in `.io` is the
 * rare casualty, and being told to pick another is a smaller cost than a
 * public handle that leaks an address.
 */
export function looksLikeEmail(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  if (value.includes('@')) return true;
  return /\.(com|net|org|edu|gov|io|co|us|uk|ca|de|me|info|mail)$/.test(value);
}

/**
 * Returns a message explaining why `raw` can't be a username, or null if it
 * can. The order matters — the email check runs first so someone pasting an
 * address is told that, rather than being told about `@` being disallowed.
 */
export function validateUsername(raw: string): string | null {
  const value = raw.trim();

  if (!value) return 'Please choose a username.';

  if (looksLikeEmail(value)) {
    return "Don't use your email address as a username — it's public, and everyone will see it on your posts. Pick a nickname or handle instead.";
  }

  if (value.length < USERNAME_MIN) return `Usernames must be at least ${USERNAME_MIN} characters.`;
  if (value.length > USERNAME_MAX) return `Usernames can be at most ${USERNAME_MAX} characters.`;

  if (!ALLOWED.test(value)) {
    return 'Usernames can only use letters, numbers, and _ - . — no spaces or other symbols.';
  }
  if (!EDGES.test(value)) {
    return 'Usernames must start and end with a letter or number.';
  }
  if (DOUBLE_SEPARATOR.test(value)) {
    return "Usernames can't have two _ - or . in a row.";
  }

  return null;
}

/**
 * Strips what a username can't contain, for filtering keystrokes as they're
 * typed. Length and edge rules are left to `validateUsername` — trimming those
 * mid-word would delete characters out from under someone still typing.
 */
export function sanitizeUsername(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._-]/g, '').slice(0, USERNAME_MAX);
}

/**
 * The optional link on a list item — typed by a member, opened by a stranger.
 *
 * Both halves live here so the form and the button can't disagree about what a
 * usable link is: the form refuses to save what the button would refuse to
 * open.
 */

/**
 * A button is a few words, not a sentence. Matches horacio's MAX_LINK_LABEL —
 * the server truncates at this, so the field stops here rather than letting
 * someone type a label that comes back shorter than they wrote it.
 */
export const LINK_LABEL_MAX = 30;

const HTTP = /^https?:\/\//i;

/**
 * Only http(s) is ever handed to `Linking.openURL`.
 *
 * The URL is somebody else's input by the time it's tapped, and `openURL` will
 * happily dial a `tel:`, open a `sms:` draft or follow another app's custom
 * scheme. None of those is what a "read more" button on a list should do.
 */
export function isOpenableLink(url?: string | null): url is string {
  return !!url && HTTP.test(url.trim());
}

/**
 * What the member typed, as something that can be stored — or `null` when it
 * can't be made into a web address.
 *
 * Light on purpose. People paste `porsche.com/history` far more often than the
 * full thing, so a missing scheme is filled in rather than complained about;
 * anything that already names a *different* scheme is refused rather than
 * rewritten, because `javascript:…` with `https://` in front is still not a
 * link anyone meant. Past that it only asks for a host with a dot in it and no
 * spaces — whether the page exists is not this function's business.
 */
export function normalizeListLink(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  // A scheme other than http(s): `mailto:x`, `javascript:…`, `ftp://…`. The
  // `//` is optional in the test because `mailto:` has none — but a bare
  // `host:port` also looks like a scheme, so digits after the colon pass.
  if (!HTTP.test(raw) && /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(raw)) return null;
  const withScheme = HTTP.test(raw) ? raw : `https://${raw}`;
  if (/\s/.test(withScheme)) return null;
  const host = hostOf(withScheme);
  if (!host || !host.includes('.') || host.includes('..') || host.startsWith('.') || host.endsWith('.')) return null;
  return withScheme;
}

/** `en.wikipedia.org` out of `https://www.en.wikipedia.org/wiki/…`; `null` when there's no host to find. */
function hostOf(url: string): string | null {
  // By hand rather than `new URL()`: Hermes' URL is a partial polyfill whose
  // `hostname` has thrown "not implemented" on some SDKs, and this is one regex.
  const m = url.trim().match(/^https?:\/\/(?:[^/?#@]*@)?([^/?#:]+)/i);
  if (!m) return null;
  return m[1].toLowerCase().replace(/^www\./, '');
}

/**
 * The words on an item's link button.
 *
 * The member's own label when they gave one. Otherwise the site's name, not
 * "Learn more": a button that says `petrolicious.com` tells you where you're
 * about to be sent, which is the one thing worth knowing before leaving the
 * app — and ten items all reading "Learn more" say nothing at all.
 */
export function listLinkLabel(link?: string | null, label?: string | null): string {
  const own = label?.trim();
  if (own) return own;
  return (link && hostOf(link)) || 'Open link';
}

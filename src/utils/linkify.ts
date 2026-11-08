/**
 * Links in a post's words, shown as a bold "View More" rather than the raw
 * address — a long URL in a two-line preview was most of the preview.
 *
 * Done before layout, not at render: the card clamps its words by measuring
 * them, so what's measured has to be what's shown. Each URL becomes a marker —
 * the label wrapped in invisible separators, so it can't be confused with
 * someone actually typing "View More" — and MentionText draws each marker as
 * a link to its URL, in order.
 */

export const LINK_LABEL = 'View More';
/** U+2063 INVISIBLE SEPARATOR — zero width, and nothing anyone types. */
const MARK = '⁣';
export const LINK_MARKER = `${MARK}${LINK_LABEL}${MARK}`;
export const LINK_MARKER_RE = new RegExp(`${MARK}${LINK_LABEL}${MARK}`, 'g');

/** http(s) and bare www. addresses, stopping short of trailing punctuation. */
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]}]/gi;

export function linkify(text: string): { text: string; urls: string[] } {
  const urls: string[] = [];
  const out = text.replace(URL_RE, (m) => {
    urls.push(/^https?:\/\//i.test(m) ? m : `https://${m}`);
    return LINK_MARKER;
  });
  return { text: out, urls };
}

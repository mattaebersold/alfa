const HTML_ENTITIES: Record<string, string> = {
  '&amp;':  '&',
  '&lt;':   '<',
  '&gt;':   '>',
  '&quot;': '"',
  '&#39;':  "'",
  '&nbsp;': ' ',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&rdquo;': '”',
  '&ldquo;': '“',
};

export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')                            // tags → space
    .replace(/&[a-z#0-9]+;/gi, (e) => HTML_ENTITIES[e] ?? ' ')  // entities
    .replace(/\s+/g, ' ')                                // collapse whitespace
    .trim();
}

/**
 * Pull http(s) URLs out of a post body. Handles both `<a href="…">` anchors
 * (rich-text editors) and bare URLs typed into the text. Deduped, order-preserved.
 */
export function extractLinks(html: string | null | undefined): string[] {
  if (!html) return [];
  const urls: string[] = [];
  const add = (raw: string) => {
    const url = raw.trim().replace(/[.,;:!?)\]]+$/, '');   // trim trailing punctuation
    if (/^https?:\/\//i.test(url) && !urls.includes(url)) urls.push(url);
  };

  // href="…" attributes
  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html))) add(m[1]);

  // bare URLs in the visible text
  const bareRe = /https?:\/\/[^\s<>"')]+/gi;
  const bare = stripHtml(html).match(bareRe);
  if (bare) bare.forEach(add);

  return urls;
}

/** Short, human-readable label for a URL button — the hostname without `www.`. */
export function linkLabel(url: string): string {
  const stripped = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  return stripped.split(/[/?#]/)[0] || url;
}

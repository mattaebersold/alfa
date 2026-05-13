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

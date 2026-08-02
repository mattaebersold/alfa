import React, { useMemo } from 'react';
import { Text, View, StyleSheet, Linking, TextStyle } from 'react-native';
import { useColors } from '../../hooks/useColors';

/**
 * Minimal HTML → React Native renderer for WYSIWYG-authored article copy.
 *
 * Deliberately narrow: it handles the tags the editor actually emits rather
 * than trying to be a general HTML engine. Anything unrecognised degrades to
 * its text content instead of disappearing.
 *
 * Supported: p, h1-h4, strong/b, em/i, u, s/strike/del, a, ul/ol/li,
 *            blockquote, br, hr, code.
 */

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&rdquo;': '”',
  '&ldquo;': '“',
};

function decodeEntities(text: string): string {
  return text
    .replace(/&[a-z]+;|&#\d+;/gi, (entity) => {
      if (HTML_ENTITIES[entity.toLowerCase()]) return HTML_ENTITIES[entity.toLowerCase()];
      const numeric = entity.match(/^&#(\d+);$/);
      if (numeric) return String.fromCharCode(Number(numeric[1]));
      return entity;
    });
}

// ── Inline parsing ───────────────────────────────────────────────────────────
// Walks a chunk of inline HTML and produces nested <Text> nodes. Style marks
// accumulate down the tree, so <strong><em>x</em></strong> renders bold italic.

type InlineMark = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  href?: string;
};

const TAG_RE = /<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi;

const markForTag = (tag: string, attrs: string): InlineMark | null => {
  switch (tag) {
    case 'strong':
    case 'b':
      return { bold: true };
    case 'em':
    case 'i':
      return { italic: true };
    case 'u':
      return { underline: true };
    case 's':
    case 'strike':
    case 'del':
      return { strike: true };
    case 'code':
      return { code: true };
    case 'a': {
      const href = attrs.match(/href\s*=\s*["']([^"']*)["']/i)?.[1];
      return href ? { href } : {};
    }
    default:
      return null;
  }
};

function renderInline(html: string, keyPrefix: string, c: ReturnType<typeof useColors>) {
  const nodes: React.ReactNode[] = [];
  const stack: InlineMark[] = [];
  let cursor = 0;
  let key = 0;

  const flush = (text: string) => {
    if (!text) return;
    const decoded = decodeEntities(text);
    if (!decoded) return;

    const merged = stack.reduce<InlineMark>((acc, m) => ({ ...acc, ...m }), {});
    const style: TextStyle[] = [];

    if (merged.bold) style.push(inline.bold);
    if (merged.italic) style.push(inline.italic);
    if (merged.underline) style.push(inline.underline);
    if (merged.strike) style.push(inline.strike);
    if (merged.code) style.push({ ...inline.code, color: c.fg });
    if (merged.href) style.push({ color: c.primaryAlt, textDecorationLine: 'underline' });

    nodes.push(
      <Text
        key={`${keyPrefix}-t${key++}`}
        style={style}
        onPress={merged.href ? () => Linking.openURL(merged.href!).catch(() => {}) : undefined}
      >
        {decoded}
      </Text>
    );
  };

  TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG_RE.exec(html)) !== null) {
    flush(html.slice(cursor, match.index));

    const [raw, tagRaw, attrs] = match;
    const tag = tagRaw.toLowerCase();
    const isClosing = raw.startsWith('</');

    if (tag === 'br') {
      nodes.push(<Text key={`${keyPrefix}-br${key++}`}>{'\n'}</Text>);
    } else {
      const mark = markForTag(tag, attrs);
      if (mark) {
        if (isClosing) {
          // Pop the most recent matching mark. Mismatched markup just no-ops.
          for (let i = stack.length - 1; i >= 0; i--) {
            if (JSON.stringify(stack[i]) === JSON.stringify(mark) || (mark.href && stack[i].href)) {
              stack.splice(i, 1);
              break;
            }
          }
        } else {
          stack.push(mark);
        }
      }
    }

    cursor = match.index + raw.length;
  }

  flush(html.slice(cursor));

  return nodes;
}

// ── Block parsing ────────────────────────────────────────────────────────────

type Block =
  | { kind: 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'blockquote'; html: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'hr' };

const BLOCK_RE = /<(p|h1|h2|h3|h4|blockquote|ul|ol|hr)\b[^>]*>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi;
const LI_RE = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;

function parseBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  BLOCK_RE.lastIndex = 0;

  while ((match = BLOCK_RE.exec(html)) !== null) {
    // Loose text sitting between block tags still deserves a paragraph.
    const between = html.slice(cursor, match.index).trim();
    if (between && between.replace(/<[^>]*>/g, '').trim()) {
      blocks.push({ kind: 'p', html: between });
    }

    const tag = match[1]?.toLowerCase();
    const inner = match[2] ?? '';

    if (!tag) {
      blocks.push({ kind: 'hr' });
    } else if (tag === 'ul' || tag === 'ol') {
      const items: string[] = [];
      let li: RegExpExecArray | null;
      LI_RE.lastIndex = 0;
      while ((li = LI_RE.exec(inner)) !== null) items.push(li[1]);
      if (items.length > 0) blocks.push({ kind: 'list', ordered: tag === 'ol', items });
    } else if (tag === 'hr') {
      blocks.push({ kind: 'hr' });
    } else {
      blocks.push({ kind: tag as Block['kind'], html: inner } as Block);
    }

    cursor = match.index + match[0].length;
  }

  const tail = html.slice(cursor).trim();
  if (tail && tail.replace(/<[^>]*>/g, '').trim()) {
    blocks.push({ kind: 'p', html: tail });
  }

  // No block-level markup at all — treat the whole thing as one paragraph.
  if (blocks.length === 0 && html.replace(/<[^>]*>/g, '').trim()) {
    blocks.push({ kind: 'p', html });
  }

  return blocks;
}

interface RichTextProps {
  html?: string | null;
  /** Font size for body copy; headings scale from this. */
  size?: number;
}

export default function RichText({ html, size = 17 }: RichTextProps) {
  const c = useColors();
  const blocks = useMemo(() => parseBlocks(html || ''), [html]);

  if (!html || blocks.length === 0) return null;

  return (
    <View>
      {blocks.map((block, i) => {
        const key = `b${i}`;

        if (block.kind === 'hr') {
          return <View key={key} style={[styles.hr, { backgroundColor: c.border }]} />;
        }

        if (block.kind === 'list') {
          return (
            <View key={key} style={styles.list}>
              {block.items.map((item, j) => (
                <View key={`${key}-i${j}`} style={styles.listItem}>
                  <Text style={[styles.bullet, { color: c.grey, fontSize: size }]}>
                    {block.ordered ? `${j + 1}.` : '•'}
                  </Text>
                  <Text style={[styles.body, { color: c.fg, fontSize: size, lineHeight: size * 1.6, flex: 1 }]}>
                    {renderInline(item, `${key}-i${j}`, c)}
                  </Text>
                </View>
              ))}
            </View>
          );
        }

        if (block.kind === 'blockquote') {
          return (
            <View key={key} style={[styles.quote, { borderLeftColor: c.primaryAlt }]}>
              <Text style={[styles.quoteText, { color: c.fg, fontSize: size, lineHeight: size * 1.6 }]}>
                {renderInline(block.html, key, c)}
              </Text>
            </View>
          );
        }

        if (block.kind === 'p') {
          return (
            <Text
              key={key}
              style={[styles.body, { color: c.fg, fontSize: size, lineHeight: size * 1.65 }]}
            >
              {renderInline(block.html, key, c)}
            </Text>
          );
        }

        // Headings — scale off the body size so the whole block stays in ratio.
        const scale = { h1: 1.7, h2: 1.4, h3: 1.2, h4: 1.05 }[block.kind];
        return (
          <Text
            key={key}
            style={[
              styles.heading,
              { color: c.fg, fontSize: size * scale, lineHeight: size * scale * 1.3 },
            ]}
          >
            {renderInline(block.html, key, c)}
          </Text>
        );
      })}
    </View>
  );
}

const inline = StyleSheet.create({
  bold:      { fontWeight: '700' },
  italic:    { fontStyle: 'italic' },
  underline: { textDecorationLine: 'underline' },
  strike:    { textDecorationLine: 'line-through' },
  code:      { fontFamily: 'Courier', fontSize: 15 },
});

const styles = StyleSheet.create({
  body:      { marginBottom: 16 },
  heading:   { fontWeight: '800', marginBottom: 10, marginTop: 6 },
  list:      { marginBottom: 16 },
  listItem:  { flexDirection: 'row', gap: 8, marginBottom: 6 },
  bullet:    { width: 20 },
  quote:     { borderLeftWidth: 3, paddingLeft: 14, marginBottom: 16 },
  quoteText: { fontStyle: 'italic' },
  hr:        { height: StyleSheet.hairlineWidth, marginVertical: 20 },
});

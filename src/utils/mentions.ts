import type { GarageCar } from '../types/api';

/**
 * Mention tokens, as they're stored in a post or comment body.
 *
 * People are `@username` — a handle is unique, so the name alone resolves.
 * Garage cars have no handle of their own (just a title and an internal_id, and
 * two people can easily both own a "1998 Porsche 911"), so a car mention
 * carries its id:
 *
 *   @[1998 Porsche 911](car:a8f3d1)
 *
 * MentionText renders that as a tappable "@1998 Porsche 911". Anywhere the
 * token isn't parsed, `stripMentionTokens` turns it back into readable text.
 */

/** `@[Title](car:id)` — the display half and the id half. */
const CAR_TOKEN = /@\[([^\]]+)\]\(car:([A-Za-z0-9_-]+)\)/;
/** Same, global, for replacing every token in a string. */
const CAR_TOKEN_G = new RegExp(CAR_TOKEN.source, 'g');
/** Splits a body into text, car tokens and user handles, keeping all three. */
const SPLIT = new RegExp(`(${CAR_TOKEN.source}|@\\w+)`, 'g');
const USER_TOKEN = /^@(\w+)$/;

/** A car's display name — its title, else year/make/model. */
export function carDisplayName(car: Partial<GarageCar>): string {
  const fromParts = [car.year, car.make, car.model].filter(Boolean).join(' ');
  return (car.title || fromParts || 'Untitled car').trim();
}

/**
 * Builds the stored form of a car mention.
 *
 * Brackets and parentheses are stripped from the display half — they're what
 * delimits the token, and a car titled "911 (964)" would otherwise produce
 * something that parses back as a different car, or as nothing at all.
 */
export function buildCarMention(car: Partial<GarageCar>): string {
  const label = carDisplayName(car).replace(/[[\]()]/g, '').trim();
  return `@[${label}](car:${car.internal_id})`;
}

export type MentionSegment =
  | { kind: 'text'; text: string }
  | { kind: 'user'; text: string; username: string }
  | { kind: 'car'; text: string; label: string; carId: string };

/**
 * Splits a body into renderable segments. Used by MentionText; exported so the
 * same parse can back a preview or a plain-text export.
 */
export function parseMentions(body: string): MentionSegment[] {
  if (!body) return [];

  // The capture groups inside CAR_TOKEN come back as their own array entries
  // from split(), so anything matching the whole-token or handle shape is a
  // mention and the inner captures are dropped as duplicates.
  const out: MentionSegment[] = [];
  for (const part of body.split(SPLIT)) {
    if (!part) continue;

    const car = part.match(CAR_TOKEN);
    if (car && car[0] === part) {
      out.push({ kind: 'car', text: part, label: car[1], carId: car[2] });
      continue;
    }

    const user = part.match(USER_TOKEN);
    if (user) {
      out.push({ kind: 'user', text: part, username: user[1] });
      continue;
    }

    // A car token's inner captures resurface here as bare text; they're
    // already accounted for by the segment above, so drop them.
    const last = out[out.length - 1];
    if (last?.kind === 'car' && (part === last.label || part === last.carId)) continue;

    out.push({ kind: 'text', text: part });
  }
  return out;
}

/**
 * Turns tokens back into plain readable text — `@[1998 Porsche 911](car:a8f3d1)`
 * becomes `@1998 Porsche 911`. For anywhere a body is shown without the
 * renderer: search previews, notification bodies, emails.
 */
export function stripMentionTokens(body: string): string {
  if (!body) return '';
  return body.replace(CAR_TOKEN_G, '@$1');
}

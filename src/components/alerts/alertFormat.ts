import { REGIONS } from '../../constants/regions';
import { ALERT_LIMIT_BASIC, ALERT_LIMIT_PRO, ALERT_LIMIT_UPSELL } from '../../constants/limits';
import { categoryLabel, LISTING_CONDITIONS } from '../marketplace/listingFormat';
import type {
  Alert, AlertEvent, AlertFilterKey, AlertFilters, AlertMeta, AlertEventMeta,
  AlertCounts, AlertGroupOption,
} from '../../types/api';

/**
 * An alert, said in English.
 *
 * This file is the whole reason the feature reads the way it does. A rule is
 * stored as an event key and a bag of filters — `listing_created` with
 * `{ make_handle: 'bmw', model_handle: 'e38', category: 'part' }` — and
 * nothing about that is a thing a member wants to look at. What they want to
 * look at is "When a BMW E38 part is listed for sale", and they want to see it
 * *while they build it*, because that sentence is the only honest answer to
 * "what am I going to get told about".
 *
 * So the sentence lives here, once, and three places render it: the live
 * preview in the builder, every row of the list, and the delete confirmation.
 * Three copies of this grammar is three ways for the preview to promise
 * something the saved rule doesn't do.
 *
 * The shape is always the same — **When a ‹subject› is ‹verb›‹qualifiers›** —
 * and every event fills in the same three slots. One shape rather than a
 * bespoke phrasing per event: a member reading their fourth alert should be
 * able to skim it, and they can only skim a list whose rows are parallel.
 */

// ── Sections ─────────────────────────────────────────────────────────────────

export type AlertSection = 'marketplace' | 'garage' | 'groups' | 'events';

/**
 * The sections of the event picker, in order.
 *
 * `garage` is deliberately absent: a car arriving in someone's garage, or a
 * mod logged against one, is activity you follow a *person* or a *car* for —
 * both of which already notify. An alert is for things you can act on, which
 * is why the marketplace leads. The three garage events still exist in
 * ALERT_EVENTS, because a rule made before this can still be read and edited;
 * they're just not offered as something new to watch.
 */
export const ALERT_SECTIONS: { key: AlertSection; label: string }[] = [
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'groups',      label: 'Groups' },
  { key: 'events',      label: 'Events & routes' },
];

// ── Per-event copy ───────────────────────────────────────────────────────────

interface EventCopy {
  /** The chip in the builder. */
  label: string;
  /** One line under it, saying what it actually watches. */
  hint: string;
  section: AlertSection;
  /**
   * The subject when no make, model or category narrows it — "anything",
   * "a car", "a post". Already carries its own article.
   */
  fallbackSubject: string;
  /**
   * The noun a category-less but make-narrowed rule uses: "When a **Porsche**
   * *car* is added to a garage". Empty where the make alone reads fine.
   */
  noun: string;
  /** The predicate, article and all: "is listed for sale". */
  verb: string;
  /**
   * The filters this event takes when the server's meta doesn't say. Meta is
   * the authority — this is what keeps the builder usable against a server
   * mid-deploy, and a sanity check that a new event key didn't arrive with an
   * empty filter list.
   */
  filters: AlertFilterKey[];
  /** Which vocabulary fills the `category` picker, and the field's label. */
  categorySource?: { key: VocabularyKey; label: string };
  /** Only `post_created`: which vocabulary fills the `kind` picker. */
  kindSource?: { key: VocabularyKey; label: string };
}

/**
 * The five-and-a-bit vocabularies `category` can be drawn from.
 *
 * One stored key, five different lists of legal values, chosen by the event —
 * a listing category and a group-resource category have nothing to do with
 * each other. `post_categories` is the odd one: it's a map keyed by post type,
 * so that picker depends on `kind` being chosen first.
 */
export type VocabularyKey =
  | 'listing_categories' | 'listing_kinds' | 'post_types' | 'post_categories'
  | 'event_categories' | 'discussion_categories' | 'resource_categories';

/**
 * The events, mirroring horacio's `models/Alert` EVENT_DEFS.
 *
 * The `filters` lists here are a *fallback* — `meta.events[].filters` is the
 * authority and the builder renders from it — but they're kept in step with
 * the server's on purpose, because a fallback that disagrees is a form that
 * quietly offers a field the server will drop on save.
 *
 * Two of the server's choices are worth knowing when reading these:
 * `group_id` applies to most events, not just the group ones (something
 * *shared into* a group), and neither `rally_created` nor `route_created`
 * takes a region, because neither collection stores a region key to match on.
 */
export const ALERT_EVENTS: Record<AlertEvent, EventCopy> = {
  listing_created: {
    label: 'Listed for sale',
    hint: 'Someone lists something for sale — a car, a part, a set of wheels.',
    section: 'marketplace',
    fallbackSubject: 'anything',
    noun: '',
    verb: 'is listed for sale',
    filters: ['make', 'model', 'category', 'condition_min', 'price_max', 'region', 'near', 'group_id', 'keyword'],
    categorySource: { key: 'listing_categories', label: 'Category' },
  },
  want_created: {
    label: 'Wanted',
    hint: "Someone posts a want ad — useful if you've got one to sell.",
    section: 'marketplace',
    fallbackSubject: 'anything',
    noun: '',
    verb: 'is wanted by someone',
    // No price or condition: a want ad is a wish, not an offer.
    filters: ['make', 'model', 'category', 'region', 'near', 'group_id', 'keyword'],
    categorySource: { key: 'listing_categories', label: 'Category' },
  },

  garagecar_added: {
    label: 'Added to a garage',
    hint: 'A member adds a car to their garage.',
    section: 'garage',
    fallbackSubject: 'a car',
    noun: '',
    verb: 'is added to a garage',
    // No location: a garage car isn't a place.
    filters: ['make', 'model', 'keyword'],
  },
  car_mod_added: {
    label: 'Modded',
    hint: 'Work gets logged against a car — parts fitted, jobs done.',
    section: 'garage',
    fallbackSubject: 'a car',
    noun: '',
    verb: 'gets a new mod',
    filters: ['make', 'model', 'keyword'],
  },
  car_photos_added: {
    label: 'New photos',
    hint: 'Photos are added to a car.',
    section: 'garage',
    fallbackSubject: 'a car',
    noun: '',
    verb: 'gets new photos',
    filters: ['make', 'model', 'keyword'],
  },
  post_created: {
    label: 'Posted about',
    hint: 'Someone writes a post.',
    section: 'garage',
    fallbackSubject: 'a post',
    noun: 'post',
    verb: 'is published',
    filters: ['make', 'model', 'kind', 'category', 'group_id', 'keyword'],
    // The one event where `kind` is real: it's the post's type, and the
    // category list depends on which type was picked.
    kindSource: { key: 'post_types', label: 'Kind of post' },
    categorySource: { key: 'post_categories', label: 'Category' },
  },

  group_discussion_created: {
    label: 'Group discussion',
    hint: 'A discussion post goes up in a group.',
    section: 'groups',
    fallbackSubject: 'a group discussion post',
    noun: 'group discussion post',
    verb: 'is created',
    filters: ['group_id', 'category', 'keyword'],
    categorySource: { key: 'discussion_categories', label: 'Category' },
  },
  group_news_created: {
    label: 'Group news',
    hint: 'A group posts news.',
    section: 'groups',
    fallbackSubject: 'a group news post',
    noun: 'group news post',
    verb: 'is posted',
    filters: ['group_id', 'keyword'],
  },
  group_resource_created: {
    label: 'Group resource',
    hint: 'A manual, a diagram, a how-to — added to a group.',
    section: 'groups',
    fallbackSubject: 'a group resource',
    noun: 'group resource',
    verb: 'is added',
    filters: ['group_id', 'category', 'keyword'],
    categorySource: { key: 'resource_categories', label: 'Category' },
  },

  event_created: {
    label: 'Event added',
    hint: 'A meet, a show or a track day goes on the calendar.',
    section: 'events',
    fallbackSubject: 'an event',
    noun: 'event',
    verb: 'is added to the calendar',
    filters: ['category', 'region', 'near', 'group_id', 'keyword'],
    categorySource: { key: 'event_categories', label: 'Kind of event' },
  },
  rally_created: {
    label: 'Rally announced',
    hint: 'A rally is announced.',
    section: 'events',
    fallbackSubject: 'a rally',
    noun: 'rally',
    verb: 'is announced',
    // No region — models/Rally stores coordinates but no region key. The
    // server accepts a `category` here but meta ships no list of them, so the
    // picker draws nothing until it does.
    filters: ['category', 'near', 'keyword'],
  },
  route_created: {
    label: 'Route published',
    hint: 'A driving route is published.',
    section: 'events',
    fallbackSubject: 'a driving route',
    noun: 'driving route',
    verb: 'is published',
    // No region either: a route is a track, not a place. `near` works because
    // the start of the drive stands in as its position.
    filters: ['near', 'group_id', 'keyword'],
  },
};

/** Every event key this build knows how to say. Meta decides which are offered. */
export const ALERT_EVENT_KEYS = Object.keys(ALERT_EVENTS) as AlertEvent[];

export const isKnownEvent = (key: string): key is AlertEvent =>
  Object.prototype.hasOwnProperty.call(ALERT_EVENTS, key);

// ── Meta, normalized ─────────────────────────────────────────────────────────

/**
 * The meta payload with every gap filled in.
 *
 * The builder can't draw a filter whose options it doesn't have, and the
 * backend for this feature is landing alongside it — so rather than a screen
 * full of empty pickers whenever a key is named differently or hasn't shipped,
 * every list falls back to what the app already knows. A server that sends the
 * real thing overrides all of it.
 *
 * Also drops events this build has no sentence for: a key we can't say in
 * English is a blank row in the list and an unlabelled chip in the builder,
 * which is worse than not offering it until the app catches up.
 */
export interface NormalizedAlertMeta {
  events: (AlertEventMeta & { key: AlertEvent; section: AlertSection; filters: AlertFilterKey[] })[];
  listing_categories: string[];
  listing_kinds: string[];
  /** Index into this is what `condition_min` stores. */
  listing_conditions: string[];
  post_types: string[];
  /** Keyed by post type — see VocabularyKey. */
  post_categories: Record<string, string[]>;
  event_categories: string[];
  discussion_categories: string[];
  resource_categories: string[];
  /** Only the groups this member actually belongs to — a rule can't name others. */
  groups: AlertGroupOption[];
  regions: { key: string; label: string }[];
  default_radius_miles: number;
  max_radius_miles: number;
  limits: { basic: number; pro: number };
}

/**
 * The server's filter spelling, in the app's.
 *
 * `meta.events[].filters` names the two car filters after the columns they're
 * stored in — `make_handle`, `model_handle` — while the form and the sentence
 * key on the display spelling. Translating here, once, is what keeps every
 * `has('make')` in the builder from silently being false.
 */
const FILTER_ALIASES: Record<string, AlertFilterKey> = {
  make_handle: 'make',
  model_handle: 'model',
};

const toFilterKey = (k: string): AlertFilterKey =>
  (FILTER_ALIASES[k] ?? k) as AlertFilterKey;

export function normalizeAlertMeta(meta?: AlertMeta): NormalizedAlertMeta {
  const raw = Array.isArray(meta?.events) && meta!.events.length
    ? meta!.events
    : ALERT_EVENT_KEYS.map((key) => ({
        key, label: ALERT_EVENTS[key].label, filters: ALERT_EVENTS[key].filters as string[],
      }));

  const events = raw
    .filter((e): e is AlertEventMeta => !!e?.key && isKnownEvent(e.key))
    .map((e) => {
      const copy = ALERT_EVENTS[e.key as AlertEvent];
      const declared = (e.filters ?? []).filter(Boolean).map(toFilterKey);
      return {
        ...e,
        key: e.key as AlertEvent,
        // The server's list wins, but an empty one means "it didn't say", not
        // "no filters" — an event with nothing to narrow it by is useless.
        filters: declared.length ? declared : copy.filters,
        section: copy.section,
      };
    });

  /** Nested first, then the flat twin, then what the app already knows. */
  const list = (nested: string[] | undefined, flat: string[] | undefined, local: string[] = []) =>
    (nested?.length ? nested : flat?.length ? flat : local);

  return {
    events,
    listing_categories: list(meta?.listing?.categories, meta?.listing_categories),
    listing_kinds:      list(meta?.listing?.kinds, undefined, ['sale', 'want']),
    listing_conditions: list(meta?.listing?.conditions, meta?.conditions, LISTING_CONDITIONS),
    post_types:         list(meta?.post?.types, meta?.post_types),
    post_categories:    meta?.post?.categories ?? {},
    event_categories:   list(meta?.event?.categories, meta?.event_categories),
    discussion_categories: meta?.group?.discussion_categories ?? [],
    resource_categories:   meta?.group?.resource_categories ?? [],
    /**
     * Only groups this member is in. The server refuses a rule naming any
     * other with a 400, so offering them would be offering a dead end — and
     * the picker is the only place that knows enough to filter.
     */
    groups: (meta?.group?.entries ?? []).filter((g) => g?.is_member),
    regions: meta?.regions?.length
      ? meta.regions.map((r) => ({ key: r.key, label: r.label }))
      : REGIONS.map((r) => ({ key: r.key, label: r.label })),
    default_radius_miles: meta?.default_radius_miles ?? 50,
    max_radius_miles: meta?.max_radius_miles ?? 500,
    limits: meta?.limits ?? { basic: ALERT_LIMIT_BASIC, pro: ALERT_LIMIT_PRO },
  };
}

/** Which filters an event takes, per meta, falling back to this build's list. */
export function filtersFor(event: AlertEvent, meta: NormalizedAlertMeta): Set<AlertFilterKey> {
  const entry = meta.events.find((e) => e.key === event);
  return new Set(entry?.filters ?? ALERT_EVENTS[event].filters);
}

/**
 * One vocabulary's options.
 *
 * `post_categories` is the special case: it's a map keyed by post type, so it
 * needs to know which `kind` was picked. No kind yet means no list — a member
 * who hasn't said "record post" can't be offered "restoration".
 */
function vocabulary(key: VocabularyKey, meta: NormalizedAlertMeta, kind?: string): string[] {
  if (key === 'post_categories') return kind ? meta.post_categories[kind] ?? [] : [];
  const v = meta[key as Exclude<VocabularyKey, 'post_categories'>];
  return Array.isArray(v) ? v : [];
}

/** The option list behind an event's `category` picker, with its field label. */
export function categoryOptionsFor(
  event: AlertEvent,
  meta: NormalizedAlertMeta,
  kind?: string,
): { label: string; options: string[] } | null {
  const source = ALERT_EVENTS[event].categorySource;
  if (!source) return null;
  return { label: source.label, options: vocabulary(source.key, meta, kind) };
}

/** The same for `kind` — only `post_created` has one today. */
export function kindOptionsFor(
  event: AlertEvent,
  meta: NormalizedAlertMeta,
): { label: string; options: string[] } | null {
  const source = ALERT_EVENTS[event].kindSource;
  if (!source) return null;
  return { label: source.label, options: vocabulary(source.key, meta) };
}

/** A group's name, for the sentence. Only groups the member is in are known. */
export const groupNameOf = (meta: NormalizedAlertMeta, id?: string | null): string | null =>
  (id ? meta.groups.find((g) => g.internal_id === id)?.title ?? null : null);

/**
 * How an enum value reads in the sentence.
 *
 * The listing categories have real labels ("wheels_tires" → "Wheels & tires");
 * everything else is a slug the server reads off a schema enum, and dashes and
 * underscores are the only thing between it and a word ("cars-and-coffee",
 * "tech-session").
 */
export function vocabWord(event: AlertEvent, value: string): string {
  if (event === 'listing_created' || event === 'want_created') {
    return categoryLabel(value).toLowerCase();
  }
  return value.replace(/[_-]+/g, ' ').toLowerCase();
}

// ── The sentence ─────────────────────────────────────────────────────────────

/**
 * What a bolded word in the sentence *is*.
 *
 * The sentence is the feature, so its parts carry their own meaning rather
 * than being uniformly bold: what you're watching, what has to happen to it,
 * and each way you narrowed it get their own colour, so a member scanning a
 * list of rules can tell two "when a Porsche…" alerts apart without reading
 * either to the end. Grammar stays plain.
 */
export type SentenceTone =
  | 'subject'    // the thing being watched — make, model, kind, category
  | 'action'     // what happens to it — listed, added to a garage
  | 'condition'
  | 'price'
  | 'group'
  | 'place'      // a region, or a radius and a zip
  | 'keyword';

export interface SentencePart {
  text: string;
  /** The member's own choices, bolded — the rest is grammar. */
  strong?: boolean;
  /** Which kind of choice it is. Only set on `strong` parts. */
  tone?: SentenceTone;
}

/**
 * A handle read back as something printable.
 *
 * Only reached when the server stores handles and doesn't echo the display
 * spelling. `mercedes-benz` becomes `Mercedes Benz`, which is wrong by a
 * hyphen and right by every other measure — far better than a sentence with a
 * lowercase slug sitting in the middle of it.
 */
export function unhandleize(handle?: string | null): string {
  if (!handle) return '';
  return handle
    .split('-')
    .filter(Boolean)
    .map((w) => (w.length <= 3 && w === w.toLowerCase() && /^[a-z]+\d*$/.test(w)
      ? w.toUpperCase()   // "bmw", "amg", "e38" — initialisms, not words
      : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** The display spelling of a filter's make/model, whichever form it's stored in. */
export const makeOf  = (f: AlertFilters) => f.make  || unhandleize(f.make_handle);
export const modelOf = (f: AlertFilters) => f.model || unhandleize(f.model_handle);

/** `$5,000`, matching the marketplace's price formatting. */
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const a = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

/**
 * The rule as a sentence, in parts so the caller can bold the member's own
 * words and leave the grammar plain.
 *
 * `groupName` is passed in rather than looked up: only the caller knows
 * whether it has the member's groups loaded, and "in that group" is a better
 * placeholder than a spinner in the middle of a sentence.
 */
export function alertSentence(
  alert: { event: AlertEvent; filters?: AlertFilters | null },
  meta: NormalizedAlertMeta,
  groupName?: string | null,
): SentencePart[] {
  const copy = ALERT_EVENTS[alert.event];
  if (!copy) return [{ text: 'An alert' }];

  const f = alert.filters ?? {};
  const applies = filtersFor(alert.event, meta);
  const has = (k: AlertFilterKey) => applies.has(k);

  // ── The subject: make, model and the noun they qualify ────────────────────
  const subjectWords: string[] = [];
  if (has('make')  && makeOf(f))  subjectWords.push(makeOf(f));
  if (has('model') && modelOf(f)) subjectWords.push(modelOf(f));
  // Kind then category, in that order: a "record post" about "restoration"
  // reads as "a record restoration post", not the other way round.
  if (has('kind') && f.kind) subjectWords.push(vocabWord(alert.event, f.kind));
  if (has('category') && f.category) subjectWords.push(vocabWord(alert.event, f.category));
  /**
   * The noun the qualifiers hang off — "a BMW **post**", "a cars and coffee
   * **event**".
   *
   * Only where the qualifiers alone would read as the wrong kind of thing.
   * A listing's noun is empty on purpose: its categories are already nouns, so
   * "a part is listed for sale" needs no help and "a part listing" is worse.
   */
  if (subjectWords.length && copy.noun && !subjectWords.includes(copy.noun)) {
    subjectWords.push(copy.noun);
  }

  const parts: SentencePart[] = [{ text: 'When ' }];
  if (subjectWords.length) {
    const subject = subjectWords.join(' ');
    parts.push({ text: `${a(subject)} ` }, { text: subject, strong: true, tone: 'subject' }, { text: ' ' });
  } else {
    parts.push({ text: `${copy.fallbackSubject} ` });
  }

  // ── The predicate ─────────────────────────────────────────────────────────
  parts.push({ text: copy.verb, strong: true, tone: 'action' });

  // ── Qualifiers, in the order they'd be said aloud ─────────────────────────
  if (has('condition_min') && typeof f.condition_min === 'number') {
    const label = meta.listing_conditions[f.condition_min];
    if (label) {
      parts.push(
        { text: ' in ' },
        { text: label.toLowerCase(), strong: true, tone: 'condition' },
        { text: ' condition or better' },
      );
    }
  }

  if (has('price_max') && typeof f.price_max === 'number' && f.price_max > 0) {
    const under = alert.event === 'want_created' ? ' with a budget over ' : ' for under ';
    parts.push({ text: under }, { text: money(f.price_max), strong: true, tone: 'price' });
  }

  /**
   * The group, always appended and always named as one.
   *
   * `group_id` applies to most events, not only the three group ones — it
   * means "shared into that group". So "in Transaxle" would read as a place
   * next to the location clause below it; "in the Transaxle group" can't.
   */
  if (has('group_id') && f.group_id) {
    parts.push(
      { text: ' in the ' },
      { text: groupName || 'chosen', strong: true, tone: 'group' },
      { text: ' group' },
    );
  }

  const near = has('near') ? f.near : null;
  if (near?.zip) {
    const miles = near.radius_miles ?? meta.default_radius_miles;
    parts.push(
      { text: ' within ' }, { text: `${miles} miles`, strong: true, tone: 'place' },
      { text: ' of ' }, { text: near.zip, strong: true, tone: 'place' },
    );
  } else if (has('region') && f.region) {
    const label = meta.regions.find((r) => r.key === f.region)?.label ?? f.region;
    parts.push({ text: ' in the ' }, { text: label, strong: true, tone: 'place' });
  }

  if (has('keyword') && f.keyword?.trim()) {
    parts.push({ text: ' mentioning ' }, { text: `“${f.keyword.trim()}”`, strong: true, tone: 'keyword' });
  }

  return parts;
}

/** The same sentence, flattened — for accessibility labels and confirmations. */
export function alertSentencePlain(
  alert: { event: AlertEvent; filters?: AlertFilters | null },
  meta: NormalizedAlertMeta,
  groupName?: string | null,
): string {
  return alertSentence(alert, meta, groupName).map((p) => p.text).join('');
}

/** What the row is headed: the member's own name for it, or the sentence. */
export function alertTitle(
  alert: Pick<Alert, 'label' | 'event' | 'filters'>,
  meta: NormalizedAlertMeta,
  groupName?: string | null,
): string {
  const label = alert.label?.trim();
  return label || alertSentencePlain(alert, meta, groupName);
}

/** "Push and email", "Push only", "Nowhere" — how a match reaches you. */
export function channelsLabel(channels?: { push?: boolean; email?: boolean } | null): string {
  const push = !!channels?.push;
  const email = !!channels?.email;
  if (push && email) return 'Push and email';
  if (push) return 'Push';
  if (email) return 'Email';
  // Legal, and worth saying plainly — it still lands in the bell, which is
  // the one place a notification always goes.
  return 'In-app only';
}

/**
 * Where the member stands against the cap, from whichever source answered.
 *
 * `/api/alerts` carries its own `counts` and `/api/users/usage` carries an
 * `alerts` key; either is enough, and a build that has neither gates nothing
 * rather than locking someone out of a feature because a count didn't load.
 *
 * **Pro is capped too** — twenty rather than one — so unlike every other
 * allowance in the app this one is not skipped for Pro members. That's the
 * server's rule (helpers/limits `alertUsage` never returns a null limit), and
 * a client assuming "Pro means unlimited" here would let a Pro member fill in
 * the whole form only to be refused at the end of it.
 */
export function alertAllowance(
  counts: AlertCounts | undefined,
): { used: number; limit: number; remaining: number; reached: boolean; isPro: boolean } | null {
  if (!counts || typeof counts.used !== 'number' || counts.limit == null) return null;
  return {
    used: counts.used,
    limit: counts.limit,
    remaining: counts.remaining ?? Math.max(0, counts.limit - counts.used),
    reached: counts.reached ?? counts.used >= counts.limit,
    // `/api/alerts` omits isPro; the limit itself gives it away.
    isPro: counts.isPro ?? counts.limit > ALERT_LIMIT_BASIC,
  };
}

/**
 * What to say when there's no room for another rule.
 *
 * Two different problems wearing the same 403. A basic member has something to
 * buy, so they get the Pro card. A Pro member at twenty has nothing to buy —
 * selling Pro to someone who already has it is the worst kind of upsell — so
 * they get a plain notice telling them to delete one instead. The server words
 * both cases itself, so its sentence wins when the refusal came from it.
 */
export function alertCapCopy(
  isPro: boolean,
  serverMessage?: string,
): { title: string; message: string; sellPro: boolean } {
  if (isPro) {
    return {
      title: 'No room for another alert',
      message: serverMessage
        ?? `You've used all ${ALERT_LIMIT_PRO} of your alerts. Delete one to make room for another.`,
      sellPro: false,
    };
  }
  return {
    title: ALERT_LIMIT_UPSELL.title,
    message: serverMessage ?? ALERT_LIMIT_UPSELL.message,
    sellPro: true,
  };
}

/**
 * A colour per kind of word in the sentence.
 *
 * Borrowed from the badge palette the rest of the app uses for the same
 * things — the marketplace's green for a price, the event badge's yellow for
 * a place — so a colour means the same here as it does on a card. Passed the
 * theme's colours rather than importing them, since the subject takes the
 * brand colour, which is gold for Pro and blue for everyone else.
 */
export function sentenceToneColor(
  tone: SentenceTone | undefined,
  palette: { brand: string; fg: string },
): string {
  switch (tone) {
    case 'subject':   return palette.brand;
    case 'action':    return '#7FD1F7';   // what happens — cool, and never a value
    case 'price':     return '#00E070';   // the marketplace's green, legible on black
    case 'condition': return '#F5A623';
    case 'group':     return '#F89CFA';   // the group badge
    case 'place':     return '#E9D26A';
    case 'keyword':   return '#C6A0F6';
    default:          return palette.fg;
  }
}

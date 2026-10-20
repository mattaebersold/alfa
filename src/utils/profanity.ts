import { Alert } from 'react-native';
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';

/**
 * The app's side of the profanity check.
 *
 * horacio is what refuses (middleware/profanityGuard, with the same library and
 * the same allowances): nothing with profanity in it is written, whatever sent
 * it. This is the same check run early — on a multi-step form's Next, and on a
 * submit that would upload photos or a video first — so a member hears about
 * it on the step that has the word, not after an upload, and edits it there.
 *
 * Keep `ALLOWED` in step with horacio's helpers/profanity.js.
 */
const ALLOWED = [
  'assess', 'assessed', 'assessing', 'assessment', 'assessments', 'assessor',
  'cockpit', 'cockpits',
  'dickinson', 'dickens',
  'shiitake',
  'pussycat',
  'cum laude', 'magna cum laude', 'summa cum laude',
];

const built = englishDataset.build();
const matcher = new RegExpMatcher({
  ...built,
  whitelistedTerms: [...(built.whitelistedTerms ?? []), ...ALLOWED],
  ...englishRecommendedTransformers,
});

/** True when this text contains something on the list. */
export const isProfane = (value?: string | null): boolean =>
  !!value && value.trim() !== '' && matcher.hasMatch(value);

/**
 * The first field with profanity in it, by the name a member knows it by —
 * `{ title, description }` → "description" — or null.
 */
export function findProfanity(fields: Record<string, string | string[] | null | undefined>): string | null {
  for (const [label, value] of Object.entries(fields)) {
    const values = Array.isArray(value) ? value : [value];
    if (values.some((v) => isProfane(v))) return label;
  }
  return null;
}

/**
 * Check, and say so: an alert naming the field, so the member can go and edit
 * it. True when something was found — the caller stops there.
 */
export function blockProfanity(fields: Record<string, string | string[] | null | undefined>): boolean {
  const label = findProfanity(fields);
  if (!label) return false;
  Alert.alert(
    'Edit before continuing',
    `Your ${label} has language that isn't allowed here. Edit it to continue.`,
  );
  return true;
}

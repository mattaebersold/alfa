import { colors } from './colors';

/**
 * What a post can be, and what it can be about.
 *
 * Lifted out of CreateScreen so the group's own post form offers exactly the
 * same choices. Two forms creating the same kind of object shouldn't disagree
 * about what kinds there are — the group sheet used to hardcode `general` and
 * pick from a different category list entirely.
 */

export type PostType = 'general' | 'record' | 'listing' | 'want' | 'spot';

export const POST_TYPES: { type: PostType; label: string; color: string }[] = [
  { type: 'general',  label: 'General',    color: colors.primaryAlt },
  { type: 'record',   label: 'Car Record', color: colors.teal },
  { type: 'listing',  label: 'Listing',    color: '#00C851' },
  { type: 'want',     label: 'Want Ad',    color: '#F1184C' },
  { type: 'spot',     label: 'Spotted',    color: colors.tangerine },
];

export const POST_CATEGORIES: Record<PostType, { key: string; label: string }[]> = {
  general: [
    { key: 'show',  label: 'Show' },
    { key: 'misc',  label: 'Misc.' },
  ],
  record: [
    { key: 'general',      label: 'General' },
    { key: 'mod',          label: 'Mod' },
    { key: 'restoration',  label: 'Restoration' },
    { key: 'maintenance',  label: 'Maintenance' },
    { key: 'detailing',    label: 'Detailing' },
  ],
  listing: [
    { key: 'new',         label: 'New Part' },
    { key: 'used',        label: 'Used Part' },
    { key: 'car',         label: 'Car' },
    { key: 'accessories', label: 'Accessories' },
    { key: 'other',       label: 'Other' },
  ],
  want: [
    { key: 'part',  label: 'Part' },
    { key: 'car',   label: 'Car' },
    { key: 'other', label: 'Other' },
  ],
  spot: [
    { key: 'show',    label: 'Show' },
    { key: 'museum',  label: 'Museum' },
    { key: 'wild',    label: 'In the wild' },
  ],
};

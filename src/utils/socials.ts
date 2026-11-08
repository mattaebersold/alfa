import type { ProfileSocials } from '../types/api';

export type SocialKey = keyof ProfileSocials;

/**
 * The networks a member can list, in display order. Handles are stored, not
 * URLs — horacio's helpers/profileSocials reduces a pasted URL to its handle —
 * so this is the one place each network's URL scheme lives.
 */
export const SOCIALS: {
  key: SocialKey;
  label: string;
  placeholder: string;
  url: (value: string) => string;
}[] = [
  { key: 'instagram', label: 'Instagram', placeholder: '@yourhandle', url: (h) => `https://instagram.com/${h}` },
  { key: 'facebook',  label: 'Facebook',  placeholder: 'yourpage', url: (h) => `https://facebook.com/${h}` },
  { key: 'youtube',   label: 'YouTube',   placeholder: '@yourchannel', url: (h) => `https://youtube.com/@${h}` },
  // Stored as a full URL already — the server normalises it on save.
  { key: 'website',   label: 'Website',   placeholder: 'yoursite.com', url: (u) => u },
];

/** The set entries, in display order, with their links built. */
export function socialLinks(socials?: ProfileSocials) {
  return SOCIALS
    .map((s) => ({ ...s, value: socials?.[s.key]?.trim() ?? '' }))
    .filter((s) => s.value && (s.key !== 'website' || /^https?:\/\//i.test(s.value)))
    .map((s) => ({ key: s.key, label: s.label, value: s.value, href: s.url(s.value) }));
}

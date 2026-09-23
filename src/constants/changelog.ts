/**
 * What changed, per version — the copy behind the menu's "What's new" button.
 *
 * Data rather than JSX so shipping a version's notes is one edit here: add a
 * key for the version, group the lines, done. Keyed by the exact string in
 * app.json's `version` field (what `npm run bump` writes, and what
 * APP_VERSION reads back), so a release with nothing written up simply has no
 * entry and the button doesn't render — better than a panel that opens on a
 * stale list from two versions ago.
 *
 * Written for a member, not for the commit log: what they can now do, in their
 * words. Keep the lines short — this is read standing up, on a phone.
 */

export interface ChangelogGroup {
  /** Section heading — "Events", "Groups". Short enough not to wrap. */
  title: string;
  items: string[];
}

export interface ChangelogEntry {
  /** Month and year, as it reads on the web changelog — "September 2026". */
  date: string;
  groups: ChangelogGroup[];
}

export const CHANGELOG: Record<string, ChangelogEntry> = {
  '1.47': {
    date: 'September 2026',
    groups: [
      {
        title: 'Photography',
        items: [
          'Adding photos while pinning a spot works again.',
          'Pins are bigger and easier to spot on the map.',
          'Anyone can add their own photos to a spot, with a credit on each one.',
          'See spots as a list instead of the map, from the switch beside the title.',
          'Filter spots to near you, with a radius, or by region — the same filter events use.',
          'Say what kind of place a spot is again, from a shorter list, and filter by it.',
          'On iOS the map opens on where you are.',
        ],
      },
      {
        title: 'Events',
        items: [
          'Event posters show whole, at their own proportions, with the title beneath.',
        ],
      },
      {
        title: 'Marketplace',
        items: [
          'Listings are a two-column grid of cards.',
        ],
      },
      {
        title: 'Getting Around',
        items: [
          'The header menus open with a smoother animation.',
        ],
      },
    ],
  },
  '1.46': {
    date: 'September 2026',
    groups: [
      {
        title: 'Posts',
        items: [
          'Add a poll to a post and let people vote on the options.',
          'The tagging section of the post form is cleaner — search for people, cars and events, with your garage cars ready to tap.',
        ],
      },
      {
        title: 'Routes',
        items: [
          'Create a route without recording it live: mark where you started and finished, then tap the roads you took to pull the route through them.',
        ],
      },
      {
        title: 'Events',
        items: [
          'Event images show at their real proportions instead of being cropped.',
        ],
      },
      {
        title: 'Photography',
        items: [
          'Edit or remove your own spots from the spot summary.',
          'Pins show who pinned the spot at a sensible size.',
          'More fixes in the photography section.',
        ],
      },
    ],
  },
  '1.45': {
    date: 'September 2026',
    groups: [
      {
        title: 'Messages & Comments',
        items: [
          'Writing a message or a comment opens a proper composer above the keyboard — no more keyboard covering what you type.',
          'You can add images to messages, the same as comments.',
        ],
      },
      {
        title: 'Photography',
        items: [
          'The map opens on where you are.',
          'Hold anywhere on the map to pin a photo spot there.',
          'Pinning a spot asks for less — a name, where it is, a note and photos.',
        ],
      },
      {
        title: 'Getting Around',
        items: [
          'The menu and your garage open from their header buttons the way notifications do, and your garage has a fresh look.',
          'No more terms checkbox when logging in — that belongs to signing up.',
        ],
      },
      {
        title: 'Garage & Cars',
        items: [
          'Car cards take their shape from the photo, without the coloured edge and glow.',
        ],
      },
      {
        title: 'Fixes',
        items: [
          'Assorted fixes and improvements.',
        ],
      },
    ],
  },
  '1.44': {
    date: 'September 2026',
    groups: [
      {
        title: 'Marketplace',
        items: [
          'Your existing marketplace posts have been moved over to the new listings.',
        ],
      },
      {
        title: 'Lists',
        items: [
          'Pro members can build lists of members.',
          'Pro members can build lists of cars.',
        ],
      },
      {
        title: 'Groups',
        items: [
          'Group posts are in chronological order.',
          'Preview the members who ask to join your group before you decide.',
        ],
      },
      {
        title: 'Feed & Posts',
        items: [
          'Videos open full screen when you play them, with a close button in the corner.',
        ],
      },
      {
        title: 'Profiles & Members',
        items: [
          'Everyone on the Members screen is listed chronologically.',
          'Behind-the-scenes updates to member records for internal requests.',
        ],
      },
    ],
  },
  '1.43': {
    date: 'September 2026',
    groups: [
      {
        title: 'Marketplace',
        items: [
          'Marketplace listings have been rebuilt from the ground up.',
        ],
      },
      {
        title: 'Custom Alerts',
        items: [
          'Set up custom alerts and hear about it when something you care about shows up — a particular make and model listed for sale, say.',
          'Custom Alerts has its own spot in the menu.',
        ],
      },
      {
        title: 'Getting Around',
        items: [
          'Routes and Marketplace swapped places in the footer menu.',
        ],
      },
    ],
  },
  '1.42': {
    date: 'September 2026',
    groups: [
      {
        title: 'Sign-in',
        items: [
          'Sign in or create an account with Apple or Google.',
        ],
      },
      {
        title: 'Events',
        items: [
          'Events now have regions, and you can filter by region — starting with Near Me, a 100-mile radius around your zip code.',
          'Multi-day events are supported.',
          'Cleaner, more readable cards in Upcoming Events.',
          'The 30-day category filter only lists categories that actually have events.',
          'Refreshed ORS Rally cards.',
        ],
      },
      {
        title: 'Regions & Near Me',
        items: [
          'The events on your home feed start with Near Me.',
          'The Cars and Members screens have the same region and radius filters.',
          'You can edit your zip code.',
          'Cars and members in the listings show a small regional map.',
          "If you're new and not following anyone yet, your first feed is members in your region.",
        ],
      },
      {
        title: 'Garage & Cars',
        items: [
          'Adding a car is a much simpler, cleaner form.',
          'Make and model now come from a full database, so there is no more free text in those fields.',
          "Can't find your car? There's a link in the make and model picker to email us.",
          'You can add photos to mods while creating a car — and mods added there actually save now.',
          "Archive a car to take it out of your feed and your co-owner's.",
          'Transfer a car to another member — handy if you sell it to someone on the app.',
          'A garage with a single car shows it full width on your profile.',
          'Adding a car from "finish setting up your profile" opens the form right there instead of closing the menu.',
        ],
      },
      {
        title: 'Groups',
        items: [
          'Tidier group listing page.',
          "Tapping a group you haven't joined lets you request to join and see who's already in it.",
          'Message a group admin from the group preview.',
          'Preview group members from the summary without leaving for their profile.',
          'Turned down for a group? You get a notification and a way to message the admin.',
          'Creating a group offers regional choices and a custom type, and you can send a batch of invites as you go.',
          'Group filters now include type and region.',
          'Fixed upvoting and downvoting on group posts.',
          'Fixed the length of the member list in the group preview.',
        ],
      },
      {
        title: 'Routes',
        items: [
          'Routes can tag cars, members, events, and groups.',
          'Fixed a problem that stopped you deleting your own route.',
        ],
      },
      {
        title: 'Feed & Posts',
        items: [
          'Videos pause when they scroll out of view, and playback is fixed on post cards outside the home feed.',
          'Posts with several photos show pagination dots.',
          'The create post button moved to the bottom of the form, so you can see every option before posting.',
          'Cleaner layout for suggested members and cars on the home screen.',
          'Featured members and cars are shuffled, so the row changes.',
          'On your own posts, tapping the heart opens the list of who liked it rather than liking it yourself.',
          'The likes list shows usernames only.',
          'Comment counts update as soon as you add or delete a comment, and deleting one closes the comment panel.',
          'Fixed a gallery close button that was hidden on some devices.',
        ],
      },
      {
        title: 'Profiles & Members',
        items: [
          'No banner image? You can upload one straight from your profile.',
          'Searching members or cars opens a quick preview instead of taking you off the screen.',
        ],
      },
      {
        title: 'Notifications',
        items: [
          'Fixed being notified twice when someone mentions you in a comment.',
          'The notifications panel has a cleaner layout and a quicker animation.',
          'Restyled notification settings.',
        ],
      },
      {
        title: 'Pro & Membership',
        items: [
          'Basic members can create up to 3 events a month.',
          "A usage section on your dashboard shows what you've created and your monthly limits.",
          'The Discord is called out as a Pro perk.',
          'Restyled the Pro panel.',
        ],
      },
      {
        title: 'Getting Around',
        items: [
          'A back button sits to the left of the logo on every screen — tapping it also scrolls the content back to the top.',
          'Headings and buttons sit more consistently across the main screens.',
          'Close buttons moved outside the content of a panel.',
          'Dashboard & Settings is easier to find in the menu.',
          'The logo and the add button catch an oil-slick sheen.',
          'Nudged the new post button at the bottom of the screen.',
          'This "What\'s new" panel, at the foot of the menu.',
        ],
      },
    ],
  },
};

/** The notes for a version, or null when that version has none written up. */
export function changelogFor(version: string): ChangelogEntry | null {
  return CHANGELOG[version] ?? null;
}

/**
 * The oldest version the panel reaches back to.
 *
 * The panel shows the running version's notes first and every version since
 * this one after, so someone who skipped a few updates — or simply never
 * opened the panel — still reads what changed. Earlier than this the app
 * was a different thing, and the list would be history rather than news.
 */
export const EARLIEST_SHOWN = '1.42';

/** "1.47" → 147, for ordering. Versions here are always major.minor. */
const ordinal = (version: string) => {
  const [major, minor] = version.split('.').map(Number);
  return (major || 0) * 1000 + (minor || 0);
};

/**
 * Every written-up version older than `version` and no older than
 * EARLIEST_SHOWN, newest first — the panel's "Earlier" section.
 */
export function changelogBefore(version: string): { version: string; entry: ChangelogEntry }[] {
  const current = ordinal(version);
  const floor = ordinal(EARLIEST_SHOWN);
  return Object.keys(CHANGELOG)
    .filter((v) => ordinal(v) < current && ordinal(v) >= floor)
    .sort((a, b) => ordinal(b) - ordinal(a))
    .map((v) => ({ version: v, entry: CHANGELOG[v] }));
}

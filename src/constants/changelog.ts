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
  '1.44': {
    date: 'September 2026',
    groups: [
      {
        title: 'Marketplace',
        items: [
          'Marketplace listings have been rebuilt from the ground up.',
          'Your existing marketplace posts have been moved over to the new listings.',
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
        title: 'Lists',
        items: [
          'Pro members can build lists of members.',
          'Pro members can build lists of cars.',
        ],
      },
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
          'Group posts are in chronological order.',
          'Preview the members who ask to join your group before you decide.',
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
          'Videos open full screen when you play them, with a close button in the corner.',
        ],
      },
      {
        title: 'Profiles & Members',
        items: [
          'No banner image? You can upload one straight from your profile.',
          'Searching members or cars opens a quick preview instead of taking you off the screen.',
          'Everyone on the Members screen is listed chronologically.',
          'Behind-the-scenes updates to member records for internal requests.',
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
          'Routes and Marketplace swapped places in the footer menu.',
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

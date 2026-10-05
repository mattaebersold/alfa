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
  '1.63': {
    date: 'October 2026',
    groups: [
      {
        title: 'Home feed',
        items: [
          'A new look for tagged groups, cars and events on feed cards.',
          'Swapped the comment and bookmark icons on feed cards.',
          'A follow button on the car cards in the feed.',
          'Better styling for shared Car Spotter results.',
          'Better styling for poll results on posts with a poll.',
        ],
      },
      {
        title: 'Posting',
        items: [
          'Creating a post starts with the camera, then you choose what it becomes: a post, a poll, or a marketplace listing.',
          'A cleaner marketplace listing form.',
          'Improvements to tagging people, cars and events, with pictures in the suggestions.',
          'Photos and videos are prepared on your phone as you pick them — faster previews and faster posting.',
        ],
      },
      {
        title: 'Comments',
        items: [
          'A cleaner comments panel.',
          'Like individual comments.',
          'Photo galleries in comments are now a carousel.',
        ],
      },
      {
        title: 'Groups',
        items: [
          'Reorganized and improved the group pages.',
          'ORS Rallys can be associated with groups.',
          'Fixed the post-to-group form not being visible.',
          'Fixed the group post form sliding out of view when the keyboard opened.',
        ],
      },
      {
        title: 'Shop & Concierge',
        items: [
          'Products open in the app, with checkout built in.',
          'Concierge services in the menu, with a page of what we offer.',
        ],
      },
      {
        title: 'Notifications',
        items: [
          'A faster notifications panel.',
          'Unread notifications on their own tab, with the ones you have read under Archived.',
        ],
      },
      {
        title: 'General',
        items: [
          'Small UI fixes and updates throughout.',
        ],
      },
    ],
  },
  '1.61': {
    date: 'September 2026',
    groups: [
      {
        title: 'Home',
        items: [
          'Added Cars and Members as home tab options.',
        ],
      },
      {
        title: 'Cars',
        items: [
          'Updated the styles of the car cards on the car, make and model pages.',
          'Rearranged the layout of the Cars screen.',
          'Added an Add Car button to the header of the Cars screen.',
          'A cleaner featured cars section.',
          'Makes and models that match cars in your garage are filtered to the top.',
        ],
      },
      {
        title: 'Makes & Models',
        items: [
          'A richer layout for make and model pages.',
          'Request a description for a model — an admin approves or declines it.',
          'Added a Groups tab to model pages.',
        ],
      },
      {
        title: 'Members',
        items: [
          'A cleaner featured members section.',
        ],
      },
      {
        title: 'Groups',
        items: [
          'Groups can be associated with multiple makes and models.',
        ],
      },
    ],
  },
  '1.60': {
    date: 'September 2026',
    groups: [
      {
        title: 'Getting Around',
        items: [
          'Updated the footer navigation to clean things up and remove duplicate items.',
          'Added a tab bar to the home view to easily move between the main sections.',
          'Re-organized the layout of the buttons in the footer of the menu.',
          'The logo button in the header now takes you to the feed tab.',
        ],
      },
      {
        title: 'Home Feed',
        items: [
          'Restyled the post cards on the home page.',
          'Updated the styles of the car and mod cards on the home page.',
          'Added the ability to bookmark posts.',
        ],
      },
      {
        title: 'Posting',
        items: [
          'Restyled the post creation forms.',
        ],
      },
      {
        title: 'Photography',
        items: [
          'Updated the layout and functionality of the photography section.',
          'Added nearby places when you drop a custom photography pin.',
        ],
      },
      {
        title: 'Marketplace',
        items: [
          'Restyled the marketplace listings.',
          'Better styling for the marketplace listing detail window.',
        ],
      },
      {
        title: 'Groups',
        items: [
          'Updated the style of group cards.',
        ],
      },
      {
        title: 'Events',
        items: [
          'Cleaned up the upcoming events cards.',
          'Capped the event dots on a calendar day at three, with a count for the rest.',
          'Small updates to the layout of the events screen.',
        ],
      },
      {
        title: 'Videos',
        items: [
          'Added a feed of ORS videos to the menu.',
        ],
      },
      {
        title: 'Look & Feel',
        items: [
          'Better search and filtering for content across the app.',
          'Updated the app\'s font.',
          'Small color fixes on the main screens.',
        ],
      },
    ],
  },
  '1.51': {
    date: 'September 2026',
    groups: [
      {
        title: 'Fixes',
        items: [
          'Fixed an issue where you couldn\'t select a make or model in the car creation screen.',
          'Fixed an issue where notification settings would drift.',
          'Improved the reliability of video uploading.',
        ],
      },
    ],
  },
  '1.50': {
    date: 'September 2026',
    groups: [
      {
        title: 'Profiles',
        items: [
          'A cleaner layout on profiles, with a darker look throughout.',
          'Profiles show a member\'s photography pins, and their marketplace and diecast listings.',
          'Help prompts on your own profile if you\'re missing a photo, a bio or a car, or aren\'t following anyone yet.',
          'Ask a member with no profile photo to add one.',
        ],
      },
      {
        title: 'Cars',
        items: [
          'Updated car cards and car pages.',
          'Help prompts on your own car if it\'s missing a photo, specs or mods — add them right there.',
          'Ask the owner of a car with no photos to add some; they get a notification.',
          'A mod posted without a photo no longer shows the car\'s photo in its card.',
          'Mileage shows properly, or TMU when it isn\'t known.',
          'The brands page shows a few of each brand\'s cars and how many models are on the site.',
        ],
      },
      {
        title: 'Members',
        items: [
          'A refreshed members list.',
          'Tap a featured member or featured car for a quick preview.',
        ],
      },
      {
        title: 'Events',
        items: [
          'See upcoming events on a map.',
        ],
      },
      {
        title: 'Brands & Models',
        items: [
          'Brand pages have a new look, with model cards that show more at a glance.',
          'A better layout for the grid of cars on a brand\'s page.',
          'Tap a model on a brand\'s page for a page of its own.',
          'Bookmark a model\'s page to get back to it quickly — your bookmarked models are in the menu.',
          'Discussion and resources sections on every model\'s page.',
          'Cars can now have a generation and trim, and each brand\'s models are tidied up to match.',
          'An updated and corrected list of car makes, models and trims.',
        ],
      },
      {
        title: 'Getting Around',
        items: [
          'Small tweaks to how the header menus look and open.',
        ],
      },
      {
        title: 'Fixes',
        items: [
          'Text fields are no longer hidden behind the keyboard.',
          'Porsche no longer appears twice in the list of makes.',
          'Tidied up the car make and model list.',
        ],
      },
    ],
  },
  '1.49': {
    date: 'September 2026',
    groups: [
      {
        title: 'Photography',
        items: [
          'Search an address above the map to pin a spot there, as well as holding the map.',
          'Holding the map asks whether you mean that exact spot or a place nearby — a park, a garage — and names the pin after it.',
          'One pin per place: pinning somewhere already pinned opens that spot so you can add your photos to it.',
          'Pins are a black teardrop with the face of whoever pinned it.',
          'The spot summary is tidier, with bigger photos — tap one to see it full-screen.',
          'Everyone who added photos to a spot shows in a row of faces; tap it for the list.',
          'Tap the name on a spot to see who pinned it.',
          'Only the member who pinned a spot can edit or remove it, from the cog beside their name.',
          'Tag photo spots in a post the way you tag people and cars, and make a new pin from there.',
        ],
      },
      {
        title: 'Getting Around',
        items: [
          'Photography has a bigger tile in the menu, with photos from recent pins.',
        ],
      },
    ],
  },
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

/**
 * "1.47" → 1047, for ordering. Versions here are always major.minor, and the
 * minor is a whole number — as Apple compares them, so 1.60 follows 1.51 and a
 * "1.6" would come before it (Apple turned 1.6 and 1.7 away as older builds).
 */
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

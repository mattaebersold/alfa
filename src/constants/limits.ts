/**
 * What a basic membership includes, and where Pro starts.
 *
 * Here rather than inside a screen because the same number has to be told to
 * the member in two places — the garage list and the create form — and two
 * copies of it drift the moment one is changed.
 *
 * Note this is a *presentation* limit today: the API does not enforce it, so it
 * shapes what the app offers rather than what the account can hold.
 */
export const CAR_LIMIT_BASIC = 5;

/**
 * Posts a basic member may publish per calendar month.
 *
 * Unlike the car limit, this one is real: horacio refuses the post. Keep it in
 * step with `helpers/limits.js` there — the app draws the meter, the server
 * decides.
 */
export const POST_LIMIT_BASIC = 20;

/**
 * Events a basic member may create per calendar month. Enforced by horacio
 * exactly like posts, and resets on the same 1st of the month.
 */
export const EVENT_LIMIT_BASIC = 3;

/**
 * Marketplace listings a basic member may post per calendar month. Counted and
 * reset exactly like posts and events, by horacio.
 *
 * Diecast listings are outside this count — they're Pro-only outright, so
 * there's no allowance of them to spend.
 */
export const LISTING_LIMIT_BASIC = 5;

/**
 * The two ways a basic membership stops short of a marketplace listing, worded
 * once: the browse screen's create button, the category chips in the create
 * form and the server's own refusal all put the same words on screen.
 */
export const LISTING_LIMIT_UPSELL = {
  title: 'Monthly listings used up',
  message: `A basic membership posts ${LISTING_LIMIT_BASIC} marketplace listings a month, and you've used all of them. Your allowance comes back on the 1st — or go Pro for unlimited listings.`,
};

export const DIECAST_UPSELL = {
  title: 'Diecast is Pro only',
  message: 'Listing diecast models is a Pro feature. Go Pro to list your collection — browsing the diecast marketplace stays open to everyone, and diecast listings never count against a monthly allowance.',
};

/**
 * Custom alerts a member may keep — a standing count, not a monthly one.
 *
 * An alert isn't spent when it fires, so this is "how many rules can be
 * watching at once", which is the car limit's shape rather than the post
 * limit's. The server's `/api/alerts/meta` reports the real pair; these are
 * the fallbacks for a build talking to a server that hasn't shipped it yet.
 */
export const ALERT_LIMIT_BASIC = 1;
export const ALERT_LIMIT_PRO = 20;

/**
 * Out of alerts, worded once — the dashboard row, the list's add button and
 * the server's own `alert_limit_reached` all say this.
 *
 * Deliberately not "comes back on the 1st": nothing resets. The way to have a
 * second alert is to delete the first one or go Pro, and saying so is kinder
 * than implying a wait.
 */
export const ALERT_LIMIT_UPSELL = {
  title: 'Alerts used up',
  message: `A basic membership keeps ${ALERT_LIMIT_BASIC} custom alert running. Pro keeps ${ALERT_LIMIT_PRO} — one per car you're hunting parts for, one per model you're watching the market for. Delete the one you have to swap it, or go Pro and stop choosing.`,
};

/**
 * Lists are Pro outright — there's no allowance of them to run out of, which is
 * diecast's shape rather than the listing limit's.
 *
 * Worded once: the profile's and the car page's "New list" buttons, the create
 * form opened by a link, and the server's own `pro_required` all put these
 * words on screen. It says what a list *is*, because "User lists" on its own
 * sells nothing, and it says that reading them is free, because a basic member
 * meets this card while looking at someone else's.
 *
 * A lapsed Pro keeps the lists they made and can still edit them; only making
 * a new one comes here.
 */
export const LIST_UPSELL = {
  title: 'Lists are a Pro feature',
  message: "Your top five car designers. The roads you'd drive again. The five mods you want done by next year — pinned to the car they're for. Go Pro to make lists of your own, each entry with a photo, a note and a link. Reading everyone else's stays open to all.",
};

/** How many cars this member may keep. Pro is unlimited. */
export function carLimitFor(isPro: boolean): number | null {
  return isPro ? null : CAR_LIMIT_BASIC;
}

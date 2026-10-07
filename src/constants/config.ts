import { Platform } from 'react-native';
import { FONT_INTER } from '@ors/kit/src/theme/fonts';
export const CONFIG = {
  API_BASE_URL: 'https://factory.openroadsociety.co',
  S3_BASE_URL: 'https://partstash-ghia-images.s3.us-west-2.amazonaws.com',
  RECAPTCHA_SITE_KEY: '6Le2gDssAAAAAEEsB35y_2yMMs3BWOIRFL9lnrOo',
  NOTIFICATION_POLL_INTERVAL: 30_000,
  MESSAGE_POLL_INTERVAL: 30_000,
  // An open thread is a conversation in progress, so it refreshes far more
  // eagerly than the inbox badge that just needs to be roughly current.
  THREAD_POLL_INTERVAL: 8_000,
  USER_REFRESH_INTERVAL: 900_000,
  DEFAULT_PAGE_LIMIT: 12,

  /**
   * Google sign-in client ids.
   *
   * Not secrets — a client id is public by definition, it's in the page source
   * of every web app that uses one and in the binary of every native app. What
   * protects the account is the signing certificate (Android) and the bundle id
   * (iOS) that Google checks the request against.
   *
   * `GOOGLE_WEB_CLIENT_ID` is the same client horacio verifies tokens against
   * (`GOOGLE_CLIENT_ID` there) and the same one murray's web sign-in uses. It
   * sets the `aud` claim of the ID token, which is why a *web* id belongs in a
   * native app — and why these two values must never drift apart.
   *
   * `GOOGLE_IOS_CLIENT_ID` identifies the iOS app to Google. Android needs an
   * OAuth client too, but it is matched by package name and SHA-1 rather than
   * named here.
   *
   * The iOS id also appears reversed as `iosUrlScheme` on the google-signin
   * plugin in app.json — Google redirects back into the app through that
   * scheme, so changing one means changing the other.
   */
  GOOGLE_WEB_CLIENT_ID: '102801063030-8au92n7v1vhssgd8bbdabqi3ilrdf4l0.apps.googleusercontent.com',
  GOOGLE_IOS_CLIENT_ID: '102801063030-muebpoen038tgise15bm7t4crbe2o9kl.apps.googleusercontent.com',
} as const;

export const imageUrl = (filename: string | null | undefined): string | null => {
  if (!filename) return null;
  if (filename.startsWith('http')) return filename;
  return `${CONFIG.S3_BASE_URL}/${filename}`;
};

// ─── Layout ──────────────────────────────────────────────────────────────────

/**
 * The app's standard horizontal gap between items.
 *
 * Wider on Android, where the screen's edge sits closer to the content —
 * no rounded corners to inset it the way an iPhone's do — and the iOS
 * figure read as cramped against the side.
 */
export const GUTTER = Platform.OS === 'android' ? 14 : 6;

/**
 * The app's corner radius.
 *
 * Buttons and cards had drifted across a dozen values — 8, 10, 12, 14, 16, 20
 * and a lot of 999 pills — often two of them side by side in the same row,
 * which is the kind of thing you feel before you can name it. One number now,
 * imported rather than typed, so the next component can't invent a thirteenth.
 *
 * This is for rectangles with softened corners. Things that are *meant* to be
 * round — avatars, circular icon buttons, the odd chip — keep their own radius;
 * they're not a rectangle with a corner, they're a circle, and half their own
 * height is the only value that works.
 */
export const COMMON_RADIUS = 20;

/**
 * A fully rounded end, for a shape whose height decides its curve.
 *
 * Use it where the pill *is* the design — a circular avatar ring, a dot badge —
 * not merely to soften a button.
 */
export const PILL_RADIUS = 999;

// ─── Inputs ──────────────────────────────────────────────────────────────────

/** The text inside a form field — one size and face for every input. */
export const INPUT_FONT_SIZE = 16;
export const INPUT_FONT_FAMILY = FONT_INTER.regular;
/**
 * Line spacing for a multiline field. Not for a single-line one: on iOS a
 * lineHeight there pushes the text off-centre in the box.
 */
export const INPUT_LINE_HEIGHT = 22;

/** Spread into a field's style: `[styles.input, INPUT_TEXT]`. */
export const INPUT_TEXT = { fontSize: INPUT_FONT_SIZE, fontFamily: INPUT_FONT_FAMILY } as const;

// ─── Colors ──────────────────────────────────────────────────────────────────
//
// Every colour in the app, defined once. Change a value here and it changes
// everywhere. Kept as hex so a tint can append an alpha pair (`COLOR_X + '22'`).
//
// tailwind.config.js keeps its own copy for NativeWind classes — keep the two
// in step when you change a brand colour.

/* Core — the app's own colours; reach for these first. */
export const COLOR_WHITE      = '#FFFFFF';
export const COLOR_BLACK      = '#000000';
export const COLOR_PRIMARY    = '#36B2E2'; // the accent blue
export const COLOR_SECONDARY  = '#DDD8D6'; // the light-mode secondary surface
export const COLOR_CREAM      = '#F5EFED'; // the light-mode page background
export const COLOR_LOGO_CREAM = '#F7F1D9'; // the wordmark in the nav drawer
export const COLOR_CYAN       = '#08DEE3'; // the primary button's fill
export const COLOR_PRO        = '#CDA96F'; // Pro gold
export const COLOR_PRO_DARK   = '#C4A05C';
export const COLOR_GOLD       = '#C1911B';
export const COLOR_ON_GOLD    = '#14110B'; // text sitting on a gold fill
export const COLOR_TANGERINE  = '#FA7921';
export const COLOR_GREEN      = '#85C27D';
export const COLOR_RED        = '#EC4632';
export const COLOR_GUARDS_RED = '#D00000';
export const COLOR_TEAL       = '#01777A';
export const COLOR_SLATE      = '#2F3A4C'; // a surface, not a text colour
export const COLOR_LINK_BLUE  = '#6FC3EC'; // a link on a dark ground
export const COLOR_BORDER     = '#FFFFFF40';

/**
 * Grays — numbered by brightness: the number is each RGB channel, from 0
 * (black) to 255 (white).
 * `COLOR_GRAY_22` is `#161616`.
 */
export const COLOR_GRAY_244 = '#F4F4F4';
export const COLOR_GRAY_240 = '#F0F0F0';
export const COLOR_GRAY_236 = '#ECECEC';
export const COLOR_GRAY_224 = '#E0E0E0';
export const COLOR_GRAY_214 = '#D6D6D6';
export const COLOR_GRAY_211 = '#D3D3D3';
export const COLOR_GRAY_208 = '#D0D0D0';
export const COLOR_GRAY_187 = '#BBBBBB';
export const COLOR_GRAY_184 = '#B8B8B8';
export const COLOR_GRAY_180 = '#B4B4B4';
export const COLOR_GRAY_170 = '#AAAAAA';
export const COLOR_GRAY_160 = '#A0A0A0';
export const COLOR_GRAY_141 = '#8D8D8D';
export const COLOR_GRAY_138 = '#8A8A8A';
export const COLOR_GRAY_136 = '#888888';
export const COLOR_GRAY_102 = '#666666';
export const COLOR_GRAY_96  = '#606060';
export const COLOR_GRAY_90  = '#5A5A5A';
export const COLOR_GRAY_85  = '#555555';
export const COLOR_GRAY_79  = '#4F4F4F';
export const COLOR_GRAY_74  = '#4A4A4A';
export const COLOR_GRAY_64  = '#404040';
export const COLOR_GRAY_60  = '#3C3C3C';
export const COLOR_GRAY_58  = '#3A3A3A';
export const COLOR_GRAY_46  = '#2E2E2E';
export const COLOR_GRAY_42  = '#2A2A2A';
export const COLOR_GRAY_40  = '#282828';
export const COLOR_GRAY_38  = '#262626';
export const COLOR_GRAY_34  = '#222222';
export const COLOR_GRAY_32  = '#202020';
export const COLOR_GRAY_31  = '#1F1F1F';
export const COLOR_GRAY_30  = '#1E1E1E';
export const COLOR_GRAY_29  = '#1D1D1D';
export const COLOR_GRAY_26  = '#1A1A1A';
export const COLOR_GRAY_25  = '#191919';
export const COLOR_GRAY_23  = '#171717';
export const COLOR_GRAY_22  = '#161616';
export const COLOR_GRAY_20  = '#141414';
export const COLOR_GRAY_18  = '#121212';
export const COLOR_GRAY_17  = '#111111';
export const COLOR_GRAY_14  = '#0E0E0E';
export const COLOR_GRAY_13  = '#0D0D0D';
export const COLOR_GRAY_11  = '#0B0B0B';
export const COLOR_GRAY_10  = '#0A0A0A';

/* Status */
export const COLOR_DANGER           = '#EF4444'; // recording dot, destructive fills
export const COLOR_PURE_RED         = '#FF0000'; // destructive button, critical tasks
export const COLOR_ERROR_BG         = '#FEE2E2'; // the error box behind a form message
export const COLOR_ERROR_TEXT_LIGHT = '#FFB4A8'; // a field error on a dark ground
export const COLOR_ERROR_TEXT_DARK  = '#7A1508'; // an error on a gold ground
export const COLOR_SUCCESS          = '#4CAF50';
export const COLOR_LIKE             = '#FF4060'; // a liked heart
export const COLOR_STORY_RING       = '#22C55E'; // an unseen story
export const COLOR_FOREST           = '#3A8A3A';
export const COLOR_SPOTTER_GREEN    = '#2FA84F'; // Car Spotter's green
export const COLOR_LISTING_GREEN    = '#00C851';
export const COLOR_MEMBER_BLUE      = '#2F6FED'; // the MEMBER badge

/* Dashboard — the muted tones on the dashboard rows. */
export const COLOR_MUTED_ORANGE = '#E07B39'; // flagged
export const COLOR_MUTED_GREEN  = '#3A8A5C';
export const COLOR_MUTED_BLUE   = '#5B7FA6';
export const COLOR_MUTED_PURPLE = '#7A6ABF';
export const COLOR_MUTED_RED    = '#C25F5F';

/* Routes */
export const COLOR_ROUTE_START  = '#2E9E4F';
export const COLOR_ROUTE_FINISH = '#E23B3B';

/* Post type badges */
export const COLOR_BADGE_LISTING = '#00FF3F';
export const COLOR_BADGE_WANT    = '#F1184C';
export const COLOR_BADGE_GARAGE  = '#FF479C';
export const COLOR_BADGE_EVENT   = '#FFFB38';
/** Group news — a muted amber; the event yellow was too loud for a notice. */
export const COLOR_BADGE_NEWS    = '#E2B347';
export const COLOR_BADGE_GROUP   = '#F89CFA';
export const COLOR_BADGE_RECORD  = '#35B5FF';
export const COLOR_BADGE_DEFAULT = '#F0D689';
export const COLOR_BADGE_SPOT    = '#F36943';
export const COLOR_BADGE_UPDATE  = '#2E9599';

/* Category badges — the softer pastels for the secondary category badge. */
export const COLOR_CATEGORY_SHOW        = '#B39DFF';
export const COLOR_CATEGORY_MISC        = '#CFD3D6';
export const COLOR_CATEGORY_MOD         = '#7FD4FF';
export const COLOR_CATEGORY_RESTORATION = '#FFB59B';
export const COLOR_CATEGORY_MAINTENANCE = '#8FD9DC';
export const COLOR_CATEGORY_DETAILING   = '#8FE6D8';
export const COLOR_CATEGORY_NEW         = '#7CFF9E';
export const COLOR_CATEGORY_USED        = '#F6E4AE';
export const COLOR_CATEGORY_ACCESSORIES = '#FBC8FC';
export const COLOR_CATEGORY_CAR         = '#FFFD9E';
export const COLOR_CATEGORY_PART        = '#9FDCFF';
export const COLOR_CATEGORY_MUSEUM      = '#E6C860';
export const COLOR_CATEGORY_WILD        = '#B6DFA0';

/* Group categories — group resource/discussion categories, and the hues unknown ones cycle through. */
export const COLOR_HUE_ORCHID     = '#B57EDC';
export const COLOR_HUE_RASPBERRY  = '#D65C7A';
export const COLOR_HUE_STEEL      = '#7A8798';
export const COLOR_HUE_SEAFOAM    = '#5CB8A8';
export const COLOR_HUE_CORNFLOWER = '#5C8FD6';
export const COLOR_HUE_CLAY       = '#D67A5C';
export const COLOR_HUE_ROSE       = '#C05C8E';
export const COLOR_HUE_LAVENDER   = '#9A8FD6';

/* Group tabs — the icon colours on a group page's tabs. */
export const COLOR_GROUP_TAB_POSTS      = '#4A90D9';
export const COLOR_GROUP_TAB_DISCUSSION = '#7B68EE';
export const COLOR_GROUP_TAB_NEWS       = '#E67E22';
export const COLOR_GROUP_TAB_MEMBERS    = '#2ECC71';
export const COLOR_GROUP_TAB_CARS       = '#E74C3C';
export const COLOR_GROUP_TAB_EVENTS     = '#F39C12';
export const COLOR_GROUP_TAB_ROUTES     = '#E056A0';
export const COLOR_GROUP_TAB_MARKET     = '#1ABC9C';
export const COLOR_GROUP_TAB_RESOURCES  = '#95A5A6';

/* Events */
export const COLOR_EVENT_CARS_AND_COFFEE    = '#C6F24E';
export const COLOR_EVENT_SHOW               = '#FF6FA5';
export const COLOR_EVENT_TECH_SESSION       = '#FFB020';
export const COLOR_EVENT_MOTORSPORTS        = '#FF5C39';
export const COLOR_EVENT_MISC               = '#B8C0C8';
export const COLOR_ORS_EVENT_GRADIENT_START = '#1E8E4E';
export const COLOR_ORS_EVENT_GRADIENT_END   = '#6B3FA0';

/* Alerts — the parts of an alert sentence. */
export const COLOR_ALERT_ACTION    = '#7FD1F7';
export const COLOR_ALERT_PRICE     = '#00E070';
export const COLOR_ALERT_CONDITION = '#F5A623';
export const COLOR_ALERT_PLACE     = '#E9D26A';
export const COLOR_ALERT_KEYWORD   = '#C6A0F6';

/* Marketplace */
export const COLOR_DIECAST_BLUE      = '#284682';
export const COLOR_DIECAST_BLUE_DARK = '#1A2F5A';
export const COLOR_SOURCE_APP_ACCENT = '#E0B252';

/* Avatars — fallback avatar backgrounds, picked per member. */
export const COLOR_AVATAR_BRICK      = '#8E3B46';
export const COLOR_AVATAR_RUST       = '#A64B2A';
export const COLOR_AVATAR_SADDLE     = '#9C6644';
export const COLOR_AVATAR_OCHRE      = '#8A6B1F';
export const COLOR_AVATAR_OLIVE      = '#5B7B3A';
export const COLOR_AVATAR_PINE       = '#2E6B4F';
export const COLOR_AVATAR_TEAL       = '#1F6F6B';
export const COLOR_AVATAR_SLATE_BLUE = '#2B5F7E';
export const COLOR_AVATAR_INDIGO     = '#3F4E8C';
export const COLOR_AVATAR_VIOLET     = '#5D4A8C';
export const COLOR_AVATAR_PLUM       = '#7A3E77';
export const COLOR_AVATAR_MAGENTA    = '#A03A63';
export const COLOR_AVATAR_UMBER      = '#7A4A3A';
export const COLOR_AVATAR_STEEL      = '#4A5A6B';

/* Oil sheen — the iridescent gradient stops in OilSheen. */
export const COLOR_SHEEN_MAGENTA       = '#FF4FD8';
export const COLOR_SHEEN_YELLOW        = '#FFD24F';
export const COLOR_SHEEN_MINT          = '#4FFFA1';
export const COLOR_SHEEN_SKY           = '#4FC3FF';
export const COLOR_SHEEN_VIOLET        = '#9B5CFF';
export const COLOR_SHEEN_CRIMSON       = '#E84A5F';
export const COLOR_SHEEN_PEACH         = '#FFB8A0';
export const COLOR_SHEEN_ORANGE        = '#FF9A3C';
export const COLOR_SHEEN_BUTTER        = '#FFE9A8';
export const COLOR_SHEEN_LIME          = '#B8D64A';
export const COLOR_SHEEN_COPPER        = '#C8702E';
export const COLOR_SHEEN_PINK          = '#FF5E87';
export const COLOR_SHEEN_GOLD          = '#F7D774';
export const COLOR_SHEEN_PALE_BLUE     = '#BBD5FF';
export const COLOR_SHEEN_PALE_PINK     = '#FFD0EE';
export const COLOR_SHEEN_PALE_YELLOW   = '#FFF0C2';
export const COLOR_SHEEN_PALE_MINT     = '#C6F2E2';
export const COLOR_SHEEN_PALE_LAVENDER = '#D8CCFF';

/* Google — Google's logo colours for the sign-in glyph; brand-fixed, so don't retheme. */
export const COLOR_GOOGLE_BLUE   = '#4285F4';
export const COLOR_GOOGLE_RED    = '#EA4335';
export const COLOR_GOOGLE_YELLOW = '#FBBC05';
export const COLOR_GOOGLE_GREEN  = '#34A853';

// ─── Membership limits ───────────────────────────────────────────────────────

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

export const ROUTE_UPSELL = {
  title: 'Routes are a Pro feature',
  message: "Record a drive as you go, or plot one you've already done, and share it with members and your groups. Go Pro to make routes of your own — browsing and driving everyone else's stays open to all.",
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

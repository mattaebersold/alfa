// Core API response types matching Horacio's data models

/** One of the buttons a member puts under their bio. */
export interface ProfileLink {
  title: string;
  url: string;
}

export interface User {
  _id?: string;
  user_id: string;
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  bio?: string;
  /**
   * Member-authored links, rendered as buttons under the bio. Ordered — the
   * array order is the display order — and rewritten wholesale on save.
   */
  links?: ProfileLink[];
  cityState?: string;
  /**
   * Only ever on your own profile — no listing returns another member's. It's
   * what their city, region, map tile and "near me" point are derived from.
   */
  zip?: number | null;
  /**
   * A rendered map of the general region this member is in, stored once on the
   * server. Their zip is never exposed — see horacio's userRegionMap.
   */
  regionMap?: { filename?: string } | null;
  profilePicture?: string;
  /**
   * The ground this member's initials sit on when they have no photo. Absent on
   * accounts created before the field existed — Avatar derives the same colour
   * from user_id in that case. See utils/avatarColor.
   */
  avatarColor?: string;
  gallery?: GalleryItem[];
  banners?: GalleryItem[];
  accountType?: 'admin' | 'pro' | 'basic';
  /**
   * They've asked to be told when Pro opens. Set once and never cleared, so the
   * upsell can stop offering a button they've already pressed.
   */
  proInterest?: boolean;
  standing?: string;
  displayMode?: 'light' | 'dark';
  followersCount?: number;
  followingCount?: number;
  emailSettings?: EmailSettings;
  feedPreferences?: FeedPreferences;
  allowEmail?: boolean;
  memberNumber?: number;
  created_at?: string;
  userToken?: string;
  /** Per-type push/email preferences — see NotificationSettings. */
  notificationSettings?: NotificationSettings;
  /**
   * The user_id of the member whose invite brought them in. Only on your own
   * profile; the home feed's suggestions put that member and their cars first.
   */
  invited_by?: string | null;
}

export type HideMode = 'none' | 'temporary' | 'permanent';

/** The steps of "Finish setting up your profile". Mirrors horacio's SETUP_PROMPTS. */
export type SetupPrompt = 'photo' | 'bio' | 'car' | 'post';

/** Per-user dismissals of the home feed's promotional modules. */
export interface FeedPreferences {
  /** Both suggestion rows at once — what builds before per-row hiding wrote. */
  hideSuggestions?: HideMode;
  /** Set only for a temporary hide; the rows return once it passes. */
  hideSuggestionsUntil?: string | null;
  hideSuggestedMembers?: HideMode;
  hideSuggestedMembersUntil?: string | null;
  hideSuggestedCars?: HideMode;
  hideSuggestedCarsUntil?: string | null;
  /** Steps of the menu's profile setup card this member has dismissed. */
  dismissedSetupPrompts?: SetupPrompt[];
  /** banner_id of the last home feature banner this user closed. */
  dismissedHomeBannerId?: string | null;
}

/** The single admin-managed home feature banner. */
export interface HomeBanner {
  banner_id: string;
  image: string;
  /**
   * A key from BANNER_DESTINATIONS (src/constants/bannerDestinations.ts), or
   * BANNER_EXTERNAL_URL for a web address. Null on banners saved before
   * destinations existed — those fall back to `url`.
   */
  destination?: string | null;
  /** Record id, for the destinations that point at one specific thing. */
  destination_id?: string | null;
  /** Only meaningful when `destination` is the external-URL sentinel. */
  url?: string | null;
  active?: boolean;
  updated_at?: string;
}

export interface EmailSettings {
  userComments?: boolean;
  userLikes?: boolean;
  followerActivity?: boolean;
  userFollowed?: boolean;
  mentions?: boolean;
}

/**
 * One piece of a post's media — a photo or a video.
 *
 * Photos and videos share this list so a post can carry both, in the order the
 * author arranged them. `type` is optional because entries written before video
 * lived here don't have it; absent means photo. Read this through
 * `utils/postMedia`, which resolves the order and the legacy shapes rather than
 * leaving every screen to guess.
 */
export interface GalleryItem {
  filename?: string;
  _id?: string;
  internal_id?: string;
  /** Absent on entries predating mixed media — treat as 'image'. */
  type?: 'image' | 'video';
  /** Position in the post's media, authored order. */
  index?: number;
  /** Mux playback id. Null until the asset finishes encoding. */
  video_id?: string | null;
  /** Mux direct-upload id, kept so the playback id can be matched back to it. */
  upload_id?: string;
  status?: 'processing' | 'ready' | 'failed';
}

export interface ListItem {
  internal_id: string;
  title: string;
  description?: string;
  gallery?: GalleryItem[];
  deleted?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface List {
  _id?: string;
  internal_id: string;
  title: string;
  body?: string;
  category?: string;
  private?: boolean;
  gallery?: GalleryItem[];
  items?: ListItem[];
  item_count?: number;
  user_id: string;
  user?: User;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GarageCar {
  _id?: string;
  internal_id: string;
  user_id: string;
  title?: string;
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  make_handle?: string;
  model_handle?: string;
  color?: string;
  engine?: string;
  horsepower?: string;
  torque?: string;
  mileage?: string;
  vin?: string;
  condition?: string;
  type?: string;
  category?: string;
  body?: string;
  gallery?: GalleryItem[];
  profile_image?: string;
  featured?: boolean;
  private?: boolean;
  created_at?: string;
  updated_at?: string;
  coowner_id?: string;
  group_id?: string;
  /**
   * The region the car's owner is in, attached by the listing — a car has no
   * location of its own. Feeds the little map on a car card.
   */
  owner_region?: string;
  /**
   * Put away rather than deleted: off every listing, restorable from the
   * dashboard. A car offered to someone is archived at the same time, so
   * "pending transfer" is `archived` plus a `transfer_to_id`.
   */
  archived?: boolean;
  archived_at?: string;
  transfer_to_id?: string;
  transfer_from_id?: string;
  transfer_requested_at?: string;
  // populated
  user?: User;
  coowner?: User;
  /**
   * Engagement on the car itself, batched by the endpoints that list cars.
   * The same document the car's own page counts, so a like in the feed shows
   * on the car and the other way round.
   */
  like_count?: number;
  isLiked?: boolean;
  comment_count?: number;
}

/**
 * Something added to a car — a mod or a gallery — carrying the car it belongs
 * to. What the feed shows for cars you follow.
 */
export interface CarActivityItem {
  kind: 'mod' | 'gallery';
  internal_id: string;
  /**
   * The stored type — "mod" or "cargallery" — which is what likes and comments
   * are keyed by. Distinct from `kind`, which is this endpoint's own shorthand
   * for the client; keying interactions off `kind` would file a gallery's
   * likes against a document nothing else refers to.
   */
  entry_type?: string;
  title?: string | null;
  body?: string | null;
  type?: string | null;
  gallery?: GalleryItem[];
  created_at?: string;
  car: GarageCar;
  /** Batched by the endpoint — see horacio's getFollowedCarActivity. */
  like_count?: number;
  isLiked?: boolean;
  comment_count?: number;
}

export interface DiecastAnalysis {
  isModelCar: boolean;
  brand?: string;
  make?: string;
  model?: string;
  series?: string;
  year?: number;
  condition?: string;
  rarity?: string;
  in_packaging?: boolean;
  is_limited_edition?: boolean;
  estimatedValueLow?: number;
  estimatedValueHigh?: number;
  suggestedTitle?: string;
  suggestedDescription?: string;
  aiNotes?: string;
  ebayAvgPrice?: number;
  ebayListingCount?: number;
  ebayQuery?: string;
}

export interface Post {
  _id?: string;
  internal_id: string;
  user_id: string;
  entry_type?: string;
  type?: string;
  category?: string;
  title?: string;
  body?: string;
  gallery?: GalleryItem[];
  video_id?: string;
  price?: string;
  sold?: boolean;
  car_id?: string;
  event_id?: string;
  /** Legacy single group. `group_ids` is what the create form writes now. */
  group_id?: string;
  group_ids?: string[];
  /** A group post that was pushed to the public feed as well. */
  also_public?: boolean;
  make?: string;
  model?: string;
  year?: string;
  condition?: string;
  /** Odometer reading, as typed. Shown on the post detail as an odometer. */
  mileage?: string;
  // The rest of the optional details a post can carry. The create form has
  // always sent these; the type only ever declared some of them, which is part
  // of why the edit form quietly dropped them.
  trim?: string;
  vin?: string;
  part_number?: string;
  // diecast listing fields
  diecast_brand?: string;
  diecast_rarity?: string;
  in_packaging?: boolean;
  is_limited_edition?: boolean;
  ai_notes?: string;
  estimated_value_low?: number;
  estimated_value_high?: number;
  featured?: boolean;
  created_at?: string;
  updated_at?: string;
  // populated
  user?: User;
  user_objectid?: User;
  // snake_case from feed/list endpoints
  like_count?: number;
  comment_count?: number;
  // camelCase aliases (some endpoints may use these)
  likeCount?: number;
  commentCount?: number;
  isLiked?: boolean;
  /**
   * Like state batched by the feed endpoint, so cards don't each fetch it.
   *
   * `likers` is capped — enough for the "liked by" line, not the full list —
   * which is why `isLiked` is sent separately rather than inferred from it.
   * `liker_names` maps the ids that line prints to their usernames.
   */
  likers?: string[];
  liker_names?: Record<string, string>;
  /** Who and what is tagged in this post — batched by the feed endpoint. */
  tags?: Tag[];
  // stories
  seen?: boolean;
}

export interface StoryGroup {
  userId: string;
  user: User;
  stories: Post[];
  allSeen: boolean;
}

export interface Event {
  _id?: string;
  internal_id: string;
  user_id: string;
  title?: string;
  body?: string;
  gallery?: GalleryItem[];
  event_date?: string;
  event_time?: string;
  location?: string;
  location_lat?: number;
  location_lng?: number;
  type?: string;
  category?: string;
  featured?: boolean;
  created_at?: string;
  user?: User;
}

/**
 * Society event — the rebuilt model. When it happens is a schedule, not a date
 * column, so `occurrence_date` is what the server computed for a given day and
 * `next_occurrence` is the soonest one still ahead.
 */
export interface SocietyEvent {
  _id?: string;
  internal_id: string;
  user_id: string;
  entry_type?: string;
  title?: string;
  body?: string;
  gallery?: GalleryItem[];
  category?: string;

  frequency?: 'single' | 'weekly' | 'biweekly' | 'monthly' | 'annually';
  date?: string;
  /** Single events only: the last day of a multi-day event, inclusive. */
  end_date?: string | null;
  weekdays?: number[];
  week_ordinals?: number[];
  day_of_month?: number;
  anchor_date?: string;
  until_date?: string;
  exceptions?: string[];
  start_time?: string;
  end_time?: string;

  /** Set on expanded rows: the date this particular occurrence falls on. */
  occurrence_date?: string;
  /** "YYYY-MM-DD" for the occurrence. */
  day?: string;
  next_occurrence?: string | null;
  /** Human-readable schedule, e.g. "Every other Sunday". */
  schedule_label?: string;

  location?: string;
  location_url?: string;
  location_lat?: number;
  location_lng?: number;
  location_place_id?: string;
  /** Typed "City, ST", used to place an event whose address wasn't picked. */
  location_city_state?: string;
  /** Resolved by the server from the place — never typed. */
  location_zip?: string;
  location_state?: string;
  /** Key from constants/regions; what the Location filter matches on. */
  region?: string;

  group_id?: string;
  event_organizer?: string;
  /** Officially run or backed by ORS — earns the "ORS Event" badge. */
  ors_sponsored?: boolean;
  interested_count?: number;
  is_interested?: boolean;
  /** A few profiles for the avatar stack on cards. */
  interested_preview?: User[];
  created_at?: string;
  user?: User;
}

export interface Group {
  _id?: string;
  internal_id: string;
  user_id: string;
  title?: string;
  body?: string;
  subtitle?: string;
  gallery?: GalleryItem[];
  banners?: GalleryItem[];
  region?: string;
  type?: string;
  category?: string;
  created_at?: string;
  membership?: { member_type: 'basic' | 'admin'; status: string };
  member_count?: number;
  /** Hidden from the public list — members join by invitation. */
  private?: boolean;
}

export interface GroupMember {
  _id?: string;
  user_id: string;
  group_id: string;
  member_type: 'basic' | 'admin';
  status: 'active' | 'pending' | 'invited' | 'declined';
  created_at?: string;
  declined_at?: string;
  user?: User;
}

export interface Article {
  _id?: string;
  internal_id: string;
  user_id: string;
  title?: string;
  body?: string;
  gallery?: GalleryItem[];
  banners?: GalleryItem[];
  type?: string;
  category?: string;
  car_id?: string;
  created_at?: string;
  user?: User;
}

/** One day of a rally's itinerary. */
/**
 * A post from one of your groups, as the home feed sees it.
 *
 * Three collections flattened into one shape by the server — `kind` is the only
 * thing that says which, and it decides both the card's label and which section
 * of the group "view more" opens.
 */
export interface GroupActivityItem {
  internal_id: string;
  kind: 'discussion' | 'news' | 'resource';
  group_id: string;
  user_id: string;
  title?: string;
  body?: string;
  category?: string;
  url?: string;
  gallery?: GalleryItem[];
  upvotes?: number;
  downvotes?: number;
  created_at?: string;
  user?: {
    user_id: string;
    username?: string;
    profile?: string[];
    gallery?: GalleryItem[];
    accountType?: string;
  } | null;
  group?: { internal_id: string; title?: string; gallery?: GalleryItem[] } | null;
}

/**
 * One row in an address field's suggestion list.
 *
 * `primary` and `secondary` arrive already split — the venue name and the
 * address under it — rather than as one string to re-split on a comma, which
 * gets it wrong for any place whose name contains one.
 */
export interface PlacePrediction {
  place_id: string;
  primary: string;
  secondary: string | null;
  description: string;
}

/** A chosen prediction, resolved to somewhere a pin can go. */
export interface PlaceDetail {
  place_id: string;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

/**
 * A place worth photographing a car, pinned to the map.
 *
 * The coordinate is the point of it — a spot is "this corner of this parking
 * structure", which no address says. Everything else hangs off that.
 */
export interface PhotoSpot {
  internal_id: string;
  user_id: string;
  lat: number;
  lng: number;
  title?: string;
  body?: string;
  /** A human name for the place. Descriptive only; the coordinate is identity. */
  location?: string;
  /** What the place is — drives the pin colour. See constants/photoSpots. */
  type?: string | null;
  /** What you'd shoot there. */
  category?: string | null;
  gallery?: GalleryItem[];
  /** Free text, because the useful version of this is always a sentence. */
  access_note?: string;
  best_time?: string;
  private?: boolean;
  created_at?: string;
  updated_at?: string;
  /** Attached by the server — a narrow projection, not the whole user. */
  user?: {
    user_id: string;
    username?: string;
    profile?: string[];
    gallery?: GalleryItem[];
    accountType?: string;
  } | null;
}

/**
 * The events Location filter, as query params. `near_lat`/`near_lng` is the
 * device's position; `near: 'me'` asks the server to use the member's saved
 * zip instead; `region` is a key from constants/regions.
 */
export interface EventLocationParams {
  region?: string;
  near?: 'me';
  near_lat?: number;
  near_lng?: number;
  radius?: number;
}

/** Where a member stands against the pin limit. `limit: null` means unlimited. */
export interface PhotoSpotUsage {
  used: number;
  limit: number | null;
  remaining: number | null;
  reached: boolean;
  isPro: boolean;
}

/**
 * Where a member stands against an allowance that resets on the 1st — posts
 * and events. `limit` and `resets_at` are null for Pro.
 */
export interface MonthlyUsage {
  used: number;
  limit: number | null;
  remaining: number | null;
  reached: boolean;
  resets_at: string | null;
  isPro: boolean;
}

export interface RallyDay {
  title?: string;
  subtitle?: string;
  date?: string | null;
  description?: string;
  /** Mirrors a gallery entry's shape rather than being a bare filename. */
  image?: { filename?: string } | null;
}

export interface RallyFaqItem {
  question: string;
  answer?: string;
}

export interface Rally {
  _id?: string;
  internal_id: string;
  user_id: string;
  title?: string;
  body?: string;
  gallery?: GalleryItem[];
  hero_image?: string;
  /**
   * Route or venue map — one image, shown as its own section. A filename in the
   * images bucket, same as hero_image.
   */
  map_image?: string;
  event_date?: string;
  /**
   * The last day of the run; absent on a one-day rally. `event_dates` holds
   * every day of the span expanded out, which is what the calendars read.
   */
  end_date?: string | null;
  event_dates?: string[];
  event_time?: string;
  location?: string;
  location_url?: string;
  location_lat?: number;
  location_lng?: number;
  location_place_id?: string;
  group_id?: string;
  slots_available?: number;
  attendee_limit?: number;
  /** An Airtable form URL — the rally's registration form. */
  form_id?: string;
  /** The itinerary — one entry per day of the run, in order. */
  days?: RallyDay[];
  /** Admin-authored FAQ, rendered as accordions. Array order is display order. */
  faqs?: RallyFaqItem[];
  /** Populated by the server from `attending_members`. */
  attending_members_data?: User[];
  /**
   * Rally livery, `#rrggbb`. Paints the rally's calendar tile as a gradient.
   * Either may be absent — see rallyColors() in utils/rally.
   */
  primary_color?: string | null;
  secondary_color?: string | null;
  attending_members?: string[];
  type?: string;
  category?: string;
  featured?: boolean;
  created_at?: string;
  user?: User;
}

export interface GroupDiscussionPost {
  _id?: string;
  internal_id: string;
  user_id: string;
  group_id: string;
  title?: string;
  body?: string;
  gallery?: GalleryItem[];
  type?: string;
  category?: string;
  upvotes?: number;
  downvotes?: number;
  /**
   * Who voted and which way, so the thumbs can show *your* vote.
   *
   * Without it the client couldn't tell an unvoted post from one you'd already
   * voted on, and since the server toggles, pressing up twice made the count
   * go down — which read as the feature being broken.
   */
  votes?: { user_id: string; vote_type: 'up' | 'down' }[];
  created_at?: string;
  user?: User;
}

export interface GroupNewsPost {
  _id?: string;
  internal_id: string;
  user_id: string;
  group_id: string;
  title?: string;
  body?: string;
  gallery?: GalleryItem[];
  category?: string;
  url?: string;
  image?: string;
  upvotes?: number;
  downvotes?: number;
  /**
   * Who voted and which way, so the thumbs can show *your* vote.
   *
   * Without it the client couldn't tell an unvoted post from one you'd already
   * voted on, and since the server toggles, pressing up twice made the count
   * go down — which read as the feature being broken.
   */
  votes?: { user_id: string; vote_type: 'up' | 'down' }[];
  created_at?: string;
  user?: User;
}

export interface GroupResource {
  _id?: string;
  internal_id: string;
  user_id: string;
  group_id: string;
  title?: string;
  body?: string;
  gallery?: GalleryItem[];
  type?: string;
  category?: string;
  url?: string;
  upvotes?: number;
  downvotes?: number;
  /** See GroupDiscussionPost.votes. */
  votes?: { user_id: string; vote_type: 'up' | 'down' }[];
  created_at?: string;
  user?: User;
}

export interface CarGalleryAlbum {
  _id?: string;
  internal_id: string;
  car_id: string;
  user_id?: string;
  title?: string;
  body?: string;
  type?: string;
  gallery?: GalleryItem[];
  created_at?: string;
  /** Batched by the car's mods/galleries endpoints — see withEngagement. */
  like_count?: number;
  isLiked?: boolean;
  comment_count?: number;
}

export interface CarTask {
  _id?: string;
  internal_id: string;
  car_id: string;
  user_id?: string;
  title?: string;
  body?: string;
  /** Optional reference — a parts listing, a discussion thread, a how-to. */
  link?: string;
  status?: string;
  completed?: boolean;
  position?: number;
  category?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  created_at?: string;
}

export interface Mod {
  _id?: string;
  internal_id: string;
  car_id: string;
  user_id?: string;
  title?: string;
  body?: string;
  type?: string;
  category?: string;
  gallery?: GalleryItem[];
  status?: string;
  created_at?: string;
  /** Batched by the car's mods/galleries endpoints — see withEngagement. */
  like_count?: number;
  isLiked?: boolean;
  comment_count?: number;
}

export interface Message {
  _id?: string;
  internal_id: string;
  thread_id: string;
  sender_id: string;
  recipient_id: string;
  subject?: string;
  body?: string;
  read?: boolean;
  created_at?: string;
  sender?: User;
  recipient?: User;
}

export interface Notification {
  _id?: string;
  internal_id: string;
  recipient_id: string;
  sender_id?: string;
  type: string;
  content_type?: string;
  content_id?: string;
  message: string;
  read_status?: boolean;
  archived?: boolean;
  createdAt?: string;
  sender?: User;
  /**
   * Free-form payload per notification type. `resolution` is stamped by the
   * server when a request that carried buttons has been settled — every admin
   * holds their own copy of a group join request, so this is how a copy learns
   * that someone else already answered it.
   */
  metadata?: {
    resolution?: 'approved' | 'denied' | 'accepted' | 'declined';
    resolved_by?: string;
    resolved_at?: string;
    /**
     * On `group_join_denied`: the admin who turned the request down, so the
     * row can offer to message them without relying on the populated sender.
     */
    admin_user_id?: string;
    admin_username?: string;
    group_id?: string;
    group_title?: string;
    [key: string]: unknown;
  };
}

export interface Tag {
  _id?: string;
  internal_id: string;
  post_id: string;
  tag_internal_id: string;
  tag_entry_type: 'car' | 'user';
  tagged_user?: User;
  tagged_car?: GarageCar;
}

// ── Driving routes ───────────────────────────────────────────────────────────

/** Derived stats. Computed server-side from the recorded track — see
 *  horacio/helpers/routeGeometry.js. All distances in metres, speeds in m/s. */
export interface RouteStats {
  distance_meters: number;
  duration_ms: number;
  /** Time spent moving; excludes stops. */
  moving_ms: number;
  /** Averaged over moving time, not elapsed. */
  avg_speed: number;
  max_speed: number;
  elevation_gain: number;
  /** Degrees of turning per kilometre. */
  turn_per_km: number;
  /** turn_per_km normalised to 0-100. */
  curviness: number;
  bounds?: { min_lat: number; max_lat: number; min_lng: number; max_lng: number };
  start_point?: { lat: number; lng: number };
  end_point?: { lat: number; lng: number };
  sample_count?: number;
}

/** A place near the driver, offered when naming a pit stop. */
export interface NearbyPlace {
  place_id: string;
  name: string;
  category?: string | null;
  lat?: number;
  lng?: number;
  /** Metres from the driver. */
  distance?: number | null;
}

/** Somewhere worth stopping, dropped while recording. */
export interface RoutePitStop {
  lat: number;
  lng: number;
  t?: number;
  label?: string;
  note?: string;
  place_id?: string;
}

/** One leg of a route's directions: a road, how far along it, how you joined. */
export interface RouteStep {
  road: string;
  meters: number;
  /** 'continue' | 'left' | 'right' | 'slight left' | 'sharp right' | … */
  turn?: string | null;
}

export interface DrivingRoute {
  _id?: string;
  internal_id: string;
  user_id: string;
  entry_type?: 'route';
  title?: string;
  body?: string;
  gallery?: GalleryItem[];
  private?: boolean;

  /** Encoded polyline (precision 5) of the simplified path. */
  polyline?: string;
  /** Speed (m/s) at each polyline point, same length and order. Drives the
   *  red→green speed gradient on traces and maps. */
  speed_profile?: number[];
  stats?: RouteStats;

  /**
   * The named roads this drive followed, resolved once when the route was saved
   * and stored server-side. Reading them costs no map API calls.
   */
  directions?: RouteStep[];
  pit_stops?: RoutePitStop[];
  directions_status?: 'pending' | 'ready' | 'unavailable';

  /** Creator's subjective 1-5 rating, shown next to the computed curviness. */
  technical_rating?: number;
  surface?: 'paved' | 'mixed' | 'dirt';
  start_place?: string;
  end_place?: string;
  car_id?: string;

  /**
   * Groups the route was shared into, the way a post carries them. With groups
   * and `also_public` false it lives only in those groups. On the detail
   * response this also includes groups attached by the older group Tag.
   */
  group_ids?: string[];
  also_public?: boolean;

  /** The score — upvotes minus downvotes — which the "Top" sort orders by. */
  vote_count?: number;
  upvotes?: number;
  downvotes?: number;
  /** The viewer's own vote. Only present when the request was signed in. */
  user_vote?: RouteVote;
  like_count?: number;
  has_liked?: boolean;
  comment_count?: number;

  created_at?: string;
  updated_at?: string;
}

export type RouteVote = 'up' | 'down' | null;

/** What GET /api/routes/:id returns. */
export interface DrivingRouteDetail {
  entry: DrivingRoute;
  user?: User;
  /** The score. */
  vote_count: number;
  upvotes?: number;
  downvotes?: number;
  user_vote?: RouteVote;
  /** Legacy: whether your vote is an upvote. Prefer `user_vote`. */
  has_voted: boolean;
  like_count?: number;
  has_liked?: boolean;
  comment_count?: number;
}

/** What POST /api/routes/upvote and /downvote return. */
export interface RouteVoteResult {
  action: string;
  score: number;
  vote_count: number;
  upvotes: number;
  downvotes: number;
  user_vote: RouteVote;
}

export type RouteSort = 'recent' | 'votes' | 'distance' | 'curviness' | 'duration';

/** Query params accepted by GET /api/routes.
 *  `min_distance`/`max_distance` are in KILOMETRES — the API multiplies by 1000
 *  to compare against `stats.distance_meters`. The UI works in miles, so it
 *  converts before calling. */
export interface RouteListParams {
  page?: number;
  limit?: number;
  sort?: RouteSort;
  user_id?: string;
  scope?: 'protected';
  surface?: string;
  car_id?: string;
  /** Routes shared into this group — powers the group's Routes section. */
  group_id?: string;
  min_distance?: number;
  max_distance?: number;
  min_curviness?: number;
  max_curviness?: number;
  min_technical?: number;
}

// Paginated response envelope
/** One buyable option of a product — a size, a colourway. */
export interface ShopVariant {
  internal_id?: string;
  label: string;
  /** Overrides the product's price when set. Whole currency units, not cents. */
  price?: number;
  quantity?: number;
  sku?: string;
  available?: boolean;
  /** Server-derived, from `available` and the stock count. */
  inStock?: boolean;
}

/**
 * A product in the merch shop.
 *
 * Prices are whole currency units — that's how horacio stores them, to match
 * what the Venmo and PayPal links take in a URL.
 */
export interface ShopProduct {
  _id?: string;
  internal_id: string;
  /** The URL segment; the web shop is reached at /shop/<handle>. */
  handle: string;
  title: string;
  subtitle?: string;
  /** HTML from the web editor — strip before rendering. */
  body?: string;
  price: number;
  currency?: string;
  quantity?: number;
  /** Off for made-to-order items; the count is then ignored. */
  track_quantity?: boolean;
  /** Server-derived across variants and quantity tracking. */
  inStock?: boolean;
  variants?: ShopVariant[];
  gallery?: GalleryItem[];
  category?: string;
  shipping_note?: string;
  /** A draft is admin-only; the public listing returns published ones. */
  status?: 'draft' | 'published';
  featured?: boolean;
  position?: number;
  user_id?: string;
  created_at?: string;
}

export interface PaginatedResponse<T> {
  entries: T[];
  total: number;
  index: number;
  limit: number;
  /**
   * Set when a listing was asked for "near me" and the viewer has no zip to
   * measure from — the list comes back unfiltered and the screen says so.
   */
  near_unavailable?: boolean;
}

// Like info
export interface LikeInfo {
  document_id: string;
  count?: number;
  total?: number;
  liked?: boolean;
  hasLiked?: boolean;
  users?: User[];
}

// Auth response
export interface LoginResponse extends User {
  userToken: string;
}

// Podcast show
export interface Podcast {
  _id?: string;
  internal_id: string;
  title: string;
  short_description?: string;
  description?: string;
  author?: string;
  artwork_filename?: string;
  language?: string;
  categories?: string[];
  explicit?: boolean;
  website?: string;
  status?: string;
  user?: User;
  created_at?: string;
}

// Podcast episode
export interface PodcastEpisode {
  _id?: string;
  internal_id: string;
  podcast_id: string;
  title: string;
  description?: string;
  audio_url: string;
  audio_filename?: string;
  audio_size?: number;
  audio_duration?: number;
  episode_number?: number;
  season_number?: number;
  episode_type?: 'full' | 'trailer' | 'bonus';
  explicit?: boolean;
  published_at?: string;
  status?: string;
  created_at?: string;
}

/**
 * A group you were invited to and turned down.
 *
 * The membership row survives the decline so nobody can invite you again — see
 * horacio's GroupMember.status. This is that row, with its group attached, so
 * the only person allowed to lift it can see it.
 */
export interface DeclinedInvite {
  group_id: string;
  declined_at?: string;
  group: Group;
}

/**
 * What can be reported.
 *
 * Mirrors the keys in horacio's `reportController.MODEL_MAP` — anything not on
 * that map comes back a 400 from a button that looked like it worked.
 */
export type ReportableType =
  | 'post' | 'car' | 'garagecar' | 'comment' | 'user'
  | 'mod' | 'cargallery' | 'event' | 'project'
  | 'groupdiscussion' | 'groupresource';

/**
 * One row of the notification settings table.
 *
 * Served by horacio (helpers/notificationPrefs) rather than duplicated here,
 * so a new notification type appears in both apps without a release. `push`
 * and `email` are the *defaults* — what a member gets before they've saved
 * anything.
 */
export interface NotificationType {
  key: string;
  label: string;
  /** Section heading the row sits under. Absent on an older server. */
  group?: string;
  push: boolean;
  email: boolean;
  /** Account and safety notices, which can't be switched off. */
  locked?: boolean;
}

/** What a member saved: `{ comment: { push: true, email: false }, … }`. */
export type NotificationSettings = Record<string, { push: boolean; email: boolean }>;

/**
 * What a vote call answers with.
 *
 * The counters come back from the server rather than being guessed at by the
 * client, and `user_vote` says which way you now stand so the thumbs can
 * colour themselves without re-deriving it from the votes array.
 */
export interface GroupVoteResult {
  success: boolean;
  action: string;
  upvotes: number;
  downvotes: number;
  user_vote: 'up' | 'down' | null;
}

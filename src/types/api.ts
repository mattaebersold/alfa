// Core API response types matching Horacio's data models

export interface User {
  _id?: string;
  user_id: string;
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  bio?: string;
  cityState?: string;
  profilePicture?: string;
  gallery?: GalleryItem[];
  banners?: GalleryItem[];
  accountType?: 'admin' | 'pro' | 'basic';
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
}

/** Per-user dismissals of the home feed's promotional modules. */
export interface FeedPreferences {
  hideSuggestions?: 'none' | 'temporary' | 'permanent';
  /** Set only for a temporary hide; the rows return once it passes. */
  hideSuggestionsUntil?: string | null;
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

export interface GalleryItem {
  filename: string;
  _id?: string;
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
  // populated
  user?: User;
  coowner?: User;
}

/**
 * Something added to a car — a mod or a gallery — carrying the car it belongs
 * to. What the feed shows for cars you follow.
 */
export interface CarActivityItem {
  kind: 'mod' | 'gallery';
  internal_id: string;
  title?: string | null;
  body?: string | null;
  type?: string | null;
  gallery?: GalleryItem[];
  created_at?: string;
  car: GarageCar;
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
}

export interface GroupMember {
  _id?: string;
  user_id: string;
  group_id: string;
  member_type: 'basic' | 'admin';
  status: 'active' | 'pending' | 'invited';
  created_at?: string;
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

export interface Rally {
  _id?: string;
  internal_id: string;
  user_id: string;
  title?: string;
  body?: string;
  gallery?: GalleryItem[];
  hero_image?: string;
  event_date?: string;
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

export interface GroupForumPost {
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
}

export interface CarTask {
  _id?: string;
  internal_id: string;
  car_id: string;
  user_id?: string;
  title?: string;
  body?: string;
  /** Optional reference — a parts listing, a forum thread, a how-to. */
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
  vote_count?: number;

  created_at?: string;
  updated_at?: string;
}

/** What GET /api/routes/:id returns. */
export interface DrivingRouteDetail {
  entry: DrivingRoute;
  user?: User;
  vote_count: number;
  has_voted: boolean;
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
  /** Routes tagged with this group — powers the group's Routes section. */
  group_id?: string;
  min_distance?: number;
  max_distance?: number;
  min_curviness?: number;
  max_curviness?: number;
  min_technical?: number;
}

// Paginated response envelope
export interface PaginatedResponse<T> {
  entries: T[];
  total: number;
  index: number;
  limit: number;
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

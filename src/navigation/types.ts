import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';

// ── Auth Stack ──────────────────────────────────────────────────────────────
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string; password?: string };
  ForgotPassword: undefined;
  ResetPassword: { token: string };
};

/**
 * Something for the car screen to do on arrival, rather than just show itself.
 *
 * The gallery composer only exists on that screen, so anywhere else offering
 * "add a gallery" has to open the car and ask for the sheet at the same time.
 */
export type CarDetailAction = 'gallery';

// ── Feed Stack ──────────────────────────────────────────────────────────────
export type FeedStackParamList = {
  Feed: undefined;
  PostDetail: { postId: string; edit?: boolean };
  UserDetail: { userId: string; username?: string };
  CarDetail: { carId: string; action?: CarDetailAction };
  // Drawer-linked top-level screens (keep tab bar + AppHeader visible)
  Groups: undefined;
  // `region` preselects a US region filter — see constants/regions.
  Members: { region?: string } | undefined;
  Articles: undefined;
  ArticleDetail: { articleId: string };
  Podcasts: undefined;
  Search: undefined;
  Dashboard: undefined;
  /** `initialTab` opens one of the profile's panes on arrival — 'lists', from the dashboard. */
  Profile: { initialTab?: string } | undefined;
  // Also reachable from the drawer while on the feed tab, so it's registered
  // here as well as in MarketStackParamList.
  Marketplace: undefined;
};

// ── Society Stack ───────────────────────────────────────────────────────────
export type SocietyStackParamList = {
  Events: undefined;
  Rallys: undefined;
  RallyDetail: { rallyId: string };
};

// ── Groups Stack ─────────────────────────────────────────────────────────────
export type GroupsStackParamList = {
  Groups: undefined;
  GroupDetail: { groupId: string };
  GroupDiscussion: { groupId: string };
  GroupNews: { groupId: string };
  GroupCars: { groupId: string };
  GroupMembers: { groupId: string };
  GroupEvents: { groupId: string };
  GroupResources: { groupId: string };
  GroupSettings: { groupId: string };
};

// ── Market Stack ─────────────────────────────────────────────────────────────
export type MarketStackParamList = {
  Marketplace: undefined;
};

// ── Cars Stack ───────────────────────────────────────────────────────────────
export type CarsStackParamList = {
  Cars: undefined;
  Garage: undefined;
  CarDetail: { carId: string; action?: CarDetailAction };
  UserDetail: { userId: string; username?: string };
  Brands: undefined;
  BrandDetail: { brand: string };
  ModelDetail: { brand: string; model: string };
};

// ── Routes Stack ─────────────────────────────────────────────────────────────
export type RoutesStackParamList = {
  Routes: undefined;
  RouteDetail: { routeId: string };
  UserDetail: { userId: string; username?: string };
};

// ── Main Tab ─────────────────────────────────────────────────────────────────
export type MainTabParamList = {
  FeedTab: NavigatorScreenParams<FeedStackParamList> | undefined;
  SocietyTab: NavigatorScreenParams<SocietyStackParamList> | undefined;
  MarketTab: NavigatorScreenParams<MarketStackParamList> | undefined;
  GroupsTab: NavigatorScreenParams<GroupsStackParamList> | undefined;
  CarsTab: NavigatorScreenParams<CarsStackParamList> | undefined;
  /** The photo spot map. A real destination, unlike SearchTab below. */
  PhotographyTab: undefined;
  /**
   * A button, not a destination — its press opens the search overlay and is
   * prevented before it can navigate. Declared so the tab is typed like its
   * neighbours; nothing should ever navigate to it.
   */
  SearchTab: undefined;
};

// ── App Stack (top-level, wraps tabs + modals) ───────────────────────────────
export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  // Modals / full-screen flows
  CarCreate: { step?: number; carId?: string };
  ModCreate: { carId: string; carTitle?: string };
  CarTasks: { carId: string; carTitle?: string };
  Notifications: undefined;
  Messages: undefined;
  MessageThread: { threadId: string; recipientId?: string; subject?: string };
  ComposeMessage: { userId?: string; username?: string; initialBody?: string; subject?: string };
  UserDetail: { userId: string; username?: string };
  Settings: undefined;
  NotificationSettings: undefined;
  /**
   * The custom alerts a member has standing — reached from the dashboard.
   *
   * Its own screen rather than a dashboard sheet: an alert is something you
   * come back to and edit, and editing one opens a second form, which a sheet
   * over a sheet handles badly.
   */
  Alerts: undefined;
  /** With an id it edits that alert; without, it builds a new one. */
  AlertCreate: { alertId?: string } | undefined;
  Articles: undefined;
  ArticleDetail: { articleId: string };
  Marketplace: undefined;
  /**
   * One listing, as its summary panel over whatever you were looking at.
   *
   * A route rather than only a piece of state on the marketplace screen,
   * because a notification or a deep link has to be able to open a listing
   * from anywhere — see utils/notificationTarget. Presented transparently: the
   * screen draws SummaryModal, which runs its own animation.
   */
  ListingDetailModal: { listingId: string };
  /** With an id it edits that listing; without, it creates one of `kind`. */
  /**
   * The listing form. `groupId` pre-picks that group on the "Where to post"
   * step — what the plus inside a group's Market section means.
   */
  ListingCreate: {
    listingId?: string;
    kind?: import('../types/api').ListingKind;
    groupId?: string;
  } | undefined;
  /**
   * Marketplace conversations — a self-contained inbox, not the main one.
   *
   * Reachable from the marketplace and the dashboard only: a conversation
   * about a listing never appears in Messages, and its unread count never
   * touches that badge (see horacio's models/MarketplaceThread).
   *
   * With no params it's everything; `listingId` narrows it to one listing
   * ("who's interested in this?") and `role` to one side of the market.
   */
  MarketplaceMessages: {
    listingId?: string;
    listingTitle?: string;
    role?: import('../types/api').MarketplaceRoleFilter;
  } | undefined;
  /**
   * One marketplace conversation.
   *
   * Exactly one of the two ids: `threadId` opens an existing conversation,
   * `listingId` alone opens the composer for a new one about that listing —
   * the server returns the existing thread if there already is one, so the
   * "get in touch" button doesn't have to look first.
   */
  MarketplaceThread:
    | { threadId: string; listingId?: string; listingTitle?: string; initialBody?: string }
    | { listingId: string; threadId?: undefined; listingTitle?: string; initialBody?: string };
  Shop: undefined;
  /**
   * Pinning a spot. The map itself is a tab (`PhotographyTab`), but creating is
   * a modal over it, the way every other create flow in the app works.
   */
  /**
   * With a point when the member held the map to drop a pin there; without
   * one the screen starts from wherever they're standing.
   */
  PhotoSpotCreate: { lat: number; lng: number } | undefined;
  /** Admin-only. With an id it edits that product, without it creates one. */
  ProductCreate: { productId?: string } | undefined;
  About: undefined;
  Support: undefined;
  SocietyEventDetail: { eventId: string; occurrenceDate?: string };
  SocietyEventCreate: { eventId?: string } | undefined;
  Search: undefined;
  /**
   * A car passed in arrives already tagged — that's how "new post" from a car's
   * own card knows what the post is about.
   */
  Create: { carId?: string; carTitle?: string } | undefined;
  DiecastCreate: undefined;
  // Routes — recording is a full-screen flow, so it lives outside the tabs.
  /**
   * The routes list.
   *
   * It had a tab until the marketplace took that lane; it's reached from the
   * menu now, so it needs a home on the app stack rather than inside a tab
   * nobody can press.
   */
  Routes: undefined;
  RouteRecord: undefined;
  /**
   * Saves a finished drive (`draftId`), or edits a saved route (`routeId`) —
   * one form for both, as the post form is. Exactly one of the two is given.
   */
  RouteSave: { draftId: string; routeId?: undefined } | { routeId: string; draftId?: undefined };
  RouteDetailModal: { routeId: string };
  ProjectDetail: { projectId: string };
  // Shared detail screens (accessible from any stack context)
  CarDetail: { carId: string; action?: CarDetailAction };
  CarDetailModal: { carId: string; action?: CarDetailAction };
  PostDetailModal: { postId: string; edit?: boolean };
  EventDetailModal: { eventId: string };
  RallyDetailModal: { rallyId: string };
  // Stories
  CreateStory: undefined;
  StoryDetails: { videoUri: string; thumbnailUri: string };
  StoryViewer: { groups: import('../types/api').StoryGroup[]; startGroupIndex: number };
  // Podcasts
  Podcasts: undefined;
  PodcastDetail: { podcastId: string };
  // Lists
  ListDetail: { listId: string };
  /**
   * `carId` opens the form already attached to that garage car — "add a list"
   * on a car's page. The form can still change or clear it.
   */
  CreateList: { carId?: string } | undefined;
  EditList: { listId: string };
  // Events
  EventCreate: undefined;
  // More menu
  More: undefined;
  // Group detail + sub-screens (tab bar hides here — acceptable for detail views)
  GroupDetailModal: { groupId: string };
  GroupDetail: { groupId: string };
  GroupSection: { groupId: string; groupTitle: string; initialTab: string };
  GroupDiscussion: { groupId: string };
  GroupNews: { groupId: string };
  GroupCars: { groupId: string };
  GroupMembers: { groupId: string };
  GroupEvents: { groupId: string };
  GroupResources: { groupId: string };
  GroupSettings: { groupId: string };
};

// Helper type aliases
export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type FeedScreenProps<T extends keyof FeedStackParamList> =
  NativeStackScreenProps<FeedStackParamList, T>;

export type CarsScreenProps<T extends keyof CarsStackParamList> =
  NativeStackScreenProps<CarsStackParamList, T>;

export type SocietyScreenProps<T extends keyof SocietyStackParamList> =
  NativeStackScreenProps<SocietyStackParamList, T>;

export type GroupsScreenProps<T extends keyof GroupsStackParamList> =
  NativeStackScreenProps<GroupsStackParamList, T>;

export type MarketScreenProps<T extends keyof MarketStackParamList> =
  NativeStackScreenProps<MarketStackParamList, T>;

export type RoutesScreenProps<T extends keyof RoutesStackParamList> =
  NativeStackScreenProps<RoutesStackParamList, T>;

export type AppScreenProps<T extends keyof AppStackParamList> =
  NativeStackScreenProps<AppStackParamList, T>;

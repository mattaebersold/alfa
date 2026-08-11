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

// ── Feed Stack ──────────────────────────────────────────────────────────────
export type FeedStackParamList = {
  Feed: undefined;
  PostDetail: { postId: string; edit?: boolean };
  UserDetail: { userId: string; username?: string };
  CarDetail: { carId: string };
  // Drawer-linked top-level screens (keep tab bar + AppHeader visible)
  Groups: undefined;
  Members: undefined;
  Articles: undefined;
  ArticleDetail: { articleId: string };
  Podcasts: undefined;
  Search: undefined;
  Dashboard: undefined;
  Profile: undefined;
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
  GroupForum: { groupId: string };
  GroupNews: { groupId: string };
  GroupCars: { groupId: string };
  GroupMembers: { groupId: string };
  GroupEvents: { groupId: string };
  GroupMarketplace: { groupId: string };
  GroupResources: { groupId: string };
  GroupSettings: { groupId: string };
};

// ── Market Stack ─────────────────────────────────────────────────────────────
export type MarketStackParamList = {
  Marketplace: undefined;
  ListingDetail: { postId: string };
};

// ── Cars Stack ───────────────────────────────────────────────────────────────
export type CarsStackParamList = {
  Cars: undefined;
  Garage: undefined;
  CarDetail: { carId: string };
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
  RoutesTab: NavigatorScreenParams<RoutesStackParamList> | undefined;
  GroupsTab: NavigatorScreenParams<GroupsStackParamList> | undefined;
  CarsTab: NavigatorScreenParams<CarsStackParamList> | undefined;
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
  Articles: undefined;
  ArticleDetail: { articleId: string };
  Marketplace: undefined;
  Shop: undefined;
  About: undefined;
  SocietyEventDetail: { eventId: string; occurrenceDate?: string };
  SocietyEventCreate: { eventId?: string } | undefined;
  Search: undefined;
  Create: undefined;
  DiecastCreate: undefined;
  // Routes — recording is a full-screen flow, so it lives outside the tabs.
  RouteRecord: undefined;
  RouteSave: { draftId: string };
  RouteDetailModal: { routeId: string };
  ProjectDetail: { projectId: string };
  // Shared detail screens (accessible from any stack context)
  CarDetail: { carId: string };
  CarDetailModal: { carId: string };
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
  CreateList: undefined;
  EditList: { listId: string };
  // Events
  EventCreate: undefined;
  // More menu
  More: undefined;
  // Group detail + sub-screens (tab bar hides here — acceptable for detail views)
  GroupDetailModal: { groupId: string };
  GroupDetail: { groupId: string };
  GroupSection: { groupId: string; groupTitle: string; initialTab: string };
  GroupForum: { groupId: string };
  GroupNews: { groupId: string };
  GroupCars: { groupId: string };
  GroupMembers: { groupId: string };
  GroupEvents: { groupId: string };
  GroupMarketplace: { groupId: string };
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

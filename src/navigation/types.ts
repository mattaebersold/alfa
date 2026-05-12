import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// ── Auth Stack ──────────────────────────────────────────────────────────────
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
};

// ── Feed Stack ──────────────────────────────────────────────────────────────
export type FeedStackParamList = {
  Feed: undefined;
  PostDetail: { postId: string };
};

// ── Society Stack ───────────────────────────────────────────────────────────
export type SocietyStackParamList = {
  Society: undefined;
  EventDetail: { eventId: string };
  Calendar: undefined;
  Rallys: undefined;
  RallyDetail: { rallyId: string };
  Members: undefined;
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
  CarDetail: { carId: string };
  Brands: undefined;
  BrandDetail: { brand: string };
  ModelDetail: { brand: string; model: string };
};

// ── Main Tab ─────────────────────────────────────────────────────────────────
export type MainTabParamList = {
  FeedTab: undefined;
  SocietyTab: undefined;
  GroupsTab: undefined;
  MarketTab: undefined;
  CarsTab: undefined;
};

// ── App Stack (top-level, wraps tabs + modals) ───────────────────────────────
export type AppStackParamList = {
  MainTabs: undefined;
  // Modals / full-screen flows
  Garage: undefined;
  CarCreate: { step?: number; carId?: string };
  CarTasks: { carId: string; carTitle?: string };
  Notifications: undefined;
  Messages: undefined;
  MessageThread: { threadId: string; recipientId?: string; subject?: string };
  ComposeMessage: { userId?: string; username?: string };
  Profile: undefined;
  UserDetail: { userId: string; username?: string };
  Settings: undefined;
  Articles: undefined;
  ArticleDetail: { articleId: string };
  Search: undefined;
  Create: undefined;
  ProjectDetail: { projectId: string };
  // Shared detail screens (accessible from any stack context)
  CarDetailModal: { carId: string };
  PostDetailModal: { postId: string };
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
  // More menu
  More: undefined;
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

export type AppScreenProps<T extends keyof AppStackParamList> =
  NativeStackScreenProps<AppStackParamList, T>;

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
  allowEmail?: boolean;
  memberNumber?: number;
  created_at?: string;
  userToken?: string;
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
  group_id?: string;
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
  location_lat?: number;
  location_lng?: number;
  group_id?: string;
  slots_available?: number;
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
  status?: string;
  completed?: boolean;
  position?: number;
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

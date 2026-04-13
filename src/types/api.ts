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
  accountType?: 'admin' | 'basic';
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
}

export interface GalleryItem {
  filename: string;
  _id?: string;
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
  // populated
  user?: User;
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
  featured?: boolean;
  created_at?: string;
  updated_at?: string;
  // populated
  user?: User;
  likeCount?: number;
  commentCount?: number;
  isLiked?: boolean;
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
  created_at?: string;
  user?: User;
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
  count: number;
  liked: boolean;
  users?: User[];
}

// Auth response
export interface LoginResponse extends User {
  userToken: string;
}

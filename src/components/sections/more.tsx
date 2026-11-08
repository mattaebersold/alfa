import { Bookmark, Car, Heart, MapPin, UserCheck, Users } from 'lucide-react-native';
import type { SectionSub } from './types';
import MySpotsScreen from './more/MySpotsScreen';
import FollowedCarsScreen from './more/FollowedCarsScreen';
import BookmarkedCarsScreen from './more/BookmarkedCarsScreen';
import BrandBrowseScreen from './more/BrandBrowseScreen';
import { FollowingMembersScreen, FollowerMembersScreen } from './more/MemberFollowsScreen';

/** Photography › My Spots. */
export const PHOTOGRAPHY_SUBS: SectionSub[] = [
  { key: 'mine', label: 'My Spots', Icon: MapPin, Component: MySpotsScreen },
];

/** Cars › Brands, Following, Saved. */
export const CARS_SUBS: SectionSub[] = [
  { key: 'brands',    label: 'Brands',    Icon: Car,      Component: BrandBrowseScreen },
  { key: 'following', label: 'Following', Icon: Heart,    Component: FollowedCarsScreen },
  { key: 'saved',     label: 'Saved',     Icon: Bookmark, Component: BookmarkedCarsScreen },
];

/** Members › Following, Followers. */
export const MEMBERS_SUBS: SectionSub[] = [
  { key: 'following', label: 'Following', Icon: UserCheck, Component: FollowingMembersScreen },
  { key: 'followers', label: 'Followers', Icon: Users,     Component: FollowerMembersScreen },
];

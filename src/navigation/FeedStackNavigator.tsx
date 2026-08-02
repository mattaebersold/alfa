import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { FeedStackParamList } from './types';
import FeedScreen from '../screens/feed/FeedScreen';
import PostDetailScreen from '../screens/feed/PostDetailScreen';
import GroupsScreen from '../screens/groups/GroupsScreen';
import ArticlesScreen from '../screens/articles/ArticlesScreen';
import ArticleDetailScreen from '../screens/articles/ArticleDetailScreen';
import PodcastsScreen from '../screens/podcasts/PodcastsScreen';

import MembersScreen from '../screens/society/MembersScreen';
import PodcastDetailScreen from '../screens/podcasts/PodcastDetailScreen';
import SearchScreen from '../screens/search/SearchScreen';
import DashboardScreen from '../screens/profile/DashboardScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import CarDetailScreen from '../screens/cars/CarDetailScreen';
import MarketplaceScreen from '../screens/marketplace/MarketplaceScreen';
import { colors } from '../constants/colors';

const Stack = createNativeStackNavigator<FeedStackParamList>();

export default function FeedStackNavigator() {
  const headerBg = colors.brgDark;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: headerBg },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
        animation: 'none',
      }}
    >
      <Stack.Screen name="Feed" component={FeedScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: 'Post' }} />
      <Stack.Screen name="Groups" component={GroupsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Members" component={MembersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Articles" component={ArticlesScreen} options={{ headerShown: false }} />
      {/* Sheet-presented — see the matching entry in AppNavigator. */}
      <Stack.Screen
        name="ArticleDetail"
        component={ArticleDetailScreen}
        options={{ headerShown: false, presentation: 'transparentModal', animation: 'none' }}
      />
      <Stack.Screen name="Podcasts" component={PodcastsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="UserDetail" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CarDetail" component={CarDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Marketplace" component={MarketplaceScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

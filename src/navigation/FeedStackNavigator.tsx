import React from 'react';
import { useColorScheme } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { FeedStackParamList } from './types';
import FeedScreen from '../screens/feed/FeedScreen';
import PostDetailScreen from '../screens/feed/PostDetailScreen';
import GroupsScreen from '../screens/groups/GroupsScreen';
import ArticlesScreen from '../screens/articles/ArticlesScreen';
import ArticleDetailScreen from '../screens/articles/ArticleDetailScreen';
import PodcastsScreen from '../screens/podcasts/PodcastsScreen';

import PodcastDetailScreen from '../screens/podcasts/PodcastDetailScreen';
import SearchScreen from '../screens/search/SearchScreen';
import DashboardScreen from '../screens/profile/DashboardScreen';
import UserDetailScreen from '../screens/profile/UserDetailScreen';
import { Colors } from '../constants/colors';

const Stack = createNativeStackNavigator<FeedStackParamList>();

export default function FeedStackNavigator() {
  const isDark = useColorScheme() === 'dark';
  const headerBg = isDark ? Colors.brgDark : Colors.brg;

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
      <Stack.Screen name="Articles" component={ArticlesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ArticleDetail" component={ArticleDetailScreen} options={{ title: 'Article' }} />
      <Stack.Screen name="Podcasts" component={PodcastsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="UserDetail" component={UserDetailScreen} options={{ headerShown: true, title: 'Profile', headerBackTitle: '' }} />
    </Stack.Navigator>
  );
}

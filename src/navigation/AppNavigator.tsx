import React from 'react';
import { useColorScheme } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AppStackParamList } from './types';
import MainTabNavigator from './MainTabNavigator';
import { Colors } from '../constants/colors';

import GarageScreen from '../screens/garage/GarageScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import MessagesScreen from '../screens/messages/MessagesScreen';
import MessageThreadScreen from '../screens/messages/MessageThreadScreen';
import ComposeMessageScreen from '../screens/messages/ComposeMessageScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import UserDetailScreen from '../screens/profile/UserDetailScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import ArticlesScreen from '../screens/articles/ArticlesScreen';
import ArticleDetailScreen from '../screens/articles/ArticleDetailScreen';
import SearchScreen from '../screens/search/SearchScreen';
import CreateScreen from '../screens/create/CreateScreen';
import CreateStoryScreen from '../screens/create/CreateStoryScreen';
import StoryDetailsScreen from '../screens/create/StoryDetailsScreen';
import StoryViewerScreen from '../screens/stories/StoryViewerScreen';
import CarDetailScreen from '../screens/cars/CarDetailScreen';
import PostDetailScreen from '../screens/feed/PostDetailScreen';
import EventDetailScreen from '../screens/society/EventDetailScreen';
import RallyDetailScreen from '../screens/society/RallyDetailScreen';
import CarTasksScreen from '../screens/garage/CarTasksScreen';
import CarCreateScreen from '../screens/garage/CarCreateScreen';
import PodcastsScreen from '../screens/podcasts/PodcastsScreen';
import PodcastDetailScreen from '../screens/podcasts/PodcastDetailScreen';
import MoreScreen from '../screens/MoreScreen';

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppNavigator() {
  const isDark = useColorScheme() === 'dark';
  const headerBg = isDark ? Colors.brgDark : Colors.brg;

  const headerOptions = {
    headerStyle: { backgroundColor: headerBg },
    headerTintColor: '#FFFFFF' as string,
    headerTitleStyle: { fontWeight: '700' as const },
  };

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />

      <Stack.Screen
        name="Garage"
        component={GarageScreen}
        options={{ ...headerOptions, headerShown: true, title: 'My Garage', presentation: 'modal' }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Notifications', presentation: 'modal' }}
      />
      <Stack.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Messages', presentation: 'modal' }}
      />
      <Stack.Screen
        name="MessageThread"
        component={MessageThreadScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Message' }}
      />
      <Stack.Screen
        name="ComposeMessage"
        component={ComposeMessageScreen}
        options={{ ...headerOptions, headerShown: true, title: 'New Message' }}
      />
      <Stack.Screen
        name="Create"
        component={CreateScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Create', presentation: 'modal' }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Profile' }}
      />
      <Stack.Screen
        name="UserDetail"
        component={UserDetailScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Profile' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Settings' }}
      />
      <Stack.Screen
        name="Articles"
        component={ArticlesScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Articles' }}
      />
      <Stack.Screen
        name="ArticleDetail"
        component={ArticleDetailScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Article' }}
      />
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Search' }}
      />
      <Stack.Screen
        name="CarTasks"
        component={CarTasksScreen}
        options={({ route }) => ({
          ...headerOptions,
          headerShown: true,
          title: route.params.carTitle ?? 'Tasks',
        })}
      />
      <Stack.Screen
        name="CarCreate"
        component={CarCreateScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Add Car', presentation: 'modal' }}
      />
      <Stack.Screen
        name="CarDetailModal"
        component={CarDetailScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Car' }}
      />
      <Stack.Screen
        name="PostDetailModal"
        component={PostDetailScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Post' }}
      />
      <Stack.Screen
        name="EventDetailModal"
        component={EventDetailScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Event' }}
      />
      <Stack.Screen
        name="RallyDetailModal"
        component={RallyDetailScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Rally' }}
      />
      <Stack.Screen
        name="CreateStory"
        component={CreateStoryScreen}
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name="StoryDetails"
        component={StoryDetailsScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Story Details' }}
      />
      <Stack.Screen
        name="StoryViewer"
        component={StoryViewerScreen}
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name="Podcasts"
        component={PodcastsScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Podcasts' }}
      />
      <Stack.Screen
        name="PodcastDetail"
        component={PodcastDetailScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Podcast' }}
      />
      <Stack.Screen
        name="More"
        component={MoreScreen}
        options={{ ...headerOptions, headerShown: true, title: 'More' }}
      />
    </Stack.Navigator>
  );
}

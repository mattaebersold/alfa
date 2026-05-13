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
import ArticleDetailScreen from '../screens/articles/ArticleDetailScreen';
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
import PodcastDetailScreen from '../screens/podcasts/PodcastDetailScreen';
import ListDetailScreen from '../screens/lists/ListDetailScreen';
import CreateListScreen from '../screens/lists/CreateListScreen';
import EditListScreen from '../screens/lists/EditListScreen';
import MoreScreen from '../screens/MoreScreen';
// Group detail screens (tab bar hidden — acceptable for detail drill-down)
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';
import GroupForumScreen from '../screens/groups/GroupForumScreen';
import GroupNewsScreen from '../screens/groups/GroupNewsScreen';
import GroupCarsScreen from '../screens/groups/GroupCarsScreen';
import GroupMembersScreen from '../screens/groups/GroupMembersScreen';
import GroupEventsScreen from '../screens/groups/GroupEventsScreen';
import GroupMarketplaceScreen from '../screens/groups/GroupMarketplaceScreen';
import GroupResourcesScreen from '../screens/groups/GroupResourcesScreen';
import GroupSettingsScreen from '../screens/groups/GroupSettingsScreen';

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppNavigator() {
  const isDark = useColorScheme() === 'dark';
  const headerBg = isDark ? Colors.brgDark : Colors.brg;

  const headerOptions = {
    headerStyle: { backgroundColor: headerBg },
    headerTintColor: '#FFFFFF' as string,
    headerTitleStyle: { fontWeight: '700' as const },
    headerBackTitle: '',
  };

  return (
    // animation: 'none' = screens just appear, no slide. Modals override this with their own animation.
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />

      {/* ── Action overlays: slide up from bottom ──────────────────────────── */}
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
        name="Create"
        component={CreateScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Create', presentation: 'modal' }}
      />
      <Stack.Screen
        name="CarCreate"
        component={CarCreateScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Add Car', presentation: 'modal' }}
      />
      <Stack.Screen
        name="CreateList"
        component={CreateListScreen}
        options={{ ...headerOptions, headerShown: true, title: 'New List', presentation: 'modal' }}
      />

      {/* ── Full-screen camera/viewer flows ───────────────────────────────── */}
      <Stack.Screen
        name="CreateStory"
        component={CreateStoryScreen}
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name="StoryViewer"
        component={StoryViewerScreen}
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />

      {/* ── Screens: appear instantly, no slide ───────────────────────────── */}
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
        name="ArticleDetail"
        component={ArticleDetailScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Article' }}
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
        name="CarDetailModal"
        component={CarDetailScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Car' }}
      />
      <Stack.Screen
        name="PostDetailModal"
        component={PostDetailScreen}
        options={{ headerShown: false }}
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
        name="StoryDetails"
        component={StoryDetailsScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Story Details' }}
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
      <Stack.Screen
        name="ListDetail"
        component={ListDetailScreen}
        options={{ ...headerOptions, headerShown: true, title: 'List' }}
      />
      <Stack.Screen
        name="EditList"
        component={EditListScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Edit List' }}
      />
      <Stack.Screen
        name="GroupDetailModal"
        component={GroupDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GroupForum"
        component={GroupForumScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Forum' }}
      />
      <Stack.Screen
        name="GroupNews"
        component={GroupNewsScreen}
        options={{ ...headerOptions, headerShown: true, title: 'News' }}
      />
      <Stack.Screen
        name="GroupCars"
        component={GroupCarsScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Cars' }}
      />
      <Stack.Screen
        name="GroupMembers"
        component={GroupMembersScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Members' }}
      />
      <Stack.Screen
        name="GroupEvents"
        component={GroupEventsScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Events' }}
      />
      <Stack.Screen
        name="GroupMarketplace"
        component={GroupMarketplaceScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Marketplace' }}
      />
      <Stack.Screen
        name="GroupResources"
        component={GroupResourcesScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Resources' }}
      />
      <Stack.Screen
        name="GroupSettings"
        component={GroupSettingsScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Settings' }}
      />
    </Stack.Navigator>
  );
}

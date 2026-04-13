import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AppStackParamList } from './types';
import MainTabNavigator from './MainTabNavigator';
import { Colors } from '../constants/colors';

// Modal / full-screen screens (lazy imports to keep initial bundle smaller)
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
import CarDetailScreen from '../screens/cars/CarDetailScreen';
import PostDetailScreen from '../screens/feed/PostDetailScreen';
import EventDetailScreen from '../screens/society/EventDetailScreen';
import RallyDetailScreen from '../screens/society/RallyDetailScreen';
import CarTasksScreen from '../screens/garage/CarTasksScreen';
import CarCreateScreen from '../screens/garage/CarCreateScreen';

const Stack = createNativeStackNavigator<AppStackParamList>();

const headerOptions = {
  headerStyle: { backgroundColor: Colors.brg },
  headerTintColor: '#FFFFFF' as string,
  headerTitleStyle: { fontWeight: '700' as const },
};

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />

      {/* Modal screens */}
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

      {/* Full-screen navigable screens */}
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
      {/* Shared detail screens — navigable from any context (profile, search, etc.) */}
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
    </Stack.Navigator>
  );
}

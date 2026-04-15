import React from 'react';
import { useColorScheme } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { GroupsStackParamList } from './types';
import GroupsScreen from '../screens/groups/GroupsScreen';
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';
import GroupForumScreen from '../screens/groups/GroupForumScreen';
import GroupNewsScreen from '../screens/groups/GroupNewsScreen';
import GroupCarsScreen from '../screens/groups/GroupCarsScreen';
import GroupMembersScreen from '../screens/groups/GroupMembersScreen';
import GroupEventsScreen from '../screens/groups/GroupEventsScreen';
import GroupMarketplaceScreen from '../screens/groups/GroupMarketplaceScreen';
import GroupResourcesScreen from '../screens/groups/GroupResourcesScreen';
import GroupSettingsScreen from '../screens/groups/GroupSettingsScreen';
import { Colors } from '../constants/colors';

const Stack = createNativeStackNavigator<GroupsStackParamList>();

export default function GroupsStackNavigator() {
  const isDark = useColorScheme() === 'dark';
  const headerBg = isDark ? Colors.brgDark : Colors.brg;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: headerBg },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="Groups" component={GroupsScreen} options={{ title: 'Groups' }} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="GroupForum" component={GroupForumScreen} options={{ title: 'Forum' }} />
      <Stack.Screen name="GroupNews" component={GroupNewsScreen} options={{ title: 'News' }} />
      <Stack.Screen name="GroupCars" component={GroupCarsScreen} options={{ title: 'Cars' }} />
      <Stack.Screen name="GroupMembers" component={GroupMembersScreen} options={{ title: 'Members' }} />
      <Stack.Screen name="GroupEvents" component={GroupEventsScreen} options={{ title: 'Events' }} />
      <Stack.Screen name="GroupMarketplace" component={GroupMarketplaceScreen} options={{ title: 'Marketplace' }} />
      <Stack.Screen name="GroupResources" component={GroupResourcesScreen} options={{ title: 'Resources' }} />
      <Stack.Screen name="GroupSettings" component={GroupSettingsScreen} options={{ title: 'Settings' }} />
    </Stack.Navigator>
  );
}

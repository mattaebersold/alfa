import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { GroupsStackParamList } from './types';
import GroupsScreen from '../screens/groups/GroupsScreen';

const Stack = createNativeStackNavigator<GroupsStackParamList>();

export default function GroupsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Groups" component={GroupsScreen} />
    </Stack.Navigator>
  );
}

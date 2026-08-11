import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RoutesStackParamList } from './types';
import RoutesScreen from '../screens/routes/RoutesScreen';
import RouteDetailScreen from '../screens/routes/RouteDetailScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import { colors } from '../constants/colors';

const Stack = createNativeStackNavigator<RoutesStackParamList>();

export default function RoutesStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.brgDark },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
        animation: 'none',
      }}
    >
      <Stack.Screen name="Routes" component={RoutesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RouteDetail" component={RouteDetailScreen} options={{ title: 'Route' }} />
      <Stack.Screen name="UserDetail" component={ProfileScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

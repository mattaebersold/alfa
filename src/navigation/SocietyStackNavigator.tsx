import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SocietyStackParamList } from './types';
import EventsScreen from '../screens/society/EventsScreen';
import RallysScreen from '../screens/society/RallysScreen';
import RallyDetailScreen from '../screens/society/RallyDetailScreen';
import { colors } from '../constants/colors';

const Stack = createNativeStackNavigator<SocietyStackParamList>();

export default function SocietyStackNavigator() {
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
      <Stack.Screen name="Events" component={EventsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Rallys" component={RallysScreen} options={{ title: 'Rallys' }} />
      <Stack.Screen name="RallyDetail" component={RallyDetailScreen} options={{ title: 'Rally' }} />
    </Stack.Navigator>
  );
}

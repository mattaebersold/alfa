import React from 'react';
import { useColorScheme } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SocietyStackParamList } from './types';
import SocietyScreen from '../screens/society/SocietyScreen';
import EventDetailScreen from '../screens/society/EventDetailScreen';
import RallysScreen from '../screens/society/RallysScreen';
import RallyDetailScreen from '../screens/society/RallyDetailScreen';
import CalendarScreen from '../screens/society/CalendarScreen';
import MembersScreen from '../screens/society/MembersScreen';
import { colors } from '../constants/colors';

const Stack = createNativeStackNavigator<SocietyStackParamList>();

export default function SocietyStackNavigator() {
  const isDark = useColorScheme() === 'dark';
  const headerBg = isDark ? colors.brgDark : colors.brg;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: headerBg },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
        animation: 'none',
      }}
    >
      <Stack.Screen name="Society" component={SocietyScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event' }} />
      <Stack.Screen name="Rallys" component={RallysScreen} options={{ title: 'Rallys' }} />
      <Stack.Screen name="RallyDetail" component={RallyDetailScreen} options={{ title: 'Rally' }} />
      <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
      <Stack.Screen name="Members" component={MembersScreen} options={{ title: 'Members' }} />
    </Stack.Navigator>
  );
}

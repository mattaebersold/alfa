import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { SocietyStackParamList } from './types';
import RallysScreen from '../screens/society/RallysScreen';
import RallyDetailScreen from '../screens/society/RallyDetailScreen';
import { colors } from '../constants/colors';
import { FONT_INTER } from '../constants/fonts'
import { COLOR_WHITE } from '../constants/config';

const Stack = createNativeStackNavigator<SocietyStackParamList>();

export default function SocietyStackNavigator() {
  const headerBg = colors.brgDark;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: headerBg },
        headerTintColor: COLOR_WHITE,
        headerTitleStyle: { fontFamily: FONT_INTER.bold },
        animation: 'none',
      }}
    >
      {/* The screen draws the app's own floating header, like Routes does;
          the native bar on its own left it looking like a sheet over the app. */}
      <Stack.Screen name="Rallys" component={RallysScreen} options={{ title: 'Rallys', headerShown: false }} />
      <Stack.Screen name="RallyDetail" component={RallyDetailScreen} options={{ title: 'Rally' }} />
    </Stack.Navigator>
  );
}

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MarketStackParamList } from './types';
import MarketplaceScreen from '../screens/marketplace/MarketplaceScreen';
import { colors } from '../constants/colors';
import { FONT_INTER } from '../constants/fonts'
import { COLOR_WHITE } from '../constants/config';

const Stack = createNativeStackNavigator<MarketStackParamList>();

export default function MarketStackNavigator() {
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
      <Stack.Screen name="Marketplace" component={MarketplaceScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MarketStackParamList } from './types';
import MarketplaceScreen from '../screens/marketplace/MarketplaceScreen';
import ListingDetailScreen from '../screens/marketplace/ListingDetailScreen';
import { colors } from '../constants/colors';

const Stack = createNativeStackNavigator<MarketStackParamList>();

export default function MarketStackNavigator() {
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
      <Stack.Screen name="Marketplace" component={MarketplaceScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ListingDetail" component={ListingDetailScreen} options={{ title: 'Listing' }} />
    </Stack.Navigator>
  );
}

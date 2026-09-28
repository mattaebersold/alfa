import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CarsStackParamList } from './types';
import CarsScreen from '../screens/cars/CarsScreen';
import GarageScreen from '../screens/garage/GarageScreen';
import CarDetailScreen from '../screens/cars/CarDetailScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import BrandsScreen from '../screens/cars/BrandsScreen';
import BrandDetailScreen from '../screens/cars/BrandDetailScreen';
import ModelDetailScreen, { modelPageTitle } from '../screens/cars/ModelDetailScreen';
import { colors } from '../constants/colors';
import { FONT_INTER } from '../constants/fonts'
import { COLOR_WHITE } from '../constants/config';

const Stack = createNativeStackNavigator<CarsStackParamList>();

export default function CarsStackNavigator() {
  const headerBg = colors.brgDark;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: headerBg },
        headerTintColor: COLOR_WHITE,
        headerTitleStyle: { fontFamily: FONT_INTER.bold },
        // Just the arrow on iOS — no "Cars" or "Brands" beside it.
        headerBackButtonDisplayMode: 'minimal',
        animation: 'none',
      }}
    >
      <Stack.Screen name="Cars" component={CarsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Garage" component={GarageScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CarDetail" component={CarDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="UserDetail" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Brands" component={BrandsScreen} options={{ title: 'Browse Brands' }} />
      <Stack.Screen name="BrandDetail" component={BrandDetailScreen} options={({ route }) => ({ title: route.params.brand })} />
      <Stack.Screen name="ModelDetail" component={ModelDetailScreen} options={({ route }) => ({ title: modelPageTitle(route.params) })} />
    </Stack.Navigator>
  );
}

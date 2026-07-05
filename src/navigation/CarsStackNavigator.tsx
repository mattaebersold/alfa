import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CarsStackParamList } from './types';
import CarsScreen from '../screens/cars/CarsScreen';
import GarageScreen from '../screens/garage/GarageScreen';
import CarDetailScreen from '../screens/cars/CarDetailScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import BrandsScreen from '../screens/cars/BrandsScreen';
import BrandDetailScreen from '../screens/cars/BrandDetailScreen';
import { colors } from '../constants/colors';

const Stack = createNativeStackNavigator<CarsStackParamList>();

export default function CarsStackNavigator() {
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
      <Stack.Screen name="Cars" component={CarsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Garage" component={GarageScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CarDetail" component={CarDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="UserDetail" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Brands" component={BrandsScreen} options={{ title: 'Browse Brands' }} />
      <Stack.Screen name="BrandDetail" component={BrandDetailScreen} options={({ route }) => ({ title: route.params.brand })} />
    </Stack.Navigator>
  );
}

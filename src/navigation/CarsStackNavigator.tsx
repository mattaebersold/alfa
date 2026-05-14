import React from 'react';
import { useColorScheme } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CarsStackParamList } from './types';
import CarsScreen from '../screens/cars/CarsScreen';
import CarDetailScreen from '../screens/cars/CarDetailScreen';
import UserDetailScreen from '../screens/profile/UserDetailScreen';
import BrandsScreen from '../screens/cars/BrandsScreen';
import BrandDetailScreen from '../screens/cars/BrandDetailScreen';
import { colors } from '../constants/colors';

const Stack = createNativeStackNavigator<CarsStackParamList>();

export default function CarsStackNavigator() {
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
      <Stack.Screen name="Cars" component={CarsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CarDetail" component={CarDetailScreen} options={{ headerShown: true, title: 'Car', headerBackVisible: false, headerStyle: { backgroundColor: '#3C3C3E' }, headerTintColor: '#FFFFFF', headerTitleStyle: { fontWeight: '700' } }} />
      <Stack.Screen name="UserDetail" component={UserDetailScreen} options={{ headerShown: true, title: 'Profile', headerBackVisible: false }} />
      <Stack.Screen name="Brands" component={BrandsScreen} options={{ title: 'Browse Brands' }} />
      <Stack.Screen name="BrandDetail" component={BrandDetailScreen} options={({ route }) => ({ title: route.params.brand })} />
    </Stack.Navigator>
  );
}

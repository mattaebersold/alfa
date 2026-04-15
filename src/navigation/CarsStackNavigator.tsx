import React from 'react';
import { useColorScheme } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CarsStackParamList } from './types';
import CarsScreen from '../screens/cars/CarsScreen';
import CarDetailScreen from '../screens/cars/CarDetailScreen';
import BrandsScreen from '../screens/cars/BrandsScreen';
import BrandDetailScreen from '../screens/cars/BrandDetailScreen';
import { Colors } from '../constants/colors';

const Stack = createNativeStackNavigator<CarsStackParamList>();

export default function CarsStackNavigator() {
  const isDark = useColorScheme() === 'dark';
  const headerBg = isDark ? Colors.brgDark : Colors.brg;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: headerBg },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="Cars" component={CarsScreen} options={{ title: 'Cars' }} />
      <Stack.Screen name="CarDetail" component={CarDetailScreen} options={{ title: 'Car' }} />
      <Stack.Screen name="Brands" component={BrandsScreen} options={{ title: 'Browse Brands' }} />
      <Stack.Screen name="BrandDetail" component={BrandDetailScreen} options={({ route }) => ({ title: route.params.brand })} />
    </Stack.Navigator>
  );
}

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Users, UsersRound, ShoppingBag, Car } from 'lucide-react-native';
import { useColorScheme } from 'react-native';
import type { MainTabParamList } from './types';
import FeedStackNavigator from './FeedStackNavigator';
import SocietyStackNavigator from './SocietyStackNavigator';
import GroupsStackNavigator from './GroupsStackNavigator';
import MarketStackNavigator from './MarketStackNavigator';
import CarsStackNavigator from './CarsStackNavigator';
import { Colors } from '../constants/colors';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const isDark = useColorScheme() === 'dark';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? Colors.brgDark : Colors.brg,
          borderTopWidth: 0,
          elevation: 0,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.speed,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.45)',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="FeedTab"
        component={FeedStackNavigator}
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size - 2} />,
        }}
      />
      <Tab.Screen
        name="SocietyTab"
        component={SocietyStackNavigator}
        options={{
          title: 'Society',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size - 2} />,
        }}
      />
      <Tab.Screen
        name="GroupsTab"
        component={GroupsStackNavigator}
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, size }) => <UsersRound color={color} size={size - 2} />,
        }}
      />
      <Tab.Screen
        name="MarketTab"
        component={MarketStackNavigator}
        options={{
          title: 'Market',
          tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size - 2} />,
        }}
      />
      <Tab.Screen
        name="CarsTab"
        component={CarsStackNavigator}
        options={{
          title: 'Cars',
          tabBarIcon: ({ color, size }) => <Car color={color} size={size - 2} />,
        }}
      />
    </Tab.Navigator>
  );
}

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Users, ShoppingBag, Car, Plus } from 'lucide-react-native';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MainTabParamList } from './types';
import FeedStackNavigator from './FeedStackNavigator';
import SocietyStackNavigator from './SocietyStackNavigator';
import MarketStackNavigator from './MarketStackNavigator';
import CarsStackNavigator from './CarsStackNavigator';
import { Colors } from '../constants/colors';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Empty placeholder — never actually rendered (Create tab intercepted before navigation)
function EmptyScreen() { return null; }

export default function MainTabNavigator() {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? Colors.brgDark : Colors.brg,
          borderTopWidth: 0,
          elevation: 0,
          height: tabBarHeight,
          paddingBottom: insets.bottom + 8,
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
          title: 'Events',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size - 2} />,
        }}
      />

      {/* Center + button */}
      <Tab.Screen
        name="GroupsTab"
        component={EmptyScreen}
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={styles.fab}>
              <Plus size={26} color="#FFFFFF" strokeWidth={2.5} />
            </View>
          ),
          tabBarLabel: () => null,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            (navigation as any).navigate('Create');
          },
        })}
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

const styles = StyleSheet.create({
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.speed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
});

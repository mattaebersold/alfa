import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Home, Users, Car, Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import CheckeredFlag from '../components/ui/CheckeredFlag';
import type { MainTabParamList } from './types';
import FeedStackNavigator from './FeedStackNavigator';
import SocietyStackNavigator from './SocietyStackNavigator';
import GroupsStackNavigator from './GroupsStackNavigator';
import CarsStackNavigator from './CarsStackNavigator';
import { colors } from '../constants/colors';
import { useBrandColor, useBrandTextColor } from '../hooks/useBrandColor';
import { useAppSelector } from '../store/store';

const Tab = createBottomTabNavigator<MainTabParamList>();

function perceivedBrightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

// Empty placeholder — never actually rendered (Create tab intercepted before navigation)
function EmptyScreen() { return null; }

function TabIcon({
  Icon, color, size, focused, brandColor,
}: {
  Icon: React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  color: string;
  size: number;
  focused: boolean;
  brandColor: string;
}) {
  return (
    <View style={[styles.iconWrap, focused && { backgroundColor: brandColor }]}>
      <Icon color={focused ? '#000000' : color} size={size - 5} strokeWidth={focused ? 2.7 : 2} />
    </View>
  );
}

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 46 + insets.bottom;

  const brandColor = useBrandColor();
  const fabIconColor = useBrandTextColor();
  const rootNav = useNavigation<any>();
  const { userInfo } = useAppSelector((s) => s.auth);
  const isAdmin = userInfo?.accountType === 'admin';

  const openCreateMenu = () => {
    Alert.alert('Create', undefined, [
      { text: 'Post', onPress: () => rootNav.navigate('Create') },
      { text: 'Garage Car', onPress: () => rootNav.navigate('CarCreate') },
      { text: 'Diecast Listing', onPress: () => rootNav.navigate('DiecastCreate') },
      ...(isAdmin ? [{ text: 'Event', onPress: () => rootNav.navigate('EventCreate') }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          left: 0, right: 0, bottom: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: tabBarHeight,
          paddingBottom: insets.bottom + 4,
          paddingTop: 12,
          paddingHorizontal: 32,
        },
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.tabBarTint]} />
          </View>
        ),
        tabBarActiveTintColor: brandColor,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.9)',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          marginTop: 8,
        },
        tabBarItemStyle: {
          paddingVertical: 0,
        },
      }}
    >
      <Tab.Screen
        name="FeedTab"
        component={FeedStackNavigator}
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Home} color={color} size={size} focused={focused} brandColor={brandColor} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('FeedTab', { screen: 'Feed' });
          },
        })}
      />
      <Tab.Screen
        name="SocietyTab"
        component={SocietyStackNavigator}
        options={{
          title: 'Events',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={CheckeredFlag} color={color} size={size} focused={focused} brandColor={brandColor} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('SocietyTab', { screen: 'Society' });
          },
        })}
      />

      {/* Center + button */}
      <Tab.Screen
        name="MarketTab"
        component={EmptyScreen}
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={[styles.fab, { backgroundColor: brandColor }]}>
              <Plus size={26} color={fabIconColor} strokeWidth={2.5} />
            </View>
          ),
          tabBarLabel: () => null,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            openCreateMenu();
          },
        }}
      />

      <Tab.Screen
        name="GroupsTab"
        component={GroupsStackNavigator}
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Users} color={color} size={size} focused={focused} brandColor={brandColor} />
          ),
        }}
      />
      <Tab.Screen
        name="CarsTab"
        component={CarsStackNavigator}
        options={{
          title: 'Cars',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={Car} color={color} size={size} focused={focused} brandColor={brandColor} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('CarsTab', { screen: 'Cars' });
          },
        })}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarTint: { backgroundColor: 'rgba(0,0,0,0.6)' },

  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
});

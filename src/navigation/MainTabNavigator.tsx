import React, { useState } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Svg, { Defs, Stop, Rect, LinearGradient as SvgLinearGradient } from 'react-native-svg';
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

// Tab-bar background: a vertical gradient that's dark at the bottom and fades
// fully to transparent at the top. Measured in pixels (onLayout) so it reliably
// fills the bar. It extends ABOVE the bar (negative top) so the fade rises over
// the content behind the icons. pointerEvents none so it never blocks touches.
// No blur — a blur can't fade without the native MaskedView.
const TAB_FADE_RISE = 56; // px the gradient extends above the tab bar top

function TabBarFade() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { top: -TAB_FADE_RISE }]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 && (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <SvgLinearGradient id="tabFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity={0} />
              <Stop offset="0.5" stopColor="#000000" stopOpacity={0.55} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.97} />
            </SvgLinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size.w} height={size.h} fill="url(#tabFade)" />
        </Svg>
      )}
    </View>
  );
}

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
  // Extra bottom clearance so icons/labels aren't crowded by the system nav —
  // full amount on Android's gesture/nav bar, half on iOS.
  const extraTabPad = Platform.OS === 'android' ? 40 : 20;
  const tabBarHeight = 46 + insets.bottom + extraTabPad;

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
          paddingBottom: insets.bottom + 4 + extraTabPad,
          paddingTop: 12,
          paddingHorizontal: 12,
        },
        tabBarBackground: () => <TabBarFade />,
        tabBarActiveTintColor: brandColor,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.9)',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          marginTop: 7,
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
    borderRadius: 108,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -5,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
});

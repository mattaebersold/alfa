import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Svg, { Defs, Stop, Rect, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import { Users, Car, Route as RouteIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CheckeredFlag from '../components/ui/CheckeredFlag';
import CreateFab, { FAB_LANE } from '../components/ui/CreateFab';
import type { MainTabParamList } from './types';
import FeedStackNavigator from './FeedStackNavigator';
import SocietyStackNavigator from './SocietyStackNavigator';
import GroupsStackNavigator from './GroupsStackNavigator';
import CarsStackNavigator from './CarsStackNavigator';
import RoutesStackNavigator from './RoutesStackNavigator';
import { colors } from '../constants/colors';
import { useBrandColor } from '../hooks/useBrandColor';
import { isImmersiveScreen, useFocusedRouteName } from './immersiveScreens';

const Tab = createBottomTabNavigator<MainTabParamList>();

function perceivedBrightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

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

  // Some screens take the whole phone — see immersiveScreens. Both the tab bar
  // and the create button get out of their way.
  const immersive = isImmersiveScreen(useFocusedRouteName());

  return (
    // The navigator is wrapped so the create button can sit above every tab at
    // once, rather than each screen mounting its own copy.
    <View style={styles.root}>
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: immersive ? { display: 'none' } : {
          position: 'absolute',
          left: 0, right: 0, bottom: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: tabBarHeight,
          paddingBottom: insets.bottom + 4 + extraTabPad,
          paddingTop: 12,
          paddingHorizontal: 12,
          // The create button sits in the bottom-right corner now, over this
          // bar. Reserving its lane is what keeps it from covering the last
          // tab rather than floating beside it.
          paddingRight: FAB_LANE,
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
      {/* Registered but not shown.
          The feed's own tab is gone from the bar — it lives in the menu drawer
          now — but this stack still holds Profile, Dashboard, Groups, Members,
          Articles, Search and the post/user/car detail screens, and half the
          app navigates into it by name. Hiding the button rather than removing
          the route keeps every one of those paths working, and keeps the feed
          as the screen the app opens on. */}
      <Tab.Screen
        name="FeedTab"
        component={FeedStackNavigator}
        options={{
          title: 'Feed',
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
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
            navigation.navigate('SocietyTab', { screen: 'Events' });
          },
        })}
      />

      <Tab.Screen
        name="RoutesTab"
        component={RoutesStackNavigator}
        options={{
          title: 'Routes',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon Icon={RouteIcon} color={color} size={size} focused={focused} brandColor={brandColor} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('RoutesTab', { screen: 'Routes' });
          },
        })}
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
    {!immersive && <CreateFab />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  tabBarTint: { backgroundColor: 'rgba(0,0,0,0.6)' },

  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});

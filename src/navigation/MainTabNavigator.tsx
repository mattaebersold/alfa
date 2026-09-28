import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CreateFab, { FAB_LANE } from '../components/ui/CreateFab';
import { GUTTER, COLOR_BLACK } from '../constants/config';
import { useSearch } from '../providers/SearchProvider';
import type { MainTabParamList } from './types';
import FeedStackNavigator from './FeedStackNavigator';
import SocietyStackNavigator from './SocietyStackNavigator';
import GroupsStackNavigator from './GroupsStackNavigator';
import CarsStackNavigator from './CarsStackNavigator';
import MarketStackNavigator from './MarketStackNavigator';
import { colors } from '../constants/colors';
import { useBrandColor } from '../hooks/useBrandColor';
import { isImmersiveScreen, useFocusedRouteName } from './immersiveScreens';
import { FONT_INTER } from '../constants/fonts';

const Tab = createBottomTabNavigator<MainTabParamList>();

function perceivedBrightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
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
      {/* `size - 1` where it was `size - 5`: about 10% larger, and the wrap is
          still 38pt so the selected pill and the touch target don't move. */}
      <Icon color={focused ? COLOR_BLACK : color} size={size - 1} strokeWidth={focused ? 2.7 : 2} />
    </View>
  );
}

/** Never rendered — the Search tab prevents navigation before it would be. */
function NoopScreen() {
  return null;
}

export default function MainTabNavigator() {
  const { openSearch } = useSearch();
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
      // Back retraces the tabs you actually visited. The default returns to the
      // first tab from anywhere, which made the header's back button (and
      // Android's) skip straight past the page you'd just come from.
      backBehavior="history"
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
          paddingHorizontal: GUTTER,
          // The create button sits in the bottom-right corner now, over this
          // bar. Reserving its lane is what keeps it from covering the last
          // tab rather than floating beside it.
          paddingRight: FAB_LANE,
          // Every tab button is hidden, so the bar is an invisible strip across
          // the bottom — it mustn't take the taps meant for the content under
          // it. The corner circles aren't in it (CreateFab), so they still work.
          pointerEvents: 'none',
        },
        // Nothing behind it: the bar's only buttons are the floating circles in
        // the corner (CreateFab), which carry their own ground and shadow.
        tabBarBackground: () => null,
        tabBarActiveTintColor: brandColor,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.9)',
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: FONT_INTER.bold,
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
      {/* Registered but not shown, like the feed's. Events is a tab of the
          home screen now; this stack is what's left of the society section —
          Rallys and a rally's page — and the menu navigates into it by name. */}
      <Tab.Screen
        name="SocietyTab"
        component={SocietyStackNavigator}
        options={{
          title: 'Rallys',
          tabBarButton: () => null,
        }}
      />

      {/* Registered but not shown. The marketplace is a tab of the home
          screen now; this stack stays because listings and the app's links
          still navigate into it by name. */}
      <Tab.Screen
        name="MarketTab"
        component={MarketStackNavigator}
        options={{
          title: 'Market',
          tabBarButton: () => null,
        }}
      />

      {/* Registered but not shown. Groups is a tab of the home screen now;
          this stack stays because a group's own page lives in it, and the app
          navigates into it by name. */}
      <Tab.Screen
        name="GroupsTab"
        component={GroupsStackNavigator}
        options={{
          title: 'Groups',
          tabBarButton: () => null,
        }}
      />
      {/* Registered but not shown. The garage, brands, model pages and every
          car's page live in this stack, and the app navigates into it by name
          from the menu and the header — it just has no footer button. */}
      <Tab.Screen
        name="CarsTab"
        component={CarsStackNavigator}
        options={{
          title: 'Cars',
          tabBarButton: () => null,
        }}
      />

      {/* Search opens an overlay, it doesn't navigate.
          The screen it points at is never rendered — `tabPress` is prevented
          before navigation happens — but a Tab.Screen needs a component, and
          this is the cheapest honest one. The tab never reads as focused
          either, which is right: search is something you do over wherever you
          already were, not a place the bar can be showing you.

          The overlay itself lives at the root — see SearchProvider — because
          the tab bar sits outside the header that used to own it. */}
      <Tab.Screen
        name="SearchTab"
        component={NoopScreen}
        options={{
          title: 'Search',
          // Its button is the circle beside the + now — see CreateFab.
          tabBarButton: () => null,
        }}
        listeners={() => ({
          tabPress: (e) => {
            e.preventDefault();
            openSearch();
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

  /**
   * No ground when unselected.
   *
   * The 5%-white square sat behind every icon, which made five faint tiles
   * across the bar and left the selected one competing with four near-misses
   * rather than standing alone. The brand fill still lands here when a tab is
   * focused — that's the only state that needs a surface.
   *
   * The box keeps its size: it's the touch target and the shape the selected
   * pill takes, and shrinking it to the glyph would move both.
   */
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

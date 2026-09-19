import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { X } from 'lucide-react-native';
import type { AppStackParamList } from './types';
import MainTabNavigator from './MainTabNavigator';
import { colors } from '../constants/colors';

const MODAL_HEADER_BG = '#202020';

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={10}>
      <View style={{ width: 30, height: 30, borderRadius: 15, marginLeft: 2, alignItems: 'center', justifyContent: 'center' }}>
        <X size={22} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
}

/**
 * The close (X) for modal screens, as header options.
 *
 * iOS 26 gives navigation-bar buttons a Liquid Glass background, and a plain
 * `headerRight` offers no way to decline it — on a real device that glass reads
 * as an opaque white capsule with the icon lost inside it. The simulator draws
 * it faithfully enough to look fine, which is why this only shows up on device.
 *
 * `unstable_headerRightItems` is the same element by another route, but one that
 * can set `hidesSharedBackground`. It's iOS-only by design; Android ignores it
 * and falls through to `headerRight` below.
 */
function closeButtonOptions(navigation: { goBack: () => void }) {
  const element = <CloseButton onPress={() => navigation.goBack()} />;
  return {
    headerRight: () => element,
    unstable_headerRightItems: () => [
      { type: 'custom' as const, element, hidesSharedBackground: true },
    ],
  };
}

import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import MessagesScreen from '../screens/messages/MessagesScreen';
import MessageThreadScreen from '../screens/messages/MessageThreadScreen';
import ComposeMessageScreen from '../screens/messages/ComposeMessageScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import NotificationSettingsScreen from '../screens/profile/NotificationSettingsScreen';
import AlertsScreen from '../screens/alerts/AlertsScreen';
import AlertCreateScreen from '../screens/alerts/AlertCreateScreen';
import ArticleDetailScreen from '../screens/articles/ArticleDetailScreen';
import CreateScreen from '../screens/create/CreateScreen';
import DiecastCreateScreen from '../screens/create/DiecastCreateScreen';
import RoutesScreen from '../screens/routes/RoutesScreen';
import RouteRecordScreen from '../screens/routes/RouteRecordScreen';
import RouteSaveScreen from '../screens/routes/RouteSaveScreen';
import RouteDetailScreen from '../screens/routes/RouteDetailScreen';
import { DIECAST_BLUE } from '../constants/diecast';
import CreateStoryScreen from '../screens/create/CreateStoryScreen';
import StoryDetailsScreen from '../screens/create/StoryDetailsScreen';
import StoryViewerScreen from '../screens/stories/StoryViewerScreen';
import CarDetailScreen from '../screens/cars/CarDetailScreen';
import PostDetailScreen from '../screens/feed/PostDetailScreen';
import EventDetailScreen from '../screens/society/EventDetailScreen';
import RallyDetailScreen from '../screens/society/RallyDetailScreen';
import CarTasksScreen from '../screens/garage/CarTasksScreen';
import CarCreateScreen from '../screens/garage/CarCreateScreen';
import ModCreateScreen from '../screens/cars/ModCreateScreen';
import PodcastDetailScreen from '../screens/podcasts/PodcastDetailScreen';
import ListDetailScreen from '../screens/lists/ListDetailScreen';
import CreateListScreen from '../screens/lists/CreateListScreen';
import EditListScreen from '../screens/lists/EditListScreen';
import EventCreateScreen from '../screens/society/EventCreateScreen';
import MoreScreen from '../screens/MoreScreen';
// Group detail screens (tab bar hidden — acceptable for detail drill-down)
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';
import GroupDiscussionScreen from '../screens/groups/GroupDiscussionScreen';
import GroupNewsScreen from '../screens/groups/GroupNewsScreen';
import GroupCarsScreen from '../screens/groups/GroupCarsScreen';
import GroupMembersScreen from '../screens/groups/GroupMembersScreen';
import GroupEventsScreen from '../screens/groups/GroupEventsScreen';
import MarketplaceScreen from '../screens/marketplace/MarketplaceScreen';
import ListingDetailModalScreen from '../screens/marketplace/ListingDetailModalScreen';
import ListingCreateScreen from '../screens/marketplace/ListingCreateScreen';
import MarketplaceMessagesScreen from '../screens/marketplace/MarketplaceMessagesScreen';
import MarketplaceThreadScreen from '../screens/marketplace/MarketplaceThreadScreen';
import ShopScreen from '../screens/shop/ShopScreen';
import PhotoSpotCreateScreen from '../screens/photography/PhotoSpotCreateScreen';
import ProductCreateScreen from '../screens/shop/ProductCreateScreen';
import AboutScreen from '../screens/marketing/AboutScreen';
import SupportScreen from '../screens/support/SupportScreen';
import SocietyEventDetailScreen from '../screens/society/SocietyEventDetailScreen';
import SocietyEventCreateScreen from '../screens/society/SocietyEventCreateScreen';
import GroupResourcesScreen from '../screens/groups/GroupResourcesScreen';
import GroupSettingsScreen from '../screens/groups/GroupSettingsScreen';
import GroupSectionScreen from '../screens/groups/GroupSectionScreen';

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppNavigator() {
  const headerBg = colors.brgDark;

  const headerOptions = {
    headerStyle: { backgroundColor: headerBg },
    headerTintColor: '#FFFFFF' as string,
    headerTitleStyle: { fontWeight: '700' as const },
    headerBackTitle: '',
  };

  return (
    // animation: 'none' = screens just appear, no slide. Modals override this with their own animation.
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none', headerBackTitle: '' }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ title: 'Home' }} />

      {/* ── Action overlays: slide up from bottom ──────────────────────────── */}
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={({ navigation }) => ({ headerShown: true, title: 'Notifications', presentation: 'modal', animation: 'slide_from_bottom', headerStyle: { backgroundColor: MODAL_HEADER_BG }, headerTintColor: '#FFFFFF', headerTitleStyle: { fontWeight: '700' as const }, headerBackTitle: '', ...closeButtonOptions(navigation) })}
      />
      <Stack.Screen
        name="Messages"
        component={MessagesScreen}
        options={({ navigation }) => ({ headerShown: true, title: 'Messages', presentation: 'modal', animation: 'slide_from_bottom', headerStyle: { backgroundColor: MODAL_HEADER_BG }, headerTintColor: '#FFFFFF', headerTitleStyle: { fontWeight: '700' as const }, headerBackTitle: '', ...closeButtonOptions(navigation) })}
      />
      <Stack.Screen
        name="Create"
        component={CreateScreen}
        options={({ navigation }) => ({ headerShown: true, title: 'Create', presentation: 'modal', animation: 'slide_from_bottom', headerStyle: { backgroundColor: MODAL_HEADER_BG }, headerTintColor: '#FFFFFF', headerTitleStyle: { fontWeight: '700' as const }, headerBackTitle: '', ...closeButtonOptions(navigation) })}
      />
      {/* Recording takes the whole screen — a live map with no chrome competing
          with it — and the save step follows as a normal modal. */}
      <Stack.Screen
        name="Routes"
        component={RoutesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RouteRecord"
        component={RouteRecordScreen}
        options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="RouteDetailModal"
        component={RouteDetailScreen}
        options={({ navigation }) => ({ headerShown: true, title: 'Route', presentation: 'modal', animation: 'slide_from_bottom', headerStyle: { backgroundColor: MODAL_HEADER_BG }, headerTintColor: '#FFFFFF', headerTitleStyle: { fontWeight: '700' as const }, headerBackTitle: '', ...closeButtonOptions(navigation) })}
      />
      <Stack.Screen
        name="RouteSave"
        component={RouteSaveScreen}
        options={{ headerShown: true, title: 'Save Route', headerStyle: { backgroundColor: MODAL_HEADER_BG }, headerTintColor: '#FFFFFF', headerTitleStyle: { fontWeight: '700' as const }, headerBackTitle: '' }}
      />
      <Stack.Screen
        name="DiecastCreate"
        component={DiecastCreateScreen}
        options={({ navigation }) => ({ headerShown: true, title: 'Diecast Listing', presentation: 'modal', animation: 'slide_from_bottom', headerStyle: { backgroundColor: DIECAST_BLUE }, headerTintColor: '#FFFFFF', headerTitleStyle: { fontWeight: '700' as const }, headerBackTitle: '', ...closeButtonOptions(navigation) })}
      />
      <Stack.Screen
        name="CarCreate"
        component={CarCreateScreen}
        // transparentModal, not modal: the screen draws its own sheet and needs
        // the backdrop behind it to show through and take taps.
        options={{ headerShown: false, presentation: 'transparentModal', animation: 'none' }}
      />
      <Stack.Screen
        name="ModCreate"
        component={ModCreateScreen}
        options={({ navigation }) => ({ headerShown: true, title: 'Add Mod', presentation: 'modal', animation: 'slide_from_bottom', headerStyle: { backgroundColor: MODAL_HEADER_BG }, headerTintColor: '#FFFFFF', headerTitleStyle: { fontWeight: '700' as const }, headerBackTitle: '', ...closeButtonOptions(navigation) })}
      />
      <Stack.Screen
        name="CreateList"
        component={CreateListScreen}
        options={({ navigation }) => ({ headerShown: true, title: 'New List', presentation: 'modal', animation: 'slide_from_bottom', headerStyle: { backgroundColor: MODAL_HEADER_BG }, headerTintColor: '#FFFFFF', headerTitleStyle: { fontWeight: '700' as const }, headerBackTitle: '', ...closeButtonOptions(navigation) })}
      />
      <Stack.Screen
        name="EventCreate"
        component={EventCreateScreen}
        options={({ navigation }) => ({ headerShown: true, title: 'Create Event', presentation: 'modal', animation: 'slide_from_bottom', headerStyle: { backgroundColor: MODAL_HEADER_BG }, headerTintColor: '#FFFFFF', headerTitleStyle: { fontWeight: '700' as const }, headerBackTitle: '', ...closeButtonOptions(navigation) })}
      />

      {/* ── Full-screen camera/viewer flows ───────────────────────────────── */}
      <Stack.Screen
        name="CreateStory"
        component={CreateStoryScreen}
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name="StoryViewer"
        component={StoryViewerScreen}
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />

      {/* ── Screens: appear instantly, no slide ───────────────────────────── */}
      <Stack.Screen
        name="MessageThread"
        component={MessageThreadScreen}
        // Presented as a SharedModal sheet — the route is transparent and
        // un-animated so the sheet runs its own animation over what's behind.
        options={{ headerShown: false, presentation: 'transparentModal', animation: 'none' }}
      />
      {/* Marketplace conversations — their own pair of screens, deliberately
          not the inbox's. The list is a modal like Messages; the conversation
          is a SharedModal sheet like MessageThread. */}
      <Stack.Screen
        name="MarketplaceMessages"
        component={MarketplaceMessagesScreen}
        options={({ navigation }) => ({ headerShown: true, title: 'Marketplace', presentation: 'modal', animation: 'slide_from_bottom', headerStyle: { backgroundColor: MODAL_HEADER_BG }, headerTintColor: '#FFFFFF', headerTitleStyle: { fontWeight: '700' as const }, headerBackTitle: '', ...closeButtonOptions(navigation) })}
      />
      <Stack.Screen
        name="MarketplaceThread"
        component={MarketplaceThreadScreen}
        options={{ headerShown: false, presentation: 'transparentModal', animation: 'none' }}
      />
      <Stack.Screen
        name="ComposeMessage"
        component={ComposeMessageScreen}
        options={{ ...headerOptions, headerShown: true, title: 'New Message' }}
      />
      <Stack.Screen
        name="UserDetail"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Settings' }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Notifications' }}
      />
      {/* The alerts list is an ordinary pushed screen; the rule builder on top
          of it is a SharedModal sheet, so its route is transparent and
          un-animated exactly as ListingCreate's is. */}
      <Stack.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Custom Alerts' }}
      />
      <Stack.Screen
        name="AlertCreate"
        component={AlertCreateScreen}
        options={{ headerShown: false, presentation: 'transparentModal', animation: 'none' }}
      />
      {/* Presented as a SharedModal bottom sheet, so the route itself must be
          transparent and un-animated — the sheet runs its own animation and
          blurs whatever is behind it. */}
      <Stack.Screen
        name="ArticleDetail"
        component={ArticleDetailScreen}
        options={{
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'none',
        }}
      />
      <Stack.Screen
        name="Marketplace"
        component={MarketplaceScreen}
        options={{ headerShown: false }}
      />
      {/* A listing's summary, as a destination. The screen draws SummaryModal,
          which runs its own animation over whatever is behind it — so the
          route has to be transparent and un-animated, as ArticleDetail is. */}
      <Stack.Screen
        name="ListingDetailModal"
        component={ListingDetailModalScreen}
        options={{ headerShown: false, presentation: 'transparentModal', animation: 'none' }}
      />
      {/* The create form is its own SharedModal sheet, same as CarCreate. */}
      <Stack.Screen
        name="ListingCreate"
        component={ListingCreateScreen}
        options={{ headerShown: false, presentation: 'transparentModal', animation: 'none' }}
      />
      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Support"
        component={SupportScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SocietyEventDetail"
        component={SocietyEventDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SocietyEventCreate"
        component={SocietyEventCreateScreen}
        options={({ navigation, route }) => ({ headerShown: true, title: (route.params as any)?.eventId ? 'Edit Event' : 'New Event', presentation: 'modal', animation: 'slide_from_bottom', headerStyle: { backgroundColor: MODAL_HEADER_BG }, headerTintColor: '#FFFFFF', headerTitleStyle: { fontWeight: '700' as const }, headerBackTitle: '', ...closeButtonOptions(navigation) })}
      />
      <Stack.Screen
        name="Shop"
        component={ShopScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PhotoSpotCreate"
        component={PhotoSpotCreateScreen}
        options={({ navigation }) => ({ headerShown: true, title: 'Pin a Spot', presentation: 'modal', animation: 'slide_from_bottom', headerStyle: { backgroundColor: MODAL_HEADER_BG }, headerTintColor: '#FFFFFF', headerTitleStyle: { fontWeight: '700' as const }, headerBackTitle: '', ...closeButtonOptions(navigation) })}
      />
      <Stack.Screen
        name="ProductCreate"
        component={ProductCreateScreen}
        options={({ navigation, route }) => ({ headerShown: true, title: (route.params as any)?.productId ? 'Edit Product' : 'New Product', presentation: 'modal', animation: 'slide_from_bottom', headerStyle: { backgroundColor: MODAL_HEADER_BG }, headerTintColor: '#FFFFFF', headerTitleStyle: { fontWeight: '700' as const }, headerBackTitle: '', ...closeButtonOptions(navigation) })}
      />
      <Stack.Screen
        name="CarTasks"
        component={CarTasksScreen}
        // Root-level screen with its own floating back button, so no native header.
        options={{ headerShown: false }}
      />
      {/* In-stack car detail resolves to the tab stacks (Feed/Cars) so the bottom nav
          stays visible; this root entry is the fallback for root-modal contexts + deep links. */}
      <Stack.Screen
        name="CarDetail"
        component={CarDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CarDetailModal"
        component={CarDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PostDetailModal"
        component={PostDetailScreen as React.ComponentType<object>}
        // transparentModal, not modal: the screen draws its own blurred
        // backdrop over the feed, which an opaque presentation would have
        // nothing behind it to show.
        //
        // `animation: 'none'` because the screen animates itself — a route-level
        // slide would carry the backdrop up with the sheet, and a backdrop that
        // arrives from off-screen reads as part of the panel rather than as the
        // page behind it going out of focus. The sheet slides, the blur fades.
        options={{ headerShown: false, presentation: 'transparentModal', animation: 'none' }}
      />
      <Stack.Screen
        name="EventDetailModal"
        component={EventDetailScreen as React.ComponentType<object>}
        options={{ ...headerOptions, headerShown: true, title: 'Event' }}
      />
      <Stack.Screen
        name="RallyDetailModal"
        component={RallyDetailScreen as React.ComponentType<object>}
        options={{ ...headerOptions, headerShown: true, title: 'Rally' }}
      />
      <Stack.Screen
        name="StoryDetails"
        component={StoryDetailsScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Story Details' }}
      />
      <Stack.Screen
        name="PodcastDetail"
        component={PodcastDetailScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Podcast' }}
      />
      <Stack.Screen
        name="More"
        component={MoreScreen}
        options={{ ...headerOptions, headerShown: true, title: 'More' }}
      />
      <Stack.Screen
        name="ListDetail"
        component={ListDetailScreen}
        options={{ ...headerOptions, headerShown: true, title: 'List' }}
      />
      <Stack.Screen
        name="EditList"
        component={EditListScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Edit List' }}
      />
      <Stack.Screen
        name="GroupDetailModal"
        component={GroupDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GroupDiscussion"
        component={GroupDiscussionScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Discussion' }}
      />
      <Stack.Screen
        name="GroupNews"
        component={GroupNewsScreen}
        options={{ ...headerOptions, headerShown: true, title: 'News' }}
      />
      <Stack.Screen
        name="GroupCars"
        component={GroupCarsScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Cars' }}
      />
      <Stack.Screen
        name="GroupMembers"
        component={GroupMembersScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Members' }}
      />
      <Stack.Screen
        name="GroupEvents"
        component={GroupEventsScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Events' }}
      />
      <Stack.Screen
        name="GroupResources"
        component={GroupResourcesScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Resources' }}
      />
      <Stack.Screen
        name="GroupSettings"
        component={GroupSettingsScreen}
        options={{ ...headerOptions, headerShown: true, title: 'Settings' }}
      />
      <Stack.Screen
        name="GroupSection"
        component={GroupSectionScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

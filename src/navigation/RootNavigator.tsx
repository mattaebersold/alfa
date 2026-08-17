import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useAppDispatch, useAppSelector } from '../store/store';
import { restoreSession } from '../store/authSlice';
import { apiService, useGetLoggedInUserQuery, useRegisterDeviceTokenMutation } from '../api/apiService';
import { setCredentials } from '../store/authSlice';
import { registerForPushNotifications } from '../utils/pushNotifications';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import Spinner from '../components/ui/Spinner';
import { EventSheetProvider } from '../providers/EventSheetProvider';
import { navigationRef, navigateFromOutside } from './navigationRef';
import { notificationTarget } from '../utils/notificationTarget';

// ── Deep linking config ───────────────────────────────────────────────────────
const prefix = Linking.createURL('/');

const linking = {
  prefixes: [prefix, 'openroadsociety://'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          FeedTab:    { screens: { Feed: 'feed' } },
          SocietyTab: { screens: { Society: 'society', Calendar: 'calendar', Rallys: 'rallys' } },
          GroupsTab:  { screens: { Groups: 'groups' } },
          CarsTab:    { screens: { Cars: 'cars' } },
        },
      },
      CarDetailModal:   'car/:carId',
      PostDetailModal:  'post/:postId',
      EventDetailModal: 'event/:eventId',
      RallyDetailModal: 'rally/:rallyId',
      UserDetail:       'user/:userId',
      ArticleDetail:    'article/:articleId',
    },
  },
};

// ── Auth-aware inner component ────────────────────────────────────────────────
function AuthGate() {
  const dispatch = useAppDispatch();
  const { isLoggedIn } = useAppSelector((s) => s.auth);
  const [registerDeviceToken] = useRegisterDeviceTokenMutation();

  const { data: user, isLoading } = useGetLoggedInUserQuery(undefined, {
    skip: !isLoggedIn,
    pollingInterval: 900_000,
  });

  useEffect(() => {
    if (user) {
      dispatch(setCredentials(user));
    }
  }, [user, dispatch]);

  // Register push token when user logs in
  useEffect(() => {
    if (!isLoggedIn) return;
    registerForPushNotifications().then((token) => {
      if (token) {
        registerDeviceToken({ token, platform: Platform.OS });
      }
    });
  }, [isLoggedIn]);

  if (isLoading && isLoggedIn) return <Spinner fullScreen />;
  return isLoggedIn ? <AppNavigator /> : <AuthNavigator />;
}

export default function RootNavigator() {
  const dispatch = useAppDispatch();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  /**
   * Turns an arriving push into a cache invalidation.
   *
   * A push is the earliest signal that server state changed, so spending it on a
   * banner alone wastes it — dropping the matching tag makes every mounted query
   * refetch, and an open thread shows the new message immediately rather than at
   * its next poll. Nothing happens if the relevant screen isn't mounted; RTK
   * Query only refetches subscribed queries.
   */
  const refreshFor = (content: Notifications.NotificationContent) => {
    const data = content.data as { type?: string; kind?: string } | undefined;
    if (data?.type === 'message') {
      dispatch(apiService.util.invalidateTags(['Message']));
      return;
    }
    dispatch(apiService.util.invalidateTags(['Notifications']));
    // A car update means the car's own screens are stale too, not just the
    // notifications list — the mod or photo it announced is already on the
    // server, so an open car detail should show it without a manual pull.
    if (data?.kind) {
      dispatch(apiService.util.invalidateTags(['Cars', 'GarageCar', 'Mods', 'CarGallery', 'Projects', 'CarTask', 'Post']));
    }
  };

  /**
   * A tapped push opens what it's about.
   *
   * The payload carries `content_type`/`content_id` for exactly this — without
   * it a tap could only open the app and leave you to find the thing yourself.
   * Older pushes carry no data and simply open where the app left off.
   */
  const navigateFor = (content: Notifications.NotificationContent) => {
    const data = content.data as { content_type?: string; content_id?: string } | undefined;
    if (!data?.content_type || !data?.content_id) return;
    const target = notificationTarget({
      content_type: data.content_type,
      content_id: data.content_id,
    });
    if (target) navigateFromOutside(target.name, target.params);
  };

  useEffect(() => {
    dispatch(restoreSession());

    // Listen for incoming notifications while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener((n) => {
      refreshFor(n.request.content);
    });

    // Handle notification tap (open app from notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((r) => {
      // Opening from a cold start or the background means the cache is stale by
      // however long the app was away.
      refreshFor(r.notification.request.content);
      navigateFor(r.notification.request.content);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [dispatch]);

  return (
    <NavigationContainer ref={navigationRef} linking={linking as any}>
      {/* Inside the container: the event sheet it hosts renders navigation-aware
          content, so it needs a navigation context of its own. */}
      <EventSheetProvider>
        <AuthGate />
      </EventSheetProvider>
    </NavigationContainer>
  );
}

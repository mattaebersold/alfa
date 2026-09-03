import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useAppDispatch, useAppSelector } from '../store/store';
import { restoreSession, logout } from '../store/authSlice';
import { apiService, useGetLoggedInUserQuery, useRegisterDeviceTokenMutation } from '../api/apiService';
import { setCredentials } from '../store/authSlice';
import { registerForPushNotifications } from '../utils/pushNotifications';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import Spinner from '../components/ui/Spinner';
import SessionRecovery from '../components/auth/SessionRecovery';
import { EventSheetProvider } from '../providers/EventSheetProvider';
import { navigationRef, navigateFromOutside } from './navigationRef';
import { notificationTarget } from '../utils/notificationTarget';

// ── Deep linking config ───────────────────────────────────────────────────────
const prefix = Linking.createURL('/');

const linking = {
  /**
   * The https prefixes are what make a link in an email open the app.
   *
   * A custom scheme (`openroadsociety://`) only works once you're already
   * somewhere that knows to use it — mail clients won't touch it, and there's
   * nothing for it to fall back to when the app isn't installed. An https link
   * to the site is a real URL either way: iOS and Android hand it to the app
   * when it's installed and verified, and to the browser when it isn't, so one
   * link in one email serves both.
   *
   * Verification is the other half, and it lives on the website: see
   * murray's public/.well-known/apple-app-site-association and assetlinks.json.
   */
  prefixes: [
    prefix,
    'openroadsociety://',
    'https://openroadsociety.co',
    'https://www.openroadsociety.co',
  ],
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
/**
 * Decides which of the two apps is on screen.
 *
 * The distinction that matters here is between *holding a token* and *having an
 * account*. `restoreSession` only establishes the first — it reads the stored
 * token and says nothing about whether the server still honours it — so
 * `isLoggedIn` alone is not enough to render the app with. The profile fetch
 * below is what establishes the second, and until it lands there is no
 * `accountType` to colour the chrome with, no name to draw an avatar from and
 * no id to act with.
 *
 * Rendering `AppNavigator` in that gap is what produced the stuck sessions:
 * a member sat in a fully-drawn app that was quietly missing its user — blue
 * where it should have been gold, a '?' for a face, every button dead — and
 * nothing in it could recover, because the app only ever fetches the profile
 * once and a failure left `userInfo` null forever. So the gate now waits for
 * `userInfo` rather than for `isLoggedIn`, and the three ways the fetch can go
 * each get an answer: still working, show a spinner; token refused, the store's
 * 401 handling has already signed them out and this renders the login screen;
 * anything else, offer the retry and the sign-out that the broken app couldn't.
 */
function AuthGate() {
  const dispatch = useAppDispatch();
  const { isLoggedIn, userInfo, restoring } = useAppSelector((s) => s.auth);
  const [registerDeviceToken] = useRegisterDeviceTokenMutation();

  const { data: user, isFetching, refetch } = useGetLoggedInUserQuery(undefined, {
    skip: !isLoggedIn,
    pollingInterval: 900_000,
  });

  useEffect(() => {
    if (!user) return;
    // A 200 carrying something that isn't an account is the same dead end as a
    // rejected token — `setCredentials` would fill `userInfo` with an object
    // that satisfies every null check and answers none of the questions the app
    // asks of it. Treat it as the session being over rather than seeding the
    // broken state from a response we technically succeeded in fetching.
    if (!user.user_id && !user._id) {
      dispatch(logout({ expired: true }));
      return;
    }
    dispatch(setCredentials(user));
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

  // Nothing is known until the stored token has been read back.
  if (restoring) return <Spinner fullScreen />;

  if (!isLoggedIn) return <AuthNavigator />;

  if (!userInfo) {
    // `isFetching` rather than `isLoading` so a retry spins too — `isLoading` is
    // only ever true for the first attempt of a query's life.
    if (isFetching) return <Spinner fullScreen />;
    return (
      <SessionRecovery
        onRetry={refetch}
        onSignOut={() => dispatch(logout({ expired: true }))}
        retrying={isFetching}
      />
    );
  }

  return <AppNavigator />;
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
    const data = content.data as {
      type?: string;
      content_type?: string;
      content_id?: string;
      thread_id?: string;
      sender_id?: string;
    } | undefined;
    if (!data) return;
    // A message push predating the generic pair carries only `thread_id` — the
    // mapper takes it from the metadata, so hand the whole payload over rather
    // than bailing on the two fields being absent.
    if (!data.content_type && !data.type) return;
    const target = notificationTarget({
      type: data.type,
      content_type: data.content_type,
      content_id: data.content_id,
      senderUserId: data.sender_id,
      metadata: data,
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

import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useAppDispatch, useAppSelector } from '../store/store';
import { restoreSession } from '../store/authSlice';
import { useGetLoggedInUserQuery, useRegisterDeviceTokenMutation } from '../api/apiService';
import { setCredentials } from '../store/authSlice';
import { registerForPushNotifications } from '../utils/pushNotifications';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import Spinner from '../components/ui/Spinner';

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
          MarketTab:  { screens: { Marketplace: 'marketplace' } },
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
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    dispatch(restoreSession());

    // Listen for incoming notifications while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Badge/UI updates handled automatically by the notification handler
    });

    // Handle notification tap (open app from notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      // Future: navigate to relevant screen based on notification data
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [dispatch]);

  return (
    <NavigationContainer linking={linking}>
      <AuthGate />
    </NavigationContainer>
  );
}

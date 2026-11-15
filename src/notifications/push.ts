import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useOrsDispatch, useOrsSelector } from '../store/createStore';
import { orsApi } from '../api/orsApi';
import { useRegisterDeviceTokenMutation } from './api';
import { setCurrentPushToken } from './pushToken';

export { currentPushToken } from './pushToken';

/**
 * Push, as alfa does it, for any ORS app.
 *
 * The token is registered against the app that asked (the shared `x-ors-app`
 * header), and horacio keeps each app's tokens apart, so a vote on someone's
 * photo buzzes ORS Photo and never alfa. The last token is remembered here so
 * signing out can hand it back — otherwise the next person to sign in on this
 * phone would get the previous member's pushes.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Ask permission and return the Expo push token, or null. Never throws. */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const projectId =
      (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    if (!projectId) {
      // No EAS project yet (run `eas init` in the app). Expo can't mint a token
      // without one, so there's nothing to register — say so once, quietly.
      console.warn('[push] no EAS projectId in app.json — push is off until `eas init` is run');
      return null;
    }
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err: any) {
    // alfa learned this the hard way: a swallowed error here is months of no
    // push on Android with nothing in the log. Usually a missing
    // google-services.json (FCM) or an unknown projectId.
    console.warn('[push] could not get an Expo push token:', err?.message ?? err);
    return null;
  }
}

/**
 * The last tap already routed. `getLastNotificationResponseAsync` keeps
 * answering with the same response for the life of the process, so without
 * this a sign-out and back in would replay the launch tap.
 */
let handledResponseId: string | null = null;

/** What a push carries — enough to open the thing it's about. */
export interface PushData {
  app?: string;
  type?: string;
  content_type?: string;
  content_id?: string;
  [key: string]: unknown;
}

/**
 * Registers this device once signed in, keeps the bell fresh when a push
 * arrives, and routes a tapped push through `onOpen`.
 *
 * Mount once, inside the signed-in part of the app (inside AuthGate), so it
 * only ever runs with a session.
 */
export function usePushNotifications(onOpen: (data: PushData) => void) {
  const dispatch = useOrsDispatch();
  const isLoggedIn = useOrsSelector((s) => s.auth.isLoggedIn);
  const [register] = useRegisterDeviceTokenMutation();
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  useEffect(() => {
    if (!isLoggedIn) return;
    let alive = true;
    registerForPushNotifications().then((token) => {
      if (!alive || !token) return;
      setCurrentPushToken(token);
      register({ token, platform: Platform.OS });
    });
    return () => { alive = false; };
  }, [isLoggedIn, register]);

  useEffect(() => {
    // A push is the earliest sign something changed server-side: drop the
    // notifications cache so the bell and list refetch straight away.
    const received = Notifications.addNotificationReceivedListener(() => {
      dispatch(orsApi.util.invalidateTags(['Notifications']));
    });
    const tapped = Notifications.addNotificationResponseReceivedListener((r) => {
      handledResponseId = r.notification.request.identifier;
      dispatch(orsApi.util.invalidateTags(['Notifications']));
      const data = r.notification.request.content.data as PushData | undefined;
      if (data) openRef.current(data);
    });
    // A tap that *launched* the app from closed happened before this listener
    // existed, so it never fires for it — ask for it once instead. The app
    // queues the route until its navigator is ready.
    let alive = true;
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (!alive || !r) return;
      const id = r.notification.request.identifier;
      if (id === handledResponseId) return;
      handledResponseId = id;
      const data = r.notification.request.content.data as PushData | undefined;
      if (data) openRef.current(data);
    }).catch(() => {});

    return () => {
      alive = false;
      received.remove();
      tapped.remove();
    };
  }, [dispatch]);
}

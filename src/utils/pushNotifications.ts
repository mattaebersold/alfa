import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Configure how notifications behave when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request permission and return the Expo push token string,
 * or null if permission was denied.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return data;
  } catch (err: any) {
    // This used to swallow the error, which is how Android went a long time
    // with no push at all and nothing to show for it. The two failures worth
    // recognising in the log:
    //
    //  - "Default FirebaseApp is not initialized" / "FirebaseApp is not
    //    initialized" — there's no google-services.json in the build. Android
    //    push rides on FCM, so without it the app has no sender to register
    //    with and there is nothing wrong with this code to find.
    //  - "Expo project not found" / an unauthorised projectId — the token
    //    service can't tie the device to this project.
    //
    // Still returns null: a device that can't take pushes shouldn't stop the
    // app from starting.
    console.warn('[push] could not get an Expo push token:', err?.message ?? err);
    return null;
  }
}

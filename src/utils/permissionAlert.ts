import { Alert, Linking } from 'react-native';

/**
 * Camera (or other) access was refused.
 *
 * Once someone has said no, iOS won't ask again — the request comes straight
 * back denied, and the only place to change it is the app's page in
 * Settings. A bare "Permission needed" with an OK button was a dead end, so
 * this always offers the way there.
 *
 * Photo *library* picks don't need this at all: expo-image-picker opens the
 * system picker, which runs outside the app and needs no permission. Ask
 * only for the camera.
 */
export function alertPermissionDenied(message: string) {
  Alert.alert('Permission needed', message, [
    { text: 'Not now', style: 'cancel' },
    { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
  ]);
}

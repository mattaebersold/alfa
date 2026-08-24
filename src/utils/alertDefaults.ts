import { Alert, Platform } from 'react-native';

/**
 * Makes every Android alert dismissible.
 *
 * React Native builds Android dialogs with `cancelable: false` unless the
 * caller passes options saying otherwise, which means neither a tap outside nor
 * the hardware back button does anything: the dialog has to be answered. That's
 * wrong for the way these are used across the app — they're menus and
 * confirmations, and every one of them has a "cancel" that dismissing is
 * equivalent to. It also broke the back button in the middle of flows, which on
 * Android reads as the app being stuck.
 *
 * Done here, once, rather than by threading an options argument through ~60
 * call sites where the next one added would forget it. iOS is untouched — its
 * alerts have no dismiss-by-tapping-outside behaviour to enable.
 *
 * Dismissing runs no button handler, so it is exactly equivalent to cancelling.
 * An alert that genuinely must be answered can still pass
 * `{ cancelable: false }` explicitly; that wins, since caller options are
 * merged over this default.
 *
 * Imported for its side effect from App.tsx, before anything renders.
 */
if (Platform.OS === 'android') {
  const original = Alert.alert.bind(Alert) as (...args: any[]) => void;
  Alert.alert = ((title?: any, message?: any, buttons?: any, options?: any) =>
    original(title, message, buttons, { cancelable: true, ...options })) as typeof Alert.alert;
}

export {};

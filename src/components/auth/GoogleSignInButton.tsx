import React, { useCallback, useEffect, useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, ActivityIndicator, View } from 'react-native';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useAppDispatch } from '../../store/store';
import { googleSignIn } from '../../store/authSlice';
import { useColors } from '../../hooks/useColors';
import { CONFIG } from '../../constants/config';
import GoogleGlyph from './GoogleGlyph';

/**
 * "Continue with Google", natively.
 *
 * ## Why the native SDK rather than a browser
 *
 * Google blocks OAuth inside embedded webviews outright (`disallowed_useragent`),
 * so the only two options are the system browser or the platform SDK. The SDK
 * wins: it shows the account sheet iOS and Android users already know, reuses
 * the Google account signed in on the device, and never bounces out of the app.
 *
 * ## Which client id matters
 *
 * `webClientId` is the important one, and it is not a mistake that a *web*
 * client id appears in a native app. It sets the `aud` claim of the ID token
 * this returns, and horacio verifies that claim against its own
 * `GOOGLE_CLIENT_ID`. Both sides therefore name the same web client, and no
 * server change was needed to accept these tokens.
 *
 * `iosClientId` identifies the app to Google on iOS. Android has no equivalent
 * field — its OAuth client is matched by package name and signing certificate,
 * so it has to exist in the Cloud Console but is never named here.
 *
 * ## One button for sign-in and sign-up
 *
 * There is no separate registration path. horacio matches on Google id, then on
 * email address, and creates an account only if neither exists — so the same tap
 * logs in a returning member, adopts an account that signed up by email, or
 * creates a new one. Which of the three happened isn't something the member
 * needs to be asked about.
 */

export default function GoogleSignInButton({ label = 'Continue with Google', onError }: {
  label?: string;
  /** Surface the failure in the form's own error area, as email sign-in does. */
  onError?: (message: string) => void;
}) {
  const dispatch = useAppDispatch();
  const colors = useColors();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: CONFIG.GOOGLE_WEB_CLIENT_ID,
      iosClientId: CONFIG.GOOGLE_IOS_CLIENT_ID,
      // The two Google returns without asking for extra consent. Anything more
      // would put a scarier permission sheet in front of a sign-in button.
      scopes: ['profile', 'email'],
    });
  }, []);

  const signIn = useCallback(async () => {
    setBusy(true);
    try {
      // Android only, and cheap: it surfaces "no Play Services" as an error we
      // can word, rather than as a sign-in that silently never completes.
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      const response = await GoogleSignin.signIn();

      // v13+ returns a discriminated result rather than throwing on cancel.
      if (response.type === 'cancelled') return;

      const idToken = response.data?.idToken;
      if (!idToken) {
        // Almost always a missing or mismatched webClientId: without one Google
        // returns an access token and no ID token, and there is nothing for the
        // server to verify.
        throw new Error('Google did not return an ID token');
      }

      await dispatch(googleSignIn(idToken)).unwrap();
    } catch (err: any) {
      // A cancel is not a failure and must not raise an error banner.
      if (err?.code === statusCodes.SIGN_IN_CANCELLED) return;

      const message =
        err?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE
          ? 'Google Play Services is out of date on this device.'
          : typeof err === 'string'
            ? err
            : err?.message || "Google sign-in didn't work. Try your email address instead.";
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }, [dispatch, onError]);

  return (
    <TouchableOpacity
      style={[styles.button, { borderColor: colors.border, backgroundColor: colors.card }]}
      onPress={signIn}
      disabled={busy}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.grey} />
      ) : (
        <View style={styles.inner}>
          <GoogleGlyph size={18} />
          <Text style={[styles.label, { color: colors.fg }]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontSize: 15, fontWeight: '700' },
});

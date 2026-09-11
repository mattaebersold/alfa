import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useColorScheme } from 'react-native';
import { useAppDispatch } from '../../store/store';
import { appleSignIn } from '../../store/authSlice';

/**
 * "Sign in with Apple", using Apple's own button.
 *
 * ## Why Apple's component and not one of ours
 *
 * Apple's Human Interface Guidelines govern this button's wording, corner
 * radius, logo and spacing, and review does check. `AppleAuthenticationButton`
 * renders the system control, so it is correct by construction and stays correct
 * when Apple changes it.
 *
 * ## iOS only, and conditionally even there
 *
 * The module doesn't exist on Android, and on iOS it's unavailable below 13.
 * `isAvailableAsync` is the only reliable test — rendering the button where it
 * isn't supported throws. It returns null rather than a disabled control,
 * because an option you can't take is worse than no option.
 *
 * ## Why we ask for the name
 *
 * Apple hands over the name and email **once**, on first authorization, and
 * never again. Requesting both scopes here is the single chance to learn them;
 * after that every credential carries the subject id alone. The server stores
 * `appleId` on that first pass for exactly this reason.
 */
export default function AppleSignInButton({ onError }: {
  onError?: (message: string) => void;
}) {
  const dispatch = useAppDispatch();
  const scheme = useColorScheme();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let alive = true;
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => { if (alive) setAvailable(ok); })
      .catch(() => { if (alive) setAvailable(false); });
    return () => { alive = false; };
  }, []);

  const signIn = useCallback(async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple did not return an identity token');
      }

      await dispatch(appleSignIn({
        identityToken: credential.identityToken,
        fullName: credential.fullName,
      })).unwrap();
    } catch (err: any) {
      // Dismissing the sheet is not a failure and must not raise a banner.
      if (err?.code === 'ERR_REQUEST_CANCELED') return;
      onError?.(
        typeof err === 'string'
          ? err
          : err?.message || "Apple sign-in didn't work. Try your email address instead.",
      );
    }
  }, [dispatch, onError]);

  if (Platform.OS !== 'ios' || !available) return null;

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      // Against the auth screens' dark, blurred background, the white button is
      // the legible one; the system picks it up from the scheme elsewhere.
      buttonStyle={
        scheme === 'dark'
          ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
          : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
      }
      cornerRadius={10}
      style={styles.button}
      onPress={signIn}
    />
  );
}

const styles = StyleSheet.create({
  // Height is Apple's business, within limits — 48 matches the Google button
  // beside it so the pair reads as one set of choices.
  button: { height: 48, width: '100%', marginTop: 10 },
});

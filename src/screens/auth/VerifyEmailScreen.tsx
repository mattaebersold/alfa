import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ImageBackground, Linking, Dimensions,
} from 'react-native';
import { Text, type TextInput } from '../../theme/Text';
import FormScrollView from '../../keyboard/FormScrollView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { ArrowLeft } from 'lucide-react-native';
import { useAppDispatch } from '../../store/store';
import {
  verifyEmail, resendVerification, userLogin,
  type VerifyRejection, startOnboarding } from '../../store/authSlice';
import Button from '../../components/ui/Button';
import CodeInput, { CODE_LENGTH } from '../../components/auth/CodeInput';
import { colors } from '../../constants/colors';
import type { AuthScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';
import { FONT_INTER } from '../../constants/fonts'
import { COLOR_ERROR_BG, COLOR_WHITE } from '../../constants/config';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const RESEND_COOLDOWN = 60;
const SUPPORT_EMAIL = 'matt@openroadsociety.co';

export default function VerifyEmailScreen({ navigation, route }: AuthScreenProps<'VerifyEmail'>) {
  const { email, password, verificationSent } = route.params;
  const dispatch = useAppDispatch();

  const [code, setCode] = useState('');
  // A code just went out (registration or login sent it), so resend starts
  // cooling down — unless it didn't go out, in which case resend is the answer.
  const [cooldown, setCooldown] = useState(verificationSent === false ? 0 : RESEND_COOLDOWN);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(
    verificationSent === false
      ? "We couldn't send your code. Tap \"Resend code\" to try again."
      : null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const finish = async () => {
    // Verified — log straight in so we land on the home feed instead of
    // bouncing back to the login form.
    if (password) {
      const login = await dispatch(userLogin({ email, password }));
      if (userLogin.fulfilled.match(login)) {
        // A brand-new account: the first-car step opens over the app.
        dispatch(startOnboarding());
        return; // RootNavigator swaps to the app
      }
    }
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const submit = async (value: string) => {
    if (value.length < CODE_LENGTH || verifying) return;
    setError(null);
    setNotice(null);
    setVerifying(true);
    const result = await dispatch(verifyEmail({ email, code: value }));
    if (verifyEmail.fulfilled.match(result)) {
      await finish();
      setVerifying(false);
      return;
    }
    setVerifying(false);
    const rejection = result.payload as VerifyRejection | undefined;
    setError(rejection?.message ?? 'Verification failed');
    // Clear it either way — a wrong code is retyped from scratch, and a dead
    // one can't be used at all. A dead one also means resend is the only way
    // forward, so it's offered straight away.
    setCode('');
    if (rejection?.expired) setCooldown(0);
    else inputRef.current?.focus();
  };

  const handleCodeChange = (value: string) => {
    setCode(value);
    if (error) setError(null);
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setError(null);
    setNotice(null);
    setResending(true);
    const result = await dispatch(resendVerification(email));
    setResending(false);
    if (resendVerification.fulfilled.match(result)) {
      if (result.payload?.alreadyVerified) return finish();
      setCode('');
      setCooldown(RESEND_COOLDOWN);
      setNotice(`New code sent to ${email}. It can take a minute to arrive.`);
      inputRef.current?.focus();
      return;
    }
    const rejection = result.payload as VerifyRejection | undefined;
    setError(rejection?.message ?? 'Failed to resend code');
    if (rejection?.retryAfter) setCooldown(rejection.retryAfter);
  };

  return (
    <ImageBackground
      source={require('../../../assets/splash.jpg')}
      style={ss.fill}
      resizeMode="cover"
    >
      <SafeAreaView style={[ss.fill, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
        {/* To login, not back: the account exists by now, and what's
            behind this screen is either the sign-up form (whose button
            would only say the email is taken) or the login form anyway. */}
        <TouchableOpacity
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
          style={styles.backBtn}
          hitSlop={8}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back to login"
        >
          <ArrowLeft size={20} color={COLOR_WHITE} />
        </TouchableOpacity>
        <FormScrollView
          style={styles.flex}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <BlurView intensity={60} tint="dark" style={styles.form}>
            <Text style={styles.subtitle}>
              We sent a code to{'\n'}
              <Text style={styles.emailText}>{email}</Text>
            </Text>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {notice && !error && (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            )}

            <CodeInput
              ref={inputRef}
              value={code}
              onChange={handleCodeChange}
              onComplete={submit}
              editable={!verifying}
            />

            <View style={styles.gap} />

            <Button
              label="Verify"
              onPress={() => submit(code)}
              loading={verifying}
              disabled={code.length < CODE_LENGTH}
              size="full"
              variant="dark"
            />

            <TouchableOpacity
              onPress={handleResend}
              style={styles.resendBtn}
              disabled={cooldown > 0 || resending}
              activeOpacity={0.7}
            >
              <Text style={[styles.resendText, (cooldown > 0 || resending) && styles.resendDisabled]}>
                {resending ? 'Sending…' : cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>

            <Text
              style={[styles.helpText, styles.helpLink]}
              onPress={() => Linking.openURL(
                `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Trouble verifying my email')}`
                + `&body=${encodeURIComponent(`I can't verify ${email}.`)}`,
              )}
            >
              Contact support
            </Text>
          </BlurView>
        </FormScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: SCREEN_HEIGHT * 0.15 + 24,
  },
  form: {
    borderRadius: 14,
    padding: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginTop: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
    marginBottom: 24,
  },
  emailText: { fontWeight: '700', color: COLOR_WHITE },
  errorBox: { backgroundColor: COLOR_ERROR_BG, borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: colors.red, fontSize: 14, fontFamily: FONT_INTER.medium },
  noticeBox: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 8, padding: 12, marginBottom: 16 },
  noticeText: { color: COLOR_WHITE, fontSize: 14, fontFamily: FONT_INTER.medium },
  gap: { height: 20 },
  resendBtn: { alignItems: 'center', marginTop: 16 },
  resendText: { fontSize: 14, color: colors.cream, fontFamily: FONT_INTER.medium },
  resendDisabled: { opacity: 0.45 },
  helpText: {
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 14,
  },
  helpLink: { color: '#FFFFFF', textDecorationLine: 'underline' },
});

import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ImageBackground, Image, Pressable, Linking,
} from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { FormScrollView } from '@ors/kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useAppDispatch } from '../../store/store';
import {
  verifyEmail, resendVerification, changeVerificationEmail, userLogin,
  type VerifyRejection,
} from '../../store/authSlice';
import Button from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import type { AuthScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';
import { FONT_INTER } from '../../constants/fonts'
import { COLOR_ERROR_BG, COLOR_WHITE } from '../../constants/config';

const RESEND_COOLDOWN = 60;
const CODE_LENGTH = 6;
const SUPPORT_EMAIL = 'matt@openroadsociety.co';

export default function VerifyEmailScreen({ navigation, route }: AuthScreenProps<'VerifyEmail'>) {
  const { password, verificationSent } = route.params;
  const dispatch = useAppDispatch();

  // The address can change under us — see "Use a different email".
  const [email, setEmail] = useState(route.params.email);
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
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

  const [changing, setChanging] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  /**
   * One real input behind the six boxes.
   *
   * It used to be six inputs of maxLength 1, and iOS applies maxLength to
   * autofill as well as typing — so the code Mail offers above the keyboard
   * arrived as its first digit only. One field takes a paste or an autofill
   * whole; the boxes just draw its value.
   */
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
      if (userLogin.fulfilled.match(login)) return; // RootNavigator swaps to the app
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
    const clean = value.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
    setCode(clean);
    if (error) setError(null);
    // Autofill and paste land all six at once; typing lands the sixth last.
    // Either way, a full code is submitted without a tap on Verify.
    if (clean.length === CODE_LENGTH) submit(clean);
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

  const handleChangeEmail = async () => {
    const next = newEmail.trim().toLowerCase();
    if (!password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setNotice(null);
    setSavingEmail(true);
    const result = await dispatch(changeVerificationEmail({ email, password, newEmail: next }));
    setSavingEmail(false);
    if (changeVerificationEmail.fulfilled.match(result)) {
      setEmail(result.payload.email);
      setChanging(false);
      setNewEmail('');
      setCode('');
      if (result.payload.verificationSent) {
        setCooldown(RESEND_COOLDOWN);
        setNotice(`Code sent to ${result.payload.email}.`);
      } else {
        setCooldown(0);
        setError("We updated your email but couldn't send the code. Tap \"Resend code\".");
      }
      return;
    }
    setError((result.payload as VerifyRejection | undefined)?.message ?? 'Could not change email');
  };

  return (
    <ImageBackground
      source={require('../../../assets/splash.jpg')}
      style={ss.fill}
      resizeMode="cover"
    >
      <SafeAreaView style={[ss.fill, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
        <FormScrollView
          style={styles.flex}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.logoTitle}>Open Road{'\n'}Society</Text>
          </View>

          <BlurView intensity={40} tint="dark" style={styles.form}>
            {/* To login, not back: the account exists by now, and what's
                behind this screen is either the sign-up form (whose button
                would only say the email is taken) or the login form anyway. */}
            <TouchableOpacity
              onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
              style={styles.backBtn}
            >
              <Text style={styles.back}>← Back to login</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{'\n'}
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

            <Pressable style={styles.codeRow} onPress={() => inputRef.current?.focus()}>
              {Array.from({ length: CODE_LENGTH }, (_, i) => {
                const active = focused && i === Math.min(code.length, CODE_LENGTH - 1);
                return (
                  <View
                    key={i}
                    style={[
                      styles.codeBox,
                      code[i] ? styles.codeBoxFilled : null,
                      active ? styles.codeBoxActive : null,
                    ]}
                  >
                    <Text style={styles.codeDigit}>{code[i] ?? ''}</Text>
                  </View>
                );
              })}
              <TextInput
                ref={inputRef}
                style={styles.hiddenInput}
                value={code}
                onChangeText={handleCodeChange}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                keyboardType="number-pad"
                maxLength={CODE_LENGTH}
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                autoFocus
                caretHidden
                editable={!verifying}
              />
            </Pressable>

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

            <Text style={styles.helpText}>
              Didn't get it? Check your spam or promotions folder — codes can take a minute to arrive.
              Still stuck?{' '}
              <Text
                style={styles.helpLink}
                onPress={() => Linking.openURL(
                  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Trouble verifying my email')}`
                  + `&body=${encodeURIComponent(`I can't verify ${email}.`)}`,
                )}
              >
                Contact support
              </Text>
            </Text>

            {/* A typo at sign-up otherwise leaves an account nobody can
                verify. Needs the password to prove it's theirs, which we
                only have when they came here from signing up or in. */}
            {password && (
              changing ? (
                <View style={styles.changeBox}>
                  <TextInput
                    style={styles.changeInput}
                    value={newEmail}
                    onChangeText={setNewEmail}
                    placeholder="New email address"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    autoComplete="email"
                  />
                  <Button
                    label="Send code to this email"
                    onPress={handleChangeEmail}
                    loading={savingEmail}
                    disabled={!newEmail.trim()}
                    size="full"
                    variant="dark"
                  />
                  <TouchableOpacity onPress={() => setChanging(false)} style={styles.resendBtn}>
                    <Text style={styles.linkText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setChanging(true)} style={styles.resendBtn} activeOpacity={0.7}>
                  <Text style={styles.linkText}>Wrong email? Use a different one</Text>
                </TouchableOpacity>
              )
            )}
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
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: { width: 180, height: 80 },
  logoTitle: {
    color: COLOR_WHITE,
    fontSize: 13,
    fontFamily: FONT_INTER.semibold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 20,
  },
  form: {
    borderRadius: 14,
    padding: 18,
    overflow: 'hidden',
  },
  backBtn: { marginBottom: 12 },
  back: { fontSize: 14, color: colors.primaryAlt, fontFamily: FONT_INTER.semibold },
  title: { fontSize: 18, fontFamily: FONT_INTER.bold, color: COLOR_WHITE, marginBottom: 8 },
  subtitle: {
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
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  codeBox: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxFilled: {
    borderColor: COLOR_WHITE,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  codeBoxActive: { borderColor: colors.cream },
  codeDigit: { color: COLOR_WHITE, fontSize: 22, fontFamily: FONT_INTER.bold },
  // Covers the boxes so a tap anywhere on them lands in it, but draws nothing.
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.01, color: 'transparent' },
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
  linkText: { fontSize: 13, color: colors.cream, fontFamily: FONT_INTER.medium, textDecorationLine: 'underline' },
  changeBox: { marginTop: 16, gap: 10 },
  changeInput: {
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: COLOR_WHITE,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});

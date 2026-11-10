import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Linking } from 'react-native';
import { Text, type TextInput } from '@ors/kit';
import { KeyboardAvoidingView } from '@ors/kit';
import { BlurView } from 'expo-blur';
import { useAppDispatch } from '../../store/store';
import {
  verifyEmail, resendVerification, logout, type VerifyRejection,
} from '../../store/authSlice';
import { useGetLoggedInUserQuery } from '../../api/apiService';
import Button from '../ui/Button';
import CodeInput, { CODE_LENGTH } from './CodeInput';
import { colors } from '../../constants/colors';
import { FONT_INTER } from '../../constants/fonts';
import { COLOR_ERROR_TEXT_LIGHT, COLOR_WHITE } from '../../constants/config';

const RESEND_COOLDOWN = 60;
const SUPPORT_EMAIL = 'matt@openroadsociety.co';

/**
 * The verify-your-email step, over the app, for a signed-in account that
 * skipped it.
 *
 * Sign-up sends you to the code screen, but backing out of it and signing in
 * got you into the app unverified — the server's login gate is behind a flag.
 * This covers every way in (a fresh login, a stored session, an older build's
 * token) because it reads the profile's `needsEmailVerification` rather than
 * how you arrived.
 *
 * It can't be closed: no "Not now", and Android's back does nothing. Signing
 * out is the only other way off it, for someone whose address is dead.
 *
 * A code goes out when it opens — nothing else would have sent one since
 * they last saw the code screen, if they ever did.
 */
export default function EmailVerificationGate() {
  const dispatch = useAppDispatch();
  const { data: user, refetch } = useGetLoggedInUserQuery();
  const email = user?.email ?? '';
  const needed = !!user?.needsEmailVerification && !!email;

  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const sentFor = useRef<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = async () => {
    setError(null);
    setResending(true);
    const result = await dispatch(resendVerification(email));
    setResending(false);
    if (resendVerification.fulfilled.match(result)) {
      if (result.payload?.alreadyVerified) { refetch(); return; }
      setCode('');
      setCooldown(RESEND_COOLDOWN);
      return;
    }
    const rejection = result.payload as VerifyRejection | undefined;
    setError(rejection?.message ?? "We couldn't send your code. Tap \"Resend code\" to try again.");
    if (rejection?.retryAfter) setCooldown(rejection.retryAfter);
  };

  // Once per address per session — a refetch mustn't send another.
  useEffect(() => {
    if (!needed || sentFor.current === email) return;
    sentFor.current = email;
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needed, email]);

  const submit = async (value: string) => {
    if (value.length < CODE_LENGTH || verifying) return;
    setError(null);
    setVerifying(true);
    const result = await dispatch(verifyEmail({ email, code: value }));
    if (verifyEmail.fulfilled.match(result)) {
      // The refetched profile says it's done, and this unmounts.
      await refetch();
      setVerifying(false);
      return;
    }
    setVerifying(false);
    const rejection = result.payload as VerifyRejection | undefined;
    setError(rejection?.message ?? 'Verification failed');
    setCode('');
    if (rejection?.expired) setCooldown(0);
    else inputRef.current?.focus();
  };

  if (!needed) return null;

  const resendDisabled = cooldown > 0 || resending;

  return (
    // No-op close: Android's back button must not dismiss it.
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <KeyboardAvoidingView style={styles.backdrop}>
        <BlurView intensity={60} tint="dark" style={styles.card}>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            Enter the code we sent to{'\n'}
            <Text style={styles.emailText}>{email}</Text>
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <CodeInput
            ref={inputRef}
            value={code}
            onChange={(v) => { setCode(v); if (error) setError(null); }}
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

          <TouchableOpacity onPress={send} style={styles.linkBtn} disabled={resendDisabled} activeOpacity={0.7}>
            <Text style={[styles.resendText, resendDisabled && styles.disabled]}>
              {resending ? 'Sending…' : cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text
              style={styles.footerLink}
              onPress={() => Linking.openURL(
                `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Trouble verifying my email')}`
                + `&body=${encodeURIComponent(`I can't verify ${email}.`)}`,
              )}
            >
              Contact support
            </Text>
            <Text style={styles.footerDot}>·</Text>
            <Text style={styles.footerLink} onPress={() => dispatch(logout())}>
              Sign out
            </Text>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 48,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  card: {
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  title: { fontSize: 18, fontFamily: FONT_INTER.bold, color: COLOR_WHITE, textAlign: 'center', marginBottom: 8 },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginBottom: 24,
  },
  emailText: { fontWeight: '700', color: COLOR_WHITE },
  errorText: { color: COLOR_ERROR_TEXT_LIGHT, fontSize: 13, fontFamily: FONT_INTER.semibold, textAlign: 'center', marginBottom: 16 },
  gap: { height: 20 },
  linkBtn: { alignItems: 'center', marginTop: 16 },
  resendText: { fontSize: 14, color: colors.cream, fontFamily: FONT_INTER.medium },
  disabled: { opacity: 0.45 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 14 },
  footerLink: { fontSize: 12, color: COLOR_WHITE, textDecorationLine: 'underline' },
  footerDot: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
});

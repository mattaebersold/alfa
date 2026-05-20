import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ImageBackground, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { verifyEmail, resendVerification, clearError } from '../../store/authSlice';
import Button from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import type { AuthScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';

const RESEND_COOLDOWN = 60;

export default function VerifyEmailScreen({ navigation, route }: AuthScreenProps<'VerifyEmail'>) {
  const { email } = route.params;
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((s) => s.auth);

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(0);
  const refs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

  useEffect(() => {
    dispatch(clearError());
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleDigitChange = (index: number, value: string) => {
    const clean = value.replace(/[^0-9]/g, '');
    if (clean.length > 1) {
      // Autofill / paste — distribute all digits at once
      const next = Array.from({ length: 6 }, (_, i) => clean[i] ?? '');
      setDigits(next);
      refs[Math.min(clean.length - 1, 5)].current?.focus();
      return;
    }
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < 5) refs[index + 1].current?.focus();
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      refs[index - 1].current?.focus();
    }
  };

  const code = digits.join('');

  const handleVerify = async () => {
    if (code.length < 6) return;
    dispatch(clearError());
    const result = await dispatch(verifyEmail({ email, code }));
    if (verifyEmail.fulfilled.match(result)) {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    dispatch(clearError());
    const result = await dispatch(resendVerification(email));
    if (resendVerification.fulfilled.match(result)) {
      setDigits(['', '', '', '', '', '']);
      refs[0].current?.focus();
      setCooldown(RESEND_COOLDOWN);
    }
  };

  return (
    <ImageBackground
      source={require('../../../assets/splash.jpg')}
      style={ss.fill}
      resizeMode="cover"
    >
      <SafeAreaView style={[ss.fill, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
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
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Text style={styles.back}>← Back</Text>
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

              <View style={styles.codeRow}>
                {digits.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={refs[i]}
                    style={[styles.codeBox, digit ? styles.codeBoxFilled : null]}
                    value={digit}
                    onChangeText={(v) => handleDigitChange(i, v)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                    keyboardType="numeric"
                    maxLength={1}
                    selectTextOnFocus
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                  />
                ))}
              </View>

              <View style={styles.gap} />

              <Button
                label="Verify"
                onPress={handleVerify}
                loading={loading}
                disabled={code.length < 6}
                size="full"
                variant="dark"
              />

              <TouchableOpacity
                onPress={handleResend}
                style={styles.resendBtn}
                disabled={cooldown > 0}
                activeOpacity={0.7}
              >
                <Text style={[styles.resendText, cooldown > 0 && styles.resendDisabled]}>
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </Text>
              </TouchableOpacity>
            </BlurView>
          </ScrollView>
        </KeyboardAvoidingView>
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
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
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
  back: { fontSize: 14, color: colors.primaryAlt, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
    marginBottom: 24,
  },
  emailText: { fontWeight: '700', color: '#FFFFFF' },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: colors.red, fontSize: 14, fontWeight: '500' },
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
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  codeBoxFilled: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  gap: { height: 20 },
  resendBtn: { alignItems: 'center', marginTop: 16 },
  resendText: { fontSize: 14, color: colors.cream, fontWeight: '500' },
  resendDisabled: { opacity: 0.45 },
});

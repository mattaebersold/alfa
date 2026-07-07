import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ImageBackground, Image,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, Check } from 'lucide-react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { useAppDispatch, useAppSelector } from '../../store/store';
import { userLogin, clearError } from '../../store/authSlice';
import Button from '../../components/ui/Button';
import TermsModal from '../../components/auth/TermsModal';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AuthScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';

export default function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((s) => s.auth);
  const colors = useColors();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    if (!termsAccepted) {
      Alert.alert('Terms required', 'Please accept the terms and conditions to continue.');
      return;
    }
    dispatch(clearError());
    dispatch(userLogin({ email: email.trim().toLowerCase(), password }));
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
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>Email or Username</Text>
                <TextInput
                  style={[ss.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.inputBg }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder=""
                  placeholderTextColor={colors.grey}
                  autoCapitalize="none"
                  keyboardType="default"
                  autoCorrect={false}
                  textContentType="username"
                  autoComplete="username"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={[ss.input, styles.inputWithEye, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.inputBg }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder=""
                    placeholderTextColor={colors.grey}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    textContentType="password"
                    autoComplete="current-password"
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                    {showPassword
                      ? <Eye size={18} color={colors.grey} />
                      : <EyeOff size={18} color={colors.grey} />}
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                style={styles.forgotLink}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              <View style={styles.termsRow}>
                <TouchableOpacity
                  style={styles.termsCheck}
                  onPress={() => setTermsAccepted(v => !v)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                    {termsAccepted && <Check size={11} color="#FFF" />}
                  </View>
                  <Text style={styles.termsText}>
                    I accept the terms and conditions
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTermsVisible(true)} hitSlop={8} activeOpacity={0.7}>
                  <Text style={styles.termsView}>View</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7}>
                  <Text style={styles.registerLink}>Register</Text>
                </TouchableOpacity>
                <Button
                  label="Sign In"
                  onPress={handleLogin}
                  loading={loading}
                  size="default"
                  variant="dark"
                />
              </View>
            </BlurView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <TermsModal
        visible={termsVisible}
        onClose={() => setTermsVisible(false)}
        onAccept={() => setTermsAccepted(true)}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: SCREEN_HEIGHT * 0.2 + 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 180,
    height: 80,
  },
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
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.red,
    fontSize: 14,
    fontWeight: '500',
  },
  field: { marginBottom: 12 },
  inputWrap: { position: 'relative' },
  inputWithEye: { paddingRight: 44 },
  eyeBtn: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    color: '#FFFFFF',
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -8,
  },
  forgotText: {
    fontSize: 13,
    color: colors.cream,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  registerLink: {
    fontSize: 14,
    color: colors.cream,
    fontWeight: '500',
  },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  termsCheck: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt },
  termsText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 19 },
  termsView: {
    fontSize: 13, color: '#FFFFFF', fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

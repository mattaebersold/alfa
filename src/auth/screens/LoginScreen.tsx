import React, { useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Alert, Image, Dimensions,
} from 'react-native';
import { Text, TextInput } from '../../theme/Text';
import FormScrollView from '../../keyboard/FormScrollView';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff } from 'lucide-react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
/** alfa's light cream — the links on the blurred card. */
const CREAM = '#F5EFED';
import { useOrsDispatch, useOrsSelector } from '../../store/createStore';
import { userLogin, clearError } from '../authSlice';
import Button from '../../components/Button';
import CrossfadeBackground from '../../components/CrossfadeBackground';
import { colors } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { useAuthBranding, type AuthScreenProps } from '../branding';
import { ss } from '../../theme/shared';
import GoogleSignInButton from '../GoogleSignInButton';
import AppleSignInButton from '../AppleSignInButton';
import { FONT_INTER } from '../../theme/fonts';

export default function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const dispatch = useOrsDispatch();
  const { loading, error, sessionExpired } = useOrsSelector((s) => s.auth);
  /** Google's own failures, which never reach the auth slice's `error`. */
  const [googleError, setGoogleError] = useState<string | null>(null);
  const colors = useColors();
  const branding = useAuthBranding();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    // No terms gate here. Accepting them is part of making an account, and a
    // member signing back in already did that — asking again every time read
    // as the app having forgotten, and the checkbox was one more thing between
    // a password and the feed.
    dispatch(clearError());
    dispatch(userLogin({ email: email.trim().toLowerCase(), password }));
  };

  return (
    <CrossfadeBackground
      sources={branding.backgrounds}
      style={ss.fill}
    >
      <SafeAreaView style={[ss.fill, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
        <FormScrollView
          style={styles.flex}
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Image
                source={branding.logo}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.logoTitle}>{branding.title}</Text>
              {branding.accountNote ? (
                <Text style={styles.accountNote}>{branding.accountNote}</Text>
              ) : null}
            </View>

            <BlurView intensity={40} tint="dark" style={styles.form}>
              {/* Says why they're looking at this screen. Without it, being
                  returned to a login form mid-session reads as the app having
                  forgotten them for no reason. A real login error supersedes
                  it — that's the more recent news. */}
              {sessionExpired && !error && (
                <View style={styles.noticeBox}>
                  <Text style={styles.noticeText}>
                    Your session expired. Please sign in again.
                  </Text>
                </View>
              )}

              {(error || googleError) && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error || googleError}</Text>
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

              <View style={styles.actionRow}>
                <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7}>
                  <Text style={styles.registerLink}>Create an account</Text>
                </TouchableOpacity>
                <Button
                  label="Sign In"
                  onPress={handleLogin}
                  loading={loading}
                  size="default"
                  variant="brand"
                />
              </View>

              {/* Google sits below the form rather than above it. The email
                  field is what returning members reach for, and a provider
                  button at the top of a login screen reads as the primary path
                  when it is the alternative one. */}
              <View style={styles.altRow}>
                <View style={styles.altLine} />
                <Text style={styles.altLabel}>or</Text>
                <View style={styles.altLine} />
              </View>

              <GoogleSignInButton
                label="Sign in with Google"
                onError={setGoogleError}
              />
              <AppleSignInButton onError={setGoogleError} />
            </BlurView>
        </FormScrollView>
      </SafeAreaView>

    </CrossfadeBackground>
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
    fontFamily: FONT_INTER.semibold,
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
  noticeBox: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: FONT_INTER.medium,
  },
  altRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, marginBottom: 14 },
  altLine:  { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  altLabel: { fontSize: 12, fontFamily: FONT_INTER.bold, color: 'rgba(255,255,255,0.7)' },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.red,
    fontSize: 14,
    fontFamily: FONT_INTER.medium,
  },
  field: { marginBottom: 12 },
  inputWrap: { position: 'relative' },
  inputWithEye: { paddingRight: 44 },
  eyeBtn: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  label: {
    fontSize: 12,
    fontFamily: FONT_INTER.semibold,
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
    color: CREAM,
    fontFamily: FONT_INTER.medium,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  registerLink: {
    fontSize: 14,
    color: CREAM,
    fontFamily: FONT_INTER.medium,
  },
  accountNote: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 17,
  },
});

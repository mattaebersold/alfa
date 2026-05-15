import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ImageBackground, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { registerUser, clearError } from '../../store/authSlice';
import Button from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AuthScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';

export default function RegisterScreen({ navigation }: AuthScreenProps<'Register'>) {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((s) => s.auth);
  const colors = useColors();

  const [step, setStep] = useState<1 | 2>(1);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    zip: '',
  });

  const handleChange = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleStep1 = () => {
    if (!form.firstName || !form.lastName || !form.username || !form.email || !form.password) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    dispatch(clearError());
    setStep(2);
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to upload a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setPhoto(result.assets[0]);
  };

  const handleRegister = async () => {
    const fd = new FormData();
    fd.append('firstName', form.firstName.trim());
    fd.append('lastName', form.lastName.trim());
    fd.append('username', form.username.trim().toLowerCase());
    fd.append('email', form.email.trim().toLowerCase());
    fd.append('password', form.password);
    fd.append('zip', form.zip.trim());

    if (photo) {
      fd.append('profilePhoto', {
        uri: photo.uri,
        name: 'profile.jpg',
        type: 'image/jpeg',
      } as any);
    }

    dispatch(clearError());
    const result = await dispatch(registerUser(fd));
    if (registerUser.fulfilled.match(result)) {
      navigation.navigate('VerifyEmail', { email: form.email.trim().toLowerCase() });
    }
  };

  const fields: { key: keyof typeof form; label: string; secure?: boolean; keyboard?: any }[] = [
    { key: 'firstName',       label: 'First Name *' },
    { key: 'lastName',        label: 'Last Name *' },
    { key: 'username',        label: 'Username *' },
    { key: 'email',           label: 'Email *', keyboard: 'email-address' },
    { key: 'password',        label: 'Password *', secure: true },
    { key: 'confirmPassword', label: 'Confirm Password *', secure: true },
    { key: 'zip',             label: 'Zip Code', keyboard: 'numeric' },
  ];

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
              <TouchableOpacity
                onPress={() => step === 2 ? setStep(1) : navigation.goBack()}
                style={styles.backBtn}
              >
                <Text style={styles.back}>← Back</Text>
              </TouchableOpacity>

              <View style={styles.stepRow}>
                <Text style={styles.title}>
                  {step === 1 ? 'Create Account' : 'Profile Photo'}
                </Text>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepText}>Step {step} of 2</Text>
                </View>
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {step === 1 ? (
                <>
                  {fields.map(({ key, label, secure, keyboard }) => (
                    <View key={key} style={styles.field}>
                      <Text style={styles.label}>{label}</Text>
                      <TextInput
                        style={[ss.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.inputBg }]}
                        value={form[key]}
                        onChangeText={handleChange(key)}
                        placeholder=""
                        placeholderTextColor={colors.grey}
                        secureTextEntry={secure}
                        autoCapitalize={key === 'username' || key === 'email' ? 'none' : 'words'}
                        keyboardType={keyboard ?? 'default'}
                        autoCorrect={false}
                      />
                    </View>
                  ))}

                  <View style={styles.gap} />

                  <Button
                    label="Continue"
                    onPress={handleStep1}
                    size="full"
                    variant="dark"
                  />

                  <TouchableOpacity
                    onPress={() => navigation.navigate('Login')}
                    style={styles.signinLink}
                  >
                    <Text style={styles.signinText}>Already have an account? Sign in</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.photoHint}>
                    Add a profile photo so people know who you are. This is optional — you can always add one later.
                  </Text>

                  <TouchableOpacity style={styles.photoPicker} onPress={handlePickPhoto} activeOpacity={0.8}>
                    {photo ? (
                      <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <Text style={styles.photoPlaceholderIcon}>📷</Text>
                        <Text style={styles.photoPlaceholderText}>Tap to choose a photo</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {photo && (
                    <TouchableOpacity onPress={() => setPhoto(null)} style={styles.removePhotoBtn}>
                      <Text style={styles.removePhotoText}>Remove photo</Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.gap} />

                  <Button
                    label="Create account"
                    onPress={handleRegister}
                    loading={loading}
                    size="full"
                    variant="dark"
                  />

                  <TouchableOpacity
                    onPress={() => navigation.navigate('Login')}
                    style={styles.signinLink}
                  >
                    <Text style={styles.signinText}>Already have an account? Sign in</Text>
                  </TouchableOpacity>
                </>
              )}
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
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  stepBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: colors.red, fontSize: 14, fontWeight: '500' },
  field: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4, color: '#FFFFFF' },
  gap: { height: 8 },
  signinLink: { alignItems: 'center', marginTop: 16 },
  signinText: { fontSize: 14, color: colors.cream, fontWeight: '400' },
  photoHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 19,
    marginBottom: 20,
  },
  photoPicker: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginBottom: 12,
  },
  photoPreview: { width: 120, height: 120 },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoPlaceholderIcon: { fontSize: 28 },
  photoPlaceholderText: { fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  removePhotoBtn: { alignSelf: 'center', marginBottom: 8 },
  removePhotoText: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },
});

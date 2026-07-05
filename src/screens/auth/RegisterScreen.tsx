import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Modal,
  ImageBackground, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { ChevronLeft, Eye, EyeOff, Check, X } from 'lucide-react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import * as ImagePicker from 'expo-image-picker';
import { uploadFile } from '../../utils/upload';
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

  const [showPasswords, setShowPasswords] = useState<Partial<Record<keyof typeof form, boolean>>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const toggleShow = (key: keyof typeof form) =>
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));

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
    if (!termsAccepted) {
      Alert.alert('Terms required', 'Please accept the terms and conditions to continue.');
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

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to take a profile picture.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
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
      fd.append('profilePhoto', uploadFile(photo.uri));
    }

    dispatch(clearError());
    const result = await dispatch(registerUser(fd));
    if (registerUser.fulfilled.match(result)) {
      navigation.navigate('VerifyEmail', { email: form.email.trim().toLowerCase() });
    }
  };

  const fields: {
    key: keyof typeof form;
    label: string;
    secure?: boolean;
    keyboard?: any;
    contentType?: any;
    autoComplete?: any;
  }[] = [
    { key: 'firstName',       label: 'First Name *',        contentType: 'givenName',     autoComplete: 'name-given' },
    { key: 'lastName',        label: 'Last Name *',         contentType: 'familyName',    autoComplete: 'name-family' },
    { key: 'username',        label: 'Username *',          contentType: 'username',      autoComplete: 'username-new' },
    { key: 'email',           label: 'Email *',             contentType: 'emailAddress',  autoComplete: 'email',        keyboard: 'email-address' },
    { key: 'password',        label: 'Password *',          contentType: 'newPassword',   autoComplete: 'new-password', secure: true },
    { key: 'confirmPassword', label: 'Confirm Password *',  contentType: 'newPassword',   autoComplete: 'new-password', secure: true },
    { key: 'zip',             label: 'Zip Code',            contentType: 'postalCode',    autoComplete: 'postal-code',  keyboard: 'numeric' },
  ];

  return (
    <ImageBackground
      source={require('../../../assets/splash.jpg')}
      style={ss.fill}
      resizeMode="cover"
    >
      <SafeAreaView style={[ss.fill, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => step === 2 ? setStep(1) : navigation.navigate('Login')}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <ChevronLeft size={18} color="#FFFFFF" />
          <Text style={styles.backToLogin}>Back to login</Text>
        </TouchableOpacity>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <BlurView intensity={40} tint="dark" style={styles.form}>
              <Text style={styles.title}>
                {step === 1 ? 'Create Account' : 'Profile Photo'}
              </Text>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {step === 1 ? (
                <>
                  {fields.map(({ key, label, secure, keyboard, contentType, autoComplete }) => (
                    <View key={key} style={styles.field}>
                      <Text style={styles.label}>{label}</Text>
                      <View style={secure ? styles.inputWrap : undefined}>
                        <TextInput
                          style={[ss.input, secure && styles.inputWithEye, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.inputBg }]}
                          value={form[key]}
                          onChangeText={handleChange(key)}
                          placeholder=""
                          placeholderTextColor={colors.grey}
                          secureTextEntry={secure && !showPasswords[key]}
                          autoCapitalize={key === 'username' || key === 'email' ? 'none' : 'words'}
                          keyboardType={keyboard ?? 'default'}
                          autoCorrect={false}
                          textContentType={contentType}
                          autoComplete={autoComplete}
                        />
                        {secure && (
                          <TouchableOpacity style={styles.eyeBtn} onPress={() => toggleShow(key)} hitSlop={8}>
                            {showPasswords[key]
                              ? <Eye size={18} color={colors.grey} />
                              : <EyeOff size={18} color={colors.grey} />}
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}

                  <TouchableOpacity
                    style={styles.termsRow}
                    onPress={() => setTermsAccepted(v => !v)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                      {termsAccepted && <Check size={11} color="#FFF" />}
                    </View>
                    <Text style={styles.termsText}>
                      By creating an account you're accepting the{' '}
                      <Text
                        style={styles.termsLink}
                        onPress={() => setTermsVisible(true)}
                      >
                        terms and conditions
                      </Text>
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.gap} />

                  <Button
                    label="Continue"
                    onPress={handleStep1}
                    size="full"
                    variant="dark"
                  />

                </>
              ) : (
                <>
                  <Text style={styles.photoHint}>
                    Add a profile photo so people know who you are. This is optional — you can always add one later.
                  </Text>

                  <View style={styles.photoCircle}>
                    {photo ? (
                      <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                    ) : (
                      <View style={styles.photoPlaceholder} />
                    )}
                  </View>

                  <View style={styles.photoButtons}>
                    <TouchableOpacity style={styles.photoBtn} onPress={handleTakePhoto} activeOpacity={0.8}>
                      <Text style={styles.photoBtnText}>Take Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto} activeOpacity={0.8}>
                      <Text style={styles.photoBtnText}>Choose Photo</Text>
                    </TouchableOpacity>
                  </View>

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

                </>
              )}
            </BlurView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal visible={termsVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTermsVisible(false)}>
        <SafeAreaView style={styles.termsModal} edges={['top', 'bottom']}>
          <View style={styles.termsModalHeader}>
            <Text style={styles.termsModalTitle}>Terms of Service</Text>
            <TouchableOpacity onPress={() => setTermsVisible(false)} hitSlop={10}>
              <X size={20} color={colors.fg} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.termsScroll} contentContainerStyle={styles.termsScrollContent}>
            <Text style={[styles.termsMeta, { color: colors.muted }]}>Last Updated: May 12, 2026</Text>

            <Text style={[styles.termsH2, { color: colors.fg }]}>Acceptance of Terms</Text>
            <Text style={[styles.termsBody, { color: colors.muted }]}>
              By creating an account or using the Open Road Society mobile application or website (the "Service"), you agree to these Terms of Service. If you do not agree, do not use the Service.
            </Text>

            <Text style={[styles.termsH2, { color: colors.fg }]}>Who Can Use the Service</Text>
            <Text style={[styles.termsBody, { color: colors.muted }]}>
              You must be at least 13 years old to use the Service. By using it, you represent that you meet this requirement.
            </Text>

            <Text style={[styles.termsH2, { color: colors.fg }]}>Your Account</Text>
            <Text style={[styles.termsBody, { color: colors.muted }]}>
              You are responsible for maintaining the security of your account credentials and for all activity that occurs under your account. Notify us at matt@openroadsociety.co if you believe your account has been compromised.
            </Text>

            <Text style={[styles.termsH2, { color: colors.fg }]}>User-Generated Content</Text>
            <Text style={[styles.termsBody, { color: colors.muted }]}>
              You retain full ownership of any content you post to the Service — photos, posts, car listings, modifications, or any other material ("Your Content"). We do not claim any ownership rights over Your Content.{'\n\n'}
              By posting content, you grant Open Road Society a limited license to display and distribute Your Content within the Service solely for the purpose of operating and providing the Service to other users. This license ends when you delete Your Content or your account.{'\n\n'}
              You are solely responsible for Your Content and agree not to post content that:{'\n'}
              {'  '}• Is unlawful, harassing, abusive, or threatening{'\n'}
              {'  '}• Infringes on the intellectual property rights of others{'\n'}
              {'  '}• Contains malware, spam, or deceptive material{'\n'}
              {'  '}• Violates the privacy of others{'\n\n'}
              We reserve the right to remove content that violates these terms.
            </Text>

            <Text style={[styles.termsH2, { color: colors.fg }]}>What We Do Not Do With Your Data</Text>
            <Text style={[styles.termsBody, { color: colors.muted }]}>
              We do not:{'\n'}
              {'  '}• Sell, rent, or share your personal information with advertisers or third parties for marketing purposes{'\n'}
              {'  '}• Use your content or data for advertising targeting{'\n'}
              {'  '}• Claim ownership of any content you upload{'\n\n'}
              For full details on how we handle your data, see our Privacy Policy.
            </Text>

            <Text style={[styles.termsH2, { color: colors.fg }]}>Prohibited Conduct</Text>
            <Text style={[styles.termsBody, { color: colors.muted }]}>
              You agree not to:{'\n'}
              {'  '}• Use the Service for any unlawful purpose{'\n'}
              {'  '}• Attempt to gain unauthorized access to any part of the Service or its infrastructure{'\n'}
              {'  '}• Scrape, crawl, or systematically extract data from the Service{'\n'}
              {'  '}• Impersonate another person or entity{'\n'}
              {'  '}• Interfere with other users' enjoyment of the Service
            </Text>

            <Text style={[styles.termsH2, { color: colors.fg }]}>Account Deletion</Text>
            <Text style={[styles.termsBody, { color: colors.muted }]}>
              You may delete your account at any time from the Settings screen. Upon deletion, your data will be removed from our systems within a reasonable timeframe.
            </Text>

            <Text style={[styles.termsH2, { color: colors.fg }]}>Disclaimers</Text>
            <Text style={[styles.termsBody, { color: colors.muted }]}>
              The Service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free operation of the Service.
            </Text>

            <Text style={[styles.termsH2, { color: colors.fg }]}>Limitation of Liability</Text>
            <Text style={[styles.termsBody, { color: colors.muted }]}>
              To the fullest extent permitted by law, Open Road Society shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.
            </Text>

            <Text style={[styles.termsH2, { color: colors.fg }]}>Changes to These Terms</Text>
            <Text style={[styles.termsBody, { color: colors.muted }]}>
              We may update these Terms from time to time. Continued use of the Service after changes are posted constitutes acceptance of the updated Terms. We will update the "Last Updated" date above when changes are made.
            </Text>

            <Text style={[styles.termsH2, { color: colors.fg }]}>Contact</Text>
            <Text style={[styles.termsBody, { color: colors.muted }]}>
              Questions about these Terms? Contact us at matt@openroadsociety.co.
            </Text>
          </ScrollView>

          <View style={[styles.termsModalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.termsAcceptBtn, { backgroundColor: colors.primaryAlt }]}
              onPress={() => { setTermsAccepted(true); setTermsVisible(false); }}
            >
              <Text style={styles.termsAcceptBtnText}>Accept & Close</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
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
    paddingBottom: SCREEN_HEIGHT * 0.1 + 24,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 2,
  },
  backToLogin: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  form: {
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 16 },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: colors.red, fontSize: 14, fontWeight: '500' },
  field: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4, color: '#FFFFFF' },
  inputWrap: { position: 'relative' },
  inputWithEye: { paddingRight: 44 },
  eyeBtn: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
  gap: { height: 8 },
  photoHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 19,
    marginBottom: 20,
  },
  photoCircle: {
    alignSelf: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 16,
  },
  photoPreview: { width: 100, height: 100 },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    borderStyle: 'dashed',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  photoBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  photoBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  removePhotoBtn: { alignSelf: 'center', marginBottom: 8 },
  removePhotoText: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt },
  termsText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 19 },
  termsLink: { color: '#FFFFFF', textDecorationLine: 'underline', fontWeight: '600' },

  termsModal:       { flex: 1, backgroundColor: '#FFFFFF' },
  termsModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E0E0E0',
  },
  termsModalTitle:  { fontSize: 17, fontWeight: '700', color: '#000' },
  termsScroll:      { flex: 1 },
  termsScrollContent: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 32 },
  termsMeta:        { fontSize: 13, marginBottom: 16 },
  termsH2:          { fontSize: 15, fontWeight: '700', marginTop: 20, marginBottom: 6 },
  termsBody:        { fontSize: 14, lineHeight: 22 },
  termsModalFooter: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  termsAcceptBtn:   { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  termsAcceptBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

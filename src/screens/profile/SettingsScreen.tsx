import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Switch, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import {
  useGetLoggedInUserQuery,
  useUpdateUserSettingMutation,
  useUpdateUserSettingImageMutation,
  useCheckUsernameMutation,
  useCheckEmailMutation,
  useDeleteAccountMutation,
} from '../../api/apiService';
import { useAppDispatch } from '../../store/store';
import { logout } from '../../store/authSlice';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import { ss } from '../../styles/shared';

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <View style={[ss.sectionHeader, { backgroundColor: colors.segment, borderColor: colors.border }]}>
      <Text style={[ss.sectionTitle, { color: colors.grey }]}>{title}</Text>
    </View>
  );
}

function Field({
  label, value, onChangeText, placeholder, secureTextEntry, autoCapitalize, keyboardType, error, hint, multiline,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences';
  keyboardType?: 'default' | 'email-address';
  error?: string; hint?: string; multiline?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.fg }]}>{label}</Text>
      <TextInput
        style={[ss.input, multiline && ss.inputMulti, { borderColor: error ? colors.red : colors.inputBorder, color: colors.fg, backgroundColor: colors.bgDark }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.grey}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        keyboardType={keyboardType}
        autoCorrect={false}
        multiline={multiline}
      />
      {error ? <Text style={[styles.fieldError, { color: colors.red }]}>{error}</Text> : null}
      {hint && !error ? <Text style={[styles.fieldHint, { color: colors.grey }]}>{hint}</Text> : null}
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const dispatch = useAppDispatch();

  const { data: user, isLoading } = useGetLoggedInUserQuery();
  const [updateSetting] = useUpdateUserSettingMutation();
  const [updateImage, { isLoading: uploadingImage }] = useUpdateUserSettingImageMutation();
  const [checkUsername] = useCheckUsernameMutation();
  const [checkEmail] = useCheckEmailMutation();
  const [deleteAccount] = useDeleteAccountMutation();

  // Profile
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [cityState, setCityState] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Username
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);

  // Email
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Email prefs
  const [emailComments, setEmailComments] = useState(false);
  const [emailLikes, setEmailLikes] = useState(false);
  const [emailFollowed, setEmailFollowed] = useState(false);
  const [emailFollowerActivity, setEmailFollowerActivity] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? '');
      setLastName(user.lastName ?? '');
      setBio(user.bio ?? '');
      setCityState(user.cityState ?? '');
      setUsername(user.username ?? '');
      setEmail(user.email ?? '');
      setEmailComments(user.emailSettings?.userComments ?? false);
      setEmailLikes(user.emailSettings?.userLikes ?? false);
      setEmailFollowed(user.emailSettings?.userFollowed ?? false);
      setEmailFollowerActivity(user.emailSettings?.followerActivity ?? false);
    }
  }, [user]);

  const userid = user?.user_id;

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateSetting({ type: 'name', userid, firstName, lastName }).unwrap();
      await updateSetting({ type: 'bio', userid, bio }).unwrap();
      Alert.alert('Saved', 'Profile updated.');
    } catch {
      Alert.alert('Error', 'Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveUsername = async () => {
    setUsernameError('');
    if (!username.trim()) { setUsernameError('Username is required.'); return; }
    if (username === user?.username) { Alert.alert('No change', 'That is already your username.'); return; }
    setSavingUsername(true);
    try {
      const { msg } = await checkUsername({ username }).unwrap();
      if (msg === 'true') { setUsernameError('That username is already taken.'); return; }
      await updateSetting({ type: 'username', userid, username }).unwrap();
      Alert.alert('Saved', 'Username updated.');
    } catch {
      Alert.alert('Error', 'Failed to update username.');
    } finally {
      setSavingUsername(false);
    }
  };

  const handleSaveEmail = async () => {
    setEmailError('');
    if (!email.trim()) { setEmailError('Email is required.'); return; }
    if (email === user?.email) { Alert.alert('No change', 'That is already your email.'); return; }
    setSavingEmail(true);
    try {
      const { msg } = await checkEmail({ email }).unwrap();
      if (msg === 'true') { setEmailError('An account with that email already exists.'); return; }
      await updateSetting({ type: 'email', userid, email }).unwrap();
      Alert.alert('Saved', 'Email updated.');
    } catch {
      Alert.alert('Error', 'Failed to update email.');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSavePassword = async () => {
    setPasswordError('');
    if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return; }
    setSavingPassword(true);
    try {
      await updateSetting({ type: 'password', userid, password: newPassword }).unwrap();
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Saved', 'Password updated.');
    } catch {
      Alert.alert('Error', 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    try {
      await updateSetting({
        type: 'emailSettings', userid,
        emailSettings: JSON.stringify({
          userComments: emailComments,
          userLikes: emailLikes,
          userFollowed: emailFollowed,
          followerActivity: emailFollowerActivity,
        }),
      }).unwrap();
      Alert.alert('Saved', 'Email preferences updated.');
    } catch {
      Alert.alert('Error', 'Failed to save preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const pickAndUpload = async (type: 'gallery' | 'banners', aspect: [number, number]) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('file', {
      uri: asset.uri,
      type: asset.mimeType ?? 'image/jpeg',
      name: asset.fileName ?? 'photo.jpg',
    } as any);
    formData.append('userid', userid ?? '');
    try {
      await updateImage({ type, formData }).unwrap();
    } catch {
      Alert.alert('Error', 'Failed to upload image.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert('Delete Account', 'This permanently deletes your account and all data. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Account', style: 'destructive',
        onPress: async () => { await deleteAccount(); dispatch(logout()); },
      },
    ]);
  };

  if (isLoading) return <Spinner fullScreen />;

  const bannerUri = user?.banners?.[0]?.filename ? imageUrl(user.banners[0].filename) : null;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Photos ──────────────────────────────────────────────── */}
        <SectionHeader title="Photos" />
        <View style={[styles.photoRow, { backgroundColor: colors.bgDark, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.photoItem} onPress={() => pickAndUpload('gallery', [1, 1])} disabled={uploadingImage}>
            <Avatar filename={user?.gallery?.[0]?.filename} name={user?.firstName ?? '?'} size={64} />
            <Text style={[styles.photoLabel, { color: colors.grey }]}>Avatar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBanner} onPress={() => pickAndUpload('banners', [3, 1])} disabled={uploadingImage}>
            {bannerUri
              ? <Image source={{ uri: bannerUri }} style={styles.bannerPreview} contentFit="cover" />
              : <View style={[styles.bannerPreview, { backgroundColor: colors.primaryAlt }]} />
            }
            <Text style={[styles.photoLabel, { color: colors.grey }]}>Banner</Text>
          </TouchableOpacity>
          {uploadingImage && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color={colors.primaryAlt} />
            </View>
          )}
        </View>

        {/* ── Profile ─────────────────────────────────────────────── */}
        <SectionHeader title="Profile" />
        <View style={[styles.card, { backgroundColor: colors.bgDark }]}>
          <View style={styles.cardPad}>
            <Field label="First Name" value={firstName} onChangeText={setFirstName} placeholder="First name" autoCapitalize="words" />
            <Field label="Last Name" value={lastName} onChangeText={setLastName} placeholder="Last name" autoCapitalize="words" />
            <Field label="Bio" value={bio} onChangeText={setBio} placeholder="Tell us about yourself" multiline />
            <Field label="City / State" value={cityState} onChangeText={setCityState} placeholder="e.g. Los Angeles, CA" autoCapitalize="words" />
          </View>
          <SaveButton label="Save Profile" onPress={handleSaveProfile} loading={savingProfile} />
        </View>

        {/* ── Username ─────────────────────────────────────────────── */}
        <SectionHeader title="Username" />
        <View style={[styles.card, { backgroundColor: colors.bgDark }]}>
          <View style={styles.cardPad}>
            <Field
              label="Username"
              value={username}
              onChangeText={(v) => { setUsername(v); setUsernameError(''); }}
              placeholder="username"
              autoCapitalize="none"
              error={usernameError}
              hint="Must be unique. Changing your username will update your public profile URL."
            />
          </View>
          <SaveButton label="Save Username" onPress={handleSaveUsername} loading={savingUsername} />
        </View>

        {/* ── Email ────────────────────────────────────────────────── */}
        <SectionHeader title="Email" />
        <View style={[styles.card, { backgroundColor: colors.bgDark }]}>
          <View style={styles.cardPad}>
            <Field
              label="Email"
              value={email}
              onChangeText={(v) => { setEmail(v); setEmailError(''); }}
              placeholder="email@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              error={emailError}
            />
          </View>
          <SaveButton label="Save Email" onPress={handleSaveEmail} loading={savingEmail} />
        </View>

        {/* ── Password ─────────────────────────────────────────────── */}
        <SectionHeader title="Change Password" />
        <View style={[styles.card, { backgroundColor: colors.bgDark }]}>
          <View style={styles.cardPad}>
            <Field
              label="New Password"
              value={newPassword}
              onChangeText={(v) => { setNewPassword(v); setPasswordError(''); }}
              placeholder="At least 6 characters"
              secureTextEntry
              autoCapitalize="none"
            />
            <Field
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); setPasswordError(''); }}
              placeholder="Repeat new password"
              secureTextEntry
              autoCapitalize="none"
              error={passwordError}
            />
          </View>
          <SaveButton label="Change Password" onPress={handleSavePassword} loading={savingPassword} />
        </View>

        {/* ── Email Preferences ────────────────────────────────────── */}
        <SectionHeader title="Email Preferences" />
        <View style={[styles.card, { backgroundColor: colors.bgDark }]}>
          {[
            { label: 'Comments on my posts', value: emailComments, setter: setEmailComments },
            { label: 'Likes on my posts', value: emailLikes, setter: setEmailLikes },
            { label: 'New followers', value: emailFollowed, setter: setEmailFollowed },
            { label: 'Follower activity', value: emailFollowerActivity, setter: setEmailFollowerActivity },
          ].map(({ label, value, setter }, i) => (
            <View key={label} style={[styles.switchRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Text style={[styles.switchLabel, { color: colors.fg }]}>{label}</Text>
              <Switch
                value={value}
                onValueChange={setter}
                trackColor={{ false: colors.greyLight, true: colors.primaryAlt }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}
          <SaveButton label="Save Preferences" onPress={handleSavePrefs} loading={savingPrefs} secondary />
        </View>

        {/* ── Account ──────────────────────────────────────────────── */}
        <SectionHeader title="Account" />
        <View style={[styles.card, { backgroundColor: colors.bgDark }]}>
          <TouchableOpacity style={styles.dangerRow} onPress={() => Alert.alert('Log Out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log Out', style: 'destructive', onPress: () => dispatch(logout()) },
          ])}>
            <Text style={[styles.dangerText, { color: colors.fg }]}>Log Out</Text>
          </TouchableOpacity>
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity style={[styles.dangerRow, { borderTopWidth: 0 }]} onPress={handleDeleteAccount}>
              <Text style={[styles.dangerText, { color: colors.red }]}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SaveButton({ label, onPress, loading, secondary }: { label: string; onPress: () => void; loading: boolean; secondary?: boolean }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.saveBtn, secondary && { backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.primaryAlt }, loading && styles.saveBtnDisabled]}
      onPress={onPress}
      disabled={loading}
    >
      {loading
        ? <ActivityIndicator size="small" color={secondary ? colors.primaryAlt : '#FFFFFF'} />
        : <Text style={[styles.saveBtnText, secondary && { color: colors.primaryAlt }]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll:       { paddingBottom: 40 },
  card:         { marginBottom: 0 },
  cardPad:      { padding: 16, gap: 4 },

  fieldWrap:    { marginBottom: 12 },
  fieldLabel:   { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  fieldError:   { fontSize: 12, marginTop: 4 },
  fieldHint:    { fontSize: 12, marginTop: 4, lineHeight: 16 },

  photoRow:     { flexDirection: 'row', gap: 16, padding: 16, borderBottomWidth: 1, position: 'relative' },
  photoItem:    { alignItems: 'center', gap: 6 },
  photoBanner:  { flex: 1, alignItems: 'center', gap: 6 },
  photoLabel:   { fontSize: 12, fontWeight: '600' },
  bannerPreview:{ width: '100%', height: 60, borderRadius: 8 },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },

  saveBtn:      { margin: 16, marginTop: 4, backgroundColor: colors.primaryAlt, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText:  { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  switchRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  switchLabel:  { fontSize: 14, flex: 1 },
  dangerRow:    { paddingHorizontal: 16, paddingVertical: 14 },
  dangerText:   { fontSize: 15, fontWeight: '600' },
});

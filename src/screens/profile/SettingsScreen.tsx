import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Switch, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { uploadFile } from '../../utils/upload';
import { Image } from 'expo-image';
import { Plus, Trash2 } from 'lucide-react-native';
import {
  useGetLoggedInUserQuery,
  useUpdateUserSettingMutation,
  useUpdateUserSettingImageMutation,
  useCheckUsernameMutation,
  useCheckEmailMutation,
  useDeleteAccountMutation,
} from '../../api/apiService';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { setContentFilter } from '../../store/moderationSlice';
import { logout } from '../../store/authSlice';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import { validateUsername } from '../../utils/username';
import type { ProfileLink } from '../../types/api';
import { ss } from '../../styles/shared';
import { COMMON_RADIUS } from '../../constants/radius';

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
  keyboardType?: 'default' | 'email-address' | 'number-pad';
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
  const contentFilterEnabled = useAppSelector((s) => (s as any).moderation?.contentFilterEnabled ?? false);

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
  /**
   * The links repeater. Held as a whole list because that's how it's saved —
   * the server rewrites the array on every write rather than patching rows.
   */
  const [links, setLinks] = useState<ProfileLink[]>([]);
  const [savingLinks, setSavingLinks] = useState(false);
  /**
   * The member's zip — private, and the one location they actually type.
   * Everything public comes from it: "Bothell, WA" on the profile, the region
   * every filter sorts by, the map tile, and the point "near me" measures from.
   */
  const [zip, setZip] = useState('');
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


  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? '');
      setLastName(user.lastName ?? '');
      setBio(user.bio ?? '');
      setLinks(user.links ?? []);
      setCityState(user.cityState ?? '');
      setZip(user.zip != null ? String(user.zip).padStart(5, '0') : '');
      setUsername(user.username ?? '');
      setEmail(user.email ?? '');
    }
  }, [user]);

  const userid = user?.user_id;

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateSetting({ type: 'name', userid, firstName, lastName }).unwrap();
      await updateSetting({ type: 'bio', userid, bio }).unwrap();

      // Only when it changed: the server re-geocodes and re-renders the map
      // tile, both of which are billed per call.
      const current = user?.zip != null ? String(user.zip).padStart(5, '0') : '';
      if (zip.trim() && zip.trim() !== current) {
        const saved: any = await updateSetting({ type: 'zip', zip: zip.trim() }).unwrap();
        if (saved?.cityState) setCityState(saved.cityState);
      }

      Alert.alert('Saved', 'Profile updated.');
    } catch (err: any) {
      // A zip the server couldn't find comes back worded — "check the number"
      // is more use than "failed to save".
      const message = err?.data?.error;
      Alert.alert('Error', message || 'Failed to save profile.');
      return;
    } finally {
      setSavingProfile(false);
    }
  };

  const setLinkField = (index: number, key: keyof ProfileLink) => (value: string) =>
    setLinks((prev) => prev.map((link, i) => (i === index ? { ...link, [key]: value } : link)));

  const addLink = () => setLinks((prev) => [...prev, { title: '', url: '' }]);
  const removeLink = (index: number) => setLinks((prev) => prev.filter((_, i) => i !== index));

  const handleSaveLinks = async () => {
    setSavingLinks(true);
    try {
      // Empty rows are dropped here as well as on the server, so what comes
      // back and what's on screen agree without a refetch race.
      const cleaned = links.filter((link) => link.url.trim());
      const res: any = await updateSetting({ type: 'links', links: cleaned }).unwrap();
      // The server normalises URLs (adds https://, drops anything unusable), so
      // the stored list is what goes back into the form.
      if (Array.isArray(res?.links)) setLinks(res.links);
      Alert.alert('Saved', 'Your links have been updated.');
    } catch {
      Alert.alert('Error', 'Failed to update links.');
    } finally {
      setSavingLinks(false);
    }
  };

  const handleSaveUsername = async () => {
    setUsernameError('');
    // Same rules as registration — a handle changed here is just as public as
    // one chosen at sign-up.
    const problem = validateUsername(username);
    if (problem) { setUsernameError(problem); return; }
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


  const pickAndUpload = async (type: 'gallery' | 'banners', aspect: [number, number]) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('file', uploadFile(asset.uri));
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
            <Avatar user={user} size={64} />
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
            {/* A zip rather than a typed city: it's what the region, the map
                and "near me" are all worked out from, and it can't be
                half-right the way free text can. The city it resolves to is
                shown back, since that's the part other members see. */}
            <Field
              label="Zip code"
              value={zip}
              onChangeText={(text) => setZip(text.replace(/[^0-9]/g, '').slice(0, 5))}
              placeholder="98021"
              keyboardType="number-pad"
              hint={cityState
                ? `Shown on your profile as ${cityState}. Your zip stays private.`
                : 'Sets your region, your map tile and what "near me" measures from. Your zip stays private.'}
            />

          </View>
          <SaveButton label="Save Profile" onPress={handleSaveProfile} loading={savingProfile} />
        </View>

        {/* ── Links ────────────────────────────────────────────────── */}
        <SectionHeader title="Links" />
        <View style={[styles.card, { backgroundColor: colors.bgDark }]}>
          <View style={styles.cardPad}>
            <Text style={[styles.fieldHint, { color: colors.grey, marginBottom: 8 }]}>
              These show as buttons under your bio. Drop the https:// if you like — we'll add it.
            </Text>

            {links.length === 0 ? (
              <Text style={[styles.fieldHint, { color: colors.grey, marginBottom: 8 }]}>
                No links yet.
              </Text>
            ) : (
              links.map((link, i) => (
                <View key={i} style={[styles.linkRow, { borderColor: colors.borderDark }]}>
                  <View style={styles.linkFields}>
                    <Field
                      label="Title"
                      value={link.title}
                      onChangeText={setLinkField(i, 'title')}
                      placeholder="e.g. My Shop"
                      autoCapitalize="words"
                    />
                    <Field
                      label="URL"
                      value={link.url}
                      onChangeText={setLinkField(i, 'url')}
                      placeholder="e.g. instagram.com/yourhandle"
                      autoCapitalize="none"
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => removeLink(i)}
                    hitSlop={8}
                    style={styles.linkRemove}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove link ${i + 1}`}
                  >
                    <Trash2 size={16} color={colors.red} />
                  </TouchableOpacity>
                </View>
              ))
            )}

            {links.length < MAX_PROFILE_LINKS && (
              <TouchableOpacity
                onPress={addLink}
                style={[styles.addLinkBtn, { borderColor: colors.primaryAlt }]}
                activeOpacity={0.8}
              >
                <Plus size={15} color={colors.primaryAlt} />
                <Text style={[styles.addLinkText, { color: colors.primaryAlt }]}>Add Link</Text>
              </TouchableOpacity>
            )}
          </View>
          <SaveButton label="Save Links" onPress={handleSaveLinks} loading={savingLinks} />
        </View>

        {/* ── Username ─────────────────────────────────────────────── */}
        <SectionHeader title="Username" />
        <View style={[styles.card, { backgroundColor: colors.bgDark }]}>
          <View style={styles.cardPad}>
            <Field
              label="Username"
              value={username}
              // Spaces are dropped as they're typed — they can never be part
              // of a handle, so there's nothing to tell someone about later.
              onChangeText={(v) => { setUsername(v.replace(/\s+/g, '')); setUsernameError(''); }}
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

        {/* ── Content & Safety ─────────────────────────────────────── */}
        <SectionHeader title="Content & Safety" />
        <View style={[styles.card, { backgroundColor: colors.bgDark }]}>
          <View style={[styles.switchRow, { borderTopWidth: 0 }]}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={[styles.switchLabel, { color: colors.fg }]}>Filter objectionable content</Text>
              <Text style={[styles.switchHint, { color: colors.grey }]}>
                Hide potentially offensive or inappropriate content from your feed.
              </Text>
            </View>
            <Switch
              value={contentFilterEnabled}
              onValueChange={(v) => { dispatch(setContentFilter(v)); }}
              trackColor={{ false: colors.greyLight, true: colors.primaryAlt }}
              thumbColor="#FFFFFF"
            />
          </View>
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

/** Mirrors MAX_LINKS in horacio's helpers/profileLinks. */
const MAX_PROFILE_LINKS = 10;

const styles = StyleSheet.create({
  scroll:       { paddingBottom: 40 },
  linkRow:      {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingTop: 12, marginBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  linkFields:   { flex: 1 },
  linkRemove:   { padding: 8, marginTop: 22 },
  addLinkBtn:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 11, borderRadius: COMMON_RADIUS, borderWidth: 1.5, marginTop: 8,
  },
  addLinkText:  { fontSize: 14, fontWeight: '700' },
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
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },

  saveBtn:      { margin: 16, marginTop: 4, backgroundColor: colors.primaryAlt, borderRadius: COMMON_RADIUS, paddingVertical: 13, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText:  { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  switchRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  switchLabel:  { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  switchHint:   { fontSize: 12, lineHeight: 16 },
  dangerRow:    { paddingHorizontal: 16, paddingVertical: 14 },
  dangerText:   { fontSize: 15, fontWeight: '600' },
});

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Switch, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetLoggedInUserQuery,
  useUpdateUserSettingMutation,
  useUpdateUserSettingImageMutation,
  useDeleteAccountMutation,
} from '../../api/apiService';
import { useAppDispatch } from '../../store/store';
import { logout } from '../../store/authSlice';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import { Colors } from '../../constants/colors';
import { imageUrl } from '../../utils/image';
import type { AppStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingControl}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const navigation = useNavigation<NavProp>();
  const dispatch = useAppDispatch();

  const { data: user, isLoading } = useGetLoggedInUserQuery();
  const [updateSetting, { isLoading: saving }] = useUpdateUserSettingMutation();
  const [updateImage, { isLoading: uploadingImage }] = useUpdateUserSettingImageMutation();
  const [deleteAccount] = useDeleteAccountMutation();

  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [cityState, setCityState] = useState('');

  // Email prefs
  const [emailComments, setEmailComments] = useState(false);
  const [emailLikes, setEmailLikes] = useState(false);
  const [emailFollowed, setEmailFollowed] = useState(false);
  const [emailFollowerActivity, setEmailFollowerActivity] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? '');
      setLastName(user.lastName ?? '');
      setBio(user.bio ?? '');
      setCityState(user.cityState ?? '');
      setEmailComments(user.emailSettings?.userComments ?? false);
      setEmailLikes(user.emailSettings?.userLikes ?? false);
      setEmailFollowed(user.emailSettings?.userFollowed ?? false);
      setEmailFollowerActivity(user.emailSettings?.followerActivity ?? false);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    await updateSetting({ type: 'profile', firstName, lastName, bio, cityState });
    Alert.alert('Saved', 'Profile updated.');
  };

  const handleSaveEmail = async () => {
    await updateSetting({
      type: 'email',
      userComments: emailComments,
      userLikes: emailLikes,
      userFollowed: emailFollowed,
      followerActivity: emailFollowerActivity,
    });
    Alert.alert('Saved', 'Email preferences updated.');
  };

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('image', {
      uri: asset.uri,
      type: asset.mimeType ?? 'image/jpeg',
      name: asset.fileName ?? 'avatar.jpg',
    } as any);
    await updateImage({ type: 'avatar', formData });
  };

  const handlePickBanner = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('image', {
      uri: asset.uri,
      type: asset.mimeType ?? 'image/jpeg',
      name: asset.fileName ?? 'banner.jpg',
    } as any);
    await updateImage({ type: 'banner', formData });
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            await deleteAccount();
            await dispatch(logout());
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  if (isLoading) return <Spinner fullScreen />;

  const bannerUri = user?.banners?.[0]?.filename ? imageUrl(user.banners[0].filename) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar / Banner */}
        <SectionHeader title="Photos" />
        <View style={styles.photoRow}>
          <TouchableOpacity style={styles.photoItem} onPress={handlePickAvatar} disabled={uploadingImage}>
            <Avatar filename={user?.gallery?.[0]?.filename} name={user?.firstName ?? '?'} size={64} />
            <Text style={styles.photoLabel}>Avatar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBanner} onPress={handlePickBanner} disabled={uploadingImage}>
            {bannerUri
              ? <Image source={{ uri: bannerUri }} style={styles.bannerPreview} contentFit="cover" />
              : <View style={styles.bannerPreviewEmpty} />
            }
            <Text style={styles.photoLabel}>Banner</Text>
          </TouchableOpacity>
          {uploadingImage && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color={Colors.brg} />
            </View>
          )}
        </View>

        {/* Profile */}
        <SectionHeader title="Profile" />
        <View style={styles.card}>
          <SettingRow label="First Name">
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor={Colors.grey}
            />
          </SettingRow>
          <SettingRow label="Last Name">
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor={Colors.grey}
            />
          </SettingRow>
          <SettingRow label="Bio">
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              placeholderTextColor={Colors.grey}
              multiline
              numberOfLines={3}
            />
          </SettingRow>
          <SettingRow label="City / State">
            <TextInput
              style={styles.input}
              value={cityState}
              onChangeText={setCityState}
              placeholder="e.g. Los Angeles, CA"
              placeholderTextColor={Colors.grey}
            />
          </SettingRow>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSaveProfile}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text style={styles.saveBtnText}>Save Profile</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Email Preferences */}
        <SectionHeader title="Email Preferences" />
        <View style={styles.card}>
          {[
            { label: 'Comments on my posts', value: emailComments, setter: setEmailComments },
            { label: 'Likes on my posts', value: emailLikes, setter: setEmailLikes },
            { label: 'New followers', value: emailFollowed, setter: setEmailFollowed },
            { label: 'Follower activity', value: emailFollowerActivity, setter: setEmailFollowerActivity },
          ].map(({ label, value, setter }, i) => (
            <View key={label} style={[styles.switchRow, i > 0 && styles.switchRowBorder]}>
              <Text style={styles.switchLabel}>{label}</Text>
              <Switch
                value={value}
                onValueChange={setter}
                trackColor={{ false: Colors.greyLight, true: Colors.brg }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}
          <TouchableOpacity style={[styles.saveBtn, styles.saveBtnSecondary]} onPress={handleSaveEmail}>
            <Text style={[styles.saveBtnText, styles.saveBtnSecondaryText]}>Save Preferences</Text>
          </TouchableOpacity>
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <TouchableOpacity style={styles.dangerRow} onPress={handleLogout}>
            <Text style={styles.dangerText}>Log Out</Text>
          </TouchableOpacity>
          <View style={styles.switchRowBorder}>
            <TouchableOpacity style={[styles.dangerRow, { borderTopWidth: 0 }]} onPress={handleDeleteAccount}>
              <Text style={[styles.dangerText, { color: Colors.red }]}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.cream },
  scroll:         { paddingBottom: 40 },
  sectionHeader:  {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: Colors.segment, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border,
  },
  sectionTitle:   { fontSize: 12, fontWeight: '800', color: Colors.grey, textTransform: 'uppercase', letterSpacing: 0.5 },
  card:           { backgroundColor: '#FFFFFF', marginBottom: 0 },
  photoRow:       {
    flexDirection: 'row', gap: 16, padding: 16,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: Colors.border,
    position: 'relative',
  },
  photoItem:      { alignItems: 'center', gap: 6 },
  photoBanner:    { flex: 1, alignItems: 'center', gap: 6 },
  photoLabel:     { fontSize: 12, color: Colors.grey, fontWeight: '600' },
  bannerPreview:  { width: '100%', height: 60, borderRadius: 8 },
  bannerPreviewEmpty: { width: '100%', height: 60, borderRadius: 8, backgroundColor: Colors.brg },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  settingRow:     {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  settingLabel:   { fontSize: 14, fontWeight: '600', color: Colors.fg, paddingTop: 10, width: 100 },
  settingControl: { flex: 1 },
  input:          {
    borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: Colors.fg,
    backgroundColor: Colors.inputBg,
  },
  inputMulti:     { minHeight: 70, textAlignVertical: 'top' },
  saveBtn:        {
    margin: 16, backgroundColor: Colors.brg, borderRadius: 10,
    paddingVertical: 13, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText:    { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  saveBtnSecondary: { backgroundColor: Colors.cream, borderWidth: 1.5, borderColor: Colors.brg },
  saveBtnSecondaryText: { color: Colors.brg },
  switchRow:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  switchRowBorder: { borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  switchLabel:    { fontSize: 14, color: Colors.fg, flex: 1 },
  dangerRow:      { paddingHorizontal: 16, paddingVertical: 14 },
  dangerText:     { fontSize: 15, fontWeight: '600', color: Colors.fg },
});

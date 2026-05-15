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
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import type { AppStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <View style={[ss.sectionHeader, { backgroundColor: colors.segment, borderColor: colors.border }]}>
      <Text style={[ss.sectionTitle, { color: colors.grey }]}>{title}</Text>
    </View>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.settingLabel, { color: colors.fg }]}>{label}</Text>
      <View style={styles.settingControl}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
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
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar / Banner */}
        <SectionHeader title="Photos" />
        <View style={[styles.photoRow, { backgroundColor: colors.bgDark, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.photoItem} onPress={handlePickAvatar} disabled={uploadingImage}>
            <Avatar filename={user?.gallery?.[0]?.filename} name={user?.firstName ?? '?'} size={64} />
            <Text style={[styles.photoLabel, { color: colors.grey }]}>Avatar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBanner} onPress={handlePickBanner} disabled={uploadingImage}>
            {bannerUri
              ? <Image source={{ uri: bannerUri }} style={styles.bannerPreview} contentFit="cover" />
              : <View style={styles.bannerPreviewEmpty} />
            }
            <Text style={[styles.photoLabel, { color: colors.grey }]}>Banner</Text>
          </TouchableOpacity>
          {uploadingImage && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color={colors.primaryAlt} />
            </View>
          )}
        </View>

        {/* Profile */}
        <SectionHeader title="Profile" />
        <View style={[styles.card, { backgroundColor: colors.bgDark }]}>
          <SettingRow label="First Name">
            <TextInput
              style={[ss.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.bgDark }]}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor={colors.grey}
            />
          </SettingRow>
          <SettingRow label="Last Name">
            <TextInput
              style={[ss.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.bgDark }]}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor={colors.grey}
            />
          </SettingRow>
          <SettingRow label="Bio">
            <TextInput
              style={[ss.input, ss.inputMulti, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.bgDark }]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              placeholderTextColor={colors.grey}
              multiline
              numberOfLines={3}
            />
          </SettingRow>
          <SettingRow label="City / State">
            <TextInput
              style={[ss.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.bgDark }]}
              value={cityState}
              onChangeText={setCityState}
              placeholder="e.g. Los Angeles, CA"
              placeholderTextColor={colors.grey}
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
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.primaryAlt }]} onPress={handleSaveEmail}>
            <Text style={[styles.saveBtnText, { color: colors.primaryAlt }]}>Save Preferences</Text>
          </TouchableOpacity>
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View style={[styles.card, { backgroundColor: colors.bgDark }]}>
          <TouchableOpacity style={[styles.dangerRow, { borderTopColor: colors.border }]} onPress={handleLogout}>
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

const styles = StyleSheet.create({
  scroll:         { paddingBottom: 40 },
  card:           { marginBottom: 0 },
  photoRow:       {
    flexDirection: 'row', gap: 16, padding: 16,
    borderBottomWidth: 1,
    position: 'relative',
  },
  photoItem:      { alignItems: 'center', gap: 6 },
  photoBanner:    { flex: 1, alignItems: 'center', gap: 6 },
  photoLabel:     { fontSize: 12, fontWeight: '600' },
  bannerPreview:  { width: '100%', height: 60, borderRadius: 8 },
  bannerPreviewEmpty: { width: '100%', height: 60, borderRadius: 8, backgroundColor: colors.primaryAlt },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  settingRow:     {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingLabel:   { fontSize: 14, fontWeight: '600', paddingTop: 10, width: 100 },
  settingControl: { flex: 1 },
  saveBtn:        {
    margin: 16, backgroundColor: colors.primaryAlt, borderRadius: 10,
    paddingVertical: 13, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText:    { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  switchRow:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  switchLabel:    { fontSize: 14, flex: 1 },
  dangerRow:      { paddingHorizontal: 16, paddingVertical: 14 },
  dangerText:     { fontSize: 15, fontWeight: '600' },
});

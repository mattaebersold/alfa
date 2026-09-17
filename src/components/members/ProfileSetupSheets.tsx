import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImageIcon } from 'lucide-react-native';
import SharedModal from '../ui/SharedModal';
import Avatar from '../ui/Avatar';
import {
  useGetLoggedInUserQuery,
  useUpdateUserSettingImageMutation,
  useUpdateUserSettingMutation,
} from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { toUploadableJpeg, uploadFile } from '../../utils/upload';
import { COMMON_RADIUS } from '../../constants/radius';

/**
 * The two setup steps that can be finished on the spot.
 *
 * Tapping "Add a profile photo" used to close the menu and drop you at the top
 * of Account Settings, a long form in which the avatar is one small control —
 * you had to find it, do it, and then find your way back. These sheets are
 * the one field and a save button, over the menu you were already in.
 *
 * Neither needs to refresh anything by hand. Both saves invalidate the `User`
 * tag, which refetches the logged-in profile; RootNavigator copies that into
 * the auth slice, so the header avatar changes, and the setup card — which
 * reads the same query — drops the step it no longer needs to ask for.
 */

/** Square, as avatars are shown everywhere. */
const PHOTO_ASPECT: [number, number] = [1, 1];
/** The banner's own shape — see ProfileScreen's bannerContainer. */
const BANNER_ASPECT: [number, number] = [10, 4];
const PREVIEW = 132;

export function ProfilePhotoSheet({ visible, onClose }: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const { data: user } = useGetLoggedInUserQuery();
  const [updateImage, { isLoading: uploading }] = useUpdateUserSettingImageMutation();
  const [picked, setPicked] = useState<string | null>(null);

  // Every opening starts from the current photo, not a pick left over from a
  // sheet closed without saving.
  useEffect(() => { if (visible) setPicked(null); }, [visible]);

  const pick = async (source: 'library' | 'camera') => {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow camera access to take a profile photo.');
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'], allowsEditing: true, aspect: PHOTO_ASPECT, quality: 0.8,
    };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled) setPicked(result.assets[0].uri);
  };

  const save = async () => {
    if (!picked || !user?.user_id) return;
    try {
      // HEIC off an iPhone is something the server's image pipeline can't
      // read, so it's converted before it leaves.
      const jpeg = await toUploadableJpeg(picked);
      const formData = new FormData();
      formData.append('file', uploadFile(jpeg));
      formData.append('userid', user.user_id);
      await updateImage({ type: 'gallery', formData }).unwrap();
      onClose();
    } catch {
      Alert.alert('Error', "Couldn't upload that photo. Please try again.");
    }
  };

  return (
    <SharedModal visible={visible} onClose={onClose} title="Add a profile photo">
      <View style={styles.body}>
        <View style={styles.previewWrap}>
          {picked ? (
            <Image source={{ uri: picked }} style={styles.preview} contentFit="cover" />
          ) : (
            <Avatar user={user} size={PREVIEW} />
          )}
        </View>

        <View style={styles.pickRow}>
          <TouchableOpacity
            style={[styles.pickBtn, { borderColor: colors.borderDark }]}
            onPress={() => pick('library')}
            disabled={uploading}
            activeOpacity={0.75}
          >
            <ImageIcon size={16} color={colors.fg} />
            <Text style={[styles.pickText, { color: colors.fg }]}>
              {picked ? 'Choose another' : 'Choose a photo'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pickBtn, { borderColor: colors.borderDark }]}
            onPress={() => pick('camera')}
            disabled={uploading}
            activeOpacity={0.75}
          >
            <Camera size={16} color={colors.fg} />
            <Text style={[styles.pickText, { color: colors.fg }]}>Take one</Text>
          </TouchableOpacity>
        </View>

        {/* Only once there's something to save — before that, the two
            buttons above are the whole of what this sheet asks. */}
        {picked && (
          <TouchableOpacity
            style={[styles.save, { backgroundColor: brand }]}
            onPress={save}
            disabled={uploading}
            activeOpacity={0.85}
          >
            {uploading
              ? <ActivityIndicator size="small" color="#000000" />
              : <Text style={styles.saveText}>Save photo</Text>}
          </TouchableOpacity>
        )}
      </View>
    </SharedModal>
  );
}

/**
 * The cover photo at the top of your own profile.
 *
 * Same sheet as the avatar, in the banner's shape: a member with no cover gets
 * a shallower banner area and a camera button on it, and this is what that
 * button opens. Saving refreshes the profile, which fills the banner and
 * restores its full height.
 */
export function BannerSheet({ visible, onClose }: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const { data: user } = useGetLoggedInUserQuery();
  const [updateImage, { isLoading: uploading }] = useUpdateUserSettingImageMutation();
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => { if (visible) setPicked(null); }, [visible]);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      // The shape the banner is shown in, so what's cropped here is what lands.
      aspect: BANNER_ASPECT,
      quality: 0.85,
    });
    if (!result.canceled) setPicked(result.assets[0].uri);
  };

  const save = async () => {
    if (!picked || !user?.user_id) return;
    try {
      const jpeg = await toUploadableJpeg(picked);
      const formData = new FormData();
      formData.append('file', uploadFile(jpeg));
      formData.append('userid', user.user_id);
      await updateImage({ type: 'banners', formData }).unwrap();
      onClose();
    } catch {
      Alert.alert('Error', "Couldn't upload that photo. Please try again.");
    }
  };

  return (
    <SharedModal visible={visible} onClose={onClose} title="Add a cover photo">
      <View style={styles.body}>
        <Text style={[styles.hint, { color: colors.grey }]}>
          The wide photo across the top of your profile. A car of yours, or where you drive it.
        </Text>

        {picked ? (
          <Image source={{ uri: picked }} style={styles.bannerPreview} contentFit="cover" />
        ) : (
          <View style={[styles.bannerPreview, styles.bannerEmpty, { borderColor: colors.borderDark }]}>
            <ImageIcon size={22} color={colors.grey} />
          </View>
        )}

        <TouchableOpacity
          style={[styles.pickBtn, { borderColor: colors.borderDark }]}
          onPress={pick}
          disabled={uploading}
          activeOpacity={0.75}
        >
          <ImageIcon size={16} color={colors.fg} />
          <Text style={[styles.pickText, { color: colors.fg }]}>
            {picked ? 'Choose another' : 'Choose a photo'}
          </Text>
        </TouchableOpacity>

        {picked && (
          <TouchableOpacity
            style={[styles.save, { backgroundColor: brand }]}
            onPress={save}
            disabled={uploading}
            activeOpacity={0.85}
          >
            {uploading
              ? <ActivityIndicator size="small" color="#000000" />
              : <Text style={styles.saveText}>Save cover photo</Text>}
          </TouchableOpacity>
        )}
      </View>
    </SharedModal>
  );
}

export function BioSheet({ visible, onClose }: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const { data: user } = useGetLoggedInUserQuery();
  const [updateSetting, { isLoading: saving }] = useUpdateUserSettingMutation();
  const [bio, setBio] = useState('');

  useEffect(() => { if (visible) setBio(user?.bio ?? ''); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!bio.trim() || !user?.user_id) return;
    try {
      await updateSetting({ type: 'bio', userid: user.user_id, bio: bio.trim() }).unwrap();
      onClose();
    } catch {
      Alert.alert('Error', "Couldn't save your bio. Please try again.");
    }
  };

  return (
    <SharedModal visible={visible} onClose={onClose} title="Add a bio">
      <View style={styles.body}>
        <Text style={[styles.hint, { color: colors.grey }]}>
          A line or two about you and what you drive. It shows at the top of your profile.
        </Text>
        <TextInput
          style={[
            styles.textarea,
            { color: colors.fg, backgroundColor: colors.inputBgDark, borderColor: colors.borderDark },
          ]}
          value={bio}
          onChangeText={setBio}
          placeholder="Weekend canyon driver, E30 owner, always up for coffee…"
          placeholderTextColor={colors.grey}
          multiline
          autoFocus
          textAlignVertical="top"
        />
        <TouchableOpacity
          style={[styles.save, { backgroundColor: brand }, !bio.trim() && styles.saveDisabled]}
          onPress={save}
          disabled={saving || !bio.trim()}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator size="small" color="#000000" />
            : <Text style={styles.saveText}>Save bio</Text>}
        </TouchableOpacity>
      </View>
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 32, gap: 14 },

  previewWrap: { alignItems: 'center', paddingVertical: 6 },
  bannerPreview: { width: '100%', aspectRatio: 10 / 4, borderRadius: 10 },
  bannerEmpty: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  preview: { width: PREVIEW, height: PREVIEW, borderRadius: PREVIEW / 2 },
  pickRow: { flexDirection: 'row', gap: 10 },
  pickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  pickText: { fontSize: 14, fontWeight: '700' },

  hint: { fontSize: 13, lineHeight: 18 },
  textarea: {
    minHeight: 120, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12,
    fontSize: 15, lineHeight: 21,
  },

  save: {
    paddingVertical: 14, borderRadius: COMMON_RADIUS,
    alignItems: 'center', justifyContent: 'center',
  },
  saveDisabled: { opacity: 0.5 },
  saveText: { fontSize: 15, fontWeight: '800', color: '#000000' },
});

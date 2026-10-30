import React, { useState } from 'react';
import { View, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Text } from '@ors/kit';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, Pencil, X } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import {
  useUpdateUserSettingMutation,
  useUpdateUserSettingImageMutation,
  useCheckUsernameMutation,
} from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { uploadFile } from '../../utils/upload';
import { validateUsername } from '../../utils/username';
import type { User } from '../../types/api';
import { COMMON_RADIUS, COLOR_BLACK, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

const AVATAR = 64;

type Editing = 'username' | 'bio' | null;

/**
 * The Dashboard's heading: your photo, username and bio, each edited where it
 * sits. The photo opens the picker, the username and bio turn into fields
 * with a tick and a cross.
 */
export default function DashboardProfileCard({ user }: { user: User }) {
  const colors = useColors();
  const [updateSetting] = useUpdateUserSettingMutation();
  const [updateImage, { isLoading: uploading }] = useUpdateUserSettingImageMutation();
  const [checkUsername] = useCheckUsernameMutation();

  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const start = (field: Exclude<Editing, null>) => {
    setDraft((field === 'username' ? user.username : user.bio) ?? '');
    setError('');
    setEditing(field);
  };
  const cancel = () => { setEditing(null); setError(''); };

  const save = async () => {
    if (saving) return;
    if (editing === 'username') {
      const next = draft.trim();
      if (next === user.username) return cancel();
      // Same rules as sign-up and Settings: a handle is just as public here.
      const problem = validateUsername(next);
      if (problem) return setError(problem);
      setSaving(true);
      try {
        const { msg } = await checkUsername({ username: next }).unwrap();
        if (msg === 'true') { setError('That username is already taken.'); return; }
        await updateSetting({ type: 'username', userid: user.user_id, username: next }).unwrap();
        setEditing(null);
      } catch {
        Alert.alert('Error', 'Failed to update username.');
      } finally {
        setSaving(false);
      }
    } else if (editing === 'bio') {
      if (draft.trim() === (user.bio ?? '').trim()) return cancel();
      setSaving(true);
      try {
        await updateSetting({ type: 'bio', userid: user.user_id, bio: draft.trim() }).unwrap();
        setEditing(null);
      } catch {
        Alert.alert('Error', 'Failed to update bio.');
      } finally {
        setSaving(false);
      }
    }
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (result.canceled) return;
    const formData = new FormData();
    formData.append('file', uploadFile(result.assets[0].uri));
    formData.append('userid', user.user_id ?? '');
    try {
      await updateImage({ type: 'gallery', formData }).unwrap();
    } catch {
      Alert.alert('Error', 'Failed to upload image.');
    }
  };

  /** The tick and cross that close an open field. */
  const confirm = (
    <View style={styles.confirm}>
      <TouchableOpacity
        style={[styles.confirmBtn, { backgroundColor: colors.segment }]}
        onPress={cancel}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
      >
        <X size={16} color={colors.fg} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.confirmBtn, { backgroundColor: COLOR_WHITE }]}
        onPress={save}
        disabled={saving}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Save"
      >
        {saving ? <ActivityIndicator size="small" color={COLOR_BLACK} /> : <Check size={16} color={COLOR_BLACK} />}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.top}>
        <TouchableOpacity onPress={pickAvatar} disabled={uploading} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Change profile photo">
          <Avatar user={user} size={AVATAR} edge={false} />
          <View style={[styles.cameraBadge, { backgroundColor: COLOR_WHITE, borderColor: colors.card }]}>
            <Camera size={12} color={COLOR_BLACK} />
          </View>
          {uploading && (
            <View style={styles.uploading}>
              <ActivityIndicator color={COLOR_WHITE} />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.main}>
          {editing === 'username' ? (
            <View style={styles.editRow}>
              <TextInput
                style={[styles.input, styles.usernameInput, { color: colors.fg, backgroundColor: colors.inputBg }]}
                value={draft}
                // Spaces can never be part of a handle, so they're dropped as typed.
                onChangeText={(v) => { setDraft(v.replace(/\s+/g, '')); setError(''); }}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={save}
                placeholder="username"
                placeholderTextColor={colors.grey}
              />
              {confirm}
            </View>
          ) : (
            <TouchableOpacity style={styles.tapRow} onPress={() => start('username')} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Edit username">
              <Text style={[styles.username, { color: colors.fg }]} numberOfLines={1}>{user.username}</Text>
              <View style={styles.editBtn}><Pencil size={12} color={COLOR_WHITE} /></View>
            </TouchableOpacity>
          )}
          {editing === 'username' && error ? <Text style={[styles.error, { color: colors.red }]}>{error}</Text> : null}
        </View>

      </View>

      {/* Photo and username above, the bio below. */}
      <View style={styles.hr} />

      {editing === 'bio' ? (
        <View style={styles.bioEdit}>
          <TextInput
            style={[styles.input, styles.bioInput, { color: colors.fg, backgroundColor: colors.inputBg }]}
            value={draft}
            onChangeText={setDraft}
            autoFocus
            multiline
            placeholder="Tell us about yourself"
            placeholderTextColor={colors.grey}
          />
          {confirm}
        </View>
      ) : (
        <TouchableOpacity style={styles.bioTap} onPress={() => start('bio')} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Edit bio">
          {user.bio ? (
            <Text style={[styles.bio, { color: colors.muted }]} numberOfLines={3}>{user.bio}</Text>
          ) : (
            <Text style={[styles.bio, { color: colors.primaryAlt }]}>+ Add a bio</Text>
          )}
          {user.bio ? <View style={styles.editBtn}><Pencil size={12} color={COLOR_WHITE} /></View> : null}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card:          { padding: 16, borderRadius: COMMON_RADIUS, borderWidth: 1, gap: 12 },
  top:           { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cameraBadge:   {
    position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  uploading:     {
    ...StyleSheet.absoluteFill, borderRadius: AVATAR / 2,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  main:          { flex: 1, minWidth: 0 },
  // The Dashboard's row rule (its DIVIDER).
  hr:            { height: 1, marginHorizontal: -16, backgroundColor: 'rgba(255,255,255,0.1)' },
  tapRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%' },
  username:      { fontSize: 18, fontFamily: FONT_INTER.bold, flexShrink: 1 },
  editRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input:         { borderRadius: 10, paddingHorizontal: 10, fontSize: 15 },
  usernameInput: { flex: 1, height: 38, fontFamily: FONT_INTER.semibold },
  error:         { fontSize: 12, marginTop: 4 },
  bioTap:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bio:           { flex: 1, fontSize: 13, lineHeight: 18 },
  // The pencil, in a see-through black circle.
  editBtn:       { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  bioEdit:       { gap: 8 },
  bioInput:      { minHeight: 76, paddingTop: 10, paddingBottom: 10, lineHeight: 20, textAlignVertical: 'top' },
  confirm:       { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  confirmBtn:    { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});

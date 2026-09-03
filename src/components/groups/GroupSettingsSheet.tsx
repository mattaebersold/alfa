import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { UserMinus, ShieldCheck, ShieldOff, Camera, X } from 'lucide-react-native';
import {
  useGetGroupQuery,
  useGetGroupMembersQuery,
  useRemoveGroupMemberMutation,
  useUpdateGroupMutation,
  useUpdateGroupMemberTypeMutation,
  useDeleteGroupMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../ui/Avatar';
import Spinner from '../ui/Spinner';
import SharedModal from '../ui/SharedModal';
import PhotoPickerField from '../ui/PhotoPickerField';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import { uploadFile } from '../../utils/upload';

type PickedImage = { uri: string; name: string; type: string };

/**
 * Group settings as a sheet.
 *
 * Reachable from anywhere in the group without leaving the section you're in —
 * settings is a detour, and pushing a screen for it means coming back to the top
 * of a list you'd scrolled.
 *
 * For an admin this is where the group is actually run: its name, its two
 * images, and who holds the keys. It used to only *report* those things — the
 * name was a row of text you couldn't touch, and the one action was removing
 * people — so renaming a group or handing over admin had no route through the
 * app at all.
 *
 * ## Why the whole group is submitted
 *
 * `POST /api/group/update` writes every field it names from the body, so a
 * request carrying only `title` would blank the description, the region and the
 * rest. Everything the sheet doesn't edit is sent back unchanged rather than
 * omitted — see `submit`.
 */
/**
 * One image slot — what's there now, or the picker when there's nothing.
 *
 * At module scope deliberately. Declared inside the sheet it would be a new
 * component type on every render, so React would unmount and remount the
 * preview on each keystroke in the name field — the images visibly blinking
 * while an admin typed.
 */
function ImageSlot({
  uri, onPick, onClear, label, hint, tall,
}: {
  uri: string | null;
  onPick: () => void;
  onClear?: () => void;
  label: string;
  hint: string;
  tall?: boolean;
}) {
  if (!uri) {
    return (
      <View style={styles.imageSlot}>
        <PhotoPickerField onPress={onPick} title={label} hint={hint} />
      </View>
    );
  }
  return (
    <View style={styles.imageSlot}>
      <Image
        source={{ uri }}
        style={[styles.imagePreview, tall && styles.bannerPreview]}
        contentFit="cover"
      />
      <TouchableOpacity
        style={styles.imageChange}
        onPress={onPick}
        accessibilityRole="button"
        accessibilityLabel={`Change ${label}`}
      >
        <Camera size={13} color="#FFFFFF" />
        <Text style={styles.imageChangeText}>Change</Text>
      </TouchableOpacity>
      {onClear && (
        <TouchableOpacity
          style={styles.imageClear}
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel={`Undo ${label} change`}
        >
          <X size={13} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function GroupSettingsSheet({
  groupId,
  visible,
  onClose,
  onDeleted,
}: {
  groupId: string;
  visible: boolean;
  onClose: () => void;
  /**
   * The group is gone. The caller has to navigate away — every screen behind
   * this sheet is a view of something that no longer exists.
   */
  onDeleted?: () => void;
}) {
  const c = useColors();

  // Nothing to fetch until it's opened.
  const { data: group, isLoading } = useGetGroupQuery(groupId, { skip: !visible });
  const { data: members = [] } = useGetGroupMembersQuery(groupId, { skip: !visible });
  const [removeMember] = useRemoveGroupMemberMutation();
  const [updateGroup, { isLoading: isSaving }] = useUpdateGroupMutation();
  const [updateMemberType] = useUpdateGroupMemberTypeMutation();
  const [deleteGroup, { isLoading: isDeleting }] = useDeleteGroupMutation();
  const { userInfo } = useAppSelector((s) => s.auth);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [newImage, setNewImage] = useState<PickedImage | null>(null);
  const [newBanner, setNewBanner] = useState<PickedImage | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  // Seeded from the group each time it opens, so an abandoned edit doesn't
  // survive to the next opening as a change the admin didn't make.
  useEffect(() => {
    if (!visible || !group) return;
    setTitle(group.title ?? '');
    setSubtitle(group.subtitle ?? '');
    setNewImage(null);
    setNewBanner(null);
    setDeleteConfirm('');
  }, [visible, group]);

  const pending = members.filter((m) => m.status === 'pending');
  const active  = members.filter((m) => m.status === 'active');
  const isAdmin = active.some(
    (m) => m.user_id === userInfo?.user_id && m.member_type === 'admin',
  );
  const adminCount = active.filter((m) => m.member_type === 'admin').length;

  const existingImage = imageUrl(group?.gallery?.[0]?.filename);
  const existingBanner = imageUrl(group?.banners?.[0]?.filename);

  const dirty =
    !!newImage || !!newBanner ||
    title.trim() !== (group?.title ?? '') ||
    subtitle.trim() !== (group?.subtitle ?? '');

  const pick = (onPicked: (img: PickedImage) => void, label: string) => {
    const take = (asset: ImagePicker.ImagePickerAsset) => onPicked({
      uri: asset.uri,
      name: asset.fileName ?? `group_${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    });

    Alert.alert(label, 'How would you like to add one?', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission needed', 'Camera access is required to take photos.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
          if (!result.canceled) take(result.assets[0]);
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.85,
          });
          if (!result.canceled) take(result.assets[0]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submit = async () => {
    const name = title.trim();
    if (!name) {
      Alert.alert('Name required', 'A group needs a name.');
      return;
    }
    if (!group) return;

    const fd = new FormData();
    fd.append('internal_id', group.internal_id);
    fd.append('title', name);
    fd.append('subtitle', subtitle.trim());

    // Sent back as they are. The endpoint rewrites every field it names, so
    // leaving these out would clear them rather than leave them alone.
    if (group.body) fd.append('body', group.body);
    if (group.type) fd.append('type', group.type);
    if (group.category) fd.append('category', group.category);
    if (group.region) fd.append('region', group.region);

    // A replacement is an upload plus the removal of the one it replaces —
    // without the remove the old picture stays at index 0 and the new one
    // lands behind it, so nothing appears to have changed.
    if (newImage) {
      fd.append('gallery', uploadFile(newImage.uri));
      const current = group.gallery?.[0]?.filename;
      if (current) fd.append('modifyImage:remove:0', current);
    }
    if (newBanner) {
      fd.append('banners', uploadFile(newBanner.uri));
      const current = group.banners?.[0]?.filename;
      if (current) fd.append('modifyImageBanner:remove:0', current);
    }

    try {
      await updateGroup(fd).unwrap();
      setNewImage(null);
      setNewBanner(null);
    } catch (err: any) {
      Alert.alert("Couldn't save", err?.data?.error ?? 'Please try again.');
    }
  };

  /**
   * Hand admin over, or step back from it.
   *
   * The last admin is stopped here rather than at the server: a group with
   * nobody able to administer it can't be repaired from inside the app, and
   * "promote someone first" is a more useful thing to be told than an error.
   */
  const handleRole = (userId: string, username: string | undefined, currentType: string) => {
    const demoting = currentType === 'admin';
    if (demoting && adminCount <= 1) {
      Alert.alert(
        'Last admin',
        'This is the only admin. Promote someone else before stepping down.',
      );
      return;
    }
    Alert.alert(
      demoting ? `Demote @${username ?? 'member'}?` : `Make @${username ?? 'member'} an admin?`,
      demoting
        ? 'They keep their membership but lose admin controls.'
        : 'They can edit the group, and add or remove members.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: demoting ? 'Demote' : 'Promote',
          style: demoting ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await updateMemberType({
                groupId,
                userId,
                memberType: demoting ? 'basic' : 'admin',
              }).unwrap();
            } catch (err: any) {
              Alert.alert("Couldn't update", err?.data?.error ?? 'Please try again.');
            }
          },
        },
      ],
    );
  };

  /**
   * Remove someone, once. The server is the authority on whether it's allowed
   * — it refuses to strip the last admin — so its message is what gets shown
   * rather than a guess made here.
   */
  const handleRemove = (userId: string, username?: string) => {
    Alert.alert(
      `Remove @${username ?? 'member'}?`,
      'They lose access to the group and can ask to join again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember({ groupId, userId }).unwrap();
            } catch (err: any) {
              Alert.alert(
                "Couldn't remove",
                err?.data?.error ?? 'Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  /**
   * Delete the group.
   *
   * Guarded by typing the name rather than by a confirm dialog. This takes the
   * group's posts, its forum, its news and its resources with it and can't be
   * undone — a destructive button and an "Are you sure?" is the same two taps
   * as any harmless action, and this isn't one.
   */
  const handleDelete = async () => {
    try {
      await deleteGroup(groupId).unwrap();
      onClose();
      onDeleted?.();
    } catch (err: any) {
      Alert.alert("Couldn't delete", err?.data?.error ?? 'Please try again.');
    }
  };

  return (
    <SharedModal visible={visible} onClose={onClose} title="Group Settings" heightRatio={0.9}>
      {isLoading ? <Spinner /> : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Group info ─────────────────────────────────────────── */}
          <View style={[styles.section, { backgroundColor: c.card, borderBottomColor: c.borderDark }]}>
            <Text style={[styles.sectionTitle, { backgroundColor: c.secondary, color: c.grey }]}>Group Info</Text>

            {isAdmin ? (
              <View style={styles.editBlock}>
                <Text style={[styles.fieldLabel, { color: c.grey }]}>Name</Text>
                <TextInput
                  style={[styles.input, { color: c.fg, backgroundColor: c.inputBg, borderColor: c.inputBorder }]}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Group name"
                  placeholderTextColor={c.grey}
                />

                <Text style={[styles.fieldLabel, { color: c.grey, marginTop: 14 }]}>Tagline</Text>
                <TextInput
                  style={[styles.input, { color: c.fg, backgroundColor: c.inputBg, borderColor: c.inputBorder }]}
                  value={subtitle}
                  onChangeText={setSubtitle}
                  placeholder="A short line under the name"
                  placeholderTextColor={c.grey}
                />
              </View>
            ) : (
              <View style={[styles.infoRow, { borderTopColor: c.borderDark }]}>
                <Text style={[styles.infoLabel, { color: c.grey }]}>Name</Text>
                <Text style={[styles.infoValue, { color: c.fg }]}>{group?.title}</Text>
              </View>
            )}

            {group?.region && (
              <View style={[styles.infoRow, { borderTopColor: c.borderDark }]}>
                <Text style={[styles.infoLabel, { color: c.grey }]}>Region</Text>
                <Text style={[styles.infoValue, { color: c.fg }]}>{group.region}</Text>
              </View>
            )}
            <View style={[styles.infoRow, { borderTopColor: c.borderDark }]}>
              <Text style={[styles.infoLabel, { color: c.grey }]}>Members</Text>
              <Text style={[styles.infoValue, { color: c.fg }]}>{active.length}</Text>
            </View>
          </View>

          {/* ── Images ─────────────────────────────────────────────── */}
          {isAdmin && (
            <View style={[styles.section, { backgroundColor: c.card, borderBottomColor: c.borderDark }]}>
              <Text style={[styles.sectionTitle, { backgroundColor: c.secondary, color: c.grey }]}>Images</Text>

              <Text style={[styles.fieldLabel, { color: c.grey, paddingHorizontal: 16, paddingTop: 12 }]}>
                Group photo
              </Text>
              <ImageSlot
                uri={newImage?.uri ?? existingImage}
                onPick={() => pick(setNewImage, 'Group Photo')}
                onClear={newImage ? () => setNewImage(null) : undefined}
                label="Add a group photo"
                hint="Shown on group cards and listings"
              />

              <Text style={[styles.fieldLabel, { color: c.grey, paddingHorizontal: 16 }]}>
                Banner
              </Text>
              <ImageSlot
                uri={newBanner?.uri ?? existingBanner}
                onPick={() => pick(setNewBanner, 'Banner')}
                onClear={newBanner ? () => setNewBanner(null) : undefined}
                label="Add a banner"
                hint="The wide image across the top of the group"
                tall
              />
            </View>
          )}

          {/* One save for the name and both images — they go up as one
              request, and separate buttons would imply they don't. */}
          {isAdmin && (
            <View style={[styles.saveWrap, { backgroundColor: c.card, borderBottomColor: c.borderDark }]}>
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: c.primaryAlt },
                  (!dirty || isSaving) && styles.saveBtnDisabled,
                ]}
                onPress={submit}
                disabled={!dirty || isSaving}
                activeOpacity={0.85}
              >
                {isSaving
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <Text style={styles.saveText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── Pending requests ───────────────────────────────────── */}
          {pending.length > 0 && (
            <View style={[styles.section, { backgroundColor: c.card, borderBottomColor: c.borderDark }]}>
              <Text style={[styles.sectionTitle, { backgroundColor: c.secondary, color: c.grey }]}>
                Pending Requests ({pending.length})
              </Text>
              {pending.map((m) => (
                <View key={m.user_id} style={[styles.memberRow, { borderTopColor: c.borderDark }]}>
                  <Avatar user={m.user} size={36} />
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: c.fg }]}>@{m.user?.username}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Members — admins only. This is where you manage who's in, so
              it's where the roles and removals belong; the roster elsewhere
              is for reading. ────────────────────────────────────────── */}
          {isAdmin && active.length > 0 && (
            <View style={[styles.section, { backgroundColor: c.card, borderBottomColor: c.borderDark }]}>
              <Text style={[styles.sectionTitle, { backgroundColor: c.secondary, color: c.grey }]}>
                Members ({active.length})
              </Text>
              {active.map((m) => {
                const isMe = m.user_id === userInfo?.user_id;
                const memberIsAdmin = m.member_type === 'admin';
                return (
                  <View key={m.user_id} style={[styles.memberRow, { borderTopColor: c.borderDark }]}>
                    <Avatar user={m.user} size={36} />
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: c.fg }]}>@{m.user?.username}</Text>
                      {memberIsAdmin && (
                        <Text style={[styles.memberRole, { color: c.grey }]}>Admin</Text>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[styles.roleBtn, { borderColor: c.borderDark }]}
                      onPress={() => handleRole(m.user_id, m.user?.username, m.member_type)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={
                        memberIsAdmin
                          ? `Demote @${m.user?.username ?? 'member'}`
                          : `Make @${m.user?.username ?? 'member'} an admin`
                      }
                    >
                      {memberIsAdmin
                        ? <ShieldOff size={13} color={c.grey} />
                        : <ShieldCheck size={13} color={c.grey} />}
                      <Text style={[styles.roleText, { color: c.grey }]}>
                        {memberIsAdmin ? 'Demote' : 'Admin'}
                      </Text>
                    </TouchableOpacity>

                    {/* No remove button against your own row: leaving is the
                        thing you do to yourself, and it's below. */}
                    {!isMe && (
                      <TouchableOpacity
                        style={[styles.removeBtn, { borderColor: colors.red }]}
                        onPress={() => handleRemove(m.user_id, m.user?.username)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove @${m.user?.username ?? 'member'}`}
                      >
                        <UserMinus size={13} color={colors.red} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Danger zone ─────────────────────────────────────────
              Leaving isn't here: it's a normal thing a member does, it lives
              in the group's ⋮ menu, and putting it beside a permanent delete
              invites the wrong tap. This section is for the one action that
              can't be taken back. */}
          {isAdmin && (
            <View style={[styles.section, { backgroundColor: c.card, borderBottomColor: c.borderDark }]}>
              <Text style={[styles.sectionTitle, { backgroundColor: c.secondary, color: c.grey }]}>Danger Zone</Text>
              <View style={[styles.dangerBlock, { borderTopColor: c.borderDark }]}>
                <Text style={[styles.dangerHeading, { color: colors.red }]}>Delete this group</Text>
                <Text style={[styles.dangerBody, { color: c.grey }]}>
                  Permanently removes the group, its members, its forum, news and
                  resources, and any post made only to this group. Cars, events
                  and rallies are kept — they just stop being linked here.
                </Text>

                <Text style={[styles.dangerBody, { color: c.grey, marginTop: 12 }]}>
                  Type <Text style={{ color: c.fg, fontWeight: '700' }}>{group?.title}</Text> to confirm.
                </Text>
                <TextInput
                  style={[styles.input, { color: c.fg, backgroundColor: c.inputBg, borderColor: c.inputBorder, marginTop: 8 }]}
                  value={deleteConfirm}
                  onChangeText={setDeleteConfirm}
                  placeholder={group?.title}
                  placeholderTextColor={c.grey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity
                  style={[
                    styles.deleteBtn,
                    (deleteConfirm !== group?.title || isDeleting) && styles.saveBtnDisabled,
                  ]}
                  onPress={handleDelete}
                  disabled={deleteConfirm !== group?.title || isDeleting}
                  activeOpacity={0.85}
                >
                  {isDeleting
                    ? <ActivityIndicator color="#FFFFFF" size="small" />
                    : <Text style={styles.deleteText}>Delete Group Permanently</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  scroll:      { paddingBottom: 40 },
  section:     { borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle:{ paddingHorizontal: 16, paddingVertical: 8, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  infoLabel:   { fontSize: 14 },
  infoValue:   { fontSize: 14, fontWeight: '600' },

  editBlock:   { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  fieldLabel:  { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  input:       { paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, borderWidth: 1, borderRadius: 10 },

  imageSlot:   { paddingHorizontal: 16, paddingBottom: 14, position: 'relative' },
  imagePreview:{ width: '100%', height: 150, borderRadius: 10, backgroundColor: '#000' },
  bannerPreview: { height: 110 },
  imageChange: {
    position: 'absolute', bottom: 24, right: 26,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.65)',
  },
  imageChangeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  imageClear: {
    position: 'absolute', top: 8, right: 26,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },

  saveWrap:    { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  saveBtn:     { paddingVertical: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  saveBtnDisabled: { opacity: 0.45 },
  saveText:    { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

  memberRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  memberInfo:  { flex: 1 },
  memberName:  { fontSize: 14, fontWeight: '600' },
  memberRole:  { fontSize: 11, marginTop: 1 },
  roleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
  },
  roleText:    { fontSize: 12, fontWeight: '700' },
  removeBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 9, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
  },
  dangerBlock:   { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  dangerHeading: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  dangerBody:    { fontSize: 13, lineHeight: 19 },
  deleteBtn: {
    marginTop: 14, paddingVertical: 12, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.red,
  },
  deleteText:  { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});

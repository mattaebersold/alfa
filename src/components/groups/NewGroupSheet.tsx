import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Switch,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import SharedModal from '../ui/SharedModal';
import PhotoPickerField from '../ui/PhotoPickerField';
import GroupInvitePicker from './GroupInvitePicker';
import { useCreateGroupMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import { uploadFile } from '../../utils/upload';
import { GROUP_TYPES, groupCategoriesFor } from '../../constants/groupTypes';
import { REGIONS } from '../../constants/regions';
import { COMMON_RADIUS } from '../../constants/radius';
import type { User } from '../../types/api';

interface PickedImage { uri: string; name: string; type: string }

/**
 * The steps, named in the header rather than inside each one — the same
 * arrangement as the garage's create form (CarCreateScreen), so the two
 * multi-step forms in the app move the same way.
 */
const STEP_TITLES = [
  'Group Details',
  'Invite Members',
];

/** One bar that fills — copied from CarCreateScreen's, for the same reason. */
function ProgressBar({ step, total }: { step: number; total: number }) {
  const brand = useBrandColor();
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${(step / total) * 100}%`, backgroundColor: brand }]} />
    </View>
  );
}
const pb = StyleSheet.create({
  track: {
    height: 4, borderRadius: 2, overflow: 'hidden',
    marginHorizontal: 16, marginTop: 12, marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  fill: { height: '100%', borderRadius: 2 },
});

/**
 * Start a group.
 *
 * The button that opened this used to be admin-only and raised a "coming soon"
 * alert — there was no group creation on the phone at all, even though the
 * server has had the endpoint the whole time and doesn't restrict it beyond
 * being signed in. Pro membership is the gate the product wants, so that lives
 * on the button rather than in here.
 *
 * The form asks for what a group needs to be findable and nothing else: a name,
 * a line about it, what kind it is. Description, region and a cover photo are
 * all optional — a group with an empty description is a group people can still
 * join, and making them fill one in is how you get "asdf".
 *
 * Two steps: the group, then who to ask into it. A new group is empty, and the
 * first thing its admin did was open it, find the roster and invite people one
 * at a time. The second step is optional — Create works with nobody picked —
 * and the invitations ride along with the create call rather than following
 * it, because the group has to exist before anyone can be invited to it and
 * the server is the one that knows when it does.
 */
export default function NewGroupSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  /** Handed the new group's id once the server has it. */
  onCreated?: (groupId: string) => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const onBrand = contrastText(brand);
  const [createGroup, { isLoading }] = useCreateGroupMutation();

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('regional');
  const [category, setCategory] = useState('');
  const [region, setRegion] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [image, setImage] = useState<PickedImage | null>(null);
  const [invitees, setInvitees] = useState<User[]>([]);
  const [step, setStep] = useState(1);

  // Back at the first step on every open, even with the answers remembered —
  // reopening onto the invite search hides the form you came back to finish.
  useEffect(() => {
    if (visible) setStep(1);
  }, [visible]);

  const categories = groupCategoriesFor(type);

  const reset = () => {
    setTitle(''); setSubtitle(''); setBody('');
    setType('regional'); setCategory(''); setRegion('');
    setIsPrivate(false); setImage(null); setInvitees([]);
  };

  const close = () => { onClose(); };

  const pickImage = () => {
    Alert.alert('Cover Photo', 'How would you like to add one?', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission needed', 'Camera access is required to take photos.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
          if (!result.canceled) {
            const a = result.assets[0];
            setImage({
              uri: a.uri,
              name: a.fileName ?? `group_${Date.now()}.jpg`,
              type: a.mimeType ?? 'image/jpeg',
            });
          }
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.85,
          });
          if (!result.canceled) {
            const a = result.assets[0];
            setImage({
              uri: a.uri,
              name: a.fileName ?? `group_${Date.now()}.jpg`,
              type: a.mimeType ?? 'image/jpeg',
            });
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submit = async () => {
    const name = title.trim();
    if (!name || isLoading) return;

    const fd = new FormData();
    fd.append('title', name);
    if (subtitle.trim()) fd.append('subtitle', subtitle.trim());
    if (body.trim()) fd.append('body', body.trim());
    fd.append('type', type);
    // Only "Car Type" offers a list and only "Other" takes free text. The rest
    // are a type on their own, and a category for them would be a value the web
    // form never sets.
    if (category.trim() && (categories.length > 0 || type === 'other')) {
      fd.append('category', category.trim());
    }
    // Cleared when the type changes, so this is belt and braces.
    if (type === 'regional' && region.trim()) fd.append('region', region.trim());
    // The server reads this as `body.private || false`, and a FormData value is
    // always a string — so it's appended only when it's actually true, or every
    // group would come out private.
    if (isPrivate) fd.append('private', 'true');
    if (image) fd.append('gallery', uploadFile(image.uri));
    // One JSON field, the way tags and group_ids travel in other multipart
    // calls — a repeated field is easy to get wrong on both ends. The server
    // skips anyone already in the group and never fails the create over one.
    if (invitees.length > 0) {
      fd.append('invite_user_ids', JSON.stringify(invitees.map((u) => u.user_id)));
    }

    try {
      const result = await createGroup(fd).unwrap();
      reset();
      onClose();
      if (result?._id) onCreated?.(result._id);
    } catch (err: any) {
      // The sheet stays open with everything typed still in it.
      Alert.alert(
        'Could not create group',
        err?.data?.error ?? err?.message ?? 'Please try again.',
      );
    }
  };

  const canSubmit = !!title.trim() && !isLoading;
  /** Only the name is required, and it's on the first step. */
  const canAdvance = !!title.trim();

  return (
    <SharedModal
      visible={visible}
      onClose={close}
      heightRatio={0.9}
      titleContent={(
        /* Back, the sheet's name, forward — as CarCreateScreen. A caret is
           absent rather than dimmed at the ends of the run, with a spacer
           holding the name on the midline. */
        <View style={styles.navRow}>
          {step > 1 ? (
            <TouchableOpacity
              style={[styles.navBtn, { backgroundColor: brand }]}
              onPress={() => setStep((s) => s - 1)}
              accessibilityRole="button"
              accessibilityLabel="Previous step"
            >
              <ChevronLeft size={20} color="#000000" strokeWidth={2.6} />
            </TouchableOpacity>
          ) : <View style={styles.navBtn} />}

          <Text style={styles.navTitle} numberOfLines={1}>New Group</Text>

          {step < STEP_TITLES.length ? (
            <TouchableOpacity
              style={[styles.navBtn, { backgroundColor: brand }, !canAdvance && styles.navBtnOff]}
              onPress={() => setStep((s) => s + 1)}
              disabled={!canAdvance}
              accessibilityRole="button"
              accessibilityLabel="Next step"
            >
              <ChevronRight size={20} color="#000000" strokeWidth={2.6} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navBtn, styles.navBtnWide, { backgroundColor: brand }, !canSubmit && styles.navBtnOff]}
              onPress={submit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Create group"
            >
              {isLoading
                ? <ActivityIndicator size="small" color="#000000" />
                : <Text style={styles.navBtnText}>Create</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}
    >
      <ProgressBar step={step} total={STEP_TITLES.length} />
      <Text style={[styles.stepCaption, { color: colors.fg }]}>{STEP_TITLES[step - 1]}</Text>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && (
          <>
            <Label colors={colors} first>Name</Label>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.fg }]}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Pacific Northwest Air-cooled"
              placeholderTextColor={colors.grey}
              maxLength={80}
              // Only while empty: coming back from the invite step shouldn't
              // throw the keyboard up over a name that's already there.
              autoFocus={!title}
            />

            <Label colors={colors}>Tagline</Label>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.fg }]}
              value={subtitle}
              onChangeText={setSubtitle}
              placeholder="One line about the group"
              placeholderTextColor={colors.grey}
              maxLength={120}
            />

            <Label colors={colors}>Type</Label>
            <View style={styles.chips}>
              {GROUP_TYPES.map((t) => {
                const on = type === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => {
                      setType(t.key);
                      // The old category belongs to the old type — keeping it would
                      // file the group under something that isn't offered any more.
                      // "Other" writes free text into the same field, so it's the
                      // same clear.
                      setCategory('');
                      // Region is only asked of regional groups. Left alone, one
                      // picked before switching away would be submitted from a
                      // field no longer on screen.
                      if (t.key !== 'regional') setRegion('');
                    }}
                    style={[
                      styles.chip,
                      on ? { backgroundColor: brand, borderColor: brand } : { borderColor: colors.border },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.chipText, { color: on ? onBrand : colors.fg }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {categories.length > 0 && (
              <>
                <Label colors={colors}>Category</Label>
                <View style={styles.chips}>
                  {categories.map((c) => {
                    const on = category === c.key;
                    return (
                      <TouchableOpacity
                        key={c.key}
                        onPress={() => setCategory(on ? '' : c.key)}
                        style={[
                          styles.chip,
                          on ? { backgroundColor: brand, borderColor: brand } : { borderColor: colors.border },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={[styles.chipText, { color: on ? onBrand : colors.fg }]}>{c.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {type === 'other' && (
              <>
                <Label colors={colors}>Category</Label>
                {/* The one type with nothing to pick from — "Other" is by
                    definition what the five didn't cover, so the only way to say
                    what it is, is to say it. Written to the same `category` the
                    Car Type chips set, which the server stores as free text. */}
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.fg }]}
                  value={category}
                  onChangeText={setCategory}
                  placeholder="e.g. Autocross, Track days, Photography"
                  placeholderTextColor={colors.grey}
                  maxLength={40}
                />
              </>
            )}

            {/* Only a regional group is asked where it is. A single-make
                register or a national club answers "which region" with a shrug,
                and asking anyway is how a Porsche register ends up filed under
                the Northwest because its founder lives there.

                The set, not free text: typed, this produced "PNW", "Pacific NW"
                and "pacific northwest" as three different regions, none of which
                matched what the groups list filters by or what a member's own
                region is derived from. Picking from the set is what makes
                "groups near me" answerable. */}
            {type === 'regional' && (
              <>
                <Label colors={colors}>Region</Label>
                <View style={styles.chips}>
                  {/* Even a regional group can be between regions — a border
                      chapter, a touring club — so this stays a choice rather
                      than a field left empty. */}
                  <TouchableOpacity
                    onPress={() => setRegion('')}
                    style={[
                      styles.chip,
                      !region ? { backgroundColor: brand, borderColor: brand } : { borderColor: colors.border },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: !region }}
                  >
                    <Text style={[styles.chipText, { color: !region ? onBrand : colors.fg }]}>No region</Text>
                  </TouchableOpacity>
                  {REGIONS.map((r) => {
                    const on = region === r.key;
                    return (
                      <TouchableOpacity
                        key={r.key}
                        onPress={() => setRegion(on ? '' : r.key)}
                        style={[
                          styles.chip,
                          on ? { backgroundColor: brand, borderColor: brand } : { borderColor: colors.border },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={[styles.chipText, { color: on ? onBrand : colors.fg }]}>{r.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Label colors={colors}>About</Label>
            <TextInput
              style={[
                styles.input, styles.textarea,
                { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.fg },
              ]}
              value={body}
              onChangeText={setBody}
              placeholder="What the group is for, who it's for, how you run it."
              placeholderTextColor={colors.grey}
              multiline
              textAlignVertical="top"
            />

            <Label colors={colors}>Cover photo</Label>
            {image ? (
              <View style={styles.coverWrap}>
                <Image source={{ uri: image.uri }} style={styles.cover} contentFit="cover" />
                <TouchableOpacity
                  style={styles.coverRemove}
                  onPress={() => setImage(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove cover photo"
                >
                  <X size={15} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <PhotoPickerField
                onPress={pickImage}
                title="Add a cover photo"
                hint="Optional — you can add one later"
              />
            )}

            <View style={[styles.privateRow, { borderColor: colors.border }]}>
              <View style={styles.privateText}>
                <Text style={[styles.privateTitle, { color: colors.fg }]}>Private group</Text>
                <Text style={[styles.privateHint, { color: colors.grey }]}>
                  Hidden from the public list — members join by invitation.
                </Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ true: brand, false: colors.border }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* The way on, at the end of the form as well as in the header — it's
                where the thumb is after the last field. */}
            <TouchableOpacity
              style={[styles.submit, { backgroundColor: brand }, !canAdvance && styles.submitOff]}
              onPress={() => setStep(2)}
              disabled={!canAdvance}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={[styles.submitText, { color: onBrand }]}>Next: Invite Members</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={[styles.stepSub, { color: colors.grey }]}>
              Optional. Everyone you pick gets an invitation once the group is made — you can
              always invite more from the group later.
            </Text>
            <GroupInvitePicker selected={invitees} onChange={setInvitees} />

            <TouchableOpacity
              style={[styles.submit, { backgroundColor: brand }, !canSubmit && styles.submitOff]}
              onPress={submit}
              disabled={!canSubmit}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              {isLoading
                ? <ActivityIndicator size="small" color={onBrand} />
                : (
                  <Text style={[styles.submitText, { color: onBrand }]}>
                    {invitees.length > 0
                      ? `Create & Invite ${invitees.length}`
                      : 'Create Group'}
                  </Text>
                )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SharedModal>
  );
}

function Label({ children, colors, first = false }: { children: React.ReactNode; colors: any; first?: boolean }) {
  // The first sits right under the step caption, which already leaves a gap.
  return <Text style={[styles.label, first && styles.labelFirst, { color: colors.grey }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  label: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, marginTop: 18, marginBottom: 8,
  },
  labelFirst: { marginTop: 0 },
  stepSub: { fontSize: 14, lineHeight: 20, marginBottom: 16 },

  // The step header, as CarCreateScreen's.
  stepCaption: {
    fontSize: 20, fontWeight: '800', letterSpacing: -0.3,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14,
  },
  navRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  navTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 17, fontWeight: '700', color: '#FFFFFF',
  },
  navBtn: {
    width: 34, height: 34, borderRadius: COMMON_RADIUS,
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnOff: { opacity: 0.5 },
  navBtnWide: { width: 'auto', paddingHorizontal: 12 },
  navBtnText: { fontSize: 14, fontWeight: '800', color: '#000000' },
  input: {
    minHeight: 46, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, fontSize: 15,
  },
  textarea: { height: 110, paddingTop: 12, paddingBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1.5,
  },
  chipText: { fontSize: 13, fontWeight: '700' },

  coverWrap: { position: 'relative' },
  cover:     { width: '100%', height: 150, borderRadius: 12 },
  coverRemove: {
    position: 'absolute', top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },

  privateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginTop: 22, paddingVertical: 14, paddingHorizontal: 14,
    borderWidth: 1, borderRadius: 12,
  },
  privateText:  { flex: 1 },
  privateTitle: { fontSize: 15, fontWeight: '700' },
  privateHint:  { fontSize: 12, marginTop: 2, lineHeight: 16 },

  submit: {
    marginTop: 24, height: 50, borderRadius: COMMON_RADIUS,
    alignItems: 'center', justifyContent: 'center',
  },
  submitOff:  { opacity: 0.45 },
  submitText: { fontSize: 16, fontWeight: '800' },
});

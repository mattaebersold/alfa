import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, X } from 'lucide-react-native';
import SharedModal from '../ui/SharedModal';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { toUploadableJpeg, uploadFile } from '../../utils/upload';
import { LINK_LABEL_MAX, listLinkLabel, normalizeListLink } from '../../utils/listLinks';
import { ss } from '../../styles/shared';
import { COMMON_RADIUS } from '../../constants/radius';

/**
 * One list item as the form holds it — the same shape whether it's a brand-new
 * entry staged on the create screen or an edit to one the server already has.
 */
export interface ListItemDraft {
  title: string;
  description: string;
  /** Already normalised to http(s) by the sheet, or `''` for no link. */
  link: string;
  linkLabel: string;
  /** A photo picked in this sitting — a local file, not yet uploaded. */
  photoUri: string | null;
  /**
   * Editing only: the photo the server holds is to go, either because it was
   * removed or because `photoUri` replaces it.
   */
  removeExistingPhoto: boolean;
}

/** What the sheet opens with when editing. */
export interface ListItemSheetInitial {
  title: string;
  description?: string | null;
  link?: string | null;
  linkLabel?: string | null;
  /** Something displayable — a local uri for a staged item, a CDN url for a saved one. */
  photoUrl?: string | null;
  /** True when `photoUrl` is the server's photo rather than a staged local one. */
  photoIsSaved?: boolean;
}

/**
 * Writes a draft into the multipart body the item endpoints take.
 *
 * Here rather than in each screen because create and update must agree on the
 * field names, and because the photo rule is easy to get half right: a
 * replacement has to *name the photo it replaces*, or the server appends the
 * new one after the old and the old — still first — keeps being shown.
 *
 * `link` and `link_label` are always sent, empty when cleared: on an update an
 * absent field means "leave it", and removing a link has to be sayable.
 */
export function appendItemDraft(fd: FormData, draft: ListItemDraft, savedPhotoFilename?: string | null) {
  fd.append('title', draft.title.trim());
  fd.append('description', draft.description.trim());
  fd.append('link', draft.link);
  fd.append('link_label', draft.link ? draft.linkLabel.trim() : '');
  if (draft.photoUri) fd.append('gallery', uploadFile(draft.photoUri));
  if (savedPhotoFilename && draft.removeExistingPhoto) {
    fd.append('modifyImage:remove:0', savedPhotoFilename);
  }
}

/**
 * Add or edit one entry on a list.
 *
 * A sheet over the list form rather than fields inline in it: an entry is five
 * fields, a list is often five entries, and twenty-five inputs down one screen
 * is a form nobody finishes. The list form shows the entries as rows; this is
 * where one is written.
 *
 * It returns a draft and saves nothing itself — the create screen stages
 * drafts until the list exists to hang them on, the edit screen sends each one
 * straight away, and the sheet needn't know which it's in.
 */
export default function ListItemSheet({ visible, initial, saving, onSubmit, onClose }: {
  visible: boolean;
  /** Editing this entry; `null` for a new one. */
  initial?: ListItemSheetInitial | null;
  /** The host is mid-request — the button waits, and the sheet stays up. */
  saving?: boolean;
  onSubmit: (draft: ListItemDraft) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [removedSaved, setRemovedSaved] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Refilled on every open, not on every `initial`: the host's `initial` is
  // rebuilt each render, and resetting on that would wipe the fields mid-typing.
  useEffect(() => {
    if (!visible) return;
    setTitle(initial?.title ?? '');
    setDescription(initial?.description ?? '');
    setLink(initial?.link ?? '');
    setLinkLabel(initial?.linkLabel ?? '');
    setPhotoUrl(initial?.photoUrl ?? null);
    // A staged item's photo is already a local pick; carry it through so
    // editing the title doesn't lose the photo.
    setPickedUri(initial?.photoUrl && !initial.photoIsSaved ? initial.photoUrl : null);
    setRemovedSaved(false);
    setLinkError(null);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    // iOS hands back HEIC, which the server can't decode — see utils/upload.
    const uri = await toUploadableJpeg(result.assets[0].uri);
    setPickedUri(uri);
    setPhotoUrl(uri);
    if (initial?.photoIsSaved) setRemovedSaved(true);
  };

  const clearPhoto = () => {
    setPickedUri(null);
    setPhotoUrl(null);
    if (initial?.photoIsSaved) setRemovedSaved(true);
  };

  const normalizedLink = link.trim() ? normalizeListLink(link) : '';
  const canSave = !!title.trim() && !saving;

  const submit = () => {
    if (!title.trim()) return;
    if (normalizedLink === null) {
      // Said under the field rather than in an alert: it's one field's problem,
      // and an alert over a sheet over a modal screen is three layers deep.
      setLinkError("That doesn't look like a web address. Try something like porsche.com/history.");
      return;
    }
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      link: normalizedLink,
      linkLabel: normalizedLink ? linkLabel.trim() : '',
      photoUri: pickedUri,
      removeExistingPhoto: removedSaved,
    });
  };

  const field = { backgroundColor: colors.card, color: colors.fg, borderColor: colors.border };

  return (
    <SharedModal visible={visible} onClose={onClose} title={initial ? 'Edit item' : 'Add item'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          style={[styles.photoPicker, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={pickPhoto}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={photoUrl ? 'Change photo' : 'Add a photo'}
        >
          {photoUrl ? (
            <>
              <Image source={{ uri: photoUrl }} style={styles.photo} contentFit="cover" />
              <TouchableOpacity
                style={styles.removePhoto}
                onPress={clearPhoto}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
              >
                <X size={15} color="#fff" />
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.photoBlank}>
              <ImagePlus size={22} color={colors.grey} />
              <Text style={[styles.photoBlankText, { color: colors.grey }]}>Add a photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={[styles.label, { color: colors.muted }]}>Title *</Text>
        <TextInput
          style={[ss.input, field]}
          value={title}
          onChangeText={setTitle}
          placeholder="Marcello Gandini"
          placeholderTextColor={colors.grey}
          maxLength={120}
        />

        <Text style={[styles.label, { color: colors.muted }]}>Description</Text>
        <TextInput
          style={[ss.input, styles.multi, field]}
          value={description}
          onChangeText={setDescription}
          placeholder="Why it's on the list (optional)"
          placeholderTextColor={colors.grey}
          multiline
          textAlignVertical="top"
        />

        <Text style={[styles.label, { color: colors.muted }]}>Link</Text>
        <TextInput
          style={[ss.input, field, linkError ? { borderColor: colors.red } : null]}
          value={link}
          onChangeText={(v) => { setLink(v); if (linkError) setLinkError(null); }}
          placeholder="https:// (optional)"
          placeholderTextColor={colors.grey}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          textContentType="URL"
        />
        {linkError ? <Text style={[styles.error, { color: colors.red }]}>{linkError}</Text> : null}

        {/* Only once there's a link to label — a label field over an empty
            link is a question about a button that won't exist. */}
        {link.trim() ? (
          <>
            <Text style={[styles.label, { color: colors.muted }]}>Button label</Text>
            <TextInput
              style={[ss.input, field]}
              value={linkLabel}
              onChangeText={setLinkLabel}
              placeholder={normalizedLink ? listLinkLabel(normalizedLink) : 'Read more'}
              placeholderTextColor={colors.grey}
              maxLength={LINK_LABEL_MAX}
            />
            <Text style={[styles.hint, { color: colors.grey }]}>
              {normalizedLink
                ? `Optional. Left blank, the button says "${listLinkLabel(normalizedLink)}".`
                : "Optional. Left blank, the button says the site's name."}
            </Text>
          </>
        ) : null}

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: brand }, !canSave && styles.saveBtnOff]}
          onPress={submit}
          disabled={!canSave}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          {saving
            ? <ActivityIndicator size="small" color="#000000" />
            : <Text style={styles.saveText}>{initial ? 'Save item' : 'Add to list'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 28 },
  // Square, because that's how the item is shown — a letterbox picker invites
  // a crop the list then cuts the sides off.
  photoPicker: {
    width: 120, height: 120, borderRadius: COMMON_RADIUS, borderWidth: 1,
    overflow: 'hidden', alignSelf: 'center', marginBottom: 6,
  },
  photo: { width: '100%', height: '100%' },
  removePhoto: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 4,
  },
  photoBlank:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoBlankText: { fontSize: 12, fontWeight: '600' },

  label: {
    fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  multi: { minHeight: 76 },
  hint:  { fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  error: { fontSize: 12.5, lineHeight: 18, marginTop: 6, fontWeight: '600' },

  saveBtn:    { marginTop: 22, paddingVertical: 14, borderRadius: COMMON_RADIUS, alignItems: 'center' },
  saveBtnOff: { opacity: 0.5 },
  saveText:   { color: '#000000', fontSize: 15, fontWeight: '800' },
});

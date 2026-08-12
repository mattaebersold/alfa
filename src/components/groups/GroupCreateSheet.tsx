import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import {
  useCreatePostMutation,
  useCreateGroupForumPostMutation,
  useCreateGroupNewsPostMutation,
  useCreateGroupResourceMutation,
} from '../../api/apiService';
import SharedModal from '../ui/SharedModal';
import { useColors } from '../../hooks/useColors';
import { contrastText } from '../../hooks/useBrandColor';
import { categoryColor, pillTextColor } from '../../utils/categoryColor';

/**
 * "New <whatever you're looking at>" for a group section.
 *
 * One sheet rather than four, because the four differ only in which endpoint
 * they hit and which fields they show. It closes on success and lets RTK
 * Query's tag invalidation refresh the list behind it — no manual refetch, and
 * nothing to navigate back from.
 */

export type CreateKind = 'posts' | 'forum' | 'news' | 'resources';

const KIND_TITLE: Record<CreateKind, string> = {
  posts:     'New Post',
  forum:     'New Forum Post',
  news:      'New News Item',
  resources: 'New Resource',
};

interface Props {
  kind: CreateKind;
  groupId: string;
  groupTitle?: string;
  /** Categories offered for this section, already narrowed to the real set. */
  categories: { key: string; label: string }[];
  /** Preselected when opened from a category header; still changeable here. */
  initialCategory?: string;
  visible: boolean;
  onClose: () => void;
}

export default function GroupCreateSheet({
  kind, groupId, groupTitle, categories, initialCategory, visible, onClose,
}: Props) {
  const c = useColors();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<string>('general');
  /**
   * Off by default. A post made from inside a group is a post *to that group*;
   * pushing it to the public feed as well is the deliberate extra step.
   */
  const [alsoPublic, setAlsoPublic] = useState(false);

  const [createPost, { isLoading: postingPost }] = useCreatePostMutation();
  const [createForum, { isLoading: postingForum }] = useCreateGroupForumPostMutation();
  const [createNews, { isLoading: postingNews }] = useCreateGroupNewsPostMutation();
  const [createResource, { isLoading: postingResource }] = useCreateGroupResourceMutation();
  const saving = postingPost || postingForum || postingNews || postingResource;

  // Reset on open, not on close — clearing while it animates out is visible.
  useEffect(() => {
    if (visible) {
      setTitle('');
      setBody('');
      setUrl('');
      setCategory(initialCategory ?? categories[0]?.key ?? 'general');
      setAlsoPublic(false);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const showCategory = kind === 'posts' || kind === 'forum' || kind === 'resources';
  const showUrl = kind === 'news' || kind === 'resources';
  const bodyRequired = kind !== 'posts'; // a photo-less post can still be a caption

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Give this a title first.');
      return;
    }
    if (bodyRequired && !body.trim()) {
      Alert.alert('Body required', 'Add some detail before posting.');
      return;
    }

    try {
      if (kind === 'posts') {
        // The post endpoint takes multipart because it also accepts images;
        // this sheet is text-only, so the form is just the fields.
        const fd = new FormData();
        fd.append('title', title.trim());
        fd.append('body', body.trim());
        fd.append('type', 'general');
        fd.append('category', category);
        // Pre-selected and not editable here — you're posting from inside it.
        fd.append('group_ids', JSON.stringify([groupId]));
        if (alsoPublic) fd.append('also_public', 'true');
        await createPost(fd).unwrap();
      } else if (kind === 'forum') {
        await createForum({ group_id: groupId, title: title.trim(), body: body.trim(), category }).unwrap();
      } else if (kind === 'news') {
        await createNews({ group_id: groupId, title: title.trim(), body: body.trim(), url: url.trim() || undefined }).unwrap();
      } else {
        await createResource({ group_id: groupId, title: title.trim(), body: body.trim(), url: url.trim() || undefined, category }).unwrap();
      }
      onClose();
    } catch {
      // Stay open with everything typed still there — a network blip shouldn't
      // cost you the whole form.
      Alert.alert('Could not save', 'Please try again.');
    }
  };

  return (
    <SharedModal visible={visible} onClose={onClose} title={KIND_TITLE[kind]} heightRatio={0.85}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {groupTitle ? (
          <View style={[styles.groupChip, { backgroundColor: c.secondary, borderColor: c.borderDark }]}>
            <Text style={[styles.groupChipLabel, { color: c.grey }]}>Posting to</Text>
            <Text style={[styles.groupChipName, { color: c.fg }]} numberOfLines={1}>{groupTitle}</Text>
          </View>
        ) : null}

        <Text style={[styles.label, { color: c.grey }]}>Title</Text>
        <TextInput
          style={[styles.input, { borderColor: c.borderDark, color: c.fg, backgroundColor: c.card }]}
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor={c.grey}
          autoFocus
        />

        <Text style={[styles.label, { color: c.grey }]}>
          {kind === 'posts' ? 'Body' : 'Details'}
        </Text>
        <TextInput
          style={[styles.input, styles.inputMulti, { borderColor: c.borderDark, color: c.fg, backgroundColor: c.card }]}
          value={body}
          onChangeText={setBody}
          placeholder={kind === 'posts' ? "What's on your mind…" : 'Add some detail…'}
          placeholderTextColor={c.grey}
          multiline
        />

        {showUrl && (
          <>
            <Text style={[styles.label, { color: c.grey }]}>Link (optional)</Text>
            <TextInput
              style={[styles.input, { borderColor: c.borderDark, color: c.fg, backgroundColor: c.card }]}
              value={url}
              onChangeText={setUrl}
              placeholder="https://…"
              placeholderTextColor={c.grey}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </>
        )}

        {showCategory && categories.length > 0 && (
          <>
            <Text style={[styles.label, { color: c.grey }]}>Category</Text>
            <View style={styles.chips}>
              {categories.map((cat) => {
                const active = category === cat.key;
                const tint = categoryColor(cat.key);
                return (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => setCategory(cat.key)}
                    style={[
                      styles.chip,
                      { borderColor: c.borderDark, backgroundColor: c.secondary },
                      active && { backgroundColor: tint, borderColor: tint },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? pillTextColor(tint) : c.fg }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {kind === 'posts' && (
          <TouchableOpacity
            style={styles.publicRow}
            onPress={() => setAlsoPublic((v) => !v)}
            activeOpacity={0.75}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: alsoPublic }}
          >
            <View style={[
              styles.checkbox,
              { borderColor: c.borderDark },
              alsoPublic && { backgroundColor: c.primaryAlt, borderColor: c.primaryAlt },
            ]}>
              {alsoPublic && <Text style={[styles.checkMark, { color: contrastText(c.primaryAlt) }]}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.publicLabel, { color: c.fg }]}>Also post publicly</Text>
              <Text style={[styles.publicHint, { color: c.grey }]}>
                Off by default — this goes to the group either way.
              </Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.submit, { backgroundColor: c.pro }, (saving || !title.trim()) && styles.submitOff]}
          onPress={submit}
          disabled={saving || !title.trim()}
        >
          {saving
            ? <ActivityIndicator color="#000000" />
            : <Text style={styles.submitText}>Post</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  body:        { padding: 16, paddingBottom: 40 },
  groupChip:   {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 4,
  },
  groupChipLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  groupChipName:  { fontSize: 13, fontWeight: '700' },
  label:       { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 6 },
  input:       { height: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 15 },
  inputMulti:  { height: 120, paddingTop: 12, textAlignVertical: 'top' },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:        { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  chipText:    { fontSize: 12, fontWeight: '700' },
  publicRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 22 },
  checkbox:    { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkMark:   { fontSize: 13, fontWeight: '900' },
  publicLabel: { fontSize: 15, fontWeight: '600' },
  publicHint:  { fontSize: 12, marginTop: 2 },
  submit:      { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 26 },
  submitOff:   { opacity: 0.4 },
  submitText:  { fontSize: 16, fontWeight: '800', color: '#000000' },
});

import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useUpdatePostMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { colors } from '../../constants/colors';
import { TYPE_LABELS, CATEGORY_LABELS } from '../ui/Badge';
import type { Post } from '../../types/api';

const TYPES = [
  { key: 'general', label: 'Post' },
  { key: 'record',  label: 'Record' },
  { key: 'spot',    label: 'Spotted' },
  { key: 'listing', label: 'Listing' },
  { key: 'want',    label: 'Want Ad' },
];

const CATEGORIES_BY_TYPE: Record<string, { key: string; label: string }[]> = {
  general: [{ key: 'show', label: 'Show' }, { key: 'misc', label: 'Misc.' }],
  record:  [
    { key: 'general', label: 'General' }, { key: 'mod', label: 'Mod' },
    { key: 'restoration', label: 'Restoration' }, { key: 'maintenance', label: 'Maintenance' },
    { key: 'detailing', label: 'Detailing' },
  ],
  spot:    [{ key: 'show', label: 'Show' }, { key: 'museum', label: 'Museum' }, { key: 'wild', label: 'In the Wild' }],
  listing: [
    { key: 'new', label: 'New Part' }, { key: 'used', label: 'Used Part' },
    { key: 'car', label: 'Car' }, { key: 'accessories', label: 'Accessories' }, { key: 'other', label: 'Other' },
  ],
  want:    [{ key: 'part', label: 'Part' }, { key: 'car', label: 'Car' }, { key: 'other', label: 'Other' }],
};

interface Props {
  post: Post;
  visible: boolean;
  onClose: () => void;
}

export default function PostEditSheet({ post, visible, onClose }: Props) {
  const colors = useColors();
  const [updatePost, { isLoading }] = useUpdatePostMutation();

  const [title, setTitle] = useState(post.title ?? '');
  const [body, setBody] = useState(post.body ?? '');
  const [type, setType] = useState(post.type ?? 'general');
  const [category, setCategory] = useState(post.category ?? '');

  useEffect(() => {
    if (visible) {
      setTitle(post.title ?? '');
      setBody(post.body ?? '');
      setType(post.type ?? 'general');
      setCategory(post.category ?? '');
    }
  }, [visible, post]);

  const categories = CATEGORIES_BY_TYPE[type] ?? [];

  const handleSave = async () => {
    const fd = new FormData();
    fd.append('internal_id', post.internal_id);
    fd.append('title', title.trim());
    fd.append('body', body.trim());
    fd.append('type', type);
    if (category) fd.append('category', category);
    try {
      await updatePost(fd).unwrap();
      onClose();
    } catch {
      Alert.alert('Error', 'Could not save changes.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrap}>
          <View style={[styles.sheet, { backgroundColor: colors.cream }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.headerTitle, { color: colors.fg }]}>Edit Post</Text>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <X size={22} color={colors.grey} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              {/* Title */}
              <Text style={[styles.label, { color: colors.grey }]}>Title</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.fg, backgroundColor: colors.card }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Add a title..."
                placeholderTextColor={colors.grey}
              />

              {/* Body */}
              <Text style={[styles.label, { color: colors.grey }]}>Body</Text>
              <TextInput
                style={[styles.input, styles.bodyInput, { borderColor: colors.border, color: colors.fg, backgroundColor: colors.card }]}
                value={body}
                onChangeText={setBody}
                placeholder="What's on your mind?"
                placeholderTextColor={colors.grey}
                multiline
              />

              {/* Type */}
              <Text style={[styles.label, { color: colors.grey }]}>Type</Text>
              <View style={styles.pills}>
                {TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.pill, { borderColor: colors.border, backgroundColor: colors.card },
                      type === t.key && { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt }]}
                    onPress={() => { setType(t.key); setCategory(''); }}
                  >
                    <Text style={[styles.pillText, { color: colors.grey }, type === t.key && { color: '#FFF' }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Category */}
              {categories.length > 0 && (
                <>
                  <Text style={[styles.label, { color: colors.grey }]}>Category</Text>
                  <View style={styles.pills}>
                    {categories.map((c) => (
                      <TouchableOpacity
                        key={c.key}
                        style={[styles.pill, { borderColor: colors.border, backgroundColor: colors.card },
                          category === c.key && { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt }]}
                        onPress={() => setCategory(c.key)}
                      >
                        <Text style={[styles.pillText, { color: colors.grey }, category === c.key && { color: '#FFF' }]}>
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, isLoading && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={isLoading}
              >
                {isLoading
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={styles.saveBtnText}>Save Changes</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(100,100,100,0.55)' },
  backdrop:    { ...StyleSheet.absoluteFillObject },
  sheetWrap:   { maxHeight: '90%' },
  sheet:       { borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  header:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  form:        { padding: 16, gap: 6, paddingBottom: 32 },
  label:       { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 4 },
  input:       { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  bodyInput:   { minHeight: 100, textAlignVertical: 'top' },
  pills:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  pillText:    { fontSize: 13, fontWeight: '600' },
  saveBtn:     { backgroundColor: colors.primaryAlt, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});

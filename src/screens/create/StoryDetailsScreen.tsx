import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useCreatePostMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { Colors } from '../../constants/colors';
import type { AppScreenProps } from '../../navigation/types';

type Props = AppScreenProps<'StoryDetails'>;

export default function StoryDetailsScreen({ route }: Props) {
  const { videoUri, thumbnailUri } = route.params;
  const navigation = useNavigation();
  const colors = useColors();
  const [createPost, { isLoading }] = useCreatePostMutation();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please add a title to your story.');
      return;
    }

    try {
      const fd = new FormData();
      fd.append('type', 'story');
      fd.append('entry_type', 'post');
      fd.append('status', 'published');
      fd.append('title', title.trim());
      if (body.trim()) fd.append('body', body.trim());

      // Thumbnail as gallery[0]
      fd.append('gallery', {
        uri: Platform.OS === 'ios' ? thumbnailUri.replace('file://', '') : thumbnailUri,
        name: 'thumbnail.jpg',
        type: 'image/jpeg',
      } as any);

      // Video
      fd.append('video', {
        uri: Platform.OS === 'ios' ? videoUri.replace('file://', '') : videoUri,
        name: 'story.mp4',
        type: 'video/mp4',
      } as any);

      await createPost(fd).unwrap();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Pop back to the feed (close both story screens)
      navigation.getParent()?.goBack();
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err?.data?.error ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Thumbnail preview */}
          <View style={styles.thumbContainer}>
            <Image
              source={{ uri: thumbnailUri }}
              style={styles.thumbnail}
              contentFit="cover"
            />
          </View>

          <View style={[styles.form, { backgroundColor: colors.card }]}>
            {/* Title */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.muted }]}>
                Title <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Give your story a title…"
                placeholderTextColor={colors.grey}
                style={[styles.input, { borderColor: colors.border, color: colors.fg }]}
                maxLength={120}
                returnKeyType="next"
              />
            </View>

            {/* Caption */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.muted }]}>Caption (optional)</Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Add a caption…"
                placeholderTextColor={colors.grey}
                style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.fg }]}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        </ScrollView>

        {/* Submit button */}
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading || !title.trim()}
            style={[
              styles.submitBtn,
              { backgroundColor: Colors.brg },
              (isLoading || !title.trim()) && styles.submitBtnDisabled,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitText}>Post Story</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1 },
  flex:             { flex: 1 },
  scroll:           { paddingBottom: 20 },

  thumbContainer:   { width: '100%', height: 200 },
  thumbnail:        { width: '100%', height: '100%' },

  form:             { marginTop: 16, marginHorizontal: 16, borderRadius: 12, padding: 16, gap: 16 },
  field:            { gap: 6 },
  label:            { fontSize: 13, fontWeight: '500' },
  required:         { color: '#ef4444' },
  input:            {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15,
  },
  textArea:         { minHeight: 90, paddingTop: 10 },

  footer:           {
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  submitBtn:        {
    borderRadius: 50, paddingVertical: 14, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText:       { color: '#fff', fontWeight: '700', fontSize: 15 },
});

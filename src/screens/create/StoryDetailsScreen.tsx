import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { uploadFile } from '../../utils/upload';
import { useNavigation } from '@react-navigation/native';
import { StackActions } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { useCreatePostMutation } from '../../api/apiService';
import { apiService } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { colors } from '../../constants/colors';
import type { AppScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';

type Props = AppScreenProps<'StoryDetails'>;

export default function StoryDetailsScreen({ route }: Props) {
  const { videoUri, thumbnailUri } = route.params;
  const navigation = useNavigation();
  const dispatch = useDispatch();
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
      fd.append('gallery', uploadFile(thumbnailUri));

      // Video
      fd.append('video', uploadFile(videoUri));

      await createPost(fd).unwrap();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Refresh the stories row on the feed
      dispatch(apiService.util.invalidateTags(['Stories']));

      // Pop all story screens off the stack and return to MainTabs
      navigation.dispatch(StackActions.popToTop());
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err?.data?.error ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
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
                style={[ss.input, { borderColor: colors.border, color: colors.fg }]}
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
                style={[ss.input, styles.textArea, { borderColor: colors.border, color: colors.fg }]}
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
              { backgroundColor: colors.primaryAlt },
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
  flex:             { flex: 1 },
  scroll:           { paddingBottom: 20 },

  thumbContainer:   { width: '100%', height: 200 },
  thumbnail:        { width: '100%', height: '100%' },

  form:             { marginTop: 16, marginHorizontal: 16, borderRadius: 12, padding: 16, gap: 16 },
  field:            { gap: 6 },
  label:            { fontSize: 13, fontWeight: '500' },
  required:         { color: '#ef4444' },
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

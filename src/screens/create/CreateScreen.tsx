import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FileText, ShoppingBag, Search, ImagePlus, X } from 'lucide-react-native';
import { useCreatePostMutation } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

type PostType = 'post' | 'listing' | 'want';

const TYPE_OPTIONS: { type: PostType; label: string; icon: (c: string) => React.ReactNode; color: string }[] = [
  { type: 'post',    label: 'Post',    icon: (c) => <FileText size={22} color={c} />,    color: Colors.brg },
  { type: 'listing', label: 'Listing', icon: () => <ShoppingBag size={22} color='#00C851' />, color: '#00C851' },
  { type: 'want',    label: 'Want Ad', icon: () => <Search size={22} color='#F1184C' />,  color: '#F1184C' },
];

export default function CreateScreen() {
  const appNav = useNavigation<AppNav>();
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);

  const [postType, setPostType] = useState<PostType>('post');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [price, setPrice] = useState('');
  const [images, setImages] = useState<{ uri: string; name: string; type: string }[]>([]);

  const [createPost, { isLoading: submitting }] = useCreatePostMutation();

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled) {
      const picked = result.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? `photo_${Date.now()}.jpg`,
        type: a.mimeType ?? 'image/jpeg',
      }));
      setImages((prev) => [...prev, ...picked].slice(0, 8));
    }
  }, []);

  const removeImage = useCallback((idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (postType !== 'post' && !title.trim()) {
      Alert.alert('Title required', 'Please add a title for your listing.');
      return;
    }
    if (!body.trim() && images.length === 0) {
      Alert.alert('Content required', 'Please add some text or an image.');
      return;
    }

    const fd = new FormData();
    fd.append('entry_type', postType);
    fd.append('type', postType);
    if (title.trim()) fd.append('title', title.trim());
    if (body.trim()) fd.append('body', body.trim());
    if (price.trim()) fd.append('price', price.trim());

    images.forEach((img) => {
      fd.append('gallery', {
        uri: Platform.OS === 'ios' ? img.uri.replace('file://', '') : img.uri,
        name: img.name,
        type: img.type,
      } as any);
    });

    try {
      await createPost(fd).unwrap();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      appNav.goBack();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Could not create post. Please try again.');
    }
  }, [postType, title, body, price, images, createPost, appNav]);

  const showTitle = postType !== 'post';
  const showPrice = postType === 'listing';

  const displayName = userInfo
    ? `${userInfo.firstName} ${userInfo.lastName}`.trim() || userInfo.username
    : '';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type selector */}
        <View style={[styles.typeRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {TYPE_OPTIONS.map(({ type, label, icon, color }) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeBtn,
                { borderColor: colors.border },
                postType === type && { borderColor: color, backgroundColor: color + '15' },
              ]}
              onPress={() => setPostType(type)}
            >
              {icon(postType === type ? color : colors.grey)}
              <Text style={[styles.typeLabel, { color: colors.grey }, postType === type && { color }]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Author row */}
        <View style={[styles.authorRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Avatar
            filename={userInfo?.gallery?.[0]?.filename ?? userInfo?.profilePicture}
            name={displayName}
            size={40}
          />
          <Text style={[styles.authorName, { color: colors.fg }]}>{displayName}</Text>
        </View>

        {/* Title (for listings / want ads) */}
        {showTitle && (
          <TextInput
            style={[styles.titleInput, { backgroundColor: colors.card, color: colors.fg, borderBottomColor: colors.border }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Title..."
            placeholderTextColor={colors.grey}
          />
        )}

        {/* Body */}
        <TextInput
          style={[styles.bodyInput, { backgroundColor: colors.card, color: colors.fg, borderBottomColor: colors.border }]}
          value={body}
          onChangeText={setBody}
          placeholder={
            postType === 'post' ? "What's on your mind?"
            : postType === 'listing' ? 'Describe your item...'
            : 'What are you looking for?'
          }
          placeholderTextColor={colors.grey}
          multiline
          textAlignVertical="top"
        />

        {/* Price (listings only) */}
        {showPrice && (
          <TextInput
            style={[styles.priceInput, { backgroundColor: colors.card, color: colors.fg, borderBottomColor: colors.border }]}
            value={price}
            onChangeText={setPrice}
            placeholder="Price (e.g. 1500)"
            placeholderTextColor={colors.grey}
            keyboardType="numeric"
          />
        )}

        {/* Image previews */}
        {images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.imageRow, { backgroundColor: colors.card }]}>
            {images.map((img, idx) => (
              <View key={idx} style={styles.imageWrap}>
                <Image source={{ uri: img.uri }} style={styles.imageThumb} contentFit="cover" />
                <TouchableOpacity style={styles.imageRemove} onPress={() => removeImage(idx)}>
                  <X size={12} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Add image button */}
        <TouchableOpacity
          style={[styles.addImageBtn, { backgroundColor: colors.card, borderTopColor: colors.border }]}
          onPress={pickImage}
        >
          <ImagePlus size={18} color={Colors.brg} />
          <Text style={styles.addImageText}>Add Photos</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Submit button */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitText}>
              {postType === 'post' ? 'Post' : postType === 'listing' ? 'List It' : 'Post Want Ad'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1 },
  scroll:        { flex: 1 },
  content:       { paddingBottom: 16 },
  typeRow:       {
    flexDirection: 'row', gap: 10, padding: 14,
    borderBottomWidth: 1,
  },
  typeBtn:       {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 10,
    borderWidth: 2,
  },
  typeLabel:     { fontSize: 12, fontWeight: '700' },
  authorRow:     {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14,
    borderBottomWidth: 1,
  },
  authorName:    { fontSize: 15, fontWeight: '700' },
  titleInput:    {
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 18, fontWeight: '700',
    borderBottomWidth: 1,
  },
  bodyInput:     {
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, minHeight: 120,
    borderBottomWidth: 1,
    lineHeight: 22,
  },
  priceInput:    {
    paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15,
    borderBottomWidth: 1,
  },
  imageRow:      { paddingHorizontal: 14, paddingVertical: 10 },
  imageWrap:     { marginRight: 8, position: 'relative' },
  imageThumb:    { width: 80, height: 80, borderRadius: 8 },
  imageRemove:   {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  addImageBtn:   {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 14,
    borderTopWidth: 1,
  },
  addImageText:  { fontSize: 14, fontWeight: '600', color: Colors.brg },
  footer:        {
    padding: 14,
    borderTopWidth: 1,
  },
  submitBtn:     {
    backgroundColor: Colors.brg, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:    { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});

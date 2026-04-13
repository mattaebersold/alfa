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
import type { AppStackParamList } from '../../navigation/types';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

type PostType = 'post' | 'listing' | 'want';

const TYPE_OPTIONS: { type: PostType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'post',    label: 'Post',     icon: <FileText size={22} color={Colors.brg} />,     color: Colors.brg },
  { type: 'listing', label: 'Listing',  icon: <ShoppingBag size={22} color='#00C851' />,      color: '#00C851' },
  { type: 'want',    label: 'Want Ad',  icon: <Search size={22} color='#F1184C' />,            color: '#F1184C' },
];

export default function CreateScreen() {
  const appNav = useNavigation<AppNav>();
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

    images.forEach((img, i) => {
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
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type selector */}
        <View style={styles.typeRow}>
          {TYPE_OPTIONS.map(({ type, label, icon, color }) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeBtn,
                postType === type && { borderColor: color, backgroundColor: color + '15' },
              ]}
              onPress={() => setPostType(type)}
            >
              {icon}
              <Text style={[styles.typeLabel, postType === type && { color }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Author row */}
        <View style={styles.authorRow}>
          <Avatar
            filename={userInfo?.gallery?.[0]?.filename ?? userInfo?.profilePicture}
            name={displayName}
            size={40}
          />
          <Text style={styles.authorName}>{displayName}</Text>
        </View>

        {/* Title (for listings / want ads) */}
        {showTitle && (
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Title..."
            placeholderTextColor={Colors.grey}
          />
        )}

        {/* Body */}
        <TextInput
          style={styles.bodyInput}
          value={body}
          onChangeText={setBody}
          placeholder={
            postType === 'post' ? "What's on your mind?"
            : postType === 'listing' ? 'Describe your item...'
            : 'What are you looking for?'
          }
          placeholderTextColor={Colors.grey}
          multiline
          textAlignVertical="top"
        />

        {/* Price (listings only) */}
        {showPrice && (
          <TextInput
            style={styles.priceInput}
            value={price}
            onChangeText={setPrice}
            placeholder="Price (e.g. 1500)"
            placeholderTextColor={Colors.grey}
            keyboardType="numeric"
          />
        )}

        {/* Image previews */}
        {images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow}>
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
        <TouchableOpacity style={styles.addImageBtn} onPress={pickImage}>
          <ImagePlus size={18} color={Colors.brg} />
          <Text style={styles.addImageText}>Add Photos</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Submit button */}
      <View style={styles.footer}>
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
  safe:          { flex: 1, backgroundColor: Colors.cream },
  scroll:        { flex: 1 },
  content:       { paddingBottom: 16 },
  typeRow:       {
    flexDirection: 'row', gap: 10, padding: 14,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  typeBtn:       {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border,
  },
  typeLabel:     { fontSize: 12, fontWeight: '700', color: Colors.grey },
  authorRow:     {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  authorName:    { fontSize: 15, fontWeight: '700', color: Colors.fg },
  titleInput:    {
    backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 18, fontWeight: '700', color: Colors.fg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  bodyInput:     {
    backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: Colors.fg, minHeight: 120,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    lineHeight: 22,
  },
  priceInput:    {
    backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: Colors.fg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  imageRow:      { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  imageWrap:     { marginRight: 8, position: 'relative' },
  imageThumb:    { width: 80, height: 80, borderRadius: 8 },
  imageRemove:   {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  addImageBtn:   {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 14, backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  addImageText:  { fontSize: 14, fontWeight: '600', color: Colors.brg },
  footer:        {
    backgroundColor: '#FFFFFF', padding: 14,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  submitBtn:     {
    backgroundColor: Colors.brg, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:    { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});

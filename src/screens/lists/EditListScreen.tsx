import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Switch, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { uploadFile } from '../../utils/upload';
import { ImagePlus, X } from 'lucide-react-native';
import { useGetListQuery, useUpdateListMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import Spinner from '../../components/ui/Spinner';
import type { AppStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';

type RouteType = RouteProp<AppStackParamList, 'EditList'>;

export default function EditListScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteType>();
  const { listId } = route.params;
  const colors = useColors();

  const { data: list, isLoading } = useGetListQuery(listId);
  const [updateList, { isLoading: isSaving }] = useUpdateListMutation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [initialized, setInitialized] = useState(false);

  if (list && !initialized) {
    setTitle(list.title ?? '');
    setDescription(list.body ?? '');
    setCategory(list.category ?? '');
    setIsPrivate(!!list.private);
    setInitialized(true);
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      setImageFile({ uri: asset.uri, name: `cover.${ext}`, type: `image/${ext}` });
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title.');
      return;
    }

    const fd = new FormData();
    fd.append('internal_id', listId);
    fd.append('title', title.trim());
    fd.append('description', description);
    fd.append('category', category);
    fd.append('private', String(isPrivate));
    if (imageFile) {
      fd.append('gallery', uploadFile(imageFile.uri));
    }

    try {
      await updateList(fd as any).unwrap();
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    }
  };

  if (isLoading || !initialized) return <Spinner fullScreen />;

  const existingCoverUri = firstGalleryUrl(list?.gallery);

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Cover image */}
          <TouchableOpacity onPress={pickImage} style={[styles.imagePicker, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            {imageUri ? (
              <>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" />
                <TouchableOpacity
                  style={styles.removeImage}
                  onPress={() => { setImageUri(null); setImageFile(null); }}
                >
                  <X size={16} color="#fff" />
                </TouchableOpacity>
              </>
            ) : existingCoverUri ? (
              <>
                <Image source={{ uri: existingCoverUri }} style={styles.imagePreview} contentFit="cover" />
                <View style={styles.changeOverlay}>
                  <Text style={styles.changeOverlayText}>Change Image</Text>
                </View>
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <ImagePlus size={24} color={colors.grey} />
                <Text style={[styles.imagePlaceholderText, { color: colors.grey }]}>Add cover image</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Title */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.muted }]}>Title *</Text>
            <TextInput
              style={[ss.input, { backgroundColor: colors.card, color: colors.fg, borderColor: colors.border }]}
              value={title}
              onChangeText={setTitle}
              placeholder="List title..."
              placeholderTextColor={colors.grey}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.muted }]}>Description</Text>
            <TextInput
              style={[ss.input, ss.inputMulti, { backgroundColor: colors.card, color: colors.fg, borderColor: colors.border }]}
              value={description}
              onChangeText={setDescription}
              placeholder="What's this list about?"
              placeholderTextColor={colors.grey}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.muted }]}>Category</Text>
            <TextInput
              style={[ss.input, { backgroundColor: colors.card, color: colors.fg, borderColor: colors.border }]}
              value={category}
              onChangeText={setCategory}
              placeholder="e.g. Restoration, Parts, Resources..."
              placeholderTextColor={colors.grey}
            />
          </View>

          {/* Private toggle */}
          <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View>
              <Text style={[styles.toggleLabel, { color: colors.fg }]}>Private</Text>
              <Text style={[styles.toggleSub, { color: colors.grey }]}>Only visible to you</Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ true: colors.primaryAlt }}
            />
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.primaryAlt, opacity: isSaving || !title.trim() ? 0.5 : 1 }]}
            onPress={handleSave}
            disabled={isSaving || !title.trim()}
          >
            <Text style={styles.submitBtnText}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  imagePicker: {
    width: '100%', height: 180, borderRadius: 14,
    borderWidth: 1, overflow: 'hidden', marginBottom: 16,
  },
  imagePreview: { width: '100%', height: '100%' },
  removeImage: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 4,
  },
  changeOverlay: {
    position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  changeOverlayText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  imagePlaceholderText: { fontSize: 14 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 20,
  },
  toggleLabel: { fontSize: 15, fontWeight: '600' },
  toggleSub: { fontSize: 12, marginTop: 2 },
  submitBtn: {
    paddingVertical: 15, borderRadius: 12, alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

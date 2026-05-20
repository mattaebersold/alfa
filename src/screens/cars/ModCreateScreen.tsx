import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { X, Plus } from 'lucide-react-native';
import { useCreateModMutation } from '../../api/apiService';
import Button from '../../components/ui/Button';
import { useColors } from '../../hooks/useColors';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { MOD_TYPES } from '../../constants/carTypes';
import { colors } from '../../constants/colors';
import type { AppScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';

type ImageAsset = { uri: string; name: string; type: string };

function ChipSelect({ items, value, onChange, label }: {
  items: { key: string; label: string }[];
  value: string;
  onChange: (k: string) => void;
  label: string;
}) {
  const c = useColors();
  return (
    <View style={chip.wrapper}>
      <Text style={[chip.label, { color: c.fg }]}>{label}</Text>
      <View style={chip.chips}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[chip.chip, { borderColor: c.border, backgroundColor: c.card }, value === item.key && chip.active]}
            onPress={() => onChange(item.key)}
          >
            <Text style={[chip.text, { color: c.fg }, value === item.key && chip.activeText]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
const chip = StyleSheet.create({
  wrapper:    { marginBottom: 20 },
  label:      { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5 },
  active:     { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt },
  text:       { fontSize: 13, fontWeight: '600' },
  activeText: { color: '#FFFFFF' },
});

export default function ModCreateScreen({ navigation, route }: AppScreenProps<'ModCreate'>) {
  const { carId, carTitle } = route.params;
  const c = useColors();
  const keyboardHeight = useKeyboardHeight();

  const [title, setTitle] = useState('');
  const [type, setType] = useState('general');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<ImageAsset[]>([]);

  const [createMod, { isLoading }] = useCreateModMutation();

  const pickImage = () => {
    Alert.alert('Add Photo', 'How would you like to add a photo?', [
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
            setImages((prev) => [...prev, { uri: a.uri, name: a.fileName ?? `photo_${Date.now()}.jpg`, type: a.mimeType ?? 'image/jpeg' }].slice(0, 10));
          }
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.85,
          });
          if (!result.canceled) {
            const newImages = result.assets.map((a) => ({
              uri: a.uri,
              name: a.fileName ?? `photo_${Date.now()}.jpg`,
              type: a.mimeType ?? 'image/jpeg',
            }));
            setImages((prev) => [...prev, ...newImages].slice(0, 10));
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title for this mod.');
      return;
    }
    const fd = new FormData();
    fd.append('car_id', carId);
    fd.append('title', title.trim());
    fd.append('type', type);
    if (body.trim()) fd.append('body', body.trim());
    images.forEach((img) => {
      fd.append('gallery', { uri: img.uri, name: img.name, type: img.type } as any);
    });

    try {
      await createMod(fd).unwrap();
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to create mod. Please try again.');
    }
  };

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: c.cream }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 + keyboardHeight }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {carTitle ? (
          <Text style={[styles.carLabel, { color: c.grey }]}>{carTitle}</Text>
        ) : null}

        {/* Title */}
        <View style={styles.fieldWrap}>
          <Text style={[styles.fieldLabel, { color: c.fg }]}>Title *</Text>
          <TextInput
            style={[ss.input, { borderColor: c.inputBorder, color: c.fg, backgroundColor: c.card }]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Coilover upgrade"
            placeholderTextColor={c.grey}
            autoCapitalize="sentences"
          />
        </View>

        {/* Type */}
        <ChipSelect items={MOD_TYPES} value={type} onChange={setType} label="Type" />

        {/* Description */}
        <View style={styles.fieldWrap}>
          <Text style={[styles.fieldLabel, { color: c.fg }]}>
            Description <Text style={[styles.optional, { color: c.grey }]}>(optional)</Text>
          </Text>
          <TextInput
            style={[ss.input, ss.inputMulti, { borderColor: c.inputBorder, color: c.fg, backgroundColor: c.card }]}
            value={body}
            onChangeText={setBody}
            placeholder="What did you install, and why?"
            placeholderTextColor={c.grey}
            multiline
            numberOfLines={4}
            autoCapitalize="sentences"
          />
        </View>

        {/* Photos */}
        <View style={styles.fieldWrap}>
          <Text style={[styles.fieldLabel, { color: c.fg }]}>
            Photos <Text style={[styles.optional, { color: c.grey }]}>(optional)</Text>
          </Text>
          <View style={styles.imageGrid}>
            {images.map((img, i) => (
              <View key={i} style={styles.imageThumbWrap}>
                <Image source={{ uri: img.uri }} style={styles.imageThumb} contentFit="cover" />
                <TouchableOpacity
                  style={styles.imageRemove}
                  onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  hitSlop={4}
                >
                  <X size={12} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 10 && (
              <TouchableOpacity
                style={[styles.imageAdd, { backgroundColor: c.card, borderColor: c.border }]}
                onPress={pickImage}
              >
                <Plus size={20} color={c.grey} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Button
          label="Add Mod"
          onPress={handleSubmit}
          loading={isLoading}
          variant="primary"
          size="default"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll:         { padding: 16 },
  carLabel:       { fontSize: 13, fontWeight: '600', marginBottom: 16 },
  fieldWrap:      { marginBottom: 20 },
  fieldLabel:     { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  optional:       { fontWeight: '400', fontSize: 12 },
  imageGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  imageThumbWrap: { position: 'relative' },
  imageThumb:     { width: 80, height: 80, borderRadius: 8 },
  imageRemove:    {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, padding: 3,
  },
  imageAdd:       {
    width: 80, height: 80, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
});

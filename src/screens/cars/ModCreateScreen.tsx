import React, { useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { Text } from '@ors/kit';
import { FormScrollView } from '@ors/kit';
import { Image } from '../../components/ui/AppImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { uploadFile } from '../../utils/upload';
import { X, Plus, Car as CarIcon } from 'lucide-react-native';
import { useCreateModMutation, useGetCarQuery } from '../../api/apiService';
import SharedButton from '../../components/ui/SharedButton';
import FormInput from '../../components/ui/FormInput';
import SubTabs from '../../components/ui/SubTabs';
import { useColors } from '../../hooks/useColors';
import { MOD_TYPES } from '../../constants/carTypes';
import { carHeroUrl } from '../../utils/image';
import type { AppScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';
import PhotoPickerField from '../../components/ui/PhotoPickerField';
import { FONT_INTER } from '../../constants/fonts';
import { COLOR_WHITE, PANE_BG } from '../../constants/config';

type ImageAsset = { uri: string; name: string; type: string };

export default function ModCreateScreen({ navigation, route }: AppScreenProps<'ModCreate'>) {
  const { carId, carTitle } = route.params;
  const c = useColors();
  // For the heading's "for" line: the car's photo, and its name when the
  // caller didn't pass one.
  const { data: car } = useGetCarQuery(carId, { skip: !carId });
  const carPhoto = car ? carHeroUrl(car) : null;
  const carName = carTitle
    || car?.title
    || [car?.year, car?.make, car?.model].filter(Boolean).join(' ');

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
            mediaTypes: ['images'],
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
      fd.append('gallery', uploadFile(img.uri));
    });

    try {
      await createMod(fd).unwrap();
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to create mod. Please try again.');
    }
  };

  return (
    // Its own heading rather than the navigator's bar — which centres its
    // title, paints a band of colour, and has no room for which car this is.
    // The panes' grey, a step up from the app's ground: a form laid over it.
    <SafeAreaView style={[ss.fill, { backgroundColor: PANE_BG }]} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={[styles.heading, { color: c.fg }]}>Add Mod</Text>
          {carName ? (
            <View style={styles.forRow}>
              <Text style={[styles.forWord, { color: c.grey }]}>for</Text>
              {carPhoto ? (
                <Image source={{ uri: carPhoto }} style={styles.carThumb} contentFit="cover" />
              ) : (
                <View style={[styles.carThumb, styles.carThumbBlank, { backgroundColor: c.segment }]}>
                  <CarIcon size={12} color={c.grey} />
                </View>
              )}
              <Text style={[styles.carName, { color: c.fg }]} numberOfLines={1}>{carName}</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={24} color={c.fg} />
        </TouchableOpacity>
      </View>

      {/* The kind of mod, as sub tabs — no label: the options say what they are. */}
      <View style={styles.typeTabs}>
        <SubTabs options={MOD_TYPES} value={type} onChange={setType} inset={GUTTER_FORM} />
      </View>

      <FormScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title — the placeholder is its label. */}
        <View style={styles.fieldWrap}>
          <FormInput
            value={title}
            onChangeText={setTitle}
            placeholder="Example: Coilovers"
            autoCapitalize="sentences"
            accessibilityLabel="Title"
          />
        </View>

        {/* Description — likewise, the placeholder says what it is. */}
        <View style={styles.fieldWrap}>
          <FormInput
            value={body}
            onChangeText={setBody}
            placeholder="Description"
            multiline
            numberOfLines={4}
            autoCapitalize="sentences"
            accessibilityLabel="Description"
          />
        </View>

        {/* Photos */}
        <View style={styles.fieldWrap}>
          {/* Nothing added yet: the full well, the width of the form, the
              camera alone in it. Once there are photos the grid's + tile is
              enough. */}
          {images.length === 0 ? (
            <PhotoPickerField onPress={pickImage} style={styles.photoWell} />
          ) : (
          <View style={styles.imageGrid}>
            {images.map((img, i) => (
              <View key={i} style={styles.imageThumbWrap}>
                <Image source={{ uri: img.uri }} style={styles.imageThumb} contentFit="cover" />
                <TouchableOpacity
                  style={styles.imageRemove}
                  onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  hitSlop={4}
                >
                  <X size={12} color={COLOR_WHITE} />
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
          )}
        </View>

        <SharedButton
          label="Add Mod"
          onPress={handleSubmit}
          loading={isLoading}
          full
        />
      </FormScrollView>
    </SafeAreaView>
  );
}

/** The form's side margin — the heading, the tabs and the fields share it. */
const GUTTER_FORM = 16;

const styles = StyleSheet.create({
  // Left-aligned, on the screen's own ground, the close at its right.
  head: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: GUTTER_FORM, paddingTop: 12, paddingBottom: 10,
  },
  headText:       { flex: 1, minWidth: 0 },
  heading:        { fontSize: 22, fontFamily: FONT_INTER.bold },
  forRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  forWord:        { fontSize: 13, fontFamily: FONT_INTER.medium },
  carThumb:       { width: 20, height: 20, borderRadius: 10 },
  carThumbBlank:  { alignItems: 'center', justifyContent: 'center' },
  carName:        { flexShrink: 1, fontSize: 13, fontFamily: FONT_INTER.semibold },
  typeTabs:       { paddingBottom: 4 },
  scroll:         { padding: GUTTER_FORM },
  fieldWrap:      { marginBottom: 20 },
  // The well across the whole form, not the narrow centred box it is elsewhere.
  photoWell:      { marginTop: 0 },
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

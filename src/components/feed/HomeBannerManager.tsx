import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, Trash2, Check } from 'lucide-react-native';
import {
  useGetSiteSettingsQuery,
  useUpdateHomeBannerMutation,
  useDeleteHomeBannerMutation,
} from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import { toUploadableJpeg, uploadFile } from '../../utils/upload';
import {
  BANNER_DESTINATIONS, bannerDestination,
} from '../../constants/bannerDestinations';
import { ss } from '../../styles/shared';

/** The order destination groups appear in the picker. */
const GROUPS = ['Society', 'Cars', 'Community', 'Content', 'Other'] as const;

function DestinationRow({
  label, selected, onPress, colors,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      style={[styles.destRow, { borderTopColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.destLabel, { color: selected ? colors.primaryAlt : colors.fg }]}>{label}</Text>
      {selected && <Check size={16} color={colors.primaryAlt} />}
    </TouchableOpacity>
  );
}

/**
 * Admin editor for the single home feature banner.
 *
 * Saving a new image is what brings the banner back for members who had closed
 * the previous one — the server mints a new banner id on image upload, and a
 * dismissal only matches the id it was made against. Editing just the link
 * deliberately doesn't: a changed URL isn't new content, and re-showing the
 * banner over it would be a way to nag people who already said no.
 *
 * The two link fields are independent rather than alternatives. One banner is
 * shown in two places that can't follow the same kind of target — the website
 * can't open an app screen, and the app shouldn't kick a member out to a browser
 * for something it can render itself — so each gets its own, and each platform
 * uses what it can act on.
 */
export default function HomeBannerManager() {
  const colors = useColors();
  const { data: settings, isLoading } = useGetSiteSettingsQuery();
  const [saveBanner, { isLoading: saving }] = useUpdateHomeBannerMutation();
  const [removeBanner, { isLoading: removing }] = useDeleteHomeBannerMutation();

  const banner = settings?.home_banner;
  const [url, setUrl] = useState('');
  const [destination, setDestination] = useState<string>('');
  const [destinationId, setDestinationId] = useState('');
  const [pickedUri, setPickedUri] = useState<string | null>(null);

  useEffect(() => { setUrl(banner?.url ?? ''); }, [banner?.url]);
  useEffect(() => {
    // The legacy 'url' sentinel resolves to no destination, which is exactly
    // right: those banners only ever had a web link, and the URL field below is
    // already showing it.
    setDestination(bannerDestination(banner?.destination) ? banner!.destination! : '');
    setDestinationId(banner?.destination_id ?? '');
  }, [banner?.destination, banner?.destination_id]);

  const selected = bannerDestination(destination);
  const preview = pickedUri ?? imageUrl(banner?.image);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      // The string form; `MediaTypeOptions.Images` is deprecated in this SDK and
      // warns at runtime.
      mediaTypes: ['images'],
      allowsEditing: true,
      // Matches the banner's render ratio, so what you crop is what ships.
      aspect: [11, 5],
      quality: 0.9,
    });
    if (result.canceled) return;
    setPickedUri(await toUploadableJpeg(result.assets[0].uri));
  };

  const save = async () => {
    if (!pickedUri && !banner?.image) {
      Alert.alert('Pick an image', 'A feature banner needs an image.');
      return;
    }
    if (selected?.needsId && !destinationId.trim()) {
      Alert.alert(`Add the ${selected.idLabel}`, `"${selected.label}" needs an id to open.`);
      return;
    }

    const fd = new FormData();
    if (pickedUri) fd.append('hero_image', uploadFile(pickedUri));
    // Both are saved independently: the app follows the destination, the website
    // follows the URL. Either can be blank.
    fd.append('destination', destination);
    fd.append('destination_id', selected?.needsId ? destinationId.trim() : '');
    fd.append('url', url.trim());
    fd.append('active', 'true');
    try {
      await saveBanner(fd).unwrap();
      setPickedUri(null);
      Alert.alert(
        'Banner saved',
        pickedUri
          ? 'The new banner will show for every member, including anyone who hid the last one.'
          : 'The banner was updated. Members who already hid it stay opted out until a new image is uploaded.',
      );
    } catch (e: any) {
      Alert.alert('Save failed', e?.data?.error ?? 'Could not save the banner. Please try again.');
    }
  };

  const remove = () => {
    Alert.alert('Remove banner', 'The feature banner will stop showing on the home feed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeBanner().unwrap();
            setPickedUri(null);
            setUrl('');
          } catch {
            Alert.alert('Error', 'Could not remove the banner. Please try again.');
          }
        },
      },
    ]);
  };

  if (isLoading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primaryAlt} />;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.blurb, { color: colors.grey }]}>
        Shown at the top of the home feed, above the quick links. Members can close it;
        uploading a new image brings it back for everyone.
      </Text>

      <TouchableOpacity
        style={[styles.preview, { borderColor: colors.border, backgroundColor: colors.segment }]}
        onPress={pickImage}
        activeOpacity={0.85}
      >
        {preview ? (
          <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={styles.previewEmpty}>
            <ImagePlus size={22} color={colors.grey} />
            <Text style={[styles.previewText, { color: colors.grey }]}>Choose a banner image</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={pickImage} style={styles.changeRow} activeOpacity={0.7}>
        <Text style={[styles.changeText, { color: colors.primaryAlt }]}>
          {preview ? 'Change image' : 'Choose image'}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.label, { color: colors.fg }]}>In the app, opens</Text>
      <Text style={[styles.hint, { color: colors.grey }]}>
        A screen in the mobile app. Leave on "Nothing" to fall back to the web link below.
      </Text>

      <View style={[styles.destBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <DestinationRow
          label="Nothing — use the web link"
          selected={destination === ''}
          onPress={() => setDestination('')}
          colors={colors}
        />
        {GROUPS.map((group) => (
          <View key={group}>
            <Text style={[styles.destGroup, { color: colors.grey, backgroundColor: colors.segment }]}>{group}</Text>
            {BANNER_DESTINATIONS.filter((d) => d.group === group).map((d) => (
              <DestinationRow
                key={d.key}
                label={d.label}
                selected={destination === d.key}
                onPress={() => setDestination(d.key)}
                colors={colors}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Only the destinations that point at one specific record ask for an id. */}
      {selected?.needsId && (
        <>
          <Text style={[styles.label, { color: colors.fg }]}>{selected.idLabel}</Text>
          <TextInput
            style={[ss.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card }]}
            value={destinationId}
            onChangeText={setDestinationId}
            placeholder="Paste the id from its URL"
            placeholderTextColor={colors.grey}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </>
      )}

      {/* Independent of the destination above, not an alternative to it: the
          website has no way to open an app screen, so it needs its own target. */}
      <Text style={[styles.label, { color: colors.fg }]}>On the website, opens</Text>
      <Text style={[styles.hint, { color: colors.grey }]}>
        Used by openroadsociety.co, and by the app when no screen is set above.
      </Text>
      <TextInput
        style={[ss.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card }]}
        value={url}
        onChangeText={setUrl}
        placeholder="https://openroadsociety.co/rallys"
        placeholderTextColor={colors.grey}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: colors.primaryAlt }, (saving || removing) && styles.btnOff]}
        onPress={save}
        disabled={saving || removing}
        activeOpacity={0.85}
      >
        <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Banner'}</Text>
      </TouchableOpacity>

      {banner?.image && (
        <TouchableOpacity
          style={[styles.removeBtn, { borderColor: colors.red + '40', backgroundColor: colors.red + '10' }]}
          onPress={remove}
          disabled={saving || removing}
          activeOpacity={0.8}
        >
          <Trash2 size={15} color={colors.red} />
          <Text style={[styles.removeText, { color: colors.red }]}>Remove Banner</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content:      { padding: 16, paddingBottom: 60, gap: 12 },
  blurb:        { fontSize: 13, lineHeight: 18 },
  preview:      { width: '100%', aspectRatio: 2.2, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  previewEmpty: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewText:  { fontSize: 13, fontWeight: '600' },
  changeRow:    { alignSelf: 'flex-start' },
  changeText:   { fontSize: 14, fontWeight: '700' },
  label:        { fontSize: 13, fontWeight: '700', marginTop: 4 },
  hint:         { fontSize: 12, lineHeight: 16, marginTop: -6 },
  destBox:      { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  destGroup:    {
    fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  destRow:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  destLabel:    { fontSize: 14, fontWeight: '600' },
  saveBtn:      { paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 6 },
  saveText:     { color: '#000000', fontSize: 15, fontWeight: '800' },
  btnOff:       { opacity: 0.5 },
  removeBtn:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  removeText:   { fontSize: 14, fontWeight: '700' },
});

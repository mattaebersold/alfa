import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Dimensions, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { MapPin, Clock, Check, X } from 'lucide-react-native';
import { useGetRallyQuery, useAttendRallyMutation, useDeclineRallyMutation } from '../../api/apiService';
import Spinner from '../../components/ui/Spinner';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { SocietyScreenProps } from '../../navigation/types';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function RallyDetailScreen({ route }: SocietyScreenProps<'RallyDetail'>) {
  const { rallyId } = route.params;
  const colors = useColors();
  const { data: rally, isLoading } = useGetRallyQuery(rallyId);
  const [attend, { isLoading: attending }] = useAttendRallyMutation();
  const [decline, { isLoading: declining }] = useDeclineRallyMutation();

  const handleOpenMaps = useCallback(() => {
    if (!rally) return;
    if (rally.location_lat && rally.location_lng) {
      Linking.openURL(`https://maps.apple.com/?ll=${rally.location_lat},${rally.location_lng}&q=${encodeURIComponent(rally.location ?? '')}`);
    } else if (rally.location) {
      Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(rally.location)}`);
    }
  }, [rally]);

  if (isLoading || !rally) return <Spinner fullScreen />;

  const gallery = rally.gallery ?? [];
  const hero = rally.hero_image ? imageUrl(rally.hero_image) : firstGalleryUrl(gallery);
  const date = rally.event_date ? format(new Date(rally.event_date), 'EEEE, MMMM d, yyyy') : null;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hero */}
        {hero
          ? <Image source={{ uri: hero }} style={styles.hero} contentFit="cover" />
          : <View style={styles.heroPlaceholder} />
        }

        {/* Gallery strip */}
        {gallery.length > 1 && (
          <FlatList
            data={gallery}
            keyExtractor={(g) => g.filename}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryStrip}
            renderItem={({ item }) => (
              <Image source={{ uri: imageUrl(item.filename) ?? undefined }} style={styles.galleryThumb} contentFit="cover" />
            )}
          />
        )}

        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.fg }]}>{rally.title}</Text>

          {date && (
            <View style={styles.metaRow}>
              <Clock size={15} color={colors.grey} />
              <Text style={[styles.metaText, { color: colors.grey }]}>{date}{rally.event_time ? ` · ${rally.event_time}` : ''}</Text>
            </View>
          )}

          {rally.location ? (
            <TouchableOpacity style={styles.metaRow} onPress={handleOpenMaps}>
              <MapPin size={15} color={colors.primaryAlt} />
              <Text style={[styles.metaText, styles.metaLink]}>{rally.location}</Text>
            </TouchableOpacity>
          ) : null}

          {rally.slots_available != null && (
            <Text style={styles.slots}>{rally.slots_available} slots available</Text>
          )}

          {/* RSVP */}
          <View style={styles.rsvpRow}>
            <TouchableOpacity
              style={[styles.rsvpBtn, styles.rsvpAttend]}
              onPress={() => attend({ rally_id: rallyId })}
              disabled={attending}
            >
              <Check size={16} color="#FFFFFF" />
              <Text style={styles.rsvpText}>Attend</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rsvpBtn, { backgroundColor: colors.segment, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => decline({ rally_id: rallyId })}
              disabled={declining}
            >
              <X size={16} color={colors.fg} />
              <Text style={[styles.rsvpText, { color: colors.fg }]}>Decline</Text>
            </TouchableOpacity>
          </View>

          {rally.body ? (
            <Text style={[styles.description, { color: colors.fg }]}>{stripHtml(rally.body)}</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll:          { paddingBottom: 32 },
  hero:            { width: '100%', aspectRatio: 16 / 9 },
  heroPlaceholder: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.primaryAlt },
  galleryStrip:    { padding: 8, gap: 6 },
  galleryThumb:    { width: 80, height: 60, borderRadius: 6 },
  body:            { padding: 16 },
  title:           { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  metaRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  metaText:        { fontSize: 14 },
  metaLink:        { color: colors.primaryAlt, fontWeight: '600' },
  slots:           { fontSize: 13, fontWeight: '700', color: colors.primaryAlt, marginBottom: 12 },
  rsvpRow:         { flexDirection: 'row', gap: 10, marginBottom: 20 },
  rsvpBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10 },
  rsvpAttend:      { backgroundColor: colors.primaryAlt },
  rsvpText:        { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  description:     { fontSize: 15, lineHeight: 22 },
});

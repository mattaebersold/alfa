import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, Linking, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { format } from 'date-fns';
import { MapPin, Clock, Check, X } from 'lucide-react-native';
import SharedModal from '../ui/SharedModal';
import {
  useGetRallyQuery,
  useAttendRallyMutation,
  useDeclineRallyMutation,
} from '../../api/apiService';
import Spinner from '../ui/Spinner';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  rallyId: string | null;
  onClose: () => void;
}

/** Shared rally-detail modal — used from the Society feed and the Rallys list. */
export default function RallyDetailSheet({ rallyId, onClose }: Props) {
  const colors = useColors();
  const { data: rally, isLoading } = useGetRallyQuery(rallyId!, { skip: !rallyId });
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

  const gallery = rally?.gallery ?? [];
  const hero = rally?.hero_image ? imageUrl(rally.hero_image) : firstGalleryUrl(gallery);
  const date = rally?.event_date ? format(new Date(rally.event_date), 'EEEE, MMMM d, yyyy') : null;

  return (
    <SharedModal
      visible={!!rallyId}
      onClose={onClose}
      title={rally?.title ?? 'Rally'}
    >
      {isLoading || !rally ? (
          <Spinner />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {hero
              ? <Image source={{ uri: hero }} style={styles.hero} contentFit="cover" />
              : <View style={[styles.hero, { backgroundColor: colors.primaryAlt }]} />
            }

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
                  <Text style={[styles.metaText, { color: colors.primaryAlt, fontWeight: '600' }]}>{rally.location}</Text>
                </TouchableOpacity>
              ) : null}

              {rally.slots_available != null && (
                <Text style={[styles.slots, { color: colors.primaryAlt }]}>{rally.slots_available} slots available</Text>
              )}

              <View style={styles.rsvpRow}>
                <TouchableOpacity
                  style={[styles.rsvpBtn, { backgroundColor: colors.primaryAlt }]}
                  onPress={() => attend({ rally_id: rally.internal_id })}
                  disabled={attending}
                >
                  <Check size={16} color="#000000" />
                  <Text style={[styles.rsvpText, { color: '#000000' }]}>Attend</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rsvpBtn, { backgroundColor: colors.segment, borderWidth: 1, borderColor: colors.border }]}
                  onPress={() => decline({ rally_id: rally.internal_id })}
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
        )}
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  scroll:  { paddingBottom: 40 },
  hero:    { width: '100%', aspectRatio: 16 / 9 },
  galleryStrip: { padding: 8, gap: 6 },
  galleryThumb: { width: 80, height: 60, borderRadius: 6 },
  body:    { padding: 16 },
  title:   { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  metaText:{ fontSize: 14 },
  slots:   { fontSize: 13, fontWeight: '700', marginBottom: 12 },
  rsvpRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  rsvpBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10 },
  rsvpText:{ fontSize: 15, fontWeight: '700' },
  description: { fontSize: 15, lineHeight: 22 },
});

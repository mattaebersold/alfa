import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, Linking, Dimensions, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { MapPin, Clock, Check, X } from 'lucide-react-native';
import {
  useGetEventQuery,
  useAttendEventMutation,
  useDeclineEventMutation,
} from '../../api/apiService';
import Spinner from '../ui/Spinner';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  eventId: string | null;
  onClose: () => void;
}

/**
 * Shared event-detail modal — used from the Society feed (featured + upcoming)
 * and the calendar, instead of pushing a sub-screen.
 */
export default function EventDetailSheet({ eventId, onClose }: Props) {
  const colors = useColors();
  const [galleryIndex, setGalleryIndex] = useState(0);

  const { data: event, isLoading } = useGetEventQuery(eventId!, { skip: !eventId });
  const [attendEvent, { isLoading: attending }] = useAttendEventMutation();
  const [declineEvent, { isLoading: declining }] = useDeclineEventMutation();

  const handleOpenMaps = useCallback(() => {
    if (!event) return;
    if (event.location_lat && event.location_lng) {
      Linking.openURL(`https://maps.apple.com/?ll=${event.location_lat},${event.location_lng}&q=${encodeURIComponent(event.location ?? '')}`);
    } else if (event.location) {
      Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(event.location)}`);
    }
  }, [event]);

  const gallery = event?.gallery ?? [];
  const date = event?.event_date ? format(new Date(event.event_date), 'EEEE, MMMM d, yyyy') : null;

  return (
    <Modal
      visible={!!eventId}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.fill, { backgroundColor: colors.cream }]} edges={['top', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.headerTitle, { color: colors.fg }]} numberOfLines={1}>
            {event?.title ?? 'Event'}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <X size={22} color={colors.fg} />
          </TouchableOpacity>
        </View>

        {isLoading || !event ? (
          <Spinner fullScreen />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Gallery */}
            {gallery.length > 0 ? (
              <View>
                <FlatList
                  data={gallery}
                  keyExtractor={(g) => g.filename}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => setGalleryIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
                  renderItem={({ item }) => (
                    <Image
                      source={{ uri: imageUrl(item.filename) ?? undefined }}
                      style={{ width: SCREEN_WIDTH, aspectRatio: 16 / 9 }}
                      contentFit="cover"
                    />
                  )}
                />
                {gallery.length > 1 && (
                  <View style={styles.dotRow}>
                    {gallery.map((_, i) => (
                      <View key={i} style={[styles.dot, { backgroundColor: colors.greyLight }, i === galleryIndex && { backgroundColor: colors.primaryAlt }]} />
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={[{ width: SCREEN_WIDTH, aspectRatio: 16 / 9 }, { backgroundColor: colors.primaryAlt }]} />
            )}

            {/* Title + meta */}
            <View style={[styles.infoBlock, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.fg }]}>{event.title}</Text>

              {date && (
                <View style={styles.metaRow}>
                  <Clock size={15} color={colors.grey} />
                  <Text style={[styles.metaText, { color: colors.grey }]}>
                    {date}{event.event_time ? ` · ${event.event_time}` : ''}
                  </Text>
                </View>
              )}

              {event.location ? (
                <TouchableOpacity style={styles.metaRow} onPress={handleOpenMaps}>
                  <MapPin size={15} color={colors.primaryAlt} />
                  <Text style={[styles.metaText, { color: colors.primaryAlt, fontWeight: '600' }]}>{event.location}</Text>
                </TouchableOpacity>
              ) : null}

              {/* RSVP */}
              <View style={styles.rsvpRow}>
                <TouchableOpacity
                  style={[styles.rsvpBtn, { backgroundColor: colors.primaryAlt }]}
                  onPress={() => attendEvent({ event_id: event.internal_id })}
                  disabled={attending}
                >
                  <Check size={16} color="#000000" />
                  <Text style={[styles.rsvpBtnText, { color: '#000000' }]}>Attend</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rsvpBtn, { backgroundColor: colors.segment, borderWidth: 1, borderColor: colors.border }]}
                  onPress={() => declineEvent({ event_id: event.internal_id })}
                  disabled={declining}
                >
                  <X size={16} color={colors.fg} />
                  <Text style={[styles.rsvpBtnText, { color: colors.fg }]}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Description */}
            <View style={[styles.bodyBlock, { backgroundColor: colors.card }]}>
              {event.body ? (
                <Text style={[styles.body, { color: colors.fg }]}>{stripHtml(event.body)}</Text>
              ) : (
                <Text style={[styles.muted, { color: colors.grey }]}>No description provided.</Text>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill:   { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  scroll:  { paddingBottom: 40 },
  dotRow:  { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 8 },
  dot:     { width: 6, height: 6, borderRadius: 3 },
  infoBlock: { padding: 16, borderBottomWidth: 1 },
  title:   { fontSize: 22, fontWeight: '800', marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  metaText:{ fontSize: 14 },
  rsvpRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  rsvpBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10 },
  rsvpBtnText: { fontSize: 15, fontWeight: '700' },
  bodyBlock: { padding: 16 },
  body:    { fontSize: 15, lineHeight: 22 },
  muted:   { fontSize: 15, fontStyle: 'italic' },
});

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, Linking, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { MapPin, Clock, Check, X } from 'lucide-react-native';
import {
  useGetEventQuery,
  useAttendEventMutation,
  useDeclineEventMutation,
  useGetPostsQuery,
} from '../../api/apiService';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FeedItemCard from '../../components/cards/FeedItemCard';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { SocietyScreenProps, AppStackParamList } from '../../navigation/types';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
type Tab = 'info' | 'posts';

export default function EventDetailScreen({ route }: SocietyScreenProps<'EventDetail'>) {
  const { eventId } = route.params;
  const appNav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const colors = useColors();
  const [tab, setTab] = useState<Tab>('info');
  const [galleryIndex, setGalleryIndex] = useState(0);

  const { data: event, isLoading } = useGetEventQuery(eventId);
  const [attendEvent, { isLoading: attending }] = useAttendEventMutation();
  const [declineEvent, { isLoading: declining }] = useDeclineEventMutation();
  const { data: postsData } = useGetPostsQuery(
    { event_id: eventId, limit: 20 },
    { skip: tab !== 'posts' }
  );

  const handleOpenMaps = useCallback(() => {
    if (!event) return;
    if (event.location_lat && event.location_lng) {
      const url = `https://maps.apple.com/?ll=${event.location_lat},${event.location_lng}&q=${encodeURIComponent(event.location ?? '')}`;
      Linking.openURL(url);
    } else if (event.location) {
      const url = `https://maps.apple.com/?q=${encodeURIComponent(event.location)}`;
      Linking.openURL(url);
    }
  }, [event]);

  if (isLoading || !event) return <Spinner fullScreen />;

  const gallery = event.gallery ?? [];
  const date = event.event_date ? format(new Date(event.event_date), 'EEEE, MMMM d, yyyy') : null;
  const posts = postsData?.entries ?? [];

  const header = (
    <View>
      {/* Gallery */}
      {gallery.length > 0 ? (
        <View>
          <FlatList
            data={gallery}
            keyExtractor={(g) => g.filename}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              setGalleryIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
            }}
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
                <View key={i} style={[styles.dot, i === galleryIndex && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={[{ width: SCREEN_WIDTH, aspectRatio: 16 / 9 }, styles.imagePlaceholder]} />
      )}

      {/* Title + meta */}
      <View style={[styles.infoBlock, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.fg }]}>{event.title}</Text>

        {date && (
          <View style={styles.metaRow}>
            <Clock size={15} color={colors.grey} />
            <Text style={[styles.metaText, { color: colors.grey }]}>{date}{event.event_time ? ` · ${event.event_time}` : ''}</Text>
          </View>
        )}

        {event.location ? (
          <TouchableOpacity style={styles.metaRow} onPress={handleOpenMaps}>
            <MapPin size={15} color={colors.primaryAlt} />
            <Text style={[styles.metaText, styles.metaLink]}>{event.location}</Text>
          </TouchableOpacity>
        ) : null}

        {/* RSVP buttons */}
        <View style={styles.rsvpRow}>
          <TouchableOpacity
            style={[styles.rsvpBtn, styles.rsvpAttend]}
            onPress={() => attendEvent({ event_id: eventId })}
            disabled={attending}
          >
            <Check size={16} color="#FFFFFF" />
            <Text style={styles.rsvpBtnText}>Attend</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rsvpBtn, { backgroundColor: colors.segment, borderWidth: 1, borderColor: colors.border }]}
            onPress={() => declineEvent({ event_id: eventId })}
            disabled={declining}
          >
            <X size={16} color={colors.fg} />
            <Text style={[styles.rsvpBtnText, { color: colors.fg }]}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={[ss.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(['info', 'posts'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[ss.tabItem, tab === t && styles.tabItemActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[ss.tabText, { color: colors.grey }, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Info tab content */}
      {tab === 'info' && (
        <View style={[styles.bodyBlock, { backgroundColor: colors.card }]}>
          {event.body ? (
            <Text style={[styles.body, { color: colors.fg }]}>{stripHtml(event.body)}</Text>
          ) : (
            <Text style={[styles.muted, { color: colors.grey }]}>No description provided.</Text>
          )}
        </View>
      )}
    </View>
  );

  if (tab === 'posts') {
    return (
      <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
        <FlatList
          data={posts}
          keyExtractor={(p) => p.internal_id}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <FeedItemCard
              post={item}
              onPress={() => appNav.navigate('PostDetailModal', { postId: item.internal_id })}
            />
          )}
          ListEmptyComponent={<EmptyState title="No posts yet" />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {header}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list:            { paddingBottom: 32 },
  imagePlaceholder:{ backgroundColor: colors.primaryAlt },
  dotRow:          { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 8 },
  dot:             { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.greyLight },
  dotActive:       { backgroundColor: colors.primaryAlt },
  infoBlock:       { padding: 16, borderBottomWidth: 1 },
  title:           { fontSize: 22, fontWeight: '800', marginBottom: 10 },
  metaRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  metaText:        { fontSize: 14 },
  metaLink:        { color: colors.primaryAlt, fontWeight: '600' },
  rsvpRow:         { flexDirection: 'row', gap: 10, marginTop: 14 },
  rsvpBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10 },
  rsvpAttend:      { backgroundColor: colors.primaryAlt },
  rsvpBtnText:     { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  tabItemActive:   { borderBottomColor: colors.primaryAlt },
  tabTextActive:   { color: colors.primaryAlt },
  bodyBlock:       { padding: 16 },
  body:            { fontSize: 15, lineHeight: 22 },
  muted:           { fontSize: 15, fontStyle: 'italic' },
});

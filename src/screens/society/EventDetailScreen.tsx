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
import { Colors } from '../../constants/colors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { SocietyScreenProps, AppStackParamList } from '../../navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
type Tab = 'info' | 'posts';

export default function EventDetailScreen({ route }: SocietyScreenProps<'EventDetail'>) {
  const { eventId } = route.params;
  const appNav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
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
                source={{ uri: imageUrl(item.filename) }}
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
      <View style={styles.infoBlock}>
        <Text style={styles.title}>{event.title}</Text>

        {date && (
          <View style={styles.metaRow}>
            <Clock size={15} color={Colors.grey} />
            <Text style={styles.metaText}>{date}{event.event_time ? ` · ${event.event_time}` : ''}</Text>
          </View>
        )}

        {event.location ? (
          <TouchableOpacity style={styles.metaRow} onPress={handleOpenMaps}>
            <MapPin size={15} color={Colors.brg} />
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
            style={[styles.rsvpBtn, styles.rsvpDecline]}
            onPress={() => declineEvent({ event_id: eventId })}
            disabled={declining}
          >
            <X size={16} color={Colors.fg} />
            <Text style={[styles.rsvpBtnText, { color: Colors.fg }]}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(['info', 'posts'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabItem, tab === t && styles.tabItemActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Info tab content */}
      {tab === 'info' && (
        <View style={styles.bodyBlock}>
          {event.body ? (
            <Text style={styles.body}>{event.body.replace(/<[^>]*>/g, '')}</Text>
          ) : (
            <Text style={styles.muted}>No description provided.</Text>
          )}
        </View>
      )}
    </View>
  );

  if (tab === 'posts') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
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
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {header}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: Colors.cream },
  list:            { paddingBottom: 32 },
  imagePlaceholder:{ backgroundColor: Colors.brg },
  dotRow:          { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 8 },
  dot:             { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.greyLight },
  dotActive:       { backgroundColor: Colors.brg },
  infoBlock:       { backgroundColor: '#FFFFFF', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:           { fontSize: 22, fontWeight: '800', color: Colors.fg, marginBottom: 10 },
  metaRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  metaText:        { fontSize: 14, color: Colors.grey },
  metaLink:        { color: Colors.brg, fontWeight: '600' },
  rsvpRow:         { flexDirection: 'row', gap: 10, marginTop: 14 },
  rsvpBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10 },
  rsvpAttend:      { backgroundColor: Colors.brg },
  rsvpDecline:     { backgroundColor: Colors.segment, borderWidth: 1, borderColor: Colors.border },
  rsvpBtnText:     { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  tabBar:          { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabItem:         { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive:   { borderBottomColor: Colors.brg },
  tabText:         { fontSize: 14, fontWeight: '600', color: Colors.grey },
  tabTextActive:   { color: Colors.brg },
  bodyBlock:       { padding: 16, backgroundColor: '#FFFFFF' },
  body:            { fontSize: 15, color: Colors.fg, lineHeight: 22 },
  muted:           { fontSize: 15, color: Colors.grey, fontStyle: 'italic' },
});

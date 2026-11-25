import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useIsFocused, useRoute, type RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon } from 'react-native-svg';
import { Heart, MessageCircle } from 'lucide-react-native';
import { format } from 'date-fns';
import { Text } from '../../theme/Text';
import { Image } from '../../components/ui/AppImage';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import EmptyState from '../../components/ui/EmptyState';
import HomeMessageViewer, { messageFrom } from '../../components/homeMessages/HomeMessageViewer';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import { useBrandColor, useBrandTextColor } from '../../hooks/useBrandColor';
import { useGetHomeMessagesQuery } from '../../api/apiService';
import { imageUrl } from '../../utils/image';
import { formatActionCount } from '../../utils/text';
import { APP_BG, COLOR_BLACK, COLOR_WHITE, COMMON_RADIUS, GUTTER } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import type { AppStackParamList } from '../../navigation/types';
import type { HomeMessage } from '../../types/api';

/**
 * Every video message from ORS, newest first — the menu's Messages. The
 * banner over the home feed only ever shows the newest one, and only until
 * it's dismissed; this is where they all stay. A tap plays one full screen.
 *
 * Opened with a `messageId` (a like or comment notification), that message
 * plays as soon as the list has it.
 */
export default function HomeMessagesScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'HomeMessages'>>();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  const { data, isLoading, isError, isFetching, refetch } = useGetHomeMessagesQuery();
  const [watching, setWatching] = useState<HomeMessage | null>(null);

  // Straight to the one a notification pointed at, once — and only while this
  // screen is the one showing. A screen further down the stack (a restored
  // launch, something opened over it) must never start a video by itself.
  const focused = useIsFocused();
  const opened = useRef(false);
  const target = route.params?.messageId;
  useEffect(() => {
    if (opened.current || !target || !data || !focused) return;
    const m = data.entries.find((e) => e.internal_id === target);
    if (m) { opened.current = true; setWatching(m); }
  }, [data, target, focused]);
  // Covered by another screen: the video stops with it.
  useEffect(() => {
    if (!focused) setWatching(null);
  }, [focused]);

  const entries = data?.entries ?? [];

  return (
    <View style={styles.root}>
      <AppHeader />
      <FlatList
        data={entries}
        keyExtractor={(m) => m.internal_id}
        renderItem={({ item }) => <MessageCard message={item} onPress={() => setWatching(item)} />}
        contentContainerStyle={[styles.list, { paddingTop: headerPad + 8 }]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={<Text style={styles.heading}>Messages</Text>}
        ListEmptyComponent={
          isLoading ? <ActivityIndicator color={COLOR_WHITE} style={styles.loading} />
            : <EmptyState
                title={isError ? "Couldn't load messages" : 'No messages yet'}
                message={isError ? undefined : 'Video messages from ORS land here.'}
                actionLabel={isError ? 'Try again' : undefined}
                onAction={isError ? refetch : undefined}
              />
        }
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={COLOR_WHITE} progressViewOffset={headerPad} />}
      />
      <HomeMessageViewer message={watching} onClose={() => setWatching(null)} />
    </View>
  );
}

/** One message: its image behind, darkened, the play button, the words and the counts. */
function MessageCard({ message, onPress }: { message: HomeMessage; onPress: () => void }) {
  const brand = useBrandColor();
  const brandText = useBrandTextColor();
  const bg = imageUrl(message.image, 'medium');
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${message.title}. Play video`}
    >
      {bg ? <Image source={{ uri: bg }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
      <LinearGradient
        colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.9)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.play, { backgroundColor: brand }]}>
        <Svg width={20} height={20} viewBox="0 0 22 22" style={styles.playGlyph}>
          <Polygon points="6,3 19,11 6,19" fill={brandText} />
        </Svg>
      </View>
      <View style={styles.words}>
        <Text style={[styles.from, { color: brand }]} numberOfLines={1}>
          {messageFrom(message).toUpperCase()}  ·  {format(new Date(message.ready_at ?? message.created_at), 'MMM d, yyyy').toUpperCase()}
        </Text>
        <Text style={styles.title} numberOfLines={2}>{message.title}</Text>
        {message.description ? <Text style={styles.description} numberOfLines={2}>{message.description}</Text> : null}
        <View style={styles.counts}>
          <Heart size={13} color={message.has_liked ? brand : COLOR_WHITE} fill={message.has_liked ? brand : 'transparent'} />
          <Text style={styles.count}>{formatActionCount(message.like_count)}</Text>
          <MessageCircle size={13} color={COLOR_WHITE} style={styles.countGap} />
          <Text style={styles.count}>{formatActionCount(message.comment_count)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: APP_BG },
  list: { paddingHorizontal: GUTTER, paddingBottom: 60, gap: 12 },
  heading: { color: COLOR_WHITE, fontSize: 24, fontFamily: FONT_INTER.extrabold, marginBottom: 4, marginLeft: 4 },
  loading: { marginTop: 40 },
  card: {
    height: 210, borderRadius: COMMON_RADIUS, overflow: 'hidden',
    backgroundColor: COLOR_BLACK, justifyContent: 'flex-end',
  },
  pressed: { opacity: 0.9 },
  play: {
    position: 'absolute', top: 14, right: 14,
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
  },
  playGlyph: { marginLeft: 3 },
  words: { padding: 14, gap: 3 },
  from: { fontSize: 10.5, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.6 },
  title: { color: COLOR_WHITE, fontSize: 18, lineHeight: 23, fontFamily: FONT_INTER.bold },
  description: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 18 },
  counts: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  countGap: { marginLeft: 8 },
  count: { color: COLOR_WHITE, fontSize: 12, fontFamily: FONT_INTER.semibold },
});

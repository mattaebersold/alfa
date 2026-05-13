import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGetPodcastQuery } from '../../api/apiService';
import Spinner from '../../components/ui/Spinner';
import { useColors } from '../../hooks/useColors';
import { Colors } from '../../constants/colors';
import { imageUrl } from '../../utils/image';
import PodcastPlayer from '../../components/podcasts/PodcastPlayer';
import type { AppScreenProps } from '../../navigation/types';
import type { PodcastEpisode } from '../../types/api';
import { stripHtml } from '../../utils/text';

type Props = AppScreenProps<'PodcastDetail'>;

const formatDuration = (secs?: number): string => {
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

function EpisodeRow({
  episode, isActive, onPlay, colors,
}: {
  episode: PodcastEpisode;
  isActive: boolean;
  onPlay: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.episodeRow,
        { backgroundColor: isActive ? `${colors.fg}10` : colors.card },
        isActive && { borderColor: `${colors.fg}30`, borderWidth: 1 },
      ]}
      onPress={onPlay}
      activeOpacity={0.75}
    >
      <View style={[styles.playCircle, { backgroundColor: isActive ? colors.fg : colors.border }]}>
        {isActive ? (
          <View style={styles.pauseIcon}>
            <View style={[styles.pauseBar, { backgroundColor: colors.card }]} />
            <View style={[styles.pauseBar, { backgroundColor: colors.card }]} />
          </View>
        ) : (
          <View style={[styles.playTriangle, { borderLeftColor: colors.grey }]} />
        )}
      </View>

      <View style={styles.episodeInfo}>
        <View style={styles.episodeTitleRow}>
          {episode.episode_number != null && (
            <Text style={[styles.epNum, { color: colors.grey }]}>Ep {episode.episode_number} · </Text>
          )}
          <Text style={[styles.epTitle, { color: colors.fg }]} numberOfLines={2}>{episode.title}</Text>
        </View>
        {episode.description && (
          <Text style={[styles.epDesc, { color: colors.muted }]} numberOfLines={2}>
            {stripHtml(episode.description)}
          </Text>
        )}
      </View>

      {episode.audio_duration != null && (
        <Text style={[styles.epDuration, { color: colors.grey }]}>{formatDuration(episode.audio_duration)}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function PodcastDetailScreen({ route }: Props) {
  const { podcastId } = route.params;
  const colors = useColors();
  const { data, isLoading } = useGetPodcastQuery(podcastId);
  const [activeEpisode, setActiveEpisode] = useState<PodcastEpisode | null>(null);

  if (isLoading || !data) return <Spinner fullScreen />;

  const { podcast, episodes = [] } = data;
  const artwork = podcast.artwork_filename ? imageUrl(podcast.artwork_filename) : null;

  const ListHeader = (
    <View>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <View style={[styles.artworkContainer, { backgroundColor: colors.border }]}>
          {artwork ? (
            <Image source={{ uri: artwork }} style={styles.artwork} contentFit="cover" />
          ) : (
            <View style={styles.artworkPlaceholder}>
              <Text style={{ fontSize: 36 }}>🎙️</Text>
            </View>
          )}
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.podcastTitle, { color: colors.fg }]}>{podcast.title}</Text>
          {podcast.author && (
            <Text style={[styles.podcastAuthor, { color: colors.grey }]}>{podcast.author}</Text>
          )}
          {podcast.categories?.length ? (
            <Text style={[styles.podcastCategories, { color: colors.muted }]}>{podcast.categories.join(' · ')}</Text>
          ) : null}
        </View>
      </View>

      {podcast.short_description && (
        <Text style={[styles.description, { color: colors.muted, backgroundColor: colors.card }]}>
          {stripHtml(podcast.short_description)}
        </Text>
      )}

      <Text style={[styles.sectionLabel, { color: colors.grey }]}>
        EPISODES {episodes.length > 0 ? `(${episodes.length})` : ''}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <FlatList
        data={episodes}
        keyExtractor={(ep) => ep.internal_id}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => (
          <EpisodeRow
            episode={item}
            isActive={activeEpisode?.internal_id === item.internal_id}
            onPlay={() => setActiveEpisode(item)}
            colors={colors}
          />
        )}
        ListEmptyComponent={
          <Text style={[styles.noEpisodes, { color: colors.grey }]}>No episodes yet.</Text>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, activeEpisode && styles.listWithPlayer]}
      />

      {activeEpisode && (
        <PodcastPlayer
          episode={activeEpisode}
          podcast={podcast}
          onClose={() => setActiveEpisode(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:               { flex: 1 },
  list:               { paddingBottom: 24 },
  listWithPlayer:     { paddingBottom: 100 },

  header:             { flexDirection: 'row', padding: 16, gap: 14, alignItems: 'flex-start' },
  artworkContainer:   { width: 100, height: 100, borderRadius: 10, overflow: 'hidden', flexShrink: 0 },
  artwork:            { width: '100%', height: '100%' },
  artworkPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerInfo:         { flex: 1, gap: 4 },
  podcastTitle:       { fontSize: 17, fontWeight: '800', lineHeight: 22 },
  podcastAuthor:      { fontSize: 13 },
  podcastCategories:  { fontSize: 12 },

  description:        { fontSize: 13, lineHeight: 20, paddingHorizontal: 16, paddingVertical: 12 },

  sectionLabel:       {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.8,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },

  episodeRow:         {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginHorizontal: 12, marginBottom: 8, borderRadius: 10, padding: 12,
  },
  playCircle:         {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  pauseIcon:          { flexDirection: 'row', gap: 3 },
  pauseBar:           { width: 3, height: 12, borderRadius: 2 },
  playTriangle:       {
    width: 0, height: 0,
    borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 10,
    borderTopColor: 'transparent', borderBottomColor: 'transparent',
    marginLeft: 2,
  },
  episodeInfo:        { flex: 1 },
  episodeTitleRow:    { flexDirection: 'row', flexWrap: 'wrap' },
  epNum:              { fontSize: 12 },
  epTitle:            { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  epDesc:             { fontSize: 12, lineHeight: 17, marginTop: 3 },
  epDuration:         { fontSize: 11, flexShrink: 0, marginTop: 2 },

  noEpisodes:         { textAlign: 'center', padding: 24, fontSize: 14 },
});

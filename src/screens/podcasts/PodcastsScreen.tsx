import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetPodcastsQuery } from '../../api/apiService';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import ScreenHeading from '../../components/ui/ScreenHeading';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import type { AppStackParamList } from '../../navigation/types';
import type { Podcast } from '../../types/api';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

function PodcastCard({ podcast, onPress }: { podcast: Podcast; onPress: () => void }) {
  const colors = useColors();
  const artwork = podcast.artwork_filename ? imageUrl(podcast.artwork_filename) : null;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.artwork, { backgroundColor: colors.border }]}>
        {artwork ? (
          <Image source={{ uri: artwork }} style={styles.artworkImg} contentFit="cover" />
        ) : (
          <View style={styles.artworkPlaceholder}>
            <Text style={styles.artworkIcon}>🎙️</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{podcast.title}</Text>
        {podcast.author && (
          <Text style={[styles.author, { color: colors.grey }]} numberOfLines={1}>{podcast.author}</Text>
        )}
        {podcast.short_description && (
          <Text style={[styles.description, { color: colors.muted }]} numberOfLines={2}>
            {stripHtml(podcast.short_description)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function PodcastsScreen() {
  const colors = useColors();
  const appNav = useNavigation<AppNav>();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  const { data: podcasts = [], isLoading } = useGetPodcastsQuery();

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.cream }}
        data={podcasts}
        keyExtractor={(p) => p.internal_id}
        numColumns={2}
        // Heading rides in the list so it scrolls away with the content.
        ListHeaderComponent={<ScreenHeading title="Podcasts" />}
        renderItem={({ item }) => (
          <PodcastCard
            podcast={item}
            onPress={() => appNav.navigate('PodcastDetail', { podcastId: item.internal_id })}
          />
        )}
        ListEmptyComponent={<EmptyState title="No podcasts yet" />}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.list, { paddingTop: headerPad }]}
        columnWrapperStyle={styles.row}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list:               { paddingBottom: 24, paddingTop: 8, paddingHorizontal: 8 },
  row:                { gap: 8 },
  card:               {
    flex: 1, borderRadius: 12, margin: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  artwork:            { width: '100%', aspectRatio: 1 },
  artworkImg:         { width: '100%', height: '100%' },
  artworkPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  artworkIcon:        { fontSize: 32 },
  cardBody:           { padding: 10, gap: 3 },
  title:              { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  author:             { fontSize: 11 },
  description:        { fontSize: 11, lineHeight: 16 },
});

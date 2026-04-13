import React from 'react';
import {
  View, Text, StyleSheet, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import { Image } from 'expo-image';
import { useGetGroupNewsQuery } from '../../api/apiService';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import { firstGalleryUrl } from '../../utils/image';
import type { GroupsScreenProps } from '../../navigation/types';
import type { GroupNewsPost } from '../../types/api';

function NewsCard({ post }: { post: GroupNewsPost }) {
  const hero = firstGalleryUrl(post.gallery);
  const timeAgo = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : '';
  return (
    <View style={styles.card}>
      {hero && <Image source={{ uri: hero }} style={styles.cardImage} contentFit="cover" />}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{post.title}</Text>
        {post.body && (
          <Text style={styles.cardText} numberOfLines={3}>{post.body.replace(/<[^>]*>/g, '')}</Text>
        )}
        <View style={styles.cardMeta}>
          <Avatar
            filename={post.user?.gallery?.[0]?.filename}
            name={post.user?.firstName ?? '?'}
            size={20}
          />
          <Text style={styles.metaText}>
            {post.user?.firstName} {post.user?.lastName} · {timeAgo}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function GroupNewsScreen({ route }: GroupsScreenProps<'GroupNews'>) {
  const { groupId } = route.params;
  const { data, isLoading, refetch } = useGetGroupNewsQuery({ groupId });
  const posts = data?.entries ?? [];

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.internal_id}
        renderItem={({ item }) => <NewsCard post={item} />}
        ListEmptyComponent={<EmptyState title="No news yet" />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        onRefresh={refetch}
        refreshing={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.cream },
  list:      { paddingBottom: 24 },
  card:      {
    backgroundColor: '#FFFFFF', marginHorizontal: 12, marginTop: 12,
    borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardImage: { width: '100%', aspectRatio: 16 / 9 },
  cardBody:  { padding: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: Colors.fg, marginBottom: 6, lineHeight: 22 },
  cardText:  { fontSize: 14, color: Colors.muted, lineHeight: 20, marginBottom: 10 },
  cardMeta:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText:  { fontSize: 12, color: Colors.grey },
});

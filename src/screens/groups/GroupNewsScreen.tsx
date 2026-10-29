import React from 'react';
import {
  View, StyleSheet, FlatList,
} from 'react-native';
import { Text } from '@ors/kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import { Image } from '../../components/ui/AppImage';
import { useGetGroupNewsQuery } from '../../api/apiService';
import UserByline from '../../components/members/UserByline';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import type { GroupsScreenProps } from '../../navigation/types';
import type { GroupNewsPost } from '../../types/api';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';
import { COMMON_RADIUS, COLOR_BLACK } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

function NewsCard({ post }: { post: GroupNewsPost }) {
  const colors = useColors();
  const hero = firstGalleryUrl(post.gallery);
  const timeAgo = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : '';
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      {hero && <Image source={{ uri: hero }} style={styles.cardImage} contentFit="cover" />}
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.fg }]} numberOfLines={2}>{post.title}</Text>
        {post.body && (
          <Text style={[styles.cardText, { color: colors.muted }]} numberOfLines={3}>{stripHtml(post.body)}</Text>
        )}
        <UserByline user={post.user} size={20} gap={6} meta={timeAgo} color={colors.grey} nameStyle={styles.metaText} />
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
    <SafeAreaView style={ss.fill} edges={['bottom']}>
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
  list:      { paddingBottom: 24 },
  card:      {
    marginHorizontal: 12, marginTop: 12,
    borderRadius: COMMON_RADIUS, overflow: 'hidden',
    shadowColor: COLOR_BLACK, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardImage: { width: '100%', aspectRatio: 16 / 9 },
  cardBody:  { padding: 12 },
  cardTitle: { fontSize: 16, fontFamily: FONT_INTER.bold, marginBottom: 6, lineHeight: 22 },
  cardText:  { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  metaText:  { fontSize: 12, fontFamily: FONT_INTER.regular },
});

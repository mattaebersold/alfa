import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetPostsQuery } from '../../api/apiService';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import type { GroupsScreenProps, AppStackParamList } from '../../navigation/types';
import type { Post } from '../../types/api';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';
import { useRefreshControl } from '../../hooks/useRefreshControl';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

function ListingRow({ post, onPress }: { post: Post; onPress: () => void }) {
  const colors = useColors();
  const hero = firstGalleryUrl(post.gallery);
  return (
    <TouchableOpacity style={[ss.listRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.8}>
      {hero
        ? <Image source={{ uri: hero }} style={styles.thumb} contentFit="cover" />
        : <View style={[styles.thumb, { backgroundColor: colors.secondary }]} />
      }
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{post.title}</Text>
        {post.price && <Text style={styles.price}>${Number(post.price).toLocaleString()}</Text>}
        {post.body && <Text style={[styles.body, { color: colors.grey }]} numberOfLines={1}>{stripHtml(post.body)}</Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function GroupMarketplaceScreen({ route }: GroupsScreenProps<'GroupMarketplace'>) {
  const { groupId } = route.params;
  const navigation = useNavigation<AppNav>();
  const colors = useColors();
  const { data, isLoading, refetch } = useGetPostsQuery({
    group_id: groupId, type: 'listing', limit: 20,
  });
  const refreshControl = useRefreshControl(refetch);
  const posts = data?.entries ?? [];

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <FlatList
        refreshControl={refreshControl}
        data={posts}
        keyExtractor={(p) => p.internal_id}
        renderItem={({ item }) => (
          <ListingRow
            post={item}
            onPress={() => navigation.navigate('PostDetailModal', { postId: item.internal_id })}
          />
        )}
        ListEmptyComponent={<EmptyState title="No listings in this group" />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list:             { flexGrow: 1, paddingBottom: 24 },
  thumb:            { width: 72, height: 54, borderRadius: 8 },
  info:             { flex: 1 },
  title:            { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  price:            { fontSize: 15, fontWeight: '800', color: colors.primaryAlt, marginBottom: 2 },
  body:             { fontSize: 12 },
});

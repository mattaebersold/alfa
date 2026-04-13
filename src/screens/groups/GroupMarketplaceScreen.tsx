import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetPostsQuery } from '../../api/apiService';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import { firstGalleryUrl } from '../../utils/image';
import type { GroupsScreenProps, AppStackParamList } from '../../navigation/types';
import type { Post } from '../../types/api';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

function ListingRow({ post, onPress }: { post: Post; onPress: () => void }) {
  const hero = firstGalleryUrl(post.gallery);
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.8}>
      {hero
        ? <Image source={{ uri: hero }} style={styles.thumb} contentFit="cover" />
        : <View style={[styles.thumb, styles.thumbPlaceholder]} />
      }
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{post.title}</Text>
        {post.price && <Text style={styles.price}>${Number(post.price).toLocaleString()}</Text>}
        {post.body && <Text style={styles.body} numberOfLines={1}>{post.body.replace(/<[^>]*>/g, '')}</Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function GroupMarketplaceScreen({ route }: GroupsScreenProps<'GroupMarketplace'>) {
  const { groupId } = route.params;
  const navigation = useNavigation<AppNav>();
  const { data, isLoading } = useGetPostsQuery({
    group_id: groupId, type: 'listing', limit: 20,
  });
  const posts = data?.entries ?? [];

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
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
  safe:             { flex: 1, backgroundColor: Colors.cream },
  list:             { flexGrow: 1, paddingBottom: 24 },
  row:              {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  thumb:            { width: 72, height: 54, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: Colors.secondary },
  info:             { flex: 1 },
  title:            { fontSize: 14, fontWeight: '700', color: Colors.fg, marginBottom: 4 },
  price:            { fontSize: 15, fontWeight: '800', color: Colors.brg, marginBottom: 2 },
  body:             { fontSize: 12, color: Colors.grey },
});

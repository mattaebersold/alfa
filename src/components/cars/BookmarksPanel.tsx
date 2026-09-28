import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@ors/kit';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Bookmark, Car, FileText } from 'lucide-react-native';
import { useSummaryPanel } from '../ui/SummaryModal';
import {
  useGetCarsQuery, useGetLoggedInUserQuery, useGetPostBookmarksQuery, useGetUserByIdQuery,
  useToggleModelBookmarkMutation, useTogglePostBookmarkMutation,
} from '../../api/apiService';
import { imageUrl } from '../../utils/image';
import { postThumb } from '../../utils/postMedia';
import { stripHtml } from '../../utils/text';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useColors } from '../../hooks/useColors';
import { bookmarkTitle, bookmarkRoute } from '../../utils/modelBookmark';
import type { ModelBookmark, Post } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts'
import { COLOR_GRAY_17, COLOR_GRAY_26, PILL_RADIUS } from '../../constants/config';

type Tab = 'posts' | 'cars';

/**
 * The filled bookmark at a row's end — and the way to take the bookmark off.
 * A tap removes it there and then; the row goes with it.
 */
function Unbookmark({ onPress, label }: { onPress: () => void; label: string }) {
  const brand = useBrandColor();
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={10}
      style={styles.unmark}
      accessibilityRole="button"
      accessibilityLabel={`Remove ${label} from bookmarks`}
    >
      <Bookmark size={18} color={brand} fill={brand} />
    </TouchableOpacity>
  );
}

/** A bookmarked model: a photo of one of its cars, its name and how many there are. */
function ModelRow({ bookmark: b, onPress }: { bookmark: ModelBookmark; onPress: () => void }) {
  const colors = useColors();
  const [toggle] = useToggleModelBookmarkMutation();
  const { data } = useGetCarsQuery({
    page: 0, limit: 1, make: b.make.toLowerCase(), model: b.model_handle,
    ...(b.generation_handle ? { generation: b.generation_handle } : {}),
  });
  const car = data?.entries?.[0];
  const photo = imageUrl(car?.profile_image || car?.gallery?.[0]?.filename);
  const title = bookmarkTitle(b);

  return (
    <TouchableOpacity
      style={[styles.row, { borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.thumb, styles.thumbBlank]}>
          <Car size={18} color={colors.grey} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.fg }]} numberOfLines={1}>{title}</Text>
        {data?.total != null && (
          <Text style={[styles.rowSub, { color: colors.grey }]}>{data.total} {data.total === 1 ? 'car' : 'cars'}</Text>
        )}
      </View>
      {/* The same toggle the model's page uses — here it only ever removes. */}
      <Unbookmark
        label={title}
        onPress={() => toggle({
          make: b.make, model: b.model, model_handle: b.model_handle,
          generation: b.generation, generation_handle: b.generation_handle, standalone: b.standalone,
        })}
      />
    </TouchableOpacity>
  );
}

/** A bookmarked post: its picture, its title (or first words) and who posted it. */
function PostRow({ post, onPress }: { post: Post; onPress: () => void }) {
  const colors = useColors();
  const [toggle] = useTogglePostBookmarkMutation();
  const { url } = postThumb(post);
  const { data: author } = useGetUserByIdQuery(post.user_id, { skip: !post.user_id });
  const title = post.title?.trim() || stripHtml(post.body).trim() || 'Post';

  return (
    <TouchableOpacity
      style={[styles.row, { borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {url ? (
        <Image source={{ uri: url }} style={styles.thumb} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.thumb, styles.thumbBlank]}>
          <FileText size={18} color={colors.grey} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.fg }]} numberOfLines={1}>{title}</Text>
        {author?.username ? (
          <Text style={[styles.rowSub, { color: colors.grey }]} numberOfLines={1}>@{author.username}</Text>
        ) : null}
      </View>
      <Unbookmark label={title} onPress={() => toggle({ post_id: post.internal_id })} />
    </TouchableOpacity>
  );
}

/**
 * Your bookmarks, inside the summary panel the header's bookmark button opens:
 * posts and car models, a tab each. A row opens its post or model page once
 * the panel has closed; the bookmark at its end takes it off the list.
 */
export default function BookmarksPanel() {
  const colors = useColors();
  const brand = useBrandColor();
  const nav = useNavigation<any>();
  const panel = useSummaryPanel();
  const { data: me } = useGetLoggedInUserQuery();
  const models = me?.modelBookmarks ?? [];
  const postIds = me?.postBookmarks ?? [];
  const { data: postData, isLoading: postsLoading } = useGetPostBookmarksQuery(undefined, { skip: postIds.length === 0 });
  // The profile's list is updated on the tap; the fetched posts catch up on
  // the refetch. Filtering by the list is what makes a removed row go at once.
  const posts = (postData?.entries ?? []).filter((p) => postIds.includes(p.internal_id));

  // Posts first, unless there are only car bookmarks.
  const [tab, setTab] = useState<Tab>(() => (postIds.length === 0 && models.length > 0 ? 'cars' : 'posts'));

  const leaveTo = (go: () => void) => (panel ? panel.closeThen(go) : go());
  const openModel = (b: ModelBookmark) => leaveTo(() => nav.navigate('MainTabs', {
    screen: 'CarsTab',
    params: { screen: 'ModelDetail', params: bookmarkRoute(b) },
  }));
  const openPost = (p: Post) => leaveTo(() => nav.navigate('PostDetailModal', { postId: p.internal_id }));

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'posts', label: 'Posts', count: postIds.length },
    { key: 'cars', label: 'Cars', count: models.length },
  ];

  return (
    <View style={styles.body}>
      <Text style={[styles.title, { color: colors.fg }]}>Bookmarks</Text>

      <View style={styles.tabs} accessibilityRole="tablist">
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, { borderColor: on ? brand : colors.border }, on && { backgroundColor: brand }]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.tabText, { color: on ? '#000000' : colors.fg }]}>
                {t.label}{t.count > 0 ? ` · ${t.count}` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'posts' ? (
        postIds.length === 0 ? (
          <Text style={[styles.empty, { color: colors.grey }]}>No posts bookmarked yet — tap the bookmark on any post in the feed.</Text>
        ) : postsLoading ? (
          <Text style={[styles.empty, { color: colors.grey }]}>Loading…</Text>
        ) : (
          <View style={styles.list}>
            {posts.map((p) => <PostRow key={p.internal_id} post={p} onPress={() => openPost(p)} />)}
          </View>
        )
      ) : models.length === 0 ? (
        <Text style={[styles.empty, { color: colors.grey }]}>No cars bookmarked yet — bookmark a make or model from its page.</Text>
      ) : (
        <View style={styles.list}>
          {models.map((b) => (
            <ModelRow
              key={`${b.make}-${b.model_handle}-${b.generation_handle ?? ''}`}
              bookmark={b}
              onPress={() => openModel(b)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  title: { fontSize: 20, fontFamily: FONT_INTER.bold, letterSpacing: -0.3 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: PILL_RADIUS, borderWidth: 1 },
  tabText: { fontSize: 13, fontFamily: FONT_INTER.bold },
  empty: { fontSize: 14, lineHeight: 20 },
  list: { gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 8, paddingRight: 8, borderRadius: 12, borderWidth: 1,
    backgroundColor: COLOR_GRAY_17,
  },
  thumb: { width: 64, height: 48, borderRadius: 8, backgroundColor: COLOR_GRAY_26 },
  thumbBlank: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontFamily: FONT_INTER.bold },
  rowSub: { fontSize: 12.5, fontFamily: FONT_INTER.semibold },
  unmark: { padding: 6 },
});

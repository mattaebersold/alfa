import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text } from '@ors/kit';
import { useNavigation } from '@react-navigation/native';
import { Image } from '../ui/AppImage';
import { Bookmark, Car, FileText } from 'lucide-react-native';
import { useSummaryPanel } from '../ui/SummaryModal';
import SubTabs from '../ui/SubTabs';
import {
  useGetCarsQuery, useGetLoggedInUserQuery, useGetPostBookmarksQuery, useGetUserByIdQuery,
  useToggleModelBookmarkMutation, useTogglePostBookmarkMutation,
  useGetCarBookmarksQuery, useToggleCarBookmarkMutation,
} from '../../api/apiService';
import { imageUrl, carHeroUrl } from '../../utils/image';
import { postThumb } from '../../utils/postMedia';
import { stripHtml } from '../../utils/text';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useColors } from '../../hooks/useColors';
import { bookmarkTitle, bookmarkRoute } from '../../utils/modelBookmark';
import type { GarageCar, ModelBookmark, Post } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts'
import { COLOR_GRAY_17, COLOR_GRAY_26 } from '../../constants/config';

type Tab = 'posts' | 'cars' | 'models';

/**
 * The filled bookmark at a row's end — and the way to take the bookmark off.
 * Asked first: it's a small target beside a row you tap to open, and a
 * bookmark taken off by a slip is gone from the list with no way back.
 */
function Unbookmark({ onPress, label }: { onPress: () => void; label: string }) {
  const brand = useBrandColor();
  const confirm = () => Alert.alert(
    'Remove from bookmarks?',
    `${label} will come off your bookmarks.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress },
    ],
  );
  return (
    <TouchableOpacity
      onPress={confirm}
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
      style={styles.row}
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
      style={styles.row}
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

/** A bookmarked member's car: its photo, its name and whose it is. */
function CarRow({ car, onPress }: { car: GarageCar; onPress: () => void }) {
  const colors = useColors();
  const [toggle] = useToggleCarBookmarkMutation();
  const photo = carHeroUrl(car);
  const { data: owner } = useGetUserByIdQuery(car.user_id ?? '', { skip: !car.user_id });
  const title = car.title?.trim() || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Car';

  return (
    <TouchableOpacity
      style={styles.row}
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
        {owner?.username ? (
          <Text style={[styles.rowSub, { color: colors.grey }]} numberOfLines={1}>@{owner.username}</Text>
        ) : null}
      </View>
      <Unbookmark label={title} onPress={() => toggle({ car_id: car.internal_id })} />
    </TouchableOpacity>
  );
}

/**
 * Your bookmarks, inside the summary panel the header's bookmark button opens:
 * posts, members' cars and car models, a tab each. A row opens its post or model page once
 * the panel has closed; the bookmark at its end takes it off the list.
 */
export default function BookmarksPanel() {
  const colors = useColors();
  const nav = useNavigation<any>();
  const panel = useSummaryPanel();
  const { data: me } = useGetLoggedInUserQuery();
  const models = me?.modelBookmarks ?? [];
  const postIds = me?.postBookmarks ?? [];
  const { data: postData, isLoading: postsLoading } = useGetPostBookmarksQuery(undefined, { skip: postIds.length === 0 });
  // The profile's list is updated on the tap; the fetched posts catch up on
  // the refetch. Filtering by the list is what makes a removed row go at once.
  const posts = (postData?.entries ?? []).filter((p) => postIds.includes(p.internal_id));
  const carIds = me?.carBookmarks ?? [];
  const { data: carData, isLoading: carsLoading } = useGetCarBookmarksQuery(undefined, { skip: carIds.length === 0 });
  const cars = (carData?.entries ?? []).filter((c) => carIds.includes(c.internal_id));

  // The first tab with anything in it — posts when there's nothing at all.
  const [tab, setTab] = useState<Tab>(() => (
    postIds.length ? 'posts' : carIds.length ? 'cars' : models.length ? 'models' : 'posts'
  ));

  const leaveTo = (go: () => void) => (panel ? panel.closeThen(go) : go());
  const openModel = (b: ModelBookmark) => leaveTo(() => nav.navigate('MainTabs', {
    screen: 'CarsTab',
    params: { screen: 'ModelDetail', params: bookmarkRoute(b) },
  }));
  const openPost = (p: Post) => leaveTo(() => nav.navigate('PostDetailModal', { postId: p.internal_id }));
  const openCar = (c: GarageCar) => leaveTo(() => nav.navigate('CarDetail', { carId: c.internal_id }));

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'posts', label: 'Posts', count: postIds.length },
    { key: 'cars', label: 'Cars', count: carIds.length },
    { key: 'models', label: 'Models', count: models.length },
  ];

  return (
    <View style={styles.body}>
      {/* No heading — the panel opened from the bookmark button, so it's
          already clear what this is. Posts, cars or models, as sub tabs. */}
      <View style={styles.tabs}>
        <SubTabs
          options={tabs.map((t) => ({ key: t.key, label: t.count > 0 ? `${t.label} · ${t.count}` : t.label }))}
          value={tab}
          onChange={setTab}
        />
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
      ) : tab === 'cars' ? (
        carIds.length === 0 ? (
          <Text style={[styles.empty, { color: colors.grey }]}>No cars bookmarked yet — tap the bookmark on anyone's car.</Text>
        ) : carsLoading ? (
          <Text style={[styles.empty, { color: colors.grey }]}>Loading…</Text>
        ) : (
          <View style={styles.list}>
            {cars.map((c) => <CarRow key={c.internal_id} car={c} onPress={() => openCar(c)} />)}
          </View>
        )
      ) : models.length === 0 ? (
        <Text style={[styles.empty, { color: colors.grey }]}>No models bookmarked yet — bookmark a make or model from its page.</Text>
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
  // SubTabs brings its own 12 of side margin; the body already has 16.
  tabs: { marginHorizontal: -12 },
  empty: { fontSize: 14, lineHeight: 20 },
  list: { gap: 8 },
  // No padding and no edge: the photo runs to the row's top, bottom and left,
  // and the row's own corners clip it there. Only the bookmark keeps room.
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingRight: 8, borderRadius: 12, overflow: 'hidden',
    backgroundColor: COLOR_GRAY_17,
  },
  // Rounded on the right only — the side that meets the words.
  thumb: {
    width: 88, height: 64, backgroundColor: COLOR_GRAY_26,
    borderTopRightRadius: 10, borderBottomRightRadius: 10,
  },
  thumbBlank: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontFamily: FONT_INTER.bold },
  rowSub: { fontSize: 12.5, fontFamily: FONT_INTER.semibold },
  unmark: { padding: 6 },
});

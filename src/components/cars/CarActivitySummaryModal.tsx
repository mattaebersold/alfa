import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from '../ui/AppImage';
import { Wrench, Images, Tag, Users, MessageCircle, Heart, Check, Plus } from 'lucide-react-native';
import SummaryModal, { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import MainTabs, { PANEL_TRACK_BG } from '../ui/MainTabs';
import CarItemSummaryModal, { type CarItem } from './CarItemSummaryModal';
import TaggedPostsPane from './TaggedPostsPane';
import PostSummaryModal from '../social/PostSummaryModal';
import InlineComments from '../social/InlineComments';
import { LikerRow } from '../social/LikersSheet';
import { useStackedUserSummary } from '../members/useStackedUserSummary';
import {
  useGetCarModsPageQuery, useGetCarGalleriesPageQuery, useGetCarTaggedPostsQuery,
  useGetCarFollowersQuery, useGetLikeUsersQuery,
  useGetCarFollowStatusQuery, useFollowCarMutation, useUnfollowCarMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useLikeState } from '../../hooks/useLikeState';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import type { CarGalleryAlbum, GarageCar, Mod, Post } from '../../types/api';
import { COMMON_RADIUS, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** One tab per count on the garage card — see CarPosterCard's CarCountBadges. */
export type CarActivityTab = 'mods' | 'galleries' | 'posts' | 'followers' | 'comments' | 'likes';

/** How many of each list the panel asks for — a garage panel's look, not the car page's full record. */
const PAGE = 30;

/**
 * Everything logged against a car, and how it's been received, in one
 * summary: mods, galleries, posts it's tagged in, followers, comments and
 * likes, a main tab each. Opened from the counts on a garage card, on the tab
 * whose count was tapped; the rest are a tap away along the row.
 *
 * A mod, gallery, post or person opens its own summary over this one.
 */
export default function CarActivitySummaryModal({ car, tab: openOn, origin, only, onClose }: {
  car: GarageCar;
  /** Just these tabs, in this order — the car page's followers, likes and comments. */
  only?: CarActivityTab[];
  /** The tab to open on; null closes the panel. */
  tab: CarActivityTab | null;
  origin?: SummaryOrigin | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const visible = openOn != null;
  const [tab, setTab] = useState<CarActivityTab>(openOn ?? only?.[0] ?? 'mods');
  // Each open lands on the tab whose count was tapped — set while rendering,
  // not after, so the first frame isn't the last open's tab.
  const [lastOpenOn, setLastOpenOn] = useState(openOn);
  if (openOn !== lastOpenOn) {
    setLastOpenOn(openOn);
    if (openOn) setTab(openOn);
  }

  const carId = car.internal_id;
  const carName = car.title || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Car';
  const skip = !visible || !carId;
  // A tab that isn't shown has nothing to fetch.
  const off = (key: CarActivityTab) => skip || (!!only && !only.includes(key));
  const mods = useGetCarModsPageQuery({ carId, page: 0, limit: PAGE }, { skip: off('mods') });
  const albums = useGetCarGalleriesPageQuery({ carId, page: 0, limit: PAGE }, { skip: off('galleries') });
  const tagged = useGetCarTaggedPostsQuery({ carId, page: 0, limit: 1 }, { skip: off('posts') });
  const followers = useGetCarFollowersQuery(carId, { skip });
  const likes = useGetLikeUsersQuery(carId, { skip });
  // What this session knows over the fetched list, so a like made on a card a
  // moment ago is already in it.
  const known = useLikeState(carId);
  const likerIds = known?.users ?? likes.data?.users ?? [];

  // What opens over this panel: a mod or gallery, a post, a person.
  const [item, setItem] = useState<{ item: CarItem; origin: SummaryOrigin | null } | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const { openUser, stacked: userStacked } = useStackedUserSummary(visible);

  const asItem = (kind: 'mod' | 'gallery', m: Mod | CarGalleryAlbum): CarItem => ({
    internal_id: m.internal_id,
    kind,
    entryType: kind === 'mod' ? 'mod' : 'cargallery',
    title: m.title,
    body: m.body,
    type: m.type,
    gallery: m.gallery,
    carId,
    carName,
    ownerId: car.user_id,
    like_count: m.like_count,
    isLiked: m.isLiked,
    comment_count: m.comment_count,
  });

  const allTabs = [
    { key: 'mods' as const, label: 'Mods', Icon: Wrench, count: mods.data?.total },
    { key: 'galleries' as const, label: 'Galleries', Icon: Images, count: albums.data?.total },
    { key: 'posts' as const, label: 'Tagged', Icon: Tag, count: tagged.data?.total },
    { key: 'followers' as const, label: 'Followers', Icon: Users, count: followers.data?.total },
    { key: 'comments' as const, label: 'Comments', Icon: MessageCircle, count: car.comment_count },
    { key: 'likes' as const, label: 'Likes', Icon: Heart, count: known?.count ?? likes.data?.total ?? car.like_count },
  ];
  const tabs = only ? only.map((k) => allTabs.find((t) => t.key === k)!) : allTabs;

  const loading = <ActivityIndicator color={colors.grey} style={styles.loader} />;
  const empty = (text: string) => <Text style={[styles.empty, { color: colors.grey }]}>{text}</Text>;

  const body = () => {
    switch (tab) {
      case 'mods':
      case 'galleries': {
        const kind = tab === 'mods' ? 'mod' : 'gallery';
        const q = tab === 'mods' ? mods : albums;
        const list: (Mod | CarGalleryAlbum)[] = q.data?.entries ?? [];
        if (q.isLoading) return loading;
        if (!list.length) return empty(tab === 'mods' ? 'No mods yet' : 'No galleries yet');
        return list.map((m) => (
          <ItemRow
            key={m.internal_id}
            title={m.title || (kind === 'mod' ? 'Mod' : 'Gallery')}
            sub={kind === 'mod' ? m.type : `${m.gallery?.length ?? 0} photos`}
            photo={firstGalleryUrl(m.gallery)}
            onPress={(o) => setItem({ item: asItem(kind, m), origin: o })}
          />
        ));
      }
      case 'posts':
        return <TaggedPostsPane carId={carId} onPostPress={setPost} />;
      case 'followers': {
        const list = followers.data?.entries ?? [];
        return (
          <>
            {/* Follow it from here, over the people who already do. */}
            <CarFollowToggle car={car} />
            {followers.isLoading ? loading : !list.length ? empty('No followers yet') : list.map((u, i) => (
              <LikerRow key={u.user_id} userId={u.user_id} onOpen={openUser} last={i === list.length - 1} rule={false} dense />
            ))}
          </>
        );
      }
      case 'comments':
        // No heading — the tab already says "Comments" and how many — and no
        // ground of its own behind the thread or the composer: the panel's shows.
        return <InlineComments documentId={carId} entryType="garagecar" variant="panel" title="" backgroundColor="transparent" pinComposer />;
      case 'likes': {
        const ids = likerIds;
        if (likes.isLoading && !ids.length) return loading;
        if (!ids.length) return empty('No likes yet');
        return ids.map((id, i) => <LikerRow key={id} userId={id} onOpen={openUser} last={i === ids.length - 1} rule={false} dense />);
      }
    }
  };

  return (
    <SummaryModal
      visible={visible}
      onClose={onClose}
      origin={origin}
      // Tall from the start, so stepping between a short tab and a long one
      // doesn't make the panel jump.
      minHeightRatio={0.6}
      stacked={(
        <>
          <CarItemSummaryModal item={item?.item ?? null} origin={item?.origin} onClose={() => setItem(null)} />
          <PostSummaryModal post={post} onClose={() => setPost(null)} />
          {userStacked}
        </>
      )}
    >
      {/* A darker grey track, every count in white — the lit tab's too — and
          icons rather than words, spread across the panel, so it never scrolls. */}
      <MainTabs tabs={tabs} value={tab} onChange={setTab} inset={16} trackColor={PANEL_TRACK_BG} countColor={COLOR_WHITE} iconOnly stretch style={styles.tabs} />
      <View style={styles.body}>{body()}</View>
    </SummaryModal>
  );
}

/** A mod or gallery: its first photo, its name, and what kind or how many. */
function ItemRow({ title, sub, photo, onPress }: {
  title: string;
  sub?: string | null;
  photo: string | null;
  onPress: (origin: SummaryOrigin | null) => void;
}) {
  const colors = useColors();
  return (
    <SummaryTouchable onPress={onPress} style={[styles.row, { borderBottomColor: colors.border }]} accessibilityLabel={title}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: colors.segment }]} />
      )}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.fg }]} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={[styles.rowSub, { color: colors.grey }]} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </SummaryTouchable>
  );
}

/**
 * Follow the car, or stop — at the head of its followers tab. The car summary's
 * follow, full width. Your own car (or one you co-own) has nothing to follow,
 * so it isn't offered. Following and unfollowing refetch the list under it.
 */
function CarFollowToggle({ car }: { car: GarageCar }) {
  const colors = useColors();
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const isOwner = !!myId && (myId === car.user_id || myId === car.coowner_id);
  const { data: status } = useGetCarFollowStatusQuery(car.internal_id, { skip: isOwner || !myId });
  const [followCar, { isLoading: following }] = useFollowCarMutation();
  const [unfollowCar, { isLoading: unfollowing }] = useUnfollowCarMutation();
  // What this button last did, until the status refetch says the same.
  const [local, setLocal] = useState<boolean | undefined>(undefined);
  const isFollowing = local ?? status?.following ?? car.following ?? false;
  const busy = following || unfollowing;
  if (isOwner || !myId) return null;

  const toggle = async () => {
    if (busy) return;
    try {
      if (isFollowing) await unfollowCar({ car_id: car.internal_id }).unwrap();
      else await followCar({ car_id: car.internal_id }).unwrap();
      setLocal(!isFollowing);
    } catch {
      Alert.alert(isFollowing ? "Couldn't unfollow" : "Couldn't follow", 'Please try again.');
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.followBtn,
        // Outlined in the brand colour to follow; on a dark segment once you
        // do — off and on, as the summary's button reads.
        isFollowing
          ? { backgroundColor: colors.segment, borderColor: colors.border }
          : { backgroundColor: 'transparent', borderColor: colors.primaryAlt },
        busy && styles.followBtnBusy,
      ]}
      onPress={toggle}
      disabled={busy}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected: isFollowing, busy }}
      accessibilityLabel={isFollowing ? 'Unfollow this car' : 'Follow this car'}
    >
      {isFollowing
        ? <Check size={15} color={colors.fg} strokeWidth={3} />
        : <Plus size={15} color={colors.primaryAlt} strokeWidth={3} />}
      <Text style={[styles.followText, { color: isFollowing ? colors.fg : colors.primaryAlt }]}>
        {isFollowing ? 'Following' : 'Follow Car'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // No title over them — the panel grew out of the car's card.
  tabs:    { marginTop: 18, marginBottom: 6 },
  body:    { paddingHorizontal: 16, paddingBottom: 8 },
  loader:  { marginTop: 30 },
  empty:   { fontSize: 14, paddingVertical: 24, textAlign: 'center' },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, marginTop: 4, marginBottom: 8,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  followBtnBusy: { opacity: 0.6 },
  followText: { fontSize: 14, fontFamily: FONT_INTER.bold },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb:   { width: 52, height: 52, borderRadius: COMMON_RADIUS / 2 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle:{ fontSize: 15, fontFamily: FONT_INTER.semibold },
  rowSub:  { fontSize: 12.5, marginTop: 2, textTransform: 'capitalize' },
});

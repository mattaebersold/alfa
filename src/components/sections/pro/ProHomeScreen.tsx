import React, { useMemo, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../../../theme/Text';
import RowEndSpacer from '../../ui/RowEndSpacer';
import PostStrip from '../../social/PostStrip';
import NewProVideosShelf from '../../videos/NewProVideosShelf';
import ProMembersRow from '../../pro/ProMembersRow';
import ProSectionTitle from '../../pro/ProSectionTitle';
import ProViewAllPane from '../../pro/ProViewAllPane';
import { Gamepad2, MessageSquare, Car } from 'lucide-react-native';
import CarPosterCard from '../../cards/CarPosterCard';
import FeedItemCard from '../../cards/FeedItemCard';
import UserByline from '../../members/UserByline';
import GroupCard from '../../groups/GroupCard';
import GroupItemActions from '../../groups/GroupItemActions';
import GroupItemDetailModal from '../../groups/GroupItemDetailModal';
import Countdown from '../../games/Countdown';
import { Skeleton, SkeletonCard, SkeletonLine, SkeletonList, SkeletonRow } from '../../ui/Skeleton';
import DailyGameTiles from '../../games/DailyGameTiles';
import { useCarStatus, useAuctionStatus, type Status } from './DailyGamesLanding';
import {
  useGetProHomeQuery, useGetGroupQuery, useGetGroupPostsFeedInfiniteQuery, useGetGroupDiscussionFeedInfiniteQuery,
} from '../../../api/apiService';
import { useRefreshControl } from '../../../hooks/useRefreshControl';
import { useColors } from '../../../hooks/useColors';
import { stripHtml } from '../../../utils/text';
import { shortTimeAgo } from '../../../utils/shortTimeAgo';
import { DISCUSSION_CATEGORIES } from '../../../constants/groupCategories';
import {
  COMMON_RADIUS, GUTTER, COLOR_GRAY_102, GROUP_LISTING_CARD, SURFACE_MID,
} from '../../../constants/config';
import { FONT_INTER } from '../../../constants/fonts';
import type { Post, Group, GroupDiscussionPost } from '../../../types/api';
import type { SectionScreenProps } from '../types';

const SCREEN_WIDTH = Dimensions.get('window').width;
/** How many of the group's latest go on Home before "See all". */
const GROUP_PREVIEW = 5;
/** The garage row's cards — most of the screen, the next one peeking in. */
const CAR_WIDTH = Math.round(SCREEN_WIDTH * 0.72);
const CAR_GAP = 10;
/** A Pro Updates card's width while it loads — about PostStrip's. */
const POST_SKELETON_W = Math.round(SCREEN_WIDTH * 0.62);
/** The side inset the shelves' headings keep (PostStrip's). */
const HEAD_PAD = 16;

/**
 * PRO › Home, a Pro member's landing on the PRO tab: today's Daily Games up
 * top, then the Pro-only group's latest (when this server has the group),
 * then the latest posts and garage cars from Pro members, and Pro members
 * to follow.
 *
 * Everyone else's PRO tab is the sign-up page — see FeedScreen's ProPane.
 */
export default function ProHomeScreen({ scrollRef, headerPad, onScroll, bottomPad }: SectionScreenProps & {
  /** FeedScreen's, so picking the tab again brings it back to the top. */
  scrollRef?: React.RefObject<ScrollView | null>;
}) {
  const navigation = useNavigation<any>();
  const home = useGetProHomeQuery();
  const group = home.data?.group ?? null;
  const groupId = group?.internal_id ?? '';
  // The whole group, for its card — shared with the group page's cache.
  // The card's fields come with Home now; an older server's group is fetched.
  const hasCard = !!group && group.member_count != null;
  const fetchedGroup = useGetGroupQuery(groupId, { skip: !group || hasCard }).data;
  const cardGroup = (hasCard ? group : fetchedGroup) as Group | null | undefined;
  // First load only — a refetch keeps what's on screen.
  const homeLoading = home.isLoading;

  // The group page's own feeds, so Home and the group share a cache.
  const postsFeed = useGetGroupPostsFeedInfiniteQuery({ groupId }, { skip: !group });
  const discussionFeed = useGetGroupDiscussionFeedInfiniteQuery({ groupId }, { skip: !group });

  const car = useCarStatus();
  const auction = useAuctionStatus();

  const [detail, setDetail] = useState<GroupDiscussionPost | null>(null);

  const refreshControl = useRefreshControl(() => Promise.all([
    home.refetch(),
    car.refetch(),
    auction.refetch(),
    // A skipped query can't be refetched — only once there's a group.
    ...(group ? [postsFeed.refetch(), discussionFeed.refetch()] : []),
  ]), headerPad);

  /** The group's posts and discussion, newest first, as one list. */
  const groupItems = useMemo(() => {
    const posts = (postsFeed.data?.pages[0]?.entries ?? []).map((p) => ({ kind: 'post' as const, at: p.created_at, item: p }));
    const threads = (discussionFeed.data?.pages[0]?.entries ?? []).map((d) => ({ kind: 'discussion' as const, at: d.created_at, item: d }));
    return [...posts, ...threads]
      .sort((a, b) => (Date.parse(b.at ?? '') || 0) - (Date.parse(a.at ?? '') || 0))
      .slice(0, GROUP_PREVIEW);
  }, [postsFeed.data, discussionFeed.data]);

  const openGroup = () => { if (group) navigation.navigate('GroupDetail', { groupId: group.internal_id }); };
  const openPost = (post: Post) => navigation.navigate('PostDetailModal', { postId: post.internal_id });
  /** Which View all pane is open: Pro Member Updates' or Pro Member Cars'. */
  const [viewAll, setViewAll] = useState<'posts' | 'cars' | null>(null);
  const lastViewAll = useRef<'posts' | 'cars'>('posts');
  if (viewAll) lastViewAll.current = viewAll;

  const cars = home.data?.cars ?? [];
  const groupLoading = postsFeed.isLoading || discussionFeed.isLoading;

  return (
    <>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: headerPad + 2, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={refreshControl}
      >
        {/* 1. Today's Daily Games. */}
        <DailyGamesCard statuses={[car, auction]} />

        {/* Home's first load: grey stand-ins for the rows under the games. */}
        {homeLoading ? <HomeSkeleton /> : null}

        {/* 2. The Pro-only group — only once the server has one. */}
        {group ? (
          <View style={styles.section}>
            <View style={styles.groupCard}>
              {cardGroup ? (
                <GroupCard
                  pro
                  hideSubtitle
                  group={cardGroup}
                  role={cardGroup.membership?.member_type === 'admin' ? 'admin' : 'member'}
                  bannerRatio={2}
                  onPress={openGroup}
                />
              ) : (
                <SkeletonCard ratio={2} />
              )}
            </View>

            {/* The newest Pro videos, right under the group's card; View all
                opens PRO › Videos. Hides itself when there are none. */}
            <NewProVideosShelf />

            {/* The group's latest: grey stand-ins until they're in. */}
            {groupLoading ? <SkeletonList count={2} ratio={2.4} style={styles.groupSkeleton} /> : null}

            {groupItems.map(({ kind, item }) => (kind === 'post' ? (
              // The home feed's card, as the group page's Posts tab shows it.
              <View key={`p-${item.internal_id}`} style={styles.feedCard}>
                <FeedItemCard
                  post={item as Post}
                  isLiked={(item as Post).isLiked}
                  omitGroupId={groupId}
                  background={GROUP_LISTING_CARD}
                  onPress={() => openPost(item as Post)}
                />
              </View>
            ) : (
              <DiscussionCard key={`d-${item.internal_id}`} item={item as GroupDiscussionPost} onPress={() => setDetail(item as GroupDiscussionPost)} />
            )))}
          </View>
        ) : null}

        {/* No Pro group: the videos row stands on its own here. */}
        {group ? null : <NewProVideosShelf />}

        {/* 3. Pro members' latest posts. Hides itself when there are none. */}
        <PostStrip
          titleNode={<ProSectionTitle title="Pro Member Updates" Icon={MessageSquare} />}
          posts={home.data?.posts ?? []}
          // The author's photo top-left on each card (a text post or a poll:
          // under its words), as on the video cards above; no name or time.
          avatarOnImage="right"
          showByline={false}
          showTime={false}
          onPostPress={openPost}
          onViewAll={() => setViewAll('posts')}
          alwaysViewAll
        />

        {/* 4. Pro members' latest garage cars. */}
        {cars.length ? (
          <View style={styles.carsWrap}>
            <View style={[styles.shelfHead, styles.shelfHeading]}>
              <ProSectionTitle title="Pro Member Cars" Icon={Car} />
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={() => setViewAll('cars')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="View all Pro member cars"
              >
                <Text style={styles.viewAllText}>View all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carRow}
              snapToInterval={CAR_WIDTH + CAR_GAP}
              snapToAlignment="start"
              decelerationRate="fast"
            >
              {cars.map((gc) => (
                <CarPosterCard
                  key={gc.internal_id}
                  car={gc}
                  // As the featured row draws them: the garage card's plate and
                  // counts, square, with the owner — and a tap opens the summary.
                  showOwner
                  // Just the owner's photo, top-left, as on the video cards.
                  ownerAvatar
                  plain
                  square
                  summaryOnPress
                  style={styles.carCard}
                />
              ))}
              <RowEndSpacer width={HEAD_PAD} />
            </ScrollView>
          </View>
        ) : null}

        {/* 5. Pro members: a search of them all, then the ones you don't follow yet. */}
        <ProMembersRow members={home.data?.members ?? []} inset={HEAD_PAD} />

      </ScrollView>

      <GroupItemDetailModal
        visible={!!detail}
        item={detail}
        kind={detail ? 'discussion' : null}
        categoryLabel={detail ? (DISCUSSION_CATEGORIES.find((k) => k.key === (detail.category ?? 'general'))?.label ?? detail.category) : null}
        categories={DISCUSSION_CATEGORIES}
        groupTitle={group?.title}
        onClose={() => setDetail(null)}
      />

      {/* View all, for Pro Member Updates and Pro Member Cars. */}
      <ProViewAllPane kind={lastViewAll.current} visible={!!viewAll} onClose={() => setViewAll(null)} />
    </>
  );
}

/**
 * Today's Daily Games, as Home's lead: a square tile for each game, each
 * opening that game's screen (where its Past Games and Leaderboard are).
 */
function DailyGamesCard({ statuses }: { statuses: Status[] }) {
  const nextAt = statuses.find((s) => s.nextAt)?.nextAt;

  return (
    <View style={styles.gamesCard}>
      <DailyGameTiles titleNode={<ProSectionTitle title="Daily Games" Icon={Gamepad2} />} />

      {nextAt ? (
        <Countdown nextAt={nextAt} label="Resets in" small />
      ) : null}
    </View>
  );
}

/**
 * Home under the games before it's arrived — the group card, a post shelf,
 * a car shelf and the members row, as grey boxes in their places.
 */
function HomeSkeleton() {
  return (
    <View>
      <View style={[styles.section, styles.groupCard]}>
        <SkeletonCard ratio={2} />
      </View>
      {[{ w: POST_SKELETON_W, ratio: 0.8 }, { w: CAR_WIDTH, ratio: 1 }].map(({ w, ratio }, i) => (
        <View key={i} style={styles.carsWrap}>
          <SkeletonLine width={140} height={17} style={styles.skeletonHeading} />
          <View style={styles.skeletonShelf}>
            {[0, 1].map((k) => <Skeleton key={k} width={w} style={{ aspectRatio: ratio }} radius={COMMON_RADIUS} />)}
          </View>
        </View>
      ))}
      <View style={styles.carsWrap}>
        <SkeletonLine width={150} height={17} style={styles.skeletonHeading} />
        <SkeletonRow count={4} size={110} radius={COMMON_RADIUS} style={styles.skeletonShelf} />
      </View>
    </View>
  );
}

/** A group thread, as the group page's Discussion tab draws it. */
function DiscussionCard({ item, onPress }: { item: GroupDiscussionPost; onPress: () => void }) {
  const c = useColors();
  return (
    <TouchableOpacity
      style={[styles.itemCard, { backgroundColor: SURFACE_MID, borderColor: c.borderDark }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.itemTitle, { color: c.fg }]} numberOfLines={2}>{item.title}</Text>
      {item.body ? <Text style={[styles.itemBody, { color: c.muted }]} numberOfLines={2}>{stripHtml(item.body)}</Text> : null}
      <View style={styles.itemFoot}>
        <UserByline user={item.user} size={22} gap={7} nameStyle={styles.itemAuthorName} style={styles.itemAuthor}>
          {item.created_at ? <Text style={[styles.itemAuthorName, styles.itemWhen]}>{shortTimeAgo(item.created_at)}</Text> : null}
        </UserByline>
        <GroupItemActions kind="discussion" item={item} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  // The headings the home sections share (CarsScreen's "All Member Cars", PostStrip's titles).
  heading: { fontSize: 17, fontFamily: FONT_INTER.bold },
  section: { paddingTop: 30 },
  empty: { fontSize: 13, paddingHorizontal: HEAD_PAD, paddingTop: 6 },

  // ── Daily Games ──
  gamesCard: { marginHorizontal: GUTTER + 8, gap: 12 },

  // ── The group ──
  // The Daily Games' side inset, so the two line up.
  groupSkeleton: { paddingHorizontal: GUTTER, marginTop: 10 },
  skeletonHeading: { marginHorizontal: HEAD_PAD, marginBottom: 12 },
  skeletonShelf: { flexDirection: 'row', gap: CAR_GAP, paddingLeft: HEAD_PAD, overflow: 'hidden' },
  groupCard: { paddingHorizontal: GUTTER + 8, marginBottom: 4 },
  feedCard: { paddingHorizontal: GUTTER, marginTop: 10 },
  // The group page's discussion card (GroupDetailScreen's itemCard).
  itemCard: {
    marginHorizontal: GUTTER, marginTop: 10,
    borderRadius: COMMON_RADIUS, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
    paddingHorizontal: 14, paddingVertical: 12, gap: 5,
  },
  itemTitle: { fontSize: 15, fontFamily: FONT_INTER.bold },
  itemBody: { width: '90%', fontSize: 12, lineHeight: 17 },
  itemFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 },
  itemAuthor: { flexShrink: 1 },
  itemAuthorName: { fontSize: 12, fontFamily: FONT_INTER.semibold },
  itemWhen: { color: COLOR_GRAY_102, fontFamily: FONT_INTER.regular },

  // ── Garage cars ──
  carsWrap: { paddingTop: 30 },
  shelfHeading: { paddingHorizontal: HEAD_PAD, paddingBottom: 10 },
  // A title with its View all at the other end — PostStrip's head.
  shelfHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 10 },
  viewAllBtn: { height: 28, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  viewAllText: { fontSize: 12.5, fontFamily: FONT_INTER.semibold, color: '#FFFFFF' },
  carRow: { gap: CAR_GAP, paddingLeft: HEAD_PAD, paddingBottom: 4 },
  carCard: { width: CAR_WIDTH, marginHorizontal: 0, marginVertical: 0 },

});

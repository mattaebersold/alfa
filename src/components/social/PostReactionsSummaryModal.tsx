import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Text } from '@ors/kit';
import { Heart, MessageCircle } from 'lucide-react-native';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import PanelTabs from '../ui/PanelTabs';
import InlineComments from './InlineComments';
import { LikerRow } from './LikersSheet';
import { useStackedUserSummary } from '../members/useStackedUserSummary';
import { useGetLikeUsersQuery } from '../../api/apiService';
import { useLikeState } from '../../hooks/useLikeState';
import { useCommentThread } from '../../hooks/useCommentThread';
import { useColors } from '../../hooks/useColors';
import { useAppSelector } from '../../store/store';
import type { PostLike } from '../../hooks/usePostLike';
import { COMMON_RADIUS, COLOR_GRAY_42, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import PanelEmpty from '../ui/PanelEmpty';

export type PostReactionsTab = 'likes' | 'comments';

/**
 * A post's likes and comments in one summary, a main tab each — opened from
 * the action rail on whichever was tapped (the heart or its faces, or the
 * comment bubble); the other is a tap away along the row. The car page's
 * reactions panel (CarActivitySummaryModal) in the same dress.
 *
 * Having liked it, your own row leads the likes tab with an Unlike at its
 * end — the rail's heart opens this rather than unliking on the spot, and the
 * unlike asks first.
 */
export default function PostReactionsSummaryModal({ postId, entryType, like, tab: openOn, origin, onClose }: {
  postId: string;
  entryType: string;
  /** The card's like — see usePostLike. */
  like: PostLike;
  /** The tab to open on; null closes the panel. */
  tab: PostReactionsTab | null;
  origin?: SummaryOrigin | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const visible = openOn != null;
  const [tab, setTab] = useState<PostReactionsTab>(openOn ?? 'likes');
  // Each open lands on the tab that was tapped — set while rendering, not
  // after, so the first frame isn't the last open's tab.
  const [lastOpenOn, setLastOpenOn] = useState(openOn);
  if (openOn !== lastOpenOn) {
    setLastOpenOn(openOn);
    if (openOn) setTab(openOn);
  }

  const likes = useGetLikeUsersQuery(postId, { skip: !visible || !postId });
  // What this session knows over the fetched list, so an unlike here takes
  // you off it straight away.
  const known = useLikeState(postId);
  const fetchedIds = known?.users ?? likes.data?.users ?? [];
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  // Having liked it (and not being its owner, who can't), your own row leads
  // the list and carries the Unlike — added if the list hasn't caught up yet.
  const canUnlike = like.liked && !like.mine && !!myId;
  const likerIds = canUnlike
    ? [myId!, ...fetchedIds.filter((id) => id !== myId)]
    : fetchedIds;
  const { rows: commentRows } = useCommentThread(entryType, postId, { skip: !visible });
  const { openUser, stacked } = useStackedUserSummary(visible);

  const tabs = [
    { key: 'likes' as const, label: 'Likes', Icon: Heart, count: like.count },
    { key: 'comments' as const, label: 'Comments', Icon: MessageCircle, count: commentRows.length },
  ];

  const confirmUnlike = () => Alert.alert('Unlike this post?', undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Unlike', style: 'destructive', onPress: () => { if (like.liked) like.toggle(); } },
  ]);

  const likesBody = () => (
    <>
      {likes.isLoading && !likerIds.length ? (
        <ActivityIndicator color={colors.grey} style={styles.loader} />
      ) : !likerIds.length ? (
        <PanelEmpty>No likes yet</PanelEmpty>
      ) : (
        likerIds.map((id, i) => (
          <LikerRow
            key={id}
            userId={id}
            onOpen={openUser}
            last={i === likerIds.length - 1}
            rule={false}
            dense
            trailing={canUnlike && id === myId ? (
              <TouchableOpacity
                style={styles.unlikeBtn}
                onPress={confirmUnlike}
                activeOpacity={0.85}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Unlike"
              >
                <Text style={styles.unlikeText}>Unlike</Text>
              </TouchableOpacity>
            ) : null}
          />
        ))
      )}
    </>
  );

  return (
    <SummaryModal
      visible={visible}
      onClose={onClose}
      origin={origin}
      // Tall from the start, so stepping between the tabs doesn't make the
      // panel jump.
      minHeightRatio={0.6}
      stacked={stacked}
    >
      <PanelTabs tabs={tabs} value={tab} onChange={setTab} iconOnly />
      <View style={[styles.body, tab === 'comments' && styles.bodyComments]}>
        {tab === 'likes' ? likesBody() : (
          // No heading — the tab says "Comments" and how many — and no
          // ground of its own behind the thread or the composer.
          <InlineComments documentId={postId} entryType={entryType} variant="panel" title="" backgroundColor="transparent" pinComposer />
        )}
      </View>
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  body:     { paddingHorizontal: 16, paddingBottom: 8 },
  // More room between the tabs and the first comment.
  bodyComments: { paddingTop: 12 },
  loader:   { marginTop: 30 },
  // The summaries' secondary-button grey (SummaryUserRow's View).
  unlikeBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: COMMON_RADIUS, backgroundColor: COLOR_GRAY_42,
  },
  unlikeText: { fontSize: 12, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
});

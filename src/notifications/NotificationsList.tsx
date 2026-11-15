import React, { useCallback } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Text } from '../theme/Text';
import { formatDistanceToNowStrict } from 'date-fns';
import Avatar from '../components/Avatar';
import { EmptyState, Spinner } from '../components/Spinner';
import { useColors, useBrandColor } from '../theme/useColors';
import {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  type OrsNotification,
} from './api';
import { FONT_INTER } from '../theme/fonts';

/**
 * This app's notifications, newest first.
 *
 * Deliberately simpler than alfa's list — no group requests to approve, no
 * transfers to accept — because the photo and spotting apps only ever notify
 * about votes, comments, follows and friends' results. Tapping a row marks it
 * read and hands it to `onOpen`, which knows this app's screens.
 */
export default function NotificationsList({
  onOpen, contentPaddingBottom = 24, showMarkAll = true, onContentHeight,
}: {
  onOpen: (n: OrsNotification) => void;
  contentPaddingBottom?: number;
  /** Off where the host puts MarkAllReadButton in its own header. */
  showMarkAll?: boolean;
  /**
   * Reports the rows' total height, for a host that sizes itself to fit (the
   * bell's panel). The list then stops stretching to fill its frame — a list
   * that fills whatever it's given can only ever report that it's as tall as
   * the frame, and the panel would never shrink.
   */
  onContentHeight?: (h: number) => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const { data, isLoading, isFetching, refetch } = useGetNotificationsQuery({ limit: 50 });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();

  const rows = data?.notifications ?? [];
  const anyUnread = rows.some((n) => !n.read_status);

  const open = useCallback((n: OrsNotification) => {
    if (!n.read_status) markRead(n.internal_id);
    onOpen(n);
  }, [markRead, onOpen]);

  if (isLoading) return <Spinner fullScreen={!onContentHeight} />;

  return (
    <FlatList
      data={rows}
      keyExtractor={(n) => n.internal_id}
      contentContainerStyle={{ paddingBottom: contentPaddingBottom, flexGrow: onContentHeight ? 0 : 1 }}
      onContentSizeChange={onContentHeight ? (_w, h) => onContentHeight(h) : undefined}
      refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={brand} />}
      ListHeaderComponent={showMarkAll && anyUnread ? (
        <TouchableOpacity
          style={styles.markAll}
          onPress={() => markAll()}
          disabled={markingAll}
          activeOpacity={0.7}
        >
          <Text style={[styles.markAllText, { color: brand }]}>Mark all read</Text>
        </TouchableOpacity>
      ) : null}
      ListEmptyComponent={
        // EmptyState fills its parent, and a list sized to its rows has no
        // height to give it — so it gets a floor of its own there.
        <View style={onContentHeight ? styles.emptyFit : styles.emptyFill}>
          <EmptyState title="No notifications yet" message="Votes, comments, follows and friends' results show up here." />
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.row, { borderBottomColor: colors.border }, !item.read_status && { backgroundColor: 'rgba(255,255,255,0.03)' }]}
          onPress={() => open(item)}
          activeOpacity={0.75}
        >
          <Avatar user={item.sender ?? null} size={40} />
          <View style={styles.copy}>
            <Text style={[styles.message, { color: colors.fg }]} numberOfLines={3}>{item.message}</Text>
            {item.createdAt ? (
              <Text style={[styles.time, { color: colors.grey }]}>
                {formatDistanceToNowStrict(new Date(item.createdAt), { addSuffix: true })}
              </Text>
            ) : null}
          </View>
          {!item.read_status && <View style={[styles.dot, { backgroundColor: brand }]} />}
        </TouchableOpacity>
      )}
    />
  );
}

/**
 * "Mark all read", for a header that isn't the list's own — the bell's panel
 * puts it opposite its close button. Renders nothing when all is read.
 */
export function MarkAllReadButton({ color }: { color?: string }) {
  const brand = useBrandColor();
  const { data } = useGetNotificationsQuery({ limit: 50 });
  const [markAll, { isLoading }] = useMarkAllNotificationsReadMutation();
  if (!(data?.notifications ?? []).some((n) => !n.read_status)) return <View />;
  return (
    <TouchableOpacity onPress={() => markAll()} disabled={isLoading} hitSlop={10} activeOpacity={0.7}>
      <Text style={[styles.markAllText, { color: color ?? brand }]}>Mark all read</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  markAll: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 10 },
  markAllText: { fontSize: 13, fontFamily: FONT_INTER.extrabold },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  copy: { flex: 1, minWidth: 0 },
  message: { fontSize: 14, fontFamily: FONT_INTER.semibold, lineHeight: 19 },
  time: { fontSize: 12, marginTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  emptyFill: { flex: 1 },
  emptyFit: { minHeight: 180 },
});

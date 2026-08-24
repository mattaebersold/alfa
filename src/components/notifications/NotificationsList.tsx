import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator,
  Animated, Easing,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Trash2, Check, X } from 'lucide-react-native';
import {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useDeleteAllNotificationsMutation,
  useDeleteNotificationMutation,
  useApproveGroupMemberMutation,
  useRejectGroupMemberMutation,
  useAcceptGroupInviteMutation,
  useDeclineGroupInviteMutation,
} from '../../api/apiService';
import Avatar from '../ui/Avatar';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { useRefreshControl } from '../../hooks/useRefreshControl';
import { notificationTarget } from '../../utils/notificationTarget';
import type { Notification } from '../../types/api';
import type { AppStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

// Map a notification's referenced content to a navigation target. The mapping
// itself lives in utils/notificationTarget so a tapped push lands in the same
// place as a tapped row.
const targetForNotification = (n: Notification) => notificationTarget({
  type: n.type,
  content_type: n.content_type,
  content_id: n.content_id,
  senderUserId: n.sender?.user_id,
});

/**
 * A pending decision on a row, and what the two answers are called.
 *
 * Join requests and invitations are the same interaction pointing in opposite
 * directions — someone asks, you answer, the row settles into a record of what
 * you chose. Only the wording and the endpoints differ, so they share
 * everything else.
 */
type Resolution = 'approved' | 'denied' | 'accepted' | 'declined';

interface DecisionCopy {
  yes: string;
  no: string;
  yesResolution: Resolution;
  noResolution: Resolution;
  settled: Record<string, string>;
}

const JOIN_REQUEST: DecisionCopy = {
  yes: 'Approve', no: 'Deny',
  yesResolution: 'approved', noResolution: 'denied',
  settled: { approved: 'Request approved', denied: 'Request denied' },
};

const INVITATION: DecisionCopy = {
  yes: 'Join', no: 'Decline',
  yesResolution: 'accepted', noResolution: 'declined',
  settled: { accepted: 'Invitation accepted', declined: 'Invitation declined' },
};

/** The group and member a join request refers to, or a failure the admin can read. */
const joinRequestIds = (n: Notification) => {
  const groupId = n.content_id;
  const userId = n.sender?.user_id;
  if (!groupId || !userId) {
    throw new Error("This request doesn't say which group or member it's for, so it can't be handled from here.");
  }
  return { groupId, userId };
};

/** The group an invitation is for, or a failure the member can read. */
const invitationGroupId = (n: Notification) => {
  const groupId = n.content_id ?? (n.metadata?.group_id as string | undefined);
  if (!groupId) {
    throw new Error("This invitation doesn't say which group it's for, so it can't be answered from here.");
  }
  return groupId;
};

function NotificationRow({
  notification,
  onRead,
  onDelete,
  onApprove,
  onDeny,
}: {
  notification: Notification;
  onRead: () => void;
  onDelete: () => void;
  onApprove: () => Promise<void>;
  onDeny: () => Promise<void>;
}) {
  const decision =
    notification.type === 'group_join_request' ? JOIN_REQUEST
    : notification.type === 'group_invitation' ? INVITATION
    : null;
  const colors = useColors();

  // Which button is mid-flight, and how the request ended up. The outcome is
  // held locally so the row settles the instant the call returns, but the
  // server's own stamp wins on a later launch — otherwise the buttons would
  // come back for a decision that's already been made.
  const [busy, setBusy] = useState<Resolution | null>(null);
  const [localResolution, setLocalResolution] = useState<Resolution | null>(null);
  const resolution = localResolution ?? notification.metadata?.resolution ?? null;

  const resolve = async (outcome: Resolution) => {
    if (busy || resolution) return;
    setBusy(outcome);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await (outcome === decision?.yesResolution ? onApprove() : onDeny());
      setLocalResolution(outcome);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      // Silence here was the old behaviour: a rejected call looked exactly like
      // a successful one, so a request that failed looked handled.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        `Couldn't ${(outcome === decision?.yesResolution ? decision?.yes : decision?.no)?.toLowerCase() ?? 'do that'}`,
        err?.data?.error ?? err?.message ?? 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(null);
    }
  };

  const timeAgo = notification.createdAt
    ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })
    : '';

  const isUnread = !notification.read_status;
  const username = notification.sender?.username ?? null;
  const senderName = username
    ? `@${username}`
    : [notification.sender?.firstName, notification.sender?.lastName].filter(Boolean).join(' ') || null;

  return (
    <TouchableOpacity
      style={[styles.card, isUnread ? styles.cardUnread : styles.cardRead]}
      onPress={onRead}
      activeOpacity={0.8}
    >
      <Avatar
        filename={notification.sender?.gallery?.[0]?.filename}
        name={username ?? '?'}
        size={38}
      />
      <View style={styles.rowContent}>
        <Text
          style={[styles.message, isUnread ? styles.messageUnread : styles.messageRead]}
          numberOfLines={3}
        >
          {senderName ? <Text style={styles.senderName}>{senderName} </Text> : null}
          {notification.message}
        </Text>
        <Text style={styles.time}>{timeAgo}</Text>
        {decision && (resolution ? (
          // Settled: the row says what happened instead of offering the choice
          // again. Muted, because it's a record rather than something to press.
          <View style={styles.resolvedChip}>
            {resolution === decision.yesResolution
              ? <Check size={13} color="#4CAF50" strokeWidth={3} />
              : <X size={13} color={colors.grey} strokeWidth={3} />}
            <Text style={[styles.resolvedText, {
              color: resolution === decision.yesResolution ? '#4CAF50' : colors.grey,
            }]}>
              {decision.settled[resolution] ?? ''}
            </Text>
          </View>
        ) : (
          <View style={styles.joinReqActions}>
            <TouchableOpacity
              style={[styles.approveBtn, busy && styles.btnDisabled]}
              onPress={() => resolve(decision.yesResolution)}
              disabled={!!busy}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!busy, busy: busy === decision.yesResolution }}
            >
              {/* The label stays in place and turns invisible under the
                  spinner, so the button doesn't resize mid-press. */}
              <Text style={[styles.approveText, busy === decision.yesResolution && styles.labelHidden]}>
                {decision.yes}
              </Text>
              {busy === decision.yesResolution && (
                <ActivityIndicator size="small" color="#000000" style={StyleSheet.absoluteFill} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.denyBtn, busy && styles.btnDisabled]}
              onPress={() => resolve(decision.noResolution)}
              disabled={!!busy}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!busy, busy: busy === decision.noResolution }}
            >
              <Text style={[styles.denyText, busy === decision.noResolution && styles.labelHidden]}>
                {decision.no}
              </Text>
              {busy === decision.noResolution && (
                <ActivityIndicator size="small" color="#ECECEC" style={StyleSheet.absoluteFill} />
              )}
            </TouchableOpacity>
          </View>
        ))}
      </View>
      {/* Delete is the only per-row action left. At #666 it read as disabled,
          which for the one control on the row is the wrong impression.
          It doesn't ask first: what it destroys is a note saying something
          happened, not the thing that happened. */}
      <View style={styles.rowActions}>
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Delete notification"
        >
          <Trash2 size={18} color="#B8B8B8" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

/**
 * "Delete all", as a small button.
 *
 * Exported because it has two homes: the full-screen route puts it above the
 * list, and the panel puts it up in its own header beside the close button.
 *
 * It archived rather than deleted until now, which left a pile behind that only
 * ever grew — "clear these out" should clear them out. This one keeps its
 * confirmation even though a single delete no longer has one: the scope is
 * every notification you have, and there is no undo.
 */
export function DeleteAllButton() {
  const [deleteAll] = useDeleteAllNotificationsMutation();

  const confirm = () => {
    Alert.alert('Delete all notifications?', "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete All', style: 'destructive', onPress: () => deleteAll() },
    ]);
  };

  return (
    <TouchableOpacity
      style={styles.deleteAllBtn}
      onPress={confirm}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel="Delete all notifications"
    >
      <Trash2 size={12} color={colors.red} strokeWidth={2.4} />
      <Text style={styles.deleteAllText}>Delete all</Text>
    </TouchableOpacity>
  );
}

/**
 * Close the surface this list is in, and — if the tap was on a notification —
 * go where it points. The navigation is passed rather than performed so the
 * host can order the two.
 */
export type DismissHandler = (navigateAfter?: () => void) => void;

/** Rows land one after another rather than all at once. */
const ROW_STAGGER_MS = 50;
/**
 * Waits for the panel to have most of its size before the first row lands.
 * Tuned against NotificationsBell's opening spring — the rows should start
 * arriving as it settles, not while the box is still visibly moving.
 */
const ROW_STAGGER_DELAY_MS = 240;
/** Roughly a screenful — rows past this arrive without ceremony. */
const MAX_STAGGERED_ROWS = 9;

/**
 * One row's entrance: up and in, on its own beat.
 *
 * Only the panel asks for this. Opening the full-screen route doesn't need
 * choreography — the list is simply there — but the panel grows out of a 44pt
 * button, and rows that snap in fully formed the moment it stops make the box
 * look like it was hiding them rather than filling with them.
 */
function RowReveal({
  index, enabled, children,
}: {
  index: number;
  enabled: boolean;
  children: React.ReactNode;
}) {
  // Only the opening screenful is choreographed. Past that a row is one the
  // list recycles in as you scroll, and holding it invisible for its turn in a
  // sequence that finished long ago would just look like a row failing to draw.
  const animates = enabled && index <= MAX_STAGGERED_ROWS;
  const progress = useRef(new Animated.Value(animates ? 0 : 1)).current;

  useEffect(() => {
    if (!animates) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      delay: ROW_STAGGER_DELAY_MS + index * ROW_STAGGER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // Deliberately mount-only: a row that has arrived shouldn't replay its
    // entrance when the list re-renders around it.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!animates) return <>{children}</>;

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{
          translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }),
        }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * The notifications list — toolbar and rows, with no chrome of its own.
 *
 * Lives apart from the screen because it now has two homes: the full-screen
 * modal route, and the panel the header's bell expands into. Both need the same
 * list; only what "close this" means differs, which is `onDismiss`.
 */
export default function NotificationsList({
  onDismiss,
  /** Stagger the rows in on mount — see RowReveal. */
  revealStagger = false,
  /**
   * Render "Delete all" above the list. Off where the host already has a
   * header to put it in — the panel does.
   */
  showDeleteAll = true,
}: {
  onDismiss: DismissHandler;
  revealStagger?: boolean;
  showDeleteAll?: boolean;
}) {
  const colors = useColors();
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, refetch } = useGetNotificationsQuery({ limit: 50 });
  const refreshControl = useRefreshControl(refetch);
  const [markRead] = useMarkNotificationReadMutation();

  // Tapping a notification: mark read, then hand the host both the "close" and
  // where to go. The host decides when to run the second — iOS won't present a
  // screen while a modal is still on its way out, so the panel version waits
  // for its own animation before navigating.
  const handlePress = useCallback((n: Notification) => {
    if (!n.read_status) markRead(n.internal_id);
    const target = targetForNotification(n);
    onDismiss(target ? () => navigation.navigate(target.name as any, target.params) : undefined);
  }, [markRead, navigation, onDismiss]);
  const [deleteNotif] = useDeleteNotificationMutation();
  const [approveMember] = useApproveGroupMemberMutation();
  const [rejectMember] = useRejectGroupMemberMutation();
  const [acceptInvite] = useAcceptGroupInviteMutation();
  const [declineInvite] = useDeclineGroupInviteMutation();

  /**
   * Approve / deny a group join request straight from the notification.
   *
   * These throw rather than swallow: the row awaits them to decide between
   * showing a settled request and putting the buttons back with an alert, and a
   * request missing the ids it needs is a failure the admin should see, not a
   * press that quietly does nothing.
   */
  const handleApprove = useCallback(async (n: Notification) => {
    if (n.type === 'group_invitation') {
      // An invitation's "yes" is a join — the server takes an invited member
      // straight to active.
      await acceptInvite(invitationGroupId(n)).unwrap();
    } else {
      await approveMember(joinRequestIds(n)).unwrap();
    }
    markRead(n.internal_id);
  }, [approveMember, acceptInvite, markRead]);

  const handleDeny = useCallback(async (n: Notification) => {
    if (n.type === 'group_invitation') {
      await declineInvite(invitationGroupId(n)).unwrap();
    } else {
      await rejectMember(joinRequestIds(n)).unwrap();
    }
    markRead(n.internal_id);
  }, [rejectMember, declineInvite, markRead]);

  const notifications = data?.notifications ?? [];

  if (isLoading) return <Spinner fullScreen />;

  return (
    <View style={ss.fill}>
      {/* Reading a notification is what marks it read; a button that silently
          cleared every highlight at once only ever cost you the list of what
          you hadn't seen. Clearing them out wholesale is still here. */}
      {showDeleteAll && notifications.length > 0 && (
        <View style={styles.deleteAllRow}>
          <DeleteAllButton />
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.internal_id}
        renderItem={({ item, index }) => (
          <RowReveal index={index} enabled={revealStagger}>
            <NotificationRow
              notification={item}
              onRead={() => handlePress(item)}
              onDelete={() => deleteNotif(item.internal_id)}
              onApprove={() => handleApprove(item)}
              onDeny={() => handleDeny(item)}
            />
          </RowReveal>
        )}
        ListEmptyComponent={
          <EmptyState title="No notifications" message="You're all caught up." />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={refreshControl}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  deleteAllRow: { alignItems: 'flex-end', paddingHorizontal: 18, paddingTop: 6 },
  deleteAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1, borderColor: 'rgba(236,70,50,0.45)',
  },
  deleteAllText: { fontSize: 12, fontWeight: '700', color: colors.red },
  list:        { flexGrow: 1, paddingTop: 8, paddingBottom: 24 },

  /**
   * Each notification is its own card.
   *
   * Full-bleed rows divided by hairlines made the list read as one long
   * surface that happened to have lines drawn across it — you had to work out
   * where one notification ended. Inset cards make each one an object, which
   * is what it is: a separate thing that arrived, and that you can delete on
   * its own.
   */
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    marginHorizontal: 12, marginVertical: 5,
    borderRadius: 14,
    // Clips the unread bar to the card's own corners.
    overflow: 'hidden',
  },
  cardRead:   { backgroundColor: '#141414', borderColor: 'rgba(255,255,255,0.07)' },
  // Unread is the brand's own colour laid over black rather than a step up the
  // greyscale. A card you haven't seen should be a different kind of card, not
  // a slightly paler one — at #1c1c1c against #000 the difference was
  // invisible on anything but a good screen at full brightness.
  cardUnread: {
    backgroundColor: 'rgba(234, 215, 183, 0.22)',
  },

  rowContent:  { flex: 1 },
  message:     { fontSize: 13, lineHeight: 18 },
  messageUnread: { color: '#FFFFFF', fontWeight: '600' },
  // Read rows step back rather than sit at full white — with the unread ones
  // now carrying colour, this is what makes the list scannable.
  messageRead:   { color: 'rgba(255,255,255,0.68)' },
  senderName:  { fontWeight: '800' },
  time:        { fontSize: 11, marginTop: 3, color: '#888' },
  rowActions:  { flexDirection: 'row', gap: 12, paddingTop: 2 },
  joinReqActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  approveBtn:  { backgroundColor: 'rgb(37, 162, 211)', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7, justifyContent: 'center' },
  approveText: { color: '#000000', fontSize: 13, fontWeight: '800' },
  denyBtn:     { backgroundColor: '#2A2A2A', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7, justifyContent: 'center' },
  denyText:    { color: '#ECECEC', fontSize: 13, fontWeight: '700' },
  btnDisabled: { opacity: 0.55 },
  labelHidden: { opacity: 0 },
  resolvedChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  resolvedText: { fontSize: 13, fontWeight: '700' },
});

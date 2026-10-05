import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Animated, Easing,
} from 'react-native';
import { Text } from '@ors/kit';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Trash2, Check, X } from 'lucide-react-native';
import {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useDeleteReadNotificationsMutation,
  useDeleteNotificationMutation,
  useApproveGroupMemberMutation,
  useRejectGroupMemberMutation,
  useAcceptGroupInviteMutation,
  useAcceptCarTransferMutation,
  useDeclineCarTransferMutation,
  useDeclineGroupInviteMutation,
} from '../../api/apiService';
import Avatar from '../ui/Avatar';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import Segmented from '../ui/Segmented';
import { useRefreshControl } from '../../hooks/useRefreshControl';
import { notificationTarget } from '../../utils/notificationTarget';
import type { Notification } from '../../types/api';
import type { AppStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';
import {
  COMMON_RADIUS,
  COLOR_BLACK,
  COLOR_GRAY_136,
  COLOR_GRAY_184,
  COLOR_GRAY_20,
  COLOR_GRAY_236,
  COLOR_GRAY_42,
  COLOR_SUCCESS,
  COLOR_WHITE, COLOR_RED } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

// Map a notification's referenced content to a navigation target. The mapping
// itself lives in utils/notificationTarget so a tapped push lands in the same
// place as a tapped row.
const targetForNotification = (n: Notification) => notificationTarget({
  type: n.type,
  content_type: n.content_type,
  content_id: n.content_id,
  senderUserId: n.sender?.user_id,
  metadata: n.metadata,
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

/** How many notifications show at first, and how many each "more" adds. */
const NOTIFICATIONS_PAGE = 5;

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

const CAR_TRANSFER: DecisionCopy = {
  yes: 'Accept', no: 'Decline',
  yesResolution: 'accepted', noResolution: 'declined',
  settled: {
    accepted: 'Car accepted',
    declined: 'Transfer declined',
    // The owner can call the offer off from their end — see declineCarTransfer.
    cancelled: 'Transfer cancelled',
  },
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

/** The car a transfer offer is for, or a failure the member can read. */
const transferCarId = (n: Notification) => {
  const carId = n.content_id ?? (n.metadata?.car_id as string | undefined);
  if (!carId) {
    throw new Error("This transfer doesn't say which car it's for, so it can't be answered from here.");
  }
  return carId;
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
  onMessageAdmin,
}: {
  notification: Notification;
  onRead: () => void;
  onDelete: () => void;
  onApprove: () => Promise<void>;
  onDeny: () => Promise<void>;
  /** Only passed for a refused join request that says who refused it. */
  onMessageAdmin?: () => void;
}) {
  const decision =
    notification.type === 'group_join_request' ? JOIN_REQUEST
    : notification.type === 'group_invitation' ? INVITATION
    : notification.type === 'car_transfer' ? CAR_TRANSFER
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
  // The server's line starts with the sender's name ("bucky737 liked your
  // post"); the row leads with @name already, so the second copy comes off.
  const message = username && notification.message?.toLowerCase().startsWith(username.toLowerCase())
    ? notification.message.slice(username.length).replace(/^[\s:,–—-]+/, '')
    : notification.message;
  // "liked your post: Caught a Ferrari" — the action, and the thing it was
  // done to, which the server joins with a colon. Drawn as two kinds of text
  // rather than one run, so who / what / which can be told apart at a glance.
  const colon = message ? message.indexOf(': ') : -1;
  const action = colon > 0 ? message.slice(0, colon) : message;
  const subject = colon > 0 ? message.slice(colon + 2) : null;

  return (
    <TouchableOpacity
      style={[styles.card, styles.cardRead]}
      onPress={onRead}
      activeOpacity={0.8}
    >
      {/* Unread: a red dot by the avatar — a mark on the card, not a
          different card. */}
      {isUnread && <View style={styles.unreadDot} />}
      <Avatar
        user={notification.sender}
        size={38}
      />
      <View style={styles.rowContent}>
        <Text style={[styles.message, isUnread ? styles.messageUnread : styles.messageRead]} numberOfLines={2}>
          {senderName ? <Text style={[styles.senderName, { color: colors.fg }]}>{senderName} </Text> : null}
          <Text style={styles.action}>{action}</Text>
        </Text>
        {subject ? (
          <Text style={[styles.subject, { color: isUnread ? colors.fg : 'rgba(255,255,255,0.78)' }]} numberOfLines={2}>
            {subject}
          </Text>
        ) : null}
        <Text style={styles.time}>{timeAgo}</Text>
        {decision && (resolution ? (
          // Settled: the row says what happened instead of offering the choice
          // again. Muted, because it's a record rather than something to press.
          <View style={styles.resolvedChip}>
            {resolution === decision.yesResolution
              ? <Check size={13} color={COLOR_SUCCESS} strokeWidth={3} />
              : <X size={13} color={colors.grey} strokeWidth={3} />}
            <Text style={[styles.resolvedText, {
              color: resolution === decision.yesResolution ? COLOR_SUCCESS : colors.grey,
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
                <ActivityIndicator size="small" color={COLOR_BLACK} style={StyleSheet.absoluteFill} />
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
                <ActivityIndicator size="small" color={COLOR_GRAY_236} style={StyleSheet.absoluteFill} />
              )}
            </TouchableOpacity>
          </View>
        ))}
        {/* A refusal has nothing to decide, but it usually leaves a question —
            why, or what would change the answer — and the admin is the one
            person who can say. Same button shape as the decisions above so the
            row reads as something you can act on, not just a record. */}
        {onMessageAdmin && (
          <View style={styles.joinReqActions}>
            <TouchableOpacity
              style={styles.approveBtn}
              onPress={onMessageAdmin}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Message the group admin"
            >
              <Text style={styles.approveText}>Message admin</Text>
            </TouchableOpacity>
          </View>
        )}
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
          <Trash2 size={18} color={COLOR_GRAY_184} />
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
export function DeleteAllButton({
  /**
   * Ink for the icon, label and outline. Red by default; the panel passes
   * white so it sits quietly beside the close button.
   */
  color = colors.red,
}: { color?: string } = {}) {
  const [deleteRead] = useDeleteReadNotificationsMutation();

  // Only what's been read goes — and it goes from the database, not into a
  // soft-deleted pile. Unread stays whatever tab this is pressed from.
  const confirm = () => {
    Alert.alert('Delete all archived notifications?', "They're removed for good. Unread ones stay.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete All', style: 'destructive', onPress: () => deleteRead() },
    ]);
  };

  return (
    <TouchableOpacity
      // The outline is the ink at a little under half strength.
      style={[styles.deleteAllBtn, { borderColor: `${color}73` }]}
      onPress={confirm}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel="Delete all archived notifications"
    >
      <Trash2 size={12} color={color} strokeWidth={2.4} />
      <Text style={[styles.deleteAllText, { color }]}>Delete all</Text>
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
const ROW_STAGGER_DELAY_MS = 360;
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
   * The rows' natural height, for a host that sizes itself to the list rather
   * than giving it a fixed frame — the panel does. Passing it also stops the
   * rows stretching to fill the frame, which would otherwise feed the frame's
   * own height back in as the content's.
   */
  onContentHeight,
}: {
  onDismiss: DismissHandler;
  revealStagger?: boolean;
  onContentHeight?: (height: number) => void;
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
  const [acceptCarTransfer] = useAcceptCarTransferMutation();
  const [declineCarTransfer] = useDeclineCarTransferMutation();
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
    if (n.type === 'car_transfer') {
      await acceptCarTransfer({ internal_id: transferCarId(n) }).unwrap();
    } else if (n.type === 'group_invitation') {
      // An invitation's "yes" is a join — the server takes an invited member
      // straight to active.
      await acceptInvite(invitationGroupId(n)).unwrap();
    } else {
      await approveMember(joinRequestIds(n)).unwrap();
    }
    markRead(n.internal_id);
  }, [approveMember, acceptInvite, acceptCarTransfer, markRead]);

  const handleDeny = useCallback(async (n: Notification) => {
    if (n.type === 'car_transfer') {
      await declineCarTransfer({ internal_id: transferCarId(n) }).unwrap();
    } else if (n.type === 'group_invitation') {
      await declineInvite(invitationGroupId(n)).unwrap();
    } else {
      await rejectMember(joinRequestIds(n)).unwrap();
    }
    markRead(n.internal_id);
  }, [rejectMember, declineInvite, declineCarTransfer, markRead]);

  /**
   * Who to write to about a refused join request, if the notification says.
   *
   * The metadata is the server's explicit answer; the populated sender is the
   * same person and covers a row whose metadata is missing the id.
   */
  const refusingAdmin = (n: Notification) => {
    if (n.type !== 'group_join_denied') return null;
    const userId = n.metadata?.admin_user_id ?? n.sender?.user_id;
    if (!userId) return null;
    return { userId, username: n.metadata?.admin_username ?? n.sender?.username };
  };

  /**
   * "Message admin": read, close, then compose. Same order as a row tap — the
   * host closes its surface before the navigation runs (see handlePress).
   * ComposeMessage picks up an existing thread with the admin if there is one.
   */
  const handleMessageAdmin = useCallback((n: Notification, admin: { userId: string; username?: string }) => {
    if (!n.read_status) markRead(n.internal_id);
    onDismiss(() => navigation.navigate('ComposeMessage', {
      userId: admin.userId,
      username: admin.username,
    }));
  }, [markRead, navigation, onDismiss]);

  const all = data?.notifications ?? [];
  /**
   * Two tabs: what you haven't seen, and what you have.
   *
   * "Unread" is decided when the list opens: whatever was unread then stays
   * on the tab while it's open, even once tapped and read — a row shouldn't
   * vanish under the finger that read it. Next time the list opens it's in
   * Archived. Anything new that arrives while it's open joins Unread.
   */
  const [tab, setTab] = useState<'unread' | 'archived'>('unread');
  const openedUnread = useRef<Set<string>>(new Set());
  all.forEach((n) => { if (!n.read_status) openedUnread.current.add(n.internal_id); });
  const unread = all.filter((n) => openedUnread.current.has(n.internal_id));
  const archived = all.filter((n) => !openedUnread.current.has(n.internal_id));
  const onTab = tab === 'unread' ? unread : archived;
  /**
   * The newest few, then more on request. Fifty rows with their stagger and
   * their avatars made the panel stutter as it opened; five is what fits in
   * view, and a button under them is the rest. Back to five on a tab change.
   */
  const [shown, setShown] = useState(NOTIFICATIONS_PAGE);
  const notifications = onTab.slice(0, shown);
  const remaining = onTab.length - notifications.length;

  if (isLoading) return <Spinner fullScreen />;

  return (
    <View style={ss.fill}>
      {/* Unread or Archived — the post form's track, two across. Reading a
          notification is what archives it; clearing the archive is the one
          bulk action, and it lives on that tab. */}
      <View style={styles.tabs}>
        <Segmented
          options={[
            { key: 'unread', label: unread.length ? `Unread (${unread.length})` : 'Unread' },
            { key: 'archived', label: archived.length ? `Archived (${archived.length})` : 'Archived' },
          ]}
          value={tab}
          onChange={(t) => { setTab(t); setShown(NOTIFICATIONS_PAGE); }}
        />
      </View>
      {tab === 'archived' && archived.length > 0 && (
        <View style={styles.deleteAllRow}>
          <DeleteAllButton />
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.internal_id}
        renderItem={({ item, index }) => {
          const admin = refusingAdmin(item);
          return (
            <RowReveal index={index} enabled={revealStagger}>
              <NotificationRow
                notification={item}
                onRead={() => handlePress(item)}
                onDelete={() => deleteNotif(item.internal_id)}
                onApprove={() => handleApprove(item)}
                onDeny={() => handleDeny(item)}
                onMessageAdmin={admin ? () => handleMessageAdmin(item, admin) : undefined}
              />
            </RowReveal>
          );
        }}
        ListEmptyComponent={
          tab === 'unread'
            ? <EmptyState title="Nothing unread" message="You're all caught up." />
            : <EmptyState title="Nothing archived" message="Notifications you've read will be kept here." />
        }
        ListFooterComponent={remaining > 0 ? (
          <TouchableOpacity
            style={[styles.moreBtn, { borderColor: colors.borderDark }]}
            onPress={() => setShown((n) => n + NOTIFICATIONS_PAGE)}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={[styles.moreText, { color: colors.fg }]}>
              Show {Math.min(remaining, NOTIFICATIONS_PAGE)} more{remaining > NOTIFICATIONS_PAGE ? ` of ${remaining}` : ''}
            </Text>
          </TouchableOpacity>
        ) : null}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={onContentHeight ? styles.listFit : styles.list}
        onContentSizeChange={onContentHeight ? (_w, h) => onContentHeight(h) : undefined}
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
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  deleteAllText: { fontSize: 12, fontFamily: FONT_INTER.bold },
  list:        { flexGrow: 1, paddingTop: 8, paddingBottom: 24 },
  listFit:     { paddingTop: 8, paddingBottom: 16 },

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
    borderRadius: COMMON_RADIUS,
    // Clips the unread bar to the card's own corners.
    overflow: 'hidden',
  },
  cardRead:   { backgroundColor: COLOR_GRAY_20, borderColor: 'rgba(255,255,255,0.07)' },
  // Unread is marked, not recoloured: a red dot in the card's corner by the
  // avatar. The words stay heavier too (messageUnread).
  unreadDot: {
    position: 'absolute', top: 10, left: 8,
    width: 8, height: 8, borderRadius: 4, backgroundColor: COLOR_RED,
  },
  tabs:    { paddingTop: 4, paddingBottom: 6 },
  moreBtn: {
    marginHorizontal: 12, marginTop: 6, height: 40,
    borderRadius: COMMON_RADIUS, borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
  },
  moreText: { fontSize: 13, fontFamily: FONT_INTER.bold },

  rowContent:  { flex: 1 },
  message:     { fontSize: 13, lineHeight: 18 },
  // The action's ink: a step back from the name either way, further on read rows.
  messageUnread: { color: 'rgba(255,255,255,0.82)' },
  messageRead:   { color: 'rgba(255,255,255,0.6)' },
  senderName:  { fontFamily: FONT_INTER.extrabold },
  action:      { fontFamily: FONT_INTER.medium },
  // What it was done to, on its own line: the title is what you scan for.
  subject:     { fontSize: 13, lineHeight: 18, fontFamily: FONT_INTER.semibold, marginTop: 1 },
  time:        { fontSize: 11, marginTop: 3, color: COLOR_GRAY_136 },
  rowActions:  { flexDirection: 'row', gap: 12, paddingTop: 2 },
  joinReqActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  approveBtn:  { backgroundColor: 'rgb(37, 162, 211)', borderRadius: COMMON_RADIUS, paddingHorizontal: 16, paddingVertical: 7, justifyContent: 'center' },
  approveText: { color: COLOR_BLACK, fontSize: 13, fontFamily: FONT_INTER.extrabold },
  denyBtn:     { backgroundColor: COLOR_GRAY_42, borderRadius: COMMON_RADIUS, paddingHorizontal: 16, paddingVertical: 7, justifyContent: 'center' },
  denyText:    { color: COLOR_GRAY_236, fontSize: 13, fontFamily: FONT_INTER.bold },
  btnDisabled: { opacity: 0.55 },
  labelHidden: { opacity: 0 },
  resolvedChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  resolvedText: { fontSize: 13, fontFamily: FONT_INTER.bold },
});

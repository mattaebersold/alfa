import type { AppStackParamList } from '../navigation/types';

export interface NotificationRef {
  type?: string;
  content_type?: string | null;
  content_id?: string | null;
  /** Only the in-app list has a populated sender; a push payload does not. */
  senderUserId?: string | null;
  /**
   * The notification's own payload. A message notice carries the thread and who
   * wrote it here, which is what MessageThread needs to open without first
   * fetching the message to find out.
   */
  metadata?: Record<string, unknown> | null;
}

export type NavTarget = { name: keyof AppStackParamList; params: any };

/**
 * Where a notification points.
 *
 * Shared by the notifications list and the push-tap handler so both land on the
 * same screen — the server sends `content_type`/`content_id` in the push payload
 * precisely so a tap doesn't have to dump you on a list and make you find the
 * thing yourself.
 */
export function notificationTarget(n: NotificationRef): NavTarget | null {
  const id = n.content_id;
  // A message points at a conversation, not at a record — and it's the only
  // kind whose target needs a second id, since the thread alone doesn't say who
  // you're talking to.
  if (n.type === 'message' || n.content_type === 'message') {
    const threadId = id ?? (n.metadata?.thread_id as string | undefined);
    if (!threadId) return null;
    return {
      name: 'MessageThread',
      params: {
        threadId,
        recipientId: n.senderUserId ?? (n.metadata?.sender_id as string | undefined),
      },
    };
  }
  if (n.type === 'follow') {
    const uid = n.senderUserId ?? id;
    return uid ? { name: 'UserDetail', params: { userId: uid } } : null;
  }
  switch (n.content_type) {
    case 'post':      return id ? { name: 'PostDetailModal', params: { postId: id } } : null;
    case 'garagecar': return id ? { name: 'CarDetail', params: { carId: id } } : null;
    case 'car':       return id ? { name: 'CarDetail', params: { carId: id } } : null;
    case 'user':      return id ? { name: 'UserDetail', params: { userId: id } } : null;
    case 'group':     return id ? { name: 'GroupDetail', params: { groupId: id } } : null;
    default:
      return n.senderUserId ? { name: 'UserDetail', params: { userId: n.senderUserId } } : null;
  }
}

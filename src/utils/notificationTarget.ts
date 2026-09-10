import type { AppStackParamList } from '../navigation/types';

export interface NotificationRef {
  type?: string;
  content_type?: string | null;
  content_id?: string | null;
  /** Only the in-app list has a populated sender; a push payload does not. */
  senderUserId?: string | null;
  /**
   * The notification's own payload. A message notice carries the thread and who
   * wrote it here; anything living inside a car or a group carries its parent's
   * id here too, because the content id alone can't reach those screens.
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
 *
 * ## Every content type the server can send has to appear here
 *
 * It didn't, and that was the bug behind "the content doesn't load". The table
 * handled five types; the server sends around twenty, because a like or a
 * comment files its notification under the *entry type of whatever was liked* —
 * a mod, a car photo, a group discussion post, an article, a route. Everything
 * unlisted fell through to the default branch and opened the sender's profile,
 * which looks exactly like a broken link when you tapped "someone liked your
 * post".
 *
 * The list below is derived from every `entry_type` horacio writes. When a new
 * kind of thing becomes likeable or commentable, it belongs here on the same
 * commit — the default branch is a fallback, not a home.
 */

/** Things that live on a car. Reaching them means knowing the car, not the item. */
const CAR_CHILD = new Set(['mod', 'cargallery', 'eventgallery', 'projectaddon']);

/** Group content, by the section of the group it belongs to. */
const GROUP_SECTION: Record<string, keyof AppStackParamList> = {
  group_discussion: 'GroupDiscussion',
  groupdiscussion:  'GroupDiscussion',
  group_news:       'GroupNews',
  groupnews:        'GroupNews',
  group_resource:   'GroupResources',
  groupresource:    'GroupResources',
};

export function notificationTarget(n: NotificationRef): NavTarget | null {
  const id = n.content_id;
  const meta = (n.metadata ?? {}) as Record<string, any>;
  const kind = (n.content_type ?? '').toLowerCase();

  // A message points at a conversation, not at a record — and it's the only
  // kind whose target needs a second id, since the thread alone doesn't say who
  // you're talking to.
  if (n.type === 'message' || kind === 'message') {
    const threadId = id ?? (meta.thread_id as string | undefined);
    if (!threadId) return null;
    return {
      name: 'MessageThread',
      params: { threadId, recipientId: n.senderUserId ?? (meta.sender_id as string | undefined) },
    };
  }

  if (n.type === 'follow' && kind !== 'garagecar') {
    const uid = n.senderUserId ?? id;
    return uid ? { name: 'UserDetail', params: { userId: uid } } : null;
  }

  /**
   * A mod, a car photo, an addon — the notification's id is the *item's*, and
   * no screen takes one. The car it belongs to is what can be opened, so the
   * server attaches `car_id` alongside; without it there's nowhere to go and
   * saying so beats opening the wrong car.
   */
  if (CAR_CHILD.has(kind)) {
    const carId = (meta.car_id as string | undefined) ?? undefined;
    return carId ? { name: 'CarDetail', params: { carId } } : null;
  }

  // Group content, same shape of problem: the item id can't open a screen, the
  // group id can. The section is chosen so you land where the item actually is.
  if (GROUP_SECTION[kind]) {
    const groupId = (meta.group_id as string | undefined) ?? undefined;
    if (groupId) return { name: GROUP_SECTION[kind], params: { groupId } };
    // Better the group's front page than the sender's profile.
    return id ? { name: 'GroupDetail', params: { groupId: id } } : null;
  }

  switch (kind) {
    // Every flavour of post is one record type behind one screen.
    case 'post':
    case 'note':
    case 'listing':
    case 'diecast':
      return id ? { name: 'PostDetailModal', params: { postId: id } } : null;

    case 'garagecar':
    case 'car':
      return id ? { name: 'CarDetail', params: { carId: id } } : null;

    case 'user':      return id ? { name: 'UserDetail', params: { userId: id } } : null;
    case 'group':     return id ? { name: 'GroupDetail', params: { groupId: id } } : null;
    case 'article':   return id ? { name: 'ArticleDetail', params: { articleId: id } } : null;
    case 'route':     return id ? { name: 'RouteDetailModal', params: { routeId: id } } : null;
    case 'list':      return id ? { name: 'ListDetail', params: { listId: id } } : null;
    case 'project':   return id ? { name: 'ProjectDetail', params: { projectId: id } } : null;
    case 'rally':     return id ? { name: 'RallyDetailModal', params: { rallyId: id } } : null;

    // Two records, one destination: `event` is the legacy collection and
    // `society_event` the current one, and both open the same sheet.
    case 'event':
    case 'society_event':
      return id ? { name: 'SocietyEventDetail', params: { eventId: id } } : null;

    /**
     * A photo spot lives on a map rather than on a screen of its own, so the
     * map is where a tap lands. It opens on the spot's own summary.
     */
    case 'photospot':
      return id
        ? { name: 'MainTabs', params: { screen: 'PhotographyTab', params: { spotId: id } } }
        : null;

    /**
     * A reply to a comment. The comment id opens nothing — what you want is the
     * thing being discussed, which the server attaches as the parent.
     */
    case 'comment': {
      const parentType = meta.parent_type as string | undefined;
      const parentId = meta.parent_id as string | undefined;
      if (parentType && parentId) {
        return notificationTarget({ content_type: parentType, content_id: parentId, metadata: meta });
      }
      return null;
    }

    default:
      /**
       * Unknown type. The sender's profile is a last resort and only when there
       * *is* a sender — it's the honest "something happened involving this
       * person" answer. Returning null instead leaves the tap doing nothing,
       * and the notifications list is already on screen in that case.
       */
      return n.senderUserId ? { name: 'UserDetail', params: { userId: n.senderUserId } } : null;
  }
}

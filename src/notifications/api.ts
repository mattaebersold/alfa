import { orsApi } from '../api/orsApi';
import type { User } from '../types/ors';

/**
 * One row in the notifications list.
 *
 * The server scopes the list to the app asking (the `x-ors-app` header every
 * request carries), so the photo app only ever sees photo notifications and alfa never
 * sees them at all — `app` is here for completeness, not for filtering.
 */
export interface OrsNotification {
  internal_id: string;
  recipient_id: string;
  sender_id?: string;
  type: string;
  app?: 'ors' | 'photo' | 'spot';
  content_type?: string;
  content_id?: string;
  message: string;
  read_status?: boolean;
  archived?: boolean;
  createdAt?: string;
  sender?: Pick<User, 'user_id' | 'firstName' | 'lastName' | 'username' | 'gallery' | 'avatarColor'>;
  metadata?: Record<string, any>;
}

/** How often the bell re-counts while the app is open. Pushes refresh it sooner. */
export const NOTIFICATION_POLL_INTERVAL = 30_000;

export const notificationsApi = orsApi.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<
      { notifications: OrsNotification[]; total: number },
      { limit?: number; offset?: number; unread_only?: boolean } | void
    >({
      query: (params) => ({ url: 'api/notifications', params: params ?? {} }),
      providesTags: ['Notifications'],
    }),

    getUnreadNotificationCount: builder.query<{ count: number }, void>({
      query: () => 'api/notifications/unread-count',
      providesTags: ['Notifications'],
    }),

    markNotificationRead: builder.mutation<void, string>({
      query: (id) => ({ url: `api/notifications/${id}/read`, method: 'PATCH' }),
      invalidatesTags: ['Notifications'],
    }),

    markAllNotificationsRead: builder.mutation<void, void>({
      query: () => ({ url: 'api/notifications/read-all', method: 'PATCH' }),
      invalidatesTags: ['Notifications'],
    }),

    deleteNotification: builder.mutation<void, string>({
      query: (id) => ({ url: `api/notifications/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Notifications'],
    }),

    /** Pushes go only to this app's devices — see horacio's `app_devices`. */
    registerDeviceToken: builder.mutation<void, { token: string; platform: string }>({
      query: (body) => ({ url: 'api/users/device-token', method: 'POST', body }),
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadNotificationCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
  useRegisterDeviceTokenMutation,
} = notificationsApi;

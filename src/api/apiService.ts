import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';
import type {
  User, GarageCar, Post, Event, Group, GroupMember, Article,
  CarTask, Mod, Message, Notification, Tag, PaginatedResponse, LikeInfo, LoginResponse,
  Rally, GroupForumPost, GroupNewsPost, GroupResource, CarGalleryAlbum,
} from '../types/api';

export const apiService = createApi({
  reducerPath: 'apiService',
  baseQuery,
  tagTypes: [
    'User', 'Post', 'Cars', 'GarageCar', 'UserEntries', 'Like', 'Comment',
    'Brands', 'Models', 'Articles', 'ArticleBlocks', 'Events', 'Projects',
    'Mods', 'CarGallery', 'CarTask', 'Message', 'Tags', 'Notifications',
    'CarFollow', 'Group', 'GroupMembers', 'GroupForum', 'GroupNews',
    'GroupResources', 'Following', 'Rally', 'Marketplace', 'Stories', 'Podcasts', 'List',
  ],
  endpoints: (builder) => ({

    // ── Auth / User ─────────────────────────────────────────────────────────

    getLoggedInUser: builder.query<User, void>({
      query: () => 'api/users/loggedInUser',
      providesTags: ['User'],
    }),

    getUserById: builder.query<User, string>({
      query: (userId) => `api/users/${userId}`,
    }),

    getPublicUser: builder.query<User, string>({
      query: (username) => `api/users/publicUserByUsername/${username}`,
    }),

    getPublicUserById: builder.query<User, string>({
      query: (userId) => `api/users/publicUserById/${userId}`,
    }),

    getUserStats: builder.query<{
      postsCount: number; garageCarsCount: number; followersCount: number;
      followingCount: number; followedCarsCount: number; projectsCount: number;
      eventsCount: number; groupsCount: number;
    }, void>({
      query: () => 'api/users/stats',
      providesTags: ['User'],
    }),

    searchUsers: builder.query<PaginatedResponse<User>, string>({
      query: (q) => ({ url: 'api/users/search', params: { q } }),
    }),

    // ── Feed & Posts ────────────────────────────────────────────────────────

    getFeed: builder.query<PaginatedResponse<Post>, { page?: number; limit?: number; filter?: string }>({
      query: ({ page = 0, limit = 12, filter } = {}) => ({
        url: 'api/feed',
        params: { page, limit, filter },
      }),
      providesTags: ['Post'],
    }),

    getPosts: builder.query<PaginatedResponse<Post>, {
      page?: number; limit?: number; type?: string; category?: string;
      username?: string; user_id?: string; make?: string; model?: string;
      car_id?: string; event_id?: string; group_id?: string; search?: string;
      filter?: string; sort?: string;
    }>({
      query: (params = {}) => ({
        url: 'api/post',
        params: { page: params.page ?? 0, limit: params.limit ?? 12, ...params },
      }),
      providesTags: ['Post'],
    }),

    getPost: builder.query<{ entry: Post; user: User }, string>({
      query: (id) => `api/post/single/${id}`,
      providesTags: (result, error, id) => [{ type: 'Post', id }],
    }),

    createPost: builder.mutation<Post, FormData>({
      query: (body) => ({ url: 'api/post/create', method: 'POST', body }),
      invalidatesTags: ['Post', 'UserEntries'],
    }),

    updatePost: builder.mutation<Post, FormData>({
      query: (body) => ({ url: 'api/post/update', method: 'POST', body }),
      invalidatesTags: ['Post', 'UserEntries'],
    }),

    deletePost: builder.mutation<void, { internal_id: string }>({
      query: (body) => ({ url: 'api/post/delete', method: 'POST', body }),
      invalidatesTags: ['Post', 'UserEntries'],
    }),

    // ── Likes ────────────────────────────────────────────────────────────────

    getLikeInfo: builder.query<LikeInfo, string>({
      query: (entryId) => `api/likes/info/${entryId}`,
      providesTags: (result, error, id) => [{ type: 'Like', id }],
    }),

    getPostCounts: builder.query<{ likes: number; comments: number }, string>({
      query: (entryId) => `api/likes/counts/${entryId}`,
      providesTags: (result, error, id) => [{ type: 'Like', id }],
    }),

    getBatchLikes: builder.mutation<Record<string, LikeInfo>, string[]>({
      query: (ids) => ({ url: 'api/likes/batch', method: 'POST', body: { ids } }),
    }),

    likeEntry: builder.mutation<void, { document_id: string; document_entry_type: string }>({
      query: (body) => ({ url: 'api/likes/like', method: 'POST', body }),
      invalidatesTags: (result, error, { document_id }) => [{ type: 'Like', id: document_id }],
    }),

    unlikeEntry: builder.mutation<void, { document_id: string; document_entry_type: string }>({
      query: (body) => ({ url: 'api/likes/unlike', method: 'POST', body }),
      invalidatesTags: (result, error, { document_id }) => [{ type: 'Like', id: document_id }],
    }),

    getLikeUsers: builder.query<{ users: string[]; total: number }, string>({
      query: (entryId) => `api/likes/users/${entryId}`,
    }),

    // ── Comments ─────────────────────────────────────────────────────────────

    getComments: builder.query<{ entries: any[] }, { type: string; id: string; page?: number; limit?: number }>({
      query: ({ type, id, page = 0, limit = 20 }) =>
        `api/comment/${type}/${id}/${page}/none/${limit}`,
      providesTags: (result, error, { id }) => [{ type: 'Comment', id }],
    }),

    getCommentCount: builder.query<number, { type: string; id: string }>({
      query: ({ type, id }) => ({ url: 'api/comment/count', params: { type, id } }),
    }),

    createComment: builder.mutation<any, FormData>({
      query: (body) => ({ url: 'api/comment/create', method: 'POST', body }),
      invalidatesTags: ['Comment'],
    }),

    deleteComment: builder.mutation<void, string>({
      query: (id) => ({ url: `api/comment/delete`, method: 'POST', body: { comment_id: id } }),
      invalidatesTags: ['Comment'],
    }),

    // ── Cars / Garage ────────────────────────────────────────────────────────

    getCars: builder.query<PaginatedResponse<GarageCar>, { page?: number; limit?: number; make?: string; model?: string; username?: string; user_id?: string }>({
      query: (params = {}) => ({
        url: 'api/garage',
        params: { page: params.page ?? 0, limit: params.limit ?? 12, ...params },
      }),
      providesTags: ['Cars'],
    }),

    getCar: builder.query<GarageCar, string>({
      query: (id) => `api/garage/${id}`,
      providesTags: (result, error, id) => [{ type: 'GarageCar', id }],
    }),

    getCarWithUser: builder.query<GarageCar, string>({
      query: (id) => `api/car/withUser/${id}`,
      transformResponse: (response: { entry: GarageCar; user: any }) => ({
        ...response.entry,
        user: response.user,
      }),
      providesTags: (result, error, id) => [{ type: 'GarageCar', id }],
    }),

    getUserGarage: builder.query<{ entries: GarageCar[] }, void>({
      query: () => 'api/protected/all/garage',
      providesTags: ['GarageCar'],
    }),

    getFollowingGarage: builder.query<PaginatedResponse<GarageCar>, { page?: number; limit?: number }>({
      query: ({ page = 0, limit = 12 } = {}) => ({
        url: 'api/garage/following',
        params: { page, limit },
      }),
      providesTags: ['Cars'],
    }),

    createCar: builder.mutation<GarageCar, FormData>({
      query: (body) => ({ url: 'api/car/create', method: 'POST', body }),
      invalidatesTags: ['GarageCar', 'Cars'],
    }),

    updateCar: builder.mutation<GarageCar, FormData>({
      query: (body) => ({ url: 'api/car/update', method: 'POST', body }),
      invalidatesTags: ['GarageCar', 'Cars'],
    }),

    deleteCar: builder.mutation<void, { internal_id: string }>({
      query: (body) => ({ url: 'api/car/delete', method: 'POST', body }),
      invalidatesTags: ['GarageCar', 'Cars'],
    }),

    getCarBrands: builder.query<string[], void>({
      query: () => 'api/garage/brands/all',
      providesTags: ['Brands'],
    }),

    getCarModels: builder.query<string[], string>({
      query: (brand) => `api/garage/brands/brand/${encodeURIComponent(brand)}/models`,
      providesTags: (result, error, brand) => [{ type: 'Models', id: brand }],
    }),

    followCar: builder.mutation<void, { car_id: string }>({
      query: (body) => ({ url: 'api/carfollow/follow-car', method: 'POST', body }),
      invalidatesTags: ['CarFollow'],
    }),

    unfollowCar: builder.mutation<void, { car_id: string }>({
      query: (body) => ({ url: 'api/carfollow/unfollow-car', method: 'POST', body }),
      invalidatesTags: ['CarFollow'],
    }),

    getCarFollowStatus: builder.query<{ following: boolean }, string>({
      query: (carId) => `api/protected/carfollow/car-follow-status/${carId}`,
      providesTags: (result, error, id) => [{ type: 'CarFollow', id }],
    }),

    // ── Car Galleries ────────────────────────────────────────────────────────

    getCarGalleries: builder.query<{ entries: CarGalleryAlbum[] }, string>({
      query: (carId) => `api/car/galleries/${carId}`,
      providesTags: (result, error, carId) => [{ type: 'CarGallery', id: carId }],
    }),

    // ── Car Mods ─────────────────────────────────────────────────────────────

    getCarMods: builder.query<{ entries: Mod[] }, string>({
      query: (carId) => `api/car/mods/${carId}`,
      providesTags: (result, error, carId) => [{ type: 'CarGallery', id: `mods-${carId}` }],
    }),

    // ── Car Tasks ────────────────────────────────────────────────────────────

    getCarTasks: builder.query<{ entries: CarTask[] }, string>({
      query: (carId) => `api/cartask/car/${carId}`,
      providesTags: (result, error, carId) => [{ type: 'CarTask', id: carId }],
    }),

    getArchivedCarTasks: builder.query<{ entries: CarTask[] }, string>({
      query: (carId) => `api/cartask/car/${carId}/archived`,
      providesTags: (result, error, carId) => [{ type: 'CarTask', id: `${carId}-archived` }],
    }),

    createCarTask: builder.mutation<CarTask, Partial<CarTask>>({
      query: (body) => ({ url: 'api/cartask/create', method: 'POST', body }),
      invalidatesTags: (result, error, { car_id }) => [{ type: 'CarTask', id: car_id }],
    }),

    updateCarTask: builder.mutation<CarTask, Partial<CarTask> & { internal_id: string }>({
      query: (body) => ({ url: 'api/cartask/update', method: 'POST', body }),
      invalidatesTags: (result, error, { car_id }) => [{ type: 'CarTask', id: car_id }],
    }),

    toggleCarTask: builder.mutation<CarTask, { internal_id: string; car_id: string }>({
      query: (body) => ({ url: 'api/cartask/toggle-completion', method: 'POST', body }),
      invalidatesTags: (result, error, { car_id }) => [{ type: 'CarTask', id: car_id }],
    }),

    updateCarTaskPositions: builder.mutation<void, { tasks: { internal_id: string; position: number }[]; car_id: string }>({
      query: (body) => ({ url: 'api/cartask/update-positions', method: 'POST', body }),
      invalidatesTags: (result, error, { car_id }) => [{ type: 'CarTask', id: car_id }],
    }),

    deleteCarTask: builder.mutation<void, { taskId: string; car_id: string }>({
      query: ({ taskId }) => ({ url: `api/cartask/${taskId}`, method: 'DELETE' }),
      invalidatesTags: (result, error, { car_id }) => [{ type: 'CarTask', id: car_id }],
    }),

    // ── Events ───────────────────────────────────────────────────────────────

    getEvents: builder.query<PaginatedResponse<Event>, { page?: number; limit?: number; group_id?: string }>({
      query: (params = {}) => ({ url: 'api/event', params: { page: params.page ?? 0, limit: params.limit ?? 12, ...params } }),
      providesTags: ['Events'],
    }),

    getEvent: builder.query<Event, string>({
      query: (id) => `api/event/detail/${id}`,
      transformResponse: (response: { entry: Event } | Event) =>
        'entry' in response ? response.entry : response,
      providesTags: (result, error, id) => [{ type: 'Events', id }],
    }),

    attendEvent: builder.mutation<void, { event_id: string }>({
      query: (body) => ({ url: 'api/event/attend', method: 'POST', body }),
      invalidatesTags: ['Events'],
    }),

    declineEvent: builder.mutation<void, { event_id: string }>({
      query: (body) => ({ url: 'api/event/decline', method: 'POST', body }),
      invalidatesTags: ['Events'],
    }),

    createEvent: builder.mutation<Event, FormData>({
      query: (body) => ({ url: 'api/event/create', method: 'POST', body }),
      invalidatesTags: ['Events'],
    }),

    // ── Groups ───────────────────────────────────────────────────────────────

    getGroups: builder.query<PaginatedResponse<Group>, { page?: number; limit?: number }>({
      query: ({ page = 0, limit = 12 } = {}) => `api/group/${page}/none/${limit}`,
      providesTags: ['Group'],
    }),

    getGroup: builder.query<Group, string>({
      query: (id) => `api/group/detail/${id}`,
      providesTags: (result, error, id) => [{ type: 'Group', id }],
    }),

    getUserGroups: builder.query<Group[], string>({
      query: (userId) => `api/group/user/${userId}/groups`,
      providesTags: ['Group'],
    }),

    getGroupMembers: builder.query<GroupMember[], string>({
      query: (groupId) => `api/group/${groupId}/members`,
      providesTags: (result, error, id) => [{ type: 'GroupMembers', id }],
    }),

    joinGroup: builder.mutation<void, string>({
      query: (groupId) => ({ url: `api/group/${groupId}/join`, method: 'POST' }),
      invalidatesTags: ['GroupMembers'],
    }),

    leaveGroup: builder.mutation<void, string>({
      query: (groupId) => ({ url: `api/group/${groupId}/leave`, method: 'DELETE' }),
      invalidatesTags: ['GroupMembers'],
    }),

    // ── Rallys ───────────────────────────────────────────────────────────────

    getRallys: builder.query<PaginatedResponse<Rally>, { page?: number; limit?: number }>({
      query: ({ page = 0, limit = 12 } = {}) => ({
        url: 'api/rally',
        params: { page, limit },
      }),
      providesTags: ['Rally'],
    }),

    getRally: builder.query<Rally, string>({
      query: (id) => `api/rally/detail/${id}`,
      transformResponse: (response: { entry: Rally } | Rally) =>
        'entry' in response ? response.entry : response,
      providesTags: (result, error, id) => [{ type: 'Rally', id }],
    }),

    attendRally: builder.mutation<void, { rally_id: string }>({
      query: (body) => ({ url: 'api/rally/attend', method: 'POST', body }),
      invalidatesTags: ['Rally'],
    }),

    declineRally: builder.mutation<void, { rally_id: string }>({
      query: (body) => ({ url: 'api/rally/decline', method: 'POST', body }),
      invalidatesTags: ['Rally'],
    }),

    // ── Calendar ──────────────────────────────────────────────────────────────

    getCalendarEvents: builder.query<{ entries: Event[]; total: number }, { year: number; month: number; group_id?: string }>({
      query: (params) => ({ url: 'api/event/calendar', params }),
      providesTags: ['Events'],
    }),

    // ── Group Forum ───────────────────────────────────────────────────────────

    getGroupForum: builder.query<{ entries: GroupForumPost[] }, { groupId: string; page?: number; limit?: number }>({
      query: ({ groupId, page = 0, limit = 30 }) => ({
        url: `api/groupforum/${page}/none/${limit}`,
        params: { group_id: groupId },
      }),
      providesTags: (result, error, { groupId }) => [{ type: 'GroupForum', id: groupId }],
    }),

    // ── Group News ────────────────────────────────────────────────────────────

    getGroupNews: builder.query<{ entries: GroupNewsPost[] }, { groupId: string; page?: number; limit?: number }>({
      query: ({ groupId, page = 0, limit = 30 }) => ({
        url: `api/groupnews/${page}/none/${limit}`,
        params: { group_id: groupId },
      }),
      providesTags: (result, error, { groupId }) => [{ type: 'GroupNews', id: groupId }],
    }),

    // ── Group Resources ───────────────────────────────────────────────────────

    getGroupResources: builder.query<{ entries: GroupResource[] }, { groupId: string; page?: number; limit?: number }>({
      query: ({ groupId, page = 0, limit = 30 }) => ({
        url: `api/groupresource/${page}/none/${limit}`,
        params: { group_id: groupId },
      }),
      providesTags: (result, error, { groupId }) => [{ type: 'GroupResources', id: groupId }],
    }),

    // ── Articles ─────────────────────────────────────────────────────────────

    getArticles: builder.query<PaginatedResponse<Article>, { page?: number; limit?: number }>({
      query: ({ page = 0, limit = 12 } = {}) => ({
        url: 'api/article',
        params: { page, limit },
      }),
      providesTags: ['Articles'],
    }),

    getArticle: builder.query<Article, string>({
      query: (id) => `api/article/detail/${id}`,
      providesTags: (result, error, id) => [{ type: 'Articles', id }],
    }),

    getArticleBlocks: builder.query<{ blocks: any[] }, string>({
      query: (articleId) => `api/articleblock/byarticle/${articleId}`,
      providesTags: (result, error, id) => [{ type: 'ArticleBlocks', id }],
    }),

    // ── Notifications ─────────────────────────────────────────────────────────

    getNotifications: builder.query<{ notifications: Notification[]; total: number }, { limit?: number; offset?: number; unread_only?: boolean }>({
      query: (params = {}) => ({ url: 'api/notifications', params }),
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

    archiveNotification: builder.mutation<void, string>({
      query: (id) => ({ url: `api/notifications/${id}/archive`, method: 'PATCH' }),
      invalidatesTags: ['Notifications'],
    }),

    archiveAllNotifications: builder.mutation<void, void>({
      query: () => ({ url: 'api/notifications/archive-all', method: 'PATCH' }),
      invalidatesTags: ['Notifications'],
    }),

    deleteNotification: builder.mutation<void, string>({
      query: (id) => ({ url: `api/notifications/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Notifications'],
    }),

    // ── Messages ─────────────────────────────────────────────────────────────

    getMessages: builder.query<PaginatedResponse<Message>, { page?: number; limit?: number }>({
      query: ({ page = 0, limit = 20 } = {}) => ({ url: 'api/message', params: { page, limit } }),
      providesTags: ['Message'],
    }),

    getMessageThread: builder.query<Message[], string>({
      query: (threadId) => `api/message/thread/${threadId}`,
      providesTags: (result, error, id) => [{ type: 'Message', id }],
    }),

    getUnreadMessageCount: builder.query<{ count: number }, void>({
      query: () => 'api/message/unread/count',
      providesTags: ['Message'],
    }),

    sendMessage: builder.mutation<Message, { recipient_id: string; subject?: string; body: string; thread_id?: string }>({
      query: (body) => ({ url: 'api/message/create', method: 'POST', body }),
      invalidatesTags: ['Message'],
    }),

    markMessageRead: builder.mutation<void, string>({
      query: (id) => ({ url: `api/message/${id}/read`, method: 'PUT' }),
      invalidatesTags: ['Message'],
    }),

    deleteMessage: builder.mutation<void, string>({
      query: (id) => ({ url: `api/message/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Message'],
    }),

    deleteMessageThread: builder.mutation<void, string>({
      query: (threadId) => ({ url: `api/message/thread/${threadId}`, method: 'DELETE' }),
      invalidatesTags: ['Message'],
    }),

    searchMessageUsers: builder.query<User[], string>({
      query: (q) => ({ url: 'api/message/users/search', params: { q } }),
    }),

    // ── Follow ────────────────────────────────────────────────────────────────

    getFollowStatus: builder.query<{ following: boolean }, string>({
      query: (username) => `api/protected/followstatus/${username}`,
      providesTags: (result, error, username) => [{ type: 'Following', id: username }],
    }),

    followUser: builder.mutation<void, string>({
      query: (username) => ({ url: `api/follow/set-following`, method: 'POST', body: { username } }),
      invalidatesTags: (result, error, username) => [{ type: 'Following', id: username }],
    }),

    unfollowUser: builder.mutation<void, string>({
      query: (username) => ({ url: `api/follow/set-unfollowing`, method: 'POST', body: { username } }),
      invalidatesTags: (result, error, username) => [{ type: 'Following', id: username }],
    }),

    // ── Tags ──────────────────────────────────────────────────────────────────

    getTagsByPost: builder.query<Tag[], string>({
      query: (postId) => `api/tags/post/${postId}`,
      providesTags: (result, error, id) => [{ type: 'Tags', id }],
    }),

    // ── Search ────────────────────────────────────────────────────────────────

    search: builder.query<any, string>({
      query: (q) => `api/search/${encodeURIComponent(q)}`,
    }),

    // ── User settings ─────────────────────────────────────────────────────────

    updateUserSetting: builder.mutation<User, { type: string; [key: string]: any }>({
      query: ({ type, ...body }) => ({
        url: `api/users/settings/update/${type}`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User'],
    }),

    updateUserSettingImage: builder.mutation<User, { type: string; formData: FormData }>({
      query: ({ type, formData }) => ({
        url: `api/users/settings/update/${type}`,
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['User'],
    }),

    deleteAccount: builder.mutation<void, void>({
      query: () => ({ url: 'api/users/account', method: 'DELETE' }),
    }),

    registerDeviceToken: builder.mutation<void, { token: string; platform: string }>({
      query: (body) => ({ url: 'api/users/device-token', method: 'POST', body }),
    }),

    // ── Stories ─────────────────────────────────────────────────────────────

    getStoriesFeed: builder.query<{ stories: Post[] }, void>({
      query: () => 'api/stories/feed',
      providesTags: ['Stories'],
    }),

    markStoriesSeen: builder.mutation<{ ok: boolean }, { story_ids: string[] }>({
      query: (body) => ({ url: 'api/stories/mark-seen', method: 'POST', body }),
      invalidatesTags: ['Stories'],
    }),

    // ── Site Settings ────────────────────────────────────────────────────────

    getSiteSettings: builder.query<{ featured_cars?: GarageCar[]; featured_users?: User[] }, void>({
      query: () => 'api/site-settings',
    }),

    // ── Podcasts ─────────────────────────────────────────────────────────────

    getPodcasts: builder.query<import('../types/api').Podcast[], void>({
      query: () => 'api/podcasts',
      providesTags: ['Podcasts'],
    }),

    getPodcast: builder.query<{ podcast: import('../types/api').Podcast; episodes: import('../types/api').PodcastEpisode[] }, string>({
      query: (id) => `api/podcasts/${id}`,
      providesTags: (result, error, id) => [{ type: 'Podcasts' as const, id }],
    }),

    // ── Lists ─────────────────────────────────────────────────────────────────

    getLists: builder.query<PaginatedResponse<import('../types/api').List>, { user_id?: string; page?: number; limit?: number; search?: string }>({
      query: (params = {}) => ({ url: 'api/lists', params }),
      providesTags: ['List'],
    }),

    getList: builder.query<import('../types/api').List, string>({
      query: (id) => `api/lists/single/${id}`,
      providesTags: (result, error, id) => [{ type: 'List' as const, id }],
    }),

    createList: builder.mutation<{ _id: string; entry: import('../types/api').List }, FormData>({
      query: (formData) => ({ url: 'api/lists/create', method: 'POST', body: formData }),
      invalidatesTags: ['List'],
    }),

    updateList: builder.mutation<import('../types/api').List, FormData>({
      query: (formData) => ({ url: 'api/lists/update', method: 'POST', body: formData }),
      invalidatesTags: ['List'],
    }),

    deleteList: builder.mutation<{ success: boolean }, { internal_id: string }>({
      query: (body) => ({ url: 'api/lists/delete', method: 'POST', body }),
      invalidatesTags: ['List'],
    }),

    createListItem: builder.mutation<{ item: import('../types/api').ListItem; list_id: string }, FormData>({
      query: (formData) => ({ url: 'api/lists/items/create', method: 'POST', body: formData }),
      invalidatesTags: ['List'],
    }),

    deleteListItem: builder.mutation<{ success: boolean }, { list_id: string; item_internal_id: string }>({
      query: (body) => ({ url: 'api/lists/items/delete', method: 'POST', body }),
      invalidatesTags: ['List'],
    }),

    reorderListItems: builder.mutation<{ success: boolean }, { list_id: string; item_order: string[] }>({
      query: (body) => ({ url: 'api/lists/items/reorder', method: 'POST', body }),
      invalidatesTags: ['List'],
    }),

  }),
});

// Export hooks
export const {
  useGetLoggedInUserQuery,
  useGetUserByIdQuery,
  useGetPublicUserQuery,
  useGetPublicUserByIdQuery,
  useGetUserStatsQuery,
  useSearchUsersQuery,
  useGetFeedQuery,
  useGetPostsQuery,
  useGetPostQuery,
  useCreatePostMutation,
  useUpdatePostMutation,
  useDeletePostMutation,
  useGetLikeInfoQuery,
  useGetPostCountsQuery,
  useGetBatchLikesMutation,
  useLikeEntryMutation,
  useUnlikeEntryMutation,
  useGetLikeUsersQuery,
  useGetCommentsQuery,
  useGetCommentCountQuery,
  useCreateCommentMutation,
  useDeleteCommentMutation,
  useGetCarsQuery,
  useGetCarQuery,
  useGetCarWithUserQuery,
  useGetUserGarageQuery,
  useGetFollowingGarageQuery,
  useCreateCarMutation,
  useUpdateCarMutation,
  useDeleteCarMutation,
  useGetCarBrandsQuery,
  useGetCarModelsQuery,
  useFollowCarMutation,
  useUnfollowCarMutation,
  useGetCarFollowStatusQuery,
  useGetCarGalleriesQuery,
  useGetCarModsQuery,
  useGetCarTasksQuery,
  useGetArchivedCarTasksQuery,
  useCreateCarTaskMutation,
  useUpdateCarTaskMutation,
  useToggleCarTaskMutation,
  useUpdateCarTaskPositionsMutation,
  useDeleteCarTaskMutation,
  useGetEventsQuery,
  useGetEventQuery,
  useAttendEventMutation,
  useDeclineEventMutation,
  useCreateEventMutation,
  useGetGroupsQuery,
  useGetGroupQuery,
  useGetUserGroupsQuery,
  useGetGroupMembersQuery,
  useJoinGroupMutation,
  useLeaveGroupMutation,
  useGetArticlesQuery,
  useGetArticleQuery,
  useGetArticleBlocksQuery,
  useGetNotificationsQuery,
  useGetUnreadNotificationCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useArchiveNotificationMutation,
  useArchiveAllNotificationsMutation,
  useDeleteNotificationMutation,
  useGetMessagesQuery,
  useGetMessageThreadQuery,
  useGetUnreadMessageCountQuery,
  useSendMessageMutation,
  useMarkMessageReadMutation,
  useDeleteMessageMutation,
  useDeleteMessageThreadMutation,
  useSearchMessageUsersQuery,
  useGetRallysQuery,
  useGetRallyQuery,
  useAttendRallyMutation,
  useDeclineRallyMutation,
  useGetCalendarEventsQuery,
  useGetGroupForumQuery,
  useGetGroupNewsQuery,
  useGetGroupResourcesQuery,
  useGetFollowStatusQuery,
  useFollowUserMutation,
  useUnfollowUserMutation,
  useGetTagsByPostQuery,
  useSearchQuery,
  useUpdateUserSettingMutation,
  useUpdateUserSettingImageMutation,
  useDeleteAccountMutation,
  useRegisterDeviceTokenMutation,
  useGetStoriesFeedQuery,
  useMarkStoriesSeenMutation,
  useGetSiteSettingsQuery,
  useGetPodcastsQuery,
  useGetPodcastQuery,
  useGetListsQuery,
  useGetListQuery,
  useCreateListMutation,
  useUpdateListMutation,
  useDeleteListMutation,
  useCreateListItemMutation,
  useDeleteListItemMutation,
  useReorderListItemsMutation,
} = apiService;

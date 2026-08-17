import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';
import type {
  User, GarageCar, Post, Event, SocietyEvent, Group, GroupMember, Article,
  CarTask, Mod, Message, Notification, Tag, PaginatedResponse, LikeInfo, LoginResponse,
  Rally, GroupForumPost, GroupNewsPost, GroupResource, CarGalleryAlbum, GalleryItem, DiecastAnalysis,
  DrivingRoute, DrivingRouteDetail, RouteListParams, NearbyPlace,
  FeedPreferences, HomeBanner,
} from '../types/api';

export const apiService = createApi({
  reducerPath: 'apiService',
  baseQuery,
  tagTypes: [
    'User', 'Post', 'Cars', 'GarageCar', 'UserEntries', 'Like', 'Comment',
    'SocietyEvent', 'EventInterest',
    'Brands', 'Models', 'Articles', 'ArticleBlocks', 'Events', 'Projects',
    'Mods', 'CarGallery', 'CarTask', 'Message', 'Tags', 'Notifications',
    'CarFollow', 'Group', 'GroupMembers', 'GroupForum', 'GroupNews',
    'GroupResources', 'Following', 'Rally', 'Marketplace', 'Stories', 'Podcasts', 'List',
    'Block', 'FlaggedContent', 'Route', 'SiteSettings',
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

    getUsers: builder.query<PaginatedResponse<User>, { page?: number; limit?: number; q?: string } | void>({
      query: (args = {}) => {
        const { page = 0, limit = 20, q } = args ?? {};
        return { url: 'api/users', params: { page, limit, ...(q ? { q } : {}) } };
      },
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

    // Direct-to-Mux: returns a one-time upload URL the client PUTs the video to.
    createMuxUploadUrl: builder.mutation<{ id: string; url: string }, void>({
      query: () => ({ url: 'api/post/mux/upload-url', method: 'POST' }),
    }),

    // Mobile: append one image to a post's gallery (sequential upload flow).
    addPostImage: builder.mutation<{ entry: Post; image: any }, FormData>({
      query: (body) => ({ url: 'api/post/mobile/add-image', method: 'POST', body }),
    }),

    analyzeDiecast: builder.mutation<{ result: DiecastAnalysis }, FormData>({
      query: (body) => ({ url: 'api/post/analyze-diecast', method: 'POST', body }),
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
      query: (ids) => ({ url: 'api/likes/batch', method: 'POST', body: { document_ids: ids } }),
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
      providesTags: (result, error, id) => [{ type: 'Like', id }],
    }),

    // ── Comments ─────────────────────────────────────────────────────────────

    getComments: builder.query<{ entries: any[] }, { type: string; id: string; page?: number; limit?: number }>({
      query: ({ type, id, page = 0, limit = 20 }) =>
        `api/comment/${type}/${id}/${page}/none/${limit}`,
      providesTags: (result, error, { id }) => [{ type: 'Comment', id }],
    }),

    getCommentReplies: builder.query<{ entries: any[] }, { type: string; id: string }>({
      query: ({ type, id }) => ({
        url: 'api/comment/replies',
        params: { document_id: id, document_entry_type: type },
      }),
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

    // `make`/`model` are only honoured alongside `filter: 'related'`, and match
    // against the handle forms (`make_handle`) rather than the display names.
    getCars: builder.query<PaginatedResponse<GarageCar>, { page?: number; limit?: number; filter?: string; make?: string; model?: string; username?: string; user_id?: string }>({
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

    getFollowingGarage: builder.query<{ entries: GarageCar[]; total: number }, { page?: number; limit?: number }>({
      query: ({ page = 0, limit = 12 } = {}) => ({
        url: 'api/garage/following',
        params: { page, limit },
      }),
      // The endpoint answers with `cars`, not `entries`.
      transformResponse: (r: any): { entries: GarageCar[]; total: number } => {
        const entries = r?.entries ?? r?.cars ?? [];
        return { entries, total: r?.total ?? entries.length };
      },
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
      transformResponse: (response: { brands: { make: string; make_handle: string; qty: number }[] }) =>
        response.brands.map((b) => b.make),
      providesTags: ['Brands'],
    }),

    getCarModels: builder.query<{ model: string; model_handle: string; qty: number }[], string>({
      query: (brand) => `api/garage/brands/brand/${encodeURIComponent(brand)}/models`,
      transformResponse: (response: { models: { model: string; model_handle: string; qty?: number }[] }) =>
        response.models.map((m) => ({ model: m.model, model_handle: m.model_handle, qty: m.qty ?? 0 })),
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

    getCarFollowers: builder.query<{ entries: User[]; total: number }, string>({
      query: (carId) => `api/carfollow/car-followers/${carId}/0/none/50`,
      transformResponse: (r: any): { entries: User[]; total: number } => {
        const list = Array.isArray(r) ? r : r?.followers ?? r?.entries ?? [];
        // Followers may come back as raw follow records with a populated user.
        const entries = list.map((f: any) => f?.user ?? f).filter(Boolean);
        return { entries, total: r?.total ?? entries.length };
      },
      providesTags: (result, error, id) => [{ type: 'CarFollow', id: `followers-${id}` }],
    }),

    getCarFollowStatus: builder.query<{ following: boolean }, string>({
      query: (carId) => `api/protected/carfollow/car-follow-status/${carId}`,
      // Backend returns { isFollowing }, older/other endpoints use { following } — normalize.
      transformResponse: (r: any): { following: boolean } => ({
        following: !!(r?.following ?? r?.isFollowing),
      }),
      providesTags: (result, error, id) => [{ type: 'CarFollow', id }],
    }),

    // Lightweight follower-count for cards/rows — reuses the followers route with limit 1.
    getCarFollowerCount: builder.query<number, string>({
      query: (carId) => `api/carfollow/car-followers/${carId}/0/none/1`,
      transformResponse: (r: any): number =>
        r?.total ?? (Array.isArray(r?.followers) ? r.followers.length : 0),
      providesTags: (result, error, id) => [{ type: 'CarFollow', id: `count-${id}` }],
    }),

    // Cars the logged-in user follows (Dashboard "Followed Cars").
    getFollowedCars: builder.query<{ entries: GarageCar[]; total: number }, void>({
      query: () => 'api/carfollow/followed-cars/0/none/50',
      transformResponse: (r: any): { entries: GarageCar[]; total: number } => {
        const entries = r?.entries ?? r?.cars ?? [];
        return { entries, total: r?.total ?? entries.length };
      },
      providesTags: ['CarFollow'],
    }),

    // ── Car Galleries ────────────────────────────────────────────────────────

    getCarGalleries: builder.query<{ entries: CarGalleryAlbum[] }, string>({
      query: (carId) => `api/car/galleries/${carId}`,
      providesTags: (result, error, carId) => [{ type: 'CarGallery', id: carId }],
    }),

    createCarGallery: builder.mutation<{ _id: string }, FormData>({
      query: (body) => ({ url: 'api/cargallery/create', method: 'POST', body }),
      invalidatesTags: (result, error, body) => {
        const carId = (body as any).get?.('car_id');
        return carId ? [{ type: 'CarGallery', id: carId }] : [];
      },
    }),

    // ── Car Mods ─────────────────────────────────────────────────────────────

    getCarMods: builder.query<{ entries: Mod[] }, string>({
      query: (carId) => `api/car/mods/${carId}`,
      providesTags: (result, error, carId) => [{ type: 'CarGallery', id: `mods-${carId}` }],
    }),

    createMod: builder.mutation<{ _id: string }, FormData>({
      query: (body) => ({ url: 'api/mod/create', method: 'POST', body }),
      invalidatesTags: (result, error, body) => {
        const carId = (body as any).get?.('car_id');
        return carId ? [{ type: 'CarGallery', id: `mods-${carId}` }] : [];
      },
    }),

    updateMod: builder.mutation<Mod, FormData>({
      query: (body) => ({ url: 'api/mod/update', method: 'POST', body }),
      invalidatesTags: (result, error, body) => {
        const carId = (body as any).get?.('car_id');
        return carId ? [{ type: 'CarGallery', id: `mods-${carId}` }] : ['CarGallery'];
      },
    }),

    deleteMod: builder.mutation<void, { internal_id: string }>({
      query: (body) => ({ url: 'api/mod/delete', method: 'POST', body }),
      invalidatesTags: ['CarGallery'],
    }),

    updateCarGallery: builder.mutation<CarGalleryAlbum, FormData>({
      query: (body) => ({ url: 'api/cargallery/update', method: 'POST', body }),
      invalidatesTags: (result, error, body) => {
        const carId = (body as any).get?.('car_id');
        return carId ? [{ type: 'CarGallery', id: carId }] : ['CarGallery'];
      },
    }),

    deleteCarGallery: builder.mutation<void, { internal_id: string }>({
      query: (body) => ({ url: 'api/cargallery/delete', method: 'POST', body }),
      invalidatesTags: ['CarGallery'],
    }),

    // ── Car Galleries — mobile sequential upload flow ─────────────────────────
    // One image per request so we can show real progress and never hit multer's
    // per-field maxCount. The screen orchestrates these and invalidates the
    // CarGallery tag once the whole sequence finishes.

    createCarGalleryShell: builder.mutation<
      { _id: string; entry: CarGalleryAlbum },
      { car_id: string; title: string; type?: string; body?: string; private?: boolean }
    >({
      query: (body) => ({ url: 'api/cargallery/mobile/create', method: 'POST', body }),
    }),

    addCarGalleryImage: builder.mutation<{ entry: CarGalleryAlbum; image: GalleryItem }, FormData>({
      query: (body) => ({ url: 'api/cargallery/mobile/add-image', method: 'POST', body }),
    }),

    removeCarGalleryImages: builder.mutation<
      { entry: CarGalleryAlbum },
      { internal_id: string; filenames: string[] }
    >({
      query: (body) => ({ url: 'api/cargallery/mobile/remove-image', method: 'POST', body }),
    }),

    updateCarGalleryMeta: builder.mutation<
      { entry: CarGalleryAlbum },
      { internal_id: string; title?: string; type?: string; body?: string; private?: boolean }
    >({
      query: (body) => ({ url: 'api/cargallery/mobile/update-meta', method: 'POST', body }),
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

    // `completed` is optional — omitting it makes the server flip the current value.
    toggleCarTask: builder.mutation<CarTask, { internal_id: string; car_id: string; completed?: boolean }>({
      query: (body) => ({ url: 'api/cartask/toggle-completion', method: 'POST', body }),
      // Ticking a box is the one interaction that has to feel instant — the
      // checkbox is the feedback, and waiting a round trip for it to fill makes
      // a tap feel dropped. Only applied when the caller states the intended
      // value; a bare toggle leaves the server to decide and we can't guess.
      async onQueryStarted({ internal_id, car_id, completed }, { dispatch, queryFulfilled }) {
        if (completed === undefined) return;
        const undo = dispatch(
          apiService.util.updateQueryData('getCarTasks', car_id, (draft) => {
            const task = draft.entries.find((t) => t.internal_id === internal_id);
            if (task) task.completed = completed;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          undo.undo();
        }
      },
      invalidatesTags: (result, error, { car_id }) => [{ type: 'CarTask', id: car_id }],
    }),

    updateCarTaskPositions: builder.mutation<void, { tasks: { internal_id: string; position: number; category?: string }[]; car_id: string }>({
      query: (body) => ({ url: 'api/cartask/update-positions', method: 'POST', body }),
      invalidatesTags: (result, error, { car_id }) => [{ type: 'CarTask', id: car_id }],
    }),

    deleteCarTask: builder.mutation<void, { taskId: string; car_id: string }>({
      query: ({ taskId }) => ({ url: `api/cartask/${taskId}`, method: 'DELETE' }),
      invalidatesTags: (result, error, { car_id }) => [{ type: 'CarTask', id: car_id }],
    }),

    // ── Events ───────────────────────────────────────────────────────────────

    // ── Society events (rebuilt model) ───────────────────────────────────
    // Occurrences are expanded server-side from each event's schedule, so a
    // "first and third Saturday" event arrives with real dates like any other.
    getUpcomingEvents: builder.query<{ entries: SocietyEvent[]; total: number }, { limit?: number; category?: string; days?: number } | void>({
      query: (params) => ({ url: 'api/events/upcoming', params: params ?? {} }),
      providesTags: ['SocietyEvent'],
    }),

    getEventCalendar: builder.query<{ year: number; month: number; days: Record<string, SocietyEvent[]>; total: number }, { year: number; month: number; category?: string }>({
      query: (params) => ({ url: 'api/events/calendar', params }),
      providesTags: ['SocietyEvent'],
    }),

    getSocietyEvent: builder.query<SocietyEvent, string>({
      query: (id) => `api/events/${id}`,
      providesTags: (r, e, id) => [{ type: 'SocietyEvent', id }],
    }),

    getEventInterestedUsers: builder.query<{ entries: User[]; total: number }, string>({
      query: (id) => `api/events/${id}/interested`,
      providesTags: (r, e, id) => [{ type: 'EventInterest', id }],
    }),

    getEventTaggedPosts: builder.query<{ entries: Post[]; total: number }, string>({
      query: (id) => `api/events/${id}/tagged-posts`,
    }),

    getFollowingEvents: builder.query<{ entries: SocietyEvent[]; total: number }, { limit?: number } | void>({
      query: (params) => ({ url: 'api/events/following', params: params ?? {} }),
      providesTags: ['SocietyEvent'],
    }),

    getMyEvents: builder.query<{ entries: SocietyEvent[]; total: number; upcoming_count: number }, void>({
      query: () => 'api/events/mine/interested',
      providesTags: ['EventInterest'],
    }),

    getMyEventsCount: builder.query<{ count: number }, void>({
      query: () => 'api/events/mine/count',
      providesTags: ['EventInterest'],
    }),

    toggleEventInterest: builder.mutation<{ is_interested: boolean; interested_count: number }, string>({
      query: (event_id) => ({ url: 'api/events/interest', method: 'POST', body: { event_id } }),
      invalidatesTags: (r, e, id) => [{ type: 'SocietyEvent', id }, 'EventInterest', 'SocietyEvent'],
    }),

    createSocietyEvent: builder.mutation<SocietyEvent, FormData>({
      query: (body) => ({ url: 'api/events/create', method: 'POST', body }),
      invalidatesTags: ['SocietyEvent'],
    }),

    updateSocietyEvent: builder.mutation<SocietyEvent, FormData>({
      query: (body) => ({ url: 'api/events/update', method: 'POST', body }),
      invalidatesTags: ['SocietyEvent'],
    }),

    deleteSocietyEvent: builder.mutation<void, string>({
      query: (internal_id) => ({ url: 'api/events/delete', method: 'POST', body: { internal_id } }),
      invalidatesTags: ['SocietyEvent', 'EventInterest'],
    }),

    // ── Driving routes ──────────────────────────────────────────────────────
    // Reads are open to everyone; creating is pro-only and enforced by the API.

    getRoutes: builder.query<{ entries: DrivingRoute[]; total: number }, RouteListParams | void>({
      query: (params) => ({ url: 'api/routes', params: (params ?? {}) as Record<string, any> }),
      providesTags: ['Route'],
    }),

    // Proxied through our API so the maps key never ships in the app binary.
    getNearbyPlaces: builder.query<{ places: NearbyPlace[] }, { lat: number; lng: number }>({
      query: ({ lat, lng }) => ({ url: 'api/routes/nearby', params: { lat, lng } }),
    }),

    getRoute: builder.query<DrivingRouteDetail, string>({
      query: (id) => `api/routes/${id}`,
      providesTags: (result, error, id) => [{ type: 'Route', id }],
    }),

    createRoute: builder.mutation<DrivingRoute, FormData>({
      query: (body) => ({ url: 'api/routes/create', method: 'POST', body }),
      invalidatesTags: ['Route', 'UserEntries'],
    }),

    updateRoute: builder.mutation<{ entry: DrivingRoute }, FormData>({
      query: (body) => ({ url: 'api/routes/update', method: 'POST', body }),
      invalidatesTags: ['Route'],
    }),

    deleteRoute: builder.mutation<void, string>({
      query: (internal_id) => ({ url: 'api/routes/delete', method: 'POST', body: { internal_id } }),
      invalidatesTags: ['Route', 'UserEntries'],
    }),

    voteRoute: builder.mutation<{ vote_count: number; has_voted: boolean }, string>({
      query: (internal_id) => ({ url: 'api/routes/vote', method: 'POST', body: { internal_id } }),
      invalidatesTags: (result, error, id) => [{ type: 'Route', id }, 'Route'],
    }),

    unvoteRoute: builder.mutation<{ vote_count: number; has_voted: boolean }, string>({
      query: (internal_id) => ({ url: 'api/routes/unvote', method: 'POST', body: { internal_id } }),
      invalidatesTags: (result, error, id) => [{ type: 'Route', id }, 'Route'],
    }),

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
      transformResponse: (response: any): Group => response?.entry ?? response,
      providesTags: (result, error, id) => [{ type: 'Group', id }],
    }),

    getUserGroups: builder.query<Group[], string>({
      query: (userId) => `api/group/user/${userId}/groups`,
      transformResponse: (response: any): Group[] =>
        Array.isArray(response) ? response : response?.groups ?? response?.entries ?? [],
      providesTags: ['Group'],
    }),

    getGroupMembers: builder.query<GroupMember[], string>({
      query: (groupId) => `api/group/${groupId}/members`,
      transformResponse: (response: any): GroupMember[] =>
        Array.isArray(response) ? response : response?.members ?? response?.entries ?? [],
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

    approveGroupMember: builder.mutation<void, { groupId: string; userId: string }>({
      query: ({ groupId, userId }) => ({ url: `api/group/${groupId}/approve/${userId}`, method: 'POST' }),
      invalidatesTags: ['GroupMembers', 'Notifications'],
    }),

    rejectGroupMember: builder.mutation<void, { groupId: string; userId: string }>({
      query: ({ groupId, userId }) => ({ url: `api/group/${groupId}/reject/${userId}`, method: 'POST' }),
      invalidatesTags: ['GroupMembers', 'Notifications'],
    }),

    // ── Rallys ───────────────────────────────────────────────────────────────

    getRallys: builder.query<PaginatedResponse<Rally>, {
      page?: number; limit?: number; time_filter?: 'upcoming' | 'past';
      /** Both required together — the server pairs them into a month range. */
      year?: number; month?: number;
    }>({
      query: ({ page = 0, limit = 12, time_filter, year, month } = {}) => ({
        url: 'api/rally',
        params: {
          page, limit,
          ...(time_filter ? { time_filter } : {}),
          ...(year && month ? { year, month } : {}),
        },
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

    createGroupForumPost: builder.mutation<void, { group_id: string; title: string; body: string; category?: string }>({
      query: (body) => ({ url: 'api/groupforum/create', method: 'POST', body }),
      invalidatesTags: (result, error, { group_id }) => [{ type: 'GroupForum', id: group_id }],
    }),

    // Both endpoints toggle: voting the same way twice clears your vote, and
    // voting the other way switches it. `group_id` is only for invalidation.
    upvoteGroupForumPost: builder.mutation<void, { internal_id: string; group_id: string }>({
      query: ({ internal_id }) => ({ url: 'api/groupforum/upvote', method: 'POST', body: { internal_id } }),
      invalidatesTags: (result, error, { group_id }) => [{ type: 'GroupForum', id: group_id }],
    }),

    downvoteGroupForumPost: builder.mutation<void, { internal_id: string; group_id: string }>({
      query: ({ internal_id }) => ({ url: 'api/groupforum/downvote', method: 'POST', body: { internal_id } }),
      invalidatesTags: (result, error, { group_id }) => [{ type: 'GroupForum', id: group_id }],
    }),

    // ── Group News ────────────────────────────────────────────────────────────

    getGroupNews: builder.query<{ entries: GroupNewsPost[] }, { groupId: string; page?: number; limit?: number }>({
      query: ({ groupId, page = 0, limit = 30 }) => ({
        url: `api/groupnews/${page}/none/${limit}`,
        params: { group_id: groupId },
      }),
      providesTags: (result, error, { groupId }) => [{ type: 'GroupNews', id: groupId }],
    }),

    // Admin-only server-side; the UI hides the entry point for everyone else.
    createGroupNewsPost: builder.mutation<void, { group_id: string; title: string; body: string; url?: string }>({
      query: (body) => ({ url: 'api/groupnews/create', method: 'POST', body }),
      invalidatesTags: (result, error, { group_id }) => [{ type: 'GroupNews', id: group_id }],
    }),

    // ── Group Resources ───────────────────────────────────────────────────────

    getGroupResources: builder.query<{ entries: GroupResource[] }, { groupId: string; page?: number; limit?: number }>({
      query: ({ groupId, page = 0, limit = 30 }) => ({
        url: `api/groupresource/${page}/none/${limit}`,
        params: { group_id: groupId },
      }),
      providesTags: (result, error, { groupId }) => [{ type: 'GroupResources', id: groupId }],
    }),

    createGroupResource: builder.mutation<void, { group_id: string; title: string; body: string; url?: string; category?: string }>({
      query: (body) => ({ url: 'api/groupresource/create', method: 'POST', body }),
      invalidatesTags: (result, error, { group_id }) => [{ type: 'GroupResources', id: group_id }],
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
      transformResponse: (response: any): Article => response?.entry ?? response,
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
      transformResponse: (response: any): Message[] =>
        Array.isArray(response) ? response : response?.entries ?? [],
      providesTags: (result, error, id) => [{ type: 'Message', id }],
    }),

    getUnreadMessageCount: builder.query<{ count: number }, void>({
      query: () => 'api/message/unread/count',
      providesTags: ['Message'],
    }),

    sendMessage: builder.mutation<Message, { recipient_id: string; subject?: string; body: string; parent_message_id?: string }>({
      query: (data) => ({ url: 'api/message/create', method: 'POST', body: data }),
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
      transformResponse: (response: any): User[] =>
        Array.isArray(response) ? response : response?.entries ?? [],
    }),

    // ── Follow ────────────────────────────────────────────────────────────────

    getFollowStatus: builder.query<{ isFollowing: boolean }, string>({
      query: (username) => `api/protected/followstatus/${username}`,
      providesTags: (result, error, username) => [{ type: 'Following', id: username }],
    }),

    followUser: builder.mutation<void, string>({
      query: (username) => ({ url: `api/follow/set-following`, method: 'POST', body: { username } }),
      invalidatesTags: (result, error, username) => [{ type: 'Following', id: username }, { type: 'Following', id: 'LIST' }],
    }),

    unfollowUser: builder.mutation<void, string>({
      query: (username) => ({ url: `api/follow/set-unfollowing`, method: 'POST', body: { username } }),
      invalidatesTags: (result, error, username) => [{ type: 'Following', id: username }, { type: 'Following', id: 'LIST' }],
    }),

    getUserFollowers: builder.query<{ entries: User[]; total: number }, { userId: string; index?: number; limit?: number }>({
      query: ({ userId, index = 0, limit = 50 }) => `api/follow/user/${userId}/followers/${index}/${limit}`,
      providesTags: [{ type: 'Following', id: 'LIST' }],
    }),

    getUserFollowing: builder.query<{ entries: User[]; total: number }, { userId: string; index?: number; limit?: number }>({
      query: ({ userId, index = 0, limit = 50 }) => `api/follow/user/${userId}/following/${index}/${limit}`,
      providesTags: [{ type: 'Following', id: 'LIST' }],
    }),

    // ── Tags ──────────────────────────────────────────────────────────────────

    getTagsByPost: builder.query<Tag[], string>({
      query: (postId) => `api/tags/post/${postId}`,
      providesTags: (result, error, id) => [{ type: 'Tags', id }],
    }),

    getPreviouslyTaggedUsers: builder.query<{ users: User[]; total: number }, number | void>({
      query: (limit = 12) => `api/tags/previously-tagged/users?limit=${limit ?? 12}`,
    }),

    getPreviouslyTaggedCars: builder.query<{ cars: GarageCar[]; total: number }, number | void>({
      query: (limit = 12) => `api/tags/previously-tagged/cars?limit=${limit ?? 12}`,
    }),

    getPreviouslyTaggedEvents: builder.query<{ events: Event[]; total: number }, number | void>({
      query: (limit = 12) => `api/tags/previously-tagged/events?limit=${limit ?? 12}`,
    }),

    // Falls back to the groups you're a member of when you haven't tagged any
    // yet, so the picker opens with something useful rather than blank.
    getPreviouslyTaggedGroups: builder.query<{ groups: Group[]; total: number }, number | void>({
      query: (limit = 12) => `api/tags/previously-tagged/groups?limit=${limit ?? 12}`,
    }),

    // `entity_type` selects which collection the id is looked up in — posts by
    // default, or 'article' / 'route'. The Tag records themselves are generic.
    syncPostTags: builder.mutation<void, {
      post_id: string;
      tagged_users: string[];
      tagged_cars: string[];
      tagged_events: string[];
      tagged_groups?: string[];
      entity_type?: 'post' | 'article' | 'route';
    }>({
      query: (body) => ({ url: 'api/tags/sync', method: 'POST', body }),
      invalidatesTags: (result, error, { post_id }) => [{ type: 'Post', id: `tags-${post_id}` }],
    }),

    getPostTags: builder.query<{ tag_internal_id: string; tag_entry_type: string }[], string>({
      query: (postId) => `api/tags/post/${postId}`,
      transformResponse: (r: any) => (Array.isArray(r) ? r : r?.tags ?? []),
      providesTags: (result, error, postId) => [{ type: 'Post', id: `tags-${postId}` }],
    }),

    // ── Search ────────────────────────────────────────────────────────────────

    search: builder.query<any, string>({
      query: (q) => `api/search/${encodeURIComponent(q)}`,
    }),

    // ── User settings ─────────────────────────────────────────────────────────

    updateUserSetting: builder.mutation<{ success: boolean; message?: string }, { type: string; [key: string]: any }>({
      query: ({ type, ...body }) => ({
        url: `api/users/settings/update/${type}`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User'],
    }),

    /**
     * Dismissals of the home feed's suggestion rows and feature banner.
     * Only the keys you send are written; the rest are left as they were.
     */
    updateFeedPreferences: builder.mutation<
      { success: boolean; feedPreferences: FeedPreferences },
      { hideSuggestions?: 'none' | 'temporary' | 'permanent'; dismissedHomeBannerId?: string | null }
    >({
      query: (body) => ({
        url: 'api/users/settings/update/feedPreferences',
        method: 'POST',
        body,
      }),
      // Applied locally before the request leaves. Dismissing a feed module is a
      // "make this go away" gesture, and waiting out a round trip plus a refetch
      // leaves the thing you just closed sitting there long enough to tap again.
      // The patch is undone if the write fails, so the row reappears rather than
      // lying about being hidden.
      async onQueryStarted(patch, { dispatch, queryFulfilled }) {
        const undo = dispatch(
          apiService.util.updateQueryData('getLoggedInUser', undefined, (draft) => {
            draft.feedPreferences = { ...draft.feedPreferences };
            if (patch.hideSuggestions !== undefined) {
              draft.feedPreferences.hideSuggestions = patch.hideSuggestions;
              // Mirrors the server's SUGGESTIONS_HIDE_DAYS so the optimistic
              // state and the confirmed one agree on when the rows come back.
              draft.feedPreferences.hideSuggestionsUntil = patch.hideSuggestions === 'temporary'
                ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                : null;
            }
            if (patch.dismissedHomeBannerId !== undefined) {
              draft.feedPreferences.dismissedHomeBannerId = patch.dismissedHomeBannerId;
            }
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          undo.undo();
        }
      },
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

    checkUsername: builder.mutation<{ msg: 'true' | 'false' }, { username: string }>({
      query: (body) => ({ url: 'api/users/checkUsername', method: 'POST', body }),
    }),

    checkEmail: builder.mutation<{ msg: 'true' | 'false' }, { email: string }>({
      query: (body) => ({ url: 'api/users/checkEmail', method: 'POST', body }),
    }),

    // Groups a car belongs to — both explicitly filed (car.group_id) and by its
    // owner's membership in a group whose make/model the car matches. The
    // second kind never writes to the car, so `car.group_id` alone undercounts.
    getCarGroups: builder.query<{ entries: Group[]; total: number }, string>({
      query: (carId) => `api/garage/${carId}/groups`,
      transformResponse: (response: any): { entries: Group[]; total: number } => {
        const entries = Array.isArray(response) ? response : response?.entries ?? [];
        return { entries, total: response?.total ?? entries.length };
      },
      providesTags: ['Group'],
    }),

    getGroupCars: builder.query<{ entries: GarageCar[] }, string>({
      query: (groupId) => `api/garage/group/${groupId}`,
      transformResponse: (response: any): { entries: GarageCar[] } => ({
        entries: Array.isArray(response) ? response : response?.entries ?? [],
      }),
      providesTags: (result, error, id) => [{ type: 'Cars', id }],
    }),

    updateCarGroup: builder.mutation<void, { carId: string; groupId: string | null }>({
      query: ({ carId, groupId }) => {
        const fd = new FormData();
        fd.append('internal_id', carId);
        fd.append('group_id', groupId ?? '');
        return { url: 'api/car/update', method: 'POST', body: fd };
      },
      invalidatesTags: ['GarageCar', 'Cars'],
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

    getSiteSettings: builder.query<{
      featured_cars?: GarageCar[];
      featured_users?: User[];
      home_banner?: HomeBanner | null;
    }, void>({
      query: () => 'api/site-settings',
      providesTags: ['SiteSettings'],
    }),

    /** Admin only. The image rides on the `hero_image` FormData field. */
    updateHomeBanner: builder.mutation<{ success: boolean; home_banner: HomeBanner }, FormData>({
      query: (formData) => ({ url: 'api/site-settings/home-banner', method: 'POST', body: formData }),
      invalidatesTags: ['SiteSettings'],
    }),

    deleteHomeBanner: builder.mutation<{ success: boolean }, void>({
      query: () => ({ url: 'api/site-settings/home-banner/delete', method: 'POST' }),
      invalidatesTags: ['SiteSettings'],
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

    // ── Reports ─────────────────────────────────────────────────────────────

    createReport: builder.mutation<void, { content_type: 'post' | 'car' | 'comment' | 'user'; content_id: string; reason?: string }>({
      query: (body) => ({ url: 'api/reports/create', method: 'POST', body }),
      invalidatesTags: ['FlaggedContent', 'Post', 'Cars', 'Comment'],
    }),

    getFlaggedContent: builder.query<{ posts: any[]; cars: any[]; comments: any[]; users: any[] }, void>({
      query: () => 'api/reports/flagged',
      // Backend returns a flat { entries } list where each item is tagged with
      // _content_type; group it into the shape the dashboard expects.
      transformResponse: (r: any): { posts: any[]; cars: any[]; comments: any[]; users: any[] } => {
        const entries: any[] = Array.isArray(r?.entries) ? r.entries : (Array.isArray(r) ? r : []);
        const byType = (t: string) => entries.filter((e) => e?._content_type === t);
        return {
          posts: byType('post'),
          cars: byType('garagecar'),
          comments: byType('comment'),
          users: byType('user'),
        };
      },
      providesTags: ['FlaggedContent'],
    }),

    removeContent: builder.mutation<void, { content_type: 'post' | 'car' | 'comment' | 'user'; content_id: string }>({
      query: (body) => ({ url: 'api/reports/remove', method: 'POST', body }),
      invalidatesTags: ['FlaggedContent', 'Post', 'Cars', 'Comment'],
    }),

    restoreContent: builder.mutation<void, { content_type: 'post' | 'car' | 'comment' | 'user'; content_id: string }>({
      query: (body) => ({ url: 'api/reports/restore', method: 'POST', body }),
      invalidatesTags: ['FlaggedContent', 'Post', 'Cars', 'Comment'],
    }),

    // ── Block ─────────────────────────────────────────────────────────────────

    blockUser: builder.mutation<void, { blocked_id: string }>({
      query: (body) => ({ url: 'api/block/block', method: 'POST', body }),
      invalidatesTags: ['Block'],
    }),

    unblockUser: builder.mutation<void, { blocked_id: string }>({
      query: (body) => ({ url: 'api/block/unblock', method: 'POST', body }),
      invalidatesTags: ['Block'],
    }),

    getBlockedUsers: builder.query<{ entries: User[] }, void>({
      query: () => 'api/block/blocked-users',
      providesTags: ['Block'],
    }),

  }),
});

// Export hooks
export const {
  useGetLoggedInUserQuery,
  useGetUserByIdQuery,
  useGetPublicUserQuery,
  useLazyGetPublicUserQuery,
  useGetPublicUserByIdQuery,
  useGetUserStatsQuery,
  useSearchUsersQuery,
  useGetUsersQuery,
  useGetFeedQuery,
  useGetPostsQuery,
  useGetPostQuery,
  useCreatePostMutation,
  useCreateMuxUploadUrlMutation,
  useAddPostImageMutation,
  useUpdatePostMutation,
  useDeletePostMutation,
  useGetLikeInfoQuery,
  useGetPostCountsQuery,
  useGetBatchLikesMutation,
  useLikeEntryMutation,
  useUnlikeEntryMutation,
  useGetLikeUsersQuery,
  useGetCommentsQuery,
  useGetCommentRepliesQuery,
  useGetCommentCountQuery,
  useCreateCommentMutation,
  useDeleteCommentMutation,
  useGetCarsQuery,
  useGetCarQuery,
  useGetCarWithUserQuery,
  useGetUserGarageQuery,
  useAnalyzeDiecastMutation,
  useGetFollowingGarageQuery,
  useCreateCarMutation,
  useUpdateCarMutation,
  useDeleteCarMutation,
  useGetCarBrandsQuery,
  useGetCarModelsQuery,
  useFollowCarMutation,
  useUnfollowCarMutation,
  useGetCarFollowStatusQuery,
  useGetCarFollowersQuery,
  useGetCarFollowerCountQuery,
  useGetFollowedCarsQuery,
  useGetCarGalleriesQuery,
  useCreateCarGalleryMutation,
  useGetCarModsQuery,
  useCreateModMutation,
  useUpdateModMutation,
  useDeleteModMutation,
  useUpdateCarGalleryMutation,
  useDeleteCarGalleryMutation,
  useCreateCarGalleryShellMutation,
  useAddCarGalleryImageMutation,
  useRemoveCarGalleryImagesMutation,
  useUpdateCarGalleryMetaMutation,
  useGetCarTasksQuery,
  useGetArchivedCarTasksQuery,
  useCreateCarTaskMutation,
  useUpdateCarTaskMutation,
  useToggleCarTaskMutation,
  useUpdateCarTaskPositionsMutation,
  useDeleteCarTaskMutation,
  useGetUpcomingEventsQuery,
  useGetEventCalendarQuery,
  useGetSocietyEventQuery,
  useGetEventInterestedUsersQuery,
  useGetEventTaggedPostsQuery,
  useGetFollowingEventsQuery,
  useGetMyEventsQuery,
  useGetMyEventsCountQuery,
  useToggleEventInterestMutation,
  useCreateSocietyEventMutation,
  useUpdateSocietyEventMutation,
  useDeleteSocietyEventMutation,
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
  useApproveGroupMemberMutation,
  useRejectGroupMemberMutation,
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
  useGetUserFollowersQuery,
  useGetUserFollowingQuery,
  useGetTagsByPostQuery,
  useGetPreviouslyTaggedUsersQuery,
  useGetPreviouslyTaggedCarsQuery,
  useGetPreviouslyTaggedEventsQuery,
  useSyncPostTagsMutation,
  useGetPostTagsQuery,
  useSearchQuery,
  useUpdateUserSettingMutation,
  useUpdateUserSettingImageMutation,
  useUpdateFeedPreferencesMutation,
  useCheckUsernameMutation,
  useCheckEmailMutation,
  useGetGroupCarsQuery,
  useGetCarGroupsQuery,
  useCreateGroupForumPostMutation,
  useUpvoteGroupForumPostMutation,
  useDownvoteGroupForumPostMutation,
  useCreateGroupNewsPostMutation,
  useCreateGroupResourceMutation,
  useUpdateCarGroupMutation,
  useDeleteAccountMutation,
  useRegisterDeviceTokenMutation,
  useGetStoriesFeedQuery,
  useMarkStoriesSeenMutation,
  useGetSiteSettingsQuery,
  useUpdateHomeBannerMutation,
  useDeleteHomeBannerMutation,
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
  useCreateReportMutation,
  useGetFlaggedContentQuery,
  useRemoveContentMutation,
  useRestoreContentMutation,
  useBlockUserMutation,
  useUnblockUserMutation,
  useGetBlockedUsersQuery,
  useGetPreviouslyTaggedGroupsQuery,
  useGetRoutesQuery,
  useGetNearbyPlacesQuery,
  useGetRouteQuery,
  useCreateRouteMutation,
  useUpdateRouteMutation,
  useDeleteRouteMutation,
  useVoteRouteMutation,
  useUnvoteRouteMutation,
} = apiService;

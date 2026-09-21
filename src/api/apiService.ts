import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './baseQuery';
import type {
  User, GarageCar, Post, Event, SocietyEvent, Group, GroupMember, Article,
  CarTask, Mod, Message, Notification, Tag, PaginatedResponse, LikeInfo, LoginResponse,
  GroupVoteResult,
  Rally, GroupDiscussionPost, GroupNewsPost, GroupResource, CarGalleryAlbum, GalleryItem, DiecastAnalysis,
  DrivingRoute, DrivingRouteDetail, RouteListParams, RouteVoteResult, NearbyPlace,
  FeedPreferences, HomeBanner, CarActivityItem,
  DeclinedInvite, ReportableType, ShopProduct, NotificationType, NotificationSettings,
  PhotoSpot, PhotoSpotUsage, PlacePrediction, PlaceDetail, GroupActivityItem,
  MonthlyUsage, HideMode, SetupPrompt, EventLocationParams,
  Listing, ListingMeta, ListingBrowseParams, ListingBrowseResponse,
  ListingDetailResponse, MyListingsResponse,
  MarketplaceThread, MarketplaceThreadPage, MarketplaceMessage,
  MarketplaceRoleFilter, MarketplaceUnreadCount,
  Alert, AlertsResponse, AlertMeta, AlertInput, AlertWriteResponse, AlertCounts,
} from '../types/api';

/**
 * Where horacio mounts the lists router.
 *
 * One constant rather than nine string literals, because this path has a
 * history: the router shipped with no mount in `server.js` at all, so every
 * call here 404'd. It's now mounted twice — `api/lists`, which this app and
 * murray were both written against, and `api/list`, the singular the rest of
 * the API uses. The plural stays: it's the one older builds in the wild call,
 * so it's the one that can never be dropped.
 */
const LIST_API = 'api/lists';

export const apiService = createApi({
  reducerPath: 'apiService',
  baseQuery,
  tagTypes: [
    'User', 'Post', 'Cars', 'GarageCar', 'UserEntries', 'Like', 'Comment',
    'SocietyEvent', 'EventInterest',
    'Brands', 'Models', 'Articles', 'ArticleBlocks', 'Events', 'Projects',
    'Mods', 'CarGallery', 'CarTask', 'Message', 'Tags', 'Notifications',
    'CarFollow', 'Group', 'GroupMembers', 'GroupDiscussion', 'GroupNews',
    'GroupResources', 'Following', 'Rally', 'Marketplace', 'Stories', 'Podcasts', 'List',
    'Block', 'FlaggedContent', 'Route', 'SiteSettings', 'DeclinedInvites', 'Product',
    'PhotoSpot', 'ArchivedCars',
    /**
     * Custom alerts. Its own tag, and also invalidated onto 'User' by every
     * write — the dashboard's usage panel reads the alert count off
     * `/api/users/usage`, so creating a rule has to move that bar too.
     */
    'Alert',
    // The marketplace's own collection. 'Marketplace' above still covers the
    // post-shaped listings that predate it — the migration hasn't run.
    'Listing',
    /**
     * Marketplace conversations, kept apart from 'Message' on purpose.
     *
     * The server stores them in their own collection so a marketplace message
     * can never land in the main inbox or its badge (see horacio's
     * models/MarketplaceThread). Sharing the 'Message' tag here would undo that
     * on the client: sending an offer would refetch the inbox, and the inbox's
     * unread query would be invalidated by a conversation it can't show.
     */
    'MarketplaceThread', 'MarketplaceUnread',
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

    /**
     * What this member has used of their allowances, for the dashboard meters.
     *
     * Its own endpoint because it costs a count query — the profile is polled
     * constantly and shouldn't carry it. Tagged on 'Post' so publishing one
     * moves the bar without a manual refetch.
     */
    getUsage: builder.query<{
      posts: MonthlyUsage;
      /** Absent from servers older than the event limit. */
      events?: MonthlyUsage;
      /**
       * Marketplace listings this month. Absent from servers older than the
       * listing limit — everything that reads it treats missing as "ungated".
       * Diecast listings are Pro-only and aren't counted here.
       */
      listings?: MonthlyUsage;
      cars: { used: number; limit: number | null };
      /**
       * Custom alerts a member has standing.
       *
       * A standing count like cars, not a monthly allowance — an alert isn't
       * spent when it fires, so there's no `resets_at`. Unlike every other
       * meter here, `limit` is never null: Pro is capped at 20 too, so this
       * one is a fraction for everybody. Still optional, so a build talking to
       * a server without it falls back to `/api/alerts`'s own `counts`.
       */
      alerts?: AlertCounts;
      routes: { pro_only: boolean; allowed: boolean };
      /** Diecast listings are Pro-only. Absent from older servers. */
      diecast?: { pro_only: boolean; allowed: boolean };
      isPro: boolean;
    }, void>({
      query: () => 'api/users/usage',
      providesTags: ['User', 'Post', 'SocietyEvent', 'Listing', 'Alert'],
    }),

    getUserStats: builder.query<{
      postsCount: number; garageCarsCount: number; followersCount: number;
      followingCount: number; followedCarsCount: number; projectsCount: number;
      eventsCount: number; groupsCount: number;
    }, void>({
      query: () => 'api/users/stats',
      providesTags: ['User'],
    }),

    /**
     * Emails a friend a link to sign up. The server records the invite against
     * you, so their account can be connected to yours when they register.
     */
    inviteFriend: builder.mutation<{ success: boolean; email: string; resent: boolean }, { email: string }>({
      query: (body) => ({ url: 'api/users/invite', method: 'POST', body }),
    }),

    /**
     * "My car isn't in the list" — from inside the create form.
     *
     * The make/model lists come from a reference table, so a missing marque is
     * only ours to fix. This mails it in rather than making someone abandon
     * the car and find support afterwards.
     */
    requestCarModel: builder.mutation<{ success: boolean }, { message: string }>({
      query: (body) => ({ url: 'api/users/car-request', method: 'POST', body }),
    }),

    searchUsers: builder.query<PaginatedResponse<User>, string>({
      query: (q) => ({ url: 'api/users/search', params: { q } }),
    }),

    // `region` is a US region key — see constants/regions. It narrows on the
    // state in the member's cityState and composes with the search term.
    getUsers: builder.query<
      PaginatedResponse<User>,
      ({ page?: number; limit?: number; q?: string } & EventLocationParams) | void
    >({
      query: (args = {}) => {
        const { page = 0, limit = 20, q, ...location } = args ?? {};
        return {
          url: 'api/users',
          params: { page, limit, ...(q ? { q } : {}), ...location },
        };
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
      /**
       * Home feed only: also return listings and want ads shared only to groups
       * you're a member of. The server answers per-viewer when this is set.
       */
      include_groups?: boolean;
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

    /**
     * How many comments something has, right now.
     *
     * Not something cards ask for on their own — the list payloads already
     * carry `comment_count`, and a request per card in a scrolling feed would
     * be exactly the cost those payloads exist to avoid. It's fetched by the
     * create/delete mutations below, for the one document whose count they just
     * changed, and CommentButton picks the result up from the cache in place of
     * the payload's snapshot. See CommentButton.
     *
     * Keyed on the id alone: a button knows which document it counts but not
     * always the type its comments were filed under, and ids are unique across
     * types anyway. The type still goes to the server when the caller has one,
     * because builds of the API before the count endpoint was loosened reject a
     * request without it.
     *
     * No tags, deliberately. The mutations refetch this explicitly once they've
     * landed; if it also provided 'Comment', the blanket invalidation they fire
     * would race that refetch and could drop the entry while no card holds it.
     */
    getCommentCount: builder.query<number, { id: string; type?: string }>({
      query: ({ id, type }) => ({
        url: 'api/comment/count',
        params: { entry_id: id, ...(type ? { entry_type: type } : {}) },
      }),
      serializeQueryArgs: ({ queryArgs }) => ({ id: queryArgs.id }),
      transformResponse: (res: { count?: number }) => res?.count ?? 0,
      // A number per document you've commented on this session — nothing to
      // economise on, and dropping it after the default minute would put a
      // card scrolled back into view on its stale payload count again.
      keepUnusedDataFor: 60 * 60,
    }),

    createComment: builder.mutation<any, FormData>({
      query: (body) => ({ url: 'api/comment/create', method: 'POST', body }),
      invalidatesTags: ['Comment'],
      // The server answers with the comment it saved, which names the document
      // — easier than reading it back out of a FormData.
      async onQueryStarted(_body, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const entry = data?.entry;
          if (!entry?.document_id) return;
          dispatch(apiService.endpoints.getCommentCount.initiate(
            { id: entry.document_id, type: entry.document_entry_type },
            { subscribe: false, forceRefetch: true },
          ));
        } catch { /* the caller reports the failure */ }
      },
    }),

    /**
     * Deletes your own comment. `removed: true` in the response means it had
     * replies and was tombstoned in place rather than taken away — see the
     * server's deleteEntry.
     *
     * Pass the object form where you know what the comment was on, so the count
     * shown on that thing's card can be refreshed; the bare id still works and
     * just leaves counts alone.
     */
    deleteComment: builder.mutation<
      { success: boolean; removed: boolean },
      string | { id: string; documentId?: string; documentType?: string }
    >({
      // `internal_id` is what the server reads; the old `comment_id` key meant
      // this silently matched nothing and reported success.
      query: (arg) => ({
        url: `api/comment/delete`,
        method: 'POST',
        body: { internal_id: typeof arg === 'string' ? arg : arg.id },
      }),
      invalidatesTags: ['Comment'],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        if (typeof arg === 'string' || !arg.documentId) return;
        try {
          await queryFulfilled;
          dispatch(apiService.endpoints.getCommentCount.initiate(
            { id: arg.documentId, type: arg.documentType },
            { subscribe: false, forceRefetch: true },
          ));
        } catch { /* the caller reports the failure */ }
      },
    }),

    // ── Cars / Garage ────────────────────────────────────────────────────────

    // `make`/`model` are only honoured alongside `filter: 'related'`, and match
    // against the handle forms (`make_handle`) rather than the display names.
    getCars: builder.query<
      PaginatedResponse<GarageCar>,
      { page?: number; limit?: number; filter?: string; make?: string; model?: string; username?: string; user_id?: string; search?: string } & EventLocationParams
    >({
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

    /**
     * The gentler answers to "delete this car" — see the car's `archived`
     * field. Each invalidates both garage lists, since every one of them moves
     * a car between the two.
     */
    getArchivedGarage: builder.query<{ entries: GarageCar[] }, void>({
      query: () => 'api/protected/archived/garage',
      providesTags: ['ArchivedCars'],
    }),

    archiveCar: builder.mutation<{ entry: GarageCar }, { internal_id: string }>({
      query: (body) => ({ url: 'api/car/archive', method: 'POST', body }),
      invalidatesTags: ['GarageCar', 'Cars', 'ArchivedCars'],
    }),

    restoreCar: builder.mutation<{ entry: GarageCar }, { internal_id: string }>({
      query: (body) => ({ url: 'api/car/restore', method: 'POST', body }),
      invalidatesTags: ['GarageCar', 'Cars', 'ArchivedCars'],
    }),

    transferCar: builder.mutation<{ entry: GarageCar }, { internal_id: string; user_id: string }>({
      query: (body) => ({ url: 'api/car/transfer', method: 'POST', body }),
      invalidatesTags: ['GarageCar', 'Cars', 'ArchivedCars'],
    }),

    // Answering an offer settles the notification that carried it, so the
    // buttons on that card stop being live.
    acceptCarTransfer: builder.mutation<{ entry: GarageCar }, { internal_id: string }>({
      query: (body) => ({ url: 'api/car/transfer/accept', method: 'POST', body }),
      invalidatesTags: ['GarageCar', 'Cars', 'ArchivedCars', 'Notifications'],
    }),

    // Also the sender's cancel — the server accepts either side.
    declineCarTransfer: builder.mutation<{ entry: GarageCar }, { internal_id: string }>({
      query: (body) => ({ url: 'api/car/transfer/decline', method: 'POST', body }),
      invalidatesTags: ['GarageCar', 'Cars', 'ArchivedCars', 'Notifications'],
    }),

    getPendingCarTransfers: builder.query<{ entries: GarageCar[] }, void>({
      query: () => 'api/car/transfers/pending',
      providesTags: ['ArchivedCars'],
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

    /**
     * Every make on the reference list — what the make field may hold.
     *
     * Not `getCarBrands`: that one is the makes members have actually put in
     * garages, with counts, and it drives the brand pages. A car being created
     * picks from the full list (the `cars` collection), so the first Luscombe
     * on the site isn't blocked by nobody having entered one before.
     *
     * Fetched whole (about a hundred names) and filtered as you type, so a
     * keystroke never waits on the network. Held for an hour once unused: the
     * list changes by hand, rarely.
     */
    getCarMakeOptions: builder.query<string[], void>({
      query: () => 'api/cars/makes',
      transformResponse: (response: { makes: string[] }) => response.makes ?? [],
      keepUnusedDataFor: 3600,
    }),

    /**
     * The models of one make from the reference list — what the model field may
     * hold once a make is picked. Whole list per make (Ford's is the longest, at
     * under two hundred), filtered locally like the makes.
     */
    getCarModelOptions: builder.query<string[], string>({
      query: (make) => ({ url: 'api/cars/models', params: { make } }),
      transformResponse: (response: { models: string[] }) => response.models ?? [],
      keepUnusedDataFor: 3600,
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

    // Mods and galleries added to cars the user follows — merged into the home
    // feed beside posts and garage additions.
    getFollowedCarActivity: builder.query<{ entries: CarActivityItem[]; total: number }, { limit?: number } | void>({
      query: ({ limit = 20 } = {}) => ({ url: 'api/carfollow/activity', params: { limit } }),
      transformResponse: (r: any): { entries: CarActivityItem[]; total: number } => {
        const entries = (r?.entries ?? []).filter((e: any) => e?.car);
        return { entries, total: r?.total ?? entries.length };
      },
      // Follow a car, or add a mod/gallery to one, and this list is stale.
      providesTags: ['CarFollow', 'Mods', 'CarGallery'],
    }),

    /**
     * Anyone's posts that tagged this car — distinct from its records, which
     * are the owner's own posts filed against it.
     */
    getCarTaggedPosts: builder.query<{ entries: Post[]; total: number }, { carId: string; page?: number; limit?: number }>({
      query: ({ carId, page = 0, limit = 12 }) => ({
        url: `api/car/${carId}/tagged-posts`,
        params: { page, limit },
      }),
      providesTags: (result, error, { carId }) => [{ type: 'Tags', id: `car-${carId}` }],
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
      // `/delete/:taskId`, not `/:taskId` — the bare path matches no route, so
      // every delete came back 404 and the task stayed put.
      query: ({ taskId }) => ({ url: `api/cartask/delete/${taskId}`, method: 'DELETE' }),
      // The archived list is a separate cache entry and holds tasks too, so a
      // delete from it has to drop that entry as well.
      invalidatesTags: (result, error, { car_id }) => [
        { type: 'CarTask', id: car_id },
        { type: 'CarTask', id: `${car_id}-archived` },
      ],
    }),

    // ── Events ───────────────────────────────────────────────────────────────

    // ── Society events (rebuilt model) ───────────────────────────────────
    // Occurrences are expanded server-side from each event's schedule, so a
    // "first and third Saturday" event arrives with real dates like any other.
    getUpcomingEvents: builder.query<
      { entries: SocietyEvent[]; total: number; near_unavailable?: boolean },
      ({ limit?: number; category?: string; days?: number } & EventLocationParams) | void
    >({
      query: (params) => ({ url: 'api/events/upcoming', params: params ?? {} }),
      providesTags: ['SocietyEvent'],
    }),

    getEventCalendar: builder.query<
      { year: number; month: number; days: Record<string, SocietyEvent[]>; total: number; near_unavailable?: boolean },
      { year: number; month: number; category?: string } & EventLocationParams
    >({
      query: (params) => ({ url: 'api/events/calendar', params }),
      providesTags: ['SocietyEvent'],
    }),

    /** Regions with something coming up, for the events Location filter. */
    getEventRegions: builder.query<{ regions: { key: string; label: string; count: number }[] }, void>({
      query: () => 'api/events/regions',
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

    /**
     * Suggested names for a drive's two ends, for prefilling the save screen.
     * Reverse geocoding, so it answers with a town rather than a business.
     */
    getRouteEndpointNames: builder.query<
      { start: string | null; end: string | null },
      { start_lat: number; start_lng: number; end_lat: number; end_lng: number }
    >({
      query: (params) => ({ url: 'api/routes/endpoint-names', params }),
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

    // Up and down, like a group discussion post: pressing your current side
    // again removes the vote, pressing the other side switches it. The old
    // thumbs-up /vote and /unvote still exist server-side for older builds.
    upvoteRoute: builder.mutation<RouteVoteResult, string>({
      query: (internal_id) => ({ url: 'api/routes/upvote', method: 'POST', body: { internal_id } }),
      invalidatesTags: (result, error, id) => [{ type: 'Route', id }, 'Route'],
    }),

    downvoteRoute: builder.mutation<RouteVoteResult, string>({
      query: (internal_id) => ({ url: 'api/routes/downvote', method: 'POST', body: { internal_id } }),
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

    /**
     * Start a group. Multipart, because a cover photo rides along with it.
     *
     * The server makes the creator an admin of the new group in the same call,
     * so nothing else has to happen for them to be able to run it.
     *
     * An optional `invite_user_ids` field (a JSON array) invites those members
     * once the group is saved; `invited` is how many invitations went out —
     * anyone already in the group, or an invite that failed, is skipped.
     */
    createGroup: builder.mutation<{ _id: string; invited?: number }, FormData>({
      query: (body) => ({ url: 'api/group/create', method: 'POST', body }),
      // Both listings on the groups screen change: the new group belongs in
      // "My Groups" straight away, and it joins the public list too. Both are
      // provided by 'Group', so the one tag refreshes each of them.
      invalidatesTags: ['Group', 'GroupMembers'],
    }),

    /**
     * Edit a group — its name, its images, whatever the settings sheet offers.
     *
     * Multipart, because the same call carries the group's picture and banner.
     * The server writes every field it names from the body rather than patching
     * the ones it was given, so the caller has to send the group's current
     * values alongside whatever it's changing, or the omitted ones are cleared.
     * Admin-only, enforced server-side.
     */
    updateGroup: builder.mutation<Group, FormData>({
      query: (body) => ({ url: 'api/group/update', method: 'POST', body }),
      invalidatesTags: ['Group'],
    }),

    /**
     * Delete a group outright.
     *
     * Admin-only, and the server cascades: memberships, discussion threads, news and
     * resources go with it, posts that lived only here are deleted, and cars,
     * events and rallies merely lose the association. Irreversible.
     */
    deleteGroup: builder.mutation<void, string>({
      query: (groupId) => ({
        url: 'api/group/delete',
        method: 'POST',
        body: { internal_id: groupId },
      }),
      // Everything the group touched can have changed, so the caches that could
      // still be holding its rows are dropped rather than surgically patched.
      invalidatesTags: ['Group', 'GroupMembers', 'Post', 'Notifications'],
    }),

    /**
     * "Tell me when Pro is available."
     *
     * Idempotent on the server — a second tap answers the same 200 with
     * `alreadyRegistered`, so the button can be pressed twice without the
     * waiting list gaining a duplicate.
     */
    registerProInterest: builder.mutation<{ registered: boolean; alreadyRegistered: boolean }, void>({
      query: () => ({ url: 'api/billing/pro-interest', method: 'POST' }),
      // Refetches the profile, which carries `proInterest` — that's what makes
      // the answer survive closing the sheet and opening it again.
      invalidatesTags: ['User'],
    }),

    getGroupMembers: builder.query<GroupMember[], string>({
      query: (groupId) => `api/group/${groupId}/members`,
      transformResponse: (response: any): GroupMember[] =>
        Array.isArray(response) ? response : response?.members ?? response?.entries ?? [],
      providesTags: (result, error, id) => [{ type: 'GroupMembers', id }],
    }),

    // Every membership change also invalidates 'Group': the group document and
    // the group cards carry a member count and the viewer's own membership, so
    // refreshing only the roster leaves those disagreeing with it.
    /**
     * Ask to join a group, optionally bringing a car with you.
     *
     * `car_id` is held against the pending membership and applied when an
     * admin approves — see the server's joinGroup/approveMember.
     */
    joinGroup: builder.mutation<void, string | { groupId: string; car_id?: string }>({
      query: (arg) => {
        const { groupId, car_id } = typeof arg === 'string' ? { groupId: arg, car_id: undefined } : arg;
        return {
          url: `api/group/${groupId}/join`,
          method: 'POST',
          body: car_id ? { car_id } : {},
        };
      },
      invalidatesTags: ['GroupMembers', 'Group'],
    }),

    /**
     * Groups the viewer could join, the ones suiting a car first.
     *
     * Excludes every group they already have any standing with, so nothing
     * here is a dead end.
     */
    getJoinableGroups: builder.query<
      { entries: Group[]; total: number },
      { make?: string; model?: string; q?: string; limit?: number } | void
    >({
      query: (args) => ({ url: 'api/group/joinable', params: args ?? {} }),
      providesTags: ['Group'],
    }),

    leaveGroup: builder.mutation<void, string>({
      query: (groupId) => ({ url: `api/group/${groupId}/leave`, method: 'DELETE' }),
      invalidatesTags: ['GroupMembers', 'Group'],
    }),

    approveGroupMember: builder.mutation<void, { groupId: string; userId: string }>({
      query: ({ groupId, userId }) => ({ url: `api/group/${groupId}/approve/${userId}`, method: 'POST' }),
      invalidatesTags: ['GroupMembers', 'Group', 'Notifications'],
    }),

    rejectGroupMember: builder.mutation<void, { groupId: string; userId: string }>({
      query: ({ groupId, userId }) => ({ url: `api/group/${groupId}/reject/${userId}`, method: 'POST' }),
      invalidatesTags: ['GroupMembers', 'Group', 'Notifications'],
    }),

    /**
     * Promote a member to admin, or demote one back.
     *
     * PATCH rather than POST: it changes one field of a membership that already
     * exists. The server refuses to strip the group's last admin, which is the
     * check that matters — a group with no admin can't be administered back.
     */
    updateGroupMemberType: builder.mutation<void, { groupId: string; userId: string; memberType: 'admin' | 'basic' }>({
      query: ({ groupId, userId, memberType }) => ({
        url: `api/group/${groupId}/member/${userId}`,
        method: 'PATCH',
        body: { member_type: memberType },
      }),
      invalidatesTags: ['GroupMembers', 'Group'],
    }),

    /**
     * Remove someone from a group. Admin-only, and the server refuses to let
     * the last admin remove themselves.
     */
    removeGroupMember: builder.mutation<void, { groupId: string; userId: string }>({
      query: ({ groupId, userId }) => ({ url: `api/group/${groupId}/remove/${userId}`, method: 'DELETE' }),
      invalidatesTags: ['GroupMembers', 'Group'],
    }),

    // ── Invitations ──────────────────────────────────────────────────────
    // The mirror of the join request: an admin asks a member in, and the
    // member answers from their notifications.

    inviteGroupMember: builder.mutation<void, { groupId: string; userId: string }>({
      query: ({ groupId, userId }) => ({ url: `api/group/${groupId}/invite/${userId}`, method: 'POST' }),
      invalidatesTags: ['GroupMembers', 'Group'],
    }),

    /** Accepting is joining: the server sends an invited member straight to active. */
    acceptGroupInvite: builder.mutation<void, string>({
      query: (groupId) => ({ url: `api/group/${groupId}/join`, method: 'POST' }),
      invalidatesTags: ['GroupMembers', 'Group', 'Notifications'],
    }),

    declineGroupInvite: builder.mutation<void, string>({
      query: (groupId) => ({ url: `api/group/${groupId}/decline-invite`, method: 'POST' }),
      invalidatesTags: ['GroupMembers', 'Group', 'Notifications', 'DeclinedInvites'],
    }),

    /**
     * Groups you turned down.
     *
     * A decline is now a standing "no" the group can't invite past, so it needs
     * somewhere to be seen and undone — otherwise it's a decision with no way
     * back.
     */
    getDeclinedInvites: builder.query<{ entries: DeclinedInvite[] }, void>({
      query: () => 'api/group/invitations/declined',
      providesTags: ['DeclinedInvites'],
    }),

    /** Lift a decline, so the group can ask again. Does not rejoin you. */
    allowGroupInvites: builder.mutation<void, string>({
      query: (groupId) => ({ url: `api/group/${groupId}/decline-invite`, method: 'DELETE' }),
      invalidatesTags: ['DeclinedInvites', 'GroupMembers'],
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

    /**
     * Admins (and the organiser who created it) only — horacio 403s anyone
     * else, so the screens gate the control on `accountType` for looks and let
     * the server be the one that decides.
     */
    deleteRally: builder.mutation<void, string>({
      query: (internal_id) => ({ url: 'api/rally/delete', method: 'POST', body: { internal_id } }),
      invalidatesTags: ['Rally'],
    }),

    // ── Shop ─────────────────────────────────────────────────────────────────
    // Reads are open — a product link is something you send someone, and the
    // server serves it without a token. Writes are admin-only and enforced
    // there; the screen only decides whether to offer them.

    getProducts: builder.query<{ entries: ShopProduct[]; total: number }, { limit?: number; category?: string } | void>({
      query: ({ limit = 100, category } = {}) => ({
        url: 'api/product',
        params: { limit, ...(category ? { category } : {}) },
      }),
      providesTags: ['Product'],
    }),

    /** Drafts included. 403s for anyone who isn't an admin, so skip it for them. */
    getAdminProducts: builder.query<{ entries: ShopProduct[]; total: number }, void>({
      query: () => 'api/product/admin/all',
      providesTags: ['Product'],
    }),

    createProduct: builder.mutation<{ entry: ShopProduct }, FormData>({
      query: (body) => ({ url: 'api/product/create', method: 'POST', body }),
      invalidatesTags: ['Product'],
    }),

    updateProduct: builder.mutation<{ entry: ShopProduct }, FormData>({
      query: (body) => ({ url: 'api/product/update', method: 'POST', body }),
      invalidatesTags: ['Product'],
    }),

    deleteProduct: builder.mutation<void, string>({
      query: (internal_id) => ({ url: 'api/product/delete', method: 'POST', body: { internal_id } }),
      invalidatesTags: ['Product'],
    }),

    // ── Calendar ──────────────────────────────────────────────────────────────

    getCalendarEvents: builder.query<{ entries: Event[]; total: number }, { year: number; month: number; group_id?: string }>({
      query: (params) => ({ url: 'api/event/calendar', params }),
      providesTags: ['Events'],
    }),

    // ── Group Discussion ──────────────────────────────────────────────────────

    getGroupDiscussion: builder.query<{ entries: GroupDiscussionPost[] }, { groupId: string; page?: number; limit?: number }>({
      query: ({ groupId, page = 0, limit = 30 }) => ({
        url: `api/groupdiscussion/${page}/none/${limit}`,
        params: { group_id: groupId },
      }),
      providesTags: (result, error, { groupId }) => [{ type: 'GroupDiscussion', id: groupId }],
    }),

    createGroupDiscussionPost: builder.mutation<void, { group_id: string; title: string; body: string; category?: string }>({
      query: (body) => ({ url: 'api/groupdiscussion/create', method: 'POST', body }),
      invalidatesTags: (result, error, { group_id }) => [{ type: 'GroupDiscussion', id: group_id }],
    }),

    // Author or group admin, enforced server-side. `group_id` is only for
    // invalidation; the gallery is left alone because no `existing_gallery` is sent.
    updateGroupDiscussionPost: builder.mutation<void, { internal_id: string; group_id: string; title: string; body: string; category?: string }>({
      query: ({ group_id, ...body }) => ({ url: 'api/groupdiscussion/update', method: 'POST', body }),
      invalidatesTags: (result, error, { group_id }) => [{ type: 'GroupDiscussion', id: group_id }],
    }),

    deleteGroupDiscussionPost: builder.mutation<void, { internal_id: string; group_id: string }>({
      query: ({ internal_id }) => ({ url: 'api/groupdiscussion/delete', method: 'POST', body: { internal_id } }),
      invalidatesTags: (result, error, { group_id }) => [{ type: 'GroupDiscussion', id: group_id }],
    }),

    // Both endpoints toggle: voting the same way twice clears your vote, and
    // voting the other way switches it. `group_id` is only for invalidation.
    /**
     * Voting on group content.
     *
     * `'Group'` is invalidated alongside the section's own tag because the
     * home feed's group-activity row is tagged that way — without it a vote
     * cast from the feed left the count on screen unchanged.
     */
    upvoteGroupDiscussionPost: builder.mutation<GroupVoteResult, { internal_id: string; group_id: string }>({
      query: ({ internal_id }) => ({ url: 'api/groupdiscussion/upvote', method: 'POST', body: { internal_id } }),
      invalidatesTags: (r, e, { group_id }) => [{ type: 'GroupDiscussion', id: group_id }, 'Group'],
    }),

    downvoteGroupDiscussionPost: builder.mutation<GroupVoteResult, { internal_id: string; group_id: string }>({
      query: ({ internal_id }) => ({ url: 'api/groupdiscussion/downvote', method: 'POST', body: { internal_id } }),
      invalidatesTags: (r, e, { group_id }) => [{ type: 'GroupDiscussion', id: group_id }, 'Group'],
    }),

    upvoteGroupResource: builder.mutation<GroupVoteResult, { internal_id: string; group_id: string }>({
      query: ({ internal_id }) => ({ url: 'api/groupresource/upvote', method: 'POST', body: { internal_id } }),
      invalidatesTags: (r, e, { group_id }) => [{ type: 'GroupResources', id: group_id }, 'Group'],
    }),

    downvoteGroupResource: builder.mutation<GroupVoteResult, { internal_id: string; group_id: string }>({
      query: ({ internal_id }) => ({ url: 'api/groupresource/downvote', method: 'POST', body: { internal_id } }),
      invalidatesTags: (r, e, { group_id }) => [{ type: 'GroupResources', id: group_id }, 'Group'],
    }),

    upvoteGroupNews: builder.mutation<GroupVoteResult, { internal_id: string; group_id: string }>({
      query: ({ internal_id }) => ({ url: 'api/groupnews/upvote', method: 'POST', body: { internal_id } }),
      invalidatesTags: (r, e, { group_id }) => [{ type: 'GroupNews', id: group_id }, 'Group'],
    }),

    downvoteGroupNews: builder.mutation<GroupVoteResult, { internal_id: string; group_id: string }>({
      query: ({ internal_id }) => ({ url: 'api/groupnews/downvote', method: 'POST', body: { internal_id } }),
      invalidatesTags: (r, e, { group_id }) => [{ type: 'GroupNews', id: group_id }, 'Group'],
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

    // Same rules as the discussion pair. An empty `url` clears the link.
    updateGroupResource: builder.mutation<void, { internal_id: string; group_id: string; title: string; body: string; url?: string; category?: string }>({
      query: ({ group_id, ...body }) => ({ url: 'api/groupresource/update', method: 'POST', body }),
      invalidatesTags: (result, error, { group_id }) => [{ type: 'GroupResources', id: group_id }],
    }),

    deleteGroupResource: builder.mutation<void, { internal_id: string; group_id: string }>({
      query: ({ internal_id }) => ({ url: 'api/groupresource/delete', method: 'POST', body: { internal_id } }),
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

    deleteAllNotifications: builder.mutation<void, void>({
      query: () => ({ url: 'api/notifications/delete-all', method: 'DELETE' }),
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

    /**
     * Follow status for many people at once — one request for a whole list,
     * instead of one per row. Provides the same per-username tags a single
     * status query does, so following someone refreshes both.
     */
    getFollowStatuses: builder.query<{ statuses: Record<string, boolean> }, string[]>({
      query: (usernames) => ({
        url: 'api/follow/statuses',
        method: 'POST',
        body: { usernames },
      }),
      providesTags: (result, error, usernames) => [
        { type: 'Following' as const, id: 'LIST' },
        ...usernames.map((u) => ({ type: 'Following' as const, id: u })),
      ],
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
    // default, or 'article' / 'route' / 'photospot'. The Tag records themselves
    // are generic, which is why a photo spot can reuse this untouched.
    syncPostTags: builder.mutation<void, {
      post_id: string;
      tagged_users: string[];
      tagged_cars: string[];
      tagged_events: string[];
      tagged_groups?: string[];
      entity_type?: 'post' | 'article' | 'route' | 'photospot';
    }>({
      query: (body) => ({ url: 'api/tags/sync', method: 'POST', body }),
      invalidatesTags: (result, error, { post_id }) => [{ type: 'Post', id: `tags-${post_id}` }],
    }),

    getPostTags: builder.query<{ tag_internal_id: string; tag_entry_type: string }[], string>({
      query: (postId) => `api/tags/post/${postId}`,
      transformResponse: (r: any) => (Array.isArray(r) ? r : r?.tags ?? []),
      providesTags: (result, error, postId) => [{ type: 'Post', id: `tags-${postId}` }],
    }),

    /**
     * Recent posts across every group the member belongs to.
     *
     * Feeds the home feed's group row. Tagged 'Group' so posting into a group
     * refreshes it — the author's own posts are filtered out server-side, but
     * anyone else's should turn up without a manual pull.
     */
    getGroupActivity: builder.query<{ entries: GroupActivityItem[] }, { limit?: number } | void>({
      query: (params) => ({ url: 'api/group/activity', params: params ?? {} }),
      providesTags: ['Group'],
    }),

    // ── Address lookup ────────────────────────────────────────────────────────

    /**
     * Predictions for a partly-typed address or venue.
     *
     * `session` groups a whole typing-then-picking interaction into one billable
     * Google session — the same token must go out with the `getPlaceDetails`
     * call that follows, or every keystroke is billed separately. `useAddressSearch`
     * owns that token; nothing else should call this directly.
     */
    searchPlaces: builder.query<{ predictions: PlacePrediction[] }, {
      q: string; session: string; lat?: number; lng?: number;
    }>({
      query: (params) => ({ url: 'api/places/search', params }),
    }),

    /** The coordinate behind a chosen prediction — a prediction has none. */
    getPlaceDetails: builder.query<{ place: PlaceDetail | null }, {
      place_id: string; session: string;
    }>({
      query: (params) => ({ url: 'api/places/details', params }),
    }),

    // ── Photography spots ─────────────────────────────────────────────────────

    /**
     * The pins inside the map's current viewport.
     *
     * Bounds are optional: without them the server returns the most recent
     * spots, which is what a cold start wants before the map has reported a
     * camera. Cached per viewport rather than as one list — panning is a new
     * query, and re-using the previous rectangle's answer would leave pins
     * hanging off the edge of the screen.
     */
    getPhotoSpots: builder.query<{ entries: PhotoSpot[]; total: number }, {
      north?: number; south?: number; east?: number; west?: number;
      type?: string; category?: string; user_id?: string; limit?: number;
    } | void>({
      query: (params) => ({ url: 'api/photospot', params: params ?? {} }),
      providesTags: ['PhotoSpot'],
    }),

    getPhotoSpot: builder.query<PhotoSpot, string>({
      query: (id) => `api/photospot/detail/${id}`,
      transformResponse: (r: any) => r?.entry ?? r,
      providesTags: (result, error, id) => [{ type: 'PhotoSpot', id }],
    }),

    /** Drawn as a meter on the create screen, and what disables the add button. */
    getPhotoSpotUsage: builder.query<PhotoSpotUsage, void>({
      query: () => 'api/photospot/usage',
      providesTags: [{ type: 'PhotoSpot', id: 'usage' }],
    }),

    createPhotoSpot: builder.mutation<{ entry: PhotoSpot }, FormData>({
      // FormData: a spot carries the photos taken there alongside its fields.
      query: (body) => ({ url: 'api/photospot/create', method: 'POST', body }),
      invalidatesTags: ['PhotoSpot'],
    }),

    updatePhotoSpot: builder.mutation<{ entry: PhotoSpot }, FormData>({
      query: (body) => ({ url: 'api/photospot/update', method: 'POST', body }),
      invalidatesTags: ['PhotoSpot'],
    }),

    deletePhotoSpot: builder.mutation<{ success: boolean; usage: PhotoSpotUsage }, string>({
      query: (internal_id) => ({
        url: 'api/photospot/delete', method: 'POST', body: { internal_id },
      }),
      invalidatesTags: ['PhotoSpot'],
    }),

    // ── Search ────────────────────────────────────────────────────────────────

    search: builder.query<any, string>({
      query: (q) => `api/search/${encodeURIComponent(q)}`,
    }),

    // ── User settings ─────────────────────────────────────────────────────────

    /**
     * The rows the notification table renders.
     *
     * Served rather than hardcoded, so adding a notification type is one entry
     * in horacio's helpers/notificationPrefs and both apps pick it up without
     * a release.
     */
    getNotificationTypes: builder.query<{ types: NotificationType[] }, void>({
      query: () => 'api/users/settings/notification-types',
    }),

    /** Per-type push/email preferences. Writes to the authenticated user. */
    updateNotificationSettings: builder.mutation<
      { success: boolean; notificationSettings: NotificationSettings },
      NotificationSettings
    >({
      query: (notificationSettings) => ({
        url: 'api/users/settings/update/notifications',
        method: 'POST',
        body: { notificationSettings: JSON.stringify(notificationSettings) },
      }),
      invalidatesTags: ['User'],
    }),

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
      {
        hideSuggestedMembers?: HideMode;
        hideSuggestedCars?: HideMode;
        dismissedHomeBannerId?: string | null;
        /** Adds one step to the dismissed set; the server never removes any. */
        dismissSetupPrompt?: SetupPrompt;
      }
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
            for (const key of ['hideSuggestedMembers', 'hideSuggestedCars'] as const) {
              const mode = patch[key];
              if (mode === undefined) continue;
              draft.feedPreferences[key] = mode;
              // Mirrors the server's SUGGESTIONS_HIDE_DAYS so the optimistic
              // state and the confirmed one agree on when the row comes back.
              draft.feedPreferences[`${key}Until`] = mode === 'temporary'
                ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                : null;
            }
            if (patch.dismissedHomeBannerId !== undefined) {
              draft.feedPreferences.dismissedHomeBannerId = patch.dismissedHomeBannerId;
            }
            if (patch.dismissSetupPrompt) {
              const dismissed = new Set(draft.feedPreferences.dismissedSetupPrompts ?? []);
              dismissed.add(patch.dismissSetupPrompt);
              draft.feedPreferences.dismissedSetupPrompts = [...dismissed];
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

    /**
     * Admin: the featured rows on the Members and Cars screens. Each saves its
     * whole list — array order is display order — so adding, removing and
     * reordering are all this one call.
     */
    updateFeaturedUsers: builder.mutation<{ success: boolean; featured_users: string[] }, string[]>({
      query: (user_ids) => ({ url: 'api/site-settings/featured-users', method: 'POST', body: { user_ids } }),
      invalidatesTags: ['SiteSettings'],
    }),

    updateFeaturedCars: builder.mutation<{ success: boolean; featured_cars: string[] }, string[]>({
      query: (car_ids) => ({ url: 'api/site-settings/featured-cars', method: 'POST', body: { car_ids } }),
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
    //
    // Every path goes through LIST_API, defined above `createApi`, because
    // the mount point is the one thing about this feature that has moved
    // between the three repos — see the constant.

    /**
     * A member's lists, or one car's.
     *
     * `car_id` is three-valued and the difference matters: left out, the server
     * answers with every list the member has; `'none'` is only the ones not
     * attached to a car, which is what a profile shows; a car's id is that
     * car's lists, which is what its page shows. A profile asking without it
     * would repeat "5 mods I want to do next year" beside "Top 5 designers".
     *
     * Open to anyone — reading a list is not the Pro part, making one is. The
     * read is optionally authenticated (baseQuery sends the token whenever
     * there is one), which is how an author gets their own private and draft
     * lists back; each carries `private` and `status` so they can be badged.
     * Zero-based `page`, and `limit` tops out at 50 server-side.
     *
     * `car_id=<id>` only returns lists written by that car's *current* owner
     * or co-owner — a list stays with its author when a car changes hands.
     */
    getLists: builder.query<
      PaginatedResponse<import('../types/api').List>,
      { user_id?: string; car_id?: string; page?: number; limit?: number; search?: string }
    >({
      query: (params = {}) => ({ url: LIST_API, params }),
      providesTags: ['List'],
    }),

    getList: builder.query<import('../types/api').List, string>({
      query: (id) => `${LIST_API}/single/${id}`,
      providesTags: (result, error, id) => [{ type: 'List' as const, id }],
    }),

    /**
     * Pro only: a basic member is refused with 403 `pro_required`, the same
     * shape a diecast listing's refusal takes. `car_id` in the form attaches
     * the list to one of the member's own garage cars (403 `car_not_owned`
     * otherwise). Pro has a ceiling too — 50 lists, 403 `list_limit_reached` —
     * which is about document size, not membership, so it's an alert and not
     * an upsell.
     */
    createList: builder.mutation<{ _id: string; entry: import('../types/api').List }, FormData>({
      query: (formData) => ({ url: `${LIST_API}/create`, method: 'POST', body: formData }),
      invalidatesTags: ['List'],
    }),

    /** Not Pro-gated — a lapsed Pro keeps the lists they made and can still tend them. */
    updateList: builder.mutation<import('../types/api').List, FormData>({
      query: (formData) => ({ url: `${LIST_API}/update`, method: 'POST', body: formData }),
      invalidatesTags: ['List'],
    }),

    deleteList: builder.mutation<{ success: boolean }, { internal_id: string }>({
      query: (body) => ({ url: `${LIST_API}/delete`, method: 'POST', body }),
      invalidatesTags: ['List'],
    }),

    /**
     * `link` is normalised server-side (a bare domain gets `https://`) and
     * refused with 400 `invalid_link` when it can't be; `link_label` is cut to
     * 30 characters. A full list — 50 items — is 403 `list_item_limit_reached`.
     */
    createListItem: builder.mutation<{ item: import('../types/api').ListItem; list_id: string }, FormData>({
      query: (formData) => ({ url: `${LIST_API}/items/create`, method: 'POST', body: formData }),
      invalidatesTags: ['List'],
    }),

    /**
     * Edits one item in place. The photo follows the app-wide gallery protocol:
     * a new file is appended, and `modifyImage:remove:0` names the one it
     * replaces — without it the old photo stays first and keeps being shown.
     * `link` left out is left alone; sent empty, it clears the link and its label.
     */
    updateListItem: builder.mutation<{ item: import('../types/api').ListItem; list_id: string }, FormData>({
      query: (formData) => ({ url: `${LIST_API}/items/update`, method: 'POST', body: formData }),
      invalidatesTags: ['List'],
    }),

    deleteListItem: builder.mutation<{ success: boolean }, { list_id: string; item_internal_id: string }>({
      query: (body) => ({ url: `${LIST_API}/items/delete`, method: 'POST', body }),
      invalidatesTags: ['List'],
    }),

    reorderListItems: builder.mutation<{ success: boolean }, { list_id: string; item_order: string[] }>({
      query: (body) => ({ url: `${LIST_API}/items/reorder`, method: 'POST', body }),
      invalidatesTags: ['List'],
    }),

    // ── Reports ─────────────────────────────────────────────────────────────

    createReport: builder.mutation<void, { content_type: ReportableType; content_id: string; reason?: string }>({
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

    // ── Marketplace (listings) ────────────────────────────────────────────────
    /**
     * The marketplace's own collection — see horacio's models/Listing.js.
     *
     * Deliberately uncached on the server, because nearly every answer depends
     * on who is asking: which listings fit a car in *your* garage, how far they
     * are from *your* zip, which of *your* groups they were posted into.
     *
     * Tagged as a list plus one tag per listing, so a price drop or a sold
     * toggle refetches the browse without every screen having to know about it.
     */
    getListings: builder.query<ListingBrowseResponse, ListingBrowseParams | void>({
      query: (params) => ({
        url: 'api/marketplace',
        params: { page: 0, limit: 12, ...(params ?? {}) },
      }),
      providesTags: (result) => [
        { type: 'Listing' as const, id: 'LIST' },
        ...(result?.entries ?? []).map((e) => ({ type: 'Listing' as const, id: e.internal_id })),
      ],
    }),

    /**
     * The filter vocabulary. Fetched rather than hardcoded so the app's
     * categories and condition labels can't drift from the collection's.
     * Never changes between deploys, so it's asked for once and cached.
     */
    getListingMeta: builder.query<ListingMeta, void>({
      query: () => 'api/marketplace/meta',
    }),

    getListing: builder.query<ListingDetailResponse, string>({
      query: (id) => `api/marketplace/${id}`,
      providesTags: (result, error, id) => [{ type: 'Listing', id }],
    }),

    /** The seller's own — active listings, want ads and what's sold. */
    getMyListings: builder.query<MyListingsResponse, void>({
      query: () => 'api/marketplace/mine',
      providesTags: [{ type: 'Listing', id: 'MINE' }],
    }),

    // Multipart, like posts: the photos come up with the form, under `gallery`.
    createListing: builder.mutation<{ _id: string; entry: Listing }, FormData>({
      query: (body) => ({ url: 'api/marketplace/create', method: 'POST', body }),
      invalidatesTags: [{ type: 'Listing', id: 'LIST' }, { type: 'Listing', id: 'MINE' }, 'UserEntries'],
    }),

    /** Partial-safe on the server: a field the form didn't send keeps its value. */
    updateListing: builder.mutation<{ success: string; entry: Listing }, FormData>({
      query: (body) => ({ url: 'api/marketplace/update', method: 'POST', body }),
      // The id isn't readable off a FormData, so the whole list goes — an edit
      // is rare enough that refetching the page you're on is the cheap answer.
      invalidatesTags: [{ type: 'Listing', id: 'LIST' }, { type: 'Listing', id: 'MINE' }],
    }),

    deleteListing: builder.mutation<{ success: boolean }, { internal_id: string }>({
      query: (body) => ({ url: 'api/marketplace/delete', method: 'POST', body }),
      invalidatesTags: (result, error, { internal_id }) => [
        { type: 'Listing', id: internal_id },
        { type: 'Listing', id: 'LIST' },
        { type: 'Listing', id: 'MINE' },
      ],
    }),

    /**
     * Mark sold, or put it back up. A toggle when `sold` is left out, which is
     * what the button wants; passed explicitly when the caller knows the way.
     */
    markListingSold: builder.mutation<
      { success: boolean; internal_id: string; sold: boolean; sold_at: string | null },
      { id: string; sold?: boolean }
    >({
      query: ({ id, ...body }) => ({ url: `api/marketplace/${id}/sold`, method: 'POST', body }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Listing', id },
        { type: 'Listing', id: 'LIST' },
        { type: 'Listing', id: 'MINE' },
      ],
    }),

    /** "Yes, still available" — resets the 60-day nudge clock. */
    confirmListing: builder.mutation<
      { success: boolean; internal_id: string; last_confirmed_at: string },
      string
    >({
      query: (id) => ({ url: `api/marketplace/${id}/confirm`, method: 'POST' }),
      invalidatesTags: (result, error, id) => [
        { type: 'Listing', id },
        { type: 'Listing', id: 'MINE' },
      ],
    }),

    // ── Marketplace (conversations) ───────────────────────────────────────────
    /**
     * A marketplace conversation is not an inbox message.
     *
     * Everything below talks to /api/marketplace/messages, which is its own
     * collection with its own unread counters — so none of it invalidates
     * 'Message' and none of it moves the inbox badge. That containment is the
     * point of the split on the server, and it only holds if the client keeps
     * the two apart too.
     *
     * The tag shape: the threads list provides `MarketplaceThread/LIST`, each
     * open conversation provides `MarketplaceThread/<id>`, and the badge
     * provides 'MarketplaceUnread'. A reply therefore refreshes the one
     * conversation, the list that previews it, and the count — and nothing else.
     */
    getMarketplaceThreads: builder.query<
      { total: number; page: number; limit: number; entries: MarketplaceThread[] },
      {
        /** 'as_seller' is "people asking about my things"; 'as_buyer' the reverse. */
        role?: MarketplaceRoleFilter;
        /** One listing's conversations — "who's interested in this?" */
        listing_id?: string;
        page?: number;
        limit?: number;
        include_archived?: boolean;
      } | void
    >({
      query: (params) => ({
        url: 'api/marketplace/messages/threads',
        params: { page: 0, limit: 20, ...(params ?? {}) },
      }),
      providesTags: (result) => [
        { type: 'MarketplaceThread' as const, id: 'LIST' },
        ...(result?.entries ?? []).map((t) => ({
          type: 'MarketplaceThread' as const, id: t.internal_id,
        })),
      ],
    }),

    /**
     * One conversation's messages, oldest→newest within a page.
     *
     * Page 0 is the *newest* page, so paging back walks up the history.
     *
     * Fetching this marks the viewer's messages read server-side, which no
     * `providesTags` can express — a query can't invalidate. Hence the manual
     * invalidation once it lands: the badge and the list both changed as a
     * result of reading, and neither would know. It can't loop, because the
     * tags it clears are not the one this query provides.
     */
    getMarketplaceThread: builder.query<
      MarketplaceThreadPage,
      { threadId: string; page?: number; limit?: number }
    >({
      query: ({ threadId, page = 0, limit = 30 }) => ({
        url: `api/marketplace/messages/threads/${threadId}`,
        params: { page, limit },
      }),
      providesTags: (result, error, { threadId }) => [
        { type: 'MarketplaceThread', id: threadId },
      ],
      async onQueryStarted(arg, { dispatch, getState, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          /**
           * Only when this read actually cleared something — an open thread
           * polls every few seconds, and invalidating on each poll would
           * refetch the list and the badge forever for nothing.
           *
           * The messages are the tell, not `thread.unread_count`: the server
           * marks them read *after* it has selected the page but *before* it
           * builds the thread view, so the count always comes back zero while
           * the entries still carry the state they were in when we asked.
           */
          const myId = (getState() as { auth?: { userInfo?: { user_id?: string } } })
            .auth?.userInfo?.user_id;
          const cleared = data.entries.some((m) => !m.read && m.sender_id !== myId);
          if (!cleared) return;
          dispatch(apiService.util.invalidateTags([
            'MarketplaceUnread',
            { type: 'MarketplaceThread', id: 'LIST' },
          ]));
        } catch {
          // A failed read leaves the count as it was, which is correct.
        }
      },
    }),

    /**
     * Start (or reopen) the conversation about a listing, with its first
     * message. The caller is always the buyer; the server returns the existing
     * thread when there is one, so "get in touch" is safe to press twice.
     *
     * Takes FormData when a photo is coming with it — one file on the `gallery`
     * field, the same part name the rest of the app uses — and a plain object
     * otherwise, which is the normal case.
     */
    startMarketplaceThread: builder.mutation<
      { created: boolean; thread: MarketplaceThread; entry: MarketplaceMessage },
      { listing_id: string; body: string } | FormData
    >({
      query: (body) => ({ url: 'api/marketplace/messages/threads', method: 'POST', body }),
      invalidatesTags: [
        { type: 'MarketplaceThread', id: 'LIST' },
        'MarketplaceUnread',
      ],
    }),

    /** Reply. `data` is FormData when a photo is attached, a plain body if not. */
    sendMarketplaceMessage: builder.mutation<
      { entry: MarketplaceMessage; thread: MarketplaceThread },
      { threadId: string; data: { body: string } | FormData }
    >({
      query: ({ threadId, data }) => ({
        url: `api/marketplace/messages/threads/${threadId}/messages`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { threadId }) => [
        { type: 'MarketplaceThread', id: threadId },
        { type: 'MarketplaceThread', id: 'LIST' },
        // Sending doesn't change *my* count, but the thread's preview and order
        // change for both of us, and the badge is cheap to re-ask for.
        'MarketplaceUnread',
      ],
    }),

    /** Mark read without fetching the messages — for a list row you've opened. */
    markMarketplaceThreadRead: builder.mutation<
      { success: boolean; thread_id: string; unread_count: number },
      string
    >({
      query: (threadId) => ({
        url: `api/marketplace/messages/threads/${threadId}/read`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, threadId) => [
        { type: 'MarketplaceThread', id: threadId },
        { type: 'MarketplaceThread', id: 'LIST' },
        'MarketplaceUnread',
      ],
    }),

    /**
     * Leave the conversation. Archive for the caller only — the other side
     * keeps their copy, and the next message brings this one back.
     */
    leaveMarketplaceThread: builder.mutation<{ success: boolean; thread_id: string }, string>({
      query: (threadId) => ({
        url: `api/marketplace/messages/threads/${threadId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, threadId) => [
        { type: 'MarketplaceThread', id: threadId },
        { type: 'MarketplaceThread', id: 'LIST' },
        'MarketplaceUnread',
      ],
    }),

    /**
     * The marketplace badge, with a per-listing breakdown.
     *
     * Polled by its callers at CONFIG.NOTIFICATION_POLL_INTERVAL, the way the
     * bell polls its own count. `by_listing` is what lets a seller's row say
     * how many people are waiting on that one listing without a call per row.
     */
    getMarketplaceUnreadCount: builder.query<MarketplaceUnreadCount, void>({
      query: () => 'api/marketplace/messages/unread/count',
      providesTags: ['MarketplaceUnread'],
    }),

    // ── Custom alerts ───────────────────────────────────────────────────────

    /**
     * This member's standing rules, with where they stand against the cap.
     *
     * `counts` rides along with the list rather than being a second request:
     * the one screen that shows the rules is the same screen that has to know
     * whether another one may be added, and the list's own count is the
     * authority even on a server whose `/api/users/usage` hasn't grown an
     * `alerts` key yet.
     */
    getAlerts: builder.query<AlertsResponse, void>({
      query: () => 'api/alerts',
      providesTags: (result) => [
        { type: 'Alert' as const, id: 'LIST' },
        ...(result?.entries ?? []).map((a) => ({ type: 'Alert' as const, id: a.internal_id })),
      ],
    }),

    /**
     * The rule-builder vocabulary — every event, which filters each takes, and
     * the option lists behind those filters.
     *
     * Fetched rather than hardcoded for the same reason the marketplace's meta
     * is: the categories and condition labels an alert matches on are the
     * collection's, and a second copy in the app drifts. Never changes between
     * deploys, so it's asked for once and cached.
     */
    getAlertMeta: builder.query<AlertMeta, void>({
      query: () => 'api/alerts/meta',
      keepUnusedDataFor: 3600,
    }),

    /**
     * Refused with 403 `alert_limit_reached` over the cap — the same shape the
     * marketplace's `listing_limit_reached` uses, and handled the same way.
     */
    createAlert: builder.mutation<AlertWriteResponse, AlertInput>({
      query: (body) => ({ url: 'api/alerts', method: 'POST', body }),
      invalidatesTags: [{ type: 'Alert', id: 'LIST' }, 'User'],
    }),

    updateAlert: builder.mutation<AlertWriteResponse, { id: string } & Partial<AlertInput>>({
      query: ({ id, ...body }) => ({ url: `api/alerts/${id}`, method: 'PUT', body }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Alert', id },
        { type: 'Alert', id: 'LIST' },
      ],
    }),

    /**
     * On or off without deleting it — the switch on each row.
     *
     * A toggle when `enabled` is left out, which is what the switch wants;
     * passed explicitly when the caller already knows the way, exactly as
     * `markListingSold` works.
     */
    toggleAlert: builder.mutation<
      { success: boolean; entry: Alert },
      { id: string; enabled?: boolean }
    >({
      query: ({ id, ...body }) => ({ url: `api/alerts/${id}/toggle`, method: 'POST', body }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Alert', id },
        { type: 'Alert', id: 'LIST' },
      ],
    }),

    deleteAlert: builder.mutation<{ success: boolean; counts?: AlertCounts }, string>({
      query: (id) => ({ url: `api/alerts/${id}`, method: 'DELETE' }),
      // 'User' as well: deleting frees a slot, and the dashboard's usage bar
      // is what tells the member they have one again.
      invalidatesTags: (result, error, id) => [
        { type: 'Alert', id },
        { type: 'Alert', id: 'LIST' },
        'User',
      ],
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
  useGetUsageQuery,
  useInviteFriendMutation,
  useSearchUsersQuery,
  useRequestCarModelMutation,
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
  useGetArchivedGarageQuery,
  useArchiveCarMutation,
  useRestoreCarMutation,
  useTransferCarMutation,
  useAcceptCarTransferMutation,
  useDeclineCarTransferMutation,
  useGetPendingCarTransfersQuery,
  useGetCarBrandsQuery,
  useGetCarModelsQuery,
  useGetCarMakeOptionsQuery,
  useGetCarModelOptionsQuery,
  useFollowCarMutation,
  useUnfollowCarMutation,
  useGetCarFollowStatusQuery,
  useGetCarFollowersQuery,
  useGetCarFollowerCountQuery,
  useGetCarTaggedPostsQuery,
  useGetFollowedCarsQuery,
  useGetFollowedCarActivityQuery,
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
  useGetEventRegionsQuery,
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
  useCreateGroupMutation,
  useUpdateGroupMutation,
  useDeleteGroupMutation,
  useRegisterProInterestMutation,
  useGetGroupMembersQuery,
  useJoinGroupMutation,
  useGetJoinableGroupsQuery,
  useRemoveGroupMemberMutation,
  useUpdateGroupMemberTypeMutation,
  useInviteGroupMemberMutation,
  useAcceptGroupInviteMutation,
  useDeclineGroupInviteMutation,
  useGetDeclinedInvitesQuery,
  useAllowGroupInvitesMutation,
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
  useDeleteAllNotificationsMutation,
  useGetMessagesQuery,
  useGetMessageThreadQuery,
  useGetUnreadMessageCountQuery,
  useSendMessageMutation,
  useMarkMessageReadMutation,
  useDeleteMessageMutation,
  useDeleteMessageThreadMutation,
  useSearchMessageUsersQuery,
  useGetProductsQuery,
  useGetAdminProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useGetRallysQuery,
  useGetRallyQuery,
  useAttendRallyMutation,
  useDeclineRallyMutation,
  useDeleteRallyMutation,
  useGetCalendarEventsQuery,
  useGetGroupDiscussionQuery,
  useGetGroupNewsQuery,
  useGetGroupResourcesQuery,
  useGetFollowStatusQuery,
  useFollowUserMutation,
  useUnfollowUserMutation,
  useGetFollowStatusesQuery,
  useGetUserFollowersQuery,
  useGetUserFollowingQuery,
  useGetTagsByPostQuery,
  useGetPreviouslyTaggedUsersQuery,
  useGetPreviouslyTaggedCarsQuery,
  useGetPreviouslyTaggedEventsQuery,
  useSyncPostTagsMutation,
  useGetPostTagsQuery,
  useGetGroupActivityQuery,
  useLazySearchPlacesQuery,
  useLazyGetPlaceDetailsQuery,
  useGetPhotoSpotsQuery,
  useGetPhotoSpotQuery,
  useGetPhotoSpotUsageQuery,
  useCreatePhotoSpotMutation,
  useUpdatePhotoSpotMutation,
  useDeletePhotoSpotMutation,
  useSearchQuery,
  useUpdateUserSettingMutation,
  useGetNotificationTypesQuery,
  useUpdateNotificationSettingsMutation,
  useUpdateUserSettingImageMutation,
  useUpdateFeedPreferencesMutation,
  useCheckUsernameMutation,
  useCheckEmailMutation,
  useGetGroupCarsQuery,
  useGetCarGroupsQuery,
  useCreateGroupDiscussionPostMutation,
  useUpdateGroupDiscussionPostMutation,
  useDeleteGroupDiscussionPostMutation,
  useUpvoteGroupDiscussionPostMutation,
  useDownvoteGroupDiscussionPostMutation,
  useUpvoteGroupResourceMutation,
  useDownvoteGroupResourceMutation,
  useUpvoteGroupNewsMutation,
  useDownvoteGroupNewsMutation,
  useCreateGroupNewsPostMutation,
  useCreateGroupResourceMutation,
  useUpdateGroupResourceMutation,
  useDeleteGroupResourceMutation,
  useUpdateCarGroupMutation,
  useDeleteAccountMutation,
  useRegisterDeviceTokenMutation,
  useGetStoriesFeedQuery,
  useMarkStoriesSeenMutation,
  useGetSiteSettingsQuery,
  useUpdateHomeBannerMutation,
  useDeleteHomeBannerMutation,
  useUpdateFeaturedUsersMutation,
  useUpdateFeaturedCarsMutation,
  useGetPodcastsQuery,
  useGetPodcastQuery,
  useGetListsQuery,
  useGetListQuery,
  useCreateListMutation,
  useUpdateListMutation,
  useDeleteListMutation,
  useCreateListItemMutation,
  useUpdateListItemMutation,
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
  useGetRouteEndpointNamesQuery,
  useGetRouteQuery,
  useCreateRouteMutation,
  useUpdateRouteMutation,
  useDeleteRouteMutation,
  useUpvoteRouteMutation,
  useDownvoteRouteMutation,
  useGetListingsQuery,
  useGetListingMetaQuery,
  useGetListingQuery,
  useGetMyListingsQuery,
  useCreateListingMutation,
  useUpdateListingMutation,
  useDeleteListingMutation,
  useMarkListingSoldMutation,
  useConfirmListingMutation,
  useGetMarketplaceThreadsQuery,
  useLazyGetMarketplaceThreadsQuery,
  useGetMarketplaceThreadQuery,
  useStartMarketplaceThreadMutation,
  useSendMarketplaceMessageMutation,
  useMarkMarketplaceThreadReadMutation,
  useLeaveMarketplaceThreadMutation,
  useGetMarketplaceUnreadCountQuery,
  // Custom alerts
  useGetAlertsQuery,
  useGetAlertMetaQuery,
  useCreateAlertMutation,
  useUpdateAlertMutation,
  useToggleAlertMutation,
  useDeleteAlertMutation,
} = apiService;

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from './orsBaseQuery';
import type {
  User, PlacePrediction, PlaceDetail, NearbyPlace, PhotoSpot, PhotoSpotUsage, EventLocationParams,
} from '../types/ors';

/**
 * The core RTK Query API: the signed-in member, the make and model reference
 * lists, address lookup, photo spots — extended with `orsApi.injectEndpoints`.
 * (Most of the app's endpoints are still on api/apiService, a separate API.)
 *
 * Tag types for the apps' own endpoints are declared here too: RTK Query wants
 * them up front, and a string list costs nothing to carry.
 */
export const orsApi = createApi({
  reducerPath: 'orsApi',
  baseQuery,
  tagTypes: [
    'User', 'PhotoSpot', 'Notifications',
    // spot
    'CarSpotToday', 'CarSpotHistory', 'CarSpotAdmin', 'CarSpotSocial',
    // comments (generic horacio comments, e.g. on photo galleries)
    'Comments',
    // photo
    'PhotoGallery', 'PhotoProfile', 'PhotoFollow', 'PhotoGear', 'PhotoMembers',
  ],
  endpoints: (builder) => ({
    getLoggedInUser: builder.query<User, void>({
      query: () => 'api/users/loggedInUser',
      providesTags: ['User'],
    }),

    /** Another member, as anyone may see them — what a profile preview is built from. */
    getPublicUser: builder.query<User, string>({
      query: (userId) => `api/users/publicUserById/${encodeURIComponent(userId)}`,
      providesTags: (r, e, userId) => [{ type: 'User', id: userId }],
    }),

    // ── Make / model reference lists (the `cars` collection) ────────────────

    /** Every make on the reference list — what a make field may hold. */
    getCarMakeOptions: builder.query<string[], void>({
      query: () => 'api/cars/makes',
      transformResponse: (response: { makes: string[] }) => response.makes ?? [],
      keepUnusedDataFor: 3600,
    }),

    /** One make's models from the reference list. */
    getCarModelOptions: builder.query<string[], string>({
      query: (make) => ({ url: 'api/cars/models', params: { make } }),
      transformResponse: (response: { models: string[] }) => response.models ?? [],
      keepUnusedDataFor: 3600,
    }),

    requestCarModel: builder.mutation<{ success: boolean }, { message: string }>({
      query: (body) => ({ url: 'api/users/car-request', method: 'POST', body }),
    }),

    /** The signed-in member's zip. Refetches the profile, which flips `hasZip`. */
    updateZip: builder.mutation<{ success: boolean; cityState: string }, { zip: string }>({
      query: (body) => ({ url: 'api/users/settings/update/zip', method: 'POST', body }),
      invalidatesTags: ['User'],
    }),

    // ── Address lookup ──────────────────────────────────────────────────────

    /** `session` groups a type-then-pick interaction into one Google session. */
    searchPlaces: builder.query<{ predictions: PlacePrediction[] }, {
      q: string; session: string; lat?: number; lng?: number;
    }>({
      query: (params) => ({ url: 'api/places/search', params }),
    }),

    getPlaceDetails: builder.query<{ place: PlaceDetail | null }, {
      place_id: string; session: string;
    }>({
      query: (params) => ({ url: 'api/places/details', params }),
    }),

    /** Named places within `radius` metres of a point, nearest first. */
    getNearbyPlaces: builder.query<{ places: NearbyPlace[] }, { lat: number; lng: number; radius?: number }>({
      query: (params) => ({ url: 'api/places/nearby', params }),
      keepUnusedDataFor: 300,
    }),

    // ── Photography spots (shared with alfa) ────────────────────────────────

    getPhotoSpots: builder.query<{
      entries: PhotoSpot[];
      total: number;
      near_unavailable?: boolean;
      center?: { lat: number; lng: number } | null;
    }, ({
      north?: number; south?: number; east?: number; west?: number;
      type?: string; category?: string; user_id?: string; limit?: number;
      /** A title search, for a picker. */
      q?: string;
      /** Particular spots, comma-separated ids. */
      ids?: string;
    } & EventLocationParams) | void>({
      query: (params) => ({ url: 'api/photospot', params: params ?? {} }),
      providesTags: ['PhotoSpot'],
    }),

    getPhotoSpot: builder.query<PhotoSpot, string>({
      query: (id) => `api/photospot/detail/${id}`,
      transformResponse: (r: any) => r?.entry ?? r,
      providesTags: (result, error, id) => [{ type: 'PhotoSpot', id }],
    }),

    getPhotoSpotUsage: builder.query<PhotoSpotUsage, void>({
      query: () => 'api/photospot/usage',
      providesTags: [{ type: 'PhotoSpot', id: 'usage' }],
    }),

    createPhotoSpot: builder.mutation<{ entry: PhotoSpot }, FormData>({
      query: (body) => ({ url: 'api/photospot/create', method: 'POST', body }),
      invalidatesTags: ['PhotoSpot'],
    }),

    deletePhotoSpot: builder.mutation<{ success: boolean; usage: PhotoSpotUsage }, string>({
      query: (internal_id) => ({ url: 'api/photospot/delete', method: 'POST', body: { internal_id } }),
      invalidatesTags: ['PhotoSpot'],
    }),

    addPhotoSpotPhotos: builder.mutation<{ entry: PhotoSpot }, { internal_id: string; body: FormData }>({
      query: ({ body }) => ({ url: 'api/photospot/photos', method: 'POST', body }),
      invalidatesTags: (r, e, { internal_id }) => ['PhotoSpot', { type: 'PhotoSpot', id: internal_id }],
    }),
  }),
});

export const {
  useGetLoggedInUserQuery,
  useGetPublicUserQuery,
  useGetCarMakeOptionsQuery,
  useGetCarModelOptionsQuery,
  useRequestCarModelMutation,
  useUpdateZipMutation,
  useLazySearchPlacesQuery,
  useLazyGetPlaceDetailsQuery,
  useGetNearbyPlacesQuery,
  useGetPhotoSpotsQuery,
  useLazyGetPhotoSpotsQuery,
  useGetPhotoSpotQuery,
  useGetPhotoSpotUsageQuery,
  useCreatePhotoSpotMutation,
  useDeletePhotoSpotMutation,
  useAddPhotoSpotPhotosMutation,
} = orsApi;

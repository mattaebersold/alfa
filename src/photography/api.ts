import { orsApi } from '../api/orsApi';
import type { PhotoSpot } from '../types/ors';

/**
 * The photo spot endpoints the shared core API doesn't carry — editing a spot
 * and taking one photo off it. Injected here, beside the screens that use
 * them, so an app that never imports the photography module never has them.
 */
export const photographyApi = orsApi.injectEndpoints({
  endpoints: (builder) => ({
    updatePhotoSpot: builder.mutation<{ entry: PhotoSpot }, FormData>({
      query: (body) => ({ url: 'api/photospot/update', method: 'POST', body }),
      invalidatesTags: ['PhotoSpot'],
    }),
    removePhotoSpotPhoto: builder.mutation<{ entry: PhotoSpot }, { internal_id: string; filename: string }>({
      query: (body) => ({ url: 'api/photospot/photos/remove', method: 'POST', body }),
      invalidatesTags: (r, e, { internal_id }) => ['PhotoSpot', { type: 'PhotoSpot', id: internal_id }],
    }),
  }),
  overrideExisting: false,
});

export const { useUpdatePhotoSpotMutation, useRemovePhotoSpotPhotoMutation } = photographyApi;

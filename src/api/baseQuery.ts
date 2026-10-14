import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { CONFIG } from '../constants/config';
import { getToken } from '../utils/token';

// RTK Query v2 supports async prepareHeaders — needed for SecureStore
export const baseQuery = fetchBaseQuery({
  baseUrl: CONFIG.API_BASE_URL,
  prepareHeaders: async (headers) => {
    const token = await getToken();
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
  timeout: 60000,
});

/**
 * For a create that carries its photos in the same request — a group
 * discussion, resource or news item. The server resizes and stores every
 * photo before it saves anything, a couple at a time, so a handful of photos
 * on a slow connection can run past the 60s every other call gets, and the
 * client gave up on a save that would have landed.
 */
export const UPLOAD_TIMEOUT_MS = 180000;

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
  timeout: 15000,
});

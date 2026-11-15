import { fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { appConfig, APP_HEADER } from '../constants/appConfig';
import { getToken } from '../auth/token';

/**
 * alfa's base query, plus the app header.
 *
 * Built per request rather than once at import, because the base URL comes
 * from `configureApp`, which the app calls after this module has loaded.
 */
export const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = (args, api, extra) =>
  fetchBaseQuery({
    baseUrl: appConfig().API_BASE_URL,
    prepareHeaders: async (headers) => {
      const token = await getToken();
      if (token) headers.set('authorization', `Bearer ${token}`);
      headers.set(APP_HEADER, appConfig().app);
      return headers;
    },
    timeout: 60000,
  })(args, api, extra);

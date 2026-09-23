import { configureKit } from '@ors/kit';
import { CONFIG } from './constants/config';

/**
 * Points @ors/kit at this app before anything else loads.
 *
 * Must run before the store or any screen is created — the kit's base query,
 * auth thunks and image URLs read this at call time — so App.tsx imports this
 * file first. alfa is the 'ors' app: the server reads that the same as a
 * request with no app header at all.
 */
configureKit({
  app: 'ors',
  appName: 'Open Road Society',
  API_BASE_URL: CONFIG.API_BASE_URL,
  S3_BASE_URL: CONFIG.S3_BASE_URL,
  GOOGLE_WEB_CLIENT_ID: CONFIG.GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID: CONFIG.GOOGLE_IOS_CLIENT_ID,
  USER_REFRESH_INTERVAL: CONFIG.USER_REFRESH_INTERVAL,
});

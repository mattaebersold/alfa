import { configureApp } from './constants/appConfig';
import { CONFIG } from './constants/config';

/**
 * Sets the app's config (constants/appConfig) before anything else loads.
 *
 * Must run before the store or any screen is created — the shared base query,
 * auth thunks and image URLs read this at call time — so App.tsx imports this
 * file first. alfa is the 'ors' app: the server reads that the same as a
 * request with no app header at all.
 */
configureApp({
  app: 'ors',
  appName: 'Open Road Society',
  API_BASE_URL: CONFIG.API_BASE_URL,
  S3_BASE_URL: CONFIG.S3_BASE_URL,
  // Full-width unless a call says otherwise — see ImageSize in constants/appConfig.
  IMAGE_DEFAULT_SIZE: 'medium',
  GOOGLE_WEB_CLIENT_ID: CONFIG.GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID: CONFIG.GOOGLE_IOS_CLIENT_ID,
  USER_REFRESH_INTERVAL: CONFIG.USER_REFRESH_INTERVAL,
});

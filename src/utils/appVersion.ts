import Constants from 'expo-constants';

/**
 * The running app's version — "1.32".
 *
 * Read from the app config rather than kept as a constant here, because that's
 * the copy `npm run bump` writes: the bump script rewrites the `version` field
 * in package.json and app.json together, and app.json is what gets baked into
 * the build. A constant in this file would be a third place to remember, and
 * the one nothing updates — so it would start out right and quietly drift.
 *
 * Empty when the config isn't readable, which callers render as nothing rather
 * than as a wrong number.
 */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '';

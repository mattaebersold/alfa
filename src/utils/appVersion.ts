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
// app.json itself first, straight from the bundle: the manifest the dev
// client reads at launch keeps the version it started with, so a bump made
// while the app was up left "What's new" keyed to the old number until a full
// relaunch. The bundle follows app.json on reload; in a store build the two
// agree anyway.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bundled: string | undefined = (require('../../app.json') as { expo?: { version?: string } })?.expo?.version;
export const APP_VERSION: string = bundled ?? Constants.expoConfig?.version ?? '';

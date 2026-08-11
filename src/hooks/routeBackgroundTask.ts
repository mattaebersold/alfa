import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { File, Paths } from 'expo-file-system';
import type { RouteSample } from '../utils/routeGeometry';

/**
 * The background half of route recording.
 *
 * This file is imported for its side effect — `defineTask` has to run at module
 * load, before React mounts, because the OS can relaunch the app straight into
 * the task with no UI at all. That is also why the handler talks to disk rather
 * than to React state: when it runs there may be no component tree to update.
 *
 * The recorder hook reads the same file, so a drive continues seamlessly
 * whether the app was foregrounded, backgrounded, or killed and relaunched.
 */

/**
 * Master switch for background recording. Currently OFF.
 *
 * Turning this back on is necessary but NOT sufficient — the OS will refuse to
 * start background updates unless the native permissions are declared too. To
 * re-enable, flip this and restore in app.json:
 *
 *   ios.infoPlist.UIBackgroundModes: ["location"]
 *   ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription
 *   android.permissions: ACCESS_BACKGROUND_LOCATION, FOREGROUND_SERVICE,
 *                        FOREGROUND_SERVICE_LOCATION
 *   expo-location plugin: isAndroidBackgroundLocationEnabled,
 *                         isAndroidForegroundServiceEnabled,
 *                         locationAlwaysAndWhenInUsePermission
 *
 * Those declarations are deliberately removed while this is off: leaving them
 * in place makes both stores demand a background-location justification (and a
 * video demo for Play) for a capability the app never uses.
 *
 * The task and its storage below stay wired up so re-enabling is a config
 * change rather than a rewrite.
 */
export const BACKGROUND_RECORDING_ENABLED = false;

export const ROUTE_LOCATION_TASK = 'ors-route-location';

/** Shared with useRouteRecorder — both halves append to the same draft. */
export const DRAFT_FILENAME = 'route-draft.json';

export interface StoredDraft {
  draftId: string;
  startedAt: number;
  endedAt: number;
  samples: RouteSample[];
}

function draftFile() {
  return new File(Paths.document, DRAFT_FILENAME);
}

export function readStoredDraft(): StoredDraft | null {
  try {
    const file = draftFile();
    if (!file.exists) return null;
    const parsed = JSON.parse(file.textSync());
    if (!parsed?.samples?.length) return null;
    return parsed as StoredDraft;
  } catch {
    return null;
  }
}

export function writeStoredDraft(draft: StoredDraft) {
  try {
    const file = draftFile();
    if (!file.exists) file.create({ intermediates: true, overwrite: true });
    file.write(JSON.stringify(draft));
  } catch {
    // Never throw from the location path — a lost flush is recoverable, a
    // crashed background task is not.
  }
}

export function clearStoredDraft() {
  try {
    const file = draftFile();
    if (file.exists) file.delete();
  } catch {
    // Overwritten on the next start regardless.
  }
}

function toSample(loc: Location.LocationObject): RouteSample {
  const { coords, timestamp } = loc;
  return {
    lat: coords.latitude,
    lng: coords.longitude,
    t: timestamp,
    speed: typeof coords.speed === 'number' ? coords.speed : -1,
    alt: typeof coords.altitude === 'number' ? coords.altitude : NaN,
    heading: typeof coords.heading === 'number' ? coords.heading : -1,
    accuracy: typeof coords.accuracy === 'number' ? coords.accuracy : -1,
  };
}

// Registered only when the feature is on. defineTask itself is inert, but
// leaving an unused task registered invites confusion when reading logs.
if (BACKGROUND_RECORDING_ENABLED) {
TaskManager.defineTask(ROUTE_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[route-task] location error', error.message);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] })?.locations;
  if (!locations?.length) return;

  // Read-modify-write rather than holding state: this task may be running in a
  // freshly relaunched process that never saw the earlier part of the drive.
  const draft = readStoredDraft();
  if (!draft) return; // No recording in progress — nothing to append to.

  const existing = draft.samples;
  const last = existing[existing.length - 1];

  for (const loc of locations) {
    const sample = toSample(loc);
    // Batches can overlap across deliveries; timestamps are the dedup key.
    if (last && sample.t <= last.t) continue;
    existing.push(sample);
  }

  writeStoredDraft({ ...draft, samples: existing, endedAt: Date.now() });
});
}

/** Whether the OS is currently delivering background locations to us. */
export async function isBackgroundTaskRunning(): Promise<boolean> {
  if (!BACKGROUND_RECORDING_ENABLED) return false;
  try {
    return await Location.hasStartedLocationUpdatesAsync(ROUTE_LOCATION_TASK);
  } catch {
    return false;
  }
}

export async function stopBackgroundUpdates() {
  try {
    if (await isBackgroundTaskRunning()) {
      await Location.stopLocationUpdatesAsync(ROUTE_LOCATION_TASK);
    }
  } catch {
    // Already stopped, or the task was never registered.
  }
}

/**
 * Starts OS-level background location.
 *
 * Returns false when "Always" permission wasn't granted — the caller keeps
 * recording in the foreground rather than failing the drive, since foreground
 * recording still works perfectly while the screen is on.
 */
export async function startBackgroundUpdates(): Promise<boolean> {
  if (!BACKGROUND_RECORDING_ENABLED) return false;
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') return false;

    if (await isBackgroundTaskRunning()) return true;

    await Location.startLocationUpdatesAsync(ROUTE_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 0,
      // Without this Android kills the updates within minutes of the app going
      // to the background, and the notification is required by Play policy.
      foregroundService: {
        notificationTitle: 'Recording your route',
        notificationBody: 'Open Road Society is tracking this drive.',
        notificationColor: '#CDA96F',
      },
      // iOS: keep the blue bar visible so it's never recording invisibly.
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      activityType: Location.LocationActivityType.AutomotiveNavigation,
    });

    return true;
  } catch (e) {
    console.warn('[route-task] could not start background updates', e);
    return false;
  }
}

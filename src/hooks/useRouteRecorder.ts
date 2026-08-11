import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { haversine, isMoving, type RouteSample } from '../utils/routeGeometry';
import {
  readStoredDraft, writeStoredDraft, clearStoredDraft,
  startBackgroundUpdates, stopBackgroundUpdates,
  type StoredDraft,
} from './routeBackgroundTask';

/**
 * Owns a drive recording: the GPS subscription, the track it produces, and the
 * on-disk draft that survives the app dying mid-drive.
 *
 * Everything about *how* location is acquired is contained here, which is what
 * makes adding background recording later a change to this file rather than to
 * every screen. Today it records only while the app is foregrounded; the screen
 * is kept awake for the duration, since the OS suspends location delivery when
 * the device locks and there is no background task registered yet.
 *
 * Points are held in a ref rather than state — a two-hour drive is thousands of
 * fixes, and re-rendering the screen on each one would be wasteful. The UI is
 * fed by a deliberately small snapshot updated on a timer instead.
 */

export type RecorderStatus = 'idle' | 'starting' | 'recording' | 'paused' | 'stopped';

export interface LiveStats {
  /** Metres travelled, counting only samples where the vehicle was moving. */
  distanceMeters: number;
  /** Wall-clock time since the recording started, excluding paused spans. */
  elapsedMs: number;
  /** Time spent actually moving. */
  movingMs: number;
  currentSpeed: number;
  maxSpeed: number;
  sampleCount: number;
}

export interface PitStop {
  lat: number;
  lng: number;
  t: number;
  label?: string;
  note?: string;
}

export interface RouteDraft {
  draftId: string;
  startedAt: number;
  endedAt: number;
  samples: RouteSample[];
  pitStops?: PitStop[];
}

const EMPTY_STATS: LiveStats = {
  distanceMeters: 0,
  elapsedMs: 0,
  movingMs: 0,
  currentSpeed: 0,
  maxSpeed: 0,
  sampleCount: 0,
};

/** How often the on-screen numbers refresh. Independent of the GPS rate. */
const UI_TICK_MS = 1000;
/** Flush the draft to disk every N samples. Cheap insurance against a crash. */
const FLUSH_EVERY = 10;
/** Fixes worse than this are dropped before they reach the track, matching the
 *  server's MAX_ACCURACY_M so the client and server agree on what counts. */
const MAX_ACCURACY_M = 50;

/** The draft lives in one place, shared with the background task. */
export const readDraft = readStoredDraft as () => RouteDraft | null;
export const clearDraft = clearStoredDraft;
const writeDraft = (draft: RouteDraft) => writeStoredDraft(draft as StoredDraft);

export function useRouteRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [stats, setStats] = useState<LiveStats>(EMPTY_STATS);
  const [error, setError] = useState<string | null>(null);
  /** A small, decimated copy of the track for drawing the live map line.
   *  Carries speed so the line can be coloured by how fast each stretch was. */
  const [path, setPath] = useState<{ lat: number; lng: number; speed: number }[]>([]);

  const samplesRef = useRef<RouteSample[]>([]);
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const draftIdRef = useRef<string>('');
  const startedAtRef = useRef<number>(0);
  /** Milliseconds spent paused, subtracted from elapsed time. */
  const pausedMsRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const statsRef = useRef<LiveStats>(EMPTY_STATS);
  const sinceFlushRef = useRef<number>(0);
  const pitStopsRef = useRef<PitStop[]>([]);
  const [pitStops, setPitStops] = useState<PitStop[]>([]);
  /** True once the OS accepted the background location task. While it is, the
   *  task owns the draft file and the foreground watch is UI-only — two writers
   *  would clobber each other. */
  const backgroundRef = useRef<boolean>(false);
  const [backgroundActive, setBackgroundActive] = useState(false);

  const stopSubscription = useCallback(() => {
    subRef.current?.remove();
    subRef.current = null;
  }, []);

  /** Folds one fix into the running totals. Deliberately allocation-light. */
  const ingest = useCallback((loc: Location.LocationObject) => {
    const { coords, timestamp } = loc;

    if (typeof coords.accuracy === 'number' && coords.accuracy > MAX_ACCURACY_M) return;

    const sample: RouteSample = {
      lat: coords.latitude,
      lng: coords.longitude,
      t: timestamp,
      speed: typeof coords.speed === 'number' ? coords.speed : -1,
      alt: typeof coords.altitude === 'number' ? coords.altitude : NaN,
      heading: typeof coords.heading === 'number' ? coords.heading : -1,
      accuracy: typeof coords.accuracy === 'number' ? coords.accuracy : -1,
    };

    const prev = samplesRef.current[samplesRef.current.length - 1];
    samplesRef.current.push(sample);

    const s = statsRef.current;
    const moving = isMoving(sample, prev);
    const speed = sample.speed >= 0
      ? sample.speed
      : prev && sample.t > prev.t
        ? haversine(prev, sample) / ((sample.t - prev.t) / 1000)
        : 0;

    statsRef.current = {
      distanceMeters: s.distanceMeters + (moving && prev ? haversine(prev, sample) : 0),
      elapsedMs: s.elapsedMs,
      movingMs: s.movingMs + (moving && prev ? sample.t - prev.t : 0),
      currentSpeed: moving ? speed : 0,
      maxSpeed: Math.max(s.maxSpeed, moving ? speed : 0),
      sampleCount: samplesRef.current.length,
    };

    // When the background task is running it is the single writer; flushing
    // here too would race it and drop whatever it appended while we were away.
    if (!backgroundRef.current && ++sinceFlushRef.current >= FLUSH_EVERY) {
      sinceFlushRef.current = 0;
      writeDraft({
        draftId: draftIdRef.current,
        startedAt: startedAtRef.current,
        endedAt: Date.now(),
        samples: samplesRef.current,
        pitStops: pitStopsRef.current,
      });
    }
  }, []);

  /**
   * Drops a pit stop at the current position.
   *
   * Uses the last recorded fix rather than requesting a fresh one: it's
   * instantaneous, and while driving the newest sample is at most a second old.
   */
  const addPitStop = useCallback((label: string, note?: string) => {
    const last = samplesRef.current[samplesRef.current.length - 1];
    if (!last) return false;

    const stop: PitStop = { lat: last.lat, lng: last.lng, t: last.t, label, note };
    pitStopsRef.current = [...pitStopsRef.current, stop];
    setPitStops(pitStopsRef.current);

    // Persist immediately — a pit stop is a deliberate act and shouldn't wait
    // for the next scheduled flush to become durable.
    writeDraft({
      draftId: draftIdRef.current,
      startedAt: startedAtRef.current,
      endedAt: Date.now(),
      samples: samplesRef.current,
      pitStops: pitStopsRef.current,
    });
    return true;
  }, []);

  const removePitStop = useCallback((index: number) => {
    pitStopsRef.current = pitStopsRef.current.filter((_, i) => i !== index);
    setPitStops(pitStopsRef.current);
  }, []);

  const subscribe = useCallback(async () => {
    stopSubscription();
    subRef.current = await Location.watchPositionAsync(
      {
        // Navigation-grade accuracy is the point of the feature; anything
        // coarser produces a track too ragged to compute cornering from.
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 0,
      },
      ingest,
    );
  }, [ingest, stopSubscription]);

  const start = useCallback(async () => {
    setError(null);
    setStatus('starting');

    const { status: perm } = await Location.requestForegroundPermissionsAsync();
    if (perm !== 'granted') {
      setStatus('idle');
      setError('Location permission is needed to record a route.');
      return false;
    }

    // Location services can be off system-wide even with permission granted.
    if (!(await Location.hasServicesEnabledAsync())) {
      setStatus('idle');
      setError('Turn on location services to record a route.');
      return false;
    }

    samplesRef.current = [];
    pitStopsRef.current = [];
    setPitStops([]);
    statsRef.current = EMPTY_STATS;
    setStats(EMPTY_STATS);
    setPath([]);
    draftIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    startedAtRef.current = Date.now();
    pausedMsRef.current = 0;
    pausedAtRef.current = 0;
    sinceFlushRef.current = 0;
    clearDraft();

    try {
      await subscribe();
    } catch {
      setStatus('idle');
      setError('Could not start location updates.');
      return false;
    }

    // Seed the draft so the background task has something to append to — it
    // bails out when no recording is in progress.
    writeDraft({
      draftId: draftIdRef.current,
      startedAt: startedAtRef.current,
      endedAt: Date.now(),
      samples: [],
      pitStops: [],
    });

    // Ask for background recording. Declining isn't fatal: the drive still
    // records perfectly while the app is open, so we fall back rather than
    // refusing to start.
    const bg = await startBackgroundUpdates();
    backgroundRef.current = bg;
    setBackgroundActive(bg);

    // Only hold the screen awake when we *can't* record in the background —
    // otherwise this needlessly burns battery on a long drive.
    if (!bg) activateKeepAwakeAsync('route-recorder').catch(() => {});

    setStatus('recording');
    return true;
  }, [subscribe]);

  /**
   * Picks a saved drive back up.
   *
   * Recording writes to disk continuously, so a drive survives the app being
   * closed, backgrounded or killed — but nothing was ever offered to bring one
   * back, which meant an interrupted drive was effectively lost. This reloads
   * the stored samples and keeps appending to the same draft.
   *
   * The break shows up as a gap between samples, which the server already
   * discounts from distance and moving time, so resuming an hour later doesn't
   * inflate the drive.
   */
  const resumeFromDraft = useCallback(async (): Promise<boolean> => {
    const draft = readDraft();
    if (!draft?.samples?.length) return false;

    setError(null);
    setStatus('starting');

    const { status: perm } = await Location.requestForegroundPermissionsAsync();
    if (perm !== 'granted') {
      setStatus('idle');
      setError('Location permission is needed to continue this route.');
      return false;
    }

    samplesRef.current = draft.samples;
    pitStopsRef.current = draft.pitStops ?? [];
    setPitStops(pitStopsRef.current);
    draftIdRef.current = draft.draftId;
    startedAtRef.current = draft.startedAt;
    // Time spent away isn't driving time; count it as paused so the on-screen
    // clock matches what the server will compute.
    pausedMsRef.current = Math.max(0, Date.now() - draft.endedAt);
    pausedAtRef.current = 0;
    sinceFlushRef.current = 0;

    // Rebuild the running totals from the reloaded track rather than starting
    // from zero, or the screen would show a fresh drive that isn't.
    let distance = 0;
    let movingMs = 0;
    let maxSpeed = 0;
    for (let i = 1; i < draft.samples.length; i++) {
      const prev = draft.samples[i - 1];
      const cur = draft.samples[i];
      if (cur.t - prev.t > 10000) continue; // a gap, not travel
      if (isMoving(cur, prev)) {
        distance += haversine(prev, cur);
        movingMs += cur.t - prev.t;
        if (cur.speed > maxSpeed) maxSpeed = cur.speed;
      }
    }
    statsRef.current = {
      distanceMeters: distance,
      elapsedMs: 0,
      movingMs,
      currentSpeed: 0,
      maxSpeed,
      sampleCount: draft.samples.length,
    };
    setStats(statsRef.current);

    try {
      await subscribe();
    } catch {
      setStatus('idle');
      setError('Could not restart location updates.');
      return false;
    }

    activateKeepAwakeAsync('route-recorder').catch(() => {});
    setStatus('recording');
    return true;
  }, [subscribe]);

  const pause = useCallback(() => {
    stopSubscription();
    pausedAtRef.current = Date.now();
    setStatus('paused');
  }, [stopSubscription]);

  const resume = useCallback(async () => {
    if (pausedAtRef.current) {
      pausedMsRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = 0;
    }
    try {
      await subscribe();
      setStatus('recording');
    } catch {
      setError('Could not resume location updates.');
    }
  }, [subscribe]);

  /** Ends the recording and hands back the track, or null if nothing usable. */
  const stop = useCallback(async (): Promise<RouteDraft | null> => {
    stopSubscription();
    await stopBackgroundUpdates();
    backgroundRef.current = false;
    setBackgroundActive(false);
    deactivateKeepAwake('route-recorder');
    setStatus('stopped');

    // The stored draft wins when the task was recording: it contains the
    // stretches driven with the app closed, which the in-memory array never
    // saw. Fall back to memory only if the file is somehow the poorer copy.
    const stored = readDraft();
    const memory = samplesRef.current;
    const samples = (stored?.samples?.length ?? 0) >= memory.length
      ? stored!.samples
      : memory;

    if (samples.length < 2) return null;

    const draft: RouteDraft = {
      draftId: draftIdRef.current,
      startedAt: startedAtRef.current,
      endedAt: Date.now(),
      samples,
      pitStops: pitStopsRef.current,
    };
    writeDraft(draft);
    return draft;
  }, [stopSubscription]);

  const discard = useCallback(() => {
    stopSubscription();
    stopBackgroundUpdates();
    backgroundRef.current = false;
    setBackgroundActive(false);
    deactivateKeepAwake('route-recorder');
    clearDraft();
    samplesRef.current = [];
    pitStopsRef.current = [];
    setPitStops([]);
    statsRef.current = EMPTY_STATS;
    setStats(EMPTY_STATS);
    setPath([]);
    setStatus('idle');
    setError(null);
  }, [stopSubscription]);

  // Publish a snapshot on a timer rather than per-fix, so a long drive doesn't
  // re-render the screen thousands of times.
  useEffect(() => {
    if (status !== 'recording' && status !== 'paused') return;
    const id = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current - pausedMsRef.current
        - (pausedAtRef.current ? Date.now() - pausedAtRef.current : 0);
      setStats({ ...statsRef.current, elapsedMs: Math.max(0, elapsed) });

      // The live map line only needs shape, not fidelity. Cap the point count
      // so the polyline stays cheap to draw on a long drive.
      const all = samplesRef.current;
      const step = Math.max(1, Math.ceil(all.length / 400));
      const decimated = all
        .filter((_, i) => i % step === 0)
        .map((s) => ({ lat: s.lat, lng: s.lng, speed: Math.max(0, s.speed) }));
      const last = all[all.length - 1];
      if (last && (decimated.length === 0 || decimated[decimated.length - 1].lat !== last.lat)) {
        decimated.push({ lat: last.lat, lng: last.lng, speed: Math.max(0, last.speed) });
      }
      setPath(decimated);
    }, UI_TICK_MS);
    return () => clearInterval(id);
  }, [status]);

  // With the background task running the OS keeps delivering fixes and the task
  // keeps writing them, so there is nothing to save here. Without it, going to
  // the background ends collection — flush immediately rather than trusting the
  // process to still be alive later.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && !backgroundRef.current && samplesRef.current.length > 1) {
        writeDraft({
          draftId: draftIdRef.current,
          startedAt: startedAtRef.current,
          endedAt: Date.now(),
          samples: samplesRef.current,
        });
      }
    });
    return () => sub.remove();
  }, []);

  // Never leave a subscription or a wake lock behind.
  useEffect(() => () => {
    subRef.current?.remove();
    subRef.current = null;
    deactivateKeepAwake('route-recorder');
    // The task survives unmount by design; only tear it down if nothing is
    // actually being recorded, so a backgrounded drive isn't cut short.
    if (!backgroundRef.current) stopBackgroundUpdates();
  }, []);

  return {
    status,
    stats,
    path,
    error,
    isRecording: status === 'recording',
    isPaused: status === 'paused',
    pitStops,
    addPitStop,
    removePitStop,
    /** True when the OS is recording even with the app closed. */
    backgroundActive,
    start,
    resumeFromDraft,
    pause,
    resume,
    stop,
    discard,
    /** The full track. Read only when saving — it's large. */
    getSamples: () => samplesRef.current,
  };
}

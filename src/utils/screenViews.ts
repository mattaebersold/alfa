import { AppState, type AppStateStatus } from 'react-native';
import { CONFIG } from '../constants/config';
import { getToken } from '../utils/token';

/**
 * Tells horacio which screens are being looked at, for the Screens tab of
 * the analytics dashboard.
 *
 * The server's request log can say which endpoints were called, but not
 * which screen called them, and a screen that loads nothing never shows up
 * there at all. So the app says so itself: every time the focused route
 * changes (RootNavigator) or the home screen's header tab changes
 * (FeedScreen), a view is queued here and posted in batches to
 * `POST /api/analytics/screens`.
 *
 * What is sent: the screen's route name, the one before it, and when. Never
 * a document id, never anything typed. The member is not named; the server
 * keeps a one-way hash so it can count people, not list them. A batch that
 * fails to send is dropped — a lost view costs a bar on a chart, and this
 * must never cost the app anything.
 *
 * A session is one sitting. It is a random id made up when the app starts
 * and again when it comes back to the foreground after half an hour away,
 * so "where does a sitting start" means what a person would mean by it,
 * even on a phone that keeps the app alive for days.
 */
const ENDPOINT = `${CONFIG.API_BASE_URL}/api/analytics/screens`;
const FLUSH_EVERY_MS = 15_000;
const FLUSH_AT = 25;
const QUEUE_CAP = 200;
const NEW_SESSION_AFTER_MS = 30 * 60 * 1000;

type View = { screen: string; prev?: string; at: number };

const randomId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;

let session = randomId();
let queue: View[] = [];
let current: string | null = null;
let lastViewAt = 0;
let feedTab = 'feed';
let timer: ReturnType<typeof setInterval> | null = null;
let sending = false;

/**
 * The name a view is filed under. The home screen is one route to the
 * navigator but several places to a member — the feed, the marketplace,
 * groups — so it reports as `Feed/<tab>` using the tab the header is on.
 */
const nameFor = (route: string) => (route === 'Feed' ? `Feed/${feedTab}` : route);

async function flush() {
  if (sending || queue.length === 0) return;
  const views = queue;
  queue = [];
  sending = true;
  try {
    const token = await getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify({ session, views }) });
  } catch {
    // Dropped on purpose. Retrying would only queue up more to lose.
  } finally {
    sending = false;
  }
}

function push(screen: string) {
  if (screen === current) return;
  const now = Date.now();
  queue.push({ screen, prev: current ?? undefined, at: now });
  if (queue.length > QUEUE_CAP) queue.shift();
  current = screen;
  lastViewAt = now;
  if (queue.length >= FLUSH_AT) void flush();
}

/** The focused route changed. Called by the navigation container. */
export function recordScreen(route: string | undefined) {
  if (!route) return;
  push(nameFor(route));
}

/**
 * The home screen's header tab changed. Only counts as a view while the
 * home screen is the one on screen; otherwise it just updates which tab a
 * later return to Feed will report.
 */
export function recordFeedTab(tab: string) {
  feedTab = tab;
  if (current && current.startsWith('Feed/')) push(`Feed/${tab}`);
}

function onAppState(state: AppStateStatus) {
  if (state === 'active') {
    if (lastViewAt && Date.now() - lastViewAt > NEW_SESSION_AFTER_MS) {
      // A new sitting: whatever is on screen is where it starts.
      session = randomId();
      const was = current;
      current = null;
      if (was) push(was);
    }
    return;
  }
  // Going to the background: send what there is, while the OS still lets us.
  void flush();
}

/** Starts the reporter. Safe to call more than once. */
export function startScreenViews() {
  if (timer) return;
  timer = setInterval(() => void flush(), FLUSH_EVERY_MS);
  AppState.addEventListener('change', onAppState);
}

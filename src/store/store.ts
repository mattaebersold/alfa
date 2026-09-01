import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import authReducer, { logout } from './authSlice';
import moderationReducer from './moderationSlice';
import connectivityReducer, { networkErrorSeen, connectionRestored } from './connectivitySlice';
import { apiService } from '../api/apiService';

/**
 * Turns ordinary API traffic into a connectivity *hint*.
 *
 * Every screen is already making requests, so their outcomes are the cheapest
 * early warning available. But a failure is not a verdict — RTK Query reports
 * a torn-down socket, a stalled endpoint and a genuinely absent network all as
 * FETCH_ERROR/TIMEOUT_ERROR — so this only bumps a counter that OfflineOverlay
 * answers by actually checking whether the device has a network.
 *
 * A success is conclusive in the other direction: bytes came back, so whatever
 * the overlay is claiming is out of date and gets cleared immediately.
 */
const connectivityMiddleware: Middleware = (store) => (next) => (action: any) => {
  const endpointName = action?.meta?.arg?.endpointName;
  if (endpointName) {
    const online = store.getState().connectivity.online;
    const status = action.payload?.status;
    if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR') {
      if (online) store.dispatch(networkErrorSeen());
    } else if (action.type.endsWith('/fulfilled') && !online) {
      store.dispatch(connectionRestored());
    }
  }
  return next(action);
};

/**
 * Ends the session the moment the server stops accepting our token.
 *
 * A token can go bad while the app still holds it — it expires, it's revoked,
 * the account is disabled — and nothing about the device tells us. What the app
 * did with that before was carry on: `restoreSession` only checks that a token
 * *exists*, so the member stayed "logged in" with no profile behind it. That's
 * the state behind the stuck-account reports — blue chrome instead of gold
 * because `accountType` was never read, a '?' where the avatar should be, and
 * every action failing, with no way out but deleting the app.
 *
 * A 401 is the unambiguous form of that, and it's worth acting on from *any*
 * endpoint rather than just the profile fetch, so a session that dies mid-use
 * ends there and then. Logging in doesn't go through RTK Query — the auth
 * thunks use axios directly — so a 401 here can only ever mean our own stored
 * token was refused, never a mistyped password.
 *
 * Deliberately only 401. A 403 is the server saying *this* thing is off limits
 * (a private group, another member's draft), which is a normal answer to a
 * normal request and no reason to throw anyone out. Transport failures aren't
 * grounds either: an unreachable server proves nothing about the token, and
 * logging people out when the train enters a tunnel would lose their session
 * for a reason that fixes itself. Those stay with the connectivity handling
 * above.
 *
 * The guard makes this idempotent. Several requests are usually in flight when
 * a token dies, so the first 401 through here clears `isLoggedIn` and the rest
 * fall straight through.
 */
const authExpiryMiddleware: Middleware = (store) => (next) => (action: any) => {
  const result = next(action);
  if (
    action?.meta?.arg?.endpointName &&
    action.payload?.status === 401 &&
    store.getState().auth.isLoggedIn
  ) {
    store.dispatch(logout({ expired: true }) as any);
  }
  return result;
};

export const store = configureStore({
  reducer: {
    auth: authReducer,
    moderation: moderationReducer,
    connectivity: connectivityReducer,
    [apiService.reducerPath]: apiService.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // These dev-only checks deep-scan the entire (large) RTK Query cache on
      // every dispatch, blowing past the 32ms warning threshold. RTK Query
      // already keeps its cache serializable and immutable, so we disable them.
      // (Both are no-ops in production regardless.)
      serializableCheck: false,
      immutableCheck: false,
    }).concat(apiService.middleware, connectivityMiddleware, authExpiryMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

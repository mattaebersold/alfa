import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import authReducer from './authSlice';
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
    }).concat(apiService.middleware, connectivityMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

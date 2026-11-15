import { configureStore, type Middleware, type Reducer } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import authReducer, { logout, type AuthState } from '../auth/authSlice';
import { orsApi } from '../api/orsApi';

/**
 * Ends the session the moment the server stops accepting our token — alfa's
 * rule, for the same reason: a token that dies mid-use otherwise leaves a
 * member in an app that looks signed in and can do nothing. Only a 401 counts;
 * a 403 is a normal answer about one thing, and a dropped connection proves
 * nothing about the token.
 */
const authExpiryMiddleware: Middleware = (store) => (next) => (action: any) => {
  const result = next(action);
  if (
    action?.meta?.arg?.endpointName &&
    action.payload?.status === 401 &&
    (store.getState() as OrsState).auth.isLoggedIn
  ) {
    store.dispatch(logout({ expired: true }) as any);
  }
  return result;
};

/** The slice of state every shared component can rely on. */
export interface OrsState {
  auth: AuthState;
  [orsApi.reducerPath]: ReturnType<typeof orsApi.reducer>;
}

/**
 * The store, with the shared slices and whatever the app adds.
 *
 * Serializable/immutable checks are off for the reason alfa gives: they deep-scan
 * the whole query cache on every dispatch in development.
 */
export function createOrsStore<R extends Record<string, Reducer>>(extra: R = {} as R) {
  return configureStore({
    reducer: {
      auth: authReducer,
      [orsApi.reducerPath]: orsApi.reducer,
      ...extra,
    },
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false, immutableCheck: false })
        .concat(orsApi.middleware, authExpiryMiddleware),
  });
}

export const useOrsDispatch = () => useDispatch<any>();
export const useOrsSelector: TypedUseSelectorHook<OrsState> = useSelector;

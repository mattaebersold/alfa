import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import authReducer from './authSlice';
import moderationReducer from './moderationSlice';
import { apiService } from '../api/apiService';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    moderation: moderationReducer,
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
    }).concat(apiService.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { appConfig, APP_HEADER } from '../constants/appConfig';
import { storeToken, removeToken, getToken } from './token';
import { orsApi } from '../api/orsApi';
import { currentPushToken } from '../notifications/pushToken';
import type { User, LoginResponse } from '../types/ors';

/**
 * The shared auth slice, pointed at the API set in constants/appConfig.
 *
 * Same endpoints, same payloads, same session rules — the only addition is the
 * app header on every call, which is how horacio knows to tag the account with
 * this app (`accounts: ['photo']`, say) as it signs someone in or up.
 */
export interface AuthState {
  loading: boolean;
  userInfo: User | null;
  userToken: string | null;
  isLoggedIn: boolean;
  error: string | null;
  success: boolean;
  /** The last logout was the server refusing our token, not the member's choice. */
  sessionExpired: boolean;
  /** The stored token hasn't been read back yet. */
  restoring: boolean;
}

const initialState: AuthState = {
  loading: false,
  userInfo: null,
  userToken: null,
  isLoggedIn: false,
  error: null,
  success: false,
  sessionExpired: false,
  restoring: true,
};

const url = (path: string) => `${appConfig().API_BASE_URL}${path}`;
const jsonHeaders = () => ({ 'Content-Type': 'application/json', [APP_HEADER]: appConfig().app });
const errorOf = (error: any, fallback: string) =>
  error.response?.data?.error || error.response?.data?.message || fallback;

export const userLogin = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post<LoginResponse>(
        url('/api/users/login'),
        { email, password, app: appConfig().app },
        { headers: jsonHeaders() },
      );
      await storeToken(data.userToken);
      return data;
    } catch (error: any) {
      return rejectWithValue(errorOf(error, 'Login failed'));
    }
  },
);

/** Sign in or up with Google — one endpoint does both, as in alfa. */
export const googleSignIn = createAsyncThunk(
  'auth/googleSignIn',
  async (idToken: string, { rejectWithValue }) => {
    try {
      const { data } = await axios.post<LoginResponse>(
        url('/api/users/google-auth'),
        { idToken, app: appConfig().app },
        { headers: jsonHeaders() },
      );
      await storeToken(data.userToken);
      return data;
    } catch (error: any) {
      return rejectWithValue(errorOf(error, 'Google sign-in failed'));
    }
  },
);

/** Sign in or up with Apple. The name only ever arrives on first authorization. */
export const appleSignIn = createAsyncThunk(
  'auth/appleSignIn',
  async (
    { identityToken, fullName }: {
      identityToken: string;
      fullName?: { givenName?: string | null; familyName?: string | null } | null;
    },
    { rejectWithValue },
  ) => {
    try {
      const { data } = await axios.post<LoginResponse>(
        url('/api/users/apple-auth'),
        { identityToken, fullName, app: appConfig().app },
        { headers: jsonHeaders() },
      );
      await storeToken(data.userToken);
      return data;
    } catch (error: any) {
      return rejectWithValue(errorOf(error, 'Apple sign-in failed'));
    }
  },
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (formData: FormData, { rejectWithValue }) => {
    try {
      formData.append('app', appConfig().app);
      const { data } = await axios.post(
        url('/api/users/register-mobile'),
        formData,
        { headers: { 'Content-Type': 'multipart/form-data', [APP_HEADER]: appConfig().app } },
      );
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || error.response?.data?.error || 'Registration failed',
      );
    }
  },
);

export const verifyEmail = createAsyncThunk(
  'auth/verifyEmail',
  async ({ email, code }: { email: string; code: string }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(url('/api/users/verify-email'), { email, code }, { headers: jsonHeaders() });
      return data;
    } catch (error: any) {
      return rejectWithValue(errorOf(error, 'Verification failed'));
    }
  },
);

export const resendVerification = createAsyncThunk(
  'auth/resendVerification',
  async (email: string, { rejectWithValue }) => {
    try {
      await axios.post(url('/api/users/resend-verification'), { email }, { headers: jsonHeaders() });
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to resend code');
    }
  },
);

export async function requestPasswordReset(email: string): Promise<void> {
  await axios.post(url('/api/password-reset/request'), { email }, { headers: jsonHeaders() });
}

export const logout = createAsyncThunk(
  'auth/logout',
  async (opts: { expired?: boolean } | void, { dispatch }) => {
    // Hand this device's push token back first, while the session still
    // works — otherwise whoever signs in next on this phone gets the previous
    // member's pushes. Best effort: an expired session can't, and that's fine.
    const pushToken = currentPushToken();
    const sessionToken = await getToken();
    if (pushToken && sessionToken && !(opts && opts.expired)) {
      try {
        await axios.post(url('/api/users/device-token/remove'), { token: pushToken }, {
          headers: { ...jsonHeaders(), Authorization: `Bearer ${sessionToken}` },
          timeout: 5000,
        });
      } catch {
        // Nothing to do — the sign-out itself must not fail on this.
      }
    }
    await removeToken();
    dispatch(orsApi.util.resetApiState());
    return { expired: !!(opts && opts.expired) };
  },
);

export const restoreSession = createAsyncThunk('auth/restoreSession', async () => getToken());

const signedIn = (state: AuthState, payload: LoginResponse) => {
  state.loading = false;
  state.userInfo = payload;
  state.userToken = payload.userToken;
  state.isLoggedIn = true;
  state.error = null;
  state.sessionExpired = false;
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
    clearSuccess: (state) => { state.success = false; },
    clearSessionExpired: (state) => { state.sessionExpired = false; },
    setCredentials: (state, action: PayloadAction<User>) => {
      state.userInfo = action.payload;
      state.isLoggedIn = true;
    },
  },
  extraReducers: (builder) => {
    const pending = (state: AuthState) => { state.loading = true; state.error = null; };
    const rejected = (state: AuthState, { payload }: { payload: unknown }) => {
      state.loading = false;
      state.error = payload as string;
    };
    builder
      .addCase(userLogin.pending, pending)
      .addCase(userLogin.fulfilled, (state, { payload }) => signedIn(state, payload))
      .addCase(userLogin.rejected, (state, action) => { rejected(state, action); state.isLoggedIn = false; })
      .addCase(googleSignIn.pending, pending)
      .addCase(googleSignIn.fulfilled, (state, { payload }) => signedIn(state, payload))
      .addCase(googleSignIn.rejected, rejected)
      .addCase(appleSignIn.pending, pending)
      .addCase(appleSignIn.fulfilled, (state, { payload }) => signedIn(state, payload))
      .addCase(appleSignIn.rejected, rejected)
      .addCase(registerUser.pending, pending)
      .addCase(registerUser.fulfilled, (state) => { state.loading = false; state.success = true; state.error = null; })
      .addCase(registerUser.rejected, rejected)
      .addCase(verifyEmail.pending, pending)
      .addCase(verifyEmail.fulfilled, (state) => { state.loading = false; state.error = null; })
      .addCase(verifyEmail.rejected, rejected)
      .addCase(resendVerification.pending, pending)
      .addCase(resendVerification.fulfilled, (state) => { state.loading = false; state.error = null; })
      .addCase(resendVerification.rejected, rejected)
      .addCase(logout.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.userInfo = null;
        state.userToken = null;
        state.isLoggedIn = false;
        state.error = null;
        state.sessionExpired = payload?.expired ?? false;
      })
      .addCase(restoreSession.fulfilled, (state, { payload }) => {
        state.userToken = payload;
        state.isLoggedIn = !!payload;
        state.restoring = false;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.isLoggedIn = false;
        state.restoring = false;
      });
  },
});

export const { clearError, clearSuccess, clearSessionExpired, setCredentials } = authSlice.actions;
export default authSlice.reducer;

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { CONFIG } from '../constants/config';
import { storeToken, removeToken, getToken } from '../utils/token';
import { orsApi } from '@ors/kit';
import { apiService } from '../api/apiService';
import type { User, LoginResponse } from '../types/api';

interface AuthState {
  loading: boolean;
  userInfo: User | null;
  userToken: string | null;
  isLoggedIn: boolean;
  error: string | null;
  success: boolean;
  /**
   * The last logout was forced by the server rejecting our token, not chosen by
   * the member. The login screen says so, otherwise being dumped back at a
   * sign-in form reads as the app having lost their session for no reason.
   */
  sessionExpired: boolean;
  /**
   * The stored token hasn't been read back yet. True from launch until
   * `restoreSession` settles, because SecureStore is async and until it answers
   * we genuinely don't know which of the two apps to show — assuming "logged
   * out" for those frames flashes the login screen at members who are not.
   */
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

// ── Async thunks ────────────────────────────────────────────────────────────

/**
 * Why a login was refused. `needsVerification` is the one the login screen
 * acts on rather than shows: the password was right but the address isn't
 * verified yet, so it goes to the verify screen with `email` — which may
 * differ from what was typed, since a username signs in too.
 */
export interface LoginRejection {
  message: string;
  needsVerification?: boolean;
  email?: string;
  verificationSent?: boolean;
}

/** A verify or resend refusal, with what the verify screen needs to recover. */
export interface VerifyRejection {
  message: string;
  /** The code can't be used any more — expired or out of attempts. */
  expired?: boolean;
  /** Seconds until the server will send another. */
  retryAfter?: number;
}

const verifyRejection = (error: any, fallback: string): VerifyRejection => {
  const body = error.response?.data;
  return {
    message: body?.error || body?.message || (error.response ? fallback : 'No connection. Check your internet and try again.'),
    expired: !!body?.expired,
    retryAfter: body?.retryAfter,
  };
};

export const userLogin = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post<LoginResponse>(
        `${CONFIG.API_BASE_URL}/api/users/login`,
        { email, password },
        { headers: { 'Content-Type': 'application/json' } }
      );
      await storeToken(data.userToken);
      return data;
    } catch (error: any) {
      const body = error.response?.data;
      return rejectWithValue({
        message: body?.error || body?.message || 'Login failed',
        needsVerification: !!body?.needsVerification,
        email: body?.email,
        verificationSent: body?.verificationSent,
      } as LoginRejection);
    }
  }
);

/**
 * Sign in (or sign up) with a Google ID token.
 *
 * One thunk for both, because Google's endpoint is one endpoint: horacio looks
 * the account up by Google id, falls back to matching the address, and creates
 * one only if neither hits. There is no "register with Google" distinct from
 * "log in with Google" — the member taps the same button either way, and which
 * of the three happened is the server's business.
 *
 * The token goes straight through to the same session storage `userLogin` uses,
 * so everything downstream — the axios interceptor, the session-expiry check —
 * behaves identically to an email sign-in.
 */
export const googleSignIn = createAsyncThunk(
  'auth/googleSignIn',
  async (idToken: string, { rejectWithValue }) => {
    try {
      const { data } = await axios.post<LoginResponse>(
        `${CONFIG.API_BASE_URL}/api/users/google-auth`,
        { idToken },
        { headers: { 'Content-Type': 'application/json' } }
      );
      await storeToken(data.userToken);
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || error.response?.data?.message || 'Google sign-in failed'
      );
    }
  }
);

/**
 * Sign in (or sign up) with Apple.
 *
 * `fullName` rides alongside the token because Apple puts the name in the
 * credential it hands the app and never in the JWT — and, like the email, only
 * on the very first authorization. Sending it on every call is harmless: the
 * server only reads it when creating an account.
 */
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
        `${CONFIG.API_BASE_URL}/api/users/apple-auth`,
        { identityToken, fullName },
        { headers: { 'Content-Type': 'application/json' } }
      );
      await storeToken(data.userToken);
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || error.response?.data?.message || 'Apple sign-in failed'
      );
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (formData: FormData, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${CONFIG.API_BASE_URL}/api/users/register-mobile`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || error.response?.data?.error || 'Registration failed'
      );
    }
  }
);

export const verifyEmail = createAsyncThunk(
  'auth/verifyEmail',
  async ({ email, code }: { email: string; code: string }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${CONFIG.API_BASE_URL}/api/users/verify-email`,
        { email, code },
        { headers: { 'Content-Type': 'application/json' } }
      );
      return data as { success: boolean; alreadyVerified?: boolean };
    } catch (error: any) {
      return rejectWithValue(verifyRejection(error, 'Verification failed'));
    }
  }
);

export const resendVerification = createAsyncThunk(
  'auth/resendVerification',
  async (email: string, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${CONFIG.API_BASE_URL}/api/users/resend-verification`,
        { email },
        { headers: { 'Content-Type': 'application/json' } }
      );
      return data as { success: boolean; alreadyVerified?: boolean };
    } catch (error: any) {
      return rejectWithValue(verifyRejection(error, 'Failed to resend code'));
    }
  }
);

/** Move an unverified account to a corrected address and send a code there. */
export const changeVerificationEmail = createAsyncThunk(
  'auth/changeVerificationEmail',
  async (
    { email, password, newEmail }: { email: string; password: string; newEmail: string },
    { rejectWithValue },
  ) => {
    try {
      const { data } = await axios.post(
        `${CONFIG.API_BASE_URL}/api/users/change-verification-email`,
        { email, password, newEmail },
        { headers: { 'Content-Type': 'application/json' } }
      );
      return data as { email: string; verificationSent: boolean };
    } catch (error: any) {
      return rejectWithValue(verifyRejection(error, 'Could not change email'));
    }
  }
);

/**
 * Ends the session and clears everything derived from it.
 *
 * `expired: true` marks the involuntary case — the token was rejected, or the
 * account it points at can no longer be loaded. Same teardown either way; the
 * flag only changes what the login screen says.
 */
export const logout = createAsyncThunk(
  'auth/logout',
  async (opts: { expired?: boolean } | void, { dispatch }) => {
    await removeToken();
    // Clear all cached queries so the next account doesn't see the previous user's data.
    dispatch(apiService.util.resetApiState());
    // And the kit's — photo spots, and anything else alfa takes from @ors/kit.
    dispatch(orsApi.util.resetApiState());
    return { expired: !!(opts && opts.expired) };
  }
);

export const restoreSession = createAsyncThunk('auth/restoreSession', async () => {
  const token = await getToken();
  return token;
});

// ── Slice ───────────────────────────────────────────────────────────────────

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
    builder
      // Login
      .addCase(userLogin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(userLogin.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.userInfo = payload;
        state.userToken = payload.userToken;
        state.isLoggedIn = true;
        state.error = null;
        state.sessionExpired = false;
      })
      // Identical to userLogin: same payload shape, same session.
      .addCase(googleSignIn.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(googleSignIn.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.userInfo = payload;
        state.userToken = payload.userToken;
        state.isLoggedIn = true;
        state.error = null;
        state.sessionExpired = false;
      })
      .addCase(googleSignIn.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload as string;
      })
      .addCase(appleSignIn.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(appleSignIn.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.userInfo = payload;
        state.userToken = payload.userToken;
        state.isLoggedIn = true;
        state.error = null;
        state.sessionExpired = false;
      })
      .addCase(appleSignIn.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload as string;
      })
      .addCase(userLogin.rejected, (state, { payload }) => {
        const rejection = payload as LoginRejection | undefined;
        state.loading = false;
        // Unverified isn't an error to show: the login screen routes to the
        // verify screen instead.
        state.error = rejection?.needsVerification ? null : (rejection?.message ?? 'Login failed');
        state.isLoggedIn = false;
      })
      // Register
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload as string;
      })
      // Verify, resend and change-email keep their state on the verify screen.
      // Through the slice, a failed verify's message outlived the screen and
      // greeted the member on the login form they were sent back to.
      // Logout
      .addCase(logout.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.userInfo = null;
        state.userToken = null;
        state.isLoggedIn = false;
        state.error = null;
        state.sessionExpired = payload?.expired ?? false;
      })
      // Restore session
      .addCase(restoreSession.fulfilled, (state, { payload }) => {
        state.userToken = payload;
        state.isLoggedIn = !!payload;
        state.restoring = false;
      })
      // A SecureStore that won't answer leaves us with no token to try, which
      // is the logged-out case — the alternative is holding the splash forever.
      .addCase(restoreSession.rejected, (state) => {
        state.isLoggedIn = false;
        state.restoring = false;
      });
  },
});

export const { clearError, clearSuccess, clearSessionExpired, setCredentials } = authSlice.actions;
export default authSlice.reducer;

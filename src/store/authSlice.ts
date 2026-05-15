import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { CONFIG } from '../constants/config';
import { storeToken, removeToken, getToken } from '../utils/token';
import type { User, LoginResponse } from '../types/api';

interface AuthState {
  loading: boolean;
  userInfo: User | null;
  userToken: string | null;
  isLoggedIn: boolean;
  error: string | null;
  success: boolean;
}

const initialState: AuthState = {
  loading: false,
  userInfo: null,
  userToken: null,
  isLoggedIn: false,
  error: null,
  success: false,
};

// ── Async thunks ────────────────────────────────────────────────────────────

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
      return rejectWithValue(
        error.response?.data?.error || error.response?.data?.message || 'Login failed'
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
      return data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || error.response?.data?.message || 'Verification failed'
      );
    }
  }
);

export const resendVerification = createAsyncThunk(
  'auth/resendVerification',
  async (email: string, { rejectWithValue }) => {
    try {
      await axios.post(
        `${CONFIG.API_BASE_URL}/api/users/resend-verification`,
        { email },
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to resend code'
      );
    }
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  await removeToken();
});

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
      })
      .addCase(userLogin.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload as string;
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
      // Verify email
      .addCase(verifyEmail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyEmail.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
      })
      .addCase(verifyEmail.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload as string;
      })
      // Resend verification
      .addCase(resendVerification.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resendVerification.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
      })
      .addCase(resendVerification.rejected, (state, { payload }) => {
        state.loading = false;
        state.error = payload as string;
      })
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.loading = false;
        state.userInfo = null;
        state.userToken = null;
        state.isLoggedIn = false;
        state.error = null;
      })
      // Restore session
      .addCase(restoreSession.fulfilled, (state, { payload }) => {
        state.userToken = payload;
        state.isLoggedIn = !!payload;
      });
  },
});

export const { clearError, clearSuccess, setCredentials } = authSlice.actions;
export default authSlice.reducer;

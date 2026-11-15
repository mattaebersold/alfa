import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useOrsDispatch, useOrsSelector } from '../store/createStore';
import { restoreSession, logout, setCredentials } from './authSlice';
import { useGetLoggedInUserQuery } from '../api/orsApi';
import { appConfig } from '../constants/appConfig';
import { Spinner } from '../components/Spinner';
import SessionRecovery from './SessionRecovery';
import ZipPrompt from './ZipPrompt';
import type { AuthStackParamList } from './branding';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import VerifyEmailScreen from './screens/VerifyEmailScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}

/**
 * alfa's AuthGate: decides between the sign-in stack and the app.
 *
 * It waits for the *account*, not just a token — `restoreSession` only proves a
 * token is stored, and rendering the app before the profile lands is what gave
 * alfa its stuck sessions (blue chrome on a Pro member, a '?' for a face). So:
 * reading the token, spinner; no token, sign-in; token but no profile yet,
 * spinner or the recovery screen; profile in hand, the app.
 *
 * Render inside the NavigationContainer: the sign-in stack is a navigator.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const dispatch = useOrsDispatch();
  const { isLoggedIn, userInfo, restoring } = useOrsSelector((s) => s.auth);

  useEffect(() => { dispatch(restoreSession()); }, [dispatch]);

  const { data: user, isFetching, refetch } = useGetLoggedInUserQuery(undefined, {
    skip: !isLoggedIn,
    pollingInterval: appConfig().USER_REFRESH_INTERVAL,
  });

  useEffect(() => {
    if (!user) return;
    // A 200 carrying something that isn't an account is as dead as a 401.
    if (!user.user_id && !user._id) {
      dispatch(logout({ expired: true }));
      return;
    }
    dispatch(setCredentials(user));
  }, [user, dispatch]);

  if (restoring) return <Spinner fullScreen />;
  if (!isLoggedIn) return <AuthNavigator />;
  if (!userInfo) {
    if (isFetching) return <Spinner fullScreen />;
    return (
      <SessionRecovery
        onRetry={refetch}
        onSignOut={() => dispatch(logout({ expired: true }))}
        retrying={isFetching}
      />
    );
  }
  return (
    <>
      {children}
      {/* Over the app, not in place of it — see ZipPrompt. */}
      <ZipPrompt />
    </>
  );
}

import React, { createContext, useContext } from 'react';
import type { ImageSourcePropType } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * What the auth screens need to look like *this* app.
 *
 * The screens themselves are alfa's, shared — the blurred card over a
 * crossfading car photo, the same fields and the same Google/Apple buttons —
 * and only the logo, the name and the photos behind them change per app.
 */
export interface AuthBranding {
  /** Crossfaded behind the login, register and verify screens. */
  backgrounds: ImageSourcePropType[];
  logo: ImageSourcePropType;
  /** Two lines under the logo, e.g. "Open Road\nSociety". */
  title: string;
  /**
   * One line explaining the shared account, shown on login and register:
   * "Use your Open Road Society account" — so a member doesn't make a second
   * one they already have.
   */
  accountNote?: string;
}

const BrandingContext = createContext<AuthBranding | null>(null);

export function AuthBrandingProvider({ value, children }: { value: AuthBranding; children: React.ReactNode }) {
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useAuthBranding(): AuthBranding {
  const b = useContext(BrandingContext);
  if (!b) throw new Error('useAuthBranding: wrap the app in <AuthBrandingProvider>');
  return b;
}

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string; password?: string };
  ForgotPassword: undefined;
};

export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export const CONFIG = {
  API_BASE_URL: 'https://factory.openroadsociety.co',
  S3_BASE_URL: 'https://partstash-ghia-images.s3.us-west-2.amazonaws.com',
  RECAPTCHA_SITE_KEY: '6Le2gDssAAAAAEEsB35y_2yMMs3BWOIRFL9lnrOo',
  NOTIFICATION_POLL_INTERVAL: 30_000,
  MESSAGE_POLL_INTERVAL: 30_000,
  // An open thread is a conversation in progress, so it refreshes far more
  // eagerly than the inbox badge that just needs to be roughly current.
  THREAD_POLL_INTERVAL: 8_000,
  USER_REFRESH_INTERVAL: 900_000,
  DEFAULT_PAGE_LIMIT: 12,

  /**
   * Google sign-in client ids.
   *
   * Not secrets — a client id is public by definition, it's in the page source
   * of every web app that uses one and in the binary of every native app. What
   * protects the account is the signing certificate (Android) and the bundle id
   * (iOS) that Google checks the request against.
   *
   * `GOOGLE_WEB_CLIENT_ID` is the same client horacio verifies tokens against
   * (`GOOGLE_CLIENT_ID` there) and the same one murray's web sign-in uses. It
   * sets the `aud` claim of the ID token, which is why a *web* id belongs in a
   * native app — and why these two values must never drift apart.
   *
   * `GOOGLE_IOS_CLIENT_ID` identifies the iOS app to Google. Android needs an
   * OAuth client too, but it is matched by package name and SHA-1 rather than
   * named here.
   *
   * The iOS id also appears reversed as `iosUrlScheme` on the google-signin
   * plugin in app.json — Google redirects back into the app through that
   * scheme, so changing one means changing the other.
   */
  GOOGLE_WEB_CLIENT_ID: '102801063030-8au92n7v1vhssgd8bbdabqi3ilrdf4l0.apps.googleusercontent.com',
  GOOGLE_IOS_CLIENT_ID: '102801063030-muebpoen038tgise15bm7t4crbe2o9kl.apps.googleusercontent.com',
} as const;

export const imageUrl = (filename: string | null | undefined): string | null => {
  if (!filename) return null;
  if (filename.startsWith('http')) return filename;
  return `${CONFIG.S3_BASE_URL}/${filename}`;
};

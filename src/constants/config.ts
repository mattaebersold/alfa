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
} as const;

export const imageUrl = (filename: string | null | undefined): string | null => {
  if (!filename) return null;
  if (filename.startsWith('http')) return filename;
  return `${CONFIG.S3_BASE_URL}/${filename}`;
};

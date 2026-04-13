export const CONFIG = {
  API_BASE_URL: 'http://localhost:4000',
  S3_BASE_URL: 'https://partstash-ghia-images.s3.us-west-2.amazonaws.com',
  NOTIFICATION_POLL_INTERVAL: 30_000,
  MESSAGE_POLL_INTERVAL: 30_000,
  USER_REFRESH_INTERVAL: 900_000,
  DEFAULT_PAGE_LIMIT: 12,
} as const;

export const imageUrl = (filename: string | null | undefined): string | null => {
  if (!filename) return null;
  if (filename.startsWith('http')) return filename;
  return `${CONFIG.S3_BASE_URL}/${filename}`;
};

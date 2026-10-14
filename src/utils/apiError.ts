/**
 * A failed request, as a sentence someone can act on — rather than one
 * "please try again" for a timeout, a lost connection, a 403 and a 500 alike.
 * Reads RTK Query's error shape: a string `status` for the client-side
 * failures, a number with the server's `{ error }` body for the rest.
 */
export function describeApiError(err: any): string {
  const status = err?.status;
  const serverMsg = err?.data?.error ?? err?.data?.message ?? (typeof err?.data === 'string' ? err.data : '');
  if (status === 'TIMEOUT_ERROR') return 'This is taking too long — the connection may be slow. Check your signal and try again.';
  if (status === 'FETCH_ERROR') return 'Couldn\'t reach the server. Check your connection and try again.';
  if (status === 'PARSING_ERROR') return `The server sent back something unexpected (HTTP ${err?.originalStatus ?? '?'}).`;
  if (status === 401) return 'You appear to be signed out. Log in again and retry.';
  if (serverMsg) return String(serverMsg);
  if (status === 403) return 'You don\'t have permission to post here — are you still a member?';
  if (status === 413) return 'Those photos are too large to send. Try fewer, or smaller ones.';
  if (typeof status === 'number') return `Something went wrong on the server (HTTP ${status}). Try again in a moment.`;
  return 'Something went wrong. Try again.';
}

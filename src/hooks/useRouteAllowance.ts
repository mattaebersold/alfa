import { useGetUsageQuery } from '../api/apiService';
import { useAppSelector } from '../store/store';

/**
 * Whether this member can make a route right now.
 *
 * Every member gets one route, Pro ten, an admin any number (horacio's
 * limits.checkRouteAllowance — the server is the one that refuses). A slot
 * comes back when a route is deleted.
 *
 * `loading` until the usage arrives for a basic member, so a screen can wait
 * rather than bounce someone who's allowed. A server from before the basic
 * allowance sends no count, only `allowed`, which is false for basic.
 */
export function useRouteAllowance(): {
  status: 'allowed' | 'blocked' | 'loading';
  used?: number;
  limit?: number | null;
} {
  // Only an admin is uncapped; Pro has a ceiling too, so it asks like anyone.
  const isAdmin = useAppSelector((s) => s.auth.userInfo?.accountType === 'admin');
  const { data, isLoading, isError } = useGetUsageQuery(undefined, { skip: isAdmin });
  if (isAdmin) return { status: 'allowed' };
  const routes = data?.routes;
  if (!routes) return { status: isLoading ? 'loading' : isError ? 'allowed' : 'loading' };
  if (typeof routes.used !== 'number') return { status: routes.allowed ? 'allowed' : 'blocked' };
  return { status: routes.allowed ? 'allowed' : 'blocked', used: routes.used, limit: routes.limit ?? null };
}

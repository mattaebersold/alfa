import {
  useGetProHomeQuery, useGetGroupPostsFeedInfiniteQuery, useGetGroupDiscussionFeedInfiniteQuery,
} from '../api/apiService';

/**
 * PRO › Home's data, loaded as the app opens and held for as long as the
 * home screen is up — so the PRO tab has it ready (or nearly) when it's
 * picked, and coming back to it never starts from nothing. The same queries
 * ProHomeScreen makes, so they share one cache: Home, then the Pro group's
 * posts and discussion once Home says which group it is.
 */
export function useWarmProHome(isPro: boolean) {
  const { data } = useGetProHomeQuery(undefined, { skip: !isPro });
  const groupId = data?.group?.internal_id ?? '';
  useGetGroupPostsFeedInfiniteQuery({ groupId }, { skip: !isPro || !groupId });
  useGetGroupDiscussionFeedInfiniteQuery({ groupId }, { skip: !isPro || !groupId });
}

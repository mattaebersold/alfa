import React, { useLayoutEffect } from 'react';
import { ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Pencil } from 'lucide-react-native';
import { useGetListQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ListSummaryContent from '../../components/lists/ListSummaryContent';
import type { AppStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';
import { useRefreshControl } from '../../hooks/useRefreshControl';

type RouteType = RouteProp<AppStackParamList, 'ListDetail'>;

/**
 * A list, as a screen — for the arrivals that have no page to open a panel
 * over.
 *
 * Inside the app a list opens as a summary panel (ListSummaryModal) over the
 * profile or car page it was tapped on, and nothing in the app navigates here
 * any more. But a notification tap arrives with a list id and no page behind
 * it — utils/notificationTarget's `list` case points here — and a panel over
 * whatever happened to be on screen is a panel out of nowhere. So the route
 * stays (it's also where a deep link would go, if lists ever get one), and
 * shows exactly what the panel shows: the same component, not a second
 * rendering.
 *
 * It used to be the owner's workbench too — add, reorder, delete. That's
 * EditList now, reached from the pencil, so that reading a list and changing
 * one are the same two things wherever you start from.
 */
export default function ListDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteType>();
  const { listId } = route.params;
  const colors = useColors();
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);

  const { data: list, isLoading, error, refetch } = useGetListQuery(listId);
  const refreshControl = useRefreshControl(refetch);

  const isOwner = !!(myId && list && myId === list.user_id);

  useLayoutEffect(() => {
    if (!isOwner) return;
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('EditList', { listId })}
          style={styles.headerBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Edit list"
        >
          <Pencil size={18} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [isOwner, listId, navigation]);

  if (isLoading) return <Spinner fullScreen />;
  if (!list) {
    // 403 is the server's "this list is private" — worth telling apart from a
    // list that's gone, since a notification can point at either.
    const isPrivate = (error as any)?.status === 403;
    return (
      <EmptyState
        title={isPrivate ? 'This list is private' : 'List not found'}
        message={isPrivate ? undefined : 'It may have been deleted.'}
      />
    );
  }

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <ScrollView refreshControl={refreshControl} contentContainerStyle={styles.scroll}>
        <ListSummaryContent
          list={list}
          // No panel to stack a summary on here, so the author is a push.
          onOpenUser={(userId) => navigation.navigate('UserDetail', { userId, username: list.user?.username })}
          onOpenCar={(carId) => navigation.navigate('CarDetail', { carId })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll:    { paddingBottom: 40 },
  headerBtn: { marginRight: 4, padding: 4 },
});

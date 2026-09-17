import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { Archive, ArrowRightLeft, Trash2, Search, ChevronLeft } from 'lucide-react-native';
import SharedModal from '../ui/SharedModal';
import Avatar from '../ui/Avatar';
import EmptyState from '../ui/EmptyState';
import {
  useArchiveCarMutation,
  useTransferCarMutation,
  useDeleteCarMutation,
  useSearchUsersQuery,
} from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useAppSelector } from '../../store/store';
import type { GarageCar, User } from '../../types/api';

/**
 * What "delete this car" should actually mean.
 *
 * Deleting was the only way to take a car off your profile, and it threw away
 * the mods, galleries, tasks and notes built up around it — years of records
 * gone because someone sold the car. Three answers instead, in increasing
 * order of finality, each saying plainly what it does:
 *
 *   Archive   — off the profile, restorable from the dashboard
 *   Transfer  — hand it, and its history, to the person who owns it now
 *   Delete    — erase it and everything attached, for good
 *
 * Transfer opens a second step inside the same sheet rather than a second
 * modal: iOS won't present one modal over another that's still dismissing, and
 * a back arrow reads better than a sheet that vanishes and reappears.
 */

type Step = 'choose' | 'transfer';

/** Long enough that a search fires per pause, not per keystroke. */
const DEBOUNCE_MS = 300;

/** Roughly SharedModal's open spring, so focus lands after it settles. */
const FOCUS_DELAY_MS = 350;

export default function CarDeleteOptionsModal({
  visible,
  car,
  onClose,
  onDeleted,
  initialStep = 'choose',
}: {
  visible: boolean;
  car: GarageCar | null | undefined;
  onClose: () => void;
  /**
   * Open straight into the recipient picker.
   *
   * "Transfer Car" is its own row in the car menus — handing a car to someone
   * is a thing you set out to do, not something you discover while trying to
   * delete it.
   */
  initialStep?: Step;
  /**
   * The car is no longer in the garage — archived, handed over, or erased.
   * A screen showing that one car should leave; a list can just refresh.
   */
  onDeleted?: () => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  /**
   * A co-owner can put the car away — it's theirs too — but giving it away or
   * erasing it is the owner's alone, which is the line the server draws.
   * Offering a co-owner those two would be offering a 403.
   */
  const me = useAppSelector((st) => st.auth.userInfo?.user_id);
  const isOwner = !!me && me === car?.user_id;
  const [step, setStep] = useState<Step>(initialStep);
  const searchRef = useRef<TextInput>(null);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [busy, setBusy] = useState(false);

  const [archiveCar] = useArchiveCarMutation();
  const [transferCar] = useTransferCarMutation();
  const [deleteCar] = useDeleteCarMutation();

  const name = useMemo(
    () => [car?.year, car?.make, car?.model].filter(Boolean).join(' ') || car?.title || 'this car',
    [car],
  );

  // Every opening starts where the caller asked, not wherever the last one
  // was left.
  useEffect(() => {
    if (visible) { setStep(initialStep); setSearch(''); setDebounced(''); }
  }, [visible, initialStep]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  /**
   * Focus after the sheet has finished arriving, not during.
   *
   * `autoFocus` raises the keyboard while SharedModal is still springing the
   * sheet up, and the two animations fight — the field stutters and the first
   * keystrokes can be dropped.
   */
  useEffect(() => {
    if (!visible || step !== 'transfer') return undefined;
    const t = setTimeout(() => searchRef.current?.focus(), FOCUS_DELAY_MS);
    return () => clearTimeout(t);
  }, [visible, step]);

  /**
   * The dedicated search endpoint, not the members listing.
   *
   * `api/users` is the browse screen's query — it runs the region and radius
   * filtering, the geo lookups and the owner-region attachment, none of which
   * a name picker needs. `api/users/search` is an indexed name match and
   * nothing else.
   */
  const { data: results, isFetching } = useSearchUsersQuery(
    debounced,
    { skip: step !== 'transfer' || debounced.length < 2 },
  );

  const run = async (fn: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    try {
      await fn();
      onClose();
      onDeleted?.();
    } catch (err: any) {
      Alert.alert('Error', err?.data?.error || failure);
    } finally {
      setBusy(false);
    }
  };

  const onArchive = () => {
    if (!car) return;
    run(() => archiveCar({ internal_id: car.internal_id }).unwrap(),
      "Couldn't archive that car. Please try again.");
  };

  const onDelete = () => {
    if (!car) return;
    // The one irreversible choice, so it asks twice and says what goes.
    Alert.alert(
      'Delete permanently?',
      `${name}, along with its galleries, mods, tasks, notes and photos, will be erased. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: () => run(() => deleteCar({ internal_id: car.internal_id }).unwrap(),
            "Couldn't delete that car. Please try again."),
        },
      ],
    );
  };

  const onTransfer = (user: User) => {
    if (!car) return;
    Alert.alert(
      `Transfer to @${user.username}?`,
      `${name} moves to their garage once they accept, with its history. It leaves yours now, and you'll find it under Archived until they answer.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send request',
          onPress: () => run(
            () => transferCar({ internal_id: car.internal_id, user_id: user.user_id }).unwrap(),
            "Couldn't start that transfer. Please try again.",
          ),
        },
      ],
    );
  };

  const options = [
    {
      key: 'archive',
      Icon: Archive,
      title: 'Archive',
      help: 'Remove it from your profile. You can restore it later from your dashboard.',
      onPress: onArchive,
      destructive: false,
    },
    {
      key: 'transfer',
      Icon: ArrowRightLeft,
      title: 'Transfer',
      help: 'Hand the car and its history to another member. They have to accept it.',
      onPress: () => setStep('transfer'),
      destructive: false,
    },
    {
      key: 'delete',
      Icon: Trash2,
      title: 'Fully delete',
      help: 'Erase the car, its galleries, mods, tasks, notes and photos. This cannot be undone.',
      onPress: onDelete,
      destructive: true,
    },
  ].filter((o) => isOwner || o.key === 'archive');

  return (
    <SharedModal
      visible={visible}
      onClose={onClose}
      title={step === 'choose' ? `Remove ${name}` : `Transfer ${name} to`}
      heightRatio={step === 'transfer' ? 0.85 : undefined}
    >
      {step === 'choose' ? (
        <View style={styles.body}>
          {options.map(({ key, Icon, title, help, onPress, destructive }) => (
            <TouchableOpacity
              key={key}
              style={[styles.option, { borderColor: destructive ? colors.red : colors.borderDark }]}
              onPress={onPress}
              disabled={busy}
              activeOpacity={0.75}
            >
              <View style={styles.optionHead}>
                <Icon size={17} color={destructive ? colors.red : colors.fg} />
                <Text style={[styles.optionTitle, { color: destructive ? colors.red : colors.fg }]}>
                  {title}
                </Text>
              </View>
              <Text style={[styles.optionHelp, { color: colors.grey }]}>{help}</Text>
            </TouchableOpacity>
          ))}
          {busy && <ActivityIndicator size="small" color={brand} style={styles.busy} />}
        </View>
      ) : (
        <View style={styles.transferBody}>
          {initialStep === 'choose' && (
            <TouchableOpacity style={styles.back} onPress={() => setStep('choose')} activeOpacity={0.7}>
              <ChevronLeft size={16} color={colors.grey} />
              <Text style={[styles.backText, { color: colors.grey }]}>Back</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.searchBar, { backgroundColor: colors.inputBgDark, borderColor: colors.borderDark }]}>
            <Search size={15} color={colors.grey} />
            <TextInput
              ref={searchRef}
              style={[styles.searchInput, { color: colors.fg }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search members by name or @handle"
              placeholderTextColor={colors.grey}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {isFetching && <ActivityIndicator size="small" color={colors.grey} />}
          </View>

          <FlatList
            data={results?.entries ?? []}
            keyExtractor={(u) => u.user_id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.row, { borderColor: colors.borderDark }]}
                onPress={() => onTransfer(item)}
                disabled={busy}
                activeOpacity={0.75}
              >
                <Avatar user={item} size={36} />
                <View style={styles.rowText}>
                  <Text style={[styles.rowName, { color: colors.fg }]} numberOfLines={1}>
                    @{item.username}
                  </Text>
                  {!!(item.firstName || item.lastName) && (
                    <Text style={[styles.rowSub, { color: colors.grey }]} numberOfLines={1}>
                      {[item.firstName, item.lastName].filter(Boolean).join(' ')}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              debounced.length < 2 ? (
                <EmptyState
                  title="Who's taking it?"
                  message="Search for the member you're transferring this car to."
                />
              ) : isFetching ? null : (
                <EmptyState title="No members found" message={`Nothing matching "${debounced}".`} />
              )
            }
          />
        </View>
      )}
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, paddingBottom: 32, gap: 10 },
  option: { borderWidth: 1, borderRadius: 12, padding: 14 },
  optionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionTitle: { fontSize: 15, fontWeight: '700' },
  optionHelp: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  busy: { marginTop: 6 },

  transferBody: { flex: 1, padding: 16, paddingBottom: 24, gap: 12 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  backText: { fontSize: 13, fontWeight: '600' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  list: { paddingBottom: 32, gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12, padding: 10,
  },
  rowText: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '700' },
  rowSub: { fontSize: 12, marginTop: 1 },
});

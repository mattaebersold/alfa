import { useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { UserPlus, X } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import FormInput from '../ui/FormInput';
import UserByline from '../members/UserByline';
import { useSearchUsersQuery, useGetUserByIdQuery } from '../../api/apiService';
import { useDebounced } from '../../hooks/useDebounced';
import { useColors } from '../../hooks/useColors';
import { useAppSelector } from '../../store/store';
import { COMMON_RADIUS, SURFACE_MID } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import type { User } from '../../types/api';

/** Below this a search matches half the club, so it doesn't run. */
const MIN_QUERY = 2;
/** How many matches the list shows — it sits over the fields above it. */
const MAX_MATCHES = 5;

/**
 * The car form's co-owner: a username field whose matches open in a list
 * above it (where the keyboard can't cover them), or — once someone's
 * picked, or the car already has one — that person, with an X to clear.
 *
 * Holds only the user_id; the person is looked up to show them (`initial`
 * saves the lookup when the car arrives with its co-owner).
 */
export default function CoOwnerField({ value, onChange, initial }: {
  value: string;
  onChange: (userId: string) => void;
  /** The co-owner as the car carries them, when it does. */
  initial?: User | null;
}) {
  const c = useColors();
  const me = useAppSelector((s) => s.auth.userInfo?.user_id);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<User | null>(null);
  const settled = useDebounced(query.trim());

  const known = [picked, initial].find((u) => u?.user_id === value) ?? null;
  const { data: fetched } = useGetUserByIdQuery(value, { skip: !value || !!known });
  const person = known ?? (fetched?.user_id === value ? fetched : null);

  // The member search, ranked (exact username first) — not the app-wide
  // search, whose alphabetical list let "Ae86Matt" crowd out "matt".
  const { data: results, isFetching } = useSearchUsersQuery(settled, { skip: !!value || settled.length < MIN_QUERY });
  const matches: User[] = ((results?.entries ?? []) as User[])
    .filter((u) => u.user_id && u.user_id !== me)
    .slice(0, MAX_MATCHES);
  const open = !value && settled.length >= MIN_QUERY && query.trim().length >= MIN_QUERY;

  const pick = (u: User) => {
    setPicked(u);
    setQuery('');
    onChange(u.user_id);
  };

  if (value) {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.label, { color: c.fg }]}>Co-owner</Text>
        <View style={[styles.chosen, { borderColor: c.borderDark }]}>
          {person ? (
            <UserByline user={person} size={30} gap={10} fill nameStyle={styles.name} />
          ) : (
            <ActivityIndicator color={c.grey} style={styles.fill} />
          )}
          <TouchableOpacity
            onPress={() => onChange('')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Remove co-owner"
          >
            <X size={18} color={c.grey} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    // Over the fields above while the list is open.
    <View style={[styles.wrap, open && styles.raised]}>
      {open ? (
        <View style={[styles.list, { borderColor: c.borderDark }]}>
          {isFetching && !matches.length ? (
            <ActivityIndicator color={c.grey} style={styles.loading} />
          ) : matches.length ? (
            matches.map((u, i) => (
              <UserByline
                key={u.user_id}
                user={u}
                size={30}
                gap={10}
                fill
                nameStyle={styles.name}
                onPress={() => pick(u)}
                style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderDark }]}
                accessibilityLabel={`Make @${u.username} co-owner`}
              />
            ))
          ) : (
            <Text style={[styles.none, { color: c.grey }]}>No members match.</Text>
          )}
        </View>
      ) : null}
      <View>
        <FormInput
          value={query}
          onChangeText={setQuery}
          placeholder="Add a co-owner"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          accessibilityLabel="Add a co-owner"
        />
        <View style={styles.icon} pointerEvents="none">
          <UserPlus size={17} color={c.grey} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  raised: { zIndex: 10, elevation: 10 },
  label: { fontSize: 13, fontFamily: FONT_INTER.bold, marginBottom: 6 },
  fill: { flex: 1 },
  input: { paddingRight: 40 },
  icon: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  // Above the field, its foot just clear of it.
  list: {
    position: 'absolute', left: 0, right: 0, bottom: '100%', marginBottom: 6,
    backgroundColor: SURFACE_MID, borderRadius: COMMON_RADIUS, borderWidth: 1,
    overflow: 'hidden', boxShadow: '0px 6px 24px rgba(0,0,0,0.45)',
  },
  row: { paddingHorizontal: 12, paddingVertical: 9 },
  name: { fontSize: 14, fontFamily: FONT_INTER.semibold },
  loading: { marginVertical: 14 },
  none: { fontSize: 13, paddingHorizontal: 12, paddingVertical: 12 },
  chosen: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: SURFACE_MID, borderRadius: COMMON_RADIUS, borderWidth: 1,
    paddingHorizontal: 12, height: 50,
  },
});

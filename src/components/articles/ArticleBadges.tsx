import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calendar } from 'lucide-react-native';
import {
  useGetPostTagsQuery, useGetUserByIdQuery, useGetCarQuery, useGetEventQuery,
} from '../../api/apiService';
import Avatar from '../ui/Avatar';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * Compact, wrapping badge row for an article: the author first, then anything
 * tagged on it (people, cars, events).
 *
 * Article tags live in the same collection as post tags — the Tag model keys
 * both off `post_id` — so the post-tags query works unchanged here.
 *
 * `onNavigate` exists because this renders inside a modal sheet: pushing a
 * screen while an RN Modal is mounted would put the new screen *behind* it.
 * The host closes the sheet first and runs the thunk once it has dismissed.
 */

interface ArticleBadgesProps {
  articleId: string;
  author?: { user_id?: string; username?: string; profilePicture?: string; gallery?: any[] } | null;
  onNavigate: (go: (nav: Nav) => void) => void;
}

function Pill({
  onPress, thumb, label, accent,
}: {
  onPress: () => void;
  thumb: React.ReactNode;
  label: string;
  accent?: boolean;
}) {
  const c = useColors();
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        {
          backgroundColor: c.inputBg,
          borderColor: accent ? c.primaryAlt : c.inputBorder,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {thumb}
      <Text style={[styles.pillLabel, { color: c.fg }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function CarPill({ id, onNavigate }: { id: string; onNavigate: ArticleBadgesProps['onNavigate'] }) {
  const c = useColors();
  const { data: car } = useGetCarQuery(id, { skip: !id });
  if (!car) return null;

  const img = car.profile_image ? imageUrl(car.profile_image) : firstGalleryUrl(car.gallery);
  const name = car.title
    || [car.year, car.make, car.model].filter(Boolean).join(' ')
    || 'Car';

  return (
    <Pill
      label={name}
      onPress={() => onNavigate((nav) => nav.navigate('CarDetail', { carId: car.internal_id }))}
      thumb={img
        ? <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" />
        : <View style={[styles.thumb, { backgroundColor: c.segment }]} />}
    />
  );
}

function UserPill({ id, onNavigate }: { id: string; onNavigate: ArticleBadgesProps['onNavigate'] }) {
  const { data: user } = useGetUserByIdQuery(id, { skip: !id });
  if (!user) return null;

  return (
    <Pill
      label={`@${user.username}`}
      onPress={() => onNavigate((nav) =>
        nav.navigate('UserDetail', { userId: user.user_id, username: user.username })
      )}
      thumb={
        <Avatar
          user={user}
          size={22}
        />
      }
    />
  );
}

function EventPill({ id, onNavigate }: { id: string; onNavigate: ArticleBadgesProps['onNavigate'] }) {
  const c = useColors();
  const { data: event } = useGetEventQuery(id, { skip: !id });
  if (!event) return null;

  const img = firstGalleryUrl(event.gallery);

  return (
    <Pill
      label={event.title || 'Event'}
      onPress={() => onNavigate((nav) => nav.navigate('EventDetailModal', { eventId: event.internal_id }))}
      thumb={img
        ? <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" />
        : <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: c.segment }]}>
            <Calendar size={12} color={c.grey} />
          </View>}
    />
  );
}

const uniq = (arr: string[]) => Array.from(new Set(arr));

export default function ArticleBadges({ articleId, author, onNavigate }: ArticleBadgesProps) {
  const { data: tags } = useGetPostTagsQuery(articleId, { skip: !articleId });

  const cars: string[] = [];
  const users: string[] = [];
  const events: string[] = [];

  (tags ?? []).forEach((t) => {
    const type = t.tag_entry_type;
    if (type === 'garagecar' || type === 'car') cars.push(t.tag_internal_id);
    else if (type === 'user') users.push(t.tag_internal_id);
    else if (type === 'event') events.push(t.tag_internal_id);
  });

  // The author already has their own badge — don't repeat them as a tag.
  const taggedUsers = uniq(users).filter((id) => id !== author?.user_id);
  const taggedCars = uniq(cars);
  const taggedEvents = uniq(events);

  const hasAny = author?.username
    || taggedUsers.length + taggedCars.length + taggedEvents.length > 0;

  if (!hasAny) return null;

  return (
    <View style={styles.row}>
      {author?.username && (
        <Pill
          accent
          label={`@${author.username}`}
          onPress={() => onNavigate((nav) =>
            nav.navigate('UserDetail', { userId: author.user_id!, username: author.username })
          )}
          thumb={
            <Avatar
              user={author}
              size={22}
            />
          }
        />
      )}

      {taggedCars.map((id) => <CarPill key={`c-${id}`} id={id} onNavigate={onNavigate} />)}
      {taggedUsers.map((id) => <UserPill key={`u-${id}`} id={id} onNavigate={onNavigate} />)}
      {taggedEvents.map((id) => <EventPill key={`e-${id}`} id={id} onNavigate={onNavigate} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 5, paddingLeft: 5, paddingRight: 11,
    borderRadius: 999, borderWidth: 1,
    maxWidth: '100%',
  },
  pillLabel:     { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  thumb:         { width: 22, height: 22, borderRadius: 11 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
});

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Send } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import PostOptionalFields, { type OptionalFieldValues } from '../social/PostOptionalFields';
import PostTagPicker, { TagCardFrame, ROW_PAD, type TagItem } from '../social/PostTagPicker';
import PostLocationField from '../social/PostLocationField';
import PostToSelector from '../social/PostToSelector';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import type { PostPlace } from '../../types/api';

/** The tag sections' rule (PostTagPicker): edge to edge, a little brighter than a border. */
const RULE = 'rgba(255,255,255,0.22)';

/**
 * The lower half of a post's form — Optional Details, the tag sections,
 * Location and Post To — shared by the new-post form and the Edit Post sheet,
 * so the two are laid out the same and filled from the same state shape.
 * Editing, it's hydrated from the post.
 *
 * Tags, Location and Post To are framed alike (TagCardFrame): a title row,
 * the form's 12 gutter, a card row scrolling edge to edge, and a rule between
 * each, edge to edge.
 *
 * `inset` is the side padding of the form this sits in; the sections reach
 * out past it to the screen's edges.
 */
export default function PostFormSections({
  inset = 0,
  optional, onOptionalChange, showOptional = true, showPrice = false,
  users, cars, events, onToggleTag,
  place, onPlaceChange,
  isPublic, onTogglePublic, groups, selectedGroupIds, onToggleGroup,
}: {
  inset?: number;
  optional: OptionalFieldValues;
  onOptionalChange: (patch: Partial<OptionalFieldValues>) => void;
  showOptional?: boolean;
  showPrice?: boolean;
  users: TagItem[];
  cars: TagItem[];
  events: TagItem[];
  onToggleTag: (tag: TagItem) => void;
  place: PostPlace | null;
  onPlaceChange: (place: PostPlace | null) => void;
  isPublic: boolean;
  onTogglePublic: () => void;
  groups: any[];
  selectedGroupIds: string[];
  onToggleGroup: (id: string) => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const bleed = inset ? { marginHorizontal: -inset } : null;

  return (
    <View style={bleed}>
      {/* Optional Details: the main content's width — its own 12 margin,
          topped up to the form's inset where that's wider. */}
      {showOptional && (
        <View style={inset > 12 ? { marginHorizontal: inset - 12 } : null}>
          <PostOptionalFields values={optional} onChange={onOptionalChange} showPrice={showPrice} />
        </View>
      )}

      {/* People, cars and events, ruled above, between and below. */}
      <PostTagPicker users={users} cars={cars} events={events} onToggle={onToggleTag} />

      <PostLocationField value={place} onChange={onPlaceChange} />
      <View style={styles.rule} />

      <TagCardFrame
        title="Post To"
        Icon={Send}
        count={selectedGroupIds.length + (isPublic ? 1 : 0)}
        accent={brand}
      >
        <PostToSelector
          isPublic={isPublic}
          onTogglePublic={onTogglePublic}
          groups={groups}
          selectedGroupIds={selectedGroupIds}
          onToggleGroup={onToggleGroup}
          bleed={ROW_PAD}
        />
        {groups.length === 0 && (
          <Text style={[styles.empty, { color: colors.grey }]}>You're not a member of any groups yet.</Text>
        )}
      </TagCardFrame>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  // As PostTagPicker's: 12 above, and the next section pulled 10 closer.
  rule:  { height: 1, marginTop: 12, marginBottom: -10, backgroundColor: RULE },
  empty: { paddingTop: 12, fontSize: 13 },
});

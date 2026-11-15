import React, { useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../../theme/Text';
import SolidMapPin from './SolidMapPin';
import { FILTER_HIT_SLOP, FILTER_CHIP_HEIGHT as CHIP_H, FilterDivider } from '../../filters/FilterSummaryRow';
import { useColors, useBrandColor } from '../../theme/useColors';
import { REGIONS } from '../../constants/regions';
import { US_STATES, stateCode, stateName } from '../../filters/states';
import {
  type LocationChoice, isNear, nearRadius, nearChoice, choiceState, stateChoice,
  NEAR_ME_MILES, NEAR_MIN_MILES, NEAR_MAX_MILES,
} from '../../hooks/useLocationFilter';
import AutocompleteField from '../AutocompleteField';
import RadiusSlider from './RadiusSlider';
import type { FilterPill } from '../../filters/FilterSummaryRow';
import { PILL_RADIUS } from '../../theme/radius';

/** Black on a filled chip. */
const COLOR_BLACK = '#000000';
import { FONT_INTER } from '../../theme/fonts';

/**
 * Where to look: near me, everywhere, or one state.
 *
 * The same row on events, members and cars, because it's the same question
 * each time and answering it differently per screen is how three filters end
 * up looking like three features. Near me leads and is the default — the
 * society is a driving club, and what's reachable this weekend is the first
 * thing anyone wants.
 *
 * Near me reaches NEAR_ME_MILES by default; picking it shows a slider to
 * reach nearer or further, carried in the choice itself (see isNear).
 *
 * Near me and All are 36pt chips with a 44pt target. A state is typed: fifty
 * of them (and DC) won't sit as chips, and the member knows which one they
 * want. The suggestions open *above* the field (AutocompleteField's way),
 * because below it is the keyboard. Typing a code or a full name and leaving
 * the field picks it as a tap on the suggestion would; clearing the field
 * goes back to All.
 *
 * This replaced a row of region chips. Regions still exist — the profile's map
 * tile, and a link from it still lands on a region — and one arriving that way
 * shows as a chip above the field so it can be seen and cleared.
 */
export default function LocationFilterRow({
  choice,
  onChoose,
  states,
  note,
  allLabel = 'All',
  AllIcon,
}: {
  choice: LocationChoice;
  onChoose: (next: LocationChoice) => void;
  /**
   * The state codes worth offering, when the screen knows — events offer only
   * the ones with something coming up. Otherwise every state is.
   */
  states?: string[];
  /** Shown under the row — why near me couldn't be answered, typically. */
  note?: string | null;
  /**
   * What "All" is all of, on a screen that wants to say — "All members" — and
   * an icon to go with it. Plain "All" otherwise.
   */
  allLabel?: string;
  AllIcon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}) {
  const colors = useColors();
  const brand = useBrandColor();

  const offered = useMemo(
    () => (states ? US_STATES.filter((s) => states.includes(s.code)) : US_STATES).map((s) => s.name),
    [states],
  );
  /** A region choice that arrived from a link — shown so it can be undone. */
  const region = REGIONS.find((r) => r.key === choice) ?? null;

  // What's in the field: the chosen state's name, or what's being typed.
  const chosen = choiceState(choice);
  const [typed, setTyped] = useState(() => stateName(chosen) ?? '');
  useEffect(() => {
    // Near me or All chosen above (or the draft reset) empties the field; a
    // state chosen elsewhere fills it. What's mid-typing is left alone.
    if (!chosen) setTyped('');
    else if (stateCode(typed) !== chosen) setTyped(stateName(chosen) ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);

  const onType = (text: string) => {
    setTyped(text);
    const code = stateCode(text);
    if (code) onChoose(stateChoice(code));
    else if (!text.trim() && chosen) onChoose('all');
  };

  /** One option as a chip — near me, all, or a region. */
  const chip = (opt: { key: string; label: string }) => {
    const active = opt.key === 'near' ? isNear(choice) : choice === opt.key;
    return (
      <TouchableOpacity
        key={opt.key}
        style={[
          styles.chip,
          { borderColor: colors.border },
          active && { backgroundColor: brand, borderColor: brand },
        ]}
        // Near me again keeps the distance already set on it.
        onPress={() => onChoose(opt.key === 'near' && isNear(choice) ? choice : opt.key)}
        hitSlop={FILTER_HIT_SLOP}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        {/* Solid, not outlined — near me's pin, as on the applied pill. */}
        {opt.key === 'near' && <SolidMapPin size={16} color={active ? COLOR_BLACK : colors.fg} />}
        {opt.key === 'all' && AllIcon ? <AllIcon size={16} color={active ? COLOR_BLACK : colors.fg} strokeWidth={2.4} /> : null}
        <Text style={[styles.chipText, { color: active ? COLOR_BLACK : colors.fg }]}>
          {opt.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <>
      {/* Near me and All first — the two answers that aren't a place — near
          me on the left with its distance right under it while chosen, All
          across on the right. */}
      <View style={[styles.row, styles.topRow]}>
        {chip({ key: 'near', label: 'Near me' })}
        {chip({ key: 'all', label: allLabel })}
      </View>

      {isNear(choice) ? (
        <View style={styles.slider}>
          <RadiusSlider
            value={nearRadius(choice)}
            min={NEAR_MIN_MILES}
            max={NEAR_MAX_MILES}
            onChange={(miles) => onChoose(nearChoice(miles))}
          />
        </View>
      ) : null}

      {/* Then the state, ruled off above and below — set apart from near me
          and All, and from whatever the panel has next (its Apply, or the
          screen's own sections). */}
      <FilterDivider />
      {region ? <View style={styles.row}>{chip({ key: region.key, label: region.label })}</View> : null}
      <AutocompleteField
        style={styles.state}
        value={typed}
        onChangeText={onType}
        onSelect={onType}
        // Back to the chosen state's name if what's left typed isn't one.
        onBlur={() => { if (!stateCode(typed)) setTyped(stateName(chosen) ?? ''); }}
        suggestions={offered}
        placeholder={states && !states.length ? 'Nothing coming up in any state' : 'Search a state'}
        editable={!states || states.length > 0}
      />
      <FilterDivider last />

      {note ? <Text style={[styles.note, { color: colors.grey }]}>{note}</Text> : null}
    </>
  );
}

/**
 * The applied location as a filter row's pill — "Near me", "All
 * locations", the state's name, or a region's (from a link).
 *
 * Here rather than on each screen so the row reads the same on events, members
 * and cars, which is the point of them sharing this row in the first place.
 */
export function locationPill(choice: LocationChoice): FilterPill {
  const label =
    isNear(choice)
      ? (nearRadius(choice) === NEAR_ME_MILES ? 'Near me' : `Within ${nearRadius(choice)} mi`)
    : choice === 'all' ? 'All locations'
    : stateName(choiceState(choice))
      ?? REGIONS.find((r) => r.key === choice)?.label
      ?? choice;
  return {
    key: 'location',
    label,
    icon: isNear(choice) ? <SolidMapPin size={15} color={COLOR_BLACK} /> : undefined,
  };
}

/** What to say when near me has nothing to measure from — no location, no zip. */
export const NO_ZIP_NOTE =
  "Near me uses your phone's location, or the zip on your profile when location is off — and neither is available, so this is everything. Turn on location for the app, or add a zip in Settings.";

const styles = StyleSheet.create({
  // Wraps rather than scrolls — every region in view at once, none of them a
  // sideways swipe away.
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, marginBottom: 12 },
  // Shorter than the 44pt a thumb needs; the hit slop makes up the rest.
  chip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: CHIP_H, paddingHorizontal: 16, borderRadius: PILL_RADIUS, borderWidth: 1,
  },
  chipText: { fontSize: 14, fontFamily: FONT_INTER.bold },

  // No eyebrow above any more, so the first row takes its place.
  topRow: { justifyContent: 'space-between' },
  slider: { paddingHorizontal: 12, marginTop: -2, marginBottom: 18 },
  state: { paddingHorizontal: 12, marginBottom: 12 },
  // A full point rather than a hairline, so it reads as a rule on the dark panel.

  note: { fontSize: 12, lineHeight: 17, paddingHorizontal: 12, marginTop: -2, marginBottom: 10 },
});

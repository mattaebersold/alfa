import { StyleSheet } from 'react-native';
import { COLOR_BLACK, FORM_RADIUS } from '../../constants/config';

/**
 * The look every suggestion list in the app shares — components/
 * AutocompleteField draws the same: black, flush against its field, and
 * squared off where the two meet, so the list reads as the field opening up
 * (or down) rather than a separate box floating near it.
 *
 * The list takes the field's edge colour inline (`colors.inputBorder`); the
 * field's own border is the seam between them.
 */
export const attachedList = StyleSheet.create({
  /** A list sitting on the field's top edge. */
  listAbove: {
    borderWidth: 1, borderBottomWidth: 0,
    borderTopLeftRadius: FORM_RADIUS, borderTopRightRadius: FORM_RADIUS,
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
    overflow: 'hidden', backgroundColor: COLOR_BLACK,
  },
  /** A list hanging off the field's bottom edge. */
  listBelow: {
    borderWidth: 1, borderTopWidth: 0,
    borderBottomLeftRadius: FORM_RADIUS, borderBottomRightRadius: FORM_RADIUS,
    borderTopLeftRadius: 0, borderTopRightRadius: 0,
    overflow: 'hidden', backgroundColor: COLOR_BLACK,
  },
  /** The field while a list sits on top of it. */
  fieldOpenAbove: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  /** The field while a list hangs below it. */
  fieldOpenBelow: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
});

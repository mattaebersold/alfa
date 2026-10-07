import React from 'react';
import Svg, { Path } from 'react-native-svg';

/**
 * Lucide's map pin, filled, with its dot cut out rather than drawn.
 *
 * Lucide's own pin with a `fill` fills the dot too and reads as a blob; here
 * the outline and the dot are one path under the even-odd rule, so the dot is
 * a hole — whatever the pin sits on shows through it, on any fill.
 *
 * Cropped to the pin's own width (x 3–21 of lucide's 24) so the icon's box
 * doesn't add a gap of its own beside the words.
 */
export default function SolidMapPin({ size = 14, color }: { size?: number; color: string }) {
  return (
    <Svg width={size * 0.75} height={size} viewBox="3 0 18 24">
      <Path
        fill={color}
        fillRule="evenodd"
        d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0z M12 6.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z"
      />
    </Svg>
  );
}

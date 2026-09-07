import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

/**
 * The two brand marks the app links out to.
 *
 * Drawn here rather than imported: lucide dropped its brand icons, so neither
 * Instagram nor Discord exists in the icon set the rest of the app uses, and
 * they were standing in as a generic link and a speech bubble — two glyphs that
 * say "a link" and "a chat" rather than naming the place they go.
 *
 * Both take a `size` and a `color` so they drop into the same slots a lucide
 * icon does.
 */

interface IconProps {
  size?: number;
  color?: string;
}

/**
 * Instagram's mark, built from primitives rather than a traced path.
 *
 * It genuinely is a rounded square, a circle and a dot, so the shapes are the
 * artwork rather than an approximation of it — and unlike a path string, each
 * number here is something you can reason about.
 */
export function InstagramIcon({ size = 20, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="2" y="2" width="20" height="20" rx="5.5"
        stroke={color} strokeWidth="2"
      />
      <Circle cx="12" cy="12" r="4.2" stroke={color} strokeWidth="2" />
      <Circle cx="17.4" cy="6.6" r="1.3" fill={color} />
    </Svg>
  );
}

/**
 * Discord's mark.
 *
 * A filled glyph, not an outline — that's what the mark is, and stroking it
 * would produce something that reads as a different logo. It sits beside the
 * outlined Instagram for that reason rather than by oversight.
 */
export function DiscordIcon({ size = 20, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"
      />
    </Svg>
  );
}

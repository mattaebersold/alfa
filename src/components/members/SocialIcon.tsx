import React from 'react';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import { Globe } from 'lucide-react-native';
import type { SocialKey } from '../../utils/socials';

/**
 * Brand glyphs in lucide's stroke style. Lucide 1.x dropped its brand icons,
 * so these are drawn here to sit alongside the rest of the icon set.
 */
export default function SocialIcon({ network, size = 18, color }: { network: SocialKey; size?: number; color: string }) {
  if (network === 'website') return <Globe size={size} color={color} />;

  const stroke = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {network === 'facebook' && (
        <Path {...stroke} d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      )}
      {network === 'instagram' && (
        <>
          <Rect {...stroke} x={2} y={2} width={20} height={20} rx={5} ry={5} />
          <Path {...stroke} d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <Line {...stroke} x1={17.5} y1={6.5} x2={17.51} y2={6.5} />
        </>
      )}
      {network === 'youtube' && (
        <>
          <Path {...stroke} d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
          <Path {...stroke} d="m10 15 5-3-5-3z" />
        </>
      )}
    </Svg>
  );
}

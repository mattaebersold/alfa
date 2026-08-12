import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * A small pie showing how much of a to-do list is done.
 *
 * The wedge sweeps clockwise from twelve o'clock, so 5 of 20 complete reads as a
 * quarter filled. The ring is always drawn — an empty list still shows a circle
 * rather than vanishing, which keeps the button's layout stable.
 */

interface Props {
  /** Completed items. */
  completed: number;
  /** Completed plus outstanding. Zero renders an empty ring. */
  total: number;
  size?: number;
  /** Colour of the filled wedge and the ring. */
  color: string;
}

export default function TaskProgressPie({ completed, total, size = 16, color }: Props) {
  const fraction = total > 0 ? Math.min(1, Math.max(0, completed / total)) : 0;

  const c = size / 2;
  // Inset by the ring's stroke so the outline isn't clipped by the viewBox.
  const stroke = 1.25;
  const r = c - stroke / 2;

  // A wedge of exactly 360° has its start and end points in the same place, so
  // the arc collapses to nothing. A full circle is the same shape, drawn safely.
  const isFull = fraction >= 0.999;
  const angle = fraction * 2 * Math.PI;
  const endX = c + r * Math.sin(angle);
  const endY = c - r * Math.cos(angle);
  const largeArc = fraction > 0.5 ? 1 : 0;
  const wedge = `M ${c} ${c} L ${c} ${c - r} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={c} cy={c} r={r} stroke={color} strokeWidth={stroke} fill="none" opacity={0.55} />
      {isFull ? (
        <Circle cx={c} cy={c} r={r} fill={color} />
      ) : fraction > 0 ? (
        <Path d={wedge} fill={color} />
      ) : null}
    </Svg>
  );
}

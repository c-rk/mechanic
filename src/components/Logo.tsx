import { useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/** The Bay One mark: a garage-bay arch with a "1" inside. Same geometry as assets/brand/make-logo.js. */
export function Logo({ size = 32, tile = true }: { size?: number; tile?: boolean }) {
  // Gradient ids must be unique per instance: on the web all SVGs share one document.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const tileId = `bo-tile-${uid}`;
  const markId = `bo-mark-${uid}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Defs>
        <LinearGradient id={tileId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#20242C" />
          <Stop offset="1" stopColor="#0B0C0F" />
        </LinearGradient>
        <LinearGradient id={markId} x1="0.15" y1="0" x2="0.85" y2="1">
          <Stop offset="0" stopColor="#9DBBFF" />
          <Stop offset="0.55" stopColor="#7EA6FF" />
          <Stop offset="1" stopColor="#B49DFF" />
        </LinearGradient>
      </Defs>
      {tile ? (
        <>
          <Rect width={1024} height={1024} rx={240} fill={`url(#${tileId})`} />
          <Rect x={8} y={8} width={1008} height={1008} rx={232} fill="none" stroke="#FFFFFF" strokeOpacity={0.1} strokeWidth={16} />
        </>
      ) : null}
      <Path
        d="M 262 770 V 500 A 250 250 0 0 1 762 500 V 770"
        transform={tile ? 'translate(512 512) scale(0.86) translate(-512 -512)' : undefined}
        fill="none"
        stroke={`url(#${markId})`}
        strokeWidth={88}
        strokeLinecap="round"
      />
      <Path
        d="M 432 470 L 524 404 V 700"
        transform={tile ? 'translate(512 512) scale(0.86) translate(-512 -512)' : undefined}
        fill="none"
        stroke="#F4F6FA"
        strokeWidth={84}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M 352 778 H 672"
        transform={tile ? 'translate(512 512) scale(0.86) translate(-512 -512)' : undefined}
        fill="none"
        stroke="#8EA9FF"
        strokeOpacity={0.5}
        strokeWidth={36}
        strokeLinecap="round"
      />
    </Svg>
  );
}

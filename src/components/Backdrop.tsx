import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Line, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import { C } from '../lib/theme';

/**
 * Workshop backdrop behind the glass panels: graphite base, a faint drafting grid and two pools
 * of sodium-lamp light. Glass needs something under it to read as glass.
 */
export function Backdrop() {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="grid" width={28} height={28} patternUnits="userSpaceOnUse">
            <Line x1={0} y1={0} x2={28} y2={0} stroke="#ffffff" strokeOpacity={0.035} strokeWidth={1} />
            <Line x1={0} y1={0} x2={0} y2={28} stroke="#ffffff" strokeOpacity={0.035} strokeWidth={1} />
          </Pattern>
          <RadialGradient id="lampA" cx="85%" cy="0%" r="75%">
            <Stop offset="0" stopColor={C.accent} stopOpacity={0.22} />
            <Stop offset="1" stopColor={C.accent} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="lampB" cx="0%" cy="70%" r="70%">
            <Stop offset="0" stopColor={C.steel} stopOpacity={0.12} />
            <Stop offset="1" stopColor={C.steel} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#lampB)" />
        <Rect width="100%" height="100%" fill="url(#lampA)" />
        <Rect width="100%" height="100%" fill="url(#grid)" />
      </Svg>
    </View>
  );
}

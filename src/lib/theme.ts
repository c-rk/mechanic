/**
 * Industrial glass: graphite and steel under frosted panels, sodium-amber as the single accent,
 * DIN-style condensed figures and monospaced spec-plate labels.
 */
export const C = {
  bg: '#08090B',
  surface: '#111316',
  surface2: '#181A1E',
  surface3: '#23262B',
  /** Frosted panel fill over the backdrop. */
  glass: 'rgba(22,24,28,0.58)',
  glassStrong: 'rgba(16,18,21,0.86)',
  glassEdge: 'rgba(255,255,255,0.10)',
  highlight: 'rgba(255,255,255,0.22)',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  text: '#F2F1EE',
  dim: '#A3A39E',
  faint: '#63645F',
  accent: '#F2A93B',
  accentStrong: '#D98E1F',
  accentSoft: 'rgba(242,169,59,0.14)',
  onAccent: '#16120A',
  steel: '#8FA3B8',
  green: '#4FD69C',
  yellow: '#FFD45C',
  red: '#FF5D4F',
  redSoft: 'rgba(255,93,79,0.14)',
};

export const F = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  /** Condensed DIN-style face for titles and figures. */
  display: 'BarlowSemiCondensed_600SemiBold',
  displayBold: 'BarlowSemiCondensed_700Bold',
  displayMedium: 'BarlowSemiCondensed_500Medium',
  /** Spec-plate labels and codes. */
  mono: 'IBMPlexMono_500Medium',
  monoRegular: 'IBMPlexMono_400Regular',
};

/** Spread into any Text style that shows figures, so digits do not shift width. */
export const NUM = { fontVariant: ['tabular-nums' as const] };

export const STATE_COLOR = { overdue: C.red, soon: C.yellow, ok: C.green, unknown: C.faint } as const;

export const PAINTS = [
  '#c8ccd1',
  '#f4f4f2',
  '#1b1d20',
  '#6d737b',
  '#b3121d',
  '#0d3f9c',
  '#0f5c3a',
  '#e0a400',
  '#e2571c',
  '#5a1e6e',
];

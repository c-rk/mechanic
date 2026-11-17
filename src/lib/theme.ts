/**
 * Neutral graphite under frosted glass. White is the primary action colour, a soft blue marks
 * selection, and each area of the app has its own muted colour so it can be recognised at a glance.
 */
export const C = {
  bg: '#0B0C0F',
  surface: '#121418',
  surface2: '#191B20',
  surface3: '#23262D',
  /** Frosted panel fill over the backdrop. */
  glass: 'rgba(24,26,31,0.6)',
  glassStrong: 'rgba(17,19,23,0.9)',
  glassEdge: 'rgba(255,255,255,0.09)',
  highlight: 'rgba(255,255,255,0.18)',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.14)',
  text: '#ECEEF2',
  dim: '#9BA2AE',
  faint: '#5E6471',
  /** Primary buttons and selected chips. */
  primary: '#ECEEF2',
  onPrimary: '#0B0C0F',
  /** Selection, links, informational highlights. */
  accent: '#7EA6FF',
  accentStrong: '#5C8BF5',
  accentSoft: 'rgba(126,166,255,0.14)',
  onAccent: '#0B0C0F',
  steel: '#9FB0C8',
  green: '#4CD9A0',
  yellow: '#F4A574',
  red: '#F2706D',
  redSoft: 'rgba(242,112,109,0.14)',
};

/** One colour per area of the app, used for icons, section marks and badges. */
export const AREA = {
  fuel: '#45C9B6',
  odometer: '#7EA6FF',
  service: '#B49DFF',
  drive: '#F291B2',
  parts: '#E3A982',
  docs: '#A9B6C9',
  specs: '#8FA0F6',
  research: '#D9A6F5',
  mechanic: '#6FD0E8',
} as const;

export const F = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  /** Titles and large figures. */
  display: 'Geist_600SemiBold',
  displayBold: 'Geist_700Bold',
  displayMedium: 'Geist_500Medium',
  /** Small labels, codes and units. */
  mono: 'GeistMono_500Medium',
  monoRegular: 'GeistMono_400Regular',
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

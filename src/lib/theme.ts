/** Dark, low-contrast surfaces with a single accent; numbers set in tabular figures. */
export const C = {
  bg: '#0A0B0D',
  surface: '#121418',
  surface2: '#191C21',
  surface3: '#22262C',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.14)',
  text: '#F3F4F6',
  dim: '#9CA3AD',
  faint: '#5E656F',
  accent: '#7B93FF',
  accentStrong: '#5A76F5',
  accentSoft: 'rgba(123,147,255,0.14)',
  onAccent: '#FFFFFF',
  green: '#3DD68C',
  yellow: '#F5B941',
  red: '#FF6161',
  redSoft: 'rgba(255,97,97,0.12)',
};

export const F = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
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

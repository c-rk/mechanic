import { Platform } from 'react-native';

/** Early-2000s instrument-panel palette: gunmetal, brushed chrome, amber LCD, gel blue. */
export const C = {
  bg0: '#0b0e12',
  bg1: '#161b22',
  panelTop: '#2b333e',
  panelBottom: '#1a2028',
  chromeTop: '#59677a',
  chromeBottom: '#2a323d',
  edgeLight: '#6b7a8e',
  edgeDark: '#07090c',
  line: '#364150',
  text: '#eef2f6',
  dim: '#93a1b3',
  faint: '#5d6a7a',
  blue: '#3a9bff',
  blueDeep: '#0f4fb0',
  amber: '#ffb629',
  lcdBg: '#120d02',
  green: '#5fe08a',
  red: '#ff5a4d',
  yellow: '#ffd24a',
  inputBg: '#0c1015',
};

export const F = {
  display: 'Michroma_400Regular',
  mono: 'B612_400Regular',
  monoBold: 'B612_700Bold',
  body: Platform.select({ web: 'Tahoma, Verdana, "Lucida Grande", sans-serif', default: undefined }) as
    | string
    | undefined,
};

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

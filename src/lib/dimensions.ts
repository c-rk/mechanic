import { mergeSheets, sheetFromVin } from './specFill';
import type { Vehicle } from './types';

/** Real exterior dimensions in metres, each present only when the spec sheet has a plausible value. */
export interface Dims {
  length?: number;
  width?: number;
  height?: number;
  wheelbase?: number;
  /** Tyre outer radius. */
  wheelR?: number;
  clearance?: number;
}

/** First length in a spec string, in metres: "4,630 mm", "182.3 in", "1.45 m", "64″". */
export function parseLength(text?: string): number | null {
  if (!text) return null;
  const m = /([\d][\d,]*(?:\.\d+)?)\s*(mm|cm|m\b|in\b|inch|″|"|ft)/i.exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const unit = m[2].toLowerCase();
  if (unit === 'mm') return n / 1000;
  if (unit === 'cm') return n / 100;
  if (unit === 'm') return n;
  if (unit === 'ft') return n * 0.3048;
  return n * 0.0254;
}

/** Tyre outer radius in metres from "215/55 R16", "P245/70R17" or "31x10.50R15". */
export function tyreRadius(text?: string): number | null {
  if (!text) return null;
  const metric = /(\d{3})\s*\/\s*(\d{2})\s*[A-Z]{0,2}\s*R?\s*(\d{2}(?:\.\d)?)/i.exec(text);
  if (metric) {
    const [w, aspect, rim] = metric.slice(1).map(Number);
    return (rim * 25.4 + 2 * w * (aspect / 100)) / 2000;
  }
  const flotation = /(\d{2}(?:\.\d+)?)\s*x\s*\d{1,2}(?:\.\d+)?\s*R?\s*\d{2}/i.exec(text);
  return flotation ? (Number(flotation[1]) * 0.0254) / 2 : null;
}

const within = (v: number | null, lo: number, hi: number) => (v !== null && v >= lo && v <= hi ? v : undefined);

export function vehicleDims(v: Pick<Vehicle, 'specs' | 'specSheet'>): Dims {
  const s = mergeSheets(sheetFromVin(v.specs ?? {}, true), v.specSheet);
  const rimText = s.rimFront?.value;
  const bare = /^\s*(\d{2})\b/.exec(rimText ?? '');
  const rim = parseLength(rimText) ?? (bare && +bare[1] >= 12 && +bare[1] <= 24 ? +bare[1] * 0.0254 : null);
  return {
    length: within(parseLength(s.length?.value), 2.4, 7.5),
    width: within(parseLength(s.width?.value), 1.3, 2.7),
    height: within(parseLength(s.height?.value), 0.9, 3.2),
    wheelbase: within(parseLength(s.wheelbase?.value), 1.7, 4.8),
    // Tyre size gives the outer radius directly; a bare rim size gets a typical 110 mm sidewall.
    wheelR: within(tyreRadius(s.tyresFront?.value) ?? (rim !== null ? rim / 2 + 0.11 : null), 0.22, 0.6),
    clearance: within(parseLength(s.groundClearance?.value), 0.08, 0.45),
  };
}

export const dimsKey = (d?: Dims) => (d ? JSON.stringify(d) : '');

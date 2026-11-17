import type { BodyType } from './types';

export type P = [number, number];

export type CarBody = Exclude<BodyType, 'motorcycle'>;


export interface BodySpec {
  length: number;
  width: number;
  wheelR: number;
  axle: number;
  clearance: number;
  /** Upper outline of the lower body, rear bumper to front bumper (x forward, y up, metres). */
  top: P[];
  /** Greenhouse outline, rear base to front base. */
  cabin: P[];
}

export const SPECS: Record<CarBody, BodySpec> = {
  sedan: {
    length: 4.6, width: 1.8, wheelR: 0.33, axle: 1.36, clearance: 0.2,
    top: [[-2.3, 0.56], [-2.24, 0.9], [-1.35, 0.97], [0.9, 0.94], [2.0, 0.78], [2.3, 0.56]],
    cabin: [[-1.55, 0.95], [-0.85, 1.4], [0.2, 1.43], [1.0, 0.93]],
  },
  coupe: {
    length: 4.4, width: 1.82, wheelR: 0.34, axle: 1.3, clearance: 0.16,
    top: [[-2.2, 0.52], [-2.14, 0.86], [-1.3, 0.9], [0.75, 0.88], [1.95, 0.7], [2.2, 0.5]],
    cabin: [[-1.6, 0.88], [-0.5, 1.26], [0.15, 1.27], [0.9, 0.86]],
  },
  hatchback: {
    length: 4.1, width: 1.76, wheelR: 0.32, axle: 1.28, clearance: 0.19,
    top: [[-2.05, 0.56], [-2.02, 0.95], [0.75, 0.93], [1.75, 0.78], [2.05, 0.56]],
    cabin: [[-2.0, 0.94], [-1.62, 1.44], [0.1, 1.47], [0.9, 0.92]],
  },
  suv: {
    length: 4.7, width: 1.9, wheelR: 0.38, axle: 1.42, clearance: 0.28,
    top: [[-2.35, 0.68], [-2.32, 1.1], [0.95, 1.08], [2.1, 0.97], [2.35, 0.7]],
    cabin: [[-2.28, 1.09], [-2.0, 1.7], [0.2, 1.73], [1.05, 1.07]],
  },
  pickup: {
    length: 5.4, width: 1.95, wheelR: 0.4, axle: 1.75, clearance: 0.3,
    top: [[-2.7, 0.72], [-2.7, 1.16], [-0.55, 1.16], [1.2, 1.1], [2.45, 1.0], [2.7, 0.74]],
    cabin: [[-0.55, 1.15], [-0.45, 1.78], [0.6, 1.8], [1.28, 1.09]],
  },
  van: {
    length: 5.0, width: 1.95, wheelR: 0.36, axle: 1.6, clearance: 0.24,
    top: [[-2.5, 0.6], [-2.5, 1.1], [1.6, 1.05], [2.35, 0.9], [2.5, 0.6]],
    cabin: [[-2.48, 1.09], [-2.42, 1.93], [1.2, 1.95], [1.95, 1.04]],
  },
};


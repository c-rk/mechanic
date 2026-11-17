import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { METERS_PER } from './odometer';
import { uid, useStore } from './store';

/**
 * GPS distance recorder. On iOS/Android with "Always" permission the distance is accumulated by a
 * background location task (keeps counting with the screen off); otherwise by a foreground watch.
 * Both feed the same accumulator, persisted so a trip survives the app being suspended.
 */

export const TRIP_TASK = 'bay-one-trip';
const KEY = 'bayone.trip';

interface Fix {
  lat: number;
  lon: number;
  acc: number;
  t: number;
}

export interface TripState {
  vehicleId: string;
  startedAt: string;
  meters: number;
  last?: Fix;
  background: boolean;
  /** Last measured speed in m/s, for display. */
  speed?: number;
}

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;
export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Adds one fix. Rejects poor fixes (accuracy > 35 m), jitter smaller than the combined accuracy,
 * and jumps implying more than 75 m/s.
 */
export function accumulate(s: TripState, loc: Location.LocationObject): TripState {
  const acc = loc.coords.accuracy ?? 999;
  if (acc > 35) return s;
  const fix: Fix = { lat: loc.coords.latitude, lon: loc.coords.longitude, acc, t: loc.timestamp };
  if (!s.last) return { ...s, last: fix };
  const d = haversine(s.last, fix);
  const dt = Math.max(0.001, (fix.t - s.last.t) / 1000);
  if (d < Math.max(8, (acc + s.last.acc) / 2)) return { ...s, speed: loc.coords.speed ?? s.speed };
  if (d / dt > 75) return { ...s, last: fix };
  return { ...s, meters: s.meters + d, last: fix, speed: loc.coords.speed ?? d / dt };
}

const read = async (): Promise<TripState | null> => {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as TripState) : null;
};
const write = (s: TripState | null) => (s ? AsyncStorage.setItem(KEY, JSON.stringify(s)) : AsyncStorage.removeItem(KEY));

if (Platform.OS !== 'web') {
  // Must be defined at module scope so the OS can run it while no screen is mounted.
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TRIP_TASK, async ({ data, error }) => {
    if (error || !data) return;
    let s = await read();
    if (!s) return;
    for (const loc of data.locations) s = accumulate(s, loc);
    await write(s);
    useTrip.setState({ trip: s });
  });
}

interface TripStore {
  trip: TripState | null;
  error: string;
}

export const useTrip = create<TripStore>(() => ({ trip: null, error: '' }));

let watcher: Location.LocationSubscription | null = null;
let poll: ReturnType<typeof setInterval> | null = null;

export async function startTrip(vehicleId: string): Promise<void> {
  useTrip.setState({ error: '' });
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    useTrip.setState({ error: 'Location permission was not granted.' });
    return;
  }
  let background = false;
  if (Platform.OS !== 'web' && (await TaskManager.isAvailableAsync())) {
    const bg = await Location.requestBackgroundPermissionsAsync().catch(() => ({ status: 'denied' }));
    background = bg.status === 'granted';
  }
  const trip: TripState = { vehicleId, startedAt: new Date().toISOString(), meters: 0, background };
  await write(trip);
  useTrip.setState({ trip });

  if (background) {
    await Location.startLocationUpdatesAsync(TRIP_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 10,
      timeInterval: 2000,
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Bay One is recording a drive',
        notificationBody: 'Distance is added to the odometer when you stop.',
        killServiceOnDestroy: false,
      },
    });
    poll = setInterval(() => read().then((s) => s && useTrip.setState({ trip: s })), 2000);
  } else {
    watcher = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 1000 },
      (loc) => {
        const s = useTrip.getState().trip;
        if (!s) return;
        const next = accumulate(s, loc);
        useTrip.setState({ trip: next });
        write(next).catch(() => undefined);
      },
      (reason) => useTrip.setState({ error: reason }),
    );
  }
}

/** Ends the trip and adds the distance to the vehicle. Returns the distance in the user's unit. */
export async function stopTrip(): Promise<number> {
  watcher?.remove();
  watcher = null;
  if (poll) clearInterval(poll);
  poll = null;
  if (Platform.OS !== 'web' && (await Location.hasStartedLocationUpdatesAsync(TRIP_TASK).catch(() => false))) {
    await Location.stopLocationUpdatesAsync(TRIP_TASK);
  }
  const s = (await read()) ?? useTrip.getState().trip;
  await write(null);
  useTrip.setState({ trip: null });
  return s ? commit(s) : 0;
}

function commit(s: TripState): number {
  const store = useStore.getState();
  const v = store.vehicles.find((x) => x.id === s.vehicleId);
  if (!v || s.meters < 50) return 0;
  const added = s.meters / METERS_PER[store.settings.distanceUnit];
  const end = new Date().toISOString();
  store.upsert('trips', { id: uid(), vehicleId: v.id, start: s.startedAt, end, meters: Math.round(s.meters) });
  store.logOdometer(v.id, Math.round((v.odometer + added) * 10) / 10, 'gps', end);
  return added;
}

/**
 * On launch: resume showing a trip that is still recording in the background, or commit one whose
 * recording ended without the app (for example after a restart).
 */
export async function mergeBackgroundTrip(): Promise<void> {
  const s = await read();
  if (!s) return;
  const running =
    Platform.OS !== 'web' && s.background && (await Location.hasStartedLocationUpdatesAsync(TRIP_TASK).catch(() => false));
  if (running) {
    useTrip.setState({ trip: s });
    poll = setInterval(() => read().then((x) => x && useTrip.setState({ trip: x })), 2000);
  } else {
    // A foreground trip cannot continue after the app was closed; keep what was measured.
    await write(null);
    commit(s);
  }
}

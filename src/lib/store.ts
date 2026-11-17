import AsyncStorage from '@react-native-async-storage/async-storage';
import { del, get, set } from 'idb-keyval';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';

import { defaultMaintenance } from './defaults';
import type {
  ChatMessage,
  Doc,
  FuelEntry,
  MaintenanceItem,
  Part,
  Recall,
  SavedLink,
  ServiceRecord,
  Settings,
  Vehicle,
} from './types';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const today = () => new Date().toISOString().slice(0, 10);

/** IndexedDB on web (large quota), AsyncStorage on iOS/Android. All on-device. */
const deviceStorage: StateStorage =
  Platform.OS === 'web'
    ? {
        getItem: async (k) => (typeof indexedDB === 'undefined' ? null : ((await get<string>(k)) ?? null)),
        setItem: async (k, v) => {
          if (typeof indexedDB !== 'undefined') await set(k, v);
        },
        removeItem: async (k) => {
          if (typeof indexedDB !== 'undefined') await del(k);
        },
      }
    : AsyncStorage;

export interface Data {
  vehicles: Vehicle[];
  fuel: FuelEntry[];
  maintenance: MaintenanceItem[];
  services: ServiceRecord[];
  parts: Part[];
  docs: Doc[];
  links: SavedLink[];
  chat: ChatMessage[];
  recalls: Record<string, { fetchedAt: string; items: Recall[] }>;
  settings: Settings;
}

type Collection = 'fuel' | 'maintenance' | 'services' | 'parts' | 'docs' | 'links' | 'chat';

interface Actions {
  hydrated: boolean;
  addVehicle: (v: Omit<Vehicle, 'id' | 'createdAt'>) => string;
  updateVehicle: (id: string, patch: Partial<Vehicle>) => void;
  removeVehicle: (id: string) => void;
  upsert: <K extends Collection>(key: K, item: Data[K][number]) => void;
  remove: (key: Collection, id: string) => void;
  clearChat: (vehicleId: string) => void;
  setRecalls: (vehicleId: string, items: Recall[]) => void;
  setSettings: (patch: Partial<Settings>) => void;
  importData: (data: Data) => void;
}

const initial: Data = {
  vehicles: [],
  fuel: [],
  maintenance: [],
  services: [],
  parts: [],
  docs: [],
  links: [],
  chat: [],
  recalls: {},
  settings: {
    distanceUnit: 'km',
    volumeUnit: 'L',
    currency: '$',
    aiProvider: 'anthropic',
    aiModel: 'claude-opus-5-5',
    aiBaseUrl: '',
  },
};

export const DATA_KEYS = Object.keys(initial) as (keyof Data)[];

export const useStore = create<Data & Actions>()(
  persist(
    (setState) => ({
      ...initial,
      hydrated: false,
      addVehicle: (v) => {
        const id = uid();
        setState((s) => ({
          vehicles: [...s.vehicles, { ...v, id, createdAt: new Date().toISOString() }],
          maintenance: [...s.maintenance, ...defaultMaintenance(id, v.fuelType, v.bodyType)],
        }));
        return id;
      },
      updateVehicle: (id, patch) =>
        setState((s) => ({ vehicles: s.vehicles.map((v) => (v.id === id ? { ...v, ...patch } : v)) })),
      removeVehicle: (id) =>
        setState((s) => {
          const keep = <T extends { vehicleId: string }>(xs: T[]) => xs.filter((x) => x.vehicleId !== id);
          const recalls = { ...s.recalls };
          delete recalls[id];
          return {
            vehicles: s.vehicles.filter((v) => v.id !== id),
            fuel: keep(s.fuel),
            maintenance: keep(s.maintenance),
            services: keep(s.services),
            parts: keep(s.parts),
            docs: keep(s.docs),
            links: keep(s.links),
            chat: keep(s.chat),
            recalls,
          };
        }),
      upsert: (key, item) =>
        setState((s) => {
          const list = s[key] as { id: string }[];
          const exists = list.some((x) => x.id === item.id);
          return { [key]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item] } as Partial<Data>;
        }),
      remove: (key, id) =>
        setState((s) => ({ [key]: (s[key] as { id: string }[]).filter((x) => x.id !== id) }) as Partial<Data>),
      clearChat: (vehicleId) => setState((s) => ({ chat: s.chat.filter((m) => m.vehicleId !== vehicleId) })),
      setRecalls: (vehicleId, items) =>
        setState((s) => ({ recalls: { ...s.recalls, [vehicleId]: { fetchedAt: new Date().toISOString(), items } } })),
      setSettings: (patch) => setState((s) => ({ settings: { ...s.settings, ...patch } })),
      importData: (data) => setState(() => ({ ...initial, ...data, settings: { ...initial.settings, ...data.settings } })),
    }),
    {
      name: 'bay-one-data',
      version: 1,
      storage: createJSONStorage(() => deviceStorage),
      partialize: (s) => Object.fromEntries(DATA_KEYS.map((k) => [k, s[k]])) as unknown as Data & Actions,
      onRehydrateStorage: () => () => useStore.setState({ hydrated: true }),
    },
  ),
);

export const exportData = (): Data => {
  const s = useStore.getState();
  return Object.fromEntries(DATA_KEYS.map((k) => [k, s[k]])) as unknown as Data;
};

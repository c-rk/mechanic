import { fmtNum } from '../lib/calc';
import { today, uid, useStore } from '../lib/store';
import type { FuelEntry, Vehicle } from '../lib/types';
import { FormModal } from './ui';

export type QuickKind = 'fuel' | 'odo' | 'service';

/** Logging forms reachable from the garage without opening the vehicle. */
export function QuickLog({ v, kind, onClose }: { v: Vehicle; kind: QuickKind | null; onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const maintenance = useStore((s) => s.maintenance);
  const upsert = useStore((s) => s.upsert);
  const logOdometer = useStore((s) => s.logOdometer);
  const u = settings.distanceUnit;
  const tasks = maintenance.filter((m) => m.vehicleId === v.id);

  return (
    <>
      <FormModal
        visible={kind === 'fuel'}
        title="Log fill-up"
        fields={[
          { key: 'odometer', label: `Odometer (${u})`, kind: 'number', required: true, placeholder: `Last ${fmtNum(v.odometer)}` },
          { key: 'volume', label: `Volume (${settings.volumeUnit})`, kind: 'number', required: true },
          { key: 'totalCost', label: `Total cost (${settings.currency})`, kind: 'number', required: true },
          { key: 'full', label: 'Filled to full', kind: 'toggle' },
          { key: 'date', label: 'Date', kind: 'date', required: true },
          { key: 'station', label: 'Station' },
        ]}
        initial={{ date: today(), full: true, station: '' }}
        onClose={onClose}
        onSave={(x) => {
          const e = { id: uid(), vehicleId: v.id, ...x } as unknown as FuelEntry;
          upsert('fuel', e);
          logOdometer(v.id, e.odometer, 'fuel', `${e.date}T12:00:00.000Z`);
          onClose();
        }}
      />
      <FormModal
        visible={kind === 'odo'}
        title="Odometer reading"
        fields={[{ key: 'odometer', label: `Current reading (${u})`, kind: 'number', required: true, placeholder: `Last ${fmtNum(v.odometer)}` }]}
        initial={{}}
        onClose={onClose}
        onSave={(x) => {
          logOdometer(v.id, x.odometer as number, 'manual');
          onClose();
        }}
      />
      <FormModal
        visible={kind === 'service'}
        title="Log service"
        fields={[
          {
            key: 'task',
            label: 'What was done',
            kind: 'select',
            options: [...tasks.map((m) => ({ value: m.id, label: m.name })), { value: 'other', label: 'Other' }],
          },
          { key: 'title', label: 'Description (for Other or extra detail)' },
          { key: 'odometer', label: `Odometer (${u})`, kind: 'number', required: true },
          { key: 'cost', label: `Cost (${settings.currency})`, kind: 'number' },
          { key: 'shop', label: 'Workshop / DIY' },
          { key: 'date', label: 'Date', kind: 'date', required: true },
        ]}
        initial={{ task: tasks[0]?.id ?? 'other', odometer: v.odometer, date: today() }}
        onClose={onClose}
        onSave={(x) => {
          const task = tasks.find((m) => m.id === x.task);
          const title = [task?.name, String(x.title ?? '').trim()].filter(Boolean).join(' – ') || 'Service';
          const odometer = x.odometer as number;
          const date = String(x.date);
          upsert('services', { id: uid(), vehicleId: v.id, date, odometer, title, cost: (x.cost as number) ?? 0, shop: String(x.shop ?? ''), notes: '' });
          if (task) upsert('maintenance', { ...task, lastDoneOdometer: odometer, lastDoneDate: date });
          logOdometer(v.id, odometer, 'service', `${date}T12:00:00.000Z`);
          onClose();
        }}
      />
    </>
  );
}

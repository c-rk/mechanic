import { useState } from 'react';
import { Text, View } from 'react-native';

import { describeDue, dueInfo, fmtMoney, fmtNum, fuelStats, sortByDue } from '../../lib/calc';
import { today, uid, useStore } from '../../lib/store';
import { C, F, STATE_COLOR } from '../../lib/theme';
import type { FuelEntry, MaintenanceItem, ServiceRecord, Vehicle } from '../../lib/types';
import { Badge, Empty, FieldDef, FormModal, Button, Stat, Panel, Row, T } from '../ui';

type Editing<T> = { item?: T } | null;

export function FuelTab({ v }: { v: Vehicle }) {
  const all = useStore((s) => s.fuel);
  const settings = useStore((s) => s.settings);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const logOdometer = useStore((s) => s.logOdometer);
  const [editing, setEditing] = useState<Editing<FuelEntry>>(null);

  const entries = all.filter((f) => f.vehicleId === v.id).sort((a, b) => b.odometer - a.odometer);
  const stats = fuelStats(entries, settings);
  const perFill = new Map(stats.series.map((p) => [p.id, p.value]));

  const fields: FieldDef[] = [
    { key: 'date', label: 'Date', kind: 'date', required: true },
    { key: 'odometer', label: `Odometer (${settings.distanceUnit})`, kind: 'number', required: true },
    { key: 'volume', label: `Volume (${settings.volumeUnit})`, kind: 'number', required: true },
    { key: 'totalCost', label: `Total cost (${settings.currency})`, kind: 'number', required: true },
    { key: 'full', label: 'Filled to full', kind: 'toggle' },
    { key: 'station', label: 'Station' },
  ];

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stat flex={1} label="Average" value={stats.economy === null ? '--.-' : stats.economy.toFixed(1)} unit={stats.economyLabel} color={C.green} />
        <Stat flex={1} label="Fuel spend" value={fmtNum(stats.totalCost, 2)} unit={settings.currency} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stat flex={1} label="Tracked" value={fmtNum(stats.distanceTracked)} unit={settings.distanceUnit} />
        <Stat flex={1} label={`Cost / ${settings.distanceUnit}`} value={stats.costPerDistance === null ? '-.--' : stats.costPerDistance.toFixed(3)} unit={settings.currency} />
      </View>

      <Panel title="Fill-ups" right={<Button label="Add" small onPress={() => setEditing({})} />}>
        {entries.length === 0 ? <Empty text="No fill-ups logged. Consumption needs two full fills." /> : null}
        {entries.map((e, i) => (
          <Row key={e.id} onPress={() => setEditing({ item: e })} last={i === entries.length - 1}>
            <View style={{ flex: 1 }}>
              <Text style={T.num}>
                {fmtNum(e.volume, 2)} {settings.volumeUnit}
                <Text style={[T.dim, { fontFamily: F.medium }]}>  {fmtMoney(e.totalCost, settings.currency)}</Text>
              </Text>
              <Text style={[T.dim, { fontFamily: F.medium }]}>
                {e.date}  {fmtNum(e.odometer)} {settings.distanceUnit}
                {e.full ? '' : '  partial'}
              </Text>
            </View>
            {perFill.has(e.id) ? (
              <Text style={[T.num, { color: C.green }]}>
                {perFill.get(e.id)!.toFixed(1)}
                <Text style={{ fontSize: 10 }}> {stats.economyLabel}</Text>
              </Text>
            ) : null}
          </Row>
        ))}
      </Panel>

      <FormModal
        visible={editing !== null}
        title={editing?.item ? 'Edit fill-up' : 'Log fill-up'}
        fields={fields}
        initial={editing?.item ? { ...editing.item } : { date: today(), odometer: undefined, full: true, station: '' }}
        onClose={() => setEditing(null)}
        onDelete={editing?.item ? () => (remove('fuel', editing.item!.id), setEditing(null)) : undefined}
        onSave={(x) => {
          const entry = { id: editing?.item?.id ?? uid(), vehicleId: v.id, ...x } as unknown as FuelEntry;
          upsert('fuel', entry);
          logOdometer(v.id, entry.odometer, 'fuel', `${entry.date}T12:00:00.000Z`);
          setEditing(null);
        }}
      />
    </>
  );
}

export function ServiceTab({ v }: { v: Vehicle }) {
  const allItems = useStore((s) => s.maintenance);
  const allRecords = useStore((s) => s.services);
  const settings = useStore((s) => s.settings);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const logOdometer = useStore((s) => s.logOdometer);
  const [item, setItem] = useState<Editing<MaintenanceItem>>(null);
  const [record, setRecord] = useState<Editing<ServiceRecord>>(null);

  const schedule = sortByDue(allItems.filter((m) => m.vehicleId === v.id).map((m) => ({ m, due: dueInfo(m, v.odometer) })));
  const records = allRecords.filter((r) => r.vehicleId === v.id).sort((a, b) => b.date.localeCompare(a.date) || b.odometer - a.odometer);
  const spend = records.reduce((a, r) => a + r.cost, 0);
  const u = settings.distanceUnit;

  const markDone = (m: MaintenanceItem) => {
    upsert('maintenance', { ...m, lastDoneOdometer: v.odometer, lastDoneDate: today() });
    upsert('services', { id: uid(), vehicleId: v.id, date: today(), odometer: v.odometer, title: m.name, cost: 0, shop: '', notes: '' });
  };

  const itemFields: FieldDef[] = [
    { key: 'name', label: 'Task', required: true },
    { key: 'intervalDistance', label: `Every (${u})`, kind: 'number' },
    { key: 'intervalMonths', label: 'Every (months)', kind: 'number' },
    { key: 'lastDoneOdometer', label: `Last done at (${u})`, kind: 'number' },
    { key: 'lastDoneDate', label: 'Last done on', kind: 'date' },
    { key: 'notes', label: 'Notes (spec, part number)', kind: 'multiline' },
  ];
  const recordFields: FieldDef[] = [
    { key: 'title', label: 'Work done', required: true },
    { key: 'date', label: 'Date', kind: 'date', required: true },
    { key: 'odometer', label: `Odometer (${u})`, kind: 'number', required: true },
    { key: 'cost', label: `Cost (${settings.currency})`, kind: 'number' },
    { key: 'shop', label: 'Workshop / DIY' },
    { key: 'notes', label: 'Notes', kind: 'multiline' },
  ];

  return (
    <>
      <Panel title="Schedule" right={<Button label="Add" small onPress={() => setItem({})} />}>
        <Text style={[T.dim, { marginBottom: 4 }]}>
          Intervals start as generic values. Set them to the figures in the owner&apos;s manual.
        </Text>
        {schedule.map(({ m, due }, i) => (
          <Row key={m.id} onPress={() => setItem({ item: m })} last={i === schedule.length - 1}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={T.body}>{m.name}</Text>
              <Text style={[T.dim, { fontFamily: F.medium, fontSize: 12 }]}>
                {[m.intervalDistance && `${fmtNum(m.intervalDistance)} ${u}`, m.intervalMonths && `${m.intervalMonths} mo`].filter(Boolean).join(' / ') || 'no interval'}
                {'  ·  '}
                {describeDue(due, u)}
              </Text>
            </View>
            <Badge text={due.state === 'unknown' ? 'no data' : due.state} color={STATE_COLOR[due.state]} />
            <Button label="Done" tone="secondary" small onPress={() => markDone(m)} />
          </Row>
        ))}
      </Panel>

      <Panel title={`History · ${fmtMoney(spend, settings.currency)}`} right={<Button label="Add" small onPress={() => setRecord({})} />}>
        {records.length === 0 ? <Empty text="No service records yet." /> : null}
        {records.map((r, i) => (
          <Row key={r.id} onPress={() => setRecord({ item: r })} last={i === records.length - 1}>
            <View style={{ flex: 1 }}>
              <Text style={T.body}>{r.title}</Text>
              <Text style={[T.dim, { fontFamily: F.medium, fontSize: 12 }]}>
                {r.date}  {fmtNum(r.odometer)} {u}
                {r.shop ? `  ${r.shop}` : ''}
              </Text>
            </View>
            {r.cost ? <Text style={T.num}>{fmtMoney(r.cost, settings.currency)}</Text> : null}
          </Row>
        ))}
      </Panel>

      <FormModal
        visible={item !== null}
        title={item?.item ? 'Edit task' : 'New task'}
        fields={itemFields}
        initial={item?.item ? { ...item.item } : { name: '', notes: '' }}
        onClose={() => setItem(null)}
        onDelete={item?.item ? () => (remove('maintenance', item.item!.id), setItem(null)) : undefined}
        onSave={(x) => {
          upsert('maintenance', { id: item?.item?.id ?? uid(), vehicleId: v.id, ...x } as unknown as MaintenanceItem);
          setItem(null);
        }}
      />
      <FormModal
        visible={record !== null}
        title={record?.item ? 'Edit record' : 'New service record'}
        fields={recordFields}
        initial={record?.item ? { ...record.item } : { title: '', date: today(), odometer: v.odometer, cost: undefined, shop: '', notes: '' }}
        onClose={() => setRecord(null)}
        onDelete={record?.item ? () => (remove('services', record.item!.id), setRecord(null)) : undefined}
        onSave={(x) => {
          const r = { id: record?.item?.id ?? uid(), vehicleId: v.id, ...x, cost: x.cost ?? 0 } as unknown as ServiceRecord;
          upsert('services', r);
          logOdometer(v.id, r.odometer, 'service', `${r.date}T12:00:00.000Z`);
          setRecord(null);
        }}
      />
    </>
  );
}

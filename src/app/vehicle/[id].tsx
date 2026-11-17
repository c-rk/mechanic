import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Shell } from '../../components/Shell';
import { FuelTab, ServiceTab } from '../../components/tabs/FuelService';
import { AssistantTab, IntelTab } from '../../components/tabs/IntelAssistant';
import { DocsTab, PartsTab } from '../../components/tabs/PartsDocs';
import { Badge, Empty, FormModal, Button, Stat, Panel, Row, Segmented, T } from '../../components/ui';
import { Viewer3D } from '../../components/Viewer3D';
import { describeDue, dueInfo, fmtNum, fuelStats, sortByDue } from '../../lib/calc';
import { estimateOdometer } from '../../lib/odometer';
import { confirm } from '../../lib/confirm';
import { deleteFile, PickedFile, saveFile } from '../../lib/files';
import { useStore } from '../../lib/store';
import { C, F, STATE_COLOR } from '../../lib/theme';
import type { Vehicle } from '../../lib/types';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'service', label: 'Service' },
  { value: 'parts', label: 'Parts' },
  { value: 'docs', label: 'Docs' },
  { value: 'intel', label: 'Intel' },
  { value: 'ask', label: 'Mechanic' },
] as const;
type Tab = (typeof TABS)[number]['value'];

export default function VehicleScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const v = useStore((s) => s.vehicles.find((x) => x.id === id));
  const [tab, setTab] = useState<Tab>(() => (TABS.some((t) => t.value === initialTab) ? (initialTab as Tab) : 'overview'));

  if (!v) {
    return (
      <Shell title="Not found" back>
        <Panel title="Empty bay">
          <Empty text="This vehicle is no longer in the garage." />
        </Panel>
      </Shell>
    );
  }

  return (
    <Shell title={v.nickname || `${v.make} ${v.model}`} eyebrow={[v.year, v.make, v.model].filter(Boolean).join(' ')} back>
      <View style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
        <Viewer3D bodyType={v.bodyType} color={v.color} modelRef={v.modelRef} wrap={v.wrap} height={tab === 'overview' ? 260 : 160} />
      </View>
      <Segmented options={[...TABS]} value={tab} onChange={setTab} scroll />
      {tab === 'overview' ? <Overview v={v} onTab={setTab} /> : null}
      {tab === 'fuel' ? <FuelTab v={v} /> : null}
      {tab === 'service' ? <ServiceTab v={v} /> : null}
      {tab === 'parts' ? <PartsTab v={v} /> : null}
      {tab === 'docs' ? <DocsTab v={v} /> : null}
      {tab === 'intel' ? <IntelTab v={v} /> : null}
      {tab === 'ask' ? <AssistantTab v={v} /> : null}
    </Shell>
  );
}

function Overview({ v, onTab }: { v: Vehicle; onTab: (t: Tab) => void }) {
  const settings = useStore((s) => s.settings);
  const fuel = useStore((s) => s.fuel);
  const maintenance = useStore((s) => s.maintenance);
  const services = useStore((s) => s.services);
  const odoLog = useStore((s) => s.odoLog);
  const updateVehicle = useStore((s) => s.updateVehicle);
  const logOdometer = useStore((s) => s.logOdometer);
  const removeVehicle = useStore((s) => s.removeVehicle);
  const [odo, setOdo] = useState(false);
  const [message, setMessage] = useState('');
  const [showSpecs, setShowSpecs] = useState(false);

  const stats = fuelStats(fuel.filter((f) => f.vehicleId === v.id), settings);
  const serviceSpend = services.filter((r) => r.vehicleId === v.id).reduce((a, r) => a + r.cost, 0);
  const readings = odoLog.filter((r) => r.vehicleId === v.id).sort((a, b) => b.at.localeCompare(a.at));
  const est = estimateOdometer(readings, v.odometer);
  const due = sortByDue(maintenance.filter((m) => m.vehicleId === v.id).map((m) => ({ m, due: dueInfo(m, est.estimate, est.perDay) })));
  const attention = due.filter((x) => x.due.state === 'overdue' || x.due.state === 'soon');
  const upcoming = (attention.length ? attention : due.filter((x) => x.due.state === 'ok')).slice(0, 4);
  const specs = Object.entries(v.specs);

  const uploadModel = async () => {
    setMessage('');
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled) return;
    const asset = res.assets[0] as PickedFile;
    if (!/\.(glb|gltf)$/i.test(asset.name)) return setMessage('Choose a .glb file (binary glTF).');
    try {
      const ref = await saveFile(asset);
      if (v.modelRef) await deleteFile(v.modelRef).catch(() => undefined);
      updateVehicle(v.id, { modelRef: ref });
    } catch (e) {
      setMessage(`Could not store the model: ${(e as Error).message}`);
    }
  };

  const facts: [string, string][] = [
    ['Engine', v.engine],
    ['Gearbox', v.transmission],
    ['Fuel', v.fuelType],
    ['Body', v.bodyType],
    ['VIN', v.vin],
    ['Plate', v.plate],
  ];

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat
          flex={1.3}
          label="Odometer"
          value={fmtNum(v.odometer)}
          unit={settings.distanceUnit}
          hint={est.perDay !== null ? `≈ ${fmtNum(est.perDay)} ${settings.distanceUnit}/day` : undefined}
        />
        <Stat flex={1} label="Consumption" value={stats.economy === null ? '—' : stats.economy.toFixed(1)} unit={stats.economy === null ? undefined : stats.economyLabel} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat flex={1} label="Fuel spend" value={fmtNum(stats.totalCost, 0)} unit={settings.currency} />
        <Stat flex={1} label="Service spend" value={fmtNum(serviceSpend, 0)} unit={settings.currency} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Log odometer" tone="secondary" onPress={() => setOdo(true)} style={{ flex: 1 }} />
        <Button label="Record drive" tone="secondary" onPress={() => router.push('/trip')} style={{ flex: 1 }} />
      </View>

      <Panel title={attention.length ? `Needs attention (${attention.length})` : 'Coming up'} right={<Button label="Schedule" tone="ghost" small onPress={() => onTab('service')} />}>
        {upcoming.length === 0 ? <Empty text="Log when each task was last done to start the countdown." /> : null}
        {upcoming.map(({ m, due: d }, i) => (
          <Row key={m.id} last={i === upcoming.length - 1}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={T.strong} numberOfLines={1}>
                {m.name}
              </Text>
              <Text style={T.small}>{describeDue(d, settings.distanceUnit)}</Text>
            </View>
            <Badge text={d.state} color={STATE_COLOR[d.state]} />
          </Row>
        ))}
      </Panel>

      <Panel title="Vehicle data" right={<Button label="Edit" tone="ghost" small onPress={() => router.push(`/vehicle/new?edit=${v.id}`)} />}>
        {facts.map(([k, val], i) => (
          <Row key={k} last={i === facts.length - 1 && !specs.length && !v.notes}>
            <Text style={[T.label, { width: 104 }]}>{k}</Text>
            <Text style={[T.body, { flex: 1, fontFamily: k === 'VIN' || k === 'Plate' ? F.medium : F.regular }]} selectable>
              {val || '—'}
            </Text>
          </Row>
        ))}
        {v.notes ? <Text style={[T.dim, { marginTop: 8 }]}>{v.notes}</Text> : null}
        {specs.length ? (
          <>
            <Button label={showSpecs ? 'Hide decoded specs' : `Decoded specs (${specs.length})`} tone="secondary" small onPress={() => setShowSpecs(!showSpecs)} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
            {showSpecs
              ? specs.map(([k, val]) => (
                  <Row key={k}>
                    <Text style={[T.dim, { flex: 1 }]}>{k}</Text>
                    <Text style={[T.body, { flex: 1, fontSize: 13 }]}>{val}</Text>
                  </Row>
                ))
              : null}
          </>
        ) : null}
      </Panel>

      <Panel title="Odometer history" right={<Button label="Add" tone="ghost" small onPress={() => setOdo(true)} />}>
        {readings.length === 0 ? <Empty text="No readings yet." /> : null}
        {readings.slice(0, 6).map((r, i, a) => (
          <Row key={r.id} last={i === a.length - 1}>
            <Text style={[T.num, { flex: 1 }]}>
              {fmtNum(r.odometer)} {settings.distanceUnit}
            </Text>
            <Text style={T.small}>
              {r.at.slice(0, 10)} · {r.source === 'gps' ? 'GPS drive' : r.source}
            </Text>
          </Row>
        ))}
      </Panel>

      <Panel title="3D model">
        <Text style={T.dim}>
          {v.modelRef
            ? 'Showing your uploaded .glb model.'
            : v.wrap
              ? `Showing the ${v.bodyType} body${v.wrap.shape ? ' fitted to' : ' wrapped with'} your photos.`
              : `Showing the standard ${v.bodyType} body. Photo wrap turns a side photo of your car into its 3D model, offline.`}
        </Text>
        {message ? <Text style={[T.dim, { color: C.red, marginTop: 6 }]}>{message}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {v.bodyType !== 'motorcycle' && !v.modelRef ? (
            <Button label={v.wrap ? 'Edit photo wrap' : 'Photo wrap'} small onPress={() => router.push(`/vehicle/wrap?id=${v.id}`)} />
          ) : null}
          <Button label="Upload .glb" tone="secondary" small onPress={uploadModel} />
          {v.modelRef ? (
            <Button
              label="Use built-in"
              tone="secondary"
              small
              onPress={() => {
                deleteFile(v.modelRef!).catch(() => undefined);
                updateVehicle(v.id, { modelRef: undefined });
              }}
            />
          ) : null}
        </View>
      </Panel>

      <Button
        label="Remove vehicle"
        tone="danger"
        onPress={() =>
          confirm('Remove vehicle', `${v.nickname || v.model} and all of its logs, parts and documents will be deleted from this device.`, () => {
            const s = useStore.getState();
            s.docs.filter((d) => d.vehicleId === v.id).forEach((d) => deleteFile(d.fileRef).catch(() => undefined));
            if (v.modelRef) deleteFile(v.modelRef).catch(() => undefined);
            [v.wrap?.side, v.wrap?.front, v.wrap?.rear].forEach((w) => w && deleteFile(w.ref).catch(() => undefined));
            removeVehicle(v.id);
            router.replace('/');
          })
        }
      />

      <FormModal
        visible={odo}
        title="Odometer"
        fields={[{ key: 'odometer', label: `Current reading (${settings.distanceUnit})`, kind: 'number', required: true }]}
        initial={{ odometer: undefined }}
        onClose={() => setOdo(false)}
        onSave={(x) => {
          logOdometer(v.id, x.odometer as number, 'manual');
          setOdo(false);
        }}
      />
    </>
  );
}

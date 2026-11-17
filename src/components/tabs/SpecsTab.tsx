import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { getApiKey } from '../../lib/secrets';
import { fillWithAi, mergeSheets, sheetFromVin } from '../../lib/specFill';
import { ALL_FIELDS, SPEC_CATEGORIES, type SpecField, type SpecSource } from '../../lib/specSchema';
import { useStore } from '../../lib/store';
import { AREA, C, F, NUM } from '../../lib/theme';
import type { Vehicle } from '../../lib/types';
import { Button, FormModal, Panel, Row, T } from '../ui';

const SOURCE: Record<SpecSource, { label: string; color: string }> = {
  vin: { label: 'VIN', color: C.green },
  ai: { label: 'AI', color: C.steel },
  user: { label: 'You', color: C.accent },
};

export function SpecsTab({ v }: { v: Vehicle }) {
  const settings = useStore((s) => s.settings);
  const updateVehicle = useStore((s) => s.updateVehicle);
  const [editing, setEditing] = useState<SpecField | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [showEmpty, setShowEmpty] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const sheet = mergeSheets(sheetFromVin(v.specs, settings.distanceUnit === 'km'), v.specSheet);
  const filled = ALL_FIELDS.filter((x) => sheet[x.key]).length;
  const count = (src: SpecSource) => Object.values(sheet).filter((x) => x.source === src).length;

  const fill = async () => {
    setBusy(true);
    setNote('');
    try {
      const ai = await fillWithAi(v, settings, await getApiKey(), sheet);
      // Keep the owner's entries; replace earlier AI values with the new ones.
      const own = Object.fromEntries(Object.entries(v.specSheet ?? {}).filter(([, x]) => x.source === 'user'));
      updateVehicle(v.id, { specSheet: { ...ai, ...own } });
      setNote(`Filled ${Object.keys(ai).length} values. AI figures can be wrong: check torque settings, capacities and pressures against the owner's manual or door-jamb label before relying on them.`);
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const raw = Object.entries(v.specs);

  return (
    <>
      <Panel tint={AREA.specs}
        title={`Specification · ${filled}/${ALL_FIELDS.length}`}
        right={busy ? <ActivityIndicator color={C.accent} /> : <Button label="Fill with AI" small onPress={fill} />}>
        <Text style={T.dim}>
          {[v.year, v.make, v.model, v.trim].filter(Boolean).join(' ')}
          {v.engine ? ` · ${v.engine}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
          {(Object.keys(SOURCE) as SpecSource[]).map((s) => (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: SOURCE[s].color }} />
              <Text style={T.small}>
                {SOURCE[s].label} {count(s)}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[T.small, { marginTop: 8 }]}>
          VIN = NHTSA decoder · AI = your AI provider, sent only year/make/model/trim/engine · You = entered by you. Tap any row to edit.
        </Text>
        {note ? <Text style={[T.dim, { color: C.yellow, marginTop: 8 }]}>{note}</Text> : null}
        <Button label={showEmpty ? 'Hide empty fields' : 'Show empty fields'} tone="ghost" small onPress={() => setShowEmpty(!showEmpty)} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
      </Panel>

      {SPEC_CATEGORIES.map((cat) => {
        const rows = cat.fields.filter((x) => showEmpty || sheet[x.key]);
        if (!rows.length) return null;
        return (
          <Panel key={cat.id} tint={AREA.specs} title={cat.title}>
            {rows.map((x, i) => {
              const val = sheet[x.key];
              return (
                <Row key={x.key} onPress={() => setEditing(x)} last={i === rows.length - 1}>
                  <Text style={[T.dim, { flex: 1 }]}>{x.label}</Text>
                  <View style={{ flex: 1.3, alignItems: 'flex-end', gap: 2 }}>
                    <Text style={{ color: val ? C.text : C.faint, fontFamily: F.display, fontSize: 16, textAlign: 'right', ...NUM }} selectable>
                      {val?.value ?? '—'}
                    </Text>
                    {val ? <Text style={[T.small, { color: SOURCE[val.source].color }]}>{SOURCE[val.source].label}</Text> : null}
                  </View>
                </Row>
              );
            })}
          </Panel>
        );
      })}

      {filled === 0 && !showEmpty ? (
        <Panel>
          <Text style={T.dim}>No specifications yet. Decode a VIN when adding the vehicle, use Fill with AI, or show the empty fields and enter values from the owner&apos;s manual.</Text>
        </Panel>
      ) : null}

      {raw.length ? (
        <Panel tint={AREA.specs} title={`Raw VIN decoder data (${raw.length})`} right={<Button label={showRaw ? 'Hide' : 'Show'} tone="ghost" small onPress={() => setShowRaw(!showRaw)} />}>
          {showRaw
            ? raw.map(([k, val], i) => (
                <Row key={k} last={i === raw.length - 1}>
                  <Text style={[T.dim, { flex: 1 }]}>{k}</Text>
                  <Text style={[T.body, { flex: 1, fontSize: 13 }]}>{val}</Text>
                </Row>
              ))
            : null}
        </Panel>
      ) : null}

      <FormModal
        visible={editing !== null}
        title={editing?.label ?? ''}
        fields={editing ? [{ key: 'value', label: editing.label, placeholder: editing.hint }] : []}
        initial={{ value: editing ? sheet[editing.key]?.value ?? '' : '' }}
        onClose={() => setEditing(null)}
        onSave={(x) => {
          if (!editing) return;
          const next = { ...(v.specSheet ?? {}) };
          const text = String(x.value ?? '').trim();
          if (text) next[editing.key] = { value: text, source: 'user' };
          else delete next[editing.key];
          updateVehicle(v.id, { specSheet: next });
          setEditing(null);
        }}
      />
    </>
  );
}

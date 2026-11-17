import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { fmtMoney } from '../../lib/calc';
import { checkPrice } from '../../lib/proxy';
import { confirm } from '../../lib/confirm';
import { deleteFile, openFile, PickedFile, saveFile } from '../../lib/files';
import { today, uid, useStore } from '../../lib/store';
import { C, F } from '../../lib/theme';
import type { Doc, DocCategory, Part, PartStatus, Vehicle } from '../../lib/types';
import { Badge, Empty, FieldDef, FormModal, Button, Panel, Row, T } from '../ui';

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'shop';
  }
};

const STATUS_COLOR: Record<PartStatus, string> = { wishlist: C.dim, ordered: C.yellow, installed: C.green };

export function PartsTab({ v }: { v: Vehicle }) {
  const all = useStore((s) => s.parts);
  const currency = useStore((s) => s.settings.currency);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const [editing, setEditing] = useState<{ item?: Part } | null>(null);
  const [pricing, setPricing] = useState<Part | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [priceNote, setPriceNote] = useState('');
  const proxyUrl = useStore((s) => s.settings.proxyUrl);

  /** Reads the price from the shop page through the data proxy and appends it to the history. */
  const fetchPrice = async (p: Part) => {
    setChecking(p.id);
    setPriceNote('');
    try {
      const info = await checkPrice(p.url);
      if (info.price === undefined) {
        setPriceNote(`No price found on ${hostOf(p.url)}; add it by hand with + Price.`);
        return;
      }
      const latest = useStore.getState().parts.find((x) => x.id === p.id) ?? p;
      upsert('parts', {
        ...latest,
        prices: [...latest.prices, { date: today(), price: info.price, vendor: hostOf(info.url ?? p.url) + (info.currency ? ` (${info.currency})` : '') }],
      });
    } catch (e) {
      setPriceNote(`${p.name}: ${(e as Error).message}`);
    } finally {
      setChecking(null);
    }
  };
  const checkAll = async () => {
    for (const p of parts.filter((x) => x.url)) await fetchPrice(p);
  };

  const parts = all.filter((p) => p.vehicleId === v.id);
  const fields: FieldDef[] = [
    { key: 'name', label: 'Part', required: true, placeholder: 'Front brake pads' },
    { key: 'brand', label: 'Brand' },
    { key: 'partNumber', label: 'Part number' },
    { key: 'category', label: 'Category', placeholder: 'Brakes, fluids, filters…' },
    { key: 'url', label: 'Shop link', placeholder: 'https://' },
    {
      key: 'status',
      label: 'Status',
      kind: 'select',
      options: (['wishlist', 'ordered', 'installed'] as const).map((s) => ({ value: s, label: s })),
    },
    { key: 'notes', label: 'Notes (fitment, spec)', kind: 'multiline' },
  ];

  return (
    <>
      <Panel
        title="Parts & fluids"
        right={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {proxyUrl && parts.some((p) => p.url) ? <Button label="Check all" tone="ghost" small disabled={checking !== null} onPress={checkAll} /> : null}
            <Button label="Add" small onPress={() => setEditing({})} />
          </View>
        }>
        <Text style={[T.dim, { marginBottom: 4 }]}>
          Save parts you have verified fit this vehicle. With a shop link, Check price reads the current price from the page
          and adds it to the history.
        </Text>
        {priceNote ? <Text style={[T.dim, { color: C.yellow, marginBottom: 4 }]}>{priceNote}</Text> : null}
        {parts.length === 0 ? <Empty text="No parts saved." /> : null}
        {parts.map((p, i) => {
          const prices = [...p.prices].sort((a, b) => a.date.localeCompare(b.date));
          const latest = prices[prices.length - 1];
          const low = prices.length ? Math.min(...prices.map((x) => x.price)) : null;
          return (
            <Row key={p.id} onPress={() => setEditing({ item: p })} last={i === parts.length - 1}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={T.body}>{p.name}</Text>
                <Text style={[T.dim, { fontFamily: F.medium, fontSize: 12 }]}>
                  {[p.brand, p.partNumber, p.category].filter(Boolean).join('  ·  ') || 'no details'}
                </Text>
                {latest ? (
                  <Text style={[T.dim, { fontFamily: F.medium, fontSize: 12 }]}>
                    <Text style={{ color: C.accent }}>{fmtMoney(latest.price, currency)}</Text> {latest.vendor} {latest.date}
                    {prices.length > 1 && low !== null ? `  ·  low ${fmtMoney(low, currency)} of ${prices.length}` : ''}
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                  <Button label="+ Price" tone="secondary" small onPress={() => setPricing(p)} />
                  {p.url ? <Button label="Shop" tone="secondary" small onPress={() => Linking.openURL(p.url)} /> : null}
                  {p.url && proxyUrl ? (
                    <Button label={checking === p.id ? 'Checking…' : 'Check price'} tone="secondary" small disabled={checking !== null} onPress={() => fetchPrice(p)} />
                  ) : null}
                </View>
              </View>
              <Badge text={p.status} color={STATUS_COLOR[p.status]} />
            </Row>
          );
        })}
      </Panel>

      <FormModal
        visible={editing !== null}
        title={editing?.item ? 'Edit part' : 'New part'}
        fields={fields}
        initial={editing?.item ? { ...editing.item, prices: undefined } : { status: 'wishlist' }}
        onClose={() => setEditing(null)}
        onDelete={editing?.item ? () => (remove('parts', editing.item!.id), setEditing(null)) : undefined}
        onSave={(x) => {
          upsert('parts', { id: editing?.item?.id ?? uid(), vehicleId: v.id, ...x, prices: editing?.item?.prices ?? [] } as unknown as Part);
          setEditing(null);
        }}
      />
      <FormModal
        visible={pricing !== null}
        title={`Price: ${pricing?.name ?? ''}`}
        fields={[
          { key: 'price', label: `Price (${currency})`, kind: 'number', required: true },
          { key: 'vendor', label: 'Shop' },
          { key: 'date', label: 'Date', kind: 'date', required: true },
        ]}
        initial={{ date: today(), vendor: '' }}
        onClose={() => setPricing(null)}
        onSave={(x) => {
          if (pricing)
            upsert('parts', {
              ...pricing,
              prices: [...pricing.prices, { price: x.price as number, vendor: String(x.vendor ?? ''), date: String(x.date) }],
            });
          setPricing(null);
        }}
      />
    </>
  );
}

const CATEGORIES: DocCategory[] = ['registration', 'insurance', 'service', 'manual', 'receipt', 'other'];

const fmtSize = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function DocsTab({ v }: { v: Vehicle }) {
  const all = useStore((s) => s.docs);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [error, setError] = useState('');

  const docs = all.filter((d) => d.vehicleId === v.id).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const fields: FieldDef[] = [
    { key: 'name', label: 'Name', required: true },
    { key: 'category', label: 'Folder', kind: 'select', options: CATEGORIES.map((c) => ({ value: c, label: c })) },
  ];

  const pick = async () => {
    setError('');
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!res.canceled) setPicked(res.assets[0] as PickedFile);
  };

  return (
    <>
      <Panel title="Document folder" right={<Button label="Add file" small onPress={pick} />}>
        <Text style={[T.dim, { marginBottom: 4 }]}>
          Registration, insurance, invoices, manuals. Files are copied into this device&apos;s app storage and are not uploaded.
        </Text>
        {error ? <Text style={[T.dim, { color: C.red }]}>{error}</Text> : null}
        {docs.length === 0 ? <Empty text="No documents stored." /> : null}
        {CATEGORIES.map((cat) => {
          const inCat = docs.filter((d) => d.category === cat);
          if (!inCat.length) return null;
          return (
            <View key={cat} style={{ marginTop: 8 }}>
              <Text style={T.label}>
                {cat} ({inCat.length})
              </Text>
              {inCat.map((d, i) => (
                <Row key={d.id} onPress={() => openFile(d.fileRef).catch((e) => setError((e as Error).message))} last={i === inCat.length - 1}>
                  <View style={{ flex: 1 }}>
                    <Text style={T.body} numberOfLines={1}>
                      {d.name}
                    </Text>
                    <Text style={[T.dim, { fontFamily: F.medium, fontSize: 12 }]}>
                      {d.addedAt.slice(0, 10)}  {fmtSize(d.size)}
                    </Text>
                  </View>
                  <Button label="Edit" tone="secondary" small onPress={() => setEditing(d)} />
                </Row>
              ))}
            </View>
          );
        })}
      </Panel>

      <FormModal
        visible={picked !== null || editing !== null}
        title={editing ? 'Edit document' : 'Store document'}
        fields={fields}
        initial={editing ? { name: editing.name, category: editing.category } : { name: picked?.name ?? '', category: 'other' }}
        onClose={() => (setPicked(null), setEditing(null))}
        onDelete={
          editing
            ? () =>
                confirm('Delete document', `"${editing.name}" will be removed from this device.`, () => {
                  deleteFile(editing.fileRef).catch(() => undefined);
                  remove('docs', editing.id);
                  setEditing(null);
                })
            : undefined
        }
        onSave={async (x) => {
          const meta = { name: String(x.name), category: x.category as DocCategory };
          if (editing) {
            upsert('docs', { ...editing, ...meta });
          } else if (picked) {
            try {
              const fileRef = await saveFile(picked);
              upsert('docs', {
                id: uid(),
                vehicleId: v.id,
                ...meta,
                mimeType: picked.mimeType ?? 'application/octet-stream',
                size: picked.size ?? 0,
                fileRef,
                addedAt: new Date().toISOString(),
              });
            } catch (e) {
              setError(`Could not store the file: ${(e as Error).message}`);
            }
          }
          setPicked(null);
          setEditing(null);
        }}
      />
    </>
  );
}

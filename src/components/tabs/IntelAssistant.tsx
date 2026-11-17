import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { askAssistant } from '../../lib/ai';
import { buildSystemPrompt } from '../../lib/context';
import { fetchRecalls, researchLinks } from '../../lib/nhtsa';
import { getApiKey } from '../../lib/secrets';
import { exportData, uid, useStore } from '../../lib/store';
import { C, F } from '../../lib/theme';
import type { LinkKind, SavedLink, Vehicle } from '../../lib/types';
import { ResearchPanel } from './Research';
import { Badge, Empty, FieldDef, FormModal, Button, Input, Panel, Row, T } from '../ui';

const KINDS: LinkKind[] = ['manual', 'forum', 'video', 'reddit', 'blog', 'other'];

export function IntelTab({ v }: { v: Vehicle }) {
  const cached = useStore((s) => s.recalls[v.id]);
  const allLinks = useStore((s) => s.links);
  const setRecalls = useStore((s) => s.setRecalls);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ item?: SavedLink } | null>(null);

  const links = allLinks.filter((l) => l.vehicleId === v.id);
  const fields: FieldDef[] = [
    { key: 'title', label: 'Title', required: true },
    { key: 'url', label: 'URL', required: true, placeholder: 'https://' },
    { key: 'kind', label: 'Type', kind: 'select', options: KINDS.map((k) => ({ value: k, label: k })) },
    { key: 'notes', label: 'Notes', kind: 'multiline' },
  ];

  const refresh = async () => {
    setBusy(true);
    setError('');
    try {
      setRecalls(v.id, await fetchRecalls(v));
    } catch (e) {
      setError(`${(e as Error).message}. Recall data needs a network connection.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Panel
        title={`Safety recalls${cached ? ` (${cached.items.length})` : ''}`}
        right={busy ? <ActivityIndicator color={C.accent} /> : <Button label={cached ? 'Refresh' : 'Check'} small onPress={refresh} />}>
        <Text style={T.dim}>
          {cached
            ? `NHTSA campaigns for ${v.year} ${v.make} ${v.model}, cached ${cached.fetchedAt.slice(0, 10)}. A dealer VIN check confirms which apply to this car.`
            : 'Looks up US NHTSA recall campaigns by make, model and year, then keeps them offline.'}
        </Text>
        {error ? <Text style={[T.dim, { color: C.red, marginTop: 6 }]}>{error}</Text> : null}
        {cached?.items.length === 0 ? <Empty text="No recall campaigns on record." /> : null}
        {cached?.items.map((r, i) => (
          <Row key={r.campaign + i} onPress={() => setOpen(open === r.campaign ? null : r.campaign)} last={i === cached.items.length - 1}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Badge text={r.campaign} color={C.red} />
                <Text style={[T.dim, { fontFamily: F.medium, fontSize: 12 }]}>{r.date}</Text>
              </View>
              <Text style={T.body}>{r.component}</Text>
              {open === r.campaign ? (
                <Text style={T.dim}>
                  {r.summary}
                  {'\n\n'}Risk: {r.consequence}
                  {'\n\n'}Remedy: {r.remedy}
                </Text>
              ) : null}
            </View>
          </Row>
        ))}
      </Panel>

      <ResearchPanel v={v} />

      <Panel title="Research shortcuts">
        <Text style={[T.dim, { marginBottom: 4 }]}>
          Searches pre-filled for this vehicle. They open in the browser; save the useful results below.
        </Text>
        {researchLinks(v).map((l, i, a) => (
          <Row key={l.url} onPress={() => Linking.openURL(l.url)} last={i === a.length - 1}>
            <Text style={[T.body, { flex: 1 }]}>{l.title}</Text>
            <Text style={{ color: C.accent }}>►</Text>
          </Row>
        ))}
      </Panel>

      <Panel title="Saved references" right={<Button label="Add" small onPress={() => setEditing({})} />}>
        {links.length === 0 ? <Empty text="No saved manuals, threads or videos." /> : null}
        {links.map((l, i) => (
          <Row key={l.id} onPress={() => Linking.openURL(l.url)} last={i === links.length - 1}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={T.body}>{l.title}</Text>
              <Text style={[T.dim, { fontFamily: F.medium, fontSize: 12 }]} numberOfLines={1}>
                {l.kind}  {l.url}
              </Text>
              {l.notes ? <Text style={T.dim}>{l.notes}</Text> : null}
            </View>
            <Button label="Edit" tone="secondary" small onPress={() => setEditing({ item: l })} />
          </Row>
        ))}
      </Panel>

      <FormModal
        visible={editing !== null}
        title={editing?.item ? 'Edit reference' : 'Save reference'}
        fields={fields}
        initial={editing?.item ? { ...editing.item } : { kind: 'forum', notes: '' }}
        onClose={() => setEditing(null)}
        onDelete={editing?.item ? () => (remove('links', editing.item!.id), setEditing(null)) : undefined}
        onSave={(x) => {
          upsert('links', { id: editing?.item?.id ?? uid(), vehicleId: v.id, ...x } as unknown as SavedLink);
          setEditing(null);
        }}
      />
    </>
  );
}

export function AssistantTab({ v }: { v: Vehicle }) {
  const all = useStore((s) => s.chat);
  const settings = useStore((s) => s.settings);
  const upsert = useStore((s) => s.upsert);
  const clearChat = useStore((s) => s.clearChat);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const messages = all.filter((m) => m.vehicleId === v.id);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setError('');
    setBusy(true);
    setDraft('');
    upsert('chat', { id: uid(), vehicleId: v.id, role: 'user', content: text, ts: new Date().toISOString() });
    try {
      const reply = await askAssistant({
        settings,
        apiKey: await getApiKey(),
        system: buildSystemPrompt(v, exportData()),
        turns: [...messages.map((m) => ({ role: m.role, content: m.content })), { role: 'user' as const, content: text }],
      });
      upsert('chat', { id: uid(), vehicleId: v.id, role: 'assistant', content: reply, ts: new Date().toISOString() });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title={`Mechanic · ${settings.aiProvider} ${settings.aiModel}`}
      right={messages.length ? <Button label="Clear" tone="secondary" small onPress={() => clearChat(v.id)} /> : undefined}>
      <Text style={T.dim}>
        Describe a symptom, noise or warning light. Each question is sent with this vehicle&apos;s record directly to your
        AI provider using your key.
      </Text>
      <View style={{ gap: 8, marginVertical: 10 }}>
        {messages.map((m) => (
          <View key={m.id} style={[styles.bubble, m.role === 'user' ? styles.user : styles.bot]}>
            <Text style={T.label}>{m.role === 'user' ? 'You' : 'Mechanic'}</Text>
            <Text style={T.body} selectable>
              {m.content}
            </Text>
          </View>
        ))}
        {busy ? (
          <View style={[styles.bubble, styles.bot, { flexDirection: 'row', gap: 10, alignItems: 'center' }]}>
            <ActivityIndicator color={C.accent} />
            <Text style={T.dim}>Diagnosing…</Text>
          </View>
        ) : null}
        {error ? (
          <View style={{ gap: 8 }}>
            <Text style={[T.dim, { color: C.red }]}>{error}</Text>
            <Button label="Open settings" tone="secondary" small onPress={() => router.push('/settings')} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : null}
      </View>
      <Input
        accessibilityLabel="Question for the mechanic"
        value={draft}
        onChangeText={setDraft}
        placeholder="e.g. Grinding noise from the front left when braking"
        multiline
      />
      <Button label="Ask" onPress={send} disabled={busy || !draft.trim()} style={{ marginTop: 8 }} />
    </Panel>
  );
}

const styles = StyleSheet.create({
  bubble: { padding: 10, borderRadius: 6, borderWidth: 1, gap: 4 },
  user: { backgroundColor: 'rgba(58,155,255,0.12)', borderColor: C.accentStrong, marginLeft: 28 },
  bot: { backgroundColor: 'rgba(0,0,0,0.35)', borderColor: C.border, marginRight: 28 },
});

import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { collectResearch, type ResearchKind } from '../../lib/proxy';
import { uid, useStore } from '../../lib/store';
import { C } from '../../lib/theme';
import type { LinkKind, Vehicle } from '../../lib/types';
import { Button, Empty, Input, Panel, Row, Segmented, T } from '../ui';

const FILTERS: { value: 'all' | ResearchKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Videos' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'web', label: 'Web' },
  { value: 'complaint', label: 'Complaints' },
];

const LINK_KIND: Record<ResearchKind, LinkKind> = { video: 'video', reddit: 'reddit', web: 'forum', complaint: 'other' };

/** Online collection through the data proxy; results are cached on the device for offline reading. */
export function ResearchPanel({ v }: { v: Vehicle }) {
  const cached = useStore((s) => s.research[v.id]);
  const proxyUrl = useStore((s) => s.settings.proxyUrl);
  const links = useStore((s) => s.links);
  const setResearch = useStore((s) => s.setResearch);
  const upsert = useStore((s) => s.upsert);
  const [filter, setFilter] = useState<'all' | ResearchKind>('all');
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const run = async () => {
    setBusy(true);
    setNote('');
    try {
      const { items, errors } = await collectResearch(v, topic.trim());
      setResearch(v.id, items);
      const failed = Object.entries(errors);
      if (failed.length) setNote(`Not collected: ${failed.map(([k, e]) => `${k} (${e})`).join('; ')}`);
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const items = (cached?.items ?? []).filter((i) => filter === 'all' || i.kind === filter);
  const counts = (k: ResearchKind) => (cached?.items ?? []).filter((i) => i.kind === k).length;
  const saved = new Set(links.filter((l) => l.vehicleId === v.id).map((l) => l.url));

  return (
    <Panel
      title={cached ? `Collected · ${cached.items.length}` : 'Collect from the web'}
      right={busy ? <ActivityIndicator color={C.accent} /> : proxyUrl ? <Button label={cached ? 'Refresh' : 'Collect'} small onPress={run} /> : undefined}>
      {!proxyUrl ? (
        <View style={{ gap: 10 }}>
          <Text style={T.dim}>Connect the Bay One data proxy to collect Reddit threads, YouTube videos, forum posts and owner complaints for this model.</Text>
          <Button label="Set up proxy" tone="secondary" small onPress={() => router.push('/settings')} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Input
            accessibilityLabel="Topic"
            value={topic}
            onChangeText={setTopic}
            placeholder="Optional topic, e.g. timing chain noise"
            returnKeyType="search"
            onSubmitEditing={run}
          />
          {cached ? (
            <Text style={T.small}>
              Saved {cached.fetchedAt.slice(0, 10)} · readable offline · {counts('video')} videos · {counts('reddit')} threads · {counts('web')} pages ·{' '}
              {counts('complaint')} complaints
            </Text>
          ) : null}
          {note ? <Text style={[T.dim, { color: C.yellow }]}>{note}</Text> : null}
          {cached ? <Segmented options={FILTERS} value={filter} onChange={setFilter} scroll /> : null}
          {cached && items.length === 0 ? <Empty text="Nothing in this category." /> : null}
          <View>
            {items.slice(0, 60).map((i, n) => (
              <Row key={i.url + n} onPress={() => Linking.openURL(i.url)} last={n === Math.min(items.length, 60) - 1}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={T.strong} numberOfLines={2}>
                    {i.title}
                  </Text>
                  <Text style={T.small} numberOfLines={1}>
                    {i.source}
                    {i.date ? ` · ${i.date}` : ''}
                    {i.kind === 'reddit' && i.score !== undefined ? ` · ${i.score} comments` : ''}
                  </Text>
                  {i.snippet ? (
                    <Text style={T.dim} numberOfLines={3}>
                      {i.snippet}
                    </Text>
                  ) : null}
                </View>
                {i.kind !== 'complaint' ? (
                  <Button
                    label={saved.has(i.url) ? 'Saved' : 'Save'}
                    tone="ghost"
                    small
                    disabled={saved.has(i.url)}
                    onPress={() => upsert('links', { id: uid(), vehicleId: v.id, title: i.title, url: i.url, kind: LINK_KIND[i.kind], notes: i.snippet ?? '' })}
                  />
                ) : null}
              </Row>
            ))}
          </View>
        </View>
      )}
    </Panel>
  );
}

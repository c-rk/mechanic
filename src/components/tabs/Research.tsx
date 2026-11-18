import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { aiResearch } from '../../lib/aiResearch';
import { saveFile } from '../../lib/files';
import { collectResearch, fetchPdf, readPage, type ResearchItem, type ResearchKind } from '../../lib/proxy';
import { getApiKey } from '../../lib/secrets';
import { uid, useStore } from '../../lib/store';
import { AREA, C, F } from '../../lib/theme';
import type { LinkKind, Vehicle } from '../../lib/types';
import { Button, Empty, GlassFill, Input, Panel, Row, T } from '../ui';

const SECTIONS: { title: string; kinds: ResearchKind[]; tint: string; limit: number }[] = [
  { title: 'Manuals & documents', kinds: ['manual'], tint: AREA.docs, limit: 20 },
  { title: 'Videos', kinds: ['video'], tint: AREA.drive, limit: 12 },
  { title: 'Forums & Reddit', kinds: ['forum', 'reddit'], tint: AREA.research, limit: 20 },
  { title: 'Articles & guides', kinds: ['wiki', 'web'], tint: AREA.specs, limit: 15 },
  { title: 'Owner complaints (NHTSA)', kinds: ['complaint'], tint: AREA.service, limit: 6 },
];

const LINK_KIND: Record<ResearchKind, LinkKind> = {
  manual: 'manual',
  video: 'video',
  reddit: 'reddit',
  forum: 'forum',
  web: 'blog',
  wiki: 'blog',
  complaint: 'other',
};

const dedupe = (xs: ResearchItem[]) => xs.filter((x, i) => xs.findIndex((y) => y.url === x.url && y.kind === x.kind) === i);

/**
 * Online collection for one vehicle: the Bay One relay (YouTube, Wikipedia, NHTSA, plus web and
 * Reddit when keys are set) and, with a Claude key, Claude's web search for manuals and threads.
 * Results are cached on the device for offline reading.
 */
export function ResearchPanel({ v }: { v: Vehicle }) {
  const cached = useStore((s) => s.research[v.id]);
  const settings = useStore((s) => s.settings);
  const links = useStore((s) => s.links);
  const setResearch = useStore((s) => s.setResearch);
  const upsert = useStore((s) => s.upsert);
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState<string>('');
  const [notes, setNotes] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [working, setWorking] = useState<string | null>(null);
  const [reader, setReader] = useState<ResearchItem | null>(null);
  const started = useRef(false);

  const run = async (t = topic.trim()) => {
    const out: string[] = [];
    setNotes([]);
    setBusy('Collecting videos, articles and owner reports…');
    const relay = await collectResearch(v, t).catch((e) => {
      out.push((e as Error).message);
      return { items: [] as ResearchItem[], errors: {} as Record<string, string> };
    });
    let items = relay.items;
    const key = settings.aiProvider === 'anthropic' ? await getApiKey() : '';
    if (key) {
      setBusy('Searching the web for manuals, forum threads and guides with Claude…');
      try {
        items = [...(await aiResearch(v, settings, key, t)), ...items];
      } catch (e) {
        out.push(`Claude web search: ${(e as Error).message}`);
      }
    } else {
      out.push('Manuals and forum threads are found with Claude web search: add a Claude API key in Setup to include them.');
    }
    // Keep earlier offline copies when refreshing.
    const prev = new Map((useStore.getState().research[v.id]?.items ?? []).map((x) => [x.url, x.offlineText]));
    setResearch(v.id, dedupe(items).map((x) => (prev.get(x.url) ? { ...x, offlineText: prev.get(x.url) } : x)));
    setNotes(out);
    setBusy('');
  };

  useEffect(() => {
    // Fill the section the first time it is opened for this vehicle.
    if (started.current || cached) return;
    started.current = true;
    const t = setTimeout(() => run(''), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cached]);

  const saved = new Set(links.filter((l) => l.vehicleId === v.id).map((l) => l.url));
  const all = cached?.items ?? [];

  const updateItem = (url: string, patch: Partial<ResearchItem>) => {
    const cur = useStore.getState().research[v.id]?.items ?? [];
    setResearch(v.id, cur.map((x) => (x.url === url ? { ...x, ...patch } : x)));
  };

  const savePdf = async (i: ResearchItem) => {
    setWorking(i.url);
    try {
      if (Platform.OS !== 'web') {
        await Linking.openURL(i.url);
        return;
      }
      const { blob, name } = await fetchPdf(i.url);
      const fileRef = await saveFile({ uri: i.url, name, mimeType: 'application/pdf', size: blob.size, file: blob });
      upsert('docs', {
        id: uid(),
        vehicleId: v.id,
        name: i.title || name,
        category: 'manual',
        mimeType: 'application/pdf',
        size: blob.size,
        fileRef,
        addedAt: new Date().toISOString(),
      });
      setNotes([`Saved "${i.title}" to Documents → Manual (${(blob.size / 1048576).toFixed(1)} MB), available offline.`]);
    } catch (e) {
      setNotes([`${(e as Error).message}. Opening the page instead.`]);
      Linking.openURL(i.url);
    } finally {
      setWorking(null);
    }
  };

  const readOffline = async (i: ResearchItem) => {
    if (i.offlineText) return setReader(i);
    setWorking(i.url);
    try {
      const page = await readPage(i.url);
      if (page.text.length < 200) throw new Error('This page has no readable text');
      updateItem(i.url, { offlineText: page.text });
      setReader({ ...i, offlineText: page.text });
    } catch (e) {
      setNotes([`${(e as Error).message}. Opening the page instead.`]);
      Linking.openURL(i.url);
    } finally {
      setWorking(null);
    }
  };

  return (
    <>
      <Panel
        tint={AREA.research}
        title="Collected for this vehicle"
        right={busy ? <ActivityIndicator color={C.accent} /> : <Button label={cached ? 'Refresh' : 'Collect'} small onPress={() => run()} />}>
        <View style={{ gap: 10 }}>
          <Input accessibilityLabel="Topic" value={topic} onChangeText={setTopic} placeholder="Optional topic, e.g. timing chain noise" returnKeyType="search" onSubmitEditing={() => run()} />
          {busy ? <Text style={T.dim}>{busy}</Text> : null}
          {cached && !busy ? (
            <Text style={T.small}>
              Updated {cached.fetchedAt.slice(0, 10)} · {all.length} items · saved on this device
            </Text>
          ) : null}
          {notes.map((n) => (
            <Text key={n} style={[T.dim, { color: C.yellow }]}>
              {n}
            </Text>
          ))}
          {!cached && !busy ? <Empty text="Nothing collected yet." /> : null}
        </View>
      </Panel>

      {SECTIONS.map((sec) => {
        const items = all.filter((i) => sec.kinds.includes(i.kind));
        if (!items.length) return null;
        const open = expanded[sec.title];
        const shown = open ? items : items.slice(0, sec.limit);
        return (
          <Panel key={sec.title} tint={sec.tint} title={`${sec.title} · ${items.length}`}>
            {shown.map((i, n) => (
              <Row key={i.url + n} onPress={() => Linking.openURL(i.url)} last={n === shown.length - 1}>
                {i.kind === 'video' && i.thumbnail ? <Image source={{ uri: i.thumbnail }} style={styles.thumb} /> : null}
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={T.strong} numberOfLines={2}>
                    {i.title}
                  </Text>
                  <Text style={T.small} numberOfLines={1}>
                    {i.kind === 'reddit' ? 'Reddit · ' : ''}
                    {i.source}
                    {i.date ? ` · ${i.date}` : ''}
                  </Text>
                  {i.snippet && i.kind !== 'video' ? (
                    <Text style={T.dim} numberOfLines={3}>
                      {i.snippet}
                    </Text>
                  ) : null}
                  {i.kind !== 'complaint' ? (
                    <View style={styles.actions}>
                      {i.kind === 'manual' ? (
                        <Button label={working === i.url ? 'Saving…' : 'Save PDF'} tone="secondary" small disabled={working !== null} onPress={() => savePdf(i)} />
                      ) : null}
                      {['forum', 'reddit', 'web', 'wiki'].includes(i.kind) ? (
                        <Button
                          label={i.offlineText ? 'Read' : working === i.url ? 'Fetching…' : 'Read offline'}
                          tone="secondary"
                          small
                          disabled={working !== null}
                          onPress={() => readOffline(i)}
                        />
                      ) : null}
                      <Button
                        label={saved.has(i.url) ? 'Saved' : 'Save link'}
                        tone="ghost"
                        small
                        disabled={saved.has(i.url)}
                        onPress={() => upsert('links', { id: uid(), vehicleId: v.id, title: i.title, url: i.url, kind: LINK_KIND[i.kind], notes: i.snippet ?? '' })}
                      />
                    </View>
                  ) : null}
                </View>
              </Row>
            ))}
            {items.length > sec.limit ? (
              <Button label={open ? 'Show fewer' : `Show all ${items.length}`} tone="ghost" small onPress={() => setExpanded((e) => ({ ...e, [sec.title]: !open }))} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
            ) : null}
          </Panel>
        );
      })}

      {cached && !all.some((i) => i.kind === 'manual') && !busy ? (
        <Panel tint={AREA.docs} title="Manuals & documents">
          <Text style={T.dim}>No manuals found yet. With a Claude key in Setup, Collect also searches the web for owner&apos;s and service manuals.</Text>
          <Button label="Open Setup" tone="secondary" small onPress={() => router.push('/settings')} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
        </Panel>
      ) : null}

      <Reader item={reader} onClose={() => setReader(null)} />
    </>
  );
}

function Reader({ item, onClose }: { item: ResearchItem | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={item !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.reader, { paddingTop: insets.top + 12 }]}>
        <GlassFill strong />
        <View style={styles.readerBar}>
          <View style={{ flex: 1 }}>
            <Text style={T.small} numberOfLines={1}>
              {item?.source} · saved offline
            </Text>
            <Text style={[T.strong, { fontSize: 17 }]} numberOfLines={2}>
              {item?.title}
            </Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close reader" style={styles.close}>
            <Text style={{ color: C.text, fontSize: 18 }}>✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
          <Text style={styles.readerText} selectable>
            {item?.offlineText}
          </Text>
          {item ? <Button label="Open original page" tone="ghost" small onPress={() => Linking.openURL(item.url)} style={{ alignSelf: 'flex-start', marginTop: 16 }} /> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 104, height: 58, borderRadius: 10, backgroundColor: C.surface2, alignSelf: 'flex-start', marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  reader: { flex: 1, overflow: 'hidden', backgroundColor: C.bg },
  readerBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderStrong },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface3 },
  readerText: { color: C.text, fontFamily: F.regular, fontSize: 15.5, lineHeight: 24, maxWidth: 680 },
});

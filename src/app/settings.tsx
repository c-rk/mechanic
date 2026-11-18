import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Shell } from '../components/Shell';
import { Button, Input, Panel, Segmented, T } from '../components/ui';
import { DEFAULT_MODELS } from '../lib/ai';
import { PickedFile, readText, shareText } from '../lib/files';
import { DEFAULT_PROXY, proxyHealth } from '../lib/proxy';
import { scheduleOdometerReminder } from '../lib/reminders';
import { getApiKey, setApiKey } from '../lib/secrets';
import { exportData, today, useStore } from '../lib/store';
import { C, F } from '../lib/theme';
import type { AiProvider } from '../lib/types';

const PROVIDERS: { value: AiProvider; label: string }[] = [
  { value: 'anthropic', label: 'Claude' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'custom', label: 'Custom' },
];

export default function SettingsScreen() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const importData = useStore((s) => s.importData);
  const [key, setKey] = useState('');
  const [keyNote, setKeyNote] = useState('');
  const [backupNote, setBackupNote] = useState('');
  const [proxyNote, setProxyNote] = useState('');
  const [reminderNote, setReminderNote] = useState('');

  const testProxy = async () => {
    setProxyNote('Checking…');
    try {
      const h = await proxyHealth();
      const on = Object.entries(h.features).filter(([, v]) => v).map(([k]) => k);
      const off = Object.entries(h.features).filter(([, v]) => !v).map(([k]) => k);
      setProxyNote(`Connected. Available: ${on.join(', ')}.${off.length ? ` Not configured on the worker: ${off.join(', ')}.` : ''}`);
    } catch (e) {
      setProxyNote((e as Error).message);
    }
  };

  const setReminder = async (days: number) => {
    setSettings({ odoReminderDays: days });
    setReminderNote(await scheduleOdometerReminder(days).catch((e) => (e as Error).message));
  };

  useEffect(() => {
    getApiKey().then((k) => setKeyNote(k ? `A key ending in ${k.slice(-4)} is stored.` : 'No key stored.'));
  }, []);

  const saveKey = async () => {
    await setApiKey(key.trim());
    setKeyNote(key.trim() ? `A key ending in ${key.trim().slice(-4)} is stored.` : 'Key removed.');
    setKey('');
  };

  const restore = async () => {
    setBackupNote('');
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled) return;
    try {
      const data = JSON.parse(await readText(res.assets[0] as PickedFile));
      if (!Array.isArray(data.vehicles)) throw new Error('not a Bay One backup');
      importData(data);
      setBackupNote(`Restored ${data.vehicles.length} vehicle(s). Document files are not part of a backup.`);
    } catch (e) {
      setBackupNote(`Restore failed: ${(e as Error).message}`);
    }
  };

  return (
    <Shell title="Setup" back>
      <Panel title="Units">
        <View style={{ gap: 12 }}>
          <View style={{ gap: 5 }}>
            <Text style={T.label}>Distance</Text>
            <Segmented options={[{ value: 'km', label: 'Kilometres' }, { value: 'mi', label: 'Miles' }]} value={settings.distanceUnit} onChange={(v) => setSettings({ distanceUnit: v })} />
          </View>
          <View style={{ gap: 5 }}>
            <Text style={T.label}>Fuel volume</Text>
            <Segmented options={[{ value: 'L', label: 'Litres' }, { value: 'gal', label: 'Gallons' }]} value={settings.volumeUnit} onChange={(v) => setSettings({ volumeUnit: v })} />
          </View>
          <View style={{ gap: 5 }}>
            <Text style={T.label}>Currency symbol</Text>
            <Input accessibilityLabel="Currency symbol" value={settings.currency} onChangeText={(t) => setSettings({ currency: t })} maxLength={4} style={{ width: 90, fontFamily: F.medium }} />
          </View>
          <Text style={T.dim}>Changing units relabels existing figures; it does not convert them.</Text>
        </View>
      </Panel>

      <Panel title="Mechanic AI (your own key)">
        <View style={{ gap: 12 }}>
          <View style={{ gap: 5 }}>
            <Text style={T.label}>Provider</Text>
            <Segmented options={PROVIDERS} value={settings.aiProvider} onChange={(p) => setSettings({ aiProvider: p, aiModel: DEFAULT_MODELS[p] })} />
          </View>
          <View style={{ gap: 5 }}>
            <Text style={T.label}>Model</Text>
            <Input accessibilityLabel="Model" value={settings.aiModel} onChangeText={(t) => setSettings({ aiModel: t.trim() })} autoCapitalize="none" placeholder="Model identifier" style={{ fontFamily: F.medium }} />
          </View>
          {settings.aiProvider === 'custom' ? (
            <View style={{ gap: 5 }}>
              <Text style={T.label}>Base URL (OpenAI-compatible)</Text>
              <Input accessibilityLabel="Base URL" value={settings.aiBaseUrl} onChangeText={(t) => setSettings({ aiBaseUrl: t.trim() })} autoCapitalize="none" placeholder="http://localhost:11434/v1" style={{ fontFamily: F.medium }} />
            </View>
          ) : null}
          <View style={{ gap: 5 }}>
            <Text style={T.label}>API key</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Input accessibilityLabel="API key" value={key} onChangeText={setKey} secureTextEntry autoCapitalize="none" placeholder="Paste key" style={{ flex: 1, fontFamily: F.medium }} />
              <Button label={key.trim() ? 'Store' : 'Remove'} small tone={key.trim() ? "primary" : "secondary"} onPress={saveKey} />
            </View>
            <Text style={[T.dim, { color: C.accent }]}>{keyNote}</Text>
          </View>
          <Text style={T.dim}>
            The key is kept in the device keychain (in browser storage on web) and is sent only to the provider you
            selected. It is excluded from backups.
          </Text>
        </View>
      </Panel>

      <Panel title="Odometer reminders">
        <Text style={T.dim}>Asks for a reading so service estimates stay accurate between fill-ups and recorded drives.</Text>
        <View style={{ marginTop: 10 }}>
          <Segmented
            options={[
              { value: '0', label: 'Off' },
              { value: '7', label: 'Weekly' },
              { value: '14', label: '2 weeks' },
              { value: '30', label: 'Monthly' },
            ]}
            value={String(settings.odoReminderDays)}
            onChange={(d) => setReminder(Number(d))}
          />
        </View>
        {reminderNote ? <Text style={[T.dim, { marginTop: 8 }]}>{reminderNote}</Text> : null}
      </Panel>

      <Panel title="Data proxy (Cloudflare Worker)">
        <View style={{ gap: 12 }}>
          <Text style={T.dim}>
            Collects YouTube videos, Wikipedia, NHTSA owner complaints and shop prices, and downloads manual PDFs and pages for
            offline reading. Only make, model, year and the URLs you open are sent; nothing is stored. Leave the URL empty to
            use the Bay One relay.
          </Text>
          <View style={{ gap: 6 }}>
            <Text style={T.label}>Worker URL</Text>
            <Input accessibilityLabel="Worker URL" value={settings.proxyUrl} onChangeText={(t) => setSettings({ proxyUrl: t.trim() })} autoCapitalize="none" placeholder={DEFAULT_PROXY} />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={T.label}>App token</Text>
            <Input accessibilityLabel="App token" value={settings.proxyToken} onChangeText={(t) => setSettings({ proxyToken: t.trim() })} autoCapitalize="none" secureTextEntry placeholder="Value of the worker's APP_TOKEN secret" />
          </View>
          <Button label="Test connection" tone="secondary" small onPress={testProxy} style={{ alignSelf: 'flex-start' }} />
          {proxyNote ? <Text style={T.dim}>{proxyNote}</Text> : null}
        </View>
      </Panel>

      <Panel title="Backup">
        <Text style={T.dim}>
          All records live on this device. Export a JSON backup to move them or keep a copy; stored document files and
          3D models are not included.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Button label="Export" small onPress={() => shareText(`bay-one-backup-${today()}.json`, JSON.stringify(exportData(), null, 2)).catch((e) => setBackupNote((e as Error).message))} />
          <Button label="Restore" tone="secondary" small onPress={restore} />
        </View>
        {backupNote ? <Text style={[T.dim, { color: C.accent, marginTop: 8 }]}>{backupNote}</Text> : null}
      </Panel>
    </Shell>
  );
}

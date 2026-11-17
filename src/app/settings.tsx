import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Shell } from '../components/Shell';
import { GelButton, Input, Panel, Segmented, T } from '../components/ui';
import { DEFAULT_MODELS } from '../lib/ai';
import { PickedFile, readText, shareText } from '../lib/files';
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
            <Input accessibilityLabel="Currency symbol" value={settings.currency} onChangeText={(t) => setSettings({ currency: t })} maxLength={4} style={{ width: 90, fontFamily: F.mono }} />
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
            <Input accessibilityLabel="Model" value={settings.aiModel} onChangeText={(t) => setSettings({ aiModel: t.trim() })} autoCapitalize="none" placeholder="Model identifier" style={{ fontFamily: F.mono }} />
          </View>
          {settings.aiProvider === 'custom' ? (
            <View style={{ gap: 5 }}>
              <Text style={T.label}>Base URL (OpenAI-compatible)</Text>
              <Input accessibilityLabel="Base URL" value={settings.aiBaseUrl} onChangeText={(t) => setSettings({ aiBaseUrl: t.trim() })} autoCapitalize="none" placeholder="http://localhost:11434/v1" style={{ fontFamily: F.mono }} />
            </View>
          ) : null}
          <View style={{ gap: 5 }}>
            <Text style={T.label}>API key</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Input accessibilityLabel="API key" value={key} onChangeText={setKey} secureTextEntry autoCapitalize="none" placeholder="Paste key" style={{ flex: 1, fontFamily: F.mono }} />
              <GelButton label={key.trim() ? 'Store' : 'Remove'} small tone={key.trim() ? 'blue' : 'steel'} onPress={saveKey} />
            </View>
            <Text style={[T.dim, { color: C.amber }]}>{keyNote}</Text>
          </View>
          <Text style={T.dim}>
            The key is kept in the device keychain (in browser storage on web) and is sent only to the provider you
            selected. It is excluded from backups.
          </Text>
        </View>
      </Panel>

      <Panel title="Backup">
        <Text style={T.dim}>
          All records live on this device. Export a JSON backup to move them or keep a copy; stored document files and
          3D models are not included.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <GelButton label="Export" small onPress={() => shareText(`bay-one-backup-${today()}.json`, JSON.stringify(exportData(), null, 2)).catch((e) => setBackupNote((e as Error).message))} />
          <GelButton label="Restore" tone="steel" small onPress={restore} />
        </View>
        {backupNote ? <Text style={[T.dim, { color: C.amber, marginTop: 8 }]}>{backupNote}</Text> : null}
      </Panel>
    </Shell>
  );
}

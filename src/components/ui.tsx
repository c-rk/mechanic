import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';

import { C, F } from '../lib/theme';

export const T = StyleSheet.create({
  body: { color: C.text, fontFamily: F.body, fontSize: 15, lineHeight: 21 },
  dim: { color: C.dim, fontFamily: F.body, fontSize: 13, lineHeight: 18 },
  label: { color: C.dim, fontFamily: F.display, fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { color: C.text, fontFamily: F.display, fontSize: 17, letterSpacing: 0.5 },
  num: { color: C.text, fontFamily: F.monoBold, fontSize: 16 },
});

/** Bevelled metal panel with a chrome caption bar. */
export function Panel({
  title,
  right,
  children,
  style,
  pad = true,
}: {
  title?: string;
  right?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  pad?: boolean;
}) {
  return (
    <View style={[styles.panel, style]}>
      {title ? (
        <LinearGradient colors={[C.chromeTop, C.chromeBottom]} style={styles.caption}>
          <Text style={styles.captionText} numberOfLines={1}>
            {title}
          </Text>
          {right}
        </LinearGradient>
      ) : null}
      <LinearGradient colors={[C.panelTop, C.panelBottom]} style={pad ? styles.panelBody : undefined}>
        {children}
      </LinearGradient>
    </View>
  );
}

type Tone = 'blue' | 'steel' | 'red';
const TONES: Record<Tone, [string, string, string]> = {
  blue: ['#6cb8ff', '#1f7ae6', '#0f4fb0'],
  steel: ['#7c8a9c', '#4a5665', '#2d3540'],
  red: ['#ff8c80', '#d93a2c', '#8f1a10'],
};

/** Glossy "gel" push button. */
export function GelButton({
  label,
  onPress,
  tone = 'blue',
  small,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: Tone;
  small?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.gel, { opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, style]}>
      <LinearGradient colors={TONES[tone]} locations={[0, 0.5, 1]} style={[styles.gelFill, small && styles.gelSmall]}>
        <LinearGradient colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.04)']} style={styles.gelGloss} />
        <Text style={[styles.gelText, small && { fontSize: 9 }]} numberOfLines={1}>
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

/** Amber LCD readout for a primary figure. */
export function Lcd({ label, value, unit, color = C.amber, flex }: { label: string; value: string; unit?: string; color?: string; flex?: number }) {
  return (
    <View style={[styles.lcd, flex !== undefined && { flex }]}>
      <Text style={T.label}>{label}</Text>
      <View style={styles.lcdRow}>
        <Text style={[styles.lcdValue, { color, textShadowColor: color }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {unit ? <Text style={[styles.lcdUnit, { color }]}>{unit}</Text> : null}
      </View>
    </View>
  );
}

export function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <View style={[styles.led, { backgroundColor: color, shadowColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
  scroll,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
  scroll?: boolean;
}) {
  const items = options.map((o) => {
    const on = o.value === value;
    return (
      <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: on }}>
        <LinearGradient colors={on ? ['#6cb8ff', '#0f4fb0'] : [C.chromeTop, C.chromeBottom]} style={styles.seg}>
          <Text style={[styles.segText, on && { color: '#fff' }]}>{o.label}</Text>
        </LinearGradient>
      </Pressable>
    );
  });
  return scroll ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segRow}>
      {items}
    </ScrollView>
  ) : (
    <View style={[styles.segRow, { flexWrap: 'wrap' }]}>{items}</View>
  );
}

export function Row({ children, onPress, last }: { children: ReactNode; onPress?: () => void; last?: boolean }) {
  const content = <View style={[styles.row, last && { borderBottomWidth: 0 }]}>{children}</View>;
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { backgroundColor: 'rgba(255,255,255,0.05)' }}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={[T.dim, { paddingVertical: 14, textAlign: 'center' }]}>{text}</Text>;
}

export function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={C.faint} {...props} style={[styles.input, props.multiline && styles.inputMulti, props.style]} />;
}

export interface FieldDef {
  key: string;
  label: string;
  kind?: 'text' | 'number' | 'date' | 'multiline' | 'select' | 'toggle';
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}

type Values = Record<string, string | number | boolean | undefined>;

/**
 * Generic record editor. Numbers are edited as text and parsed on save;
 * an empty number field is returned as undefined.
 */
export function FormModal(props: FormProps & { visible: boolean }) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      {/* Mounted per opening, so the draft is initialised from `initial` each time. */}
      {props.visible ? <FormBody {...props} /> : null}
    </Modal>
  );
}

interface FormProps {
  title: string;
  fields: FieldDef[];
  initial: Values;
  onSave: (values: Values) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function FormBody({
  title,
  fields,
  initial,
  onSave,
  onDelete,
  onClose,
}: FormProps) {
  const [draft, setDraft] = useState<Record<string, string | boolean>>(() => {
    const d: Record<string, string | boolean> = {};
    for (const f of fields) {
      const v = initial[f.key];
      d[f.key] = f.kind === 'toggle' ? Boolean(v) : v === undefined || v === null ? '' : String(v);
    }
    return d;
  });
  const [error, setError] = useState('');

  const save = () => {
    const out: Values = {};
    for (const f of fields) {
      const raw = draft[f.key];
      if (f.kind === 'toggle') {
        out[f.key] = Boolean(raw);
        continue;
      }
      const text = String(raw ?? '').trim();
      if (f.required && !text) return setError(`${f.label} is required`);
      if (f.kind === 'number') {
        if (!text) {
          out[f.key] = undefined;
          continue;
        }
        const n = Number(text.replace(',', '.'));
        if (!Number.isFinite(n) || n < 0) return setError(`${f.label} must be a positive number`);
        out[f.key] = n;
      } else if (f.kind === 'date') {
        if (text && !/^\d{4}-\d{2}-\d{2}$/.test(text)) return setError(`${f.label} must be YYYY-MM-DD`);
        out[f.key] = text || undefined;
      } else {
        out[f.key] = text;
      }
    }
    onSave(out);
  };

  return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.scrim}>
        <View style={styles.dialog}>
          <Panel title={title} pad={false}>
            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: 14, gap: 12 }} keyboardShouldPersistTaps="handled">
              {fields.map((f) => (
                <View key={f.key} style={{ gap: 5 }}>
                  <Text style={T.label}>{f.label}</Text>
                  {f.kind === 'select' ? (
                    <Segmented options={f.options ?? []} value={String(draft[f.key] ?? '')} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
                  ) : f.kind === 'toggle' ? (
                    <Segmented
                      options={[
                        { value: 'yes', label: 'Yes' },
                        { value: 'no', label: 'No' },
                      ]}
                      value={draft[f.key] ? 'yes' : 'no'}
                      onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v === 'yes' }))}
                    />
                  ) : (
                    <Input
                      accessibilityLabel={f.label}
                      value={String(draft[f.key] ?? '')}
                      onChangeText={(t) => setDraft((d) => ({ ...d, [f.key]: t }))}
                      placeholder={f.placeholder ?? (f.kind === 'date' ? 'YYYY-MM-DD' : '')}
                      keyboardType={f.kind === 'number' ? 'decimal-pad' : 'default'}
                      multiline={f.kind === 'multiline'}
                      autoCapitalize="none"
                      style={f.kind === 'number' || f.kind === 'date' ? { fontFamily: F.mono } : undefined}
                    />
                  )}
                </View>
              ))}
              {error ? <Text style={[T.dim, { color: C.red }]}>{error}</Text> : null}
            </ScrollView>
            <View style={styles.dialogButtons}>
              {onDelete ? <GelButton label="Delete" tone="red" small onPress={onDelete} /> : null}
              <View style={{ flex: 1 }} />
              <GelButton label="Cancel" tone="steel" small onPress={onClose} />
              <GelButton label="Save" small onPress={save} />
            </View>
          </Panel>
        </View>
      </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.edgeDark,
    borderTopColor: C.edgeLight,
    borderLeftColor: C.line,
    overflow: 'hidden',
    backgroundColor: C.panelBottom,
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    minHeight: 30,
    borderBottomWidth: 1,
    borderBottomColor: C.edgeDark,
    gap: 8,
  },
  captionText: { flex: 1, color: '#f2f5f8', fontFamily: F.display, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase' },
  panelBody: { padding: 12 },
  gel: { borderRadius: 999, borderWidth: 1, borderColor: C.edgeDark, overflow: 'hidden' },
  gelFill: { minHeight: 42, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  gelSmall: { minHeight: 30, paddingHorizontal: 12 },
  gelGloss: { position: 'absolute', top: 1, left: 6, right: 6, height: '46%', borderRadius: 999 },
  gelText: { color: '#fff', fontFamily: F.display, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  lcd: {
    backgroundColor: C.lcdBg,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#000',
    borderBottomColor: C.line,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 2,
    minWidth: 0,
  },
  lcdRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  lcdValue: { fontFamily: F.monoBold, fontSize: 22, flexShrink: 1, textShadowRadius: 7, textShadowOffset: { width: 0, height: 0 } },
  lcdUnit: { fontFamily: F.mono, fontSize: 11, opacity: 0.8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.35)' },
  badgeText: { fontFamily: F.display, fontSize: 8, letterSpacing: 1.2, textTransform: 'uppercase' },
  led: { width: 7, height: 7, borderRadius: 4, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  segRow: { flexDirection: 'row', gap: 6 },
  seg: { paddingHorizontal: 12, minHeight: 32, justifyContent: 'center', borderRadius: 5, borderWidth: 1, borderColor: C.edgeDark },
  segText: { color: '#d5dce5', fontFamily: F.display, fontSize: 9, letterSpacing: 1.1, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  input: {
    backgroundColor: C.inputBg,
    color: C.text,
    borderWidth: 1,
    borderColor: '#000',
    borderBottomColor: C.line,
    borderRadius: 5,
    paddingHorizontal: 10,
    minHeight: 40,
    fontSize: 15,
    fontFamily: F.body,
  },
  inputMulti: { minHeight: 84, paddingVertical: 8, textAlignVertical: 'top' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  dialog: { width: '100%', maxWidth: 480 },
  dialogButtons: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: C.edgeDark, alignItems: 'center' },
});

import { ReactNode, useState } from 'react';
import {
  Animated,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, F, NUM } from '../lib/theme';

export const T = StyleSheet.create({
  body: { color: C.text, fontFamily: F.regular, fontSize: 15, lineHeight: 21 },
  strong: { color: C.text, fontFamily: F.semibold, fontSize: 15, lineHeight: 21 },
  dim: { color: C.dim, fontFamily: F.regular, fontSize: 13, lineHeight: 18 },
  small: { color: C.faint, fontFamily: F.medium, fontSize: 12, lineHeight: 16, ...NUM },
  label: { color: C.faint, fontFamily: F.semibold, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase' },
  title: { color: C.text, fontFamily: F.bold, fontSize: 22, letterSpacing: -0.4 },
  num: { color: C.text, fontFamily: F.semibold, fontSize: 15, ...NUM },
});

/** Content card with an optional header row. */
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
        <View style={[styles.header, !pad && { paddingBottom: 12 }]}>
          <Text style={styles.headerText} numberOfLines={1}>
            {title}
          </Text>
          {right}
        </View>
      ) : null}
      <View style={pad ? styles.panelBody : undefined}>{children}</View>
    </View>
  );
}

type Tone = 'primary' | 'secondary' | 'danger' | 'ghost';
const TONES: Record<Tone, { bg: string; fg: string }> = {
  primary: { bg: C.accent, fg: C.onAccent },
  secondary: { bg: C.surface3, fg: C.text },
  danger: { bg: C.redSoft, fg: C.red },
  ghost: { bg: 'transparent', fg: C.dim },
};

/** Button with a spring press response. */
export function Button({
  label,
  onPress,
  tone = 'primary',
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
  const [scale] = useState(() => new Animated.Value(1));
  const to = (v: number) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  const t = TONES[tone];
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => to(0.96)}
      onPressOut={() => to(1)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={style}>
      <Animated.View
        style={[
          styles.button,
          small && styles.buttonSmall,
          { backgroundColor: t.bg, opacity: disabled ? 0.4 : 1, transform: [{ scale }] },
        ]}>
        <Text style={[styles.buttonText, small && { fontSize: 13 }, { color: t.fg }]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** Key figure: large tabular number with unit and label. */
export function Stat({
  label,
  value,
  unit,
  color = C.text,
  flex,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
  flex?: number;
  hint?: string;
}) {
  return (
    <View style={[styles.stat, flex !== undefined && { flex }]}>
      <Text style={T.label}>{label}</Text>
      <View style={styles.statRow}>
        <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
      {hint ? (
        <Text style={T.small} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '1f' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
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
      <Pressable
        key={o.value}
        onPress={() => onChange(o.value)}
        accessibilityRole="tab"
        accessibilityLabel={o.label}
        accessibilityState={{ selected: on }}
        style={[styles.chip, on && styles.chipOn]}>
        <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
      </Pressable>
    );
  });
  return scroll ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {items}
    </ScrollView>
  ) : (
    <View style={[styles.chipRow, { flexWrap: 'wrap' }]}>{items}</View>
  );
}

export function Row({ children, onPress, last }: { children: ReactNode; onPress?: () => void; last?: boolean }) {
  const content = <View style={[styles.row, last && { borderBottomWidth: 0 }]}>{children}</View>;
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={[T.dim, { paddingVertical: 16, textAlign: 'center' }]}>{text}</Text>;
}

export function Input(props: React.ComponentProps<typeof TextInput>) {
  const [focus, setFocus] = useState(false);
  return (
    <TextInput
      placeholderTextColor={C.faint}
      {...props}
      onFocus={(e) => (setFocus(true), props.onFocus?.(e))}
      onBlur={(e) => (setFocus(false), props.onBlur?.(e))}
      style={[styles.input, props.multiline && styles.inputMulti, focus && { borderColor: C.accent }, props.style]}
    />
  );
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

interface FormProps {
  title: string;
  fields: FieldDef[];
  initial: Values;
  onSave: (values: Values) => void;
  onDelete?: () => void;
  onClose: () => void;
}

/**
 * Generic record editor shown as a bottom sheet. Numbers are edited as text and parsed on save;
 * an empty number field is returned as undefined.
 */
export function FormModal(props: FormProps & { visible: boolean }) {
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      {/* Mounted per opening, so the draft is initialised from `initial` each time. */}
      {props.visible ? <FormBody {...props} /> : null}
    </Modal>
  );
}

function FormBody({ title, fields, initial, onSave, onDelete, onClose }: FormProps) {
  const insets = useSafeAreaInsets();
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
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 14 }]}>
        <View style={styles.grabber} />
        <Text style={[T.title, { fontSize: 19, paddingHorizontal: 20 }]}>{title}</Text>
        <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
          {fields.map((f) => (
            <View key={f.key} style={{ gap: 6 }}>
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
                  style={f.kind === 'number' || f.kind === 'date' ? NUM : undefined}
                />
              )}
            </View>
          ))}
          {error ? <Text style={[T.dim, { color: C.red }]}>{error}</Text> : null}
        </ScrollView>
        <View style={styles.sheetButtons}>
          {onDelete ? <Button label="Delete" tone="danger" small onPress={onDelete} /> : null}
          <View style={{ flex: 1 }} />
          <Button label="Cancel" tone="ghost" small onPress={onClose} />
          <Button label="Save" small onPress={save} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, gap: 10 },
  headerText: { flex: 1, color: C.text, fontFamily: F.semibold, fontSize: 15, letterSpacing: -0.1 },
  panelBody: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 },
  button: { minHeight: 48, paddingHorizontal: 20, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonSmall: { minHeight: 34, paddingHorizontal: 14, borderRadius: 10 },
  buttonText: { fontFamily: F.semibold, fontSize: 15, letterSpacing: -0.1 },
  stat: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, gap: 4, minWidth: 0 },
  statRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  statValue: { fontFamily: F.bold, fontSize: 26, letterSpacing: -0.6, flexShrink: 1, ...NUM },
  statUnit: { color: C.dim, fontFamily: F.medium, fontSize: 13 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontFamily: F.semibold, fontSize: 11, textTransform: 'capitalize' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', borderRadius: 999, backgroundColor: C.surface2 },
  chipOn: { backgroundColor: C.text },
  chipText: { color: C.dim, fontFamily: F.semibold, fontSize: 13, textTransform: 'capitalize' },
  chipTextOn: { color: C.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderStrong },
  input: {
    backgroundColor: C.surface2,
    color: C.text,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 46,
    fontSize: 15,
    fontFamily: F.regular,
  },
  inputMulti: { minHeight: 92, paddingVertical: 12, textAlignVertical: 'top' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: C.border,
    paddingTop: 10,
  },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.surface3, alignSelf: 'center', marginBottom: 14 },
  sheetButtons: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 8, alignItems: 'center' },
});

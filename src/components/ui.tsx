import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
  dim: { color: C.dim, fontFamily: F.regular, fontSize: 13, lineHeight: 19 },
  small: { color: C.faint, fontFamily: F.regular, fontSize: 12, lineHeight: 16, ...NUM },
  label: { color: C.faint, fontFamily: F.mono, fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { color: C.text, fontFamily: F.semibold, fontSize: 24, letterSpacing: -0.6 },
  num: { color: C.text, fontFamily: F.semibold, fontSize: 16, ...NUM },
});

/** Hairline highlight along the top edge of a glass surface: light catching the bevel. */
export function Bevel({ radius = 18 }: { radius?: number }) {
  return (
    <LinearGradient
      colors={['transparent', C.highlight, 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ position: 'absolute', top: 0, left: radius, right: radius, height: StyleSheet.hairlineWidth * 2 }}
      pointerEvents="none"
    />
  );
}

/** Frosted surface. iOS and web blur what is behind; Android uses a denser translucent fill. */
export function GlassFill({ strong }: { strong?: boolean }) {
  const blur = Platform.OS !== 'android';
  return (
    <>
      {blur ? <BlurView intensity={strong ? 50 : 30} tint="dark" style={StyleSheet.absoluteFill} /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: blur ? C.glass : strong ? C.glassStrong : 'rgba(20,22,26,0.82)' }]} />
    </>
  );
}

/** Glass card with an optional spec-plate header. */
export function Panel({
  title,
  right,
  children,
  style,
  pad = true,
  tint,
}: {
  title?: string;
  /** Area colour for the header mark (see AREA in theme). */
  tint?: string;
  right?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  pad?: boolean;
}) {
  return (
    <View style={[styles.panel, style]}>
      <GlassFill />
      <Bevel />
      {title ? (
        <View style={[styles.header, !pad && { paddingBottom: 12 }]}>
          <View style={[styles.headerMark, tint ? { backgroundColor: tint } : null]} />
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
  const fg = tone === 'primary' ? C.onPrimary : tone === 'danger' ? C.red : tone === 'ghost' ? C.accent : C.text;
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
          tone === 'primary' && { backgroundColor: C.primary },
          tone === 'secondary' && styles.buttonGlass,
          tone === 'danger' && { backgroundColor: C.redSoft, borderWidth: 1, borderColor: 'rgba(255,93,79,0.35)' },
          { opacity: disabled ? 0.4 : 1, transform: [{ scale }] },
        ]}>
        <Text style={[styles.buttonText, small && { fontSize: 13 }, { color: fg }]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/** Key figure: large condensed tabular number with unit and label. */
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
      <GlassFill />
      <Bevel />
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
    <View style={[styles.badge, { borderColor: color + '66', backgroundColor: color + '14' }]}>
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
      selectionColor={C.accent}
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
        <GlassFill strong />
        <Bevel radius={28} />
        <View style={styles.grabber} />
        <Text style={[T.title, { fontSize: 21, paddingHorizontal: 22 }]}>{title}</Text>
        <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 22, gap: 16 }} keyboardShouldPersistTaps="handled">
          {fields.map((f) => (
            <View key={f.key} style={{ gap: 7 }}>
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
                  style={f.kind === 'number' || f.kind === 'date' ? { fontFamily: F.medium, fontSize: 16, ...NUM } : undefined}
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
  panel: { borderRadius: 20, borderWidth: 1, borderColor: C.glassEdge, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 15, gap: 10 },
  headerMark: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.faint },
  headerText: { flex: 1, color: C.text, fontFamily: F.semibold, fontSize: 15.5, letterSpacing: -0.2 },
  panelBody: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 15 },
  button: { minHeight: 50, paddingHorizontal: 22, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  buttonSmall: { minHeight: 34, paddingHorizontal: 14, borderRadius: 9 },
  buttonGlass: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.glassEdge },
  buttonText: { fontFamily: F.semibold, fontSize: 15, letterSpacing: -0.1 },
  stat: { borderRadius: 18, borderWidth: 1, borderColor: C.glassEdge, paddingHorizontal: 14, paddingVertical: 12, gap: 3, minWidth: 0, overflow: 'hidden' },
  statRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  statValue: { fontFamily: F.semibold, fontSize: 28, letterSpacing: -0.8, flexShrink: 1, ...NUM },
  statUnit: { color: C.dim, fontFamily: F.mono, fontSize: 11 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontFamily: F.mono, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: C.glassEdge, backgroundColor: 'rgba(255,255,255,0.04)' },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.dim, fontFamily: F.medium, fontSize: 14, textTransform: 'capitalize' },
  chipTextOn: { color: C.onPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderStrong },
  input: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    color: C.text,
    borderWidth: 1,
    borderColor: C.glassEdge,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: 15,
    fontFamily: F.regular,
  },
  inputMulti: { minHeight: 92, paddingVertical: 12, textAlignVertical: 'top' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: C.glassEdge,
    paddingTop: 10,
    overflow: 'hidden',
  },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderStrong, alignSelf: 'center', marginBottom: 14 },
  sheetButtons: { flexDirection: 'row', gap: 8, paddingHorizontal: 22, paddingTop: 8, alignItems: 'center' },
});

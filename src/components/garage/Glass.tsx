import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BlurView } from 'expo-blur';
import { ReactNode } from 'react';
import { Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { C, F } from '../../lib/theme';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 22, color = C.text }: { name: IconName; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

/**
 * Frosted panel. iOS and web blur what is behind; Android cannot blur a GL surface, so it uses a
 * denser translucent fill instead.
 */
export function Glass({ children, style, radius = 28 }: { children?: ReactNode; style?: StyleProp<ViewStyle>; radius?: number }) {
  const blur = Platform.OS !== 'android';
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, styles.edge, style]}>
      {blur ? <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: blur ? 'rgba(16,18,22,0.55)' : 'rgba(16,18,22,0.92)' }]} />
      {children}
    </View>
  );
}

/** Round frosted icon button. */
export function GlassButton({ icon, onPress, label, size = 44 }: { icon: IconName; onPress: () => void; label: string; size?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      <Glass radius={size / 2} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={size * 0.48} />
      </Glass>
    </Pressable>
  );
}

/** Square icon tile with a caption, used for quick actions. */
export function ActionTile({ icon, label, onPress, tint = C.text }: { icon: IconName; label: string; onPress: () => void; tint?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.95 }], opacity: 0.8 }]}>
      <View style={styles.tileIcon}>
        <Icon name={icon} size={24} color={tint} />
      </View>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  edge: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },
  tile: { flex: 1, alignItems: 'center', gap: 7 },
  tileIcon: {
    width: '100%',
    aspectRatio: 1.25,
    maxHeight: 62,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { color: C.dim, fontFamily: F.medium, fontSize: 12 },
});

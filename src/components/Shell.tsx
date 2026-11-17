import { router } from 'expo-router';
import { ReactNode, useEffect, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, F } from '../lib/theme';

/** Page frame: compact header, centred column, scrolling body that fades in. */
export function Shell({
  title,
  eyebrow = 'Bay One',
  back,
  right,
  children,
}: {
  title?: string;
  eyebrow?: string;
  back?: boolean;
  right?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [fade] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [fade]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.bar, { paddingTop: insets.top + 10 }]}>
        <View style={styles.barInner}>
          {back ? (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={10}
              style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            {title ? (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
          </View>
          {right}
        </View>
      </View>
      <Animated.ScrollView
        style={{ opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.column}>{children}</View>
      </Animated.ScrollView>
    </View>
  );
}

// Re-exported for screens that need a non-animated scroller.
export { ScrollView };

const styles = StyleSheet.create({
  bar: { paddingBottom: 12, paddingHorizontal: 18 },
  barInner: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', maxWidth: 760, alignSelf: 'center' },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: C.text, fontSize: 26, lineHeight: 28, marginTop: -2, fontFamily: F.regular },
  eyebrow: { color: C.faint, fontFamily: F.semibold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: C.text, fontFamily: F.bold, fontSize: 24, letterSpacing: -0.5, marginTop: 1 },
  body: { paddingHorizontal: 16, paddingTop: 4 },
  column: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 14 },
});

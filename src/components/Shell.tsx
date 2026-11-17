import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, F } from '../lib/theme';

/** Page frame: brushed-metal title bar, centred column, scrolling body. */
export function Shell({ title, back, right, children }: { title?: string; back?: boolean; right?: ReactNode; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={[C.bg1, C.bg0]} style={{ flex: 1 }}>
      <LinearGradient colors={['#4d5a6b', '#2a323d', '#1c222a']} style={[styles.bar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.barInner}>
          {back ? (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={10}
              style={styles.back}>
              <Text style={styles.backText}>◄</Text>
            </Pressable>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.brand}>
              BAY<Text style={{ color: C.blue }}> ONE</Text>
            </Text>
            {title ? (
              <Text style={styles.sub} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
          </View>
          {right}
        </View>
      </LinearGradient>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 8, paddingHorizontal: 14 },
  barInner: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', maxWidth: 820, alignSelf: 'center' },
  back: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#000', backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  backText: { color: C.text, fontSize: 13 },
  brand: { color: C.text, fontFamily: F.display, fontSize: 18, letterSpacing: 3 },
  sub: { color: C.dim, fontFamily: F.mono, fontSize: 11, marginTop: 1 },
  body: { padding: 12 },
  column: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: 12 },
});

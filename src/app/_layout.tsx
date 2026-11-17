import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono/400Regular';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono/500Medium';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { mergeBackgroundTrip } from '../lib/trip';
import { useStore } from '../lib/store';
import { C } from '../lib/theme';

export default function RootLayout() {
  const [fontsReady] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    // Distance recorded by the background location task while the app was not in the foreground.
    if (hydrated) mergeBackgroundTrip().catch(() => undefined);
  }, [hydrated]);

  if (!fontsReady || !hydrated) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }} />
    </>
  );
}

/**
 * Shown instead of closing the app when a screen throws, with the message so it can be reported.
 * Uses system fonts: custom fonts may not be loaded when this renders.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 24, paddingTop: 80, gap: 14 }}>
      <Text style={{ color: C.dim, fontSize: 12, letterSpacing: 2 }}>BAY ONE · ERROR</Text>
      <Text style={{ color: C.text, fontSize: 24, fontWeight: '700' }}>Something went wrong</Text>
      <Text selectable style={{ color: C.dim, fontSize: 14, lineHeight: 20 }}>
        {error.message}
      </Text>
      <Text selectable style={{ color: C.faint, fontSize: 11, lineHeight: 15 }}>
        {(error.stack ?? '').split('\n').slice(0, 12).join('\n')}
      </Text>
      <Text onPress={retry} style={{ color: C.onPrimary, backgroundColor: C.primary, padding: 14, borderRadius: 12, textAlign: 'center', fontWeight: '700', overflow: 'hidden' }}>
        Try again
      </Text>
    </ScrollView>
  );
}

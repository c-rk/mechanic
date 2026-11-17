import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { BarlowSemiCondensed_500Medium } from '@expo-google-fonts/barlow-semi-condensed/500Medium';
import { BarlowSemiCondensed_600SemiBold } from '@expo-google-fonts/barlow-semi-condensed/600SemiBold';
import { BarlowSemiCondensed_700Bold } from '@expo-google-fonts/barlow-semi-condensed/700Bold';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
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
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    BarlowSemiCondensed_500Medium,
    BarlowSemiCondensed_600SemiBold,
    BarlowSemiCondensed_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
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
      <Text style={{ color: C.accent, fontSize: 12, letterSpacing: 2 }}>BAY ONE · ERROR</Text>
      <Text style={{ color: C.text, fontSize: 24, fontWeight: '700' }}>Something went wrong</Text>
      <Text selectable style={{ color: C.dim, fontSize: 14, lineHeight: 20 }}>
        {error.message}
      </Text>
      <Text selectable style={{ color: C.faint, fontSize: 11, lineHeight: 15 }}>
        {(error.stack ?? '').split('\n').slice(0, 12).join('\n')}
      </Text>
      <Text onPress={retry} style={{ color: C.onAccent, backgroundColor: C.accent, padding: 14, borderRadius: 12, textAlign: 'center', fontWeight: '700', overflow: 'hidden' }}>
        Try again
      </Text>
    </ScrollView>
  );
}

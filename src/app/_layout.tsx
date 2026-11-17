import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { mergeBackgroundTrip } from '../lib/trip';
import { useStore } from '../lib/store';
import { C } from '../lib/theme';

export default function RootLayout() {
  const [fontsReady] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
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

import { B612_400Regular, B612_700Bold } from '@expo-google-fonts/b612';
import { Michroma_400Regular } from '@expo-google-fonts/michroma';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { useStore } from '../lib/store';
import { C } from '../lib/theme';

export default function RootLayout() {
  const [fontsReady] = useFonts({ Michroma_400Regular, B612_400Regular, B612_700Bold });
  const hydrated = useStore((s) => s.hydrated);

  if (!fontsReady || !hydrated) return <View style={{ flex: 1, backgroundColor: C.bg0 }} />;
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg0 }, animation: 'fade' }} />
    </>
  );
}

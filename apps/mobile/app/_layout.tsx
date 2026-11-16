import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { router, Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth';
import { colors, F } from '@/lib/theme';
import { HelpLine } from '@/components/HelpLine';
import { installCrashReporter, reportError } from '@/lib/report';

installCrashReporter();

/** Shown instead of a black screen if something breaks while drawing a screen. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { reportError('screen', error?.message ?? 'unknown', error?.stack ?? null); }, [error]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <Text style={{ color: colors.text, fontSize: 19, fontWeight: '700', textAlign: 'center' }}>Something went wrong</Text>
      <Text style={{ color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
        Sorry about that. We’ve been told about it. Tap Try again, or go back to Home. Your downloads are safe.
      </Text>
      <Pressable onPress={retry} style={{ marginTop: 18, backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 22, paddingVertical: 12 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text>
      </Pressable>
      <Pressable onPress={() => { try { router.replace('/'); } catch { /* ignore */ } }} style={{ marginTop: 10, padding: 10 }}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>Go to Home</Text>
      </Pressable>
      <HelpLine title="Still stuck?" topic="the app" />
    </View>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily: F.bold },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="title/[slug]" options={{ headerShown: false }} />
          <Stack.Screen name="watch/[slug]" options={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: '#000' } }} />
          <Stack.Screen name="offline/[id]" options={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: '#000' } }} />
          <Stack.Screen name="search" options={{ title: 'Search' }} />
          <Stack.Screen name="devices" options={{ title: 'Devices' }} />
          <Stack.Screen name="invite" options={{ title: 'Invite friends' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen name="login" options={{ title: '', presentation: 'modal' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchTitles } from '@cinewave/shared';
import { Row, ScreenTitle } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, F, radius } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';
import { Ionicons } from '@expo/vector-icons';

/**
 * Downloads screen. Real offline downloads (protected, with expiry) arrive in
 * Phase 5; until then this shows storage status and which titles will be
 * downloadable.
 */
export default function Downloads() {
  const { data } = useAsync(async () => (await searchTitles(supabase, {})).filter((t) => t.downloadable), []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScreenTitle title="Downloads" />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.storage}>
          <Ionicons name="phone-portrait-outline" size={20} color={colors.muted} />
          <View style={{ flex: 1 }}>
            <Text style={styles.storageTitle}>No films downloaded</Text>
            <Text style={styles.storageText}>Downloads play without internet and expire after the time your plan allows.</Text>
          </View>
        </View>

        <View style={styles.empty}>
          <View style={styles.icon}><Ionicons name="download-outline" size={30} color={colors.accent} /></View>
          <Text style={styles.title}>Watch offline, anywhere</Text>
          <Text style={styles.text}>
            Look for the download button on films marked ↓. Offline downloads are included with Premium.
          </Text>
          <Text style={styles.soon}>Coming in the next app update</Text>
        </View>

        {data && data.length > 0 && <Row label="Available to download" titles={data} onSeeAll={() => router.push('/search')} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  storage: {
    flexDirection: 'row', gap: 12, alignItems: 'center', marginHorizontal: 20, padding: 16,
    backgroundColor: colors.raised, borderRadius: radius.md,
  },
  storageTitle: { color: colors.text, fontFamily: F.semibold, fontSize: 14 },
  storageText: { color: colors.muted, fontFamily: F.regular, fontSize: 12, marginTop: 2, lineHeight: 17 },
  empty: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  icon: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,122,47,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { color: colors.text, fontFamily: F.bold, fontSize: 18, marginBottom: 6 },
  text: { color: colors.muted, fontFamily: F.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  soon: { color: colors.accent, fontFamily: F.semibold, fontSize: 12, marginTop: 12 },
});

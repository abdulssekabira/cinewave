import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  getContinueWatching,
  getFeatured,
  getHomeRows,
  metaLine,
  posterPalette,
  progressPercent,
} from '@cinewave/shared';
import { Button, Empty, ErrorState, Loading, Row } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

export default function Home() {
  const { session } = useAuth();
  const { data, error, loading, reload } = useAsync(async () => {
    const [featured, rows, cw] = await Promise.all([
      getFeatured(supabase),
      getHomeRows(supabase),
      session ? getContinueWatching(supabase) : Promise.resolve([]),
    ]);
    return { featured, rows, cw };
  }, [session?.user.id]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data || (!data.featured && !data.rows.length)) {
    return <Empty title="The catalogue is empty" text="Publish a title with active rights to see it here." />;
  }

  const { featured, rows, cw } = data;
  const p = featured ? posterPalette(featured.slug) : null;
  const progress = Object.fromEntries(
    cw.map((c) => [c.title.id, progressPercent(c.position_seconds, c.duration_seconds, c.title.runtime_minutes)]),
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.accent} />}
    >
      {featured && p && (
        <LinearGradient colors={[p.to, p.from, colors.bg]} locations={[0, 0.55, 1]} style={styles.hero}>
          <Text style={styles.eyebrow}>FEATURED</Text>
          <Text style={styles.heroTitle}>{featured.title}</Text>
          {featured.tagline ? <Text style={styles.tagline}>{featured.tagline}</Text> : null}
          <Text style={styles.meta}>{metaLine(featured)}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <Button
              label={featured.required_plan === 'free' ? '▶  Watch free' : 'See details'}
              onPress={() => router.push(`/title/${featured.slug}`)}
            />
            {session && <Button label="My List" variant="ghost" onPress={() => router.push('/watchlist')} />}
          </View>
        </LinearGradient>
      )}

      {cw.length > 0 && <Row label="Continue Watching" titles={cw.map((c) => c.title)} progress={progress} />}
      {rows.map((r) => (
        <Row key={r.key} label={r.label} titles={r.titles} />
      ))}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 16, paddingTop: 120, paddingBottom: 36, marginBottom: 8 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 8 },
  heroTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 40, fontWeight: '700', lineHeight: 42 },
  tagline: { color: colors.text, opacity: 0.9, fontSize: 16, marginTop: 8 },
  meta: { color: colors.muted, fontSize: 13, marginTop: 6 },
});

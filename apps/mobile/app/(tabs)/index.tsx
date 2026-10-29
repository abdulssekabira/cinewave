import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getContinueWatching,
  getHeroTitles,
  getHomeRows,
  getProfile,
  progressPercent,
} from '@cinewave/shared';
import { HeroCarousel } from '@/components/HeroCarousel';
import { LandscapeCard } from '@/components/Poster';
import { Empty, ErrorState, Loading, Row, SectionTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, F } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

const ROW_LABEL: Record<string, string> = { trending: 'Trending Now' };

export default function Home() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const { data, error, loading, reload } = useAsync(async () => {
    const [hero, rows, cw, profile] = await Promise.all([
      getHeroTitles(supabase),
      getHomeRows(supabase),
      uid ? getContinueWatching(supabase) : Promise.resolve([]),
      uid ? getProfile(supabase, uid) : Promise.resolve(null),
    ]);
    return { hero, rows, cw, name: profile?.display_name ?? null };
  }, [uid]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data || (!data.hero.length && !data.rows.length)) {
    return <Empty icon="film-outline" title="The catalogue is empty" text="Publish a title with active rights to see it here." />;
  }

  const { hero, rows, cw, name } = data;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.accent} colors={[colors.accent]} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>{name ? `Welcome back ${name} 👋` : 'Welcome to GLE Movies 👋'}</Text>
            <Text style={styles.ask}>Any movie to watch?</Text>
          </View>
          <Pressable onPress={() => router.push('/search')} accessibilityRole="button" accessibilityLabel="Search" hitSlop={10}>
            <Ionicons name="search" size={24} color={colors.text} />
          </Pressable>
        </View>

        {hero.length > 0 && <HeroCarousel titles={hero} />}

        {cw.length > 0 && (
          <View style={{ marginBottom: 26 }}>
            <SectionTitle label="Continue Watching" />
            <FlatList
              horizontal
              data={cw}
              keyExtractor={(c) => c.title.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              renderItem={({ item }) => (
                <LandscapeCard
                  title={item.title}
                  progress={progressPercent(item.position_seconds, item.duration_seconds, item.episode ? null : item.title.runtime_minutes)}
                  episode={item.episode}
                />
              )}
            />
          </View>
        )}

        {rows.map((r) => (
          <Row key={r.key} label={ROW_LABEL[r.key] ?? r.label} titles={r.titles} onSeeAll={() => router.push('/search')} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18 },
  hello: { color: colors.muted, fontFamily: F.medium, fontSize: 13 },
  ask: { color: colors.text, fontFamily: F.bold, fontSize: 21, marginTop: 2 },
});

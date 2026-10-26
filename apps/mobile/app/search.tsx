import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getGenres, searchTitles, type CatalogTitle, type Genre } from '@cinewave/shared';
import { PosterGrid } from '@/components/Grid';
import { Empty, ErrorState } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, F, radius } from '@/lib/theme';

export default function Search() {
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState<string | undefined>();
  const [genres, setGenres] = useState<Genre[]>([]);
  const [results, setResults] = useState<CatalogTitle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    getGenres(supabase).then(setGenres).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setError(null);
      searchTitles(supabase, { query, genre })
        .then(setResults)
        .catch((e) => setError(e instanceof Error ? e.message : 'Search failed'));
    }, 250);
    return () => clearTimeout(t);
  }, [query, genre, nonce]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.faint} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search movies…"
          placeholderTextColor={colors.faint}
          returnKeyType="search"
          autoFocus
          accessibilityLabel="Search movies"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search" hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.faint} />
          </Pressable>
        ) : null}
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[{ slug: undefined, name: 'All' } as { slug?: string; name: string }, ...genres].map((g) => {
            const on = genre === g.slug;
            return (
              <Pressable key={g.name} onPress={() => setGenre(g.slug)} accessibilityRole="button" accessibilityState={{ selected: on }}>
                <View style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && { color: '#fff' }]}>{g.name}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {error ? (
        <ErrorState message={error} onRetry={() => setNonce((n) => n + 1)} />
      ) : results && results.length === 0 ? (
        <Empty icon="search-outline" title="No movies found" text="Try a different search or genre." />
      ) : (
        <PosterGrid titles={results ?? []} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 6,
    height: 50, borderRadius: radius.md, backgroundColor: colors.raised, paddingHorizontal: 16,
  },
  input: { flex: 1, color: colors.text, fontFamily: F.medium, fontSize: 15, height: '100%' },
  chips: { paddingHorizontal: 20, gap: 8, paddingVertical: 14 },
  chip: { backgroundColor: colors.raised, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.muted, fontFamily: F.semibold, fontSize: 13 },
});

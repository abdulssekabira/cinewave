import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { getGenres, searchTitles, type CatalogTitle, type Genre } from '@cinewave/shared';
import { PosterCard } from '@/components/Poster';
import { Empty, ErrorState } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function Search() {
  const { width } = useWindowDimensions();
  const cols = width > 600 ? 4 : 3;
  const cardW = (width - 32 - (cols - 1) * 12) / cols;

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
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search titles…"
          placeholderTextColor={colors.faint}
          returnKeyType="search"
          accessibilityLabel="Search titles"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
        {[{ slug: undefined, name: 'All' } as { slug?: string; name: string }, ...genres].map((g) => {
          const on = genre === g.slug;
          return (
            <Pressable key={g.name} onPress={() => setGenre(g.slug)} accessibilityState={{ selected: on }}>
              <Text style={[styles.chip, on && styles.chipOn]}>{g.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? (
        <ErrorState message={error} onRetry={() => setNonce((n) => n + 1)} />
      ) : results && results.length === 0 ? (
        <Empty title="No titles found" text="Try a different search or genre." />
      ) : (
        <FlatList
          key={cols}
          data={results ?? []}
          numColumns={cols}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 16, gap: 18 }}
          columnWrapperStyle={{ gap: 12 }}
          renderItem={({ item }) => <PosterCard title={item} width={cardW} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  chip: {
    color: colors.muted,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  chipOn: { color: colors.accentInk, backgroundColor: colors.accent, borderColor: colors.accent },
});

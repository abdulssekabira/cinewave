import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getFilterCounts, getGenres, getVjs, searchTitles, type CatalogTitle, type Genre, type SearchParams, type Vj } from '@cinewave/shared';
import { FilterSheet } from '@/components/FilterSheet';
import { img } from '@/lib/theme';
import { PosterGrid } from '@/components/Grid';
import { Empty, ErrorState } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, F, radius } from '@/lib/theme';

export default function Search() {
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('');
  const [vj, setVj] = useState('');
  const [kind, setKind] = useState('');
  const [sort, setSort] = useState('');
  const [genres, setGenres] = useState<Genre[]>([]);
  const [vjs, setVjs] = useState<Vj[]>([]);
  const [counts, setCounts] = useState<{ genres: Record<string, number>; vjs: Record<string, number>; total: number }>({ genres: {}, vjs: {}, total: 0 });
  const [results, setResults] = useState<CatalogTitle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    getGenres(supabase).then(setGenres).catch(() => {});
    getVjs(supabase).then(setVjs).catch(() => {});
    getFilterCounts(supabase).then(setCounts).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setError(null);
      searchTitles(supabase, {
        query,
        genre: genre || undefined,
        vj: vj || undefined,
        kind: (kind || undefined) as SearchParams['kind'],
        sort: (sort || 'latest') as SearchParams['sort'],
      })
        .then(setResults)
        .catch((e) => setError(e instanceof Error ? e.message : 'Search failed'));
    }, 250);
    return () => clearTimeout(t);
  }, [query, genre, vj, kind, sort, nonce]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.faint} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search movies and series…"
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
          {vjs.length > 0 && (
            <FilterSheet title="VJ" value={vj} onChange={setVj} options={[
              { value: '', label: 'All VJs', count: counts.total, avatar: true },
              ...vjs.map((v) => ({ value: v.slug, label: v.name, count: counts.vjs[v.slug] ?? 0, image: img(v.photo_url), avatar: true })),
            ]} />
          )}
          <FilterSheet title="Show" value={kind} onChange={setKind} options={[
            { value: '', label: 'Movies & series' }, { value: 'movie', label: 'Movies' }, { value: 'series', label: 'Series' },
          ]} />
          <FilterSheet title="Genre" value={genre} onChange={setGenre} options={[
            { value: '', label: 'All genres', count: counts.total },
            ...genres.map((g) => ({ value: g.slug, label: g.name, count: counts.genres[g.slug] ?? 0 })),
          ]} />
          <FilterSheet title="Sort by" value={sort} onChange={setSort} options={[
            { value: '', label: 'Latest added' }, { value: 'popular', label: 'Most popular' },
            { value: 'newest', label: 'Newest release' }, { value: 'az', label: 'A–Z' },
          ]} />
        </ScrollView>
      </View>

      {error ? (
        <ErrorState message={error} onRetry={() => setNonce((n) => n + 1)} />
      ) : results && results.length === 0 ? (
        <Empty icon="search-outline" title="Nothing found" text="Try a different search or clear the filters." />
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

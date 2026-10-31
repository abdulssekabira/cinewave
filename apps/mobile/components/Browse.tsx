import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { vjLabel, type Genre, type Vj } from '@cinewave/shared';
import { colors, F, img } from '@/lib/theme';

type Counts = { genres: Record<string, number>; vjs: Record<string, number>; years: Record<string, number> };

const open = (params: Record<string, string>) => router.push({ pathname: '/search', params });

const SORTS = [
  { value: 'latest', label: 'Latest added' },
  { value: 'popular', label: 'Most popular' },
  { value: 'newest', label: 'Newest release' },
  { value: 'az', label: 'A–Z' },
];

/**
 * Home-screen shortcuts: browse by VJ, genre, year, type, or sort the list.
 * Each tap opens the film list with that filter already chosen.
 */
export function Browse({ vjs, genres, counts }: { vjs: Vj[]; genres: Genre[]; counts: Counts }) {
  const shownVjs = vjs.filter((v) => (counts.vjs[v.slug] ?? 0) > 0);
  const shownGenres = genres.filter((g) => (counts.genres[g.slug] ?? 0) > 0);
  const years = Object.keys(counts.years).map(Number).sort((a, b) => b - a);

  return (
    <View style={{ marginBottom: 22 }}>
      {shownVjs.length > 0 && (
        <>
          <Text style={s.h}>Browse by VJ</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.vjRow}>
            {shownVjs.map((v) => (
              <Pressable key={v.slug} onPress={() => open({ vj: v.slug })} style={s.vj} accessibilityRole="button" accessibilityLabel={`Films by ${vjLabel(v.name)}`}>
                {v.photo_url ? (
                  <Image source={img(v.photo_url)} style={s.vjImg} contentFit="cover" />
                ) : (
                  <View style={[s.vjImg, s.vjInitials]}><Text style={s.vjInitialsText}>{v.name.replace(/^vj\s+/i, '').slice(0, 2).toUpperCase()}</Text></View>
                )}
                <Text style={s.vjName} numberOfLines={1}>{vjLabel(v.name)}</Text>
                <Text style={s.vjCount}>{counts.vjs[v.slug]} film{counts.vjs[v.slug] === 1 ? '' : 's'}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      {shownGenres.length > 0 && (
        <>
          <Text style={s.h}>Genres</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {shownGenres.map((g) => (
              <Pressable key={g.slug} onPress={() => open({ genre: g.slug })} style={s.chip} accessibilityRole="button">
                <Text style={s.chipText}>{g.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      {years.length > 0 && (
        <>
          <Text style={s.h}>Year</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {years.map((y) => (
              <Pressable key={y} onPress={() => open({ year: String(y) })} style={s.chip} accessibilityRole="button">
                <Text style={s.chipText}>{y}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      <Text style={s.h}>Sort & show</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Pressable onPress={() => open({ kind: 'movie' })} style={s.chip} accessibilityRole="button"><Text style={s.chipText}>Movies</Text></Pressable>
        <Pressable onPress={() => open({ kind: 'series' })} style={s.chip} accessibilityRole="button"><Text style={s.chipText}>Series</Text></Pressable>
        {SORTS.map((o) => (
          <Pressable key={o.value} onPress={() => open({ sort: o.value })} style={s.chip} accessibilityRole="button">
            <Text style={s.chipText}>{o.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  h: { color: colors.text, fontFamily: F.bold, fontSize: 17, marginHorizontal: 20, marginTop: 6, marginBottom: 10 },
  vjRow: { paddingHorizontal: 20, gap: 14, paddingBottom: 14 },
  vj: { width: 76, alignItems: 'center' },
  vjImg: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.accent },
  vjInitials: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  vjInitialsText: { color: '#fff', fontFamily: F.bold, fontSize: 18 },
  vjName: { color: colors.text, fontFamily: F.semibold, fontSize: 12, marginTop: 6, textAlign: 'center' },
  vjCount: { color: colors.faint, fontFamily: F.regular, fontSize: 10.5, marginTop: 1 },
  chips: { paddingHorizontal: 20, gap: 8, paddingBottom: 14 },
  chip: { backgroundColor: colors.raised, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: colors.line },
  chipText: { color: colors.text, fontFamily: F.semibold, fontSize: 13 },
});

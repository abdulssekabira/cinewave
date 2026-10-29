import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { formatRuntime, posterPalette, ratingLabel, type CatalogTitle } from '@cinewave/shared';
import { colors, F, img, radius } from '@/lib/theme';

const fill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

/** Poster image, or generated colours + title when there's no artwork yet. */
export function Art({ title }: { title: CatalogTitle }) {
  const uri = img(title.poster_url);
  if (uri) {
    return (
      <Image source={{ uri }} style={fill} contentFit="cover" contentPosition="top" transition={200} />
    );
  }
  const p = posterPalette(title.slug);
  return (
    <LinearGradient colors={[p.to, p.from]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[fill, styles.generated]}>
      <View style={[styles.rule, { backgroundColor: p.accent }]} />
      <Text style={styles.genTitle} numberOfLines={3}>{title.title}</Text>
    </LinearGradient>
  );
}

/** Wide art for hero and landscape cards: backdrop if present, else poster. */
export function WideArt({ title }: { title: CatalogTitle }) {
  const backdrop = img(title.backdrop_url);
  const uri = backdrop ?? img(title.poster_url);
  if (uri) {
    // Portrait posters in a wide frame: keep the top third (faces), not the middle.
    return (
      <Image
        source={{ uri }}
        style={fill}
        contentFit="cover"
        contentPosition={backdrop ? 'center' : { top: '12%' }}
        transition={200}
      />
    );
  }
  const p = posterPalette(title.slug);
  return <LinearGradient colors={[p.to, p.from]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={fill} />;
}

export function Rating({ title, style }: { title: CatalogTitle; style?: ViewStyle }) {
  const r = ratingLabel(title.rating);
  const runtime = formatRuntime(title.runtime_minutes);
  if (!r && !runtime) return null;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>
      {runtime ? <Text style={styles.metaText}>{runtime}</Text> : null}
      {r ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="star" size={13} color={colors.gold} />
          <Text style={styles.metaText}>{r}</Text>
        </View>
      ) : null}
    </View>
  );
}

function PlanTag({ title }: { title: CatalogTitle }) {
  if (title.required_plan === 'free') return null;
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{title.required_plan === 'premium' ? 'PREMIUM' : 'STANDARD'}</Text>
    </View>
  );
}

export function PosterCard({ title, width = 124 }: { title: CatalogTitle; width?: number }) {
  return (
    <Link href={`/title/${title.slug}`} asChild>
      <Pressable style={{ width }} accessibilityRole="link" accessibilityLabel={title.title}>
        {({ pressed }) => (
          <>
            <View style={[styles.poster, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}>
              <Art title={title} />
              <PlanTag title={title} />
              {title.kind === 'series' && (
                <View style={styles.seriesTag}>
                  <Text style={styles.tagText}>{title.episode_count ? `${title.episode_count} PARTS` : 'SERIES'}</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{title.title}</Text>
          </>
        )}
      </Pressable>
    </Link>
  );
}

export function LandscapeCard({
  title,
  progress,
  width = 196,
  episode,
}: {
  title: CatalogTitle;
  progress: number;
  width?: number;
  episode?: { id: string; number: number; name: string | null } | null;
}) {
  // Continue Watching opens the player straight away (at the right part for a series).
  const href = episode
    ? { pathname: '/watch/[slug]' as const, params: { slug: title.slug, part: episode.id } }
    : { pathname: '/watch/[slug]' as const, params: { slug: title.slug } };
  return (
    <Link href={href} asChild>
      <Pressable style={{ width }} accessibilityRole="link" accessibilityLabel={`${title.title}, ${progress}% watched`}>
        <View style={styles.landscape}>
          <WideArt title={title} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={fill} />
          <View style={styles.playDot}>
            <Ionicons name="play" size={14} color="#fff" style={{ marginLeft: 2 }} />
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>{title.title}</Text>
        <Text style={styles.cardSub}>{episode ? `Part ${episode.number} · ` : ''}{progress}% watched</Text>
      </Pressable>
    </Link>
  );
}

export const styles = StyleSheet.create({
  poster: { aspectRatio: 2 / 3, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  generated: { justifyContent: 'flex-end', padding: 12 },
  rule: { width: 22, height: 3, borderRadius: 2, marginBottom: 8 },
  genTitle: { color: '#fff', fontFamily: F.extrabold, fontSize: 16, lineHeight: 19 },
  seriesTag: {
    position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  tag: {
    position: 'absolute', top: 8, left: 8, backgroundColor: colors.accent,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  tagText: { color: '#fff', fontFamily: F.bold, fontSize: 8.5, letterSpacing: 0.8 },
  cardTitle: { color: colors.text, fontFamily: F.semibold, fontSize: 13, marginTop: 8 },
  cardSub: { color: colors.faint, fontFamily: F.medium, fontSize: 11, marginTop: 2 },
  metaText: { color: '#e6e6ee', fontFamily: F.medium, fontSize: 12.5 },
  landscape: { aspectRatio: 16 / 9, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
  playDot: {
    position: 'absolute', right: 10, bottom: 12, width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  progressFill: { height: 3, backgroundColor: colors.accent },
});

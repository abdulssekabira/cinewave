import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { genreLabel, posterPalette, type CatalogTitle } from '@cinewave/shared';
import { colors, fonts } from '@/lib/theme';

export function PosterArt({ title, large }: { title: CatalogTitle; large?: boolean }) {
  if (title.poster_url) {
    return <Image source={{ uri: title.poster_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />;
  }
  const p = posterPalette(title.slug);
  return (
    <LinearGradient colors={[p.from, p.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.generated}>
      <View style={[styles.rule, { backgroundColor: p.accent }]} />
      <Text style={[styles.pgTitle, large && { fontSize: 24 }]} numberOfLines={3}>{title.title}</Text>
      {title.release_year ? <Text style={styles.pgYear}>{title.release_year}</Text> : null}
    </LinearGradient>
  );
}

export function Badges({ title }: { title: CatalogTitle }) {
  const color =
    title.required_plan === 'free' ? colors.ok : title.required_plan === 'premium' ? colors.accent : colors.standard;
  return (
    <View style={styles.badges}>
      <Text style={[styles.badge, { color }]}>{title.required_plan.toUpperCase()}</Text>
      {title.downloadable && (
        <Text style={[styles.badge, { marginLeft: 'auto' }]} accessibilityLabel="Download available">↓</Text>
      )}
    </View>
  );
}

export function PosterCard({ title, width = 128, progress }: { title: CatalogTitle; width?: number; progress?: number }) {
  return (
    <Link href={`/title/${title.slug}`} asChild>
      <Pressable style={{ width }} accessibilityRole="link" accessibilityLabel={title.title}>
        {({ pressed }) => (
          <>
            <View style={[styles.poster, pressed && { opacity: 0.8 }]}>
              <PosterArt title={title} />
              <Badges title={title} />
            </View>
            {progress !== undefined && (
              <View style={styles.progress}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
            )}
            <Text style={styles.cardTitle} numberOfLines={1}>{title.title}</Text>
            <Text style={styles.cardSub} numberOfLines={1}>
              {[title.release_year, title.genres[0] && genreLabel(title.genres[0])].filter(Boolean).join(' · ')}
            </Text>
          </>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  poster: {
    aspectRatio: 2 / 3,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  generated: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', padding: 12 },
  rule: { width: 24, height: 3, borderRadius: 2, marginBottom: 8 },
  pgTitle: { color: '#fff', fontFamily: fonts.display, fontWeight: '700', fontSize: 17, lineHeight: 19 },
  pgYear: { color: 'rgba(255,255,255,0.8)', fontSize: 10, letterSpacing: 1.5, marginTop: 4 },
  badges: { position: 'absolute', top: 6, left: 6, right: 6, flexDirection: 'row' },
  badge: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.text,
    backgroundColor: 'rgba(10,11,15,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progress: { height: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  cardTitle: { color: colors.text, fontSize: 13, fontWeight: '600', marginTop: 8 },
  cardSub: { color: colors.faint, fontSize: 11, marginTop: 2 },
});

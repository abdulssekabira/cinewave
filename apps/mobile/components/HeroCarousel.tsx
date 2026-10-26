import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { CatalogTitle } from '@cinewave/shared';
import { colors, F, radius } from '@/lib/theme';
import { Rating, WideArt } from './Poster';

const GAP = 12;

/** Large swipeable cards with a peek of the next one, plus page dots. */
export function HeroCarousel({ titles }: { titles: CatalogTitle[] }) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(width - 56, 520);
  const cardH = Math.round(cardW * 0.62);
  const [index, setIndex] = useState(0);

  const onViewable = useRef(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  }).current;

  return (
    <View style={{ marginBottom: 26 }}>
      <FlatList
        horizontal
        data={titles}
        keyExtractor={(t) => t.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardW + GAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 20, gap: GAP }}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/title/${item.slug}`)}
            accessibilityRole="link"
            accessibilityLabel={item.title}
            style={({ pressed }) => [styles.card, { width: cardW, height: cardH }, pressed && { opacity: 0.9 }]}
          >
            <WideArt title={item} />
            <LinearGradient
              colors={['transparent', 'rgba(10,10,16,0.25)', 'rgba(10,10,16,0.88)']}
              locations={[0.35, 0.6, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              <Rating title={item} style={{ marginTop: 6 }} />
            </View>
          </Pressable>
        )}
      />
      {titles.length > 1 && (
        <View style={styles.dots} accessibilityElementsHidden>
          {titles.map((t, i) => (
            <View key={t.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  cardBody: { position: 'absolute', left: 18, right: 18, bottom: 16 },
  cardTitle: { color: '#fff', fontFamily: F.bold, fontSize: 21, lineHeight: 26 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.surfaceHigh },
  dotActive: { width: 26, backgroundColor: '#fff' },
});

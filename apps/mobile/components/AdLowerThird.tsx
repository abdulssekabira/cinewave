import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { logAdEvent, pickAd, type Ad, type AdPlan } from '@cinewave/shared';
import { supabase } from '@/lib/supabase';
import { colors, F } from '@/lib/theme';

/**
 * Lower-third advert over the film (app). Counts only time actually watched:
 * first advert after `firstAfterSec`, then one every `everySec`, each shown
 * for `showSec`. The film keeps playing; the viewer can close it after 4 s.
 */
export function AdLowerThird({ plan, time, playing, titleId, raised, landscape }: {
  plan: AdPlan; time: number; playing: boolean; titleId: string; raised: boolean; landscape: boolean;
}) {
  const [ad, setAd] = useState<Ad | null>(null);
  const [canClose, setCanClose] = useState(false);
  const watched = useRef(0);
  const lastT = useRef<number | null>(null);
  const nextAt = useRef(plan.firstAfterSec);
  const lastAdId = useRef<string | undefined>(undefined);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!playing) { lastT.current = null; return; }
    if (lastT.current !== null) {
      const d = time - lastT.current;
      if (d > 0 && d < 3) watched.current += d; // ignore jumps (seeking)
    }
    lastT.current = time;
    if (!ad && watched.current >= nextAt.current) {
      nextAt.current = watched.current + plan.everySec;
      const next = pickAd(plan.ads, lastAdId.current);
      if (!next) return;
      lastAdId.current = next.id;
      setAd(next);
      setCanClose(false);
      timers.current.forEach(clearTimeout);
      timers.current = [
        setTimeout(() => setCanClose(true), 4000),
        setTimeout(() => setAd(null), plan.showSec * 1000),
      ];
      logAdEvent(supabase, next.id, 'view', titleId).catch(() => {});
    }
  }, [time, playing, ad, plan, titleId]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (!ad) return null;
  const open = () => {
    if (!ad.link_url) return;
    logAdEvent(supabase, ad.id, 'click', titleId).catch(() => {});
    Linking.openURL(ad.link_url).catch(() => {});
  };
  return (
    <View
      style={[s.wrap, { bottom: raised ? (landscape ? 64 : 44) : landscape ? 18 : 8, maxWidth: landscape ? 560 : undefined }]}
      accessibilityLabel="Advertisement"
    >
      <Pressable style={s.bar} onPress={open} disabled={!ad.link_url}>
        {ad.image_url ? <Image source={{ uri: ad.image_url }} style={s.img} contentFit="cover" /> : null}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.tag}>AD</Text>
            <Text style={s.head} numberOfLines={1}>{ad.headline}</Text>
          </View>
          {ad.subtext ? <Text style={s.sub} numberOfLines={1}>{ad.subtext}</Text> : null}
        </View>
        {ad.link_url ? <View style={s.cta}><Text style={s.ctaText}>{ad.cta}</Text></View> : null}
      </Pressable>
      {canClose && (
        <Pressable onPress={() => setAd(null)} hitSlop={10} style={s.x} accessibilityLabel="Close advert">
          <Ionicons name="close" size={14} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 10, right: 10, alignSelf: 'center' },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 7, paddingRight: 10, borderRadius: 10,
    backgroundColor: 'rgba(10,10,14,0.86)', borderLeftWidth: 3, borderLeftColor: colors.accent,
  },
  img: { width: 38, height: 38, borderRadius: 6, backgroundColor: '#222' },
  tag: { backgroundColor: '#f5c518', color: '#000', fontFamily: F.bold, fontSize: 10, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, overflow: 'hidden' },
  head: { flex: 1, color: '#fff', fontFamily: F.bold, fontSize: 13.5 },
  sub: { color: 'rgba(255,255,255,0.8)', fontFamily: F.medium, fontSize: 12, marginTop: 2 },
  cta: { backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7 },
  ctaText: { color: '#fff', fontFamily: F.bold, fontSize: 12.5 },
  x: { position: 'absolute', top: -9, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
});

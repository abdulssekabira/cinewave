import { Image } from 'expo-image';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getNotifications, markNotifications } from '@cinewave/shared';
import { openNotification } from '@/components/NotifyBell';
import { Empty, Loading } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, F, img, radius } from '@/lib/theme';
import { useAsync } from '@/lib/useAsync';

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export default function Notifications() {
  const { data, loading } = useAsync(() => getNotifications(supabase), []);
  // Opening the list marks everything read.
  useEffect(() => { if (data?.some((n) => !n.read_at)) markNotifications(supabase, { read: true }).catch(() => {}); }, [data]);

  if (loading && !data) return <Loading />;
  if (!data?.length) {
    return <Empty icon="notifications-outline" title="Nothing new yet" text="Add series to your Watchlist or start watching one, and we’ll tell you here when a new episode comes out." />;
  }
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={data}
      keyExtractor={(n) => n.id}
      renderItem={({ item: n }) => (
        <Pressable onPress={() => openNotification(n)} style={[s.row, !n.read_at && s.unread]} accessibilityRole="button">
          <View style={s.thumb}>{n.image_url ? <Image source={img(n.image_url)} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
          <View style={{ flex: 1 }}>
            <Text style={s.h} numberOfLines={2}>{n.heading}</Text>
            {n.body ? <Text style={s.body} numberOfLines={2}>{n.body}</Text> : null}
            <Text style={s.when}>{ago(n.created_at)}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: radius.md, backgroundColor: colors.raised },
  unread: { borderWidth: 1, borderColor: colors.accent },
  thumb: { width: 104, aspectRatio: 16 / 9, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface },
  h: { color: colors.text, fontFamily: F.bold, fontSize: 14 },
  body: { color: colors.muted, fontFamily: F.regular, fontSize: 13, marginTop: 2 },
  when: { color: colors.faint, fontFamily: F.regular, fontSize: 11.5, marginTop: 3 },
});

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { getPopupNotifications, getUnreadCount, markNotifications, type AppNotification } from '@cinewave/shared';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, F, img, radius } from '@/lib/theme';

/** Opens a notification's link inside the app (watch links → the app player). */
export function openNotification(n: AppNotification) {
  const m = /^\/watch\/([^?]+)(?:\?part=([\w-]+))?/.exec(n.link ?? '');
  if (m) router.push({ pathname: '/watch/[slug]', params: m[2] ? { slug: m[1], part: m[2] } : { slug: m[1] } });
  else router.push('/notifications');
}

/**
 * Bell with a red count for the home header, plus the "New episode" pop-up
 * shown when the viewer comes back to the app (once per notification).
 */
export function NotifyBell() {
  const { session } = useAuth();
  const [unread, setUnread] = useState(0);
  const [popup, setPopup] = useState<AppNotification[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let alive = true;
      getUnreadCount(supabase).then((c) => alive && setUnread(c)).catch(() => {});
      getPopupNotifications(supabase).then((l) => alive && l.length && setPopup(l)).catch(() => {});
      return () => { alive = false; };
    }, [session?.user.id]),
  );

  if (!session) return null;
  const close = () => {
    const ids = popup.map((n) => n.id);
    setPopup([]);
    markNotifications(supabase, { ids, read: false, popup: true }).catch(() => {});
  };
  const first = popup[0];

  return (
    <>
      <Pressable
        onPress={() => router.push('/notifications')}
        accessibilityRole="button"
        accessibilityLabel={unread ? `Notifications, ${unread} new` : 'Notifications'}
        hitSlop={10}
        style={{ marginRight: 18 }}
      >
        <Ionicons name="notifications-outline" size={24} color={colors.text} />
        {unread > 0 && (
          <View style={s.dot}><Text style={s.dotText}>{unread > 9 ? '9+' : unread}</Text></View>
        )}
      </Pressable>

      <Modal visible={Boolean(first)} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={s.back} onPress={close}>
          <Pressable style={s.card} onPress={() => {}}>
            {first?.image_url ? <Image source={img(first.image_url)} style={s.img} contentFit="cover" /> : null}
            <View style={{ padding: 18 }}>
              <Text style={s.eyebrow}>🔔 {popup.length > 1 ? `${popup.length} new episodes` : 'New episode'}</Text>
              <Text style={s.h}>{first?.heading.replace(/^New episode: /, '')}</Text>
              {first?.body ? <Text style={s.body}>{first.body}</Text> : null}
              {popup.slice(1, 4).map((n) => (
                <Text key={n.id} style={s.more}>• {n.heading.replace(/^New episode: /, '')} · {n.body?.replace(/ is out now\.$/, '')}</Text>
              ))}
              <Button label="Watch now" icon="play" onPress={() => { const n = first; close(); if (n) openNotification(n); }} style={{ marginTop: 16 }} />
              <Button label={popup.length > 1 ? 'See all' : 'Later'} variant="ghost" onPress={() => { close(); if (popup.length > 1) router.push('/notifications'); }} style={{ marginTop: 8 }} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  dot: { position: 'absolute', top: -6, right: -8, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: '#fff', fontFamily: F.bold, fontSize: 10.5 },
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: colors.raised, borderRadius: radius.lg, overflow: 'hidden' },
  img: { width: '100%', aspectRatio: 16 / 9 },
  eyebrow: { color: colors.accent, fontFamily: F.bold, fontSize: 13 },
  h: { color: colors.text, fontFamily: F.bold, fontSize: 20, marginTop: 4 },
  body: { color: colors.muted, fontFamily: F.regular, fontSize: 14, marginTop: 4 },
  more: { color: colors.muted, fontFamily: F.regular, fontSize: 13, marginTop: 6 },
});

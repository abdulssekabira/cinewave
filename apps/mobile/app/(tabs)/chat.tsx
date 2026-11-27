import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  banFromChat, CHAT_BADGE, chatColor, chatTime, clearChat, deleteChatMessage, getChat, getChatNotify,
  reportChat, sendChat, setChatNotify, subscribeChat, type ChatMessage,
} from '@cinewave/shared';
import { Button } from '@/components/ui';
import { authHeaders, SITE } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { registerChatPush } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { colors, F, radius } from '@/lib/theme';

export default function Chat() {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const [msgs, setMsgs] = useState<ChatMessage[] | null>(null);
  const [online, setOnline] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shown, setShown] = useState<Set<number>>(new Set());
  const [admin, setAdmin] = useState(false);
  const [notify, setNotify] = useState(false);
  const list = useRef<FlatList<ChatMessage>>(null);

  // Keep the typing box above the keyboard. Some phones shrink the screen for
  // the keyboard and some don't, so only add the part the phone didn't.
  const { height: winH } = useWindowDimensions();
  const baseH = useRef(winH);
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKb(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKb(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => { if (!kb) baseH.current = winH; }, [kb, winH]);
  const lift = kb ? Math.max(0, kb - Math.max(0, baseH.current - winH)) : 0;

  const load = useCallback(async () => {
    const m = await getChat(supabase).catch(() => null);
    setMsgs(m ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => subscribeChat(supabase, {
    presenceKey: uid ?? undefined,
    onMessage: (m) => setMsgs((xs) => (xs?.some((x) => x.id === m.id) ? xs : [...(xs ?? []), m].slice(-400))),
    onRemove: (id) => setMsgs((xs) => xs?.filter((x) => x.id !== id) ?? xs),
    onOnline: setOnline,
  }), [uid]);

  useEffect(() => {
    if (!uid) { setAdmin(false); setNotify(false); return; }
    supabase.rpc('has_role', { r: 'admin' }).then((r) => setAdmin(Boolean(r.data)));
    getChatNotify(supabase, uid).then((on) => {
      setNotify(on);
      if (on) registerChatPush().catch(() => {}); // keep this phone's token fresh
    }).catch(() => {});
  }, [uid]);

  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true); setErr(null);
    const r = await sendChat(supabase, text, spoiler);
    setBusy(false);
    if (r.error) return setErr(r.error);
    if (r.message) setMsgs((xs) => (xs?.some((x) => x.id === r.message!.id) ? xs : [...(xs ?? []), r.message!]));
    setText(''); setSpoiler(false);
    authHeaders().then((h) => fetch(`${SITE}/api/chat/notify`, { method: 'POST', headers: h })).catch(() => {});
  }

  async function toggleNotify() {
    const on = !notify;
    setNotify(on);
    const e = await setChatNotify(supabase, on);
    if (e) { setNotify(!on); return setErr(e); }
    if (on) {
      const why = await registerChatPush();
      if (why) Alert.alert('Chat notifications', why);
      else Alert.alert('Notifications on', 'You’ll get a notification when there are new messages (at most one every 15 minutes).');
    }
  }

  function clearAll() {
    Alert.alert('Clear chat?', 'This removes every message for everyone. It can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear chat', style: 'destructive', onPress: async () => { const e = await clearChat(supabase); if (e) setErr(e); else setMsgs([]); } },
    ]);
  }

  function options(m: ChatMessage) {
    if (!uid) return;
    const mine = m.user_id === uid;
    const btns: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (!mine) btns.push({ text: 'Report', onPress: () => { reportChat(supabase, m.id); Alert.alert('Reported', 'Thanks, we’ll take a look.'); } });
    if (admin) btns.push({ text: 'Delete message', style: 'destructive', onPress: async () => { await deleteChatMessage(supabase, m.id); setMsgs((xs) => xs?.filter((x) => x.id !== m.id) ?? xs); } });
    if (admin && !mine && m.user_id) {
      btns.push({ text: 'Mute 7 days', onPress: () => banFromChat(supabase, m.user_id!, 7) });
      btns.push({ text: 'Ban from chat', style: 'destructive', onPress: () => banFromChat(supabase, m.user_id!, null) });
    }
    if (!btns.length) return;
    btns.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(m.author, m.spoiler && !shown.has(m.id) ? '(spoiler)' : m.body.slice(0, 120), btns);
  }

  const render = ({ item: m }: { item: ChatMessage }) => {
    const mine = m.user_id === uid;
    const b = m.badge ? CHAT_BADGE[m.badge] : null;
    const hidden = m.spoiler && !shown.has(m.id);
    return (
      <View style={[st.msg, mine && st.me]}>
        <View style={[st.av, { backgroundColor: m.badge === 'admin' ? '#e5192e' : chatColor(m.author) }]}>
          <Text style={st.avText}>{m.author[0]?.toUpperCase()}</Text>
        </View>
        <View style={[st.col, mine && { alignItems: 'flex-end' }]}>
          <View style={st.nameRow}>
            <Text style={st.name}>{mine ? 'You' : m.author}</Text>
            {b && <Text style={[st.badge, { backgroundColor: b.bg, color: b.fg }]}>{b.label}</Text>}
            <Text style={st.time}>{chatTime(m.created_at)}</Text>
          </View>
          <Pressable
            onPress={() => hidden && setShown((s) => new Set(s).add(m.id))}
            onLongPress={() => options(m)}
            delayLongPress={350}
            style={[st.bubble, mine && st.bubbleMe, hidden && st.spoiler]}
          >
            <Text style={hidden ? st.spoilerText : st.body}>{hidden ? '⚠ Spoiler · tap to show' : m.body}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={st.head}>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>GLE Chat</Text>
          <Text style={st.sub}>{online ? `● ${online} online` : 'Talk about movies with everyone'}</Text>
        </View>
        {uid && (
          <Pressable onPress={toggleNotify} style={st.headBtn} accessibilityLabel={notify ? 'Turn chat notifications off' : 'Turn chat notifications on'}>
            <Ionicons name={notify ? 'notifications' : 'notifications-off-outline'} size={21} color={notify ? colors.ok : colors.muted} />
          </Pressable>
        )}
        {admin && (
          <Pressable onPress={clearAll} style={st.headBtn} accessibilityLabel="Clear chat">
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        )}
      </View>
      <Text style={st.rules}>Be respectful · No links or phone numbers · 🙈 for spoilers · Hold a message to report</Text>

      <View style={{ flex: 1, paddingBottom: lift }}>
        {msgs === null ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            ref={list}
            data={[...msgs].reverse()}
            inverted
            keyExtractor={(m) => String(m.id)}
            renderItem={render}
            contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 14 }}
            ListEmptyComponent={<Text style={st.empty}>No messages yet. Say hello 👋</Text>}
            keyboardShouldPersistTaps="handled"
          />
        )}
        {err && <Pressable onPress={() => setErr(null)}><Text style={st.err}>{err}</Text></Pressable>}
        {uid ? (
          <View style={st.inputRow}>
            <Pressable onPress={() => setSpoiler((x) => !x)} style={[st.icon, spoiler && { backgroundColor: '#5b4a1a' }]} accessibilityLabel="Mark as spoiler">
              <Text style={{ fontSize: 17 }}>🙈</Text>
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={spoiler ? 'Spoiler (hidden until tapped)…' : 'Message GLE Chat…'}
              placeholderTextColor={colors.faint}
              style={st.input}
              maxLength={500}
              multiline
            />
            <Pressable onPress={send} disabled={busy || !text.trim()} style={[st.icon, st.send, (busy || !text.trim()) && { opacity: 0.45 }]} accessibilityLabel="Send">
              <Ionicons name="send" size={17} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <View style={st.signin}>
            <Button label="Create free account to chat" onPress={() => router.push('/login?mode=signup')} />
            <Button label="I already have an account" variant="ghost" onPress={() => router.push('/login')} style={{ marginTop: 8 }} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, gap: 6 },
  title: { color: colors.text, fontFamily: F.bold, fontSize: 24 },
  sub: { color: colors.ok, fontFamily: F.medium, fontSize: 12, marginTop: 1 },
  headBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  rules: { color: colors.faint, fontFamily: F.regular, fontSize: 11.5, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  empty: { color: colors.faint, fontFamily: F.regular, textAlign: 'center', marginTop: 40, transform: [{ scaleY: -1 }] },
  msg: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  me: { flexDirection: 'row-reverse' },
  av: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avText: { color: '#fff', fontFamily: F.bold, fontSize: 13 },
  col: { maxWidth: '80%', flexShrink: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { color: colors.text, fontFamily: F.bold, fontSize: 13 },
  badge: { fontFamily: F.bold, fontSize: 9.5, paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4, overflow: 'hidden' },
  time: { color: colors.faint, fontFamily: F.regular, fontSize: 11 },
  bubble: { backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.md, borderTopLeftRadius: 4, marginTop: 3 },
  bubbleMe: { backgroundColor: '#e5192e', borderTopLeftRadius: radius.md, borderTopRightRadius: 4 },
  body: { color: colors.text, fontFamily: F.regular, fontSize: 14.5, lineHeight: 20 },
  spoiler: { backgroundColor: '#24242c', borderWidth: 1, borderStyle: 'dashed', borderColor: '#555', paddingHorizontal: 18, paddingVertical: 12 },
  spoilerText: { color: '#ddd', fontFamily: F.semibold, fontSize: 12.5 },
  err: { color: colors.danger, fontFamily: F.medium, fontSize: 13, paddingHorizontal: 16, paddingVertical: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  input: { flex: 1, backgroundColor: colors.surface, color: colors.text, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontFamily: F.regular, fontSize: 15, maxHeight: 120 },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  send: { backgroundColor: '#e5192e' },
  signin: { padding: 16, borderTopWidth: 1, borderTopColor: colors.line },
});

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, F, radius } from '@/lib/theme';

export type Option = { value: string; label: string; count?: number; image?: string | null; avatar?: boolean };

/** A pill that opens a dark list sliding up from the bottom. */
export function FilterSheet({ title, options, value, onChange }: { title: string; options: Option[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const selected = options.find((o) => o.value === value) ?? options[0];
  const active = value !== '';

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${title}: ${selected.label}`}
        style={[s.trigger, active && s.triggerOn]}>
        {active && selected.avatar && <Avatar o={selected} size={20} />}
        <Text style={[s.triggerText, active && { color: '#111' }]} numberOfLines={1}>{selected.label}</Text>
        <Ionicons name="chevron-down" size={14} color={active ? '#111' : colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close" />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 10 }]}>
          <View style={s.grip} />
          <View style={s.head}>
            <Text style={s.h}>{title}</Text>
            <Pressable onPress={() => setOpen(false)} style={s.close} accessibilityLabel="Close"><Ionicons name="close" size={20} color="#fff" /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 8 }}>
            {options.map((o) => {
              const on = o.value === selected.value;
              return (
                <Pressable key={o.value || 'all'} onPress={() => { setOpen(false); onChange(o.value); }}
                  accessibilityRole="radio" accessibilityState={{ checked: on }} style={[s.opt, on && s.optOn]}>
                  {o.avatar && <Avatar o={o} size={40} />}
                  <Text style={s.optText} numberOfLines={1}>{o.label}</Text>
                  {typeof o.count === 'number' && <Text style={[s.count, on && { color: '#ffd0b8' }]}>{o.count}</Text>}
                  <View style={[s.check, on && s.checkOn]}>{on && <Ionicons name="checkmark" size={16} color="#fff" />}</View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function Avatar({ o, size }: { o: Option; size: number }) {
  if (!o.value) {
    return <View style={[s.av, { width: size, height: size, borderRadius: size / 2 }]}><Ionicons name="people" size={size * 0.5} color={colors.text} /></View>;
  }
  if (o.image) return <Image source={o.image} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />;
  const initials = o.label.replace(/^VJ\s+/i, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={[s.av, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accent }]}>
      <Text style={{ color: '#fff', fontFamily: F.extrabold, fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingLeft: 14, paddingRight: 10, borderRadius: radius.pill, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line, maxWidth: 200 },
  triggerOn: { backgroundColor: '#fff', borderColor: '#fff' },
  triggerText: { color: colors.text, fontFamily: F.semibold, fontSize: 13.5, flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { maxHeight: '75%', backgroundColor: '#14141b', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  grip: { width: 40, height: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)', alignSelf: 'center', marginTop: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  h: { color: '#fff', fontFamily: F.extrabold, fontSize: 22 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  optOn: { backgroundColor: 'rgba(255,122,47,0.14)' },
  optText: { flex: 1, color: colors.text, fontFamily: F.semibold, fontSize: 16 },
  count: { color: colors.faint, fontFamily: F.medium, fontSize: 13 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  av: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
});

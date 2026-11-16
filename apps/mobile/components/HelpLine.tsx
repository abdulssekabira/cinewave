import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { getContactInfo, telLink, whatsappLink, type ContactInfo } from '@cinewave/shared';
import { supabase } from '@/lib/supabase';
import { colors, F } from '@/lib/theme';

let cache: ContactInfo | null = null;

/**
 * "Need help? WhatsApp us · Call us" — reads the numbers from Admin → Plans →
 * Contact details; shows nothing until they're filled in.
 */
export function HelpLine({ title = 'Need help?', topic = '', style }: { title?: string; topic?: string; style?: object }) {
  const [c, setC] = useState<ContactInfo | null>(cache);
  useEffect(() => {
    if (cache) return;
    getContactInfo(supabase).then((x) => { cache = x; setC(x); }).catch(() => {});
  }, []);
  if (!c || (!c.whatsapp && !c.phone && !c.email)) return null;
  const msg = `Hello GLE Movies, I need help${topic ? ` with ${topic}` : ''}: `;
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  return (
    <View style={[s.wrap, style]}>
      <Text style={s.title}>{title}</Text>
      <View style={s.row}>
        {c.whatsapp ? (
          <Pressable onPress={() => open(whatsappLink(c.whatsapp!, msg))} style={[s.btn, s.wa]} accessibilityRole="link">
            <Ionicons name="logo-whatsapp" size={16} color="#fff" /><Text style={s.btnText}>WhatsApp us</Text>
          </Pressable>
        ) : null}
        {c.phone ? (
          <Pressable onPress={() => open(telLink(c.phone!))} style={s.btn} accessibilityRole="link">
            <Ionicons name="call-outline" size={16} color="#fff" /><Text style={s.btnText}>Call {c.phone}</Text>
          </Pressable>
        ) : null}
        {c.email ? (
          <Pressable onPress={() => open(`mailto:${c.email}`)} style={s.btn} accessibilityRole="link">
            <Ionicons name="mail-outline" size={16} color="#fff" /><Text style={s.btnText}>Email</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 18, alignItems: 'center', gap: 8 },
  title: { color: colors.muted, fontFamily: F.medium, fontSize: 13.5, textAlign: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line },
  wa: { backgroundColor: '#1f8f4e', borderColor: '#1f8f4e' },
  btnText: { color: '#fff', fontFamily: F.semibold, fontSize: 13 },
});

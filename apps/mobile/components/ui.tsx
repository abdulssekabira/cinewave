import type { ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { CatalogTitle } from '@cinewave/shared';
import { colors } from '@/lib/theme';
import { PosterCard } from './Poster';

export function Row({ label, titles, progress }: { label: string; titles: CatalogTitle[]; progress?: Record<string, number> }) {
  return (
    <View style={{ marginBottom: 28 }}>
      <Text style={s.rowLabel} accessibilityRole="header">{label}</Text>
      <FlatList
        horizontal
        data={titles}
        keyExtractor={(t) => t.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        renderItem={({ item }) => <PosterCard title={item} progress={progress?.[item.id]} />}
      />
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        s.btn,
        variant === 'primary' ? s.btnPrimary : s.btnGhost,
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.85 },
        style,
      ]}
    >
      <Text style={[s.btnText, variant === 'primary' && { color: colors.accentInk }]}>{label}</Text>
    </Pressable>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  return <View style={s.centered}>{children}</View>;
}

export function Loading() {
  return (
    <Centered>
      <ActivityIndicator color={colors.accent} />
    </Centered>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Centered>
      <Text style={s.emptyTitle}>Couldn’t load</Text>
      <Text style={s.emptyText}>{message}</Text>
      <Button label="Retry" onPress={onRetry} style={{ marginTop: 16 }} />
    </Centered>
  );
}

export function Empty({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <Centered>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{text}</Text>
      {children}
    </Centered>
  );
}

export const s = StyleSheet.create({
  rowLabel: { color: colors.text, fontSize: 17, fontWeight: '700', marginHorizontal: 16, marginBottom: 12 },
  btn: { height: 46, borderRadius: 999, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.accent },
  btnGhost: { backgroundColor: 'rgba(255,255,255,0.1)' },
  btnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.bg },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center' },
});

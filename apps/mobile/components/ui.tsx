import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { CatalogTitle } from '@cinewave/shared';
import { colors, F, radius } from '@/lib/theme';
import { PosterCard } from './Poster';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function SectionTitle({ label, action, onAction }: { label: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle} accessibilityRole="header">{label}</Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={s.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Row({ label, titles, onSeeAll }: { label: string; titles: CatalogTitle[]; onSeeAll?: () => void }) {
  return (
    <View style={{ marginBottom: 26 }}>
      <SectionTitle label={label} action={onSeeAll ? 'See all' : undefined} onAction={onSeeAll} />
      <FlatList
        horizontal
        data={titles}
        keyExtractor={(t) => t.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
        renderItem={({ item }) => <PosterCard title={item} />}
      />
    </View>
  );
}

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: IconName;
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
      {icon && <Ionicons name={icon} size={18} color="#fff" />}
      <Text style={s.btnText}>{label}</Text>
    </Pressable>
  );
}

export function IconCircle({
  icon,
  onPress,
  label,
  size = 44,
  active,
  style,
}: {
  icon: IconName;
  onPress?: () => void;
  label: string;
  size?: number;
  active?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        s.iconCircle,
        { width: size, height: size, borderRadius: size / 2 },
        active && { backgroundColor: colors.accent },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      <Ionicons name={icon} size={size * 0.45} color="#fff" />
    </Pressable>
  );
}

export function Chip({ label }: { label: string }) {
  return (
    <View style={s.chip}>
      <Text style={s.chipText}>{label}</Text>
    </View>
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
      <Ionicons name="cloud-offline-outline" size={40} color={colors.faint} style={{ marginBottom: 12 }} />
      <Text style={s.emptyTitle}>Couldn’t load</Text>
      <Text style={s.emptyText}>{message}</Text>
      <Button label="Retry" onPress={onRetry} style={{ marginTop: 18 }} />
      <Button label="Watch your downloads" variant="ghost" icon="download-outline" onPress={() => router.push('/downloads')} style={{ marginTop: 8 }} />
    </Centered>
  );
}

export function Empty({ icon, title, text, children }: { icon?: IconName; title: string; text: string; children?: ReactNode }) {
  return (
    <Centered>
      {icon && (
        <View style={s.emptyIcon}>
          <Ionicons name={icon} size={30} color={colors.accent} />
        </View>
      )}
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{text}</Text>
      {children}
    </Centered>
  );
}

export function ScreenTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={s.screenTitleRow}>
      <Text style={s.screenTitle} accessibilityRole="header">{title}</Text>
      {right}
    </View>
  );
}

export const s = StyleSheet.create({
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 20, marginBottom: 12,
  },
  sectionTitle: { color: colors.text, fontFamily: F.bold, fontSize: 17 },
  sectionAction: { color: colors.accent, fontFamily: F.semibold, fontSize: 13 },
  btn: {
    height: 52, borderRadius: radius.pill, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnPrimary: { backgroundColor: colors.accent },
  btnGhost: { backgroundColor: colors.surface },
  btnText: { color: '#fff', fontFamily: F.bold, fontSize: 15 },
  iconCircle: { backgroundColor: 'rgba(30,30,40,0.72)', alignItems: 'center', justifyContent: 'center' },
  chip: {
    backgroundColor: colors.surface, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  chipText: { color: '#d8d8e2', fontFamily: F.medium, fontSize: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.bg },
  emptyIcon: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,122,47,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { color: colors.text, fontFamily: F.bold, fontSize: 18, marginBottom: 6, textAlign: 'center' },
  emptyText: { color: colors.muted, fontFamily: F.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 300 },
  screenTitleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14,
  },
  screenTitle: { color: colors.text, fontFamily: F.bold, fontSize: 24 },
});

import { SITE } from './config';
import { imageUrl } from '@cinewave/shared';

export const colors = {
  bg: '#16161e',
  raised: '#1f1f2a',
  surface: '#2a2a37',
  surfaceHigh: '#353545',
  line: 'rgba(255,255,255,0.07)',
  text: '#ffffff',
  muted: '#a3a3b4',
  faint: '#6e6e80',
  accent: '#ff7a2f',
  accentInk: '#ffffff',
  gold: '#ffc83d',
  danger: '#ff6b6b',
  ok: '#4fd18b',
};

/** Plus Jakarta Sans — loaded in app/_layout.tsx. Use these instead of fontWeight. */
export const F = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };

/** Full URL for an image path stored in the catalogue. */
export function img(path: string | null | undefined): string | null {
  return imageUrl(path, SITE);
}

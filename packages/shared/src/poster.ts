/**
 * Generated placeholder artwork for titles without a poster yet.
 * Deterministic: the same title always gets the same colours.
 */
const PALETTES: [string, string, string][] = [
  ['#1b1f3b', '#5b2a86', '#f2a541'],
  ['#0f2027', '#2c5364', '#9be7ff'],
  ['#2b0f0f', '#8e2c2c', '#ffcf99'],
  ['#0b2015', '#1f6f4a', '#d9f99d'],
  ['#1a1325', '#7a2e5f', '#ffb3c7'],
  ['#14161a', '#3d4451', '#e7c873'],
  ['#0d1b2a', '#1b4965', '#ffd6a5'],
  ['#231b0f', '#7f5539', '#ede0d4'],
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface PosterPalette {
  from: string;
  to: string;
  accent: string;
  angle: number;
}

export function posterPalette(key: string): PosterPalette {
  const h = hash(key);
  const [from, to, accent] = PALETTES[h % PALETTES.length];
  return { from, to, accent, angle: 140 + (h % 70) };
}

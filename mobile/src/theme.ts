import { useColorScheme, type TextStyle } from 'react-native';

/**
 * Mêmes tokens que le frontend web (docs/ui-ux-principes.md) : un accent vert profond,
 * neutres légèrement chauds, contraste ≥ 4.5:1, mode sombre suivant le système.
 */
export interface Palette {
  bg: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  onAccent: string;
  danger: string;
  dangerSoft: string;
  userBubble: string;
}

export const light: Palette = {
  bg: '#faf9f6',
  surface: '#ffffff',
  surfaceMuted: '#f1efe9',
  border: '#d9d5cb',
  borderStrong: '#b8b2a3',
  text: '#1c1b18',
  textMuted: '#5c594f',
  accent: '#0f6b3f',
  accentStrong: '#0b5231',
  accentSoft: '#e3f1e9',
  onAccent: '#ffffff',
  danger: '#9b1c1c',
  dangerSoft: '#fbe9e9',
  userBubble: '#e9e6dd',
};

export const dark: Palette = {
  bg: '#15161a',
  surface: '#1d1f24',
  surfaceMuted: '#262930',
  border: '#383c45',
  borderStrong: '#545a66',
  text: '#ecebe6',
  textMuted: '#a9a89f',
  accent: '#5fc48f',
  accentStrong: '#8ad9ae',
  accentSoft: '#1d3328',
  onAccent: '#15161a',
  danger: '#f08a8a',
  dangerSoft: '#3a1f1f',
  userBubble: '#2b2e36',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;
export const type = {
  body: { fontSize: 16, lineHeight: 24 },
  small: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  value: { fontSize: 18, lineHeight: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

/** Taille minimale des cibles tactiles. */
export const TOUCH = 44;

export function useTheme(): { palette: Palette; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { palette: isDark ? dark : light, isDark };
}

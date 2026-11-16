import { AccentPreset, ThemeMode, UserPreferences } from '../types/schedule';

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'ios-blue', name: 'Xanh iOS', hex: '#007AFF' },
  { id: 'indigo', name: 'Chàm Tập Trung', hex: '#4F46E5' },
  { id: 'teal', name: 'Ngọc Bích', hex: '#0D9488' },
  { id: 'rose', name: 'San Hô Ấm', hex: '#E11D48' },
  { id: 'amber', name: 'Cam Năng Lượng', hex: '#EA580C' },
  { id: 'mono', name: 'Đơn Sắc', hex: '#18181B', darkHex: '#E4E4E7' },
];

export const DEFAULT_PREFERENCES: UserPreferences = {
  themeMode: 'system',
  accentColor: '#007AFF',
  quietHoursEnabled: true,
  quietHoursStart: '22:30',
  quietHoursEnd: '06:30',
  pushEnabled: false,
  smartLeadHigh: 30,
  smartLeadMedium: 15,
  smartLeadLow: 5,
};

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [0, 122, 255];
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [
    Number.isFinite(r) ? r : 0,
    Number.isFinite(g) ? g : 122,
    Number.isFinite(b) ? b : 255,
  ];
}

export function getRelativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getContrastForeground(hex: string): string {
  return getRelativeLuminance(hex) > 0.45 ? '#0F172A' : '#FFFFFF';
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function resolveEffectiveAccent(accentHex: string, isDark: boolean): string {
  if (accentHex.toUpperCase() === '#18181B' && isDark) {
    return '#E4E4E7';
  }
  return accentHex;
}

export function applyThemeToDocument(themeMode: ThemeMode, accentColor: string): boolean {
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = themeMode === 'dark' || (themeMode === 'system' && prefersDark);

  const root = document.documentElement;
  root.classList.toggle('dark', isDark);

  const effectiveAccent = resolveEffectiveAccent(accentColor, isDark);
  const accentFg = getContrastForeground(effectiveAccent);

  root.style.setProperty('--accent', effectiveAccent);
  root.style.setProperty('--accent-fg', accentFg);
  root.style.setProperty('--accent-soft', hexToRgba(effectiveAccent, isDark ? 0.2 : 0.12));
  root.style.setProperty('--accent-border', hexToRgba(effectiveAccent, isDark ? 0.38 : 0.28));

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', isDark ? '#0B0F17' : '#F8FAFC');
  }

  return isDark;
}

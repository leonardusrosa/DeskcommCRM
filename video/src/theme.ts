/**
 * DeskcommCRM Video Theme Tokens
 *
 * Synchronized with the canonical Deskcomm Sage palette defined in:
 * - app/globals.css (lines 49-65)
 * - app/design/lib/tokens.ts (PALETTES.sage)
 */

export const DESKCOMM_SAGE = {
  50: '#f3f6f1',
  100: '#e4ebe0',
  200: '#c8d6c1',
  300: '#a4ba9a',
  400: '#82a077',
  500: '#67885d',
  600: '#506d48', // Canonical primary light accent
  700: '#41573b', // Hover / deep accent
  800: '#374731',
  900: '#2f3c2b',
  950: '#171f15',
} as const;

export const VIDEO_THEME = {
  accent: DESKCOMM_SAGE[600],
  accentHover: DESKCOMM_SAGE[700],
  accentDeep: DESKCOMM_SAGE[800],
  accentSoft: DESKCOMM_SAGE[100],
  accentSurface: DESKCOMM_SAGE[50],
  accentBorder: DESKCOMM_SAGE[200],
  accentBorderFocus: DESKCOMM_SAGE[400],
  accentText: DESKCOMM_SAGE[700],
  accentDark: DESKCOMM_SAGE[400],
  glowLight: 'rgba(80, 109, 72, 0.15)',
  glowAmbient: 'rgba(200, 214, 193, 0.35)',
  ringHighlight: 'rgba(80, 109, 72, 0.20)',
  highlightBg: 'rgba(80, 109, 72, 0.08)',
} as const;

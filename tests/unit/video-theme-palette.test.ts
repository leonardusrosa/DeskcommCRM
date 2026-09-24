import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DESKCOMM_SAGE, VIDEO_THEME } from '../../video/src/theme';

describe('Video Theme - Deskcomm Sage Synchronization', () => {
  const RAIZ = process.cwd();
  const globalsCss = fs.readFileSync(path.join(RAIZ, 'app/globals.css'), 'utf8');

  it('matches all 11 stops of the canonical Sage ramp in app/globals.css', () => {
    const stops = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

    for (const stop of stops) {
      const rx = new RegExp(`--color-accent-${stop}:\\s*(#[0-9a-fA-F]{6});`);
      const match = globalsCss.match(rx);
      expect(match, `missing --color-accent-${stop} in app/globals.css`).not.toBeNull();
      const cssHex = (match?.[1] ?? '').toLowerCase();
      expect(DESKCOMM_SAGE[stop].toLowerCase()).toBe(cssHex);
    }
  });

  it('uses canonical light and dark accents matching app/globals.css', () => {
    expect(VIDEO_THEME.accent).toBe(DESKCOMM_SAGE[600]);
    expect(VIDEO_THEME.accentDark).toBe(DESKCOMM_SAGE[400]);
    expect(VIDEO_THEME.accentHover).toBe(DESKCOMM_SAGE[700]);
  });
});

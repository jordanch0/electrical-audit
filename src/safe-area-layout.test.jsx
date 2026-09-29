// Fixes #4 and #5 (2026-09-29), found on a real installed Home Screen (standalone) session:
// #4 — the Home-screen Calendar/Settings pills sat too high; they must sit 1.5x their own ~36px height above the
//      bottom, not a flat 12px, while still adding env(safe-area-inset-bottom) so they clear the home indicator.
// #5 — every module's bottom nav bar padded with a hardcoded 34px instead of the real env(safe-area-inset-bottom),
//      so it never lined up flush with the actual home-indicator inset on a device where 34px is wrong.
//
// Note on jsdom: jsdom's CSSOM does not understand the `env()` CSS function — assigning it to `style.paddingBottom`
// silently no-ops (it never even reaches the style attribute), and `calc()` values get their operands reordered.
// So #5 is verified by reading the source (a legitimate way to pin a static CSS-in-JS string jsdom can't render
// faithfully) and #4's DOM check normalises both sides through jsdom's own CSSOM before comparing, so operand
// reordering can't produce a false failure.
import fs from 'fs';
import path from 'path';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AppRoot, { HOME_PILL_HEIGHT_PX, HOME_PILL_BOTTOM } from './App.jsx';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('Home-screen pills sit at 1.5x their own height above the bottom (#4)', () => {
  it('HOME_PILL_BOTTOM = env(safe-area-inset-bottom) + 1.5x the pill height, not a flat 12px', () => {
    expect(HOME_PILL_HEIGHT_PX).toBe(36);
    expect(HOME_PILL_BOTTOM).toContain('54px');
    expect(HOME_PILL_BOTTOM).toContain('env(safe-area-inset-bottom');
    expect(HOME_PILL_BOTTOM).not.toMatch(/\+\s*12px/);
  });
  it('both the Calendar and Settings pills use that same offset', async () => {
    render(<AppRoot />);
    const cal = await screen.findByTestId('calendar-pill');
    const settings = await screen.findByTestId('settings-pill');
    const probe = document.createElement('div'); probe.style.bottom = HOME_PILL_BOTTOM; // normalise via jsdom's own CSSOM
    expect(cal.style.bottom).toBe(probe.style.bottom);
    expect(settings.style.bottom).toBe(probe.style.bottom);
  });
});

describe('Every module bottom nav is flush with the bottom, respecting only the real safe-area inset (#5)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8');
  // every bottomNav:{...} / bottomNav: {...} block (single- or multi-line) up to its closing brace
  const blocks = [...src.matchAll(/bottomNav:\s*\{[^}]*\}/g)].map(m => m[0]);

  it('at least one bottomNav style block exists per module (sanity — the scan itself must find something)', () => {
    expect(blocks.length).toBeGreaterThanOrEqual(7); // S(RCD) SI(IEL) CAL_STYLE ST(TAT) STH(Thermo) swbStyles() irtStyles()
  });
  it('every bottomNav block uses env(safe-area-inset-bottom) for its bottom padding', () => {
    blocks.forEach(b => expect(b).toMatch(/paddingBottom:\s*"env\(safe-area-inset-bottom,\s*0px\)"/));
  });
  it('no bottomNav block hardcodes a flat 34px any more', () => {
    blocks.forEach(b => expect(b).not.toMatch(/paddingBottom:\s*"34px"/));
  });
});

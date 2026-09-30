// Fixes #4 and #5 (2026-09-29, both found still broken on a real installed Home Screen session and re-fixed
// 2026-09-30):
// #4 — the Home-screen Calendar/Settings pills sat too high, THEN (after the 2026-09-29 fix moved them further from
//      the bottom) started covering the last module card instead. The root cause: the pills were `position:fixed`,
//      floating OVER the scrollable module grid — whatever content happened to be scrolled to that exact screen
//      position (including the last card) could end up directly behind them. A trailing spacer sized to the pills'
//      geometry (the first 2026-09-30 attempt) only ever protected the ONE scroll position where it lined up with
//      the still-floating pills, not every scroll position in between — confirmed still broken. The real fix: the
//      pills now live in a genuine, non-scrolling flex row reserved BELOW the scrollable content (not overlaid on
//      top of it), so the grid can never scroll behind them at any scroll position, regardless of card count.
// #5 — every module's bottom nav bar hardcoded 34px of bottom padding instead of the real
//      env(safe-area-inset-bottom) (fixed 2026-09-29) — but a separate, pre-existing bug in index.html's keyboard-
//      inset tracking (`--kb-inset`, applied as the nav's own margin-bottom) could read a standing, non-zero
//      difference between window.innerHeight and visualViewport.height in an installed standalone session (even
//      with no keyboard open) and apply it as a permanent extra margin, pushing the nav up and leaving a visible
//      gap of page background below it. Fixed 2026-09-30 by tracking the LOWEST observed diff as the resting
//      baseline and reporting only the amount above it.
//
// Note on jsdom: jsdom's CSSOM does not understand the `env()` CSS function — assigning it to `style.paddingBottom`
// silently no-ops (it never even reaches the style attribute), and `calc()` values get their operands reordered.
// So #5's nav padding is verified by reading the source (a legitimate way to pin a static CSS-in-JS string jsdom
// can't render faithfully). index.html's keyboard-inset script is plain, non-modularised JS (by design — it must
// run before the React bundle loads), so its resting-baseline behaviour is verified two ways: a source-text check
// that the fixed pattern (tracking a minimum, not the raw instantaneous diff) is present, and a faithful
// re-implementation of the same algorithm exercised directly against synthetic readings.
import fs from 'fs';
import path from 'path';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AppRoot, { HOME_PILL_HEIGHT_PX, HOME_PILL_BAR_PADDING_BOTTOM } from './App.jsx';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('Home-screen pills sit in a real, non-scrolling bar — never floating over the scrollable grid (#4, re-fixed 2026-09-30)', () => {
  it('HOME_PILL_BAR_PADDING_BOTTOM keeps the originally-approved 1.5x-height spacing, not a flat 12px', () => {
    expect(HOME_PILL_HEIGHT_PX).toBe(36);
    expect(HOME_PILL_BAR_PADDING_BOTTOM).toContain('54px');
    expect(HOME_PILL_BAR_PADDING_BOTTOM).toContain('env(safe-area-inset-bottom');
    expect(HOME_PILL_BAR_PADDING_BOTTOM).not.toMatch(/\+\s*12px/);
  });
  it('neither pill uses position:fixed any more — both are static children of the reserved bar', async () => {
    render(<AppRoot />);
    const cal = await screen.findByTestId('calendar-pill');
    const settings = await screen.findByTestId('settings-pill');
    expect(cal.style.position).not.toBe('fixed');
    expect(settings.style.position).not.toBe('fixed');
    expect(cal.style.bottom).toBe('');
    expect(settings.style.bottom).toBe('');
  });
  it('the pill bar is a sibling of the scrollable content, not nested inside it — scrolling the grid can never move or hide the bar', async () => {
    render(<AppRoot />);
    const cal = await screen.findByTestId('calendar-pill');
    const grid = await screen.findByText('GENERAL SITE DEFECTS');
    // walk up from each to find the nearest ancestor that is itself scrollable (overflowY !== visible/undefined in jsdom's inline-style world)
    function scrollableAncestor(el) {
      let node = el.parentElement;
      while (node) { if (node.style && node.style.overflowY === 'scroll') return node; node = node.parentElement; }
      return null;
    }
    const gridScrollAncestor = scrollableAncestor(grid);
    const pillScrollAncestor = scrollableAncestor(cal);
    expect(gridScrollAncestor).not.toBeNull();     // the grid IS inside a scrollable region
    expect(pillScrollAncestor).toBeNull();          // the pill bar is NOT inside any scrollable region
  });
  it('the bar keeps Calendar visually centred and Settings pinned to the right (3-column grid: 1fr / auto / 1fr)', async () => {
    render(<AppRoot />);
    const cal = await screen.findByTestId('calendar-pill');
    const settings = await screen.findByTestId('settings-pill');
    const bar = cal.parentElement;
    expect(bar).toBe(settings.parentElement);
    expect(bar.style.display).toBe('grid');
    expect(bar.style.gridTemplateColumns).toBe('1fr auto 1fr');
    expect(settings.style.justifySelf).toBe('end');
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

describe('Keyboard-inset tracking uses a resting baseline, not the raw instantaneous diff (#5, 2026-09-30)', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  it('index.html tracks a running minimum ("resting" baseline) rather than reporting window.innerHeight - vv.height directly', () => {
    expect(html).toMatch(/restingDiff/);
    expect(html).toMatch(/raw\s*-\s*restingDiff/);
    expect(html).not.toMatch(/setProperty\(\s*'--kb-inset',\s*Math\.max\(0,\s*Math\.round\(\s*window\.innerHeight/);
  });
  // A faithful re-implementation of the fixed algorithm (index.html's script can't be imported directly — it's
  // deliberately inline, non-modularised JS that must run before the bundle loads) exercised against synthetic
  // visualViewport readings.
  function makeTracker() {
    let restingDiff = Infinity;
    return raw => {
      if (raw < restingDiff) restingDiff = raw;
      return Math.max(0, Math.round(raw - restingDiff));
    };
  }
  it('a standing non-zero resting diff (standalone-mode quirk) is cancelled out to 0, not read as a keyboard', () => {
    const track = makeTracker();
    expect(track(34)).toBe(0);   // first reading becomes the baseline
    expect(track(34)).toBe(0);   // stays 0 as long as nothing changes
    expect(track(34)).toBe(0);
  });
  it('a real keyboard opening is still detected as the INCREASE above the resting baseline', () => {
    const track = makeTracker();
    track(34);                   // resting baseline established at 34 (standalone quirk)
    expect(track(34 + 300)).toBe(300);   // keyboard opens: +300px on top of the baseline
    expect(track(34)).toBe(0);           // keyboard closes: back to the baseline
  });
  it('self-corrects if a later reading is lower than the first (e.g. after rotation)', () => {
    const track = makeTracker();
    track(34);
    expect(track(10)).toBe(0);    // new, lower resting state — becomes the new baseline
    expect(track(10 + 300)).toBe(300);
  });
});

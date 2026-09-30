// Fixes #4 and #5, full history:
// 2026-09-29 — #4: the Home-screen Calendar/Settings pills sat too high; #5: every module's bottom nav bar
//   hardcoded 34px of bottom padding instead of env(safe-area-inset-bottom).
// 2026-09-30 (first re-fix) — both confirmed STILL broken on a real installed Home Screen session:
//   #4's root cause was architectural: the pills were `position:fixed`, floating OVER the scrollable module grid,
//   so whatever content scrolled to that exact screen position (including the last card) could end up directly
//   behind them; a trailing spacer only protected the ONE scroll position where it lined up with the still-floating
//   pills. Fixed by moving the pills into a genuine non-scrolling flex row reserved BELOW the scrollable content.
//   #5's env() fix was necessary but not sufficient: a separate bug in index.html's keyboard-inset tracking
//   (`--kb-inset`, applied as the nav's own margin-bottom) could read a standing non-zero
//   window.innerHeight/visualViewport.height difference in standalone mode even with no keyboard open, adding a
//   permanent phantom margin below the nav. Fixed by tracking the lowest-ever-observed diff as a resting baseline.
// 2026-09-30 (Facebook-style restyle, replaces the visual half of both prior fixes — the non-scrolling-bar
//   architecture from the first re-fix is KEPT, only the skin changed): both bars now use the same overlay
//   treatment as Facebook's bottom nav — background matches the page (not a filled contrasting strip), a single
//   thin top border as the only divider, no box-shadow fill trick, and a shorter, more compact height. The Home
//   bar's two buttons changed from bordered/shadowed pills to plain icon+label buttons (NavBtn's own shape),
//   arranged as a flex row (Calendar then Settings, left to right) rather than a "one centred, one pinned right"
//   pill layout.
//
// Note on jsdom: jsdom's CSSOM does not understand the `env()` CSS function — assigning it to `style.paddingBottom`
// silently no-ops (it never even reaches the style attribute). So the nav padding and background are verified by
// reading the source (a legitimate way to pin a static CSS-in-JS string jsdom can't render faithfully).
// index.html's keyboard-inset script is plain, non-modularised JS (by design — it must run before the React bundle
// loads), so its resting-baseline behaviour is verified two ways: a source-text check that the fixed pattern
// (tracking a minimum, not the raw instantaneous diff) is present, and a faithful re-implementation of the
// algorithm exercised directly against synthetic readings.
import fs from 'fs';
import path from 'path';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AppRoot from './App.jsx';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('Home bar: non-scrolling reserved row, never floating over the scrollable grid (#4, architecture kept from the 2026-09-30 re-fix)', () => {
  it('neither button uses position:fixed any more — both are static children of the reserved bar', async () => {
    render(<AppRoot />);
    const cal = await screen.findByTestId('calendar-pill');
    const settings = await screen.findByTestId('settings-pill');
    expect(cal.style.position).not.toBe('fixed');
    expect(settings.style.position).not.toBe('fixed');
    expect(cal.style.bottom).toBe('');
    expect(settings.style.bottom).toBe('');
  });
  it('the bar is a sibling of the scrollable content, not nested inside it — scrolling the grid can never move or hide it', async () => {
    render(<AppRoot />);
    const cal = await screen.findByTestId('calendar-pill');
    const grid = await screen.findByText('GENERAL SITE DEFECTS');
    function scrollableAncestor(el) {
      let node = el.parentElement;
      while (node) { if (node.style && node.style.overflowY === 'scroll') return node; node = node.parentElement; }
      return null;
    }
    expect(scrollableAncestor(grid)).not.toBeNull();   // the grid IS inside a scrollable region
    expect(scrollableAncestor(cal)).toBeNull();        // the bar is NOT inside any scrollable region
  });
  it('Calendar still comes before Settings, left to right', async () => {
    render(<AppRoot />);
    const cal = await screen.findByTestId('calendar-pill');
    const settings = await screen.findByTestId('settings-pill');
    expect(cal.parentElement).toBe(settings.parentElement);
    expect(cal.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('Home bar restyled as a Facebook-style overlay (2026-09-30): no filled strip, no bordered pills, compact height', () => {
  it('the bar background matches the page background, with only a thin top border as the divider — no box-shadow fill', async () => {
    render(<AppRoot />);
    const bar = (await screen.findByTestId('calendar-pill')).parentElement;
    expect(bar.style.background).toBe('rgb(232, 230, 226)'); // #e8e6e2 — the page's own background, not the old #f7f6f3 strip
    expect(bar.style.borderTop).toBe('1px solid rgb(228, 228, 231)'); // #e4e4e7, normalised by jsdom's CSSOM
    expect(bar.style.boxShadow).toBe('');
  });
  it('each button is a plain icon+label — no border, no background fill, no box-shadow (not a pill any more)', async () => {
    render(<AppRoot />);
    const cal = await screen.findByTestId('calendar-pill');
    const settings = await screen.findByTestId('settings-pill');
    [cal, settings].forEach(btn => {
      expect(btn.style.borderStyle).toBe('none'); // border:"none" — jsdom's CSSOM reports the shorthand's width as "medium" (the initial value), so check borderStyle instead
      expect(btn.style.background).toBe('transparent');
      expect(btn.style.boxShadow).toBe('');
      expect(btn.style.borderRadius).toBe('');
    });
  });
  it('the bar is a compact flex row (each button flex:1), not a 3-column centred/pinned grid any more', async () => {
    render(<AppRoot />);
    const cal = await screen.findByTestId('calendar-pill');
    const bar = cal.parentElement;
    expect(bar.style.display).toBe('flex');
    expect(cal.style.flex).toBe('1 1 0%'); // flex:1 shorthand, normalised by jsdom's CSSOM
  });
});

describe('Every module bottom nav is an overlay too: page background, thin top border, no filled strip (#5)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8');
  const blocks = [...src.matchAll(/bottomNav:\s*\{[^}]*\}/g)].map(m => m[0]);

  it('at least one bottomNav style block exists per module (sanity — the scan itself must find something)', () => {
    expect(blocks.length).toBeGreaterThanOrEqual(7); // S(RCD) SI(IEL) CAL_STYLE ST(TAT) STH(Thermo) swbStyles() irtStyles()
  });
  it('every bottomNav block uses env(safe-area-inset-bottom) for its bottom padding, never a flat 34px', () => {
    blocks.forEach(b => {
      expect(b).toMatch(/paddingBottom:\s*"env\(safe-area-inset-bottom,\s*0px\)"/);
      expect(b).not.toMatch(/paddingBottom:\s*"34px"/);
    });
  });
  it('every bottomNav block\'s background matches the page (#e8e6e2), not the old contrasting #f7f6f3 strip', () => {
    blocks.forEach(b => expect(b).toMatch(/background:\s*"#e8e6e2"/));
  });
  it('no bottomNav block uses the old 200px box-shadow fill trick any more', () => {
    blocks.forEach(b => expect(b).not.toMatch(/boxShadow/));
  });
});

describe('NavBtn (and its 3 module-local copies) are shorter, matching Facebook\'s compactness', () => {
  const src = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8');
  // the 4 nav-button component bodies: shared NavBtn, and IEL/TAT/SWB's own copies
  const names = ['NavBtn', 'IELNavBtn', 'TATNavBtn', 'SWBNavBtn'];
  it('all 4 implementations exist (sanity — the scan itself must find every one)', () => {
    names.forEach(n => expect(src).toMatch(new RegExp(`function ${n}\\(`)));
  });
  it('none of them use the old minHeight:50 any more', () => {
    expect(src).not.toMatch(/minHeight:\s*50\b/);
  });
  it('all 4 use the new compact minHeight:42', () => {
    const count = (src.match(/minHeight:\s*42\b/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(4);
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

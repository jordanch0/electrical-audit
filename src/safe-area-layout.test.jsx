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
// 2026-10-01 (floating pill, true overlay): both bars are now ONE shared floating pill (NAV_PILL_STYLE) position:absolute
//   OVER the content, so every scrollable screen pads its bottom with NAV_CLEARANCE (guarded below). Supersedes the
//   2026-09-30 flat-bar assertions (page background, top border, no shadow, minHeight 42), which are gone.
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

describe('Home bar is the shared floating pill (2026-10-01): rounded, shadowed, detached, narrow', () => {
  it('the bar is a fully-rounded floating pill with a soft drop shadow, a thin border and a translucent white background', async () => {
    render(<AppRoot />);
    const bar = (await screen.findByTestId('calendar-pill')).parentElement;
    expect(bar.style.position).toBe('absolute');
    expect(bar.style.borderRadius).toBe('999px');
    expect(bar.style.boxShadow).toBe('0 4px 16px rgba(0,0,0,0.12)');
    expect(bar.style.border).toMatch(/^1px solid/);
    expect(bar.style.background).toBe('rgba(255, 255, 255, 0.92)');
  });
  it('it is the NARROW variant (capped width, centred), not stretched across the whole screen', async () => {
    render(<AppRoot />);
    const bar = (await screen.findByTestId('calendar-pill')).parentElement;
    expect(bar.style.maxWidth).toBe('240px');
    expect(bar.style.marginLeft).toBe('auto');
    expect(bar.style.marginRight).toBe('auto');
  });
  it('the buttons are the shared NAV_BTN_STYLE: no border, transparent, rounded highlight shape, >= 44px tap target', async () => {
    render(<AppRoot />);
    const cal = await screen.findByTestId('calendar-pill');
    const settings = await screen.findByTestId('settings-pill');
    [cal, settings].forEach(btn => {
      expect(btn.style.borderStyle).toBe('none');
      expect(btn.style.background).toBe('transparent');
      expect(btn.style.borderRadius).toBe('22px');
      expect(parseInt(btn.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
      expect(btn.style.flex).toBe('1 1 0%');
    });
  });
});

describe('Every module bottom nav is the ONE shared floating pill (NAV_PILL_STYLE)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8');
  const uses = [...src.matchAll(/bottomNav:\s*NAV_PILL_STYLE\b/g)];
  it('every module style object (S, SI, CAL_STYLE, ST, STH, swbStyles, irtStyles) points bottomNav at NAV_PILL_STYLE', () => {
    expect(uses.length).toBeGreaterThanOrEqual(7);
  });
  it('no module redefines its own bottomNav (a per-module copy is how the bars drifted apart before)', () => {
    expect([...src.matchAll(/bottomNav:\s*\{/g)].length).toBe(0);
  });
  it('NAV_PILL_STYLE floats: absolute, inset from the sides, safe-area aware, fully rounded, with the drop shadow', () => {
    const def = src.match(/const NAV_PILL_STYLE = \{[\s\S]*?\n\};/)[0];
    expect(def).toMatch(/position:"absolute"/);
    expect(def).toMatch(/left:NAV_SIDE,right:NAV_SIDE/);
    expect(def).toMatch(/bottom:NAV_BOTTOM\b/);      // the ONE shared offset — no per-place number
    expect(def).toMatch(/borderRadius:999/);
    expect(def).toMatch(/boxShadow:"0 4px 16px rgba\(0,0,0,0\.12\)"/);
  });
});

describe('ONE nav button for every module', () => {
  const src = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8');
  it('IEL / TAT / SWB / Thermo / IRT nav buttons are aliases of NavBtn — no second implementation to drift', () => {
    ['IELNavBtn', 'TATNavBtn', 'SWBNavBtn', 'ThermoNavBtn', 'IRTNavBtn'].forEach(n =>
      expect(src).toMatch(new RegExp(`function ${n}\\(props\\)\\s*\\{\\s*return React\\.createElement\\(NavBtn,\\s*props\\);?\\s*\\}`)));
  });
  it('the active tab is a tinted rounded highlight, not the old 2px top border; tap target >= 44px; labels never wrap', () => {
    expect(src).toMatch(/NAV_ACTIVE_BG = "#fdeadb"/);
    expect(src).not.toMatch(/borderTop:active/);
    expect(src).toMatch(/const NAV_BTN_H = 44;/);   // tap target never below 44
    expect(src).toMatch(/minHeight:NAV_BTN_H,borderRadius:NAV_BTN_H\/2/);
    expect(src).toMatch(/whiteSpace:"nowrap"/);
  });
});

// The regression this whole design exists to prevent (CLAUDE.md: the overlay pattern broke twice before — the last
// card ended up hidden behind the bar). The pill is position:absolute OVER the scroll area, so EVERY scroll area on a
// screen that shows the pill must pad its bottom with NAV_CLEARANCE — never a hard-coded number.
describe('NAV_CLEARANCE: every scrollable nav screen clears the floating pill', () => {
  const src = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8');
  it('NAV_CLEARANCE is built from the pill height and the SAME bottom offset the pill uses (so they cannot drift apart)', () => {
    const def = src.match(/const NAV_CLEARANCE = .*;/)[0];
    expect(def).toMatch(/NAV_PILL_H/);
    expect(def).toMatch(/NAV_BOTTOM/);
  });
  it('NAV_BOTTOM dips into the safe area (inset - 14px) but never below the 8px minimum; viewport-fit=cover is set so the inset is real', () => {
    const def = src.match(/const NAV_BOTTOM = .*;/)[0];
    expect(def).toMatch(/max\(\$\{NAV_GAP_BOTTOM\}px, calc\(env\(safe-area-inset-bottom, 0px\) - 14px\)\)/);
    expect(src).toMatch(/const NAV_GAP_BOTTOM = 8;/);
    expect(src).toMatch(/const NAV_PILL_H = 52;/);
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    expect(html).toMatch(/name="viewport"[^>]*viewport-fit=cover/);
  });
  it('every module main scroll region (S, SI, CAL_STYLE, ST, STH, swbStyles, irtStyles) pads its bottom with NAV_CLEARANCE', () => {
    const mains = [...src.matchAll(/\n\s*main:\s*\{[^}]*\}/g)].map(m => m[0]).filter(m => /overflowY/.test(m));
    expect(mains.length).toBeGreaterThanOrEqual(7);
    mains.forEach(m => expect(m).toMatch(/paddingBottom:\s*NAV_CLEARANCE/));
  });
  it('the Home module grid pads its bottom with NAV_CLEARANCE (it was clipped before)', () => {
    const i = src.indexOf('paddingTop:"calc(env(safe-area-inset-top, 0px) + 20px)"');
    expect(src.slice(i, i + 200)).toMatch(/paddingBottom:NAV_CLEARANCE/);
  });
  it('no screen hard-codes a 80 / 100 bottom padding to dodge the bar any more', () => {
    expect(src).not.toMatch(/paddingBottom:\s*(80|100)\b/);
  });
});

describe('Pill vs on-screen keyboard (2026-10-01): never lifted by --kb-inset, hidden while a field is focused', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('(function () {', html.indexOf('Keyboard handling for the floating pill nav'));
  const end = html.indexOf('})();', start) + '})();'.length;
  const script = html.slice(start, end);
  const root = document.documentElement;

  function boot() {
    document.body.innerHTML = '<div id="root"><nav><button id="navbtn">Home</button></nav><input id="aud" type="text"/><textarea id="ta"></textarea><input id="chk" type="checkbox"/></div>';
    root.classList.remove('kb-open');
    root.style.setProperty('--kb-inset', '300px');   // a stale value left by an older session
    new Function(script)();
  }
  const tick = ms => new Promise(r => setTimeout(r, ms));

  it('index.html no longer applies --kb-inset to the nav, and the old resting-baseline tracker is gone', () => {
    expect(html).not.toMatch(/margin-bottom:\s*var\(--kb-inset/);
    expect(html).not.toMatch(/setProperty\(\s*'--kb-inset'/);
    expect(html).not.toMatch(/restingDiff/);
  });
  it('CSS hides the pill while html.kb-open (opacity 0, pointer-events none) with a short transition', () => {
    expect(html).toMatch(/html\.kb-open #root nav\s*\{[^}]*opacity:\s*0 !important[^}]*pointer-events:\s*none !important/);
    expect(html).toMatch(/#root nav\s*\{\s*transition:\s*opacity/);
  });
  it('no source file reads --kb-inset any more (nothing can depend on it)', () => {
    const app = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8');
    expect(app).not.toMatch(/kb-inset/);
  });
  it('clears a stale --kb-inset left by an older session on boot', () => {
    boot();
    expect(root.style.getPropertyValue('--kb-inset')).toBe('');
  });
  it('focusing a text input / textarea hides the pill (kb-open); blurring brings it back', async () => {
    boot();
    expect(root.classList.contains('kb-open')).toBe(false);
    document.getElementById('aud').focus();
    expect(root.classList.contains('kb-open')).toBe(true);
    document.getElementById('aud').blur();
    await tick(80);
    expect(root.classList.contains('kb-open')).toBe(false);
    document.getElementById('ta').focus();
    expect(root.classList.contains('kb-open')).toBe(true);
    document.getElementById('ta').blur();
    await tick(80);
    expect(root.classList.contains('kb-open')).toBe(false);
  });
  it('a checkbox (no keyboard) never hides the pill', () => {
    boot();
    document.getElementById('chk').focus();
    expect(root.classList.contains('kb-open')).toBe(false);
  });
  it('moving focus straight from one field to another keeps the pill hidden (no flash)', async () => {
    boot();
    document.getElementById('aud').focus();
    document.getElementById('ta').focus();
    await tick(80);
    expect(root.classList.contains('kb-open')).toBe(true);
  });
  it('pressing a nav button with the keyboard up blurs the field and shows the pill again straight away', () => {
    boot();
    const input = document.getElementById('aud');
    input.focus();
    expect(root.classList.contains('kb-open')).toBe(true);
    document.getElementById('navbtn').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(document.activeElement).not.toBe(input);
    expect(root.classList.contains('kb-open')).toBe(false);
  });
  it('a visualViewport-style resize event re-syncs from the real focus, so a missed focusout can never leave it stuck', async () => {
    boot();
    document.getElementById('aud').focus();
    expect(root.classList.contains('kb-open')).toBe(true);
    document.getElementById('aud').blur();
    root.classList.add('kb-open');                 // simulate a stale class (a missed event)
    window.dispatchEvent(new Event('resize'));
    expect(root.classList.contains('kb-open')).toBe(false);
  });
});

describe('iOS standalone short web view (2026-10-01): html/body must be 100vh, not just 100%', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  it('html, body declare height:100% (fallback) and then height:100vh — the real-iPhone experiment that made innerHeight 879 -> 926', () => {
    const rule = html.match(/html, body \{[\s\S]*?\n    \}/)[0];
    expect(rule).toMatch(/height:\s*100%;/);
    expect(rule).toMatch(/height:\s*100vh;/);
    expect(rule.indexOf('100vh')).toBeGreaterThan(rule.indexOf('100%;'));   // the vh line must come LAST to win
  });
  it('no JS sizing hack is involved: nothing in index.html reads screen.height to size the app', () => {
    expect(html).not.toMatch(/screen\.height/);
  });
});

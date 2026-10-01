# 2026-10-01 — Floating pill bottom nav (+ keyboard hide, + iOS standalone viewport height)

**Status: committed as `9640df4` on `dev`, verified on iPhone via the dev server, NOT yet verified on the deployed build.**

Reference: Facebook's iOS floating tab bar (`IMG_0200.PNG`, 428x926 @3x): pill ~47pt tall, bottom edge ~19pt from the screen bottom, ~11pt side margins, soft shadow, pale active highlight.

## What was built

- **One floating pill for every bottom nav** — all 9 modules (RCD, IEL, TAT, Thermo, SWB, ELT, Welder, GSD, IRT), Calendar, and the module-select (Home) screen (narrow 2-tab variant, max 240px, centred). Replaces the flat full-width bar + 2px top-border active state.
  - `NAV_PILL_STYLE` / `NAV_PILL_STYLE_NARROW`: `position:absolute`, 14px from the sides, `borderRadius:999`, translucent white + blur, `0 4px 16px rgba(0,0,0,0.12)` shadow.
  - ONE button, `NavBtn`; `IELNavBtn` / `TATNavBtn` / `SWBNavBtn` / `ThermoNavBtn` / `IRTNavBtn` are aliases. The Calendar bar's three hand-built buttons were converted to `NavBtn` as well. Active tab = `#fdeadb` rounded highlight, `#a3530f` icon + label; inactive `#3f3f46`; 11px labels; 44px tap targets.
  - Size/position: pill 52px (`NAV_PILL_H`), `NAV_BOTTOM = max(8px, env(safe-area-inset-bottom) - 14px)` = 20px on a home-indicator iPhone (dips into the safe area like Facebook's). Needs `viewport-fit=cover` (already set).

## The NAV_CLEARANCE rule (why this exists)

The pill floats OVER the scroll area, which is the pattern that broke twice before (last card hidden behind the bar). Every scrollable screen that shows the pill now pads its bottom with the one shared constant `NAV_CLEARANCE = NAV_PILL_H + NAV_BOTTOM + 16px` (88px on a home-indicator iPhone); never a hard-coded number. Carried by the 7 module `main` regions and the Home grid. The ad-hoc `paddingBottom: 80 / 100` literals on item pages and Dropdowns views were removed (they sit inside `main`; keeping them would double up). `src/safe-area-layout.test.jsx` scans the source and fails on a `main` region without `NAV_CLEARANCE` or a returning 80/100 literal.

## Keyboard behaviour

- Old scheme (`--kb-inset` margin-bottom on the nav) lifted the pill with the iOS keyboard, and a nav tap with the keyboard up closed it WITHOUT a final viewport event, stranding the pill mid-screen.
- Now: `--kb-inset` is gone (nothing sets or reads it). `index.html` derives `html.kb-open` from `document.activeElement` (text input / textarea / select / contenteditable) on focusin / focusout / blur / visualViewport resize+scroll / pagehide, and `html.kb-open #root nav` is `opacity:0; pointer-events:none` (0.15s fade). A nav press blurs the field first. Backup `scrollIntoView` for fields near the bottom. While the keyboard is up the pill is hidden, so it cannot be tapped until the field loses focus.

## Cause of "pill ~42pt too high" on a real iPhone

- **Symptom:** pill bottom ~62-67pt above the screen bottom (Facebook: ~19pt), with a blank strip under it. Invisible in a desktop browser or iframe (safe-area inset 0).
- **Measured on device (installed, portrait):** `innerHeight 879`, `screen.height 926`, `#root` bottom 879, `100vh/100lvh 926`, `100dvh 879` — the layout viewport was 47pt (= the status-bar inset) short.
- **Cause:** `html, body { height: 100% }` resolved to 879 and the **web view itself followed it** — nothing below 879pt was ever painted. Not a double-applied inset: no ancestor had bottom padding, and no `100svh` / `dvh` / `-webkit-fill-available` is used.
- **Dead ends:** sizing `#root` taller with JS (`--vp-h` from `screen.height`) made the pill's lower half clip at 879; re-adding the viewport meta, `overflow:visible`, `scrollTo`, and `body:fixed` changed nothing. (A live experiment panel on the phone found this; it has been removed.)
- **Fix:** `index.html` sets `height: 100%` then `height: 100vh` on `html, body`. On device: `innerHeight 926`, pill bottom 20pt from the screen bottom, fully visible, no strip.
- **Rules (in CLAUDE.md):** never remove the `100vh` line; never size the app from `screen.height` / `innerHeight` in JS; judge bottom-edge positions on a real device.

## Tests

`src/safe-area-layout.test.jsx` rewritten for the pill (shared style, one `NavBtn`, 44px targets, `NAV_BOTTOM`, `viewport-fit=cover`, `NAV_CLEARANCE` guards) and runs the real `index.html` keyboard script in jsdom. Full suite 791 passed / 7 skipped; `npm run build` OK.

## Not yet verified / known gaps

- **Not verified on the deployed build** (GitHub Pages + service worker). Check: the pill position, the `100vh` height fix (a cached old `index.html` would hide it), keyboard hide/show, and the "Refresh" update toast.
- Not seen on a device: the 6-tab bar's "Dropdowns" label at 390px (arithmetic says it fits, ~53px in ~59px); bottom sheets / modals using `position:fixed; bottom:0` against the corrected viewport.
- `main` pads the Projects list by `NAV_CLEARANCE` even though it shows no nav (extra empty space at the bottom of that list).
- Home Calendar/Settings keep their own icon colours (indigo / slate) instead of the neutral inactive colour.
- While the keyboard is open the pill is hidden and untappable by design.

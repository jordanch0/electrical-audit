// useRevealOnOpen (release q): a confirm card that grows in place is scrolled into view when it OPENS, clear of the floating pill. FICTIONAL data (none is used: a tiny host component).
// jsdom has no layout and no Element.prototype.scrollIntoView, so (as gs-reveal.test.jsx does) scrollIntoView is a spy and the positions are STUBBED by data-testid:
// the scroller is 0..700 px, the pill (a <nav> that is a direct child of the scroller's parent) starts at 630, so the visible band is 12..614 (12 px at the top, the pill minus the 16 px gap).
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { useRevealOnOpen, useCollapsible } from './App.jsx';

const frames = async (n = 4) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise(r => requestAnimationFrame(() => r())); }); };
const rectOf = (top, bottom) => ({ top, bottom, left: 0, right: 300, width: 300, height: bottom - top, x: 0, y: top, toJSON() {} });

let calls, rects, origRect, origClient, origScroll, origMedia;
beforeEach(() => {
  calls = []; rects = {};
  origRect = Element.prototype.getBoundingClientRect; origClient = Element.prototype.getClientRects; origScroll = Element.prototype.scrollIntoView; origMedia = window.matchMedia;
  Element.prototype.scrollIntoView = function (o) { calls.push([this.getAttribute('data-testid'), o]); };
  Element.prototype.getClientRects = function () { return [{}]; };
  Element.prototype.getBoundingClientRect = function () {
    if (this.tagName === 'NAV') return rectOf(630, 682);
    const id = this.getAttribute('data-testid'); if (rects[id]) return rectOf(...rects[id]);
    return id === 'sc' ? rectOf(0, 700) : rectOf(0, 0);
  };
  window.matchMedia = undefined;
});
afterEach(() => { cleanup(); Element.prototype.getBoundingClientRect = origRect; Element.prototype.getClientRects = origClient; Element.prototype.scrollIntoView = origScroll; window.matchMedia = origMedia; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

// scroller: 'gs' = [data-gs-scroll], 'plain' = overflow-y:auto, 'scroll' = overflow-y:scroll, 'none' = nothing scrolls
function Host({ ctl, scroller = 'gs', pill = true, id = 'card', initial = false, group }) {
  const [open, setOpen] = React.useState(initial); const [, bump] = React.useState(0); const ref = React.useRef(null);
  ctl[id] = { set: setOpen, bump: () => bump(n => n + 1) };
  if (group) useCollapsible(open, () => setOpen(false), ref);
  useRevealOnOpen(ref, open);
  const props = scroller === 'gs' ? { 'data-gs-scroll': 'true' } : scroller === 'plain' ? { style: { overflowY: 'auto' } } : scroller === 'scroll' ? { style: { overflowY: 'scroll' } } : {};
  return <div data-testid="wrap"><div data-testid="sc" {...props}>{open && <div ref={ref} data-testid={id}>question</div>}</div>{pill && <nav data-testid="pill" />}</div>;
}
const mount = (props = {}) => { const ctl = {}; const r = render(<Host ctl={ctl} {...props} />); return { ctl, ...r }; };
const open = async (ctl, id = 'card') => { act(() => ctl[id].set(true)); await frames(); };

describe('when it runs: only when `open` turns true', () => {
  it('mounted closed: nothing scrolls', async () => { mount(); await frames(); expect(calls).toEqual([]); });
  it('mounted already open (and hidden under the pill): nothing scrolls on the first render', async () => {
    rects.card = [560, 690]; mount({ initial: true }); await frames(); expect(calls).toEqual([]);
  });
  it('closing does not scroll, and neither does a re-render while it stays open', async () => {
    rects.card = [560, 690]; const { ctl } = mount(); await open(ctl); expect(calls.length).toBe(1);
    act(() => ctl.card.bump()); act(() => ctl.card.bump()); await frames(); expect(calls.length).toBe(1);           // still open, re-rendered: no second scroll
    act(() => ctl.card.set(false)); await frames(); expect(calls.length).toBe(1);                                      // closed: nothing
    await open(ctl); expect(calls.length).toBe(2);                                                                      // opened again: scrolls again
  });
  it('typeof scrollIntoView is tested first: where there is none (jsdom as it is) nothing happens, not even a frame is requested', async () => {
    delete Element.prototype.scrollIntoView; const raf = vi.fn(() => 1); vi.stubGlobal('requestAnimationFrame', raf);
    rects.card = [560, 690]; const { ctl } = mount(); act(() => ctl.card.set(true)); expect(raf).not.toHaveBeenCalled(); expect(calls).toEqual([]);
  });
  it('waits TWO animation frames before it measures', async () => {
    const q = []; vi.stubGlobal('requestAnimationFrame', cb => { q.push(cb); return q.length; }); vi.stubGlobal('cancelAnimationFrame', () => {});
    rects.card = [560, 690]; const { ctl } = mount(); act(() => ctl.card.set(true));
    expect(calls).toEqual([]); act(() => q.shift()()); expect(calls).toEqual([]); act(() => q.shift()()); expect(calls.length).toBe(1);
  });
  it('closed between the frames: no scroll (the Cancel, Back and scroll-memory case)', async () => {
    const q = []; vi.stubGlobal('requestAnimationFrame', cb => { q.push(cb); return q.length; }); vi.stubGlobal('cancelAnimationFrame', () => {});
    rects.card = [560, 690]; const { ctl } = mount(); act(() => ctl.card.set(true)); act(() => q.shift()());
    act(() => ctl.card.set(false)); while (q.length) act(() => q.shift()()); expect(calls).toEqual([]);
  });
  it('unmounted between the frames: no scroll and no error', async () => {
    const q = []; vi.stubGlobal('requestAnimationFrame', cb => { q.push(cb); return q.length; }); vi.stubGlobal('cancelAnimationFrame', () => {});
    rects.card = [560, 690]; const { ctl, unmount } = mount(); act(() => ctl.card.set(true)); act(() => q.shift()());
    unmount(); expect(() => { while (q.length) q.shift()(); }).not.toThrow(); expect(calls).toEqual([]);
  });
  // the cards in the app are removed from the page when they close; a box that STAYS mounted proves the hook itself (not the missing element) is what stays quiet
  function Kept({ ctl }) {
    const [o, setO] = React.useState(false); const ref = React.useRef(null); ctl.set = setO; useRevealOnOpen(ref, o);
    return <div><div data-testid="sc" data-gs-scroll="true"><div ref={ref} data-testid="card">question</div></div><nav /></div>;
  }
  it('closing does not scroll even when the box is still on the page (and hidden under the pill)', async () => {
    rects.card = [560, 690]; const ctl = {}; render(<Kept ctl={ctl} />);
    act(() => ctl.set(true)); await frames(); expect(calls.length).toBe(1);
    act(() => ctl.set(false)); await frames(); expect(calls.length).toBe(1);
  });
  it('closed between the frames with the box still on the page: the pending scroll is cancelled (its flag, not only the missing element)', async () => {
    const q = []; vi.stubGlobal('requestAnimationFrame', cb => { q.push(cb); return q.length; }); vi.stubGlobal('cancelAnimationFrame', () => {});     // a cancel that cancels nothing: only the hook's own flag can stop it
    rects.card = [560, 690]; const ctl = {}; render(<Kept ctl={ctl} />);
    act(() => ctl.set(true)); act(() => q.shift()()); act(() => ctl.set(false)); while (q.length) act(() => q.shift()()); expect(calls).toEqual([]);
  });
  it('a second card opens while the first is open: only the second scrolls (the first closed, its frames cancelled)', async () => {
    rects.a = [560, 690]; rects.b = [560, 690]; const ctl = {};
    render(<div><Host ctl={ctl} id="a" group /><Host ctl={ctl} id="b" group /></div>);
    await open(ctl, 'a'); expect(calls.map(c => c[0])).toEqual(['a']);
    await open(ctl, 'b'); expect(calls.map(c => c[0])).toEqual(['a', 'b']);
  });
});

describe('what it does: the same numbers as Global Settings', () => {
  it('fully inside the visible band: no scroll', async () => { rects.card = [100, 300]; const { ctl } = mount(); await open(ctl); expect(calls).toEqual([]); });
  it('under the pill: "nearest", smooth', async () => {
    rects.card = [560, 690]; const { ctl } = mount(); await open(ctl); expect(calls.length).toBe(1); expect(calls[0]).toEqual(['card', { block: 'nearest', behavior: 'smooth' }]);
  });
  it('the pill and its 16 px gap count: a card that ends at 620 (inside the scroller, under the pill gap) is NOT visible', async () => {
    rects.card = [480, 620]; const { ctl } = mount(); await open(ctl); expect(calls.length).toBe(1);
  });
  it('a card that ends exactly 16 px above the pill (614) is visible', async () => {
    rects.card = [480, 614]; const { ctl } = mount(); await open(ctl); expect(calls).toEqual([]);
  });
  it('hidden above the visible part: "nearest" on its top', async () => {
    rects.card = [-80, 40]; const { ctl } = mount(); await open(ctl); expect(calls[0][1]).toEqual({ block: 'nearest', behavior: 'smooth' });
  });
  it('a card whose top is under the 12 px top gap is brought down', async () => { rects.card = [4, 100]; const { ctl } = mount(); await open(ctl); expect(calls.length).toBe(1); });
  it('taller than the room: "start" (its first words are read first)', async () => {
    rects.card = [300, 1000]; const { ctl } = mount(); await open(ctl); expect(calls[0][1]).toEqual({ block: 'start', behavior: 'smooth' });
  });
  it('with "reduce motion" on the scroll is instant ("auto")', async () => {
    window.matchMedia = q => ({ matches: /prefers-reduced-motion: reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {} });
    rects.card = [560, 690]; const { ctl } = mount(); await open(ctl); expect(calls[0][1]).toEqual({ block: 'nearest', behavior: 'auto' });
  });
  it('a pane that is not showing (display:none, no boxes) is never scrolled to', async () => {
    Element.prototype.getClientRects = function () { return []; }; rects.card = [560, 690]; const { ctl } = mount(); await open(ctl); expect(calls).toEqual([]);
  });
});

describe('where it looks: the scroller and the pill are found, not named', () => {
  it('no pill (a sites list): the scroller\'s own bottom is the limit: ends at 690 is hidden, ends at 620 is visible', async () => {
    rects.card = [560, 690]; let m = mount({ pill: false }); await open(m.ctl); expect(calls.length).toBe(1); cleanup();
    calls = []; rects.card = [480, 620]; m = mount({ pill: false }); await open(m.ctl); expect(calls).toEqual([]);
  });
  it('a plain ancestor with overflow-y:auto is the scroller (a <main> or a <div>, as the modules have)', async () => {
    rects.card = [560, 690]; const { ctl } = mount({ scroller: 'plain' }); await open(ctl); expect(calls.length).toBe(1);
  });
  it('overflow-y:scroll counts too', async () => { rects.card = [560, 690]; const { ctl } = mount({ scroller: 'scroll' }); await open(ctl); expect(calls.length).toBe(1); });
  it('no scroller at all: no call', async () => { rects.card = [560, 690]; const { ctl } = mount({ scroller: 'none' }); await open(ctl); expect(calls).toEqual([]); });
  it('a scroller with no height: no call', async () => { rects.sc = [0, 0]; rects.card = [560, 690]; const { ctl } = mount(); await open(ctl); expect(calls).toEqual([]); });
  it('[data-gs-scroll] wins over a scrolling ancestor further out', async () => {
    rects.outer = [0, 150]; rects.card = [100, 200]; const ctl = {};
    function Nested() { const [o, setO] = React.useState(false); const ref = React.useRef(null); ctl.set = setO; useRevealOnOpen(ref, o);
      return <div data-testid="outer" style={{ overflowY: 'auto' }}><div data-testid="sc" data-gs-scroll="true">{o && <div ref={ref} data-testid="card">q</div>}</div><nav /></div>; }
    render(<Nested />); act(() => ctl.set(true)); await frames(); expect(calls).toEqual([]);                  // inside the gs scroller's band; the outer 0..150 would have called
  });
  it('the pill is the <nav> that is a DIRECT CHILD of the scroller\'s parent: a nav deeper down is not the pill', async () => {
    rects.card = [480, 620];
    function Deep() { const [o, setO] = React.useState(false); const ref = React.useRef(null); ctl2.set = setO; useRevealOnOpen(ref, o);
      return <div><div data-testid="sc" data-gs-scroll="true">{o && <div ref={ref} data-testid="card">q</div>}</div><div><nav /></div></div>; }
    const ctl2 = {}; render(<Deep />); act(() => ctl2.set(true)); await frames(); expect(calls).toEqual([]);   // no direct nav: limit is 700 - 16 = 684, so 620 is visible
  });
});

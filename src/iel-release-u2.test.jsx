// RELEASE u2, IEL navigation (FICTIONAL data). Commit 1: Home is a READ-ONLY summary (the three category rows are not controls) with ONE Start / Continue Audit button copied from the other modules.
// Commit 2: the area list. Commit 3: the tab bar (variant C), the sticky bar, the per-tab scroll memory and the item list (the switcher page is gone).
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

const ls = k => JSON.parse(localStorage.getItem(k));
const P = 'iel-projects-v2', M = 'iel-meta-v2', R = 'iel-results-v2', A = 'iel-audit-active-v1';
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.useRealTimers(); });
const day = d => `2026-10-${String(d).padStart(2, '0')}`;
// Wash Plant: e-stops (2), lanyards (2), NO isolators.  Crusher Yard: isolators (1) only.  Pit Store: nothing at all.
const SITE = { id: 's1', name: 'Site One', company: '', abn: '', licence: '', areas: [
  { id: 'a1', name: 'Wash Plant', panels: [
    { id: 'e1', name: 'estops', circuits: ['x1', 'x2'], machineNames: { x1: 'Feed Conveyor 1', x2: 'Feed Conveyor 2' } },
    { id: 'l1', name: 'lanyards', circuits: ['y1', 'y2'], machineNames: { y1: 'Pit Lanyard 1', y2: 'Pit Lanyard 2' } }] },
  { id: 'a2', name: 'Crusher Yard', panels: [{ id: 'i1', name: 'isolators', circuits: ['z1'], machineNames: { z1: 'Crusher Isolator 1' } }] },
  { id: 'a3', name: 'Pit Store', panels: [] }] };
const done = { status: 'pass', mechCheck: true, circuitIso: true, lastTested: day(5) };
const seed = (results, auditor = 'Jane') => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 5, 12, 0, 0));          // device day = Home date = 5 Oct, so the Home-date follow leaves the seeded site alone
  localStorage.setItem(P, JSON.stringify([SITE]));
  localStorage.setItem(M, JSON.stringify({ s1: { auditor, testDate: day(5), dateDay: day(5), nextTestDate: '' } }));
  if (results) localStorage.setItem(R, JSON.stringify({ s1: results }));
};
async function toHome(user) { render(<AppRoot />); await user.click(screen.getByText('IEL TESTING', { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' })); }
const startBtn = () => screen.getByRole('button', { name: /Start \/ Continue Audit/ });

describe('HOME is a read-only summary with one Start / Continue Audit button', () => {
  it('H-1 the three category rows are a read-only summary: not buttons, no chevron, tapping one changes nothing; each has its whole-site count, bar and the full status set', async () => {
    seed({ a1: { estops: { x1: { ...done }, x2: { status: 'fail', mechCheck: true, lastTested: day(5) } }, lanyards: { y1: { status: 'na', lastTested: day(5) } } } });
    const user = userEvent.setup(); await toHome(user);
    expect(screen.getByText('TEST CATEGORIES')).toBeInTheDocument();
    const expected = { estops: ['2 items', '1 PASS', '1 FAIL', '0 N/A', '0 UNTESTED'], lanyards: ['2 items', '0 PASS', '0 FAIL', '1 N/A', '1 UNTESTED'], isolators: ['1 item', '0 PASS', '0 FAIL', '0 N/A', '1 UNTESTED'] };
    for (const [k, texts] of Object.entries(expected)) {
      const row = screen.getByTestId('iel-home-' + k);
      expect(row.tagName).not.toBe('BUTTON'); expect(row.getAttribute('role')).toBeNull(); expect(row.onclick).toBeNull();
      expect(within(row).queryByRole('button')).toBeNull(); expect(row.textContent).not.toContain('›');
      texts.forEach(t => expect(within(row).getByText(t)).toBeInTheDocument());
      expect(row.querySelector('div[style*="height: 4px"]')).not.toBeNull();                                          // the progress bar
    }
    expect(screen.queryByRole('button', { name: /^E-Stops|^Lanyards|^Isolators/ })).toBeNull();                       // no category control anywhere on Home
    const before = [localStorage.getItem(A), localStorage.getItem(R), localStorage.getItem(M)];
    for (const k of ['estops', 'lanyards', 'isolators']) await user.click(screen.getByTestId('iel-home-' + k));
    await new Promise(r => setTimeout(r, 60));
    expect(screen.getByText('TEST CATEGORIES')).toBeInTheDocument(); expect(screen.queryByText('Select Area')).toBeNull();     // still on Home
    expect([localStorage.getItem(A), localStorage.getItem(R), localStorage.getItem(M)]).toEqual(before);              // and nothing was stored
  });
  it('H-2 one Start / Continue Audit button with the other modules\' look; disabled with the auditor note when the auditor is blank', async () => {
    seed(null); const user = userEvent.setup(); await toHome(user);
    expect(screen.getAllByRole('button', { name: /Start|Continue/ }).filter(b => /Start \/ Continue Audit/.test(b.textContent))).toHaveLength(1);
    const b = startBtn(); expect(b.textContent.trim()).toBe('Start / Continue Audit'); expect(b.disabled).toBe(false);
    const s = b.style; expect([s.width, s.maxWidth, s.padding, s.fontSize, s.fontWeight, s.borderRadius, s.letterSpacing]).toEqual(['100%', '500px', '16px', '16px', '800', '16px', '0.5px']);   // TAT / SWB / IRT's button
    expect(s.background).toBe('rgb(4, 120, 87)'); expect(s.color).toBe('rgb(255, 255, 255)'); expect(b.querySelector('svg polyline')).not.toBeNull();       // IEL green, white text, the same check icon
    expect(screen.queryByText(/Please enter the auditor name/)).toBeNull();
    cleanup(); localStorage.clear(); seed(null, '');
    const u2 = userEvent.setup(); await toHome(u2); const d = startBtn();
    expect(d.disabled).toBe(true); expect(d.getAttribute('aria-disabled')).toBe('true'); expect(d.style.background).toBe('rgb(247, 246, 243)'); expect(d.style.color).toBe('rgb(82, 82, 91)');
    expect(screen.getByText('Please enter the auditor name to continue or complete the audit.')).toBeInTheDocument();
    await u2.click(d); await new Promise(r => setTimeout(r, 40)); expect(screen.queryByText('Select Area')).toBeNull(); expect(ls(A).sites.s1).toBeUndefined();      // a blank auditor does not start anything
    await u2.type(screen.getByPlaceholderText('Enter name to begin audit…'), 'Jane');
    await waitFor(() => expect(startBtn().disabled).toBe(false)); expect(screen.queryByText(/Please enter the auditor name/)).toBeNull();
  });
  it('H-3 Start on a site with no active audit stores an empty entry and opens the area list; Continue on an active site keeps the remembered tab and clears only the gate marker', async () => {
    seed(null); const user = userEvent.setup(); await toHome(user);
    await user.click(startBtn()); expect(await screen.findByText('Select Area')).toBeInTheDocument();
    await waitFor(() => expect(ls(A).sites.s1).toEqual({}));                                                          // no tab chosen yet
    cleanup(); localStorage.clear(); seed({ a1: { lanyards: { y1: { ...done } } } });
    localStorage.setItem(A, JSON.stringify({ v: 1, sites: { s1: { cat: 'lanyards' } } }));                             // an active audit that remembers Lanyards
    const u2 = userEvent.setup(); await toHome(u2); await u2.click(startBtn()); expect(await screen.findByText('Select Area')).toBeInTheDocument();
    await new Promise(r => setTimeout(r, 60)); expect(ls(A).sites.s1).toEqual({ cat: 'lanyards' });                  // Continue: the remembered tab is kept
    cleanup(); localStorage.clear(); seed({ a1: { lanyards: { y1: { ...done } } } });
    localStorage.setItem(A, JSON.stringify({ v: 1, sites: { s1: { cat: 'lanyards', active: true, gate: true } } }));   // the same, with the gate armed
    const u3 = userEvent.setup(); await toHome(u3); await u3.click(startBtn()); expect(await screen.findByText('Select Area')).toBeInTheDocument();
    await waitFor(() => expect(ls(A).sites.s1).toEqual({ cat: 'lanyards', active: true }));                           // only the gate marker went
  });
  it('H-4 the Complete button no longer takes a category colour', async () => {
    const html = async cat => {
      cleanup(); localStorage.clear(); seed({ a1: { estops: { x1: { ...done } } } });
      localStorage.setItem(A, JSON.stringify({ v: 1, sites: { s1: { cat } } }));
      const user = userEvent.setup(); await toHome(user); return screen.getByRole('button', { name: /^Complete/ }).outerHTML;
    };
    const red = await html('estops'), brown = await html('isolators'), green = await html('lanyards');
    expect(red).toBe(brown); expect(red).toBe(green);                                                                // the same whatever category the audit is on
    expect(red).not.toMatch(/185, 28, 28|#b91c1c/);                                                                   // and not the E-Stops red
  });
  it('Back from the area list arms the gate, then Start / Continue Audit opens the AREA LIST, not the gate screen', async () => {
    seed({ a1: { estops: { x1: { ...done } } } });
    localStorage.setItem(A, JSON.stringify({ v: 1, sites: { s1: { cat: 'estops' } } }));
    const user = userEvent.setup(); await toHome(user);
    await user.click(startBtn()); expect(await screen.findByText('Select Area')).toBeInTheDocument();
    await user.click(screen.getByText('Back')); expect(await screen.findByText('TEST CATEGORIES')).toBeInTheDocument();     // Home, the gate is now armed
    await waitFor(() => expect(ls(A).sites.s1.gate).toBe(true));
    await user.click(startBtn());
    expect(await screen.findByText('Select Area')).toBeInTheDocument(); expect(screen.queryByText('AUDIT IN PROGRESS')).toBeNull(); expect(screen.queryByText('NO ACTIVE AUDIT')).toBeNull();
    await waitFor(() => expect(ls(A).sites.s1.gate).toBeUndefined());                                                  // the marker is cleared, the audit entry stays
    expect(ls(A).sites.s1.cat).toBe('estops');
  });
});

describe('AREA LIST: each area shows its total across the three categories and ONE progress line', () => {
  const rowOf = name => screen.getByText(name).closest('button');
  const pills = row => [...row.querySelectorAll('[data-statuspill]')].map(p => p.textContent);
  async function toAreaList(user) { await toHome(user); await user.click(startBtn()); await screen.findByText('Select Area'); }
  it('A-1 each area row shows its total across all three categories and one progress line, no four-number set', async () => {
    seed({ a1: { estops: { x1: { ...done } }, lanyards: { y1: { status: 'na', lastTested: day(5) } } } });          // Wash Plant: 4 items (2 e-stops + 2 lanyards), 2 tested
    const user = userEvent.setup(); await toAreaList(user);
    const w = rowOf('Wash Plant'), c = rowOf('Crusher Yard');
    expect(within(w).getByText('4 items')).toBeInTheDocument(); expect(within(c).getByText('1 item')).toBeInTheDocument();    // the TOTAL of every category, not the current one
    expect(w.querySelectorAll('[data-statuspills]').length).toBe(1);                                                    // ONE progress line
    expect(pills(w)).toEqual(['CLEAR', '50%']); expect(pills(c)).toEqual(['CLEAR', '0%']);
    [w, c].forEach(r => expect(r.textContent).not.toMatch(/PASS|N\/A|UNTESTED| of |tested/));                           // no four-number set, no fraction
    expect(w.querySelector('div[style*="height: 4px"]')).not.toBeNull();
  });
  it('A-2 FAIL is named on a pill on a row with a fail, CLEAR otherwise; the percentage counts pass, fail and N/A as tested', async () => {
    seed({ a1: { estops: { x1: { ...done }, x2: { status: 'fail', mechCheck: true, lastTested: day(5) } }, lanyards: { y1: { status: 'na', lastTested: day(5) } } } });    // 3 of 4 tested, 1 fail
    const user = userEvent.setup(); await toAreaList(user);
    const w = screen.getByText('Wash Plant').closest('button'), c = screen.getByText('Crusher Yard').closest('button');
    expect([...w.querySelectorAll('[data-statuspill]')].map(p => p.textContent)).toEqual(['1 FAIL', '75%']);            // the word FAIL, and 3 of 4 = 75 (untested is not tested)
    expect(w.style.background).toBe('rgb(254, 226, 226)');                                                              // the red tint stays, as reinforcement only
    expect([...c.querySelectorAll('[data-statuspill]')].map(p => p.textContent)).toEqual(['CLEAR', '0%']); expect(c.style.background).not.toBe('rgb(254, 226, 226)');
  });
  it('A-3 an area with no items shows 0 items, no progress line, no bar, and still opens', async () => {
    seed(null); const user = userEvent.setup(); await toAreaList(user);
    const p = screen.getByText('Pit Store').closest('button');
    expect(within(p).getByText('0 items')).toBeInTheDocument(); expect(p.querySelector('[data-statuspill]')).toBeNull(); expect(p.querySelector('div[style*="height: 4px"]')).toBeNull();
    await user.click(p); await waitFor(() => expect(screen.queryByText('Select Area')).toBeNull()); expect(screen.getByText('Pit Store')).toBeInTheDocument();
  });
});

// ── commit 3: the tab bar, the item list, the sticky bar, the per-tab scroll memory ───────────────────────────────────────────────────────────────────────────────────────────────────────
const tabsOf = () => within(screen.getByRole('tablist', { name: 'Test category' })).getAllByRole('tab');
const selectedTabs = () => tabsOf().filter(t => t.getAttribute('aria-selected') === 'true').map(t => t.getAttribute('data-testid'));
const mainEl = () => document.querySelector('main');
const scrollTo = (el, n) => { el.scrollTop = n; fireEvent.scroll(el); };
async function toList(user, area, entry) {
  if (entry !== undefined) localStorage.setItem(A, JSON.stringify({ v: 1, sites: { s1: entry } }));
  await toHome(user); await user.click(startBtn()); await user.click(await screen.findByText(area)); await screen.findByRole('tablist', { name: 'Test category' });
}
const aWrites = spy => spy.mock.calls.filter(c => c[0] === A).length;
const rgb = css => (css.match(/\d+/g) || []).slice(0, 3).map(Number);
const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

describe('TABS: three separate pills, in the Home order, one line each', () => {
  it('T-1 tablist, three tabs in Home order, role tab, aria-selected on the shown tab only, one line (label then count for THIS area), 44 px taps, 36 px pills, 8 px apart', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'lanyards' });
    const tabs = tabsOf(); expect(tabs.map(t => t.getAttribute('data-testid'))).toEqual(['iel-tab-estops', 'iel-tab-lanyards', 'iel-tab-isolators']);
    expect(tabs.map(t => t.textContent)).toEqual(['E-Stops2', 'Lanyards2', 'Isolators0']);                                    // the label, then the count for THIS area, on one line
    expect(tabs.map(t => t.getAttribute('aria-label'))).toEqual(['E-Stops, 2 items', 'Lanyards, 2 items', 'Isolators, 0 items']);
    expect(selectedTabs()).toEqual(['iel-tab-lanyards']); expect(tabs.filter(t => t.getAttribute('aria-selected') === 'false')).toHaveLength(2);
    tabs.forEach(t => { expect(t.style.height).toBe('44px'); expect(t.style.padding).toBe('0px 4px'); const pill = t.firstChild; expect(pill.style.height).toBe('36px'); expect(pill.style.borderRadius).toBe('999px'); expect(pill.style.fontSize).toBe('12px'); expect(pill.style.whiteSpace).toBe('nowrap'); });
    expect(screen.getByRole('tablist').style.margin).toBe('0px -4px');                                                          // 4 + 4 = an 8 px gap between pills, outer pills flush with the cards
    expect(tabs[1].firstChild.style.fontWeight).toBe('700'); expect(tabs[2].firstChild.style.fontWeight).toBe('500');          // an empty tab is regular weight
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('iel-tab-lanyards');
  });
  it('T-2 an empty category is greyed, shows 0, is aria-disabled, is never selected, and a tap changes and writes nothing', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'estops' });
    const iso = screen.getByTestId('iel-tab-isolators');
    expect(iso.textContent).toBe('Isolators0'); expect(iso.getAttribute('aria-disabled')).toBe('true'); expect(iso.getAttribute('aria-selected')).toBe('false'); expect(iso.style.cursor).toBe('not-allowed'); expect(iso.firstChild.style.background).toBe('rgb(228, 228, 231)');
    const spy = vi.spyOn(Storage.prototype, 'setItem'); const before = document.body.innerHTML;
    try { await user.click(iso); await new Promise(r => setTimeout(r, 60)); expect(aWrites(spy)).toBe(0); } finally { spy.mockRestore(); }
    expect(selectedTabs()).toEqual(['iel-tab-estops']); expect(screen.getByText('Feed Conveyor 1')).toBeInTheDocument(); expect(document.body.innerHTML).toBe(before); expect(ls(A).sites.s1).toEqual({ cat: 'estops' });
  });
  it('T-3 switching is in place: same area and Back, the list and header change, the choice is stored in cat and survives a reload', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'estops' });
    expect(screen.getByText('Feed Conveyor 1')).toBeInTheDocument(); const back = screen.getByText('Back'), title = screen.getByText('Wash Plant', { selector: 'div' });
    await user.click(screen.getByTestId('iel-tab-lanyards'));
    expect(await screen.findByText('Pit Lanyard 1')).toBeInTheDocument(); expect(screen.queryByText('Feed Conveyor 1')).toBeNull(); expect(selectedTabs()).toEqual(['iel-tab-lanyards']);
    expect(screen.getByText('Back')).toBe(back); expect(screen.getByText('Wash Plant', { selector: 'div' })).toBe(title); expect(screen.queryByText('Select Area')).toBeNull();     // nothing navigated
    await waitFor(() => expect(ls(A).sites.s1.cat).toBe('lanyards'));
    cleanup(); const u2 = userEvent.setup(); await toList(u2, 'Wash Plant');                                                   // a reload: the remembered tab is read from storage
    expect(selectedTabs()).toEqual(['iel-tab-lanyards']); expect(screen.getByText('Pit Lanyard 1')).toBeInTheDocument();
  });
  it('T-4 the header under the tabs carries the full set for that category in that area', async () => {
    seed({ a1: { estops: { x1: { ...done }, x2: { status: 'fail', mechCheck: true, lastTested: day(5) } }, lanyards: { y1: { status: 'na', lastTested: day(5) } } } });
    const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'estops' });
    const panel = () => screen.getByRole('tabpanel'); const set = () => [...panel().querySelectorAll('[data-statuspill]')].map(p => p.textContent);
    expect(set()).toEqual(['1 PASS', '1 FAIL', '0 N/A', '0 UNTESTED']); expect(within(panel()).getByText('2 items')).toBeInTheDocument(); expect(within(panel()).getByText(/Tap any item to open the test form/)).toBeInTheDocument();
    await user.click(screen.getByTestId('iel-tab-lanyards'));
    expect(set()).toEqual(['0 PASS', '0 FAIL', '1 N/A', '1 UNTESTED']);                                                          // THAT category in THAT area
  });
  it('T-4b the header carries the AREA counts, not the whole site: a second area with the same category does not change them', async () => {
    seed({ a1: { estops: { x1: { ...done } } }, a2: { estops: { w1: { status: 'fail', mechCheck: true, lastTested: day(5) }, w2: { ...done }, w3: { ...done } } } });
    const site = JSON.parse(JSON.stringify(SITE));
    site.areas[1].panels.push({ id: 'e2', name: 'estops', circuits: ['w1', 'w2', 'w3'], machineNames: { w1: 'Crusher E-Stop 1', w2: 'Crusher E-Stop 2', w3: 'Crusher E-Stop 3' } });
    localStorage.setItem(P, JSON.stringify([site]));
    const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'estops' });
    const panel = () => screen.getByRole('tabpanel'); const set = () => [...panel().querySelectorAll('[data-statuspill]')].map(p => p.textContent);
    expect(set()).toEqual(['1 PASS', '0 FAIL', '0 N/A', '1 UNTESTED']); expect(within(panel()).getByText('2 items')).toBeInTheDocument();   // the whole site would read 3 PASS, 1 FAIL
    await user.click(screen.getByText('Back')); await user.click(await screen.findByText('Crusher Yard')); await screen.findByRole('tablist', { name: 'Test category' });
    expect(set()).toEqual(['2 PASS', '1 FAIL', '0 N/A', '0 UNTESTED']); expect(within(panel()).getByText('3 items')).toBeInTheDocument();
  });
  it('T-5 the shown tab: the remembered one when the area has items there, else the first with items; showing the fallback writes nothing', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'lanyards' });
    expect(selectedTabs()).toEqual(['iel-tab-lanyards']);                                                                      // remembered and present here
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    try {
      await user.click(screen.getByText('Back')); await user.click(await screen.findByText('Crusher Yard'));                    // Crusher Yard has no lanyards: the first tab with items (Isolators) shows
      await screen.findByRole('tablist', { name: 'Test category' }); expect(selectedTabs()).toEqual(['iel-tab-isolators']); expect(screen.getByText('Crusher Isolator 1')).toBeInTheDocument();
      await new Promise(r => setTimeout(r, 60)); expect(aWrites(spy)).toBe(0); expect(ls(A).sites.s1).toEqual({ cat: 'lanyards' });  // nothing written for the fallback
      await user.click(screen.getByText('Back')); await user.click(await screen.findByText('Wash Plant')); await screen.findByRole('tablist', { name: 'Test category' });
      expect(selectedTabs()).toEqual(['iel-tab-lanyards']);                                                                    // and the next area still opens on the remembered one
    } finally { spy.mockRestore(); }
    cleanup(); localStorage.clear(); seed(null); const u2 = userEvent.setup(); await toList(u2, 'Wash Plant', {}); expect(selectedTabs()).toEqual(['iel-tab-estops']);   // nothing remembered: the first with items
  });
  it('T-6 an area with no items: three greyed tabs, none selected, and the Manage message', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Pit Store', { cat: 'estops' });
    expect(tabsOf().map(t => t.textContent)).toEqual(['E-Stops0', 'Lanyards0', 'Isolators0']); tabsOf().forEach(t => { expect(t.getAttribute('aria-disabled')).toBe('true'); expect(t.getAttribute('aria-selected')).toBe('false'); });
    expect(selectedTabs()).toEqual([]); expect(screen.getByText(/No items\. Go to/)).toBeInTheDocument(); expect(screen.queryByText(/Tap any item to open the test form/)).toBeNull();
    await user.click(tabsOf()[1]); expect(ls(A).sites.s1).toEqual({ cat: 'estops' });
  });
  it('T-7 keyboard: Left, Right, Home and End move between the ENABLED tabs; roving tabindex', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'estops' });                          // E-Stops and Lanyards enabled, Isolators empty
    expect(tabsOf().map(t => t.tabIndex)).toEqual([0, -1, -1]);
    tabsOf()[0].focus(); await user.keyboard('{ArrowRight}'); expect(selectedTabs()).toEqual(['iel-tab-lanyards']); expect(document.activeElement).toBe(tabsOf()[1]); expect(tabsOf().map(t => t.tabIndex)).toEqual([-1, 0, -1]);
    await user.keyboard('{ArrowRight}'); expect(selectedTabs()).toEqual(['iel-tab-estops']);                                  // wraps and skips the empty Isolators tab
    await user.keyboard('{ArrowLeft}'); expect(selectedTabs()).toEqual(['iel-tab-lanyards']);
    await user.keyboard('{Home}'); expect(selectedTabs()).toEqual(['iel-tab-estops']); await user.keyboard('{End}'); expect(selectedTabs()).toEqual(['iel-tab-lanyards']);
  });
  it('T-8 Back chain: item page, item list, area list, Home with the gate (no switcher level)', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'estops' });
    await user.click(screen.getByText('Feed Conveyor 1')); expect(await screen.findByText(/Mechanism/)).toBeInTheDocument();
    await user.click(screen.getByText('Back')); expect(await screen.findByRole('tablist', { name: 'Test category' })).toBeInTheDocument(); expect(screen.getByText('Feed Conveyor 1')).toBeInTheDocument();      // the item list
    await user.click(screen.getByText('Back')); expect(await screen.findByText('Select Area')).toBeInTheDocument(); expect(screen.queryByRole('tablist')).toBeNull();                                    // the area list
    await user.click(screen.getByText('Back')); expect(await screen.findByText('TEST CATEGORIES')).toBeInTheDocument(); await waitFor(() => expect(ls(A).sites.s1.gate).toBe(true));                      // Home, the gate armed
  });
  it('T-9 the Audit pill: from another tab it returns to the same area and tab; in Audit it closes an open item page, else goes to the area list', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'estops' });
    await user.click(screen.getByTestId('iel-tab-lanyards')); await user.click(screen.getByRole('button', { name: /^Report$/ })); await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    expect(await screen.findByRole('tablist', { name: 'Test category' })).toBeInTheDocument(); expect(selectedTabs()).toEqual(['iel-tab-lanyards']); expect(screen.getByText('Wash Plant', { selector: 'div' })).toBeInTheDocument();
    await user.click(screen.getByText('Pit Lanyard 1')); await screen.findByText(/Mechanism/);
    await user.click(screen.getByRole('button', { name: /^Audit$/ })); expect(await screen.findByRole('tablist', { name: 'Test category' })).toBeInTheDocument();     // the item page closed, the item list stays
    await user.click(screen.getByRole('button', { name: /^Audit$/ })); expect(await screen.findByText('Select Area')).toBeInTheDocument();                       // then the area list
  });
  it('T-9b the Audit pill after the open area was deleted in Manage lands on the AREA LIST (no empty item list, no crash)', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'lanyards' });
    expect(screen.getByRole('tablist', { name: 'Test category' })).toBeInTheDocument();                                  // the Wash Plant item list is open
    await user.click(screen.getByRole('button', { name: /^Manage$/ }));
    const row = (await screen.findByText('Wash Plant')).closest('button').parentElement;                                   // the area card header in Manage
    await user.click(within(row).getAllByRole('button').at(-1));                                                          // the trash icon (last button of the row)
    await user.click(await within(row).findByRole('button', { name: /Delete/ }));                                         // second step of the two-step delete
    await waitFor(() => expect(ls(P)[0].areas.map(a => a.id)).toEqual(['a2', 'a3']));                                     // Wash Plant is really gone from storage
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    expect(await screen.findByText('Select Area')).toBeInTheDocument();                                                   // the area list, not an empty item list
    expect(screen.queryByRole('tablist', { name: 'Test category' })).toBeNull();
    expect(screen.queryByText('Wash Plant')).toBeNull();
    expect(screen.getByText('Crusher Yard')).toBeInTheDocument(); expect(screen.getByText('Pit Store')).toBeInTheDocument();
    await user.click(screen.getByText('Crusher Yard'));                                                                   // and the list still works afterwards
    expect(await screen.findByRole('tablist', { name: 'Test category' })).toBeInTheDocument(); expect(selectedTabs()).toEqual(['iel-tab-isolators']);
  });
  it('T-10 old stored entries open on the right tab: { cat: estops }, { cat: lanyards }, {} and the legacy iel-cat-v2 migration', async () => {
    for (const [entry, want] of [[{ cat: 'estops' }, 'iel-tab-estops'], [{ cat: 'lanyards' }, 'iel-tab-lanyards'], [{}, 'iel-tab-estops']]) {
      cleanup(); localStorage.clear(); seed({ a1: { estops: { x1: { ...done } } } }); const user = userEvent.setup(); await toList(user, 'Wash Plant', entry); expect(selectedTabs()).toEqual([want]);
    }
    cleanup(); localStorage.clear(); seed({ a1: { estops: { x1: { ...done } } } }); localStorage.setItem('iel-cat-v2', JSON.stringify('lanyards'));         // no per-site key yet: the one-time migration reads the old global category
    const u2 = userEvent.setup(); await toList(u2, 'Wash Plant'); expect(selectedTabs()).toEqual(['iel-tab-lanyards']); await waitFor(() => expect(ls(A).sites.s1.cat).toBe('lanyards'));
  });
  it('T-11 the switcher is gone: no iel-type test id, no Current word, no "Choose a test category" on Home, the area list or the item list', async () => {
    seed({ a1: { estops: { x1: { ...done } } } }); const user = userEvent.setup(); await toHome(user);
    const gone = () => { expect(document.querySelector('[data-testid^="iel-type-"]')).toBeNull(); expect(screen.queryByText(/Current/)).toBeNull(); expect(document.querySelector('[aria-current]')).toBeNull(); expect(screen.queryByText('Choose a test category')).toBeNull(); };
    gone(); await user.click(startBtn()); await screen.findByText('Select Area'); gone(); await user.click(screen.getByText('Wash Plant')); await screen.findByRole('tablist', { name: 'Test category' }); gone();
  });
  it('T-12 auto PASS through the tab route: a result lands in the SHOWN category when the remembered one differs, one write per tick', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Crusher Yard', { cat: 'lanyards' });                       // remembered Lanyards, but this area only has isolators: the shown tab is Isolators
    expect(selectedTabs()).toEqual(['iel-tab-isolators']); await user.click(screen.getByText('Crusher Isolator 1'));
    const spy = vi.spyOn(Storage.prototype, 'setItem'); const writes = () => spy.mock.calls.filter(c => c[0] === R).length;
    try {
      for (const [i, name] of ['Mechanism', 'Circuit Isolation'].entries()) { const before = writes(); await user.click(screen.getByRole('button', { name: new RegExp(name) })); await waitFor(() => expect(writes()).toBeGreaterThan(before)); await new Promise(r => setTimeout(r, 80)); expect(writes() - before, 'tick ' + (i + 1)).toBe(1); }
    } finally { spy.mockRestore(); }
    await waitFor(() => expect(ls(R).s1.a2.isolators.z1.status).toBe('pass')); expect(ls(R).s1.a2.lanyards).toBeUndefined();   // in Isolators, never in Lanyards
    expect(screen.getByTestId('iel-check-note').textContent).toBe('Marked PASS because all checks are ticked.');
  });
  it('T-13 contrast: the three pill states are at least 4.5 to 1, computed from what is rendered', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'estops' });                          // selected E-Stops, available Lanyards, empty Isolators
    const pairs = tabsOf().map(t => [rgb(t.firstChild.style.color), rgb(t.firstChild.style.background)]);
    pairs.forEach(([fg, bg], i) => expect(ratio(fg, bg), 'tab ' + i).toBeGreaterThanOrEqual(4.5));
    expect(ratio(hex('#14532d'), hex('#dcfce7'))).toBeGreaterThanOrEqual(4.5); expect(ratio(hex('#3f3f46'), hex('#f7f6f3'))).toBeGreaterThanOrEqual(4.5); expect(ratio(hex('#5f5b57'), hex('#e4e4e7'))).toBeGreaterThanOrEqual(4.5);
    expect(tabsOf()[0].firstChild.style.boxShadow).toMatch(/inset/); expect(tabsOf()[0].getAttribute('aria-selected')).toBe('true');            // the selected state is not colour alone: an outline, bold weight and aria-selected
    expect(ratio(hex('#047857'), hex('#e8e6e2'))).toBeGreaterThanOrEqual(3);                                                  // the outline against the page (non-text contrast)
  });
});

describe('STICKY: only the tab bar is pinned', () => {
  it('S-1 the bar wrapper is pinned: position sticky, top 0, opaque page colour, full-bleed, below the nav pill, a 52 px layer (4 + 44 + 4)', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'estops' });
    const pin = screen.getByTestId('iel-tabs-pin'); const s = pin.style;
    expect(s.position).toBe('sticky'); expect(s.top).toBe('0px'); expect(s.background).toBe('rgb(232, 230, 226)'); expect(s.margin).toBe('0px -16px'); expect(s.padding).toBe('4px 16px');
    expect(Number(s.zIndex)).toBe(5); expect(Number(document.querySelector('nav').style.zIndex)).toBeGreaterThan(Number(s.zIndex));
    expect(4 + parseInt(screen.getByRole('tablist').style.height, 10) + 4).toBe(52);
  });
  it('S-2 only the bar is pinned: nothing else on the screen is position sticky (not the area title, the category header, the pills or the hint)', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'estops' });
    const sticky = [...mainEl().querySelectorAll('*')].filter(e => e.style && e.style.position === 'sticky'); expect(sticky).toHaveLength(1); expect(sticky[0]).toBe(screen.getByTestId('iel-tabs-pin'));
  });
  it('S-3 the hairline shows only while the bar is pinned over scrolled content', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'estops' });
    const pin = screen.getByTestId('iel-tabs-pin'); expect(pin.style.boxShadow).toBe('none');                                   // at the top: no line
    scrollTo(mainEl(), 120); await waitFor(() => expect(pin.style.boxShadow).toMatch(/#d4d4d8/));                         // scrolled: the line
    scrollTo(mainEl(), 0); await waitFor(() => expect(pin.style.boxShadow).toBe('none'));                                      // back at the top: gone
  });
  it('S-4 main keeps scrollPaddingTop 52 only while the item list shows (not on Home, the area list or the item page)', async () => {
    seed(null); const user = userEvent.setup(); await toHome(user); expect(mainEl().style.scrollPaddingTop || '').toBe('');
    await user.click(startBtn()); await screen.findByText('Select Area'); expect(mainEl().style.scrollPaddingTop || '').toBe('');
    await user.click(screen.getByText('Wash Plant')); await screen.findByRole('tablist', { name: 'Test category' }); expect(mainEl().style.scrollPaddingTop).toBe('52px');
    await user.click(screen.getByText('Feed Conveyor 1')); await screen.findByText(/Mechanism/); expect(mainEl().style.scrollPaddingTop || '').toBe('');
  });
  it('nothing is hidden under the pinned bar at the top: the bar is in the normal flow before the header and the cards (it only pins after the page scrolls past it)', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'estops' });
    const pin = screen.getByTestId('iel-tabs-pin'), first = screen.getByText('Feed Conveyor 1');
    expect(pin.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); expect(mainEl().scrollTop).toBe(0);
    expect(pin.style.marginBottom).toBe('0px'); expect(screen.getByRole('tabpanel').style.paddingTop).toBe('4px');         // nothing is positioned over the cards at scrollTop 0
  });
});

describe('SCROLL MEMORY: each tab in each area remembers its own position, in memory only', () => {
  it('M-1 per tab: scroll tab A to 300, switch to B (first visit: top), scroll B to 120, back to A: 300, B again: 120; the sticky bar itself is the same element throughout', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'estops' }); const pin = screen.getByTestId('iel-tabs-pin');
    scrollTo(mainEl(), 300);
    await user.click(screen.getByTestId('iel-tab-lanyards')); await screen.findByText('Pit Lanyard 1'); expect(mainEl().scrollTop).toBe(0);                  // first visit: the top
    scrollTo(mainEl(), 120);
    await user.click(screen.getByTestId('iel-tab-estops')); await screen.findByText('Feed Conveyor 1'); expect(mainEl().scrollTop).toBe(300);
    await user.click(screen.getByTestId('iel-tab-lanyards')); await screen.findByText('Pit Lanyard 1'); expect(mainEl().scrollTop).toBe(120);
    expect(screen.getByTestId('iel-tabs-pin')).toBe(pin);                                                                      // the bar stays mounted: switching never resets it
  });
  it('M-2 a scroll event delivered after a switch (the browser clamping a shorter list) is recorded for the NEW tab, never over the old one', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'estops' });
    scrollTo(mainEl(), 300); await user.click(screen.getByTestId('iel-tab-lanyards')); await screen.findByText('Pit Lanyard 1');
    scrollTo(mainEl(), 40);                                                                                                    // the clamped value arrives under the new tab
    await user.click(screen.getByTestId('iel-tab-estops')); await screen.findByText('Feed Conveyor 1'); expect(mainEl().scrollTop).toBe(300);                // the old tab kept its own
    await user.click(screen.getByTestId('iel-tab-lanyards')); await screen.findByText('Pit Lanyard 1'); expect(mainEl().scrollTop).toBe(40);
  });
  it('M-3 the item page starts at the top and never overwrites the list: Back returns to the tab\'s position', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'estops' }); scrollTo(mainEl(), 300);
    await user.click(screen.getByText('Feed Conveyor 1')); await screen.findByText(/Mechanism/); expect(mainEl().scrollTop).toBe(0);
    scrollTo(mainEl(), 90);                                                                                                    // scrolling the item page
    await user.click(screen.getByText('Back')); await screen.findByRole('tablist', { name: 'Test category' }); expect(mainEl().scrollTop).toBe(300);
  });
  it('M-4 the area list keeps its own position while tabs are switched in an area', async () => {
    seed(null); const user = userEvent.setup(); await toHome(user); await user.click(startBtn()); await screen.findByText('Select Area'); scrollTo(mainEl(), 77);
    await user.click(screen.getByText('Wash Plant')); await screen.findByRole('tablist', { name: 'Test category' }); scrollTo(mainEl(), 250);
    await user.click(screen.getByTestId('iel-tab-lanyards')); await screen.findByText('Pit Lanyard 1'); scrollTo(mainEl(), 60);
    await user.click(screen.getByText('Back')); await screen.findByText('Select Area'); expect(mainEl().scrollTop).toBe(77);
  });
  it('M-5 two areas keep separate positions for the same tab; Back to the area list and into an area again restores it', async () => {
    const site2 = { ...SITE, areas: [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'e1', name: 'estops', circuits: ['x1'], machineNames: { x1: 'Feed Conveyor 1' } }] }, { id: 'a2', name: 'Pump House', panels: [{ id: 'e2', name: 'estops', circuits: ['p1'], machineNames: { p1: 'Pump Stop 1' } }] }] };
    seed(null); localStorage.setItem(P, JSON.stringify([site2])); const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'estops' }); scrollTo(mainEl(), 300);
    await user.click(screen.getByText('Back')); await user.click(await screen.findByText('Pump House')); await screen.findByText('Pump Stop 1'); expect(mainEl().scrollTop).toBe(0); scrollTo(mainEl(), 55);
    await user.click(screen.getByText('Back')); await user.click(await screen.findByText('Wash Plant')); await screen.findByText('Feed Conveyor 1'); expect(mainEl().scrollTop).toBe(300);
    await user.click(screen.getByText('Back')); await user.click(await screen.findByText('Pump House')); await screen.findByText('Pump Stop 1'); expect(mainEl().scrollTop).toBe(55);
  });
  it('M-6 scrolling and switching write nothing to storage (only the tab tap writes the cat field)', async () => {
    seed(null); const user = userEvent.setup(); await toList(user, 'Wash Plant', { cat: 'estops' });
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    try {
      scrollTo(mainEl(), 300); scrollTo(mainEl(), 10); scrollTo(mainEl(), 200); await new Promise(r => setTimeout(r, 60)); expect(spy.mock.calls.length).toBe(0);               // scrolling alone: no write at all
      await user.click(screen.getByTestId('iel-tab-lanyards')); await new Promise(r => setTimeout(r, 80));
      expect([...new Set(spy.mock.calls.map(c => c[0]))]).toEqual([A]);                                                          // the tab tap writes only the audit-active record
      const n = spy.mock.calls.length; scrollTo(mainEl(), 90); await user.click(screen.getByTestId('iel-tab-estops')); await new Promise(r => setTimeout(r, 80));
      expect(spy.mock.calls.slice(n).every(c => c[0] === A)).toBe(true);
    } finally { spy.mockRestore(); }
  });
});

describe('CONTINUE from History opens the remembered tab (D-U2-4: it lands on Home; the tab applies when an area opens)', () => {
  const snapWith = (results, cat, label) => ({ id: 'h1', projectId: 's1', projectName: 'Site One', auditor: 'Jane', testDate: day(3), cat, label, archivedAt: '2026-10-03T01:00:00.000Z', results, meta: { auditor: 'Jane', testDate: day(3), dateDay: day(5), nextTestDate: '' } });
  async function continueSnap(user, text) {
    await user.click(screen.getByRole('button', { name: /^History$/ })); await user.click(await screen.findByText(text));
    await user.click(await screen.findByRole('button', { name: /Continue/ })); await user.click(await screen.findByRole('button', { name: /Yes, Continue/ }));
  }
  it('C-1 Continue lands on Home; the next area opened shows the snapshot\'s own tab, or the first with results when its own is empty', async () => {
    seed(null); localStorage.setItem('iel-history-v2', JSON.stringify([snapWith({ a1: { estops: { x1: { ...done } }, lanyards: { y1: { ...done, lastTested: day(3) } } } }, 'lanyards', 'All Categories')]));
    const user = userEvent.setup(); await toHome(user); await continueSnap(user, 'All Categories');
    expect(await screen.findByText('TEST CATEGORIES')).toBeInTheDocument(); expect(screen.queryByText('Select Area')).toBeNull();           // Home
    await user.click(startBtn()); await user.click(await screen.findByText('Wash Plant')); await screen.findByRole('tablist', { name: 'Test category' }); expect(selectedTabs()).toEqual(['iel-tab-lanyards']);
    cleanup(); localStorage.clear(); seed(null); localStorage.setItem('iel-history-v2', JSON.stringify([snapWith({ a1: { lanyards: { y1: { ...done, lastTested: day(3) } } } }, 'estops', 'E-Stops')]));   // its own category (estops) has no results
    const u2 = userEvent.setup(); await toHome(u2); await continueSnap(u2, 'E-Stops'); await screen.findByText('TEST CATEGORIES');
    await waitFor(() => expect(ls(A).sites.s1.cat).toBe('lanyards')); await u2.click(startBtn()); await u2.click(await screen.findByText('Wash Plant')); await screen.findByRole('tablist', { name: 'Test category' }); expect(selectedTabs()).toEqual(['iel-tab-lanyards']);
  });
});

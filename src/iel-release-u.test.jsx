// RELEASE u, IEL only (FICTIONAL data). (1) AUTO PASS: the tick that completes every required check (two for isolators and e-stops, three for lanyards) sets PASS from UNTESTED, never from FAIL
// or N/A, only on a tap. (2) TYPE SWITCHER: the page after the area list shows the three categories for THAT area in the Home order. (3) The History label says All Categories when more than
// one category has results. (4) Home heading. (5) Continue restores every category and picks the current one.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { ielCatsWithResults, ielSnapLabel } from './App.jsx';

const ls = k => JSON.parse(localStorage.getItem(k));
const P = 'iel-projects-v2', M = 'iel-meta-v2', R = 'iel-results-v2', H = 'iel-history-v2', A = 'iel-audit-active-v1';
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
const seed = (results, extra = {}) => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 5, 12, 0, 0));          // device day = Home date = 5 Oct, so the Home-date follow leaves the seeded site alone
  localStorage.setItem(P, JSON.stringify([SITE]));
  localStorage.setItem(M, JSON.stringify({ s1: { auditor: 'Jane', testDate: day(5), dateDay: day(5), nextTestDate: '', ...extra } }));
  if (results) localStorage.setItem(R, JSON.stringify({ s1: results }));
};
const done = { status: 'pass', mechCheck: true, circuitIso: true, lastTested: day(5) };
async function toHome(user) { render(<AppRoot />); await user.click(screen.getByText('IEL TESTING', { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' })); }
async function toArea(user, cat, area) { await toHome(user); await user.click(screen.getByRole('button', { name: new RegExp(cat) })); await user.click(await screen.findByText(area)); }
async function toItem(user, cat, area, item) { await toArea(user, cat, area); await user.click(await screen.findByTestId('iel-type-' + ({ 'E-Stops': 'estops', Lanyards: 'lanyards', Isolators: 'isolators' })[cat])); await user.click(await screen.findByText(item)); }
const tick = (user, name) => user.click(screen.getByRole('button', { name: new RegExp(name) }));

describe('AUTO PASS', () => {
  it('an isolator or an e-stop passes when its TWO checks are ticked, in either order, and the date is stamped', async () => {
    for (const order of [['Mechanism', 'Circuit Isolation'], ['Circuit Isolation', 'Mechanism']]) {
      cleanup(); localStorage.clear(); seed(); const user = userEvent.setup();
      await toItem(user, 'E-Stops', 'Wash Plant', 'Feed Conveyor 1');
      await tick(user, order[0]); await waitFor(() => expect(ls(R).s1.a1.estops.x1.mechCheck || ls(R).s1.a1.estops.x1.circuitIso).toBe(true));
      expect((ls(R).s1.a1.estops.x1.status || 'untested')).toBe('untested');                                       // one tick of two: nothing yet
      await tick(user, order[1]); await waitFor(() => expect(ls(R).s1.a1.estops.x1.status).toBe('pass'));
      expect(ls(R).s1.a1.estops.x1.lastTested).toBe(day(5));
      expect(screen.getByTestId('iel-check-note').textContent).toBe('Marked PASS because all checks are ticked.');
    }
  });
  it('a lanyard needs all THREE: two ticks leave it untested, the third passes it', async () => {
    seed(); const user = userEvent.setup(); await toItem(user, 'Lanyards', 'Wash Plant', 'Pit Lanyard 1');
    await tick(user, 'Mechanism'); await tick(user, 'Circuit Isolation');
    await waitFor(() => expect(ls(R).s1.a1.lanyards.y1.circuitIso).toBe(true)); expect(ls(R).s1.a1.lanyards.y1.status || 'untested').toBe('untested');
    expect(screen.getByTestId('iel-check-note').textContent).toBe('');
    await tick(user, 'Lanyard Tension'); await waitFor(() => expect(ls(R).s1.a1.lanyards.y1.status).toBe('pass'));
  });
  it('a recorded FAIL or N/A is never flipped; a hint says so in words', async () => {
    for (const [btn, key, word] of [['FAIL', 'fail', 'FAIL'], ['N/A', 'na', 'N/A']]) {
      cleanup(); localStorage.clear(); seed(); const user = userEvent.setup();
      await toItem(user, 'E-Stops', 'Wash Plant', 'Feed Conveyor 1');
      await user.click(screen.getByRole('button', { name: btn })); await waitFor(() => expect(ls(R).s1.a1.estops.x1.status).toBe(key));
      await tick(user, 'Mechanism'); await tick(user, 'Circuit Isolation');
      await waitFor(() => expect(ls(R).s1.a1.estops.x1.circuitIso).toBe(true)); expect(ls(R).s1.a1.estops.x1.status).toBe(key);
      expect(screen.getByTestId('iel-check-note').textContent).toBe(`All checks are ticked. The result is still ${word}. Tap PASS to change it.`);
    }
  });
  it('unticking a required check takes a PASS back to untested (date cleared); ticking it again passes again', async () => {
    seed(); const user = userEvent.setup(); await toItem(user, 'E-Stops', 'Wash Plant', 'Feed Conveyor 1');
    await tick(user, 'Mechanism'); await tick(user, 'Circuit Isolation'); await waitFor(() => expect(ls(R).s1.a1.estops.x1.status).toBe('pass'));
    await tick(user, 'Mechanism'); await waitFor(() => expect(ls(R).s1.a1.estops.x1.status).toBe('untested')); expect(ls(R).s1.a1.estops.x1.lastTested).toBe('');
    expect(screen.getByTestId('iel-check-note').textContent).toBe('');
    await tick(user, 'Mechanism'); await waitFor(() => expect(ls(R).s1.a1.estops.x1.status).toBe('pass'));
  });
  it('taps only: an old saved item with all ticks and no result stays untested when it is opened, and the PASS button is open', async () => {
    seed({ a1: { estops: { x1: { status: 'untested', mechCheck: true, circuitIso: true, lastTested: '' } } } });
    const user = userEvent.setup(); await toItem(user, 'E-Stops', 'Wash Plant', 'Feed Conveyor 1');
    expect(screen.getByTestId('iel-check-note').textContent).toBe('');
    await new Promise(r => setTimeout(r, 50)); expect(ls(R).s1.a1.estops.x1.status).toBe('untested');
    await user.click(screen.getByRole('button', { name: 'PASS' })); await waitFor(() => expect(ls(R).s1.a1.estops.x1.status).toBe('pass'));
    expect(screen.getByTestId('iel-check-note').textContent).toBe('');                                            // a hand tap is not announced as automatic
  });
  it('a manual PASS stays blocked until every check is ticked', async () => {
    seed(); const user = userEvent.setup(); await toItem(user, 'E-Stops', 'Wash Plant', 'Feed Conveyor 1');
    await user.click(screen.getByRole('button', { name: 'PASS' })); await new Promise(r => setTimeout(r, 30));
    const r = ls(R); expect(!r || !r.s1 || !r.s1.a1 || !r.s1.a1.estops || !r.s1.a1.estops.x1 || (r.s1.a1.estops.x1.status || 'untested') === 'untested').toBe(true);
  });
  it('a lanyard passes on the THIRD tick in ALL SIX orders of its three checks, and never earlier', async () => {
    const names = ['Mechanism', 'Circuit Isolation', 'Lanyard Tension'];
    const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    for (const o of orders) {
      cleanup(); localStorage.clear(); seed(); const user = userEvent.setup();
      await toItem(user, 'Lanyards', 'Wash Plant', 'Pit Lanyard 1');
      await tick(user, names[o[0]]); await waitFor(() => expect(Object.values(ls(R).s1.a1.lanyards.y1).filter(v => v === true).length).toBe(1)); expect(ls(R).s1.a1.lanyards.y1.status || 'untested').toBe('untested');
      await tick(user, names[o[1]]); await waitFor(() => expect(Object.values(ls(R).s1.a1.lanyards.y1).filter(v => v === true).length).toBe(2)); expect(ls(R).s1.a1.lanyards.y1.status || 'untested').toBe('untested');
      await tick(user, names[o[2]]); await waitFor(() => expect(ls(R).s1.a1.lanyards.y1.status).toBe('pass'));
      expect(ls(R).s1.a1.lanyards.y1.lastTested).toBe(day(5));
    }
  }, 60000);
  it('after an auto PASS the Home pills, the Report counts and a History snapshot made by Complete Audit all count the item as PASS', async () => {
    seed(); const user = userEvent.setup(); await toItem(user, 'Lanyards', 'Wash Plant', 'Pit Lanyard 1');
    await tick(user, 'Mechanism'); await tick(user, 'Circuit Isolation'); await tick(user, 'Lanyard Tension'); await waitFor(() => expect(ls(R).s1.a1.lanyards.y1.status).toBe('pass'));
    await user.click(screen.getByRole('button', { name: /^Home$/ }));                                                    // Home: the Lanyards row shows 1 PASS (the other rows none)
    const row = await screen.findByRole('button', { name: /Lanyards/ }); expect(within(row).getByText('1 PASS')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /E-Stops/ })).getByText('0 PASS')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Report$/ }));                                                  // Report: one category summary has 1 PASS, the others 0
    expect(await screen.findAllByText('1 PASS')).toHaveLength(1); expect(screen.getAllByText('0 PASS')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: /^Home$/ }));                                                    // Complete Audit: the snapshot counts the item as PASS
    await user.click(await screen.findByRole('button', { name: /^Complete/ })); await user.click(await screen.findByRole('button', { name: /^Yes/ }));
    await waitFor(() => expect(ls(H).length).toBe(1)); expect(ls(H)[0].results.a1.lanyards.y1.status).toBe('pass');
    await user.click(screen.getByRole('button', { name: /^History$/ })); expect(await screen.findByText('1 PASS')).toBeInTheDocument(); expect(screen.getByText('4 —')).toBeInTheDocument();   // 5 items: 1 PASS and 4 untested
  });
  it('each tick is exactly ONE write of the results to storage, the completing tick included (the live-save path)', async () => {
    seed(); const user = userEvent.setup(); await toItem(user, 'Lanyards', 'Wash Plant', 'Pit Lanyard 1');
    const spy = vi.spyOn(Storage.prototype, 'setItem'); const writes = () => spy.mock.calls.filter(c => c[0] === R).length;
    try {
      for (const [i, name] of ['Mechanism', 'Circuit Isolation', 'Lanyard Tension'].entries()) {
        const before = writes(); await tick(user, name);
        await waitFor(() => expect(writes()).toBeGreaterThan(before)); await new Promise(r => setTimeout(r, 120));          // let any second write show up
        expect(writes() - before, 'tick ' + (i + 1)).toBe(1);
      }
      expect(ls(R).s1.a1.lanyards.y1.status).toBe('pass');
    } finally { spy.mockRestore(); }
  });
});

describe('TYPE SWITCHER', () => {
  const cards = () => ['estops', 'lanyards', 'isolators'].map(k => screen.getByTestId('iel-type-' + k));
  it('three full-width cards in the Home order, each with the count for THIS area, the full status set and a progress bar', async () => {
    seed({ a1: { estops: { x1: { ...done } } } }); const user = userEvent.setup(); await toArea(user, 'E-Stops', 'Wash Plant');
    const [e, l, i] = cards(); expect(screen.getByText('Choose a test category')).toBeInTheDocument();
    expect(e.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); expect(l.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(e).getByText('2 items')).toBeInTheDocument(); expect(within(l).getByText('2 items')).toBeInTheDocument();
    expect(within(e).getByText('1 PASS')).toBeInTheDocument(); expect(within(e).getByText('1 —')).toBeInTheDocument();      // full set: PASS FAIL N/A and the dash for untested
    expect(within(e).getAllByText(/PASS|FAIL|N\/A/).length).toBe(3);
    expect(e.style.minHeight).toBe('44px');
  });
  it('the count is for the AREA, not the site: Crusher Yard has one isolator and no e-stops or lanyards', async () => {
    seed(); const user = userEvent.setup(); await toArea(user, 'Isolators', 'Crusher Yard');
    const [e, l, i] = cards(); expect(within(i).getByText('1 item')).toBeInTheDocument();
    expect(within(e).getByText('No items')).toBeInTheDocument(); expect(within(l).getByText('No items')).toBeInTheDocument();
    expect(e.getAttribute('aria-current')).toBeNull(); expect(l.getAttribute('aria-current')).toBeNull(); expect(i.getAttribute('aria-current')).toBe('true'); expect(within(i).getByText('✓ Current')).toBeInTheDocument();   // Isolators is the audit's category and can be opened: the only card marked
    expect(screen.getAllByText(/Current/)).toHaveLength(1);
  });
  it('a disabled card is NEVER marked Current: the audit is on E-Stops, this area has none, so no card is marked at all', async () => {
    seed(); const user = userEvent.setup(); await toArea(user, 'E-Stops', 'Crusher Yard');
    const [e, l, i] = cards(); expect(within(e).getByText('No items')).toBeInTheDocument(); expect(e.getAttribute('aria-disabled')).toBe('true');
    expect(e.getAttribute('aria-current')).toBeNull(); expect(within(e).queryByText(/Current/)).toBeNull();
    expect(l.getAttribute('aria-current')).toBeNull(); expect(i.getAttribute('aria-current')).toBeNull();
    expect(document.querySelector('[aria-current]')).toBeNull(); expect(screen.queryByText(/Current/)).toBeNull();
    expect(within(i).getByText('1 item')).toBeInTheDocument(); expect(i.getAttribute('aria-disabled')).toBeNull();                 // Isolators can still be opened
  });
  it('a category with no items says No items, is aria-disabled, shows no counts, and cannot be opened', async () => {
    seed(); const user = userEvent.setup(); await toArea(user, 'E-Stops', 'Wash Plant');
    const iso = screen.getByTestId('iel-type-isolators'); expect(within(iso).getByText('No items')).toBeInTheDocument();
    expect(iso.getAttribute('aria-disabled')).toBe('true'); expect(within(iso).queryByText(/PASS/)).toBeNull();
    await user.click(iso); expect(screen.getByText('Choose a test category')).toBeInTheDocument(); expect(screen.queryByText(/Tap any item to open the test form/)).toBeNull();
    expect(screen.getByTestId('iel-type-estops').getAttribute('aria-current')).toBe('true'); expect(iso.getAttribute('aria-current')).toBeNull();      // the tap changed nothing: the current category is still E-Stops
    await new Promise(r => setTimeout(r, 30)); expect(ls(A).sites.s1.cat).toBe('estops');
    expect(screen.getByTestId('iel-type-estops').getAttribute('aria-disabled')).toBeNull();
  });
  it('an area with no panels at all shows three disabled cards', async () => {
    seed(); const user = userEvent.setup(); await toArea(user, 'E-Stops', 'Pit Store');
    cards().forEach(c => { expect(within(c).getByText('No items')).toBeInTheDocument(); expect(c.getAttribute('aria-disabled')).toBe('true'); });
  });
  it('the current category is marked in words and with aria-current, and only that one', async () => {
    seed(); const user = userEvent.setup(); await toArea(user, 'Lanyards', 'Wash Plant');
    const [e, l, i] = cards(); expect(within(l).getByText('✓ Current')).toBeInTheDocument(); expect(l.getAttribute('aria-current')).toBe('true');
    expect(e.getAttribute('aria-current')).toBeNull(); expect(i.getAttribute('aria-current')).toBeNull(); expect(within(e).queryByText(/Current/)).toBeNull();
  });
  it('switching: open E-Stops, Back, open Lanyards: same area, the other category becomes current and is saved; Back chain is item list, switcher, area list', async () => {
    seed(); const user = userEvent.setup(); await toArea(user, 'E-Stops', 'Wash Plant');
    await user.click(screen.getByTestId('iel-type-estops')); expect(await screen.findByText('Feed Conveyor 1')).toBeInTheDocument();
    await user.click(screen.getByText('Back')); await user.click(await screen.findByTestId('iel-type-lanyards'));
    expect(await screen.findByText('Pit Lanyard 1')).toBeInTheDocument(); expect(screen.getByText(/Wash Plant · 2 items/)).toBeInTheDocument();
    await waitFor(() => expect(ls(A).sites.s1.cat).toBe('lanyards'));
    await user.click(screen.getByText('Back')); expect(await screen.findByText('Choose a test category')).toBeInTheDocument();
    expect(within(screen.getByTestId('iel-type-lanyards')).getByText('✓ Current')).toBeInTheDocument();
    await user.click(screen.getByText('Back')); expect(await screen.findByText('Select Area')).toBeInTheDocument();
  });
  it('the Home heading reads TEST CATEGORIES and the three rows are still there', async () => {
    seed(); const user = userEvent.setup(); await toHome(user);
    expect(screen.getByText('TEST CATEGORIES')).toBeInTheDocument(); expect(screen.queryByText('SELECT TEST CATEGORY')).toBeNull();
    ['E-Stops', 'Lanyards', 'Isolators'].forEach(n => expect(screen.getByRole('button', { name: new RegExp(n) })).toBeInTheDocument());
  });
});

describe('HISTORY LABEL and CONTINUE', () => {
  const two = { a1: { estops: { x1: { ...done }, x2: { status: 'fail', mechCheck: false, lastTested: day(5) } }, lanyards: { y1: { status: 'na', lastTested: day(5) } } }, a2: { isolators: { z1: { ...done } } } };
  it('the pure helpers: categories with results, in the Home order; All Categories only for more than one', () => {
    expect(ielCatsWithResults(two)).toEqual(['estops', 'lanyards', 'isolators']);
    expect(ielCatsWithResults({ a1: { estops: { x1: { status: 'untested' } } } })).toEqual([]);
    expect(ielCatsWithResults(null)).toEqual([]);
    expect(ielSnapLabel({ results: two, label: 'E-Stops' })).toBe('All Categories');
    expect(ielSnapLabel({ results: { a1: { estops: { x1: { ...done } } } }, label: 'E-Stops' })).toBe('E-Stops');
    expect(ielSnapLabel({ results: {}, label: 'Lanyards' })).toBe('Lanyards'); expect(ielSnapLabel({ results: {} })).toBe('IEL Audit');
  });
  it('Complete Audit with results in two categories archives the label All Categories; with one it keeps that category', async () => {
    seed({ a1: { estops: { x1: { ...done } }, lanyards: { y1: { status: 'na', lastTested: day(5) } } } }, {});
    localStorage.setItem(A, JSON.stringify({ v: 1, sites: { s1: { cat: 'estops' } } }));
    const user = userEvent.setup(); await toHome(user);
    await user.click(screen.getByRole('button', { name: /^Complete/ })); await user.click(await screen.findByRole('button', { name: /^Yes/ }));
    await waitFor(() => expect(ls(H).length).toBe(1)); expect(ls(H)[0].label).toBe('All Categories'); expect(ls(H)[0].cat).toBe('estops');
    cleanup(); localStorage.clear(); seed({ a1: { estops: { x1: { ...done } } } }); localStorage.setItem(A, JSON.stringify({ v: 1, sites: { s1: { cat: 'estops' } } }));
    const u2 = userEvent.setup(); await toHome(u2);
    await u2.click(screen.getByRole('button', { name: /^Complete/ })); await u2.click(await screen.findByRole('button', { name: /^Yes/ }));
    await waitFor(() => expect(ls(H).length).toBe(1)); expect(ls(H)[0].label).toBe('E-Stops');
  });
  it('the History row relabels an OLD snapshot (stored as one category but holding two) without rewriting it', async () => {
    seed(); const snap = { id: 'h1', projectId: 's1', projectName: 'Site One', auditor: 'Jane', testDate: day(3), cat: 'estops', label: 'E-Stops', archivedAt: '2026-10-03T01:00:00.000Z', results: two, meta: { auditor: 'Jane', testDate: day(3) } };
    localStorage.setItem(H, JSON.stringify([snap]));
    const user = userEvent.setup(); await toHome(user); await user.click(screen.getByRole('button', { name: /^History$/ }));
    expect(await screen.findByText('All Categories')).toBeInTheDocument(); expect(ls(H)[0].label).toBe('E-Stops');
  });
  const snapWith = (results, cat) => ({ id: 'h1', projectId: 's1', projectName: 'Site One', auditor: 'Jane', testDate: day(3), cat, label: 'E-Stops', archivedAt: '2026-10-03T01:00:00.000Z', results, meta: { auditor: 'Jane', testDate: day(3), dateDay: day(5), nextTestDate: '' } });
  async function continueSnap(user) { await user.click(screen.getByRole('button', { name: /^History$/ })); await user.click(await screen.findByText('All Categories').catch(() => screen.findByText(/E-Stops|Lanyards|Isolators|IEL Audit/))); await user.click(await screen.findByRole('button', { name: /Continue/ })); await user.click(await screen.findByRole('button', { name: /Yes, Continue/ })); }
  it('Continue restores EVERY category of the snapshot, replacing the current results, and makes the snapshot\'s own category current', async () => {
    seed({ a1: { estops: { x1: { status: 'fail', lastTested: day(5) } }, lanyards: { y2: { status: 'pass', lastTested: day(5) } } } });          // the current audit: results in two categories
    localStorage.setItem(H, JSON.stringify([snapWith(two, 'lanyards')]));
    const user = userEvent.setup(); await toHome(user); await continueSnap(user);
    await waitFor(() => expect(ls(R).s1.a2.isolators.z1.status).toBe('pass'));
    expect(ls(R).s1).toEqual(two);                                                                                      // all three categories, exactly the snapshot (the old y2 is gone)
    await waitFor(() => expect(ls(A).sites.s1.cat).toBe('lanyards'));
  });
  it('Continue: a snapshot with one category makes it current; a snapshot whose own category has no results falls back to the first with results; an empty snapshot sets none', async () => {
    for (const [results, cat, expectCat] of [[{ a2: { isolators: { z1: { ...done } } } }, 'isolators', 'isolators'], [{ a1: { lanyards: { y1: { status: 'na', lastTested: day(5) } } } }, 'estops', 'lanyards'], [{}, 'estops', undefined]]) {
      cleanup(); localStorage.clear(); seed(); localStorage.setItem(H, JSON.stringify([snapWith(results, cat)]));
      const user = userEvent.setup(); await toHome(user); await continueSnap(user);
      await waitFor(() => expect(ls(A)).toBeTruthy()); expect(ls(A).sites.s1.cat).toBe(expectCat);
    }
  });
});

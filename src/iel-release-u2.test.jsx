// RELEASE u2, IEL navigation (FICTIONAL data). Commit 1: Home is a READ-ONLY summary (the three category rows are not controls) with ONE Start / Continue Audit button copied from the other modules.
// Later commits add the area list, the tab bar, the sticky bar and the per-tab scroll memory to this file.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
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

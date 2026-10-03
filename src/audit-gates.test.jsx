// AUDIT-GATES MATRIX (rows are added commit by commit; the full matrix lands in its own commit).
// Rows here: the PER-SITE ACTIVE-AUDIT FLAG — archived / discarded / never-audited / imported -> NO ACTIVE AUDIT; started -> AUDIT IN PROGRESS and it
// survives switching site and switching module; site delete clears it; a blank auditor disables Continue in all six modules.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

vi.setConfig({ testTimeout: 30000 });                       // multi-screen flows run several renders; keep them stable under a loaded CI / parallel run
afterEach(() => cleanup()); beforeEach(() => localStorage.clear());

const START = /Start \/ Continue Audit/;
// tile, projects key, meta key, active-flag key, how to press Start on Home, an areas value that makes the module render
const MODULES = [
  { tile: 'RCD TESTING', pk: 'rcd-projects-v6', mk: 'rcd-meta-v6', ak: 'rcd-audit-active-v1', start: /^Push Test/ },
  { tile: 'IEL TESTING', pk: 'iel-projects-v2', mk: 'iel-meta-v2', ak: 'iel-audit-active-v1', start: /E-Stops/ },
  { tile: 'TEST & TAG', pk: 'tat-projects-v1', mk: 'tat-meta-v1', ak: 'tat-audit-active-v1', start: START },
  { tile: 'THERMOGRAPHIC', pk: 'thermo-projects-v1', mk: 'thermo-meta-v1', ak: 'thermo-audit-active-v1', start: START },
  { tile: 'SWITCHBOARD', pk: 'swb-projects-v1', mk: 'swb-meta-v1', ak: 'swb-audit-active-v1', start: START },
  { tile: 'INSULATION RESISTANCE TESTING', pk: 'irt-projects-v1', mk: 'irt-meta-v1', ak: 'irt-audit-active-v1', start: START },
];
const site = (id, name) => ({ id, name, company: '', abn: '', licence: '', areas: [] });
function seed(m, sites, auditor = 'Jane') {
  localStorage.setItem(m.pk, JSON.stringify(sites.map(([id, name]) => site(id, name))));
  localStorage.setItem(m.mk, JSON.stringify(Object.fromEntries(sites.map(([id]) => [id, { auditor, testDate: '2026-10-01' }]))));
}
const openSite = async (user, m, name) => { await user.click(screen.getByText(m.tile, { exact: true })); await user.click(await screen.findByText(name, { selector: 'div' })); };
const startFromHome = async (user, m) => { await user.click(screen.getByRole('button', { name: m.start })); };
const back = user => user.click(screen.getAllByText('Back')[0]);
const auditTab = user => user.click(screen.getByRole('button', { name: /^Audit$/ }));
const activeMap = m => { const raw = localStorage.getItem(m.ak); return raw ? JSON.parse(raw).sites : null; };

describe.each(MODULES)('$tile — per-site active audit', m => {
  it('a never-audited site shows NO ACTIVE AUDIT even with an auditor name entered', async () => {
    seed(m, [['s1', 'Site One']]); const user = userEvent.setup(); render(<AppRoot />);
    await openSite(user, m, 'Site One'); await auditTab(user);
    expect(await screen.findByText('NO ACTIVE AUDIT')).toBeInTheDocument();
  });

  it('Start -> Back to Home -> Audit tab = AUDIT IN PROGRESS, and the flag is stored per site', async () => {
    seed(m, [['s1', 'Site One']]); const user = userEvent.setup(); render(<AppRoot />);
    await openSite(user, m, 'Site One'); await startFromHome(user, m); await back(user); await auditTab(user);
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
    expect(Object.keys(activeMap(m))).toEqual(['s1']);
  });

  it('switching SITE never loses it: A started, open B (never audited), come back to A', async () => {
    seed(m, [['s1', 'Site One'], ['s2', 'Site Two']]); const user = userEvent.setup(); render(<AppRoot />);
    await openSite(user, m, 'Site One'); await startFromHome(user, m); await back(user); await back(user);          // Home, then the site list
    await user.click(await screen.findByText('Site Two', { selector: 'div' })); await auditTab(user);
    expect(await screen.findByText('NO ACTIVE AUDIT')).toBeInTheDocument();                                         // B was never audited
    await back(user); await back(user);
    await user.click(await screen.findByText('Site One', { selector: 'div' }));
    expect(screen.getByText('COMPLETE ACTIVE AUDIT')).toBeInTheDocument();                                          // A is still in progress (Home card)
    await auditTab(user);                                                                                           // reopening a site does not arm the gate: straight to the folders
    expect(screen.queryByText('AUDIT IN PROGRESS')).toBeNull(); expect(screen.queryByText('NO ACTIVE AUDIT')).toBeNull();
    await back(user); await auditTab(user);                                                                         // Back arms it: now the in-progress gate
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
    expect(Object.keys(activeMap(m))).toEqual(['s1']);
  });

  it('switching MODULE never loses it: Start, Modules button, re-enter the module', async () => {
    seed(m, [['s1', 'Site One']]); const user = userEvent.setup(); render(<AppRoot />);
    await openSite(user, m, 'Site One'); await startFromHome(user, m);
    await user.click(screen.getByText('Modules')); await openSite(user, m, 'Site One');
    expect(screen.getByText('COMPLETE ACTIVE AUDIT')).toBeInTheDocument();                                          // still in progress after leaving and re-entering the module
    await auditTab(user);                                                                                           // re-entering does not arm the gate: straight to the folders
    expect(screen.queryByText('AUDIT IN PROGRESS')).toBeNull(); expect(screen.queryByText('NO ACTIVE AUDIT')).toBeNull();
    await back(user); await auditTab(user);
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
  });

  it('a started audit that is archived (Complete) -> NO ACTIVE AUDIT, flag cleared', async () => {
    seed(m, [['s1', 'Site One']]); const user = userEvent.setup(); render(<AppRoot />);
    await openSite(user, m, 'Site One'); await startFromHome(user, m); await back(user);
    await user.click(screen.getByRole('button', { name: /^Complete/ })); await user.click(await screen.findByRole('button', { name: /^Yes/ }));
    await auditTab(user);
    expect(await screen.findByText('NO ACTIVE AUDIT')).toBeInTheDocument();
    expect(activeMap(m)).toEqual({});
  });

  it('a started audit that is discarded (Reset) -> NO ACTIVE AUDIT, flag cleared', async () => {
    seed(m, [['s1', 'Site One']]); const user = userEvent.setup(); render(<AppRoot />);
    await openSite(user, m, 'Site One'); await startFromHome(user, m); await back(user);
    await user.click(screen.getByRole('button', { name: /^Reset/ })); await user.click(await screen.findByRole('button', { name: /^(Reset|Yes)$/ }));
    await auditTab(user);
    expect(await screen.findByText('NO ACTIVE AUDIT')).toBeInTheDocument();
    expect(activeMap(m)).toEqual({});
  });

  it('discarded WITHOUT pressing Back first (Start, Home tab, Reset) -> Audit tab = NO ACTIVE AUDIT, not an empty folder list', async () => {
    seed(m, [['s1', 'Site One']]); const user = userEvent.setup(); render(<AppRoot />);
    await openSite(user, m, 'Site One'); await startFromHome(user, m);
    await user.click(screen.getByRole('button', { name: /^Home$/ }));
    await user.click(screen.getByRole('button', { name: /^Reset/ })); await user.click(await screen.findByRole('button', { name: /^(Reset|Yes)$/ }));
    await auditTab(user);
    expect(await screen.findByText('NO ACTIVE AUDIT')).toBeInTheDocument();
    expect(activeMap(m)).toEqual({});
  });

  it('blank auditor after Start: the gate disables Continue with the reason in text; Back to Home still works', async () => {
    seed(m, [['s1', 'Site One']]); const user = userEvent.setup(); render(<AppRoot />);
    await openSite(user, m, 'Site One'); await startFromHome(user, m); await back(user);
    await user.clear(screen.getByDisplayValue('Jane')); await auditTab(user);
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue Audit/ })).toBeDisabled();
    expect(screen.getByText('Enter the auditor name on Home to continue.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Back to Home/ }));
    expect(await screen.findByRole('button', { name: m.start })).toBeInTheDocument();                              // landed on Home
    await user.type(screen.getAllByRole('textbox')[0], 'Jane'); await auditTab(user);
    expect(screen.getByRole('button', { name: /Continue Audit/ })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /Continue Audit/ }));
    expect(screen.queryByText('AUDIT IN PROGRESS')).toBeNull();
  });
});

describe('site delete (from now on): clears the active flag; TAT and IEL now also remove the site\'s meta + history like the other seven; already-orphaned records are left alone', () => {
  const del = async (user, name) => {                                  // the site card's delete button is the last button in the card; the confirm sits just before Keep
    let row = screen.getByText(name, { selector: 'div' }).parentElement; while (row && row.querySelectorAll('button').length < 2) row = row.parentElement;
    await user.click([...row.querySelectorAll('button')].pop()); await user.click((await screen.findByRole('button', { name: 'Keep' })).previousElementSibling);
  };
  describe.each(MODULES.slice(0, 6))('$tile', m => {
    it('deleting a site with an active audit removes its flag (and meta + history), leaving other sites and old orphans untouched', async () => {
      seed(m, [['s1', 'Site One'], ['s2', 'Site Two']]);
      const hk = m.mk.replace('-meta-', '-history-');
      localStorage.setItem(hk, JSON.stringify([{ id: 'h1', projectId: 's1', archivedAt: '2026-01-01T00:00:00Z', results: {}, meta: {} }, { id: 'h2', projectId: 's2', archivedAt: '2026-01-02T00:00:00Z', results: {}, meta: {} }, { id: 'h0', projectId: 'GONE-EARLIER', archivedAt: '2025-01-01T00:00:00Z', results: {}, meta: {} }]));
      const meta0 = JSON.parse(localStorage.getItem(m.mk)); meta0['GONE-EARLIER'] = { auditor: 'Old orphan' }; localStorage.setItem(m.mk, JSON.stringify(meta0));
      const user = userEvent.setup(); render(<AppRoot />);
      await openSite(user, m, 'Site One'); await startFromHome(user, m); await back(user); await back(user);
      expect(Object.keys(activeMap(m))).toEqual(['s1']);
      await del(user, 'Site One');
      expect(screen.queryByText('Site One', { selector: 'div' })).toBeNull();
      expect(activeMap(m)).toEqual({});
      const meta = JSON.parse(localStorage.getItem(m.mk)); expect(meta.s1).toBeUndefined(); expect(meta.s2).toBeDefined(); expect(meta['GONE-EARLIER']).toEqual({ auditor: 'Old orphan' });
      const hist = JSON.parse(localStorage.getItem(hk)).map(h => h.id).sort(); expect(hist).toEqual(['h0', 'h2']);   // s1's snapshot is gone, s2's and the old orphan stay
    });
  });
});

// ── Commit 4 rows: the GATE MARKER. Only Back from the top of the Audit tab arms it (session-only, never stored). Other tabs disarm it, the Home tab leaves it
// alone, Continue clears it, and the folder level you were at is kept across other tabs.
describe.each(MODULES)('$tile — gate marker', m => {
  const startAndBack = async user => { seed(m, [['s1', 'Site One']]); render(<AppRoot />); await openSite(user, m, 'Site One'); await startFromHome(user, m); await back(user); };
  const noGate = () => { expect(screen.queryByText('AUDIT IN PROGRESS')).toBeNull(); expect(screen.queryByText('NO ACTIVE AUDIT')).toBeNull(); };

  it.each(['Report', 'History', 'Manage', 'Dropdowns'])('Back, then %s tab, then Audit tab: NO gate (back in the folders)', async tab => {
    const user = userEvent.setup(); await startAndBack(user);
    await user.click(screen.getByRole('button', { name: new RegExp(`^${tab}$`) })); await auditTab(user);
    noGate();
  });

  it('Back, Home tab (not via another tab), Audit tab: still the gate (Home leaves the marker alone)', async () => {
    const user = userEvent.setup(); await startAndBack(user);
    await user.click(screen.getByRole('button', { name: /^Home$/ })); await auditTab(user);
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
  });

  it('Start, Home TAB directly (never pressed Back), Audit tab: NO gate — only Back arms it', async () => {
    seed(m, [['s1', 'Site One']]); const user = userEvent.setup(); render(<AppRoot />);
    await openSite(user, m, 'Site One'); await startFromHome(user, m);
    await user.click(screen.getByRole('button', { name: /^Home$/ })); await auditTab(user);
    noGate();
  });

  it('the gate\'s Back to Home, then Audit tab again: the gate again', async () => {
    const user = userEvent.setup(); await startAndBack(user); await auditTab(user);
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Back to Home/ })); await auditTab(user);
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
  });

  it('Continue Audit clears the marker; Back then arms it again', async () => {
    const user = userEvent.setup(); await startAndBack(user); await auditTab(user);
    await user.click(screen.getByRole('button', { name: /Continue Audit/ })); noGate();
    await back(user); await auditTab(user);
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
  });

  it('the marker is not persisted: after a relaunch the active audit opens straight into the folders', async () => {
    const user = userEvent.setup(); await startAndBack(user); await auditTab(user);
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
    cleanup(); const u2 = userEvent.setup(); render(<AppRoot />); await openSite(u2, m, 'Site One'); await auditTab(u2);
    noGate();                                                                                                   // flag survived (still active), marker did not
    expect(Object.keys(activeMap(m))).toEqual(['s1']);
  });
});

// The level you were at is kept across another tab. [tile, projects key, meta key, the site's areas, the child text that only shows INSIDE the first area]
const LEVEL = [
  ['RCD TESTING', 'rcd-projects-v6', 'rcd-meta-v6', [{ id: 'a1', name: 'Plant', panels: [{ id: 'p1', name: 'MSB1', circuits: ['1', '2'] }] }], /Push Test/, 'MSB1'],
  ['TEST & TAG', 'tat-projects-v1', 'tat-meta-v1', [{ id: 'a1', name: 'Plant', defaultFreq: '6', items: ['i1'], itemNames: { i1: 'Drill' }, itemTags: {}, itemEquipTypes: {}, itemFreqs: {} }], START, 'Drill'],
  ['THERMOGRAPHIC', 'thermo-projects-v1', 'thermo-meta-v1', [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB1', circuits: ['c1'], circuitNames: { c1: 'Main' } }] }], START, 'MSB1'],
  ['SWITCHBOARD', 'swb-projects-v1', 'swb-meta-v1', [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB1' }] }], START, 'MSB1'],
  ['INSULATION RESISTANCE TESTING', 'irt-projects-v1', 'irt-meta-v1', [{ id: 'a1', name: 'Plant', panels: [{ id: 'p1', name: 'MSB1', items: ['m1'] }] }], START, 'MSB1'],
];
describe.each(LEVEL)('%s — folder level kept across another tab', (tile, pk, mk, areas, startRe, child) => {
  it('inside an area, Report tab, Audit tab: back inside the same area (not the area list)', async () => {
    localStorage.setItem(pk, JSON.stringify([{ id: 's1', name: 'Site One', company: '', abn: '', licence: '', areas }])); localStorage.setItem(mk, JSON.stringify({ s1: { auditor: 'Jane', testDate: '2026-10-01' } }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText(tile, { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: startRe }));
    await user.click(await screen.findByText('Plant')); expect(await screen.findByText(child)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Report$/ }));
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    expect(await screen.findByText(child)).toBeInTheDocument();                                                  // same level
    expect(screen.queryByText('AUDIT IN PROGRESS')).toBeNull();
    await back(user); expect(screen.queryByText(child)).toBeNull();                                              // one Back = the area list, so we really were inside the area
  });
});

// IEL, with the real category + item labels from the shared fictional seed (src/test/pill-seed.cjs): Wash Plant -> E-Stops -> "Feed Conveyor 1" ...
import pillSeed from './test/pill-seed.cjs';
describe('IEL TESTING — folder level kept across another tab (real seed labels)', () => {
  it('inside Wash Plant (E-Stops), Report tab, Audit tab: back inside the same area, not the area list; one Back = the area list', async () => {
    const d = pillSeed.build('iel', 'nologo'); Object.entries(d.ls).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('IEL TESTING', { exact: true })); await user.click(await screen.findByText(pillSeed.SITE, { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /E-Stops/ }));                  // Start the E-Stops category
    await user.click(await screen.findByText('Wash Plant'));                           // area -> the category panel card
    await user.click((await screen.findAllByText('E-Stops'))[0]);                      // panel -> the items
    expect(await screen.findByText('Feed Conveyor 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Report$/ }));
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    expect(await screen.findByText('Feed Conveyor 1')).toBeInTheDocument();           // same (deepest) level
    expect(screen.queryByText('AUDIT IN PROGRESS')).toBeNull();
    await back(user); expect(screen.queryByText('Feed Conveyor 1')).toBeNull(); expect(screen.getAllByText('E-Stops').length).toBeGreaterThan(0);   // one Back = the panel list of the area
    await back(user); expect(screen.queryByText('E-Stops')).toBeNull();                                                                   // another Back = the area list
  });
});

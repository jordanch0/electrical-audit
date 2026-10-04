// AUDIT-GATES MATRIX — every scenario row, for every module (RCD, IEL, TAT, Thermo, SWB, IRT). Where each row lives:
//   start -> Back -> Audit tab (in progress) ............. per-site active audit; gate marker
//   start -> Back -> gate -> other tab -> Audit tab (gate STILL showing; only Continue clears it) ... gate marker; in the folders, other tab -> Audit = same level (level rows, incl. IEL)
//   start -> Home TAB directly -> Audit tab (no gate) ...... gate marker
//   start -> Modules -> back in -> Audit tab ................ per-site active audit (switch MODULE)
//   gate Back to Home -> Audit tab again (gate again) ...... gate marker
//   audit completed, not archived (in progress) ............ completed-but-not-archived rows (RCD/TAT/SWB/IRT) + src/audit-active-migration.test.jsx (IEL/Thermo incl. completed)
//   audit archived / active audit discarded (NO ACTIVE) .... per-site active audit (discard also without Back first)
//   site deleted (flag, meta, history cleared; old orphans kept) ... site delete
//   new site never audited (NO ACTIVE, even with an auditor) ........ per-site active audit
//   imported site (NO ACTIVE) ................................... imported rows (structure only; TAT / IEL carry untested results)
//   switch module or site while active (never lost) ....... per-site active audit (switch SITE / switch MODULE)
//   Continue from the gate, then Back again ................ gate marker
//   refresh toast / relaunch (data intact; the gate marker is persisted WITH the flag, so the gate is still there) ... gate marker (relaunch) + src/audit-active-migration.test.jsx + src/async-write-window.test.jsx
//   blank auditor (Continue disabled + reason in text; Back to Home works) ...... per-site active audit
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
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
  // ELT's Start is disabled until the site has a fitting, so its sites are seeded with one (the other modules start with no areas)
  { tile: 'EMERGENCY LIGHTING', pk: 'elt-projects-v2', mk: 'elt-meta-v1', ak: 'elt-audit-active-v1', start: /Start \/ Continue Testing/, areas: [{ id: 'ar', name: 'Plant', assets: [{ id: 'x1', assetLocation: 'Plant Door', assetId: 'E1', type: 'Exit Signs', typeOther: '', maintained: 'Maintained', fitting: '' }] }] },
  { tile: 'WELDER TESTING', pk: 'welder-projects-v2', mk: 'welder-meta-v1', ak: 'welder-audit-active-v1', start: START, areas: [{ id: 'ar', name: 'Plant', assets: [{ id: 'a1', assetId: 'WLD-1', brand: 'Kemppi', model: 'Mig', serial: '1' }] }] },
];
const site = (id, name, areas = []) => ({ id, name, company: '', abn: '', licence: '', areas });
function seed(m, sites, auditor = 'Jane') {
  localStorage.setItem(m.pk, JSON.stringify(sites.map(([id, name]) => site(id, name, m.areas || []))));
  localStorage.setItem(m.mk, JSON.stringify(Object.fromEntries(sites.map(([id]) => [id, { auditor, testDate: '2026-10-01' }]))));
}
const openSite = async (user, m, name) => { await user.click(screen.getByText(m.tile, { exact: true })); await user.click(await screen.findByText(name, { selector: 'div' })); };
const startFromHome = async (user, m) => { await user.click(screen.getByRole('button', { name: m.start })); };
const back = user => user.click(screen.getAllByText('Back')[0]);
const nav2 = (user, label) => user.click(screen.getByRole('button', { name: new RegExp(`^${label}$`) }));
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
    await auditTab(user);                                                                                           // A was armed by Back before we left: its gate is STILL up (per-site marker)
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Continue Audit/ }));                                      // only Continue clears it
    expect(screen.queryByText('AUDIT IN PROGRESS')).toBeNull(); expect(screen.queryByText('NO ACTIVE AUDIT')).toBeNull();
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

// ── GATE MARKER rows. Only Back from the top of the Audit tab arms it; it is stored per site as `gate` in the site's flag entry, so it survives other tabs, the Home tab,
// switching site or module and a reload. ONLY Continue (and Start / History Continue / Complete / Reset / site delete) clears it. The folder level is kept across every other tab.
describe.each(MODULES)('$tile — gate marker', m => {
  const startAndBack = async user => { seed(m, [['s1', 'Site One']]); render(<AppRoot />); await openSite(user, m, 'Site One'); await startFromHome(user, m); await back(user); };
  const noGate = () => { expect(screen.queryByText('AUDIT IN PROGRESS')).toBeNull(); expect(screen.queryByText('NO ACTIVE AUDIT')).toBeNull(); };

  it.each(['Report', 'History', 'Manage', 'Dropdowns'])('Back, Audit (gate), then %s tab, then Audit tab: the gate is STILL showing', async tab => {
    const user = userEvent.setup(); await startAndBack(user); await auditTab(user);
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: new RegExp(`^${tab}$`) })); await auditTab(user);
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue Audit/ })).toBeEnabled();
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

  it('the marker is persisted with the flag: Back then an immediate reload, the gate is still there; Continue clears it for good', async () => {
    const user = userEvent.setup(); await startAndBack(user);
    expect(activeMap(m).s1.gate).toBe(true);                                                                    // stored the moment Back lands on Home
    cleanup(); const u2 = userEvent.setup(); render(<AppRoot />); await openSite(u2, m, 'Site One'); await auditTab(u2);
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();                                   // the gate survived the reload
    await u2.click(screen.getByRole('button', { name: /Continue Audit/ })); noGate();
    expect(activeMap(m).s1.gate).toBeUndefined();
    cleanup(); const u3 = userEvent.setup(); render(<AppRoot />); await openSite(u3, m, 'Site One'); await auditTab(u3);
    noGate();                                                                                                   // Continue was remembered too
    expect(Object.keys(activeMap(m))).toEqual(['s1']);
  });

  it('switching MODULE while armed: Modules button, re-enter, the gate is still up', async () => {
    const user = userEvent.setup(); await startAndBack(user);
    await user.click(screen.getByText('Modules')); await openSite(user, m, 'Site One'); await auditTab(user);
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
  });

  it('the marker belongs to ONE site: arming site One leaves site Two (also started) unarmed', async () => {
    seed(m, [['s1', 'Site One'], ['s2', 'Site Two']]); const user = userEvent.setup(); render(<AppRoot />);
    await openSite(user, m, 'Site One'); await startFromHome(user, m); await back(user);                          // arm One
    await back(user);                                                                                           // site list
    await user.click(await screen.findByText('Site Two', { selector: 'div' })); await startFromHome(user, m); await nav2(user, 'Home'); await auditTab(user);
    noGate();                                                                                                   // Two was started and never armed: folders
    expect(activeMap(m).s1.gate).toBe(true); expect(activeMap(m).s2.gate).toBeUndefined();
  });

  it.each(['Complete', 'Reset'])('%s clears the marker: the next Start is not gated', async how => {
    const user = userEvent.setup(); await startAndBack(user); expect(activeMap(m).s1.gate).toBe(true);
    if (how === 'Complete') { await user.click(screen.getByRole('button', { name: /^Complete/ })); await user.click(await screen.findByRole('button', { name: /^Yes/ })); }
    else { await user.click(screen.getByRole('button', { name: /^Reset/ })); await user.click(await screen.findByRole('button', { name: /^(Reset|Yes)$/ })); }
    expect(activeMap(m).s1).toBeUndefined();
    await startFromHome(user, m); noGate();                                                                     // a fresh start goes straight into the folders
  });

  it('the Home TAB leaves the gate up', async () => {
    const user = userEvent.setup(); await startAndBack(user); await auditTab(user);
    await nav2(user, 'Home'); await auditTab(user);
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
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
describe.each(LEVEL)('%s — folder level kept across another tab (the Home tab included)', (tile, pk, mk, areas, startRe, child) => {
  it.each(['Report', 'Home'])('inside an area, %s tab, Audit tab: back inside the same area (not the area list)', async tab => {
    localStorage.setItem(pk, JSON.stringify([{ id: 's1', name: 'Site One', company: '', abn: '', licence: '', areas }])); localStorage.setItem(mk, JSON.stringify({ s1: { auditor: 'Jane', testDate: '2026-10-01' } }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText(tile, { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: startRe }));
    await user.click(await screen.findByText('Plant')); expect(await screen.findByText(child)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: new RegExp(`^${tab}$`) }));
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    expect(await screen.findByText(child)).toBeInTheDocument();                                                  // same level
    expect(screen.queryByText('AUDIT IN PROGRESS')).toBeNull();
    await back(user); expect(screen.queryByText(child)).toBeNull();                                              // one Back = the area list, so we really were inside the area
  });
});

// ELT and Welder have no folders: the list is the top level and an item's page (a fitting / a welder) the one deeper level. The item page is kept across another tab; one Back = the list.
const ITEM_LEVEL = [['EMERGENCY LIGHTING', 'Plant Door'], ['WELDER TESTING', 'WLD-1']];
describe.each(ITEM_LEVEL)('%s — the open item is kept across another tab (the Home tab included)', (tile, rowText) => {
  it.each(['Report', 'Home', 'History', 'Manage'])('on an item page, %s tab, Audit tab: back on the same item; one Back = the list', async tab => {
    const m = MODULES.find(x => x.tile === tile); seed(m, [['s1', 'Site One']]);
    const user = userEvent.setup(); render(<AppRoot />); await openSite(user, m, 'Site One'); await startFromHome(user, m);
    await user.click((await screen.findAllByText(new RegExp(rowText)))[0]); expect(await screen.findByText(/Visual Inspection/)).toBeInTheDocument();      // the item page
    await user.click(screen.getByRole('button', { name: new RegExp(`^${tab}$`) }));
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    expect(await screen.findByText(/Visual Inspection/)).toBeInTheDocument();                                    // same fitting, not the list
    expect(screen.queryByText('AUDIT IN PROGRESS')).toBeNull();
    await back(user); expect(screen.queryByText(/Visual Inspection/)).toBeNull(); expect(screen.getAllByText(new RegExp(rowText)).length).toBeGreaterThan(0);    // one Back = the list
  });
  it('Back from the list arms the gate; Continue lands on the list (the top), not on the item', async () => {
    const m = MODULES.find(x => x.tile === tile); seed(m, [['s1', 'Site One']]);
    const user = userEvent.setup(); render(<AppRoot />); await openSite(user, m, 'Site One'); await startFromHome(user, m);
    await user.click((await screen.findAllByText(new RegExp(rowText)))[0]); await back(user); await back(user);   // item -> list -> Home (arms)
    await user.click(screen.getByRole('button', { name: /^Audit$/ })); expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Continue Audit/ })); expect((await screen.findAllByText(new RegExp(rowText))).length).toBeGreaterThan(0); expect(screen.queryByText(/Visual Inspection/)).toBeNull();
  });
});

// IEL, with the real category + item labels from the shared fictional seed (src/test/pill-seed.cjs): Wash Plant -> E-Stops -> "Feed Conveyor 1" ...
import pillSeed from './test/pill-seed.cjs';
describe('IEL TESTING — folder level kept across another tab (real seed labels)', () => {
  it.each(['Report', 'Home'])('inside Wash Plant (E-Stops), %s tab, Audit tab: back inside the same area, not the area list; one Back = the area list', async tab => {
    const d = pillSeed.build('iel', 'nologo'); Object.entries(d.ls).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('IEL TESTING', { exact: true })); await user.click(await screen.findByText(pillSeed.SITE, { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /E-Stops/ }));                  // Start the E-Stops category
    await user.click(await screen.findByText('Wash Plant'));                           // area -> the category panel card
    await user.click((await screen.findAllByText('E-Stops'))[0]);                      // panel -> the items
    expect(await screen.findByText('Feed Conveyor 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: new RegExp(`^${tab}$`) }));
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    expect(await screen.findByText('Feed Conveyor 1')).toBeInTheDocument();           // same (deepest) level
    expect(screen.queryByText('AUDIT IN PROGRESS')).toBeNull();
    await back(user); expect(screen.queryByText('Feed Conveyor 1')).toBeNull(); expect(screen.getAllByText('E-Stops').length).toBeGreaterThan(0);   // one Back = the panel list of the area
    await back(user); expect(screen.queryByText('E-Stops')).toBeNull();                                                                   // another Back = the area list
  });
});

// ── Commit 6 rows: the rest of the matrix. A COMPLETED-but-not-archived audit (every item marked) is in progress; an IMPORTED site (structure only, no
// auditor, nothing marked) has no active audit. Both for all six modules.
const SWB_KEYS = ['enclosure', 'ventilation', 'moisture', 'insulation', 'busbars', 'terminations', 'protection', 'contactors', 'mounting', 'labelling', 'earthing'];
const A = (areas) => areas;
const COMPLETE = [
  { tile: 'RCD TESTING', pk: 'rcd-projects-v6', mk: 'rcd-meta-v6', rk: 'rcd-results-v6', hk: 'rcd-history-v6', areas: A([{ id: 'a1', name: 'Plant', panels: [{ id: 'p1', name: 'MSB1', circuits: ['1', '2'] }] }]),
    results: { a1: { p1: { 1: { push: { status: 'pass' }, inject: {} }, 2: { push: { status: 'pass' }, inject: {} } } } } },
  { tile: 'TEST & TAG', pk: 'tat-projects-v1', mk: 'tat-meta-v1', rk: 'tat-results-v1', hk: 'tat-history-v1', areas: A([{ id: 'a1', name: 'Plant', defaultFreq: '6', items: ['i1', 'i2'], itemNames: {}, itemTags: {}, itemEquipTypes: {}, itemFreqs: {} }]),
    results: { a1: { i1: { status: 'pass' }, i2: { status: 'pass' } } } },
  { tile: 'SWITCHBOARD', pk: 'swb-projects-v1', mk: 'swb-meta-v1', rk: 'swb-results-v1', hk: 'swb-history-v1', areas: A([{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB1' }] }]),
    results: { a1: { b1: Object.fromEntries(SWB_KEYS.map(k => [k, { status: 'pass' }])) } } },
  { tile: 'INSULATION RESISTANCE TESTING', pk: 'irt-projects-v1', mk: 'irt-meta-v1', rk: 'irt-results-v1', hk: 'irt-history-v1', areas: A([{ id: 'a1', name: 'Plant', panels: [{ id: 'p1', name: 'MSB1', items: ['m1', 'm2'] }] }]),
    results: { a1: { p1: { m1: { status: 'pass', readings: {}, testVoltage: '500V' }, m2: { status: 'pass', readings: {}, testVoltage: '500V' } } } } },
];
describe.each(COMPLETE)('$tile — completed but not archived', c => {
  it('every item marked: Back then Audit shows AUDIT IN PROGRESS; archiving it then shows NO ACTIVE AUDIT and keeps a History snapshot', async () => {
    localStorage.setItem(c.pk, JSON.stringify([{ id: 's1', name: 'Site One', company: '', abn: '', licence: '', areas: c.areas }])); localStorage.setItem(c.mk, JSON.stringify({ s1: { auditor: 'Jane', testDate: '2026-10-01' } }));
    localStorage.setItem(c.rk, JSON.stringify({ s1: c.results }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText(c.tile, { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' }));
    expect(screen.getByText('COMPLETE ACTIVE AUDIT')).toBeInTheDocument();                         // all marked = still in progress, with its Complete card
    await auditTab(user); await back(user); await auditTab(user);
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Back to Home/ }));
    await user.click(screen.getByRole('button', { name: /^Complete/ })); await user.click(await screen.findByRole('button', { name: /^Yes/ }));
    await auditTab(user);
    expect(await screen.findByText('NO ACTIVE AUDIT')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(c.hk)).length).toBe(1);
  });
});

// Imported / structure-only sites. TAT and IEL imports carry untested results; the others carry none.
import pillSeedC6 from './test/pill-seed.cjs';
const IMPORTED = [
  ['RCD TESTING', 'rcd-projects-v6', COMPLETE[0].areas, null, null], ['TEST & TAG', 'tat-projects-v1', COMPLETE[1].areas, 'tat-results-v1', { a1: { i1: { status: 'untested' }, i2: { status: 'untested' } } }],
  ['SWITCHBOARD', 'swb-projects-v1', COMPLETE[2].areas, null, null], ['INSULATION RESISTANCE TESTING', 'irt-projects-v1', COMPLETE[3].areas, null, null],
  ['THERMOGRAPHIC', 'thermo-projects-v1', [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB1', circuits: ['c1'], circuitNames: { c1: 'Main' } }] }], null, null],
  ['IEL TESTING', 'iel-projects-v2', pillSeedC6.build('iel', 'nologo').ls['iel-projects-v2'][0].areas, 'iel-results-v2', { a1: { estops: { x1: { status: 'untested' } } } }],
];
describe.each(IMPORTED)('%s — imported site', (tile, pk, areas, rk, results) => {
  it('structure only, no auditor, nothing marked: NO ACTIVE AUDIT, no Complete card, nothing stored as active', async () => {
    localStorage.setItem(pk, JSON.stringify([{ id: 'imp', name: 'Imported Site', company: '', abn: '', licence: '', areas }]));
    if (rk) localStorage.setItem(rk, JSON.stringify({ imp: results }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText(tile, { exact: true })); await user.click(await screen.findByText('Imported Site', { selector: 'div' }));
    expect(screen.queryByText('COMPLETE ACTIVE AUDIT')).toBeNull();
    await auditTab(user);
    expect(await screen.findByText('NO ACTIVE AUDIT')).toBeInTheDocument();
    await waitFor(() => { const k = Object.keys(localStorage).find(x => x.endsWith('-audit-active-v1')); expect(JSON.parse(localStorage.getItem(k)).sites).toEqual({}); });
  });
});

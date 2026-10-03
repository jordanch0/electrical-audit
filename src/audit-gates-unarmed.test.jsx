// The UNARMED paths of the gate, in BOTH data formats, for all six modules.
//  (1) A site with NO active audit must show NO ACTIVE AUDIT on EVERY Audit tap — first tap, after Report / History / Manage / Dropdowns, after the Home tab,
//      after Back, after a relaunch. It depends only on "the site has no active audit", never on the session marker.
//  (2) A started site whose auditor is BLANK must show the in-progress gate with Continue DISABLED + "Enter the auditor name on Home to continue." on every
//      Audit tap — first tap after opening the site included — and there must be no route into the folders or items. Back to Home stays enabled.
// Formats: OLD = what the previous build stored (global rcd-mode-v6 / iel-cat-v2, NO active-flag keys, the migration builds them); NEW = per-site flags.
// (The first 54 matrix rows missed both: they only asserted the FIRST Audit tap of a never-audited site, and every blank-auditor row reached the gate THROUGH Back,
//  which arms the marker — the very thing that masked a blank auditor. These rows never press Back before the first Audit tap.)
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

vi.setConfig({ testTimeout: 30000 });
afterEach(() => cleanup()); beforeEach(() => localStorage.clear());

const DATE = '2026-10-01';
const SWB_KEYS = ['enclosure', 'ventilation', 'moisture', 'insulation', 'busbars', 'terminations', 'protection', 'contactors', 'mounting', 'labelling', 'earthing'];
const MODS = [
  { tile: 'RCD TESTING', short: 'RCD', p: 'rcd-projects-v6', r: 'rcd-results-v6', m: 'rcd-meta-v6', a: 'rcd-audit-active-v1', old: ['rcd-mode-v6', 'push'], entry: { mode: 'push' }, start: /^Push Test/,
    areas: [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'p1', name: 'MSB 1', circuits: ['CB 1', 'CB 2'] }] }],
    marked: { a1: { p1: { 'CB 1': { push: { status: 'pass' }, inject: {} } } } }, meta: au => ({ auditor: au, pushDate: DATE, injectDate: DATE, notes: '' }) },
  { tile: 'IEL TESTING', short: 'IEL', p: 'iel-projects-v2', r: 'iel-results-v2', m: 'iel-meta-v2', a: 'iel-audit-active-v1', old: ['iel-cat-v2', 'estops'], entry: { cat: 'estops' }, start: /E-Stops/,
    areas: [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'e1', name: 'estops', circuits: ['x1', 'x2'], machineNames: { x1: 'Feed Conveyor 1', x2: 'Feed Conveyor 2' } }] }],
    marked: { a1: { estops: { x1: { status: 'pass', lastTested: DATE } } } }, meta: au => ({ auditor: au, testDate: DATE, notes: '' }) },
  { tile: 'TEST & TAG', short: 'TAT', p: 'tat-projects-v1', r: 'tat-results-v1', m: 'tat-meta-v1', a: 'tat-audit-active-v1', entry: {}, start: /Start \/ Continue Audit/,
    areas: [{ id: 'a1', name: 'Workshop', defaultFreq: '3', items: ['i1', 'i2'], itemNames: { i1: 'Angle grinder', i2: 'Drill' }, itemTags: {}, itemEquipTypes: {}, itemFreqs: {} }],
    marked: { a1: { i1: { status: 'pass', visualCheck: 'pass', electricalCheck: 'pass', lastTested: DATE } } }, meta: au => ({ auditor: au, testDate: DATE, notes: '' }) },
  { tile: 'THERMOGRAPHIC', short: 'Thermo', p: 'thermo-projects-v1', r: 'thermo-results-v1', m: 'thermo-meta-v1', a: 'thermo-audit-active-v1', entry: {}, start: /Start \/ Continue Audit/,
    areas: [{ id: 'a1', name: 'Wash Plant', boards: [{ id: 'b1', name: 'MSB 1', circuits: ['c1', 'c2'], circuitNames: { c1: 'Main incomer', c2: 'Feed Conveyor 1' } }] }],
    marked: { a1: { b1: { c1: [{ id: '1', flirFile: '1001', temp: '34', result: 'PASS', notes: '', rectifiedDate: '' }] } } }, meta: au => ({ auditor: au, testDate: DATE, notes: '' }) },
  { tile: 'SWITCHBOARD', short: 'SWB', p: 'swb-projects-v1', r: 'swb-results-v1', m: 'swb-meta-v1', a: 'swb-audit-active-v1', entry: {}, start: /Start \/ Continue Audit/,
    areas: [{ id: 'a1', name: 'Wash Plant', boards: [{ id: 'b1', name: 'MSB 1' }] }],
    marked: { a1: { b1: { [SWB_KEYS[0]]: { status: 'pass' } } } }, meta: au => ({ auditor: au, testDate: DATE, notes: '' }) },
  { tile: 'INSULATION RESISTANCE TESTING', short: 'IRT', p: 'irt-projects-v1', r: 'irt-results-v1', m: 'irt-meta-v1', a: 'irt-audit-active-v1', entry: {}, start: /Start \/ Continue Audit/,
    areas: [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'p1', name: 'MSB 1', items: ['m1', 'm2'] }] }],
    marked: { a1: { p1: { m1: { status: 'pass', readings: {}, testVoltage: '500V' } } } }, meta: au => ({ auditor: au, testDate: DATE, notes: '' }) },
];
// Sites: C never touched; D started + auditor cleared (only recordable in the OLD format by RCD / IEL's global key; in the NEW format everywhere);
// E has marked items and a BLANK auditor (active in both formats, every module).
function seedData(m, fmt) {
  const sites = [['sc', 'Site C never audited'], ['sd', 'Site D started blank auditor'], ['se', 'Site E marked blank auditor']];
  localStorage.setItem(m.p, JSON.stringify(sites.map(([id, name]) => ({ id, name, company: '', abn: '', licence: '', areas: m.areas }))));
  localStorage.setItem(m.m, JSON.stringify({ sd: m.meta(''), se: m.meta('') }));                       // sc: no meta at all (never touched)
  localStorage.setItem(m.r, JSON.stringify({ se: m.marked }));
  if (fmt === 'new') localStorage.setItem(m.a, JSON.stringify({ v: 1, sites: { sd: m.entry, se: m.entry } }));
  else if (m.old) localStorage.setItem(m.old[0], JSON.stringify(m.old[1]));
}
const name = { sc: 'Site C never audited', sd: 'Site D started blank auditor', se: 'Site E marked blank auditor' };
const nav = (user, label) => user.click(screen.getByRole('button', { name: new RegExp(`^${label}$`) }));
const open = async (user, m, id) => { await user.click(screen.getByText(m.tile, { exact: true })); await user.click(await screen.findByText(name[id], { selector: 'div' })); };
const back = user => user.click(screen.getAllByText('Back')[0]);
const OTHERS = ['Report', 'History', 'Manage', 'Dropdowns', 'Home'];
const insideAudit = () => !screen.queryByText('AUDIT IN PROGRESS') && !screen.queryByText('NO ACTIVE AUDIT');
const expectNoActive = async () => { expect(await screen.findByText('NO ACTIVE AUDIT')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: /Continue Audit/ })).toBeNull(); };
const expectBlankGate = async () => {
  expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Continue Audit/ })).toBeDisabled();
  expect(screen.getByText('Enter the auditor name on Home to continue.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Back to Home/ })).toBeEnabled();
};

describe.each([['OLD', 'old'], ['NEW', 'new']])('%s format', (_l, fmt) => {
  describe.each(MODS)('$short', m => {
    it('never-audited site: NO ACTIVE AUDIT on the first Audit tap and after every other tab, Home, Back and a relaunch', async () => {
      seedData(m, fmt); const user = userEvent.setup(); render(<AppRoot />);
      await open(user, m, 'sc'); await nav(user, 'Audit'); await expectNoActive();
      for (const tab of OTHERS) { await nav(user, tab); await nav(user, 'Audit'); await expectNoActive(); }
      await back(user); await nav(user, 'Audit'); await expectNoActive();
      cleanup(); const u2 = userEvent.setup(); render(<AppRoot />); await open(u2, m, 'sc'); await nav(u2, 'Audit'); await expectNoActive();     // relaunch
    });

    it('marked items + BLANK auditor: the gate (Continue disabled + the line) on the first Audit tap and after every other tab, Home, Back and a relaunch', async () => {
      seedData(m, fmt); const user = userEvent.setup(); render(<AppRoot />);
      await open(user, m, 'se'); await nav(user, 'Audit'); await expectBlankGate();                  // FIRST tap, no Back pressed
      for (const tab of OTHERS) { await nav(user, tab); await nav(user, 'Audit'); await expectBlankGate(); }
      await back(user); await nav(user, 'Audit'); await expectBlankGate();
      cleanup(); const u2 = userEvent.setup(); render(<AppRoot />); await open(u2, m, 'se'); await nav(u2, 'Audit'); await expectBlankGate();   // relaunch
    });

    it('marked items + blank auditor: no route into the folders or items — Start / mode / category buttons are inert, Continue is dead, Back to Home works', async () => {
      seedData(m, fmt); const user = userEvent.setup(); render(<AppRoot />);
      await open(user, m, 'se');
      await user.click(screen.getByRole('button', { name: m.start }));                                // Home's Start / mode / category button with a blank auditor
      expect(screen.getByRole('button', { name: m.start })).toBeInTheDocument();                       // still on Home: no folders opened
      await nav(user, 'Audit'); await expectBlankGate();
      await user.click(screen.getByRole('button', { name: /Continue Audit/ })); await expectBlankGate();    // disabled: nothing happens
      await user.click(screen.getByRole('button', { name: /Back to Home/ })); expect(await screen.findByRole('button', { name: m.start })).toBeInTheDocument();
      await user.type(screen.getAllByRole('textbox')[0], 'Jane'); await nav(user, 'Audit');           // with an auditor the audit opens (folders), no gate needed
      expect(insideAudit()).toBe(true); expect(screen.queryByRole('button', { name: m.start })).toBeNull();   // in the folders: no gate, and no longer on Home
    });
  });

  // The "started, then the auditor was cleared" site: the OLD format can only record that start for RCD and IEL (the global key); the NEW format for every module.
  describe.each(MODS.filter(m => fmt === 'new' || m.old))('$short started, then auditor cleared', m => {
    it('first Audit tap and every later one: the in-progress gate, Continue disabled + the line (never the folders)', async () => {
      seedData(m, fmt); const user = userEvent.setup(); render(<AppRoot />);
      await open(user, m, 'sd'); await nav(user, 'Audit'); await expectBlankGate();
      for (const tab of OTHERS) { await nav(user, tab); await nav(user, 'Audit'); await expectBlankGate(); }
      cleanup(); const u2 = userEvent.setup(); render(<AppRoot />); await open(u2, m, 'sd'); await nav(u2, 'Audit'); await expectBlankGate();
    });
  });
});

// Another way into the items: History -> Continue. With a snapshot whose auditor is blank it used to drop straight into the folders (SWB checked on the phone
// build before the fix); the gate now stops it, because the gate is decided by state, not by the route taken.
describe('History -> Continue with a blank-auditor snapshot (SWB)', () => {
  it('lands on the in-progress gate with Continue disabled, not in the folders', async () => {
    const m = MODS[4]; seedData(m, 'new');
    localStorage.setItem('swb-history-v1', JSON.stringify([{ id: 'h1', projectId: 'sc', projectName: 'Site C', testDate: '2026-09-01', auditor: '', archivedAt: '2026-09-01T00:00:00Z', results: { a1: { b1: { enclosure: { status: 'pass' } } } }, meta: { auditor: '', testDate: '2026-09-01' } }]));
    const user = userEvent.setup(); render(<AppRoot />);
    await open(user, m, 'sc'); await nav(user, 'History');
    await user.click((await screen.findAllByText('Switchboard Audit'))[0].closest('button'));
    await user.click(await screen.findByRole('button', { name: /Continue/ })); await user.click(await screen.findByRole('button', { name: /Yes, Continue/ }));
    await expectBlankGate();
  });
});

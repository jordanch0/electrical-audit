// AUDIT-GATES MATRIX (rows are added commit by commit; the full matrix lands in its own commit).
// Rows here: the PER-SITE ACTIVE-AUDIT FLAG — archived / discarded / never-audited / imported -> NO ACTIVE AUDIT; started -> AUDIT IN PROGRESS and it
// survives switching site and switching module; site delete clears it; a blank auditor disables Continue in all six modules.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

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
    await user.click(await screen.findByText('Site One', { selector: 'div' })); await auditTab(user);
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();                                       // A is still in progress
    expect(Object.keys(activeMap(m))).toEqual(['s1']);
  });

  it('switching MODULE never loses it: Start, Modules button, re-enter the module', async () => {
    seed(m, [['s1', 'Site One']]); const user = userEvent.setup(); render(<AppRoot />);
    await openSite(user, m, 'Site One'); await startFromHome(user, m);
    await user.click(screen.getByText('Modules')); await openSite(user, m, 'Site One'); await auditTab(user);
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

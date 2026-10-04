// JORDAN'S GATE SPEC (A, B, C), all six modules, OLD and NEW data format. (D — the Complete Audit button — is in audit-blank-auditor-message.test.jsx.)
//  A items marked: the Audit tab opens at the folder level last left at; Back to Home then Audit shows the "Audit in progress" gate; in the folders, any other tab
//    then Audit returns to the folder level; ON THE GATE, any other tab then Audit shows the gate AGAIN (only Continue clears it).
//  B started, nothing marked (auditor set): exactly the same as A.   C never touched: "No active audit" always.
// The marker is stored per site as `gate` in the site's flag entry; a gate-only entry is NOT an active audit.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';
import { GATE_MODS, GATE_SITE_NAMES, seedGateData } from './test/gate-seeds.js';

vi.setConfig({ testTimeout: 30000 });
afterEach(() => cleanup()); beforeEach(() => localStorage.clear());

const nav = (user, label) => user.click(screen.getByRole('button', { name: new RegExp(`^${label}$`) }));
const back = user => user.click(screen.getAllByText('Back')[0]);
const open = async (user, m, id) => { await user.click(screen.getByText(m.tile, { exact: true })); await user.click(await screen.findByText(GATE_SITE_NAMES[id], { selector: 'div' })); };
const flags = m => { const raw = localStorage.getItem(m.a); return raw ? JSON.parse(raw).sites : null; };
const inFolders = () => !screen.queryByText('AUDIT IN PROGRESS') && !screen.queryByText('NO ACTIVE AUDIT') && !screen.queryByText(/Enter the auditor name/);
const OTHERS = ['Report', 'History', 'Manage', 'Dropdowns', 'Home'];

describe.each([['OLD', 'old'], ['NEW', 'new']])('%s format', (_l, fmt) => {
  describe.each(GATE_MODS)('$short', m => {
    const started = fmt === 'new' || !!m.old;                    // B (started, nothing marked) is only recordable in the OLD format by RCD / IEL
    const AB = ['sa', ...(started ? ['sb'] : [])];

    it.each(AB)('site %s (A items marked / B started): folders, Back arms the gate, other tabs keep it, only Continue clears it', async id => {
      seedGateData(m, fmt); const user = userEvent.setup(); render(<AppRoot />);
      await open(user, m, id); await nav(user, 'Audit');
      expect(inFolders()).toBe(true);                                                                        // the Audit tab opens in the folders (no gate yet)
      await back(user); await nav(user, 'Audit');
      expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();                              // Back to Home then Audit: the gate
      expect(screen.getByRole('button', { name: /Continue Audit/ })).toBeEnabled();
      for (const tab of OTHERS) { await nav(user, tab); await nav(user, 'Audit'); expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument(); }   // on the gate: any other tab, then Audit: the gate again
      await user.click(screen.getByRole('button', { name: /Continue Audit/ }));
      expect(inFolders()).toBe(true);                                                                        // only Continue clears it
      for (const tab of OTHERS) { await nav(user, tab); await nav(user, 'Audit'); expect(inFolders()).toBe(true); }   // in the folders: any other tab, then Audit: folders again
      await back(user); await nav(user, 'Audit');
      expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();                              // Back arms it again
      expect(flags(m)[id].gate).toBe(true);
    });

    it('site C (never touched): "No active audit" always, even while another site of the module has its gate up', async () => {
      seedGateData(m, fmt); const user = userEvent.setup(); render(<AppRoot />);
      await open(user, m, 'sa'); await nav(user, 'Audit'); await back(user); await nav(user, 'Audit');       // arm site A
      expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
      await nav(user, 'Home'); await back(user);                                                              // site list
      await user.click(await screen.findByText(GATE_SITE_NAMES.sc, { selector: 'div' }));
      for (const tab of [null, ...OTHERS]) { if (tab) await nav(user, tab); await nav(user, 'Audit'); expect(await screen.findByText('NO ACTIVE AUDIT')).toBeInTheDocument(); }
      expect(flags(m).sc).toBeUndefined();
    });

    it('a GATE-ONLY entry ({gate:true}, no flag) does not make a never-touched site active', async () => {
      seedGateData(m, fmt);
      const cur = JSON.parse(localStorage.getItem(m.a) || '{"v":1,"sites":{}}'); cur.sites.sc = { gate: true };
      if (fmt === 'old') { /* the old global key stays; the active-flag key already exists, so the one-time migration does not run again */ }
      localStorage.setItem(m.a, JSON.stringify(cur));
      const user = userEvent.setup(); render(<AppRoot />);
      await open(user, m, 'sc');
      expect(screen.queryByText('COMPLETE ACTIVE AUDIT')).toBeNull();                                         // not an active audit: no Complete card
      await nav(user, 'Audit'); expect(await screen.findByText('NO ACTIVE AUDIT')).toBeInTheDocument();
    });

    it('a site active only by marked items can be armed (a gate-only entry appears), survives a reload, and Complete removes it', async () => {
      seedGateData(m, fmt, { noFlagKey: true }); localStorage.setItem(m.a, JSON.stringify({ v: 1, sites: {} }));   // the flag key exists but holds nothing for A: it is active by its marks alone (and the one-time migration does not run)
      const user = userEvent.setup(); render(<AppRoot />);
      await open(user, m, 'sa'); await nav(user, 'Audit'); await back(user);
      expect(flags(m).sa).toEqual({ gate: true });                                                            // gate-only entry
      cleanup(); const u2 = userEvent.setup(); render(<AppRoot />); await open(u2, m, 'sa');
      expect(screen.getByText('COMPLETE ACTIVE AUDIT')).toBeInTheDocument();                                  // still active (its marks)
      await nav(u2, 'Audit'); expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();      // and the gate survived the reload
      await nav(u2, 'Home'); await u2.click(screen.getByRole('button', { name: /^Complete/ })); await u2.click(await screen.findByRole('button', { name: /^Yes/ }));
      expect(flags(m).sa).toBeUndefined();
    });
  });
});

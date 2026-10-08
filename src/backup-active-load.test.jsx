// WHAT THE APP DOES AT LOAD WITH THE AUDIT-ACTIVE KEY AFTER A RESTORE (all nine modules). FICTIONAL data. The restore engine is Stage 3, so a test-local helper writes what the plan says to add and the REAL app
// then loads the module; what it persists is read back.
//  * empty phone (no sites in the module, no key): the key is CREATED from the backup, so a restored mid-audit site keeps its EXACT entry (RCD mode, IEL category, ...), never re-derived;
//  * phone with other sites and no key: the key stays ABSENT, so the app derives every site's entry itself at load (progress => active; RCD / IEL also honour this phone's legacy rcd-mode / iel-cat).
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';
import { backupPlan } from './App.jsx';
import { MODULES } from './test/item-dates-fixtures.js';
import { seedModule, wipe, backupOf, naiveApply } from './test/backup-fixtures.js';

const MID_AUDIT = { rcd: { mode: 'inject' }, iel: { cat: 'isolators' } };            // distinct from what the app would DERIVE from the fixture's progress (push / estops)
const DERIVED = { rcd: { mode: 'push' }, iel: { cat: 'estops' } };
const entryOf = f => MID_AUDIT[f.mod] || { active: true };
const derivedOf = f => DERIVED[f.mod] || {};
const activeKey = f => `${f.mod}-audit-active-v1`;
beforeEach(wipe);
afterEach(cleanup);
async function loadModule(f) {
  const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText(f.tile, { exact: true }));
  await screen.findByText('Site One', { selector: 'div' }); await new Promise(r => setTimeout(r, 500));          // loaded; the active-map effect has saved
  return JSON.parse(localStorage.getItem(activeKey(f)));
}

describe.each(MODULES.map(f => [f.mod, f]))('%s', (mod, f) => {
  it('restored into an EMPTY phone: the mid-audit site keeps its exact audit-active entry', async () => {
    const file = await backupOf(() => { seedModule(f); const a = JSON.parse(localStorage.getItem(activeKey(f))); a.sites.s1 = entryOf(f); rawSetItem(activeKey(f), JSON.stringify(a)); });
    const plan = await backupPlan(file); expect(plan.work.modules[mod].activeMode).toBe('create'); naiveApply(plan);
    expect(JSON.parse(localStorage.getItem(activeKey(f)))).toEqual({ v: 1, sites: { s1: entryOf(f) } });
    expect(await loadModule(f)).toEqual({ v: 1, sites: { s1: entryOf(f) } });                                       // unchanged by the load: not re-derived
  });
  it('restored into a phone that has OTHER sites and no key: the key stays absent and the app derives every site\'s entry at load (the restored site is active because it has progress)', async () => {
    const file = await backupOf(() => { seedModule(f); const a = JSON.parse(localStorage.getItem(activeKey(f))); a.sites.s1 = entryOf(f); rawSetItem(activeKey(f), JSON.stringify(a)); });
    seedModule(f, { id: 'local', name: 'Local', snapId: 'hl' }); localStorage.removeItem(activeKey(f));              // an older phone: sites, results, no key
    const plan = await backupPlan(file); expect(plan.work.modules[mod]).toMatchObject({ activeMode: 'leave', active: {} }); naiveApply(plan);
    expect(localStorage.getItem(activeKey(f))).toBeNull();                                                          // nothing was created
    const after = await loadModule(f);
    expect(after).toEqual({ v: 1, sites: { local: derivedOf(f), s1: derivedOf(f) } });                              // both derived by the app itself
  });
});

describe('the legacy global keys are honoured by the derivation (and are never written by a restore)', () => {
  it('RCD: this phone\'s rcd-mode decides the mode of every derived entry, including the restored site', async () => {
    const f = MODULES.find(x => x.mod === 'rcd');
    const file = await backupOf(() => seedModule(f)); seedModule(f, { id: 'local', name: 'Local', snapId: 'hl' }); localStorage.removeItem(activeKey(f)); rawSetItem('rcd-mode-v6', '"inject"');
    naiveApply(await backupPlan(file)); const after = await loadModule(f);
    expect(after.sites).toEqual({ local: { mode: 'inject' }, s1: { mode: 'inject' } }); expect(localStorage.getItem('rcd-mode-v6')).toBe('"inject"');
  });
  it('IEL: this phone\'s iel-cat decides the category of every derived entry, including the restored site', async () => {
    const f = MODULES.find(x => x.mod === 'iel');
    const file = await backupOf(() => seedModule(f)); seedModule(f, { id: 'local', name: 'Local', snapId: 'hl' }); localStorage.removeItem(activeKey(f)); rawSetItem('iel-cat-v2', '"lanyards"');
    naiveApply(await backupPlan(file)); const after = await loadModule(f);
    expect(after.sites).toEqual({ local: { cat: 'lanyards' }, s1: { cat: 'lanyards' } }); expect(localStorage.getItem('iel-cat-v2')).toBe('"lanyards"');
  });
});

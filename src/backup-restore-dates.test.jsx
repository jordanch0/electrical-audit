// A RESTORED OLD-FORMAT SITE KEEPS ITS OWN DATES (all nine modules). FICTIONAL data. A backup made before item dates existed (meta without dateDay, results without lastTested) is restored into a phone that
// has ALREADY been migrated (its own site has dateDay). The app's load step recognises old data by the data itself, so the restored site's items get the site's STORED Home date and its History snapshot
// gets the snapshot's OWN date, never today's; the phone's own (already followed) site is left exactly as it was.
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { backupRestore } from './App.jsx';
import { MODULES, expHistStore } from './test/item-dates-fixtures.js';
import { seedModule, wipe, backupOf } from './test/backup-fixtures.js';

vi.setConfig({ testTimeout: 30000 });                       // multi-screen flows run several renders; keep them stable under a loaded / parallel run
configure({ asyncUtilTimeout: 10000 });                  // the first render of the whole app can take over RTL's 1 s default when the full suite runs in parallel

const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
beforeEach(wipe);
afterEach(cleanup);

describe.each(MODULES.map(f => [f.mod, f]))('%s', (mod, f) => {
  it('the restored site\'s items get the stored Home date and its snapshot its own date; the phone\'s own already-migrated site is untouched', async () => {
    const file = await backupOf(() => { seedModule(f); });                                                      // OLD format: no dateDay, no lastTested
    seedModule(f, { id: 'local', name: 'Local', snapId: 'hl' });
    const meta = JSON.parse(localStorage.getItem(f.keys.m)); meta.local.dateDay = '2026-10-05'; rawSetItem(f.keys.m, JSON.stringify(meta));            // this phone's site is already through the follow
    const hh = JSON.parse(localStorage.getItem(f.keys.h)); hh.forEach(sn => { if (sn.projectId === 'local') sn.meta = { ...sn.meta, dateDay: '2026-08-10' }; }); rawSetItem(f.keys.h, JSON.stringify(hh));          // … and so is its snapshot
    const localBefore = JSON.parse(localStorage.getItem(f.keys.r)).local; const localHist = JSON.parse(localStorage.getItem(f.keys.h)).find(s => s.projectId === 'local');
    expect((await backupRestore(file, { storage: S })).ok).toBe(true);
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText(f.tile, { exact: true }));
    await screen.findByText('Site One', { selector: 'div' }); await new Promise(r => setTimeout(r, 600));            // loaded; the backfill ran; the save effects wrote it
    const res = JSON.parse(localStorage.getItem(f.keys.r)), hist = JSON.parse(localStorage.getItem(f.keys.h));
    expect(res.s1).toEqual(f.expLive);                                                                          // stamped with the stored Home date (never today's)
    expect(hist.find(s => s.projectId === 's1')[f.snapField || 'results']).toEqual(expHistStore(f)[0][f.snapField || 'results']);   // the snapshot's own date
    expect(res.local).toEqual(localBefore); expect(hist.find(s => s.projectId === 'local')).toEqual(localHist);    // not touched
    expect(JSON.stringify(res.s1)).not.toContain(new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0'));   // and not "today"
  });
});

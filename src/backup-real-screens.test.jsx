// A backup made by the REAL app has to pass the restore check. Nothing here is seeded: each module is opened through its screens (site added, site opened, every tab visited), a backup is made and inspected, and
// the same file is restored onto an empty phone. Every storage key the app owns must be valid JSON, except the photo-migration marker (plain date text, written by migrateSitePhotos). FICTIONAL data only.
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { backupBuild, backupInspect, backupRestore, BACKUP_MODULE_INFO } from './App.jsx';
import { MODULES } from './test/item-dates-fixtures.js';
import { wipe, lsSnapshot } from './test/backup-fixtures.js';

vi.setConfig({ testTimeout: 60000 }); configure({ asyncUtilTimeout: 10000 });
const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
const MARKER_RE = /-photos-migrated-v\d+$/, OWNED_RE = /^(rcd|iel|tat|thermo|swb|irt|elt|welder|gsd)-[a-z-]+-v\d+$|^(cal-events|app-settings)-v\d+$/;
const settle = () => new Promise(r => setTimeout(r, 400));
const notJson = v => { try { JSON.parse(v); return false; } catch (_) { return true; } };
const nonJsonKeys = () => Object.entries(lsSnapshot()).filter(([k, v]) => OWNED_RE.test(k) && !/-preMigration-v\d+$/.test(k) && notJson(v)).map(([k]) => k).sort();
beforeEach(wipe); afterEach(cleanup);

async function useModule(f, user) {
  await user.click(screen.getByText(f.tile, { exact: true }));
  const add = await screen.findByRole('button', { name: /^\+ Add( \/ Import)? Site$/ }); await user.click(add);
  await user.type(screen.getByPlaceholderText('Site name'), 'Real Screens Site'); await user.click(screen.getByRole('button', { name: 'Add Site' }));
  await user.click(await screen.findByText('Real Screens Site', { selector: 'div' }));                   // open the site
  for (const tab of ['Audit', 'Report', 'History', 'Manage', 'Dropdowns', 'Home']) { const b = screen.queryAllByRole('button').find(x => (x.textContent || '').trim() === tab); if (b) { await user.click(b); await settle(); } }
}

describe.each(MODULES.map(f => [f.mod, f]))('%s, opened through its screens', (mod, f) => {
  it('the backup the real app makes passes the restore check, and restores', async () => {
    const user = userEvent.setup(); render(<AppRoot />); await useModule(f, user); await settle();
    const sites = JSON.parse(localStorage.getItem(BACKUP_MODULE_INFO[mod].keys.projects)); expect(sites.length).toBe(1);
    if (['swb', 'elt', 'welder'].includes(mod)) expect(localStorage.getItem(mod + '-photos-migrated-v1'), 'the real app wrote its marker').toBeTruthy();       // the photo modules: the marker case really is exercised
    const bad = nonJsonKeys(); expect(bad.filter(k => !MARKER_RE.test(k)), 'owned keys that are not JSON').toEqual([]);
    cleanup(); const { blob } = await backupBuild(); const ins = await backupInspect(blob); expect(ins.ok, ins.message).toBe(true);
    await wipe(); const r = await backupRestore(blob, { storage: S }); expect(r.ok, r.message).toBe(true); expect(r.summary).toMatchObject({ sitesAdded: 1 });
    expect(JSON.parse(localStorage.getItem(BACKUP_MODULE_INFO[mod].keys.projects))[0].name).toBe('Real Screens Site');
  });
});

describe('Calendar and Global Settings, opened through their screens', () => {
  it('their keys are JSON and the backup passes the check', async () => {
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByTestId('calendar-pill')); await settle(); cleanup();
    render(<AppRoot />); await user.click(screen.getByTestId('settings-pill')); await settle();
    const biz = screen.queryAllByRole('textbox')[0]; if (biz) { await user.type(biz, 'Example Electrical Pty Ltd'); await user.tab(); const save = screen.queryAllByRole('button').find(b => /^Save/i.test((b.textContent || '').trim())); if (save) await user.click(save); await settle(); }
    cleanup(); expect(JSON.parse(localStorage.getItem('app-settings-v1')).businessName).toBe('Example Electrical Pty Ltd'); expect(localStorage.getItem('cal-events-v1')).not.toBeNull();       // both screens really wrote their keys
    expect(nonJsonKeys().filter(k => !MARKER_RE.test(k))).toEqual([]);
    const { blob } = await backupBuild(); const ins = await backupInspect(blob); expect(ins.ok, ins.message).toBe(true);
  });
});

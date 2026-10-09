// DELETE A SITE WITH THE APP'S OWN HANDLER, RESTORE IT FROM A BACKUP TAKEN BEFORE THE DELETE, REOPEN IT (all nine modules). FICTIONAL data.
// The main use of restore: a site you deleted comes back with its results, meta, History, audit-active entry, per-site logo, photos and thumbnails, and the real app opens it.
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { backupBuild, backupRestore, BACKUP_MODULE_INFO } from './App.jsx';
import { MODULES } from './test/item-dates-fixtures.js';
import { idbSnapshot, lsSnapshot, wipe, seedSite, deleteSiteViaApp } from './test/backup-fixtures.js';

vi.setConfig({ testTimeout: 30000 });                       // multi-screen flows run several renders; keep them stable under a loaded / parallel run
configure({ asyncUtilTimeout: 10000 });                  // the first render of the whole app can take over RTL's 1 s default when the full suite runs in parallel

const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
beforeEach(wipe);
afterEach(cleanup);

describe.each(MODULES.map(f => [f.mod, f]))('%s', (mod, f) => {
  it('a deleted site comes back exactly as it was and the real app opens it', async () => {
    await wipe(); await seedSite(f); const { blob } = await backupBuild(); const original = { ls: lsSnapshot(), idb: await idbSnapshot() };
    await deleteSiteViaApp(f); cleanup();                                                                       // the app's own handler removes everything
    const r = await backupRestore(blob, { storage: S }); expect(r.ok, r.message).toBe(true); expect(r.summary).toMatchObject({ sitesAdded: 1, snapshotsAdded: 1 });
    const k = BACKUP_MODULE_INFO[mod].keys; const after = { ls: lsSnapshot(), idb: await idbSnapshot() };
    for (const key of Object.values(k)) expect(JSON.parse(after.ls[key]), key).toEqual(JSON.parse(original.ls[key]));       // project, results / items, meta, History, audit-active: the same values
    expect(after.idb).toEqual(original.idb);                                                                    // every photo, thumbnail and the site logo: the same bytes
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText(f.tile, { exact: true }));
    expect(await screen.findByText('Site One', { selector: 'div' })).toBeInTheDocument();                       // the real app lists the restored site …
    await new Promise(r2 => setTimeout(r2, 400)); expect(JSON.parse(localStorage.getItem(k.active)).sites.s1).toEqual({});     // … and its audit-active entry survived the load
    expect(JSON.parse(localStorage.getItem(k.projects)).map(p => p.id)).toEqual(['s1']);
  });
});

// DELETE A SITE WITH THE APP'S OWN HANDLER, THEN PLAN A RESTORE FROM A BACKUP TAKEN BEFORE THE DELETE (all nine modules). FICTIONAL data.
// Recovering a deleted site is a main use of restore, so a deleted site must leave NOTHING behind under its old ID (project, results / items, meta, History snapshots, audit-active entry, per-site logo,
// photos and thumbnails) and the planner must then offer it as "add" (never "existing data under the same ID", never "conflicting photos").
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { backupBuild, backupPlan, BACKUP_MODULE_INFO } from './App.jsx';
import { MODULES } from './test/item-dates-fixtures.js';
import { idbSnapshot, lsSnapshot, wipe, PHOTO_SETUP, PHOTO_IDS, seedSite, deleteSiteViaApp } from './test/backup-fixtures.js';

vi.setConfig({ testTimeout: 30000 });                       // multi-screen flows run several renders; keep them stable under a loaded / parallel run
configure({ asyncUtilTimeout: 10000 });                  // the first render of the whole app can take over RTL's 1 s default when the full suite runs in parallel

beforeEach(wipe);
afterEach(cleanup);

const gone = (f) => {
  const left = []; const rd = k => { const r = localStorage.getItem(k); return r === null ? null : JSON.parse(r); };
  const k = BACKUP_MODULE_INFO[f.mod].keys;
  if ((rd(k.projects) || []).some(p => p.id === 's1')) left.push('project');
  if (rd(k.results) && 's1' in rd(k.results)) left.push('results/items');
  if (rd(k.meta) && 's1' in rd(k.meta)) left.push('meta');
  if ((rd(k.history) || []).some(h => h.projectId === 's1')) left.push('History snapshot');
  const a = rd(k.active); if (a && a.sites && 's1' in a.sites) left.push('audit-active entry');
  return left;
};

describe.each(MODULES.map(f => [f.mod, f]))('%s: delete with the real handler, then restore from a backup taken before', (mod, f) => {
  it('leaves nothing behind under the old ID, and the planner offers the site back as "add"', async () => {
    await wipe(); await seedSite(f); const { blob } = await backupBuild();
    await deleteSiteViaApp(f);
    expect(gone(f)).toEqual([]);                                                                     // nothing of the site is left in localStorage
    const idb = await idbSnapshot();
    expect(Object.keys(idb['sparkcheck-site-logos'])).toEqual([]);                                   // the per-site logo is gone
    expect(Object.keys(idb['sparkcheck-site-photos'])).toEqual([]);                                  // every photo and thumbnail (live and in History) is gone
    expect(Object.keys(idb['sparkcheck-gsd-photos'])).toEqual([]);
    const before = lsSnapshot(), beforeIdb = await idbSnapshot();
    const plan = await backupPlan(blob);
    const p = plan.modules.find(x => x.id === mod);
    expect(p.sites.conflict, 'conflict').toEqual([]); expect(p.sites.present, 'present').toEqual([]); expect(p.sites.add.map(s => s.id)).toEqual(['s1']); expect(p.status).toBe('add');
    expect(plan.work.modules[mod].history.map(s => s.projectId)).toEqual(['s1']);
    const photoKeys = plan.work.writes.map(w => w.key).filter(k => !k.includes(':')).sort();
    expect(photoKeys).toEqual(PHOTO_SETUP[mod] ? [...PHOTO_IDS].sort() : []);                          // every live AND History photo + thumbnail comes back with the site
    expect(plan.work.writes.some(w => w.store === 'site-logos' && w.key === mod + ':s1')).toBe(true);
    expect(lsSnapshot()).toEqual(before); expect(await idbSnapshot()).toEqual(beforeIdb);            // planning changed nothing
  });
});

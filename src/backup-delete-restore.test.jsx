// DELETE A SITE WITH THE APP'S OWN HANDLER, THEN PLAN A RESTORE FROM A BACKUP TAKEN BEFORE THE DELETE (all nine modules). FICTIONAL data.
// Recovering a deleted site is a main use of restore, so a deleted site must leave NOTHING behind under its old ID (project, results / items, meta, History snapshots, audit-active entry, per-site logo,
// photos and thumbnails) and the planner must then offer it as "add" (never "existing data under the same ID", never "conflicting photos").
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';
import { backupBuild, backupPlan, BACKUP_MODULE_INFO, sitePhotoStore, gsdPhotoStore, siteLogoStore } from './App.jsx';
import { MODULES } from './test/item-dates-fixtures.js';
import { idbSnapshot, lsSnapshot, rec, seedModule, wipe, backupOf } from './test/backup-fixtures.js';

// the REAL photo shapes each module's delete handler walks: SWB board `_photos` + item `photos`, ELT / Welder asset `photos`, GSD item `photos` (live AND in a History snapshot)
const PHOTO_SETUP = {
  swb:    { store: sitePhotoStore, live: r => { r.a1.b1._photos = [{ id: 'live1', w: 1, h: 1 }]; r.a1.b1.enclosure.photos = [{ id: 'live2', w: 1, h: 1 }]; }, hist: r => { r.a1.b1._photos = [{ id: 'hist1', w: 1, h: 1 }]; } },
  elt:    { store: sitePhotoStore, live: r => { const a = Object.values(r)[0]; a.photos = [{ id: 'live1', w: 1, h: 1 }, { id: 'live2', w: 1, h: 1 }]; }, hist: r => { Object.values(r)[0].photos = [{ id: 'hist1', w: 1, h: 1 }]; } },
  welder: { store: sitePhotoStore, live: r => { const a = Object.values(r)[0]; a.photos = [{ id: 'live1', w: 1, h: 1 }, { id: 'live2', w: 1, h: 1 }]; }, hist: r => { Object.values(r)[0].photos = [{ id: 'hist1', w: 1, h: 1 }]; } },
  gsd:    { store: gsdPhotoStore,  live: r => { r[0].photos = [{ id: 'live1', w: 1, h: 1 }, { id: 'live2', w: 1, h: 1 }]; }, hist: r => { r[0].photos = [{ id: 'hist1', w: 1, h: 1 }]; } },
};
const PHOTO_IDS = ['live1', 'live1~t', 'live2', 'live2~t', 'hist1', 'hist1~t'];
const patchKey = (key, fn) => { const v = JSON.parse(localStorage.getItem(key)); fn(v); rawSetItem(key, JSON.stringify(v)); };
async function seedSite(f) {
  seedModule(f);
  const ps = PHOTO_SETUP[f.mod];
  if (ps) {
    patchKey(f.keys.r, v => ps.live(v.s1)); patchKey(f.keys.h, v => ps.hist(f.mod === 'gsd' ? v[0].items : v[0].results));
    for (const id of PHOTO_IDS) await ps.store.put(id, rec(id.length, 7));
  }
  await siteLogoStore.put(f.mod, 's1', rec(42));
}
beforeEach(wipe);
afterEach(cleanup);

// open the module's site list, press the site's own red delete button and confirm (the DeleteButton two-step: no window.confirm)
async function deleteSiteViaApp(f) {
  const user = userEvent.setup(); render(<AppRoot />);
  await user.click(screen.getByText(f.tile, { exact: true }));
  let el = await screen.findByText('Site One', { selector: 'div' });
  const sel = 'button[style*="239, 68, 68"]';
  while (el && !el.querySelector(sel)) el = el.parentElement;
  await user.click(el.querySelector(sel));
  const label = await screen.findByText('Remove site?');
  await user.click(label.parentElement.querySelector('button'));                 // the first button after the label is the confirm
  await new Promise(r => setTimeout(r, 400));                                    // the save effects + the async IndexedDB deletes settle
}
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

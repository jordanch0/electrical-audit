// BACKUP PLANNER (Stage 2: READ-ONLY). FICTIONAL data. Restore is ADD-ONLY: a site / event / History snapshot is "already on this phone" by ID ONLY (never by name or content), nothing here
// writes to localStorage or IndexedDB, a photo / thumbnail / per-site logo that exists with DIFFERENT bytes makes the whole site "not restored: conflicting photos", the settings / dropdowns / global
// logo are never read, and the headroom checks (the app's 5 MB saved-data assumption, navigator.storage.estimate) refuse with a message and change nothing.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { backupBuild, backupPlan, BACKUP_LIST_SPECS, BACKUP_MODULE_INFO, BACKUP_MODULES, sitePhotoStore, gsdPhotoStore, appLogoStore, siteLogoStore, STORAGE_QUOTA_ASSUMED_BYTES } from './App.jsx';
import { MODULES, liveStore, metaStore, histStore } from './test/item-dates-fixtures.js';
import { DBS, withDb, clearIdb, idbSnapshot, lsSnapshot, bytes, rec, FM, keyOf, seedModule, seedPhone, wipe, backupOf, PHOTO_REFS, seedSourceFull } from './test/backup-fixtures.js';

beforeEach(wipe);
const mod = (plan, m) => plan.modules.find(x => x.id === m);
// a storage that records every key the planner reads
const spyStorage = () => { const reads = new Set(); let keyed = null; return { reads, get length() { return localStorage.length; }, key: i => (keyed = localStorage.key(i)), getItem: k => { if (k !== keyed) reads.add(k); keyed = null; return localStorage.getItem(k); }, setItem() { throw new Error('planner wrote localStorage'); }, removeItem() { throw new Error('planner wrote localStorage'); } }; };

describe('planning an empty phone', () => {
  it('adds everything: all nine modules, events, photos; settings / dropdowns are not part of the work', async () => {
    const file = await backupOf(seedSourceFull);
    const plan = await backupPlan(file);
    expect(plan.ok).toBe(true); expect(plan.canRestore).toBe(true); expect(plan.nothingToAdd).toBe(false);
    for (const m of BACKUP_MODULES) {
      const p = mod(plan, m); const n = m === 'swb' || m === 'gsd' ? 2 : 1;
      expect(p.status, m).toBe('add'); expect(p.sites.add.map(s => s.id), m).toEqual(n === 2 ? ['s1', 's2'] : ['s1']); expect(p.sites.present, m).toEqual([]); expect(p.sites.conflict, m).toEqual([]); expect(p.snapshots.add, m).toBe(n);
      const w = plan.work.modules[m]; expect(w.projects.map(x => x.id), m).toEqual(p.sites.add.map(s => s.id)); expect(w.results.s1, m).toEqual(liveStore(FM[m]).s1); expect(w.meta.s1, m).toEqual(metaStore(FM[m]).s1);
      expect(w.history.map(s => s.projectId), m).toEqual(p.sites.add.map(s => s.id)); expect(w.activeMode, m).toBe('create'); expect(w.active, m).toEqual(Object.fromEntries(p.sites.add.map(x => [x.id, {}])));   // an empty phone has no sites here and no audit-active key: the key is CREATED from the backup
    }
    expect(plan.events.status).toBe('add'); expect(plan.events.add.map(e => e.id)).toEqual(['e1', 'e2']); expect(plan.events.add[0].label).toBe('RCD · Site One · 2026-11-01'); expect(plan.work.events.map(e => e.id)).toEqual(['e1', 'e2']);
    expect(plan.counts).toMatchObject({ sitesAdd: 11, sitesPresent: 0, sitesConflict: 0, snapshotsAdd: 11, eventsAdd: 2, eventsPresent: 0, modulesSkipped: 0 });
  });
  it('only the photos and the logo a restored site actually uses are written (an unused photo is not; the global logo only when the backup\'s Business tab says it has one); the Business tab record and the lists are planned as fills, not as site work', async () => {
    const plan = await backupPlan(await backupOf(seedSourceFull));
    expect(plan.work.writes.map(w => w.store + ':' + w.key).sort()).toEqual(['gsd-photos:g1', 'gsd-photos:g1~t', 'site-logos:swb:s2', 'site-photos:p1', 'site-photos:p1~t', 'site-photos:p2']);
    expect(plan.bytes.photosToWrite).toBe(4 + 2 + 1 + 3 + 1 + 2); expect(plan.counts.photosWrite).toBe(6);
    const text = JSON.stringify(plan.work.modules) + JSON.stringify(plan.work.events); expect(text).not.toContain('Example Electrical'); expect(text).not.toContain('"responsibility":["A"]'); expect(text).not.toContain('["1"]');   // the settings are not part of the SITES' work
    expect(plan.work.settings.biz.businessName).toBe('Example Electrical Pty Ltd'); expect(plan.work.settings.lists.map(l => l.key).sort()).toEqual(['rcd-dropdowns-v6', 'tat-freqs-v1']); expect(plan.counts.settingsAdd).toBe(3);   // they are planned as fills: the name, the RCD lists, the TAT frequencies
  });
  it('a backup made without photos adds the sites with no photo records (and says so)', async () => {
    const plan = await backupPlan(await backupOf(seedSourceFull, { includePhotos: false }));
    expect(plan.includesPhotos).toBe(false); expect(plan.work.writes.map(w => w.store)).toEqual(['site-logos']); expect(plan.counts.sitesAdd).toBe(11); expect(plan.canRestore).toBe(true);
  });
});

describe('the skip rule is by ID only', () => {
  it('a site whose ID is on the phone is "already on this phone" even if renamed since the backup; everything of it (History too) is skipped and it is listed by name', async () => {
    const file = await backupOf(() => { seedPhone(); });
    seedPhone({ name: 'Renamed Since The Backup' });
    const plan = await backupPlan(file);
    for (const m of BACKUP_MODULES) { const p = mod(plan, m); expect(p.status, m).toBe('nothing'); expect(p.sites.add, m).toEqual([]); expect(p.sites.present, m).toEqual([{ id: 's1', name: 'Site One', nameHere: 'Renamed Since The Backup' }]); expect(p.snapshots.add, m).toBe(0); expect(plan.work.modules[m], m).toBeUndefined(); }
    expect(plan.nothingToAdd).toBe(true); expect(plan.canRestore).toBe(false); expect(plan.counts.sitesPresent).toBe(9);
  });
  it('a DIFFERENT ID with the very same name is added: both sites are kept (names are never compared)', async () => {
    const file = await backupOf(() => { seedPhone(); });
    seedPhone({ id: 'other-id', name: 'Site One' });
    const plan = await backupPlan(file);
    for (const m of BACKUP_MODULES) expect(mod(plan, m).sites.add.map(s => s.id), m).toEqual(['s1']);
  });
  it('events are by ID only: an edited event is "already on this phone"; a new ID is added', async () => {
    const file = await backupOf(() => { rawSetItem('cal-events-v1', JSON.stringify([{ id: 'e1', type: 'RCD', site: 'A', dueDate: '2026-11-01' }, { id: 'e2', type: 'IEL', site: 'B', dueDate: '2026-12-01' }])); });
    rawSetItem('cal-events-v1', JSON.stringify([{ id: 'e1', type: 'TAT', site: 'Edited', dueDate: '2027-01-01' }]));
    const plan = await backupPlan(file);
    expect(plan.events.present.map(e => e.id)).toEqual(['e1']); expect(plan.events.add.map(e => e.id)).toEqual(['e2']); expect(plan.work.events.map(e => e.id)).toEqual(['e2']);
  });
  it('History: a snapshot whose ID is already on the phone is skipped on its own; the others of an added site come with it', async () => {
    const file = await backupOf(() => { seedModule(FM.rcd); seedModule(FM.rcd, { id: 's2', name: 'Two', snapId: 'h2' }); });
    seedModule(FM.rcd, { id: 'sx', name: 'Local', snapId: 'h2' });          // the phone already has a snapshot with ID h2 (of another site)
    const plan = await backupPlan(file);
    expect(mod(plan, 'rcd').sites.add.map(s => s.id)).toEqual(['s1', 's2']); expect(plan.work.modules.rcd.history.map(s => s.id)).toEqual(['h1']);
  });
  it('ignores a duplicate ID inside the backup and a project without an ID', async () => {
    const file = await backupOf(() => { seedModule(FM.irt); const p = JSON.parse(localStorage.getItem('irt-projects-v1')); p.push({ ...p[0], name: 'Dup' }, { name: 'No ID' }); rawSetItem('irt-projects-v1', JSON.stringify(p)); });
    const plan = await backupPlan(file); expect(mod(plan, 'irt').sites.add).toEqual([{ id: 's1', name: 'Site One' }]);
  });
  it('a phone that already holds all of it (the source phone itself): nothing to add, restore is offered as nothing', async () => {
    await wipe(); await seedSourceFull(); const { blob } = await backupBuild(); const plan = await backupPlan(blob);
    expect(plan.nothingToAdd).toBe(true); expect(plan.canRestore).toBe(false); expect(plan.counts).toMatchObject({ sitesAdd: 0, sitesPresent: 11, eventsAdd: 0, eventsPresent: 2, photosWrite: 0 });
  });
});

describe('never overwrite a photo, thumbnail or logo', () => {
  const src = () => backupOf(seedSourceFull);
  it('identical bytes are reused (nothing to write); the site is added', async () => {
    const file = await src(); await sitePhotoStore.put('p1', rec(1, 2, 3)); await sitePhotoStore.put('p1~t', rec(9)); await sitePhotoStore.put('p2', rec(4, 5));
    const plan = await backupPlan(file); const p = mod(plan, 'swb');
    expect(p.sites.add.map(s => s.id)).toEqual(['s1', 's2']); expect(p.photos).toEqual({ write: 1, reuse: 3 }); expect(plan.work.writes.map(w => w.key).sort()).toEqual(['g1', 'g1~t', 'swb:s2']);
  });
  it('different bytes under the same photo ID: the WHOLE site is "not restored: conflicting photos", nothing for it is in the work, and other sites / modules are unaffected', async () => {
    const file = await src(); await sitePhotoStore.put('p2', rec(5, 4));
    const plan = await backupPlan(file); const p = mod(plan, 'swb');
    expect(p.sites.conflict).toEqual([{ id: 's2', name: 'Second SWB', reason: 'conflicting photos', keys: 1 }]); expect(p.sites.add.map(s => s.id)).toEqual(['s1']);
    expect(plan.work.modules.swb.projects.map(x => x.id)).toEqual(['s1']); expect(Object.keys(plan.work.modules.swb.results)).toEqual(['s1']); expect(plan.work.modules.swb.history.map(s => s.projectId)).toEqual(['s1']);
    expect(plan.work.writes.map(w => w.key)).not.toContain('p1'); expect(plan.work.writes.map(w => w.key)).not.toContain('swb:s2'); expect(plan.work.writes.map(w => w.key)).toContain('g1'); expect(mod(plan, 'gsd').sites.add.map(s => s.id)).toEqual(['s1', 's2']);
    expect(plan.canRestore).toBe(true);
  });
  it('a thumbnail that differs makes the site a conflict too; so does a different per-site logo', async () => {
    const file = await src(); await sitePhotoStore.put('p1~t', rec(0));
    let plan = await backupPlan(file); expect(mod(plan, 'swb').sites.conflict.map(s => s.id)).toEqual(['s2']);
    await sitePhotoStore.del('p1~t'); await siteLogoStore.put('swb', 's2', rec(13));
    plan = await backupPlan(file); expect(mod(plan, 'swb').sites.conflict.map(s => s.id)).toEqual(['s2']);
  });
  it('GSD photos use their own store', async () => {
    const file = await src(); await gsdPhotoStore.put('g1', rec(0));
    const plan = await backupPlan(file); expect(mod(plan, 'gsd').sites.conflict).toEqual([{ id: 's2', name: 'Second GSD', reason: 'conflicting photos', keys: 1 }]);
  });
  it('a photo of the same ID already on the phone for an UNRELATED reason still counts: bytes are compared, never assumed', async () => {
    const file = await src(); await sitePhotoStore.put('p1', rec(1, 2, 3, 4));
    expect(mod(await backupPlan(file), 'swb').sites.conflict.map(s => s.id)).toEqual(['s2']);
  });
  it('leftover results / meta already stored under the same ID (without a site) is never overwritten: that site is not restored', async () => {
    const file = await backupOf(() => { seedModule(FM.rcd); });
    rawSetItem(keyOf('rcd', 'results'), JSON.stringify({ s1: { leftover: true } }));
    const plan = await backupPlan(file); expect(mod(plan, 'rcd').sites.conflict).toEqual([{ id: 's1', name: 'Site One', reason: 'existing data under the same ID', keys: 0 }]); expect(mod(plan, 'rcd').sites.add).toEqual([]);
  });
});

describe('modules that are skipped on purpose, and unreadable data', () => {
  it('another key VERSION in the backup means the module is skipped and listed; the legacy copy kept next to a current key does not', async () => {
    const file = await backupOf(() => { seedModule(FM.iel); seedModule(FM.elt); rawSetItem('elt-projects-v1', '[]'); rawSetItem('rcd-projects-v5', JSON.stringify([{ id: 'old', name: 'Old Format Site' }])); });
    const plan = await backupPlan(file);
    expect(mod(plan, 'rcd').status).toBe('skipped-version'); expect(mod(plan, 'rcd').note).toContain('rcd-projects-v5 instead of rcd-projects-v6'); expect(plan.work.modules.rcd).toBeUndefined();
    expect(mod(plan, 'elt').status).toBe('add'); expect(mod(plan, 'iel').status).toBe('add'); expect(plan.counts.modulesSkipped).toBe(1);
  });
  it('this phone\'s key in the wrong shape (or not JSON) is never inserted into: that module is "unreadable here"; the others are unaffected', async () => {
    const file = await backupOf(() => { seedPhone(); rawSetItem('cal-events-v1', JSON.stringify([{ id: 'e1', type: 'RCD', site: 'A', dueDate: '2026-11-01' }])); });
    rawSetItem('rcd-projects-v6', '{"not":"an array"}'); rawSetItem('iel-results-v2', '{broken'); rawSetItem('tat-audit-active-v1', JSON.stringify({ v: 9, sites: {} })); rawSetItem('cal-events-v1', '"text"');
    const plan = await backupPlan(file);
    for (const m of ['rcd', 'iel', 'tat']) { expect(mod(plan, m).status, m).toBe('unreadable-here'); expect(mod(plan, m).note, m).toContain("can't be read"); }
    expect(mod(plan, 'thermo').status).toBe('add'); expect(plan.events.status).toBe('unreadable-here');
  });
  it('audit-active: an existing key receives the restored site\'s entry ("insert"); no key + a phone WITH sites leaves it absent ("leave"); no key + NO sites creates it from the backup ("create")', async () => {
    const file = await backupOf(() => { seedPhone(); });
    rawSetItem('rcd-audit-active-v1', JSON.stringify({ v: 1, sites: { local: {} } }));                        // key exists
    seedModule(FM.iel, { id: 'local', name: 'Local' }); localStorage.removeItem('iel-audit-active-v1');       // sites here, key absent
    const plan = await backupPlan(file);
    expect(plan.work.modules.rcd).toMatchObject({ activeMode: 'insert', active: { s1: {} } });
    expect(plan.work.modules.iel).toMatchObject({ activeMode: 'leave', active: {} });
    expect(plan.work.modules.tat).toMatchObject({ activeMode: 'create', active: { s1: {} } });
  });
  it('a backup without an audit-active key (or with a damaged one) never creates one: "leave"', async () => {
    const file = await backupOf(() => { seedModule(FM.tat); localStorage.removeItem('tat-audit-active-v1'); seedModule(FM.swb); rawSetItem('swb-audit-active-v1', JSON.stringify({ v: 7, sites: {} })); });
    const plan = await backupPlan(file); expect(plan.work.modules.tat.activeMode).toBe('leave'); expect(plan.work.modules.swb.activeMode).toBe('leave');
  });
  it('a damaged or unrelated file returns the inspector\'s message and plans nothing', async () => {
    const plan = await backupPlan(new Blob([new Uint8Array(500)])); expect(plan.ok).toBe(false); expect(plan.message).toMatch(/not a SparkCheck backup/);
  });
});

describe('read-only', () => {
  it('writes nothing to localStorage or IndexedDB, creates no database, and reads (parses) only the keys of the modules, the calendar, the Business tab record and the 13 list keys', async () => {
    const file = await backupOf(seedSourceFull); seedPhone({ id: 'local', name: 'Local' }); await sitePhotoStore.put('p1', rec(1, 2, 3)); rawSetItem('app-settings-v1', '{"businessName":"Mine"}'); rawSetItem('rcd-dropdowns-v6', '{"x":1}'); rawSetItem('some-other-app', 'x');
    const ls = lsSnapshot(), idb = await idbSnapshot(), dbs = (await indexedDB.databases()).map(d => d.name).sort();
    const sp = spyStorage(); const plan = await backupPlan(file, { storage: sp });
    expect(plan.ok).toBe(true); expect(lsSnapshot()).toEqual(ls); expect(await idbSnapshot()).toEqual(idb); expect((await indexedDB.databases()).map(d => d.name).sort()).toEqual(dbs);
    const allowed = new Set([...BACKUP_MODULES.flatMap(m => Object.values(BACKUP_MODULE_INFO[m].keys)), 'cal-events-v1', 'app-settings-v1', ...BACKUP_LIST_SPECS().map(s => s.key)]);
    expect([...sp.reads].filter(k => !allowed.has(k))).toEqual([]);                               // never rcd-mode, iel-cat, a photo-migration marker or another app's key (only their LENGTH is counted, for the 5 MB check)
  });
  it('does not create a missing photo database just to look', async () => {
    const file = await backupOf(seedSourceFull); const dbsFn = indexedDB.databases; const open = vi.spyOn(indexedDB, 'open');
    indexedDB.databases = async () => [];                                                              // as if no SparkCheck database exists on this phone yet
    try { const plan = await backupPlan(file); expect(plan.ok).toBe(true); expect(plan.counts.sitesAdd).toBe(11); expect(open).not.toHaveBeenCalled(); } finally { indexedDB.databases = dbsFn; open.mockRestore(); }
  });
});

describe('headroom: refuse with a clear message and change nothing', () => {
  const planWith = async (est, prep) => { const file = await backupOf(seedSourceFull); if (prep) await prep(); const ls = lsSnapshot(); const plan = await backupPlan(file, { estimate: est }); expect(lsSnapshot()).toEqual(ls); return plan; };
  it('plenty of room: ok', async () => {
    const plan = await planWith(async () => ({ quota: 1e9, usage: 1e6 })); expect(plan.headroom.ok).toBe(true); expect(plan.headroom.storage.known).toBe(true); expect(plan.headroom.message).toBe(''); expect(plan.canRestore).toBe(true);
  });
  it('the browser\'s storage estimate is too low for the photos (plus a margin): refused, says what to free up', async () => {
    const plan = await planWith(async () => ({ quota: 30 * 1024 * 1024, usage: 29 * 1024 * 1024 }));
    expect(plan.headroom.storage.ok).toBe(false); expect(plan.canRestore).toBe(false); expect(plan.headroom.message).toMatch(/^Not enough free space on this device for the photos: about [\d.]+ MB is needed .* Free up space .* Nothing was changed\.$/);
  });
  it('the app\'s 5 MB saved-data assumption would be exceeded: refused, says what to free up', async () => {
    const plan = await planWith(async () => ({ quota: 1e9, usage: 0 }), async () => { rawSetItem('filler', 'x'.repeat(Math.floor(STORAGE_QUOTA_ASSUMED_BYTES / 2) - 600)); });
    expect(plan.headroom.local.ok).toBe(false); expect(plan.canRestore).toBe(false); expect(plan.headroom.message).toMatch(/^Not enough room in this phone's saved-data space: this restore needs about [\d.]+ MB more, but only [\d.]+ MB of 5\.0 MB is free\. Free up space by deleting sites, History snapshots or calendar events you no longer need, then try again\. Nothing was changed\.$/);
  });
  it('no estimate available (missing, throwing or nonsense): not refused, and the confirmation says space could not be checked', async () => {
    for (const est of [null, async () => { throw new Error('nope'); }, async () => ({ quota: NaN, usage: 1 }), async () => ({})]) {
      const plan = await planWith(est); expect(plan.headroom.storage.known).toBe(false); expect(plan.headroom.ok).toBe(true); expect(plan.canRestore).toBe(true); expect(plan.headroom.message).toMatch(/can't report free space/);
    }
  });
});

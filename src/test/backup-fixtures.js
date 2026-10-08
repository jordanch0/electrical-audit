// Shared seeding helpers for the backup / restore tests (FICTIONAL data). A "phone" = localStorage + the four IndexedDB databases; `seedModule` puts the fixture site (id s1 by default) into one module with its
// results, meta, one History snapshot and an audit-active entry; `backupOf(seed)` builds a backup file from whatever `seed` puts on a phone and then wipes the phone.
import { backupBuild, BACKUP_MODULE_INFO, sitePhotoStore, gsdPhotoStore, appLogoStore, siteLogoStore } from '../App.jsx';
import { MODULES, liveStore, metaStore, histStore } from './item-dates-fixtures.js';

export const DBS = [['sparkcheck-site-photos', 'photos'], ['sparkcheck-gsd-photos', 'photos'], ['sparkcheck-app-settings', 'logo'], ['sparkcheck-site-logos', 'logos']];
export const withDb = (name, store, fn) => new Promise((res, rej) => { const rq = indexedDB.open(name, 1); rq.onupgradeneeded = () => rq.result.createObjectStore(store); rq.onsuccess = () => { const db = rq.result; const tx = db.transaction(store, 'readwrite'); const r = fn(tx.objectStore(store)); tx.oncomplete = () => { db.close(); res(r && r.result); }; tx.onerror = () => rej(tx.error); }; rq.onerror = () => rej(rq.error); });
export const clearIdb = () => Promise.all(DBS.map(([n, s]) => withDb(n, s, st => st.clear())));
export const idbSnapshot = async () => { const out = {}; for (const [n, s] of DBS) { const keys = await withDb(n, s, st => st.getAllKeys()); out[n] = {}; for (const k of keys) { const rec = await withDb(n, s, st => st.get(k)); out[n][k] = { type: rec.type, bytes: Array.from(new Uint8Array(rec.buf)) }; } } return out; };
export const lsSnapshot = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; };
export const bytes = (...n) => new Uint8Array(n).buffer;
export const rec = (...n) => ({ buf: bytes(...n), type: 'image/jpeg' });
export const FM = Object.fromEntries(MODULES.map(f => [f.mod, f]));
export const keyOf = (m, role) => BACKUP_MODULE_INFO[m].keys[role];

// phone data for one module: the fixture site s1 ("Site One") with results, meta, one History snapshot and an audit-active entry; `over` can rename it / change the id
export function seedModule(f, { id = 's1', name = 'Site One', extraResults = null, snapId = 'h1' } = {}) {
  const proj = JSON.parse(JSON.stringify(f.project)); proj[0].id = id; proj[0].name = name;
  const live = liveStore(f).s1; if (extraResults) { if (Array.isArray(live)) live.push({ id: 'gx', ...extraResults }); else Object.assign(live, extraResults); }
  const read = (k, d) => { const r = localStorage.getItem(k); return r ? JSON.parse(r) : d; };
  const A = read(f.keys.p, []), R = read(f.keys.r, {}), M = read(f.keys.m, {}), H = read(f.keys.h, []), AC = read(`${f.mod}-audit-active-v1`, { v: 1, sites: {} });
  A.push(proj[0]); R[id] = live; M[id] = metaStore(f).s1; H.push({ ...histStore(f)[0], id: snapId, projectId: id, projectName: name }); AC.sites[id] = {};
  rawSetItem(f.keys.p, JSON.stringify(A)); rawSetItem(f.keys.r, JSON.stringify(R)); rawSetItem(f.keys.m, JSON.stringify(M)); rawSetItem(f.keys.h, JSON.stringify(H)); rawSetItem(`${f.mod}-audit-active-v1`, JSON.stringify(AC));
}
export const seedPhone = (opts = {}) => { MODULES.forEach(f => seedModule(f, opts)); };
export const wipe = async () => { localStorage.clear(); await clearIdb(); };
// make a backup file from whatever `seed` puts on the "source phone", then wipe it (the "other phone" starts empty)
export async function backupOf(seed, buildOpts = {}) { await wipe(); await seed(); const b = await backupBuild(buildOpts); await wipe(); return b.blob; }
export const PHOTO_REFS = { photos: [{ id: 'p1', w: 1, h: 1 }, { id: 'p2', w: 1, h: 1 }] };
export const seedSourceFull = async () => {
  seedPhone();
  seedModule(FM.swb, { id: 's2', name: 'Second SWB', extraResults: { itemX: PHOTO_REFS }, snapId: 'h2' });
  seedModule(FM.gsd, { id: 's2', name: 'Second GSD', extraResults: { photos: [{ id: 'g1' }] }, snapId: 'h2' });
  rawSetItem('cal-events-v1', JSON.stringify([{ id: 'e1', type: 'RCD', site: 'Site One', dueDate: '2026-11-01' }, { id: 'e2', type: 'IEL', site: 'Not A Site Here', dueDate: '2026-12-01' }]));
  rawSetItem('app-settings-v1', JSON.stringify({ businessName: 'Example Electrical Pty Ltd' })); rawSetItem('rcd-dropdowns-v6', '{"responsibility":["A"]}'); rawSetItem('tat-freqs-v1', '["1"]');
  await sitePhotoStore.put('p1', rec(1, 2, 3)); await sitePhotoStore.put('p1~t', rec(9)); await sitePhotoStore.put('p2', rec(4, 5)); await sitePhotoStore.put('unused', rec(6, 6, 6));
  await gsdPhotoStore.put('g1', rec(7, 7, 7, 7)); await gsdPhotoStore.put('g1~t', rec(8, 8));
  await appLogoStore.put(rec(10, 11)); await siteLogoStore.put('swb', 's2', rec(12));
};

// TEST SCAFFOLDING ONLY (the real restore engine is Stage 3): writes what a plan says to add, by plain parse / merge / stringify, so a test can then LOAD the real app on the result.
export function naiveApply(plan) {
  const read = (k, d) => { const r = localStorage.getItem(k); return r === null ? d : JSON.parse(r); };
  for (const [m, w] of Object.entries(plan.work.modules)) {
    const k = BACKUP_MODULE_INFO[m].keys;
    rawSetItem(k.projects, JSON.stringify([...read(k.projects, []), ...w.projects])); rawSetItem(k.results, JSON.stringify({ ...read(k.results, {}), ...w.results }));
    rawSetItem(k.meta, JSON.stringify({ ...read(k.meta, {}), ...w.meta })); rawSetItem(k.history, JSON.stringify([...read(k.history, []), ...w.history]));
    if (w.activeMode === 'create') rawSetItem(k.active, JSON.stringify({ v: 1, sites: w.active }));
    else if (w.activeMode === 'insert') { const a = read(k.active, null); rawSetItem(k.active, JSON.stringify({ ...a, sites: { ...a.sites, ...w.active } })); }
  }
}

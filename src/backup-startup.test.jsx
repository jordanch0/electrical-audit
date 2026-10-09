// STARTUP RECOVERY, THROUGH THE REAL src/main.jsx (Stage 3). FICTIONAL data. An interrupted restore must be put right SYNCHRONOUSLY, before the first render and so before any module can mount; with no restore
// record the startup does nothing observable; a damaged record, or any step of the recovery throwing, must NEVER stop the app from rendering. main.jsx is imported for real; only the service-worker toast hook is
// stubbed, and react-dom's createRoot / render are wrapped to record what localStorage holds at the moment each is called.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { configure } from '@testing-library/react';
import { backupRestore, BackupCrash, RESTORE_KEY } from './App.jsx';
import { idbSnapshot, lsSnapshot, seedPhone, rec, wipe, backupOf, seedSourceFull } from './test/backup-fixtures.js';
import { sitePhotoStore } from './App.jsx';

const events = vi.hoisted(() => []);
vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: () => ({ needRefresh: [false, () => {}], updateServiceWorker: () => {} }) }));
vi.mock('react-dom/client', async (importOriginal) => {
  const m = await importOriginal(); const real = m.default || m; const snap = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; };
  return { default: { ...real, createRoot: (...a) => { events.push({ e: 'createRoot', ls: snap() }); const root = real.createRoot(...a); const render = root.render.bind(root); root.render = (...b) => { events.push({ e: 'render', ls: snap() }); return render(...b); }; return root; } } };
});
vi.setConfig({ testTimeout: 30000 });
configure({ asyncUtilTimeout: 10000 });

const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
async function startApp() { vi.resetModules(); events.length = 0; document.body.innerHTML = '<div id="root"></div>'; await import('./main.jsx'); await vi.waitFor(() => expect(document.body.textContent).toContain('RCD TESTING')); }
beforeEach(async () => { await wipe(); events.length = 0; });
afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('startup through the real main.jsx', () => {
  it('an interrupted restore is rolled back BEFORE createRoot and before render (so before any module mounts), then the app renders; the photo cleanup finishes in the background', async () => {
    const file = await backupOf(seedSourceFull); seedPhone({ id: 'local', name: 'Local Site', snapId: 'hl' }); await sitePhotoStore.put('mine1', rec(5, 5));
    const before = { ls: lsSnapshot(), idb: await idbSnapshot() };
    await expect(backupRestore(file, { storage: S, crashAt: (s, i) => { if (s === 'put' && i === 2) throw new BackupCrash('killed'); } })).rejects.toBeInstanceOf(BackupCrash);
    expect(lsSnapshot()).not.toEqual(before.ls);                                                            // the tab was killed with the journal written and some photos put
    await startApp();
    expect(events.map(e => e.e)).toEqual(['createRoot', 'render']);                                         // recovery is not an event of its own: it already ran when createRoot was called …
    const atCreate = events[0].ls; const { [RESTORE_KEY]: rk, ...rest } = atCreate; const { [RESTORE_KEY]: _x, ...beforeRest } = before.ls;
    expect(rest).toEqual(beforeRest); expect(JSON.parse(rk).journal.phase).toBe('idb');                       // … every owned key was already back to its original bytes (only the cleanup marker remains) …
    expect(events[1].ls).toEqual(atCreate);                                                                  // … and nothing changed between createRoot and render
    await vi.waitFor(async () => { expect(localStorage.getItem(RESTORE_KEY)).toBeNull(); expect(await idbSnapshot()).toEqual(before.idb); });   // the background cleanup finished
  });
  it('with no restore record the startup does nothing observable: no key written, none removed', async () => {
    seedPhone({ id: 'local', name: 'Local Site' }); const before = lsSnapshot(); const idb = await idbSnapshot();
    const writes = []; const set = Storage.prototype.setItem, rem = Storage.prototype.removeItem; vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) { writes.push(['set', k]); return set.call(this, k, v); }); vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (k) { writes.push(['remove', k]); return rem.call(this, k); });
    await startApp(); const startupWrites = writes.filter(w => w[1] === RESTORE_KEY);
    expect(startupWrites).toEqual([]); expect(events.map(e => e.e)).toEqual(['createRoot', 'render']); expect(events[0].ls).toEqual(before); expect(await idbSnapshot()).toEqual(idb);
  });
  it('a damaged restore record: the app still renders and nothing is changed', async () => {
    seedPhone({ id: 'local', name: 'Local Site' }); rawSetItem(RESTORE_KEY, '{broken'); const before = lsSnapshot();
    await startApp(); expect(events.map(e => e.e)).toEqual(['createRoot', 'render']); expect(events[0].ls).toEqual(before);
  });
  it('a record with a journal that is itself damaged (wrong shapes everywhere): the app still renders', async () => {
    seedPhone({ id: 'local', name: 'Local Site' }); rawSetItem(RESTORE_KEY, JSON.stringify({ v: 1, journal: { keys: 'not a list', put: 7 }, undo: 5 }));
    await startApp(); expect(events.map(e => e.e)).toEqual(['createRoot', 'render']);
  });
  it('reading the record throws: the app still renders', async () => {
    seedPhone({ id: 'local', name: 'Local Site' }); const get = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (k) { if (k === RESTORE_KEY) throw new Error('storage blocked'); return get.call(this, k); });
    await startApp(); expect(events.map(e => e.e)).toEqual(['createRoot', 'render']);
  });
  it('a recovery step throws (the write of the cleanup marker fails, or the background cleanup fails): the app still renders and nothing is thrown out of main.jsx', async () => {
    const file = await backupOf(seedSourceFull); seedPhone({ id: 'local', name: 'Local Site', snapId: 'hl' });
    await expect(backupRestore(file, { storage: S, crashAt: (s) => { if (s === 'keys-done') throw new BackupCrash('killed'); } })).rejects.toBeInstanceOf(BackupCrash);
    const set = Storage.prototype.setItem; vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) { if (k === RESTORE_KEY) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); return set.call(this, k, v); });
    await startApp(); expect(events.map(e => e.e)).toEqual(['createRoot', 'render']);
    vi.restoreAllMocks(); vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function () { throw new Error('boom'); });
    await startApp(); expect(events.map(e => e.e)).toEqual(['createRoot', 'render']);                       // second start: the journal is still there, the background delete fails, the app renders anyway
  });
});

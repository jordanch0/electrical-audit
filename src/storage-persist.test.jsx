// ASK THE BROWSER TO KEEP THE DATA (navigator.storage.persist). FICTIONAL data. The helper is feature-detected and never throws or rejects; through the real src/main.jsx it runs only AFTER the first render has been handed to React
// and after the erase and the start-up recovery, never while an unfinished erase has the app on the Settings-only screen, and it shows nothing, asks nothing and stores nothing.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { configure } from '@testing-library/react';
import { requestPersistentStorage, ERASE_KEY, backupKeyAllowed, backupKeyExcluded } from './App.jsx';
import { lsSnapshot, wipe, seedSourceFull } from './test/backup-fixtures.js';

const events = vi.hoisted(() => []);
vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: () => ({ needRefresh: [false, () => {}], updateServiceWorker: () => {} }) }));
vi.mock('react-dom/client', async (importOriginal) => {
  const m = await importOriginal(); const real = m.default || m;
  return { default: { ...real, createRoot: (...a) => { events.push({ e: 'createRoot' }); const root = real.createRoot(...a); const render = root.render.bind(root); root.render = (...b) => { events.push({ e: 'render' }); return render(...b); }; return root; } } };
});
vi.setConfig({ testTimeout: 30000 });
configure({ asyncUtilTimeout: 10000 });

// The faked-clock runs (00:30 / 23:30) install their own fake Date before every test; installing fake timers on top of that does nothing, so reset first and keep the same fake date.
const fakeTimers = toFake => { vi.useRealTimers(); vi.useFakeTimers({ toFake: [...toFake, ...(process.env.CLOCK_AT ? ['Date'] : [])] }); if (process.env.CLOCK_AT) vi.setSystemTime(new Date(process.env.CLOCK_AT)); };
const boot = async () => { vi.resetModules(); events.length = 0; document.body.innerHTML = '<div id="root"></div>'; await import('./main.jsx'); };
const owned = () => Object.keys(lsSnapshot()).filter(k => backupKeyAllowed(k) || backupKeyExcluded(k));
const setStorage = value => Object.defineProperty(navigator, 'storage', { value, configurable: true, writable: true });
const markerOn = () => rawSetItem(ERASE_KEY, JSON.stringify({ v: 1, attempts: 0, at: '2026-10-11T00:00:00.000Z' }));
beforeEach(async () => { await wipe(); events.length = 0; });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML = ''; delete navigator.storage; });

describe('requestPersistentStorage (the helper)', () => {
  it('jsdom has no navigator.storage.persist: nothing happens and the answer is null', async () => {
    expect(navigator.storage).toBeUndefined(); expect(await requestPersistentStorage()).toBe(null);
    for (const nav of [null, undefined, {}, { storage: null }, { storage: {} }, { storage: { persist: 'yes' } }]) expect(await requestPersistentStorage(nav)).toBe(null);
  });
  it('where there is one it is called once, as a method of navigator.storage, and the browser\'s true / false comes back', async () => {
    for (const answer of [true, false]) {
      const seen = []; const storage = { persist: vi.fn(function (...args) { seen.push({ self: this, args }); return Promise.resolve(answer); }) };
      expect(await requestPersistentStorage({ storage })).toBe(answer); expect(storage.persist).toHaveBeenCalledTimes(1); expect(seen[0].self).toBe(storage); expect(seen[0].args).toEqual([]);
    }
  });
  it('a failure cannot get out of it: a call that throws, one that rejects and an answer that is not true / false all give null', async () => {
    expect(await requestPersistentStorage({ storage: { persist: () => { throw new Error('SecurityError'); } } })).toBe(null);
    expect(await requestPersistentStorage({ storage: { persist: () => Promise.reject(new Error('NotAllowedError')) } })).toBe(null);
    expect(await requestPersistentStorage({ storage: { persist: () => Promise.resolve('maybe') } })).toBe(null);
    expect(await requestPersistentStorage({ get storage() { throw new Error('getter'); } })).toBe(null);
  });
  it('it writes nothing: no localStorage key, no counter, no record of the answer', async () => {
    const writes = []; const set = Storage.prototype.setItem; vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) { writes.push(k); return set.call(this, k, v); });
    const before = lsSnapshot(); await requestPersistentStorage({ storage: { persist: () => Promise.resolve(true) } }); await requestPersistentStorage({ storage: { persist: () => Promise.resolve(false) } });
    expect(writes).toEqual([]); expect(lsSnapshot()).toEqual(before);
  });
});

describe('through the real main.jsx', () => {
  it('a normal start: persist is asked once, AFTER the first render has been handed to React, and the app opens as before', async () => {
    const calls = []; const persist = vi.fn(function () { calls.push({ rendered: events.some(e => e.e === 'render'), self: this }); return Promise.resolve(true); }); setStorage({ persist });
    await boot(); await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1)); await vi.waitFor(() => expect(document.body.textContent).toContain('RCD TESTING'));
    expect(calls).toHaveLength(1); expect(calls[0].rendered).toBe(true); expect(calls[0].self).toBe(navigator.storage); expect(events.map(e => e.e)).toEqual(['createRoot', 'render']);
  });
  it('after an erase: persist is asked only once the erase has finished (marker and every owned key already gone), never inside it', async () => {
    const calls = []; const persist = vi.fn(() => { calls.push({ marker: localStorage.getItem(ERASE_KEY), owned: owned(), rendered: events.some(e => e.e === 'render') }); return Promise.resolve(true); }); setStorage({ persist });
    await seedSourceFull(); markerOn(); await boot(); await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    expect(calls[0]).toEqual({ marker: null, owned: [], rendered: true });
  });
  it('an erase that is still running after 2 s (the Settings-only screen): persist is NOT asked', async () => {
    const persist = vi.fn(() => Promise.resolve(true)); setStorage({ persist });
    await seedSourceFull(); markerOn(); vi.spyOn(indexedDB, 'databases').mockImplementation(() => new Promise(() => {}));
    fakeTimers(['setTimeout', 'clearTimeout']); await boot(); await vi.advanceTimersByTimeAsync(2100); await vi.waitFor(() => expect(document.body.textContent).toContain('Finishing the erase…'));
    await vi.advanceTimersByTimeAsync(500); expect(persist).not.toHaveBeenCalled();
  });
  it('NEGATIVE CONTROL: with no navigator.storage.persist the app starts exactly the same (nothing thrown, same screen)', async () => {
    await boot(); await vi.waitFor(() => expect(document.body.textContent).toContain('RCD TESTING')); expect(navigator.storage).toBeUndefined();
  });
  it('a persist that throws or rejects does not stop the app, and nothing is shown, asked or stored: the screen and localStorage are the same as without it', async () => {
    await boot(); await vi.waitFor(() => expect(document.body.textContent).toContain('RCD TESTING')); const plainText = document.body.textContent, plainLs = lsSnapshot();
    for (const persist of [() => { throw new Error('boom'); }, () => Promise.reject(new Error('no'))]) {
      await wipe(); setStorage({ persist: vi.fn(persist) }); await boot(); await vi.waitFor(() => expect(navigator.storage.persist).toHaveBeenCalledTimes(1)); await vi.waitFor(() => expect(document.body.textContent).toContain('RCD TESTING'));
      expect(document.body.textContent).toBe(plainText); expect(lsSnapshot()).toEqual(plainLs); expect(document.body.textContent).not.toMatch(/persist|persistent/i); expect(document.querySelector('[role="dialog"]')).toBe(null);
    }
  });
});

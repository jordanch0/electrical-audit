// DELETE ALL DATA, THROUGH THE REAL src/main.jsx (Stage 6). FICTIONAL data. The erase finishes BEFORE the first render (createRoot is only called afterwards), an unfinished erase older than the 2 s render budget starts the app on
// the Global Settings screen only, and with no marker the startup changes nothing. main.jsx is imported for real; only the service-worker toast is stubbed and createRoot / render are wrapped to record what localStorage holds.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { configure } from '@testing-library/react';
import { eraseMarker, ERASE_KEY, LEFTOVER_KEY, backupKeyAllowed, backupKeyExcluded } from './App.jsx';
import { idbSnapshot, lsSnapshot, seedPhone, wipe, seedSourceFull } from './test/backup-fixtures.js';

const events = vi.hoisted(() => []);
vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: () => ({ needRefresh: [false, () => {}], updateServiceWorker: () => {} }) }));
vi.mock('react-dom/client', async (importOriginal) => {
  const m = await importOriginal(); const real = m.default || m; const snap = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; };
  return { default: { ...real, createRoot: (...a) => { events.push({ e: 'createRoot', ls: snap() }); const root = real.createRoot(...a); const render = root.render.bind(root); root.render = (...b) => { events.push({ e: 'render', ls: snap() }); return render(...b); }; return root; } } };
});
vi.setConfig({ testTimeout: 30000 });
configure({ asyncUtilTimeout: 10000 });

// The faked-clock runs (00:30 / 23:30) install their own fake Date before every test; installing fake timers on top of that does nothing, so reset first and keep the same fake date.
const fakeTimers = toFake => { vi.useRealTimers(); vi.useFakeTimers({ toFake: [...toFake, ...(process.env.CLOCK_AT ? ['Date'] : [])] }); if (process.env.CLOCK_AT) vi.setSystemTime(new Date(process.env.CLOCK_AT)); };
const boot = async () => { vi.resetModules(); events.length = 0; document.body.innerHTML = '<div id="root"></div>'; await import('./main.jsx'); };
const owned = () => Object.keys(lsSnapshot()).filter(k => backupKeyAllowed(k) || backupKeyExcluded(k));
beforeEach(async () => { await wipe(); events.length = 0; });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('Delete all data through the real main.jsx', () => {
  it('a marker: every owned key and photo is already gone when createRoot is called, the marker is gone, unrelated keys survive, and the app opens on the module grid (first run)', async () => {
    await seedSourceFull(); rawSetItem('sparkcheck-unrelated', 'keep me'); rawSetItem(ERASE_KEY, JSON.stringify({ v: 1, attempts: 0, at: '2026-10-11T00:00:00.000Z' }));
    await boot(); await vi.waitFor(() => expect(document.body.textContent).toContain('RCD TESTING'));
    expect(events.map(e => e.e)).toEqual(['createRoot', 'render']); expect(Object.keys(events[0].ls)).toEqual(['sparkcheck-unrelated']); expect(events[1].ls).toEqual(events[0].ls);
    expect(await idbSnapshot()).toEqual({ 'sparkcheck-site-photos': {}, 'sparkcheck-gsd-photos': {}, 'sparkcheck-app-settings': {}, 'sparkcheck-site-logos': {} });
    expect(document.body.textContent).not.toContain('Finishing the erase');
  });
  it('NEGATIVE CONTROL: without a marker the same data is left exactly as it is and nothing is written', async () => {
    await seedSourceFull(); const ls = lsSnapshot(), idb = await idbSnapshot(); const writes = []; const set = Storage.prototype.setItem; vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) { writes.push(k); return set.call(this, k, v); });
    await boot(); await vi.waitFor(() => expect(document.body.textContent).toContain('RCD TESTING')); expect(events[0].ls).toEqual(ls); expect(await idbSnapshot()).toEqual(idb); expect(writes.filter(k => k === ERASE_KEY || k === LEFTOVER_KEY)).toEqual([]);
  });
  it('an erase still running after 2 s: createRoot waits for the budget, owned keys are already gone, and the app opens on Global Settings ONLY (Data tab, the approved words, no module grid, no Modules pill)', async () => {
    await seedSourceFull(); rawSetItem(ERASE_KEY, JSON.stringify({ v: 1, attempts: 0, at: '2026-10-11T00:00:00.000Z' }));
    vi.spyOn(indexedDB, 'databases').mockImplementation(() => new Promise(() => {}));              // the first store step never answers
    fakeTimers(['setTimeout', 'clearTimeout']); await boot();
    await vi.advanceTimersByTimeAsync(1900); expect(events).toEqual([]);                           // still inside the render budget: nothing rendered yet
    await vi.advanceTimersByTimeAsync(200); expect(events.map(e => e.e)).toEqual(['createRoot', 'render']); expect(owned()).toEqual([ERASE_KEY]); expect(eraseMarker(localStorage).attempts).toBe(1);
    await vi.waitFor(() => expect(document.body.textContent).toContain('Finishing the erase…'));
    expect(document.body.textContent).toContain('Global Settings'); expect(document.body.textContent).not.toContain('RCD TESTING'); expect(document.body.textContent).not.toContain('Modules');
    expect(document.querySelector('[role="tab"][aria-selected="true"]').textContent).toContain('Data');
  });
  it('the same unfinished erase after the step runs out of time (9 s here: no usage figure, so the 500 MB rule): the screen changes to the retry words by itself', async () => {
    await seedSourceFull(); rawSetItem(ERASE_KEY, JSON.stringify({ v: 1, attempts: 0, at: '2026-10-11T00:00:00.000Z' })); vi.spyOn(indexedDB, 'databases').mockImplementation(() => new Promise(() => {}));
    fakeTimers(['setTimeout', 'clearTimeout']); await boot(); await vi.advanceTimersByTimeAsync(2100); await vi.waitFor(() => expect(document.body.textContent).toContain('Finishing the erase…'));
    // jsdom has no navigator.storage, so the stored size is unknown: the step limit is the 500 MB figure, 18 ms x 500 = 9000 ms (inside the 5 s to 30 s band). The step started at about t = 0. (vi.waitFor itself moves the fake clock on a little, so the lower bound keeps a 900 ms margin; the exact 9000 ms is pinned in backup-erase.test.jsx.)
    await vi.advanceTimersByTimeAsync(6000);                                             // t = 8100 ms (nominal), before the limit: still working
    expect(document.body.textContent).toContain('Finishing the erase…'); expect(document.body.textContent).not.toContain("A previous erase didn't finish.");
    await vi.advanceTimersByTimeAsync(1100);                                             // t = 9200 ms (nominal), past the limit
    await vi.waitFor(() => expect(document.body.textContent).toContain("A previous erase didn't finish. Tap Delete all data to finish.")); expect(document.body.textContent).not.toContain('RCD TESTING');
  });
});

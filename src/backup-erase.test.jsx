// DELETE ALL DATA (Stage 6). FICTIONAL data. The engine (marker, owned-key erase, store steps, the approved hang rule, the three-attempt leftover fallback), the screens (Data tab block, the Settings-only screen with its
// three states) and the startup through the real src/main.jsx. The hang tests use fake timers and a store step that never completes; the success tests use the real fake-indexeddb databases.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import fs from 'fs';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within, configure, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { GlobalSettingsView, BACKUP_UI, backupBuild, backupRestore, backupKeyAllowed, backupKeyExcluded, eraseStartup, eraseBegin, eraseOwnedKeys, eraseStepLimitMs, eraseMarker, eraseLeftover, eraseSet, eraseRuntime, ERASE_KEY, LEFTOVER_KEY, ERASE_MAX_ATTEMPTS, ERASE_RENDER_BUDGET_MS, RESTORE_KEY, BACKUP_LAST_KEY } from './App.jsx';
import { idbSnapshot, lsSnapshot, seedPhone, wipe, seedSourceFull, withDb } from './test/backup-fixtures.js';

vi.setConfig({ testTimeout: 30000 });
configure({ asyncUtilTimeout: 10000 });
const MB = 1024 * 1024;
const NOW = new Date(2026, 9, 11, 12, 0);
const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
// The faked-clock runs (00:30 / 23:30) install their own fake Date before every test; installing fake timers on top of that does nothing, so reset first and keep the same fake date.
const fakeTimers = toFake => { vi.useRealTimers(); vi.useFakeTimers({ toFake: [...toFake, ...(process.env.CLOCK_AT ? ['Date'] : [])] }); if (process.env.CLOCK_AT) vi.setSystemTime(new Date(process.env.CLOCK_AT)); };
const ALL_TIMERS = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate'];
const never = () => new Promise(() => {});
const marker = (attempts = 0) => rawSetItem(ERASE_KEY, JSON.stringify({ v: 1, attempts, at: '2026-10-11T00:00:00.000Z' }));
const idbCount = async () => { const s = await idbSnapshot(); return Object.values(s).reduce((n, o) => n + Object.keys(o).length, 0); };
const OTHERS = { 'some-other-app-v1': '{"x":1}', 'sparkcheck-unrelated': 'keep me', 'theme': 'dark' };
const seedOthers = () => Object.entries(OTHERS).forEach(([k, v]) => rawSetItem(k, v));
const seedAll = async () => { await seedSourceFull(); rawSetItem('rcd-projects-v6-preMigration-v1'.replace('-v6-preMigration-v1', '-results-preMigration-v1'), '[]'); rawSetItem(RESTORE_KEY, JSON.stringify({ v: 1, undo: null })); rawSetItem(BACKUP_LAST_KEY, JSON.stringify({ v: 1, at: '2026-10-01T00:00:00.000Z' })); seedOthers(); };
const OWNED_LEFT = () => Object.keys(lsSnapshot()).filter(k => backupKeyAllowed(k) || backupKeyExcluded(k));
const lum = hex => { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
beforeEach(async () => { await wipe(); eraseSet('none'); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); eraseSet('none'); });

describe('the limits (the approved hang rule)', () => {
  it('per step: 5 s floor, 18 ms per MB stored, 30 s cap, and 500 MB (9 s) when the usage is unknown', () => {
    expect(eraseStepLimitMs(0)).toBe(5000); expect(eraseStepLimitMs(100 * MB)).toBe(5000); expect(eraseStepLimitMs(277 * MB)).toBe(5000); expect(eraseStepLimitMs(278 * MB)).toBe(5004);
    expect(eraseStepLimitMs(400 * MB)).toBe(7200); expect(eraseStepLimitMs(1000 * MB)).toBe(18000); expect(eraseStepLimitMs(1666 * MB)).toBe(29988); expect(eraseStepLimitMs(1667 * MB)).toBe(30000); expect(eraseStepLimitMs(50000 * MB)).toBe(30000);
    for (const bad of [undefined, null, NaN, -1, Infinity, '12']) expect(eraseStepLimitMs(bad)).toBe(9000);
  });
  it('the render budget is 2 s and there are 3 attempts', () => { expect(ERASE_RENDER_BUDGET_MS).toBe(2000); expect(ERASE_MAX_ATTEMPTS).toBe(3); });
});

describe('the marker and the list of what is deleted', () => {
  it('eraseBegin writes the marker with 0 attempts; an unfinished erase keeps its count (so the three-attempt rule still holds); it throws, changing nothing, when there is no room', () => {
    eraseBegin(S, NOW); expect(JSON.parse(localStorage.getItem(ERASE_KEY))).toEqual({ v: 1, attempts: 0, at: NOW.toISOString() });
    marker(2); eraseBegin(S, NOW); expect(eraseMarker(S).attempts).toBe(2);
    localStorage.removeItem(ERASE_KEY); const before = lsSnapshot(); expect(() => eraseBegin({ getItem: () => null, setItem() { throw new DOMException('full', 'QuotaExceededError'); } }, NOW)).toThrow(); expect(lsSnapshot()).toEqual(before);
  });
  it('removes every key this app owns (module data, calendar, settings, preMigration copies, restore record, last-backup note) and nothing else; the marker and the leftover note are left for the end', async () => {
    await seedAll(); marker(1); rawSetItem(LEFTOVER_KEY, '{"v":1}'); const owned = OWNED_LEFT().filter(k => k !== ERASE_KEY && k !== LEFTOVER_KEY); expect(owned.length).toBeGreaterThan(20);
    expect(owned).toContain('cal-events-v1'); expect(owned).toContain(RESTORE_KEY); expect(owned).toContain(BACKUP_LAST_KEY); expect(owned.some(k => /preMigration/.test(k))).toBe(true);
    const r = eraseOwnedKeys(S); expect(r).toEqual({ removed: owned.length, failed: 0 });
    expect(Object.keys(lsSnapshot()).sort()).toEqual([ERASE_KEY, LEFTOVER_KEY, ...Object.keys(OTHERS)].sort());
  });
  it('a key that cannot be removed is counted, never thrown, and the rest are still removed', async () => {
    await seedAll(); const sticky = { getItem: S.getItem, setItem: S.setItem, key: S.key, get length() { return localStorage.length; }, removeItem: k => { if (k === 'cal-events-v1') throw new Error('locked'); localStorage.removeItem(k); } };
    const r = eraseOwnedKeys(sticky); expect(r.failed).toBe(1); expect(localStorage.getItem('cal-events-v1')).not.toBeNull(); expect(OWNED_LEFT()).toEqual(['cal-events-v1']);
  });
  it('every storage key the app source names (…-vN) is on the delete list, so no module keeps data after a delete', () => {
    const src = fs.readFileSync(process.cwd() + '/src/App.jsx', 'utf8'); const found = new Set(); for (const m of src.matchAll(/["'`]([a-z][a-z0-9-]*-v\d+)["'`]/g)) found.add(m[1]);
    const missed = [...found].filter(k => !(backupKeyAllowed(k) || backupKeyExcluded(k))); expect(found.size).toBeGreaterThan(40); expect(missed).toEqual([]);
  });
  it('a backup made while the marker, the leftover note, the restore record and the last-backup note exist lists all four as excluded and does not contain them', async () => {
    await seedSourceFull(); marker(1); rawSetItem(LEFTOVER_KEY, '{"v":1,"stores":["site-photos"]}'); rawSetItem(RESTORE_KEY, '{"v":1}'); rawSetItem(BACKUP_LAST_KEY, '{"v":1}');
    const b = await backupBuild({ now: NOW, storage: S }); const ex = b.manifest.notBackedUp.excludedKeys; for (const k of [ERASE_KEY, LEFTOVER_KEY, RESTORE_KEY, BACKUP_LAST_KEY]) expect(ex).toContain(k);
    expect(b.manifest.notBackedUp.unknownKeys).not.toContain(ERASE_KEY); expect(b.manifest.notBackedUp.unknownKeys).not.toContain(LEFTOVER_KEY);
    const text = new TextDecoder().decode(new Uint8Array(await b.blob.arrayBuffer())); expect(text.includes('"attempts":1')).toBe(false); expect(text.includes('"stores":["site-photos"]')).toBe(false);      // the manifest names the excluded keys, but their VALUES are never in the file
  });
});

describe('the erase at startup, with the real databases', () => {
  it('no marker: nothing is touched', async () => {
    await seedAll(); const ls = lsSnapshot(), idb = await idbSnapshot(); const r = await eraseStartup({ storage: S }); expect(r).toEqual({ render: 'normal' }); expect(lsSnapshot()).toEqual(ls); expect(await idbSnapshot()).toEqual(idb);
  });
  it('a marker: every owned key and every photo / logo record is gone, the marker and the leftover note are removed, unrelated keys and databases are untouched, and the app renders normally', async () => {
    await seedAll(); marker(0); rawSetItem(LEFTOVER_KEY, '{"v":1}'); await withDb('some-other-app-db', 'things', st => st.put('v', 'k')); expect(await idbCount()).toBeGreaterThan(5);
    const onFinished = vi.fn(); const r = await eraseStartup({ storage: S, onFinished });
    expect(r).toEqual({ render: 'normal' }); expect(Object.keys(lsSnapshot()).sort()).toEqual(Object.keys(OTHERS).sort()); expect(await idbCount()).toBe(0); expect(onFinished).not.toHaveBeenCalled();
    expect(await withDb('some-other-app-db', 'things', st => st.get('k'))).toBe('v'); expect(eraseRuntime.state.settingsOnly).toBe(false);
  });
  it('the localStorage keys are already gone BEFORE the first store is touched, and the marker is already on its first attempt', async () => {
    await seedAll(); marker(0); const seen = []; await eraseStartup({ storage: S, clear: async st => { seen.push({ id: st.id, owned: OWNED_LEFT(), attempts: eraseMarker(S) && eraseMarker(S).attempts }); } });
    expect(seen.map(x => x.id)).toEqual(['site-photos', 'gsd-photos', 'app-logo', 'site-logos']); for (const x of seen) { expect(x.owned).toEqual([ERASE_KEY]); expect(x.attempts).toBe(1); }
  });
  it('a damaged marker still erases (counted as attempt 1)', async () => {
    await seedAll(); rawSetItem(ERASE_KEY, 'garbage{'); const r = await eraseStartup({ storage: S }); expect(r.render).toBe('normal'); expect(OWNED_LEFT()).toEqual([]); expect(await idbCount()).toBe(0);
  });
  it('erasing an empty phone (no databases yet) is fine and leaves no databases behind', async () => {
    marker(0); const r = await eraseStartup({ storage: S }); expect(r.render).toBe('normal'); expect(OWNED_LEFT()).toEqual([]);
  });
  it('a database that exists but has no object store holds nothing to clear: the erase does not fail on it, and the stores after it are still cleared', async () => {
    // A fresh fake IndexedDB for this one test (connections the app's own stores keep open in the shared one would block the set-up), put back afterwards.
    const real = globalThis.indexedDB; globalThis.indexedDB = new IDBFactory();
    const emptyDb = n => new Promise((res, rej) => { const rq = indexedDB.open(n); rq.onsuccess = () => { rq.result.close(); res(); }; rq.onerror = () => rej(rq.error); });
    const storesOf = n => new Promise((res, rej) => { const rq = indexedDB.open(n); rq.onsuccess = () => { const l = [...rq.result.objectStoreNames]; rq.result.close(); res(l); }; rq.onerror = () => rej(rq.error); });
    try {
      seedPhone(); marker(0); await emptyDb('sparkcheck-site-photos'); await emptyDb('sparkcheck-app-settings');
      await withDb('sparkcheck-gsd-photos', 'photos', st => st.put({ buf: new Uint8Array([1, 2, 3]).buffer, type: 'image/jpeg' }, 'g1')); await withDb('sparkcheck-site-logos', 'logos', st => st.put({ buf: new Uint8Array([4]).buffer, type: 'image/png' }, 'l1'));
      expect(await storesOf('sparkcheck-site-photos')).toEqual([]); expect(await storesOf('sparkcheck-app-settings')).toEqual([]);
      expect(await withDb('sparkcheck-gsd-photos', 'photos', st => st.count())).toBe(1); expect(await withDb('sparkcheck-site-logos', 'logos', st => st.count())).toBe(1);
      const onFinished = vi.fn(); const r = await eraseStartup({ storage: S, onFinished });
      expect(r).toEqual({ render: 'normal' }); expect(onFinished).not.toHaveBeenCalled(); expect(eraseRuntime.state.settingsOnly).toBe(false);
      expect(eraseMarker(S)).toBe(null); expect(eraseLeftover(S)).toBe(null); expect(OWNED_LEFT()).toEqual([]);
      expect(await withDb('sparkcheck-gsd-photos', 'photos', st => st.count())).toBe(0); expect(await withDb('sparkcheck-site-logos', 'logos', st => st.count())).toBe(0);
      expect(await storesOf('sparkcheck-site-photos')).toEqual([]); expect(await storesOf('sparkcheck-app-settings')).toEqual([]);
    } finally { globalThis.indexedDB = real; }
  });
});

describe('the hang rule, with a store step that never completes (fake timers)', () => {
  const setup = () => { fakeTimers(ALL_TIMERS); const onFinished = vi.fn(); const p = eraseStartup({ storage: S, clear: never, estimate: () => Promise.resolve({ usage: 0 }), onFinished, now: () => NOW }); return { onFinished, p }; };
  it('startup answers within the 2 s render budget with the Settings-only screen, owned keys already gone, the marker on attempt 1; then, when the step runs out of time (5 s), the state becomes retry and the marker stays', async () => {
    await seedAll(); marker(0); const { p, onFinished } = setup(); let out = null; p.then(r => { out = r; });
    await vi.advanceTimersByTimeAsync(1999); expect(out).toBeNull(); expect(OWNED_LEFT()).toEqual([ERASE_KEY]);
    await vi.advanceTimersByTimeAsync(1); expect(out).toEqual({ render: 'settings-only', mode: 'working' }); expect(eraseRuntime.state).toEqual({ mode: 'working', settingsOnly: true }); expect(eraseMarker(S).attempts).toBe(1);
    await vi.advanceTimersByTimeAsync(2998); expect(eraseRuntime.state.mode).toBe('working'); await vi.advanceTimersByTimeAsync(2); expect(eraseRuntime.state).toEqual({ mode: 'retry', settingsOnly: true });
    expect(eraseMarker(S).attempts).toBe(1); expect(eraseLeftover(S)).toBeNull(); expect(onFinished).not.toHaveBeenCalled(); expect(Object.keys(lsSnapshot()).sort()).toEqual([ERASE_KEY, ...Object.keys(OTHERS)].sort());
  });
  it('the step limit follows the usage estimate: 400 MB stored gives 7.2 s; a never-answering estimate waits 1 s and then uses the 500 MB figure (9 s)', async () => {
    marker(0); fakeTimers(ALL_TIMERS); eraseStartup({ storage: S, clear: never, estimate: () => Promise.resolve({ usage: 400 * MB }) }); await vi.advanceTimersByTimeAsync(2000); expect(eraseRuntime.state.mode).toBe('working');
    await vi.advanceTimersByTimeAsync(5199); expect(eraseRuntime.state.mode).toBe('working'); await vi.advanceTimersByTimeAsync(2); expect(eraseRuntime.state.mode).toBe('retry');
    eraseSet('none'); marker(0); eraseStartup({ storage: S, clear: never, estimate: never }); await vi.advanceTimersByTimeAsync(2000); expect(eraseRuntime.state.mode).toBe('working');
    await vi.advanceTimersByTimeAsync(7998); expect(eraseRuntime.state.mode).toBe('working'); await vi.advanceTimersByTimeAsync(3); expect(eraseRuntime.state.mode).toBe('retry');
  });
  it('three attempts: the 3rd failure replaces the marker with the leftover note (naming the stores not cleared), and, because the screen was up, the app is reloaded into the normal app', async () => {
    await seedAll(); marker(0); for (let n = 1; n <= 2; n++) { const { p } = setup(); void p; await vi.advanceTimersByTimeAsync(7000); expect(eraseRuntime.state.mode).toBe('retry'); expect(eraseMarker(S).attempts).toBe(n); eraseBegin(S, NOW); }
    const { onFinished } = setup(); await vi.advanceTimersByTimeAsync(7000);
    expect(eraseMarker(S)).toBeNull(); expect(localStorage.getItem(ERASE_KEY)).toBeNull(); expect(eraseLeftover(S)).toEqual({ v: 1, at: NOW.toISOString(), stores: ['site-photos', 'gsd-photos', 'app-logo', 'site-logos'] }); expect(onFinished).toHaveBeenCalledTimes(1);
    expect(OWNED_LEFT()).toEqual([LEFTOVER_KEY]);
  });
  it('a store that fails at once on the 3rd attempt (before the render budget): the app opens normally with the leftover note and nothing is reloaded', async () => {
    await seedAll(); marker(2); const onFinished = vi.fn(); const r = await eraseStartup({ storage: S, clear: st => st.id === 'app-logo' ? Promise.reject(new Error('boom')) : Promise.resolve(), onFinished, now: () => NOW });
    expect(r).toEqual({ render: 'normal' }); expect(eraseLeftover(S)).toEqual({ v: 1, at: NOW.toISOString(), stores: ['app-logo', 'site-logos'] }); expect(localStorage.getItem(ERASE_KEY)).toBeNull(); expect(onFinished).not.toHaveBeenCalled(); expect(eraseRuntime.state.settingsOnly).toBe(false);
  });
  it('a store that fails at once on attempt 1: the Settings-only screen in the retry state straight away', async () => {
    marker(0); const r = await eraseStartup({ storage: S, clear: () => Promise.reject(new Error('boom')) }); expect(r).toEqual({ render: 'settings-only', mode: 'retry' }); expect(eraseRuntime.state.mode).toBe('retry'); expect(eraseMarker(S).attempts).toBe(1);
  });
  it('an app killed during the 3rd attempt (marker already at 3) gives up at the next start: leftover note naming all four stores, marker removed, normal app', async () => {
    await seedAll(); marker(3); const r = await eraseStartup({ storage: S, clear: never, now: () => NOW });
    expect(r).toEqual({ render: 'normal' }); expect(eraseLeftover(S).stores).toEqual(['site-photos', 'gsd-photos', 'app-logo', 'site-logos']); expect(localStorage.getItem(ERASE_KEY)).toBeNull(); expect(OWNED_LEFT()).toEqual([LEFTOVER_KEY]);
  });
  it('an erase that finishes after the screen is up (3 s) reloads into the first-run state, with the marker gone', async () => {
    marker(0); fakeTimers(ALL_TIMERS); const onFinished = vi.fn(); eraseStartup({ storage: S, clear: () => new Promise(r => setTimeout(r, 3000)), estimate: () => Promise.resolve({ usage: 0 }), onFinished });
    await vi.advanceTimersByTimeAsync(2000); expect(eraseRuntime.state.mode).toBe('working'); expect(onFinished).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(3000 * 4 + 10); expect(onFinished).toHaveBeenCalledTimes(1); expect(localStorage.getItem(ERASE_KEY)).toBeNull();
  });
  it('a later successful erase removes the leftover note', async () => {
    rawSetItem(LEFTOVER_KEY, JSON.stringify({ v: 1, stores: ['site-photos'] })); marker(0); const r = await eraseStartup({ storage: S }); expect(r.render).toBe('normal'); expect(localStorage.getItem(LEFTOVER_KEY)).toBeNull(); expect(localStorage.getItem(ERASE_KEY)).toBeNull();
  });
  it('a failing step stops the attempt: the stores after it are not tried, and they are the ones the leftover note names', async () => {
    marker(2); const tried = []; await eraseStartup({ storage: S, clear: st => { tried.push(st.id); return st.id === 'gsd-photos' ? Promise.reject(new Error('x')) : Promise.resolve(); }, now: () => NOW }); expect(tried).toEqual(['site-photos', 'gsd-photos']); expect(eraseLeftover(S).stores).toEqual(['gsd-photos', 'app-logo', 'site-logos']);
  });
});

// ── the screens
const mountSettings = (over = {}) => { const user = userEvent.setup(); const reload = vi.fn(); const r = render(<GlobalSettingsView onGoHome={() => {}} backupDeps={{ reload, now: () => NOW, eraseBegin: () => eraseBegin(S, NOW), ...over }} />); return { user, reload, ...r }; };
const dataTab = async user => { await user.click(await screen.findByRole('tab', { name: 'Backup & Data' })); };
const sec = () => screen.getByTestId('backup-section');
describe('the Delete all data block on the Data tab', () => {
  it('is the last block of the section, after Undo, with the heading, the plain intro and a 44 px Delete all data… button; no window.confirm / alert', async () => {
    const spy = vi.spyOn(window, 'confirm'); const { user } = mountSettings(); await dataTab(user);
    expect(within(sec()).getByText('Delete all data')).toBeInTheDocument(); expect(screen.getByTestId('erase-caption').textContent).toBe("Removes everything SparkCheck keeps on this phone, including your business details, company logo, dropdown lists and TAT lists. It cannot be undone. Files you saved, such as backups and Excel exports, are not removed."); expect(screen.queryByTestId('erase-restore-note')).toBeNull();      // ONE caption now: what goes, that it cannot be undone, that saved files stay, what a backup does not include (pinned whole, with toBe)
    const b = screen.getByTestId('erase-open'); expect(b.textContent).toBe('Delete all data…'); expect(b.style.minHeight).toBe('44px'); expect(sec().lastElementChild.contains(b)).toBe(true); expect(spy).not.toHaveBeenCalled();
    const heads = Array.from(sec().querySelectorAll('div')).filter(e => e.textContent === 'Delete all data' || e.textContent === 'Back up' || e.textContent === 'Restore'); expect(heads[heads.length - 1].textContent).toBe('Delete all data');
  });
  it('tapping it asks first (the module-style two-step, with what goes, the last backup and what happens next); No keeps everything and writes nothing', async () => {
    const { user, reload } = mountSettings(); await dataTab(user); await user.click(screen.getByTestId('erase-open')); const box = screen.getByTestId('erase-confirm');
    expect(box.textContent).toContain("Delete everything on this phone? This erases your sites, results, photos and business details and cannot be undone. A backup does not include business details, the company logo or lists, so note them down first. Last backup: never. The app restarts when it is done.");
    expect(within(box).getByText('Yes, delete everything')).toBeInTheDocument(); expect(localStorage.getItem(ERASE_KEY)).toBeNull();
    await user.click(screen.getByTestId('erase-confirm-no')); expect(screen.queryByTestId('erase-confirm')).toBeNull(); expect(localStorage.getItem(ERASE_KEY)).toBeNull(); expect(reload).not.toHaveBeenCalled(); expect(screen.getByTestId('erase-open')).toBeInTheDocument();
  });
  it('Yes writes the marker (attempt 0) and reloads, nothing else is touched in this page, and the Modules pill does nothing while it starts', async () => {
    await seedAll(); const before = lsSnapshot(); const home = vi.fn(); const user = userEvent.setup(); const reload = vi.fn();
    render(<GlobalSettingsView onGoHome={home} backupDeps={{ reload, now: () => NOW, eraseBegin: () => eraseBegin(S, NOW) }} />); await dataTab(user); await user.click(screen.getByTestId('erase-open')); await user.click(screen.getByTestId('erase-confirm-yes'));
    expect(reload).toHaveBeenCalledTimes(1); expect(JSON.parse(localStorage.getItem(ERASE_KEY))).toEqual({ v: 1, attempts: 0, at: NOW.toISOString() }); const after = lsSnapshot(); delete after[ERASE_KEY]; expect(after).toEqual(before);
    expect(sec().textContent).toContain('Deleting… the app restarts by itself.'); expect(screen.getByTestId('erase-open')).toBeDisabled(); await user.click(screen.getByText('Modules').closest('button')); expect(home).not.toHaveBeenCalled();
  });
  it('a backup that is made but not shared is dropped when Yes is tapped (nothing of it is held across the restart)', async () => {
    const { user, reload } = mountSettings(); await dataTab(user); await user.click(screen.getByTestId('backup-make')); await screen.findByTestId('backup-share'); await user.click(screen.getByTestId('erase-open')); await user.click(screen.getByTestId('erase-confirm-yes'));
    expect(reload).toHaveBeenCalled(); expect(screen.queryByTestId('backup-share')).toBeNull();
  });
  it('if the marker cannot be written the screen says nothing was deleted, nothing is changed and there is no reload', async () => {
    await seedAll(); const before = lsSnapshot(); const { user, reload } = mountSettings({ eraseBegin: () => { throw new DOMException('full', 'QuotaExceededError'); } }); await dataTab(user); await user.click(screen.getByTestId('erase-open')); await user.click(screen.getByTestId('erase-confirm-yes'));
    const card = await screen.findByTestId('erase-failed'); expect(card.textContent).toContain('The delete could not be started'); expect(card.textContent).toContain('Nothing was deleted. Please try again.'); expect(card.getAttribute('role')).toBe('alert');
    expect(reload).not.toHaveBeenCalled(); expect(lsSnapshot()).toEqual(before); expect(screen.getByTestId('erase-open')).toBeEnabled();
  });
  it('the red Yes button passes 4.5:1 and every state is words as well as colour (card titles, no colour-only meaning)', async () => {
    expect(ratio(BACKUP_UI.white, BACKUP_UI.red)).toBeGreaterThanOrEqual(4.5); const { user } = mountSettings(); await dataTab(user); await user.click(screen.getByTestId('erase-open')); const yes = screen.getByTestId('erase-confirm-yes'); expect(yes.style.background).toBe('rgb(153, 27, 27)'); expect(yes.style.minHeight).toBe('44px'); expect(yes.textContent).toBe('Yes, delete everything');
  });
  it('the Last backup date is quoted in the question', async () => {
    rawSetItem(BACKUP_LAST_KEY, JSON.stringify({ v: 1, at: new Date(2026, 9, 10, 9, 0).toISOString() })); const { user } = mountSettings({ lastText: () => 'yesterday' }); await dataTab(user); await user.click(screen.getByTestId('erase-open')); expect(screen.getByTestId('erase-confirm').textContent).toContain('Last backup: yesterday.');
  });
  it('Delete all data is not offered while a restore or a backup build is running (the tabs hold still and so does the button)', async () => {
    let finish; const { user } = mountSettings({ build: () => new Promise(r => { finish = r; }), measure: async () => ({ estimatedBytes: 10 }) }); await dataTab(user); await user.click(screen.getByTestId('backup-make')); await waitFor(() => expect(screen.getByTestId('erase-open')).toBeDisabled()); expect(finish).toBeTypeOf('function');
  });
  it('a leftover note shows the plain card (words, and a warning icon) with the button still there; a second confirmed delete starts again from attempt 0', async () => {
    rawSetItem(LEFTOVER_KEY, JSON.stringify({ v: 1, stores: ['site-photos'] })); const { user, reload } = mountSettings({ leftover: () => eraseLeftover(S) }); await dataTab(user); const card = screen.getByTestId('erase-leftover');
    expect(card.textContent).toContain('Some photo storage could not be cleared.'); expect(card.textContent).toContain('All your sites and results are gone. Some old photos are still taking up space and the app cannot see them. Tap Delete all data to try again, or leave it: nothing else is affected.'); expect(card.querySelector('svg')).not.toBeNull();
    await user.click(screen.getByTestId('erase-open')); await user.click(screen.getByTestId('erase-confirm-yes')); expect(reload).toHaveBeenCalled(); expect(eraseMarker(S).attempts).toBe(0);
  });
});

describe('the Settings-only screen (an erase is unfinished)', () => {
  it('while it is still working: Global Settings only, no Modules pill, opens on Data, the Company tab holds still, only the delete block shows, and its button is disabled; the words are the approved ones', async () => {
    eraseSet('working'); const user = userEvent.setup(); render(<GlobalSettingsView onGoHome={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Backup & Data' })).toHaveAttribute('aria-selected', 'true'); expect(screen.getByRole('tab', { name: 'Business' })).toHaveAttribute('aria-disabled', 'true'); expect(screen.queryByTestId('settings-pill')).toBeNull(); expect(screen.queryByText('Modules')).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Business' })); expect(screen.getByRole('tab', { name: 'Backup & Data' })).toHaveAttribute('aria-selected', 'true');
    const card = screen.getByTestId('erase-working'); expect(card.textContent).toContain('Finishing the erase…'); expect(card.textContent).toContain('SparkCheck is clearing the last of your data. This can take a moment. The app opens by itself when it is done.');
    expect(screen.getByTestId('erase-open')).toBeDisabled(); for (const id of ['backup-make', 'backup-choose', 'backup-last', 'backup-undo-open']) expect(screen.queryByTestId(id)).toBeNull(); expect(sec().textContent).not.toMatch(/Back up|Restore|Undo/);
  });
  it('after an attempt ran out of time: the approved words, the button works through the same two-step, and the attempt count is kept', async () => {
    marker(1); eraseSet('retry'); const user = userEvent.setup(); const reload = vi.fn(); render(<GlobalSettingsView onGoHome={() => {}} backupDeps={{ reload, eraseBegin: () => eraseBegin(S, NOW) }} />);
    const card = screen.getByTestId('erase-retry'); expect(card.getAttribute('role')).toBe('alert'); expect(card.textContent).toContain("A previous erase didn't finish. Tap Delete all data to finish."); expect(card.textContent).toContain('Some of your data may still be on this phone. Tap Delete all data to finish clearing it. The modules stay closed until it is cleared, so nothing is half cleared.');
    await user.click(screen.getByTestId('erase-open')); await user.click(screen.getByTestId('erase-confirm-yes')); expect(reload).toHaveBeenCalled(); expect(eraseMarker(S).attempts).toBe(1);
  });
  it('the whole app (not only Settings) shows this screen: no module tile, no Modules pill; with no unfinished erase the same app shows the module grid (negative control)', async () => {
    const { unmount } = render(<AppRoot />); expect(await screen.findByText('GENERAL SITE DEFECTS')).toBeInTheDocument(); unmount();
    eraseSet('working'); render(<AppRoot />); expect(await screen.findByText('Global Settings')).toBeInTheDocument(); expect(screen.queryByText('GENERAL SITE DEFECTS')).toBeNull(); expect(screen.queryByText('RCD')).toBeNull(); expect(screen.queryByTestId('settings-pill')).toBeNull();
  });
  it('when the state changes from working to retry the same screen updates by itself (no reload)', async () => {
    eraseSet('working'); render(<GlobalSettingsView onGoHome={() => {}} />); expect(screen.getByTestId('erase-working')).toBeInTheDocument(); act(() => eraseSet('retry')); expect(screen.queryByTestId('erase-working')).toBeNull(); expect(screen.getByTestId('erase-retry')).toBeInTheDocument(); expect(screen.getByTestId('erase-open')).toBeEnabled();
  });
  it('the normal screen is unchanged: the Modules pill is there and the Company tab works (negative control)', async () => {
    const user = userEvent.setup(); render(<GlobalSettingsView onGoHome={() => {}} />); expect(screen.getByText('Modules')).toBeInTheDocument(); await dataTab(user); await user.click(screen.getByRole('tab', { name: 'Business' })); expect(screen.getByRole('tab', { name: 'Business' })).toHaveAttribute('aria-selected', 'true');
  });
});

// The Delete question says a backup does not include business details, the company logo or lists (the dropdown lists and the TAT lists). This proves that against the real engines: seed a full phone, back it up, delete everything (the real startup erase), restore the backup.
describe('what a restore brings back after Delete all data (the wording is true)', () => {
  it('sites, results, History, calendar events, photos and site logos come back; business details, the company logo, every dropdown list, the TAT lists, rcd-mode and iel-cat do NOT', async () => {
    await seedSourceFull(); rawSetItem('tat-names-v1', '{"x":"y"}'); rawSetItem('tat-defaults-v1', '{"d":1}'); rawSetItem('tat-settings-v1', '{"s":1}'); rawSetItem('iel-cat-v2', '"cat"'); rawSetItem('rcd-mode-v6', '"mode"'); rawSetItem('iel-dropdowns-v1', '{"a":["b"]}'); rawSetItem('gsd-dropdowns-v1', '{"a":["b"]}');
    const NOT_RESTORED = ['app-settings-v1', 'rcd-dropdowns-v6', 'iel-dropdowns-v1', 'gsd-dropdowns-v1', 'tat-freqs-v1', 'tat-names-v1', 'tat-defaults-v1', 'tat-settings-v1', 'rcd-mode-v6', 'iel-cat-v2'];
    for (const k of NOT_RESTORED) expect(localStorage.getItem(k), k).not.toBeNull();                                      // they ARE on the phone before the delete
    const before = lsSnapshot(), beforeIdb = await idbSnapshot(); expect(beforeIdb['sparkcheck-app-settings'].logo).toBeTruthy();   // the company logo is there too
    const { blob } = await backupBuild({ now: NOW, storage: S }); const fileText = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer())); for (const k of NOT_RESTORED) expect(fileText, k + " is inside the backup file").toContain('"' + k + '"');      // so the point is that a RESTORE does not apply them, not that the file lacks them
    marker(0); await eraseStartup({ storage: S });
    expect(OWNED_LEFT()).toEqual([]); expect(await idbCount()).toBe(0);                                                  // everything is gone
    const r = await backupRestore(new File([blob], 'b.zip', { type: 'application/zip' }), { storage: S, now: NOW }); expect(r.ok).toBe(true);
    const after = lsSnapshot(), afterIdb = await idbSnapshot();
    for (const k of NOT_RESTORED) expect(after[k], k + ' must not come back').toBeUndefined();                           // what the question says a backup does NOT include: business details (app-settings), dropdown lists, TAT lists (and the two modes, which the screen does not name)
    expect(afterIdb['sparkcheck-app-settings']).toEqual({});                                                              // the company logo does not come back
    for (const k of ['rcd-projects-v6', 'rcd-results-v6', 'rcd-history-v6', 'swb-projects-v1', 'gsd-projects-v1', 'cal-events-v1']) expect(after[k], k + ' must come back').toBe(before[k]);   // what the screen says IS brought back (identical text)
    expect(Object.keys(afterIdb['sparkcheck-site-photos']).sort()).toEqual(Object.keys(beforeIdb['sparkcheck-site-photos']).filter(k => k !== 'unused').sort());   // photos (the unreferenced one is not backed up)
    expect(Object.keys(afterIdb['sparkcheck-site-logos'])).toEqual(Object.keys(beforeIdb['sparkcheck-site-logos']));                                            // the site logo comes back
  });
});

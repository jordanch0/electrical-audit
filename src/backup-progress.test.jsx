// OPTIONAL PROGRESS IN backupRestore (Round a). FICTIONAL data. onProgress({ phase, done, total }) is for the screen's "photos 12 of 40" line. It is THROTTLED (time based, plus always the last call of a phase), never awaited,
// carries numbers and a phase word only (no names), and a failure inside it (a throw, a rejected promise) can NEVER fail the restore or change what it writes.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { backupRestore, sitePhotoStore, RESTORE_KEY } from './App.jsx';
import { idbSnapshot, lsSnapshot, rec, FM, seedModule, wipe, backupOf, seedSourceFull } from './test/backup-fixtures.js';

const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
const NOW = new Date(2026, 9, 5, 12, 0);
// a source phone with n photos, all used by one site
const manyPhotos = n => async () => { seedModule(FM.swb, { extraResults: { itemX: { photos: Array.from({ length: n }, (_, i) => ({ id: 'ph' + i, w: 1, h: 1 })) } } }); for (let i = 0; i < n; i++) await sitePhotoStore.put('ph' + i, rec(i % 250, 1, 2)); };
const snap = async () => ({ ls: lsSnapshot(), idb: await idbSnapshot() });
beforeEach(wipe);
afterEach(() => { vi.restoreAllMocks(); });

describe('what the callback receives', () => {
  it('numbers and a phase word only; the last call of every phase is always delivered; no names anywhere', async () => {
    const file = await backupOf(seedSourceFull); const events = [];
    expect((await backupRestore(file, { storage: S, now: NOW, onProgress: e => events.push(e) })).ok).toBe(true);
    for (const e of events) { expect(Object.keys(e)).toEqual(['phase', 'done', 'total']); expect(['photos', 'verifying', 'saving']).toContain(e.phase); expect(e.done).toBeLessThanOrEqual(e.total); }
    const last = ph => events.filter(e => e.phase === ph).pop();
    expect(last('photos')).toEqual({ phase: 'photos', done: 6, total: 6 }); expect(last('verifying')).toEqual({ phase: 'verifying', done: 6, total: 6 }); expect(last('saving').done).toBe(last('saving').total); expect(last('saving').total).toBeGreaterThan(30);
    for (const ph of ['photos', 'verifying', 'saving']) { const d = events.filter(e => e.phase === ph).map(e => e.done); expect(d).toEqual([...d].sort((a, b) => a - b)); }
    const text = JSON.stringify(events); for (const name of ['Site One', 'Second SWB', 'Second GSD', 'p1', 'g1', 'swb', 'rcd', 'Example']) expect(text, name).not.toContain(name);
  });
  it('is not called at all when nothing is restored (nothing to add)', async () => {
    await wipe(); await seedSourceFull(); const { backupBuild } = await import('./App.jsx'); const { blob } = await backupBuild(); const cb = vi.fn();
    expect(await backupRestore(blob, { storage: S, onProgress: cb })).toMatchObject({ ok: false, code: 'nothing' }); expect(cb).not.toHaveBeenCalled();
  });
});

describe('THROTTLED: time based, not one call per photo', () => {
  it('a restore of 60 photos on a fast clock (1 ms per reading) delivers far fewer than 60 photo events, and the last one is 60 of 60', async () => {
    const file = await backupOf(manyPhotos(60)); let t = 0; vi.spyOn(performance, 'now').mockImplementation(() => t++); const events = [];
    expect((await backupRestore(file, { storage: S, onProgress: e => events.push(e) })).ok).toBe(true);
    const photos = events.filter(e => e.phase === 'photos'); expect(photos.length).toBeLessThan(10); expect(photos[photos.length - 1]).toEqual({ phase: 'photos', done: 60, total: 60 });
  });
  it('the same restore on a slow clock (200 ms per reading) delivers every photo: the throttle is about time, nothing else', async () => {
    const file = await backupOf(manyPhotos(60)); let t = 0; vi.spyOn(performance, 'now').mockImplementation(() => (t += 200)); const events = [];
    expect((await backupRestore(file, { storage: S, onProgress: e => events.push(e) })).ok).toBe(true);
    expect(events.filter(e => e.phase === 'photos').map(e => e.done)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
  });
});

describe('a failure inside the callback can NEVER fail the restore or change what it writes', () => {
  const bad = { 'throws': () => { throw new TypeError('Zorblax Quarry secret'); }, 'throws a non-error': () => { throw 'plain text'; }, 'returns a rejected promise': () => Promise.reject(new RangeError('Zorblax Quarry secret')), 'is async and throws': async () => { throw new Error('Zorblax Quarry secret'); } };
  it.each(Object.entries(bad))('a callback that %s: the restore succeeds and the phone ends up exactly as without a callback', async (_n, cb) => {
    const file = await backupOf(seedSourceFull); vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unhandled = []; const h = e => unhandled.push(e); process.on('unhandledRejection', h);
    const r = await backupRestore(file, { storage: S, now: NOW, onProgress: cb }); await new Promise(res => setTimeout(res, 50)); process.off('unhandledRejection', h);
    expect(r.ok).toBe(true); expect(unhandled).toEqual([]); const withBad = await snap();
    await wipe(); const r2 = await backupRestore(file, { storage: S, now: NOW }); expect(r2.ok).toBe(true); expect(withBad).toEqual(await snap());
  });
  it('it is logged ONCE, by the error NAME only: never the message, so nothing a callback carries can reach the log', async () => {
    const file = await backupOf(seedSourceFull); const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await backupRestore(file, { storage: S, onProgress: bad.throws }); expect(warn).toHaveBeenCalledTimes(1);
    const line = warn.mock.calls[0].join(' '); expect(line).toContain('TypeError'); expect(line).not.toContain('Zorblax'); expect(line).not.toContain('secret');
  });
  it('even a callback that fails while the restore itself is failing does not disturb the rollback: the phone is exactly as before', async () => {
    const file = await backupOf(seedSourceFull); seedModule(FM.rcd, { id: 'local', name: 'Local' }); const before = await snap(); vi.spyOn(console, 'warn').mockImplementation(() => {});
    let c = 0; const orig = IDBObjectStore.prototype.put; vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (...a) { if (++c === 3) throw new Error('disk error'); return orig.apply(this, a); });
    const r = await backupRestore(file, { storage: S, onProgress: bad.throws }); vi.restoreAllMocks();
    expect(r).toMatchObject({ ok: false, code: 'failed' }); expect(await snap()).toEqual(before);
  });
  it('anything that is not a function is ignored', async () => {
    for (const v of ['x', 5, {}, null, undefined, true]) { await wipe(); const file = await backupOf(seedSourceFull); expect((await backupRestore(file, { storage: S, onProgress: v })).ok).toBe(true); }
  });
});

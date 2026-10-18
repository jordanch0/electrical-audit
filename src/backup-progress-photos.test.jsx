// THE RESTORE PROGRESS COUNTS PHOTOS ONLY (release n). FICTIONAL data. The line on screen reads "Restoring… photos N of M." where N and M count photos: a thumbnail or a logo is never counted, so the last value
// equals the total and is the same number the summary showed ("3 photos"). The "Checking what was added" phase does not name photos; it keeps counting every record it checks.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { backupRestore, backupPlan, backupSummaryText, sitePhotoStore, siteLogoStore } from './App.jsx';
import { rec, FM, seedModule, wipe, backupOf, seedSourceFull } from './test/backup-fixtures.js';

const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
const NOW = new Date(2026, 9, 5, 12, 0);
const slowClock = () => { let t = 0; vi.spyOn(performance, 'now').mockImplementation(() => (t += 200)); };       // every call is delivered: nothing is throttled away
// n photos, each with a thumbnail, used by one site
const photosWithThumbs = n => async () => { seedModule(FM.swb, { extraResults: { itemX: { photos: Array.from({ length: n }, (_, i) => ({ id: 'ph' + i, w: 1, h: 1 })) } } }); for (let i = 0; i < n; i++) { await sitePhotoStore.put('ph' + i, rec(i % 250, 1, 2)); await sitePhotoStore.put('ph' + i + '~t', rec(i % 250)); } };
beforeEach(wipe);
afterEach(() => { vi.restoreAllMocks(); });

describe('Restoring… photos N of M', () => {
  it('N and M count photos: 3 photos with 2 thumbnails and a site logo is "3 of 3", never "6 of 6"; the last value equals the total', async () => {
    const file = await backupOf(seedSourceFull); slowClock(); const events = [];
    expect((await backupRestore(file, { storage: S, now: NOW, onProgress: e => events.push(e) })).ok).toBe(true);
    const photos = events.filter(e => e.phase === 'photos');
    expect(photos).toEqual([{ phase: 'photos', done: 1, total: 3 }, { phase: 'photos', done: 2, total: 3 }, { phase: 'photos', done: 3, total: 3 }]);
  });
  it('it is the same number as the summary line shows before the restore ("3 photos")', async () => {
    const file = await backupOf(seedSourceFull); const plan = await backupPlan(file, { storage: S, estimate: async () => ({ quota: 1e9, usage: 0 }) });
    const added = backupSummaryText(plan).groups.find(g => g.id === 'added').summary; expect(added).toContain('3 photos'); slowClock(); const events = [];
    await backupRestore(file, { storage: S, now: NOW, onProgress: e => events.push(e) }); const last = events.filter(e => e.phase === 'photos').pop();
    expect(added).toContain(last.total + ' photos'); expect(last.done).toBe(last.total);
  });
  it('20 photos with 20 thumbnails: 20 events, 1 to 20, the total is 20 in every one (not 40)', async () => {
    const file = await backupOf(photosWithThumbs(20)); slowClock(); const events = [];
    expect((await backupRestore(file, { storage: S, now: NOW, onProgress: e => events.push(e) })).ok).toBe(true);
    const photos = events.filter(e => e.phase === 'photos'); expect(photos.map(e => e.done)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1)); expect(photos.every(e => e.total === 20)).toBe(true);
  });
  it('the last photo event is delivered even when the throttle is busy, and no event ever shows more than the total', async () => {
    const file = await backupOf(photosWithThumbs(30)); let t = 0; vi.spyOn(performance, 'now').mockImplementation(() => t++); const events = [];
    expect((await backupRestore(file, { storage: S, now: NOW, onProgress: e => events.push(e) })).ok).toBe(true);
    const photos = events.filter(e => e.phase === 'photos'); expect(photos.length).toBeLessThan(10); expect(photos[photos.length - 1]).toEqual({ phase: 'photos', done: 30, total: 30 }); for (const e of photos) expect(e.done).toBeLessThanOrEqual(e.total);
  });
  it('a restore that brings only a site logo (no photo) sends no photo events at all: the screen keeps its plain "Restoring…"', async () => {
    const file = await backupOf(async () => { seedModule(FM.swb, { id: 's2', name: 'Logo Only Site' }); await siteLogoStore.put('swb', 's2', rec(12)); }); slowClock(); const events = [];
    expect((await backupRestore(file, { storage: S, now: NOW, onProgress: e => events.push(e) })).ok).toBe(true);
    expect(events.filter(e => e.phase === 'photos')).toEqual([]); expect(events.some(e => e.phase === 'verifying')).toBe(true); expect(events.some(e => e.phase === 'saving')).toBe(true);
  });
  it('the next phase is unchanged: "Checking what was added" still counts every record it checks, thumbnails and logos included (6 here), and it never says "photos"', async () => {
    const file = await backupOf(seedSourceFull); slowClock(); const events = [];
    await backupRestore(file, { storage: S, now: NOW, onProgress: e => events.push(e) }); const v = events.filter(e => e.phase === 'verifying');
    expect(v[v.length - 1]).toEqual({ phase: 'verifying', done: 6, total: 6 });
  });
});

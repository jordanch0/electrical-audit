// BACKUP DELIVERY (Stage 4). FICTIONAL data. Measure what a backup would hold BEFORE building it; warn when it is large; hand the finished file to the share sheet (the file itself) with a plain download as the fallback;
// record "Last backup" only when the file was really handed over; never touch anything but that one record.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { backupBuild, backupInspect, backupMeasure, backupLargeWarning, backupDeliver, backupLastBackup, backupLastBackupText, BACKUP_LAST_KEY, BACKUP_LARGE_BYTES, sitePhotoStore } from './App.jsx';
import { idbSnapshot, lsSnapshot, rec, wipe, backupOf, seedSourceFull } from './test/backup-fixtures.js';

const MB = 1024 * 1024;
const blobOf = n => new Blob([new Uint8Array(n)], { type: 'application/zip' });
const fakeDownload = () => { const clicks = [], revoked = [], appended = []; const doc = { createElement: () => { const a = { click() { clicks.push({ href: a.href, download: a.download }); } }; return a; }, body: { appendChild: a => appended.push(a), removeChild() {} } }; const urlApi = { createObjectURL: b => 'blob:fake/' + b.size, revokeObjectURL: u => revoked.push(u) }; return { doc, urlApi, clicks, revoked, appended }; };
const shareNav = (over = {}) => { const shared = []; const nav = { canShare: () => true, share: async d => { shared.push(d); }, ...over }; return { nav, shared }; };
const recordKeysWritten = () => { const keys = []; const set = Storage.prototype.setItem; vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) { keys.push(k); return set.call(this, k, v); }); return keys; };
beforeEach(wipe);
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('backupMeasure: the size of a backup, before it is built', () => {
  it('is exact for the records and the text, one record at a time; "without photos" leaves the photo stores out but keeps the logos', async () => {
    await wipe(); await seedSourceFull();
    const full = await backupMeasure(); expect(full.photoBytes).toBe(3 + 1 + 2 + 3 + 4 + 2 + 2 + 1); expect(full.records).toBe(8);          // p1, p1~t, p2, unused, g1, g1~t, global logo, site logo
    const noPhotos = await backupMeasure({ includePhotos: false }); expect(noPhotos.photoBytes).toBe(2 + 1); expect(noPhotos.records).toBe(2);
    const built = await backupBuild(); expect(full.dataBytes).toBe(built.manifest.localStorage.size);                                  // the same text the file will hold
  });
  it('the estimate matches a real archive within 3 % (many photos), and never claims less than the data + photos', async () => {
    await wipe(); await seedSourceFull(); for (let i = 0; i < 120; i++) await sitePhotoStore.put('bulk' + i, { buf: new Uint8Array(50 * 1024).buffer, type: 'image/jpeg' });
    const m = await backupMeasure(); const built = await backupBuild(); const actual = built.blob.size;
    expect(m.estimatedBytes).toBeGreaterThanOrEqual(m.dataBytes + m.photoBytes); expect(Math.abs(m.estimatedBytes - actual) / actual).toBeLessThan(0.03);
  });
  it('is read-only: nothing written, no database created', async () => {
    await seedSourceFull(); const ls = lsSnapshot(), idb = await idbSnapshot(), dbs = (await indexedDB.databases()).map(d => d.name).sort();
    await backupMeasure(); expect(lsSnapshot()).toEqual(ls); expect(await idbSnapshot()).toEqual(idb); expect((await indexedDB.databases()).map(d => d.name).sort()).toEqual(dbs);
    await wipe(); const dbsFn = indexedDB.databases; const open = vi.spyOn(indexedDB, 'open'); indexedDB.databases = async () => [];
    try { const m = await backupMeasure(); expect(m.records).toBe(0); expect(open).not.toHaveBeenCalled(); } finally { indexedDB.databases = dbsFn; }
  });
});

describe('backupLargeWarning', () => {
  it('is silent below 100 MB and speaks at 100 MB and above, naming the size and offering the version without photos', () => {
    expect(BACKUP_LARGE_BYTES).toBe(100 * MB); expect(backupLargeWarning(99.9 * MB)).toBe(''); expect(backupLargeWarning(0)).toBe(''); expect(backupLargeWarning(undefined)).toBe('');
    const w = backupLargeWarning(100 * MB); expect(w).toMatch(/^This backup will be about 100 MB\./); expect(w).toContain('can fail to share from an iPhone'); expect(w).toContain('without photos'); expect(w).toContain('every site, result, History snapshot and calendar event is still included');
    expect(backupLargeWarning(250.4 * MB)).toContain('about 250 MB');
  });
  it('when the backup is already without photos it does not offer that again', () => {
    const w = backupLargeWarning(120 * MB, { includesPhotos: false }); expect(w).toContain('about 120 MB'); expect(w).toContain('already without photos'); expect(w).not.toContain('You can make a smaller backup');
  });
});

describe('backupDeliver: the share sheet first, a download as the fallback', () => {
  const at = new Date(2026, 9, 5, 12, 0);
  it('shares THE FILE (name, zip type, the same bytes) through the share sheet; nothing is downloaded; Last backup is recorded', async () => {
    const blob = blobOf(1000); const { nav, shared } = shareNav(); const dl = fakeDownload();
    const r = await backupDeliver(blob, 'SparkCheck-backup-2026-10-05.zip', { now: at, nav, doc: dl.doc, urlApi: dl.urlApi });
    expect(r).toEqual({ ok: true, method: 'share', recorded: true }); expect(shared.length).toBe(1); expect(shared[0].title).toBe('SparkCheck backup');
    const f = shared[0].files[0]; expect(f.name).toBe('SparkCheck-backup-2026-10-05.zip'); expect(f.type).toBe('application/zip'); expect(f.size).toBe(1000); expect(dl.clicks).toEqual([]);
    expect(backupLastBackup()).toEqual({ v: 1, at: at.toISOString(), day: '2026-10-05', bytes: 1000, method: 'share', includesPhotos: true });
  });
  it('the sheet closed by the user (AbortError): reported as cancelled, NOT recorded, nothing downloaded', async () => {
    const { nav } = shareNav({ share: async () => { throw Object.assign(new Error('closed'), { name: 'AbortError' }); } }); const dl = fakeDownload();
    const r = await backupDeliver(blobOf(10), 'b.zip', { now: at, nav, doc: dl.doc, urlApi: dl.urlApi });
    expect(r).toMatchObject({ ok: false, cancelled: true }); expect(r.message).toMatch(/no backup was saved/); expect(dl.clicks).toEqual([]); expect(localStorage.getItem(BACKUP_LAST_KEY)).toBeNull(); expect(backupLastBackupText()).toBe('never');
  });
  it('no share support at all: a normal download (a link with the file name), the object URL released later; recorded as a download', async () => {
    const timers = []; vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, ms) => { timers.push([fn, ms]); return 0; });          // captured, not run: independent of any fake-timer setup
    const dl = fakeDownload(); const blob = blobOf(500);
    const r = await backupDeliver(blob, 'b.zip', { now: at, nav: {}, doc: dl.doc, urlApi: dl.urlApi, includesPhotos: false });
    expect(r).toEqual({ ok: true, method: 'download', recorded: true }); expect(dl.clicks).toEqual([{ href: 'blob:fake/500', download: 'b.zip' }]); expect(dl.revoked).toEqual([]);
    expect(timers.length).toBe(1); expect(timers[0][1]).toBe(120000); timers[0][0](); expect(dl.revoked).toEqual(['blob:fake/500']);     // the object URL is released 2 minutes later, not before
    expect(backupLastBackup()).toMatchObject({ method: 'download', includesPhotos: false, bytes: 500 });
  });
  it('the browser can share but not FILES (canShare false, or it throws): a download', async () => {
    for (const canShare of [() => false, () => { throw new TypeError('nope'); }, undefined]) {
      localStorage.clear(); const { nav, shared } = shareNav({ canShare }); const dl = fakeDownload();
      const r = await backupDeliver(blobOf(5), 'b.zip', { now: at, nav, doc: dl.doc, urlApi: dl.urlApi }); expect(r).toMatchObject({ ok: true, method: 'download' }); expect(shared).toEqual([]); expect(dl.clicks.length).toBe(1);
    }
  });
  it('sharing fails for another reason (e.g. the tap\'s permission expired): falls back to a download and says why', async () => {
    const { nav } = shareNav({ share: async () => { throw Object.assign(new Error('x'), { name: 'NotAllowedError' }); } }); const dl = fakeDownload();
    const r = await backupDeliver(blobOf(5), 'b.zip', { now: at, nav, doc: dl.doc, urlApi: dl.urlApi }); expect(r).toEqual({ ok: true, method: 'download', recorded: true, fallbackFrom: 'NotAllowedError' }); expect(dl.clicks.length).toBe(1);
  });
  it('both the share and the download fail: reported as an error, and NOTHING is recorded as saved', async () => {
    const { nav } = shareNav({ share: async () => { throw new Error('boom'); } }); const dl = fakeDownload(); dl.urlApi.createObjectURL = () => { throw new Error('no memory'); };
    const r = await backupDeliver(blobOf(5), 'b.zip', { now: at, nav, doc: dl.doc, urlApi: dl.urlApi }); expect(r).toMatchObject({ ok: false, error: true }); expect(r.message).toContain('no memory'); expect(r.message).toContain('Nothing was recorded as saved'); expect(localStorage.getItem(BACKUP_LAST_KEY)).toBeNull();
  });
  it('the file was handed over but the Last backup note could not be written (storage full): still a success, with recorded:false', async () => {
    const { nav } = shareNav(); const full = { setItem: () => { throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); }, getItem: () => null };
    expect(await backupDeliver(blobOf(5), 'b.zip', { now: at, nav, storage: full })).toEqual({ ok: true, method: 'share', recorded: false });
  });
  it('writes nothing but the one Last backup record: no other key, no IndexedDB call', async () => {
    await seedSourceFull(); const keys = recordKeysWritten(); const calls = []; for (const n of ['put', 'delete', 'clear', 'add']) { const o = IDBObjectStore.prototype[n]; vi.spyOn(IDBObjectStore.prototype, n).mockImplementation(function (...a) { calls.push(n); return o.apply(this, a); }); }
    const { nav } = shareNav(); await backupDeliver(blobOf(5), 'b.zip', { now: at, nav }); expect(keys).toEqual([BACKUP_LAST_KEY]); expect(calls).toEqual([]);
  });
  it('end to end: the file a real backup produces is what the share sheet receives, and it inspects clean', async () => {
    await seedSourceFull(); const built = await backupBuild({ now: at }); const { nav, shared } = shareNav();
    expect((await backupDeliver(built.blob, built.filename, { now: at, nav })).method).toBe('share'); const f = shared[0].files[0];
    expect(f.name).toBe('SparkCheck-backup-2026-10-05.zip'); const insp = await backupInspect(f); expect(insp.ok).toBe(true); expect(insp.summary.sites.rcd).toBe(1);
  });
});

describe('"Last backup": never / today / 1 day ago / N days ago, in whole LOCAL days', () => {
  const put = day => rawSetItem(BACKUP_LAST_KEY, JSON.stringify({ v: 1, at: day + 'T00:00:00.000Z', day, bytes: 1, method: 'share', includesPhotos: true }));
  it('never when there is no record, or the record is damaged / of another version / has a bad day', () => {
    expect(backupLastBackupText()).toBe('never');
    for (const bad of ['{broken', '"text"', JSON.stringify({ v: 2, at: 'x', day: '2026-10-05' }), JSON.stringify({ v: 1, at: 'x', day: 'yesterday' }), JSON.stringify({ v: 1, day: '2026-10-05' })]) { rawSetItem(BACKUP_LAST_KEY, bad); expect(backupLastBackupText()).toBe('never'); expect(backupLastBackup()).toBeNull(); }
  });
  it('counts whole local days between the day it was made and today', () => {
    put('2026-10-05'); const t = (d, h = 12, m = 0) => new Date(2026, 9, d, h, m);
    expect(backupLastBackupText(localStorage, t(5))).toBe('today'); expect(backupLastBackupText(localStorage, t(6))).toBe('1 day ago'); expect(backupLastBackupText(localStorage, t(7))).toBe('2 days ago'); expect(backupLastBackupText(localStorage, new Date(2026, 10, 5))).toBe('31 days ago');
    expect(backupLastBackupText(localStorage, t(4))).toBe('today');                                                  // the clock is before the record (device date moved back): never a negative
  });
  it('at 00:30 and 23:30 it is the LOCAL day that counts (a backup at 23:30 is 1 day ago at 00:30 the next day; one at 00:30 is today at 23:30)', async () => {
    const { nav } = shareNav();
    await backupDeliver(blobOf(5), 'b.zip', { now: new Date(2026, 9, 5, 23, 30), nav }); expect(backupLastBackup().day).toBe('2026-10-05');
    expect(backupLastBackupText(localStorage, new Date(2026, 9, 5, 23, 59))).toBe('today'); expect(backupLastBackupText(localStorage, new Date(2026, 9, 6, 0, 30))).toBe('1 day ago');
    await backupDeliver(blobOf(5), 'b.zip', { now: new Date(2026, 9, 5, 0, 30), nav }); expect(backupLastBackup().day).toBe('2026-10-05'); expect(backupLastBackupText(localStorage, new Date(2026, 9, 5, 23, 30))).toBe('today');
  });
  it('the record is NOT part of a backup (listed as excluded, absent from data.json) so a restore can never bring someone else\'s date back', async () => {
    await seedSourceFull(); put('2026-10-05'); const b = await backupBuild(); expect(b.manifest.notBackedUp.excludedKeys).toContain(BACKUP_LAST_KEY); expect(b.manifest.notBackedUp.unknownKeys).not.toContain(BACKUP_LAST_KEY);
    const file = await backupOf(() => { rawSetItem(BACKUP_LAST_KEY, JSON.stringify({ v: 1, at: 'x', day: '2026-10-05' })); }); const insp = await backupInspect(file); expect(insp.ok).toBe(true); expect(insp.summary.keys).toBe(0);
  });
});

// Photo storage migration, Stage 1: shared infrastructure only (sitePhotoStore/sitePhotoIO/siteStorePhotos/migrateSitePhotos/
// confirmPhotoMigrationVerified/expirePhotoMigrationBackupIfStale), tested here with mock module shapes — NOT wired into SWB,
// ELT or Welder's actual UI/export code yet (that's stages 2-4). Mirrors GSD's already-proven gsdPhotoStore pattern exactly:
// two IndexedDB records per photo (full + "~t" thumbnail), a swappable sitePhotoIO object so tests never touch a real canvas
// (jsdom has none), and the same {id, w, h} pointer shape GSD already uses.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  sitePhotoStore, sitePhotoIO, siteStorePhotos, migrateSitePhotos, confirmPhotoMigrationVerified, expirePhotoMigrationBackupIfStale,
} from './App.jsx';
// Deliberately hardcoded, NOT imported from App.jsx's SITE_PHOTO_BACKUP_MAX_AGE_DAYS — this is the plan's actual promised
// number (14 days), so a test built from the same constant it's checking could never catch that constant being changed.

beforeEach(() => { localStorage.clear(); });

const ab = n => new Uint8Array(Array.from({ length: n }, (_, i) => i % 256)).buffer;
// A real, tiny, valid base64 JPEG-ish data URL (content doesn't need to actually decode as an image — gsdDataUrlToRec just
// base64-decodes the payload after the comma; only the regex `data:<type>;base64,<payload>` shape matters for that step).
const dataUrl = (byte, len = 12) => `data:image/jpeg;base64,${btoa(String.fromCharCode(...Array.from({ length: len }, (_, i) => (byte + i) % 256)))}`;

describe('sitePhotoStore: basic CRUD, same shape as gsdPhotoStore', () => {
  it('put/get round-trips a record', async () => {
    await sitePhotoStore.put('p1', { buf: ab(5), type: 'image/jpeg' });
    const rec = await sitePhotoStore.get('p1');
    expect(rec.type).toBe('image/jpeg');
    expect(new Uint8Array(rec.buf)).toEqual(new Uint8Array(ab(5)));
  });
  it('del removes a record', async () => {
    await sitePhotoStore.put('p2', { buf: ab(3), type: 'image/jpeg' });
    await sitePhotoStore.del('p2');
    expect(await sitePhotoStore.get('p2')).toBeUndefined();
  });
  it('delPhoto removes both the full and thumbnail records', async () => {
    await sitePhotoStore.put('p3', { buf: ab(3), type: 'image/jpeg' });
    await sitePhotoStore.put('p3~t', { buf: ab(1), type: 'image/jpeg' });
    await sitePhotoStore.delPhoto({ id: 'p3' });
    expect(await sitePhotoStore.get('p3')).toBeUndefined();
    expect(await sitePhotoStore.get('p3~t')).toBeUndefined();
  });
  it('delItems frees every photo on every item shaped like GSD\'s ({photos:[...]})', async () => {
    await sitePhotoStore.put('a', {}); await sitePhotoStore.put('a~t', {});
    await sitePhotoStore.put('b', {}); await sitePhotoStore.put('b~t', {});
    await sitePhotoStore.delItems([{ photos: [{ id: 'a' }, { id: 'b' }] }]);
    expect(await sitePhotoStore.get('a')).toBeUndefined();
    expect(await sitePhotoStore.get('b')).toBeUndefined();
  });
  it('delPhotoList frees a bare photo array not wrapped in an owning record — SWB\'s board _photos shape', async () => {
    await sitePhotoStore.put('c', {}); await sitePhotoStore.put('c~t', {});
    await sitePhotoStore.delPhotoList([{ id: 'c' }]);
    expect(await sitePhotoStore.get('c')).toBeUndefined();
  });
});

describe('siteStorePhotos: resize + store, via the stubbable sitePhotoIO seam (jsdom has no real canvas)', () => {
  it('stores a full + thumbnail record per file and returns {id, w, h} pointers', async () => {
    const orig = sitePhotoIO.resize;
    sitePhotoIO.resize = async () => ({ full: { buf: ab(20), type: 'image/jpeg' }, thumb: { buf: ab(5), type: 'image/jpeg' }, w: 800, h: 600 });
    try {
      const out = await siteStorePhotos([{ name: 'a.jpg' }]);
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({ w: 800, h: 600 });
      expect(await sitePhotoStore.get(out[0].id)).toBeTruthy();
      expect(await sitePhotoStore.get(out[0].id + '~t')).toBeTruthy();
    } finally { sitePhotoIO.resize = orig; }
  });
});

describe('migrateSitePhotos: round trip, byte-identical', () => {
  it('moves inline {id,dataUrl} photos in results AND history into sitePhotoStore, byte-identical, as {id,w,h} pointers', async () => {
    const orig = { imageSize: sitePhotoIO.imageSize, thumbFromDataUrl: sitePhotoIO.thumbFromDataUrl };
    sitePhotoIO.imageSize = async () => ({ w: 1280, h: 960 });
    sitePhotoIO.thumbFromDataUrl = async url => url; // no real canvas in jsdom — the thumbnail is just the same bytes here
    try {
      const url1 = dataUrl(1), url2 = dataUrl(50);
      // `results` is keyed by project/site id (the shape welder-results-v1/elt-results-v1 actually have); a history snapshot's
      // own `.results` is already ONE site's results with no project-id wrapper (matching archiveAudit's real shape) — extract
      // is applied per-site either way, so it only ever sees the `{board1:{_photos:[...]}}` shape, never the outer site1 layer.
      const results = { site1: { board1: { _photos: [{ id: 'old1', dataUrl: url1 }] } } };
      const history = [{ id: 'h1', results: { board1: { _photos: [{ id: 'old2', dataUrl: url2 }] } } }];
      localStorage.setItem('mock-results-v1', JSON.stringify(results));
      localStorage.setItem('mock-history-v1', JSON.stringify(history));
      const extract = siteResults => Object.values(siteResults).map(b => b._photos || []);

      const out = await migrateSitePhotos('mock', 'mock-results-v1', 'mock-history-v1', extract);
      expect(out.migrated).toBe(true);
      expect(out.photoCount).toBe(2);

      const newResults = JSON.parse(localStorage.getItem('mock-results-v1'));
      const newHistory = JSON.parse(localStorage.getItem('mock-history-v1'));
      const p1 = newResults.site1.board1._photos[0];
      const p2 = newHistory[0].results.board1._photos[0];
      expect(p1).toMatchObject({ w: 1280, h: 960 }); expect(p1.dataUrl).toBeUndefined(); expect(p1.id).toBeTruthy();
      expect(p2).toMatchObject({ w: 1280, h: 960 }); expect(p2.dataUrl).toBeUndefined();

      // byte-identical: decode the ORIGINAL data URL's payload and compare to what's actually sitting in IndexedDB now
      const origBytes = Uint8Array.from(atob(url1.split(',')[1]), c => c.charCodeAt(0));
      const stored = await sitePhotoStore.get(p1.id);
      expect(new Uint8Array(stored.buf)).toEqual(origBytes);

      // the pre-migration backup keys exist, holding the ORIGINAL (inline) data untouched
      const backupResults = JSON.parse(localStorage.getItem('mock-results-preMigration-v1'));
      expect(backupResults.site1.board1._photos[0].dataUrl).toBe(url1);
      expect(localStorage.getItem('mock-photos-migrated-v1')).toBeTruthy();
    } finally { Object.assign(sitePhotoIO, orig); }
  });

  it('is idempotent: a second call is a no-op once the flag is set', async () => {
    const orig = { imageSize: sitePhotoIO.imageSize, thumbFromDataUrl: sitePhotoIO.thumbFromDataUrl };
    sitePhotoIO.imageSize = async () => ({ w: 10, h: 10 }); sitePhotoIO.thumbFromDataUrl = async u => u;
    try {
      const results = { site1: { board1: { _photos: [{ id: 'x', dataUrl: dataUrl(2) }] } } };
      localStorage.setItem('mock2-results-v1', JSON.stringify(results));
      localStorage.setItem('mock2-history-v1', JSON.stringify([]));
      const extract = siteResults => Object.values(siteResults).map(b => b._photos || []);
      await migrateSitePhotos('mock2', 'mock2-results-v1', 'mock2-history-v1', extract);
      const afterFirst = localStorage.getItem('mock2-results-v1');
      const out2 = await migrateSitePhotos('mock2', 'mock2-results-v1', 'mock2-history-v1', extract);
      expect(out2.skipped).toBe(true);
      expect(localStorage.getItem('mock2-results-v1')).toBe(afterFirst); // untouched by the second call
    } finally { Object.assign(sitePhotoIO, orig); }
  });

  it('drops a single corrupt/undecodable photo without aborting the rest of the migration', async () => {
    const orig = { imageSize: sitePhotoIO.imageSize, thumbFromDataUrl: sitePhotoIO.thumbFromDataUrl };
    sitePhotoIO.imageSize = async () => ({ w: 10, h: 10 }); sitePhotoIO.thumbFromDataUrl = async u => u;
    try {
      const good = dataUrl(7);
      const results = { site1: { board1: { _photos: [{ id: 'bad', dataUrl: 'not-a-data-url-at-all' }, { id: 'good', dataUrl: good }] } } };
      localStorage.setItem('mock3-results-v1', JSON.stringify(results));
      localStorage.setItem('mock3-history-v1', JSON.stringify([]));
      const extract = siteResults => Object.values(siteResults).map(b => b._photos || []);
      const out = await migrateSitePhotos('mock3', 'mock3-results-v1', 'mock3-history-v1', extract);
      expect(out.migrated).toBe(true);
      expect(out.photoCount).toBe(1); // only the good one counted
      const newResults = JSON.parse(localStorage.getItem('mock3-results-v1'));
      expect(newResults.site1.board1._photos).toHaveLength(1); // the corrupt one was dropped, not left dangling
      expect(newResults.site1.board1._photos[0].dataUrl).toBeUndefined();
    } finally { Object.assign(sitePhotoIO, orig); }
  });

  it('a storage-level failure (IndexedDB put rejects) rolls back everything written this run, does NOT set the flag, and leaves the original localStorage data untouched', async () => {
    const orig = { imageSize: sitePhotoIO.imageSize, thumbFromDataUrl: sitePhotoIO.thumbFromDataUrl };
    sitePhotoIO.imageSize = async () => ({ w: 10, h: 10 }); sitePhotoIO.thumbFromDataUrl = async u => u;
    const origPut = sitePhotoStore.put;
    const putIds = [];
    let calls = 0;
    sitePhotoStore.put = vi.fn(async (id, rec) => {
      calls++;
      if (calls === 3) throw new Error('IndexedDB full (simulated)'); // fail partway through the SECOND photo's pair of writes
      putIds.push(id);
      return origPut(id, rec);
    });
    try {
      const rawResults = { site1: { board1: { _photos: [{ id: 'x1', dataUrl: dataUrl(1) }, { id: 'x2', dataUrl: dataUrl(9) }] } } };
      const rawResultsJson = JSON.stringify(rawResults);
      localStorage.setItem('mock4-results-v1', rawResultsJson);
      localStorage.setItem('mock4-history-v1', JSON.stringify([]));
      const extract = siteResults => Object.values(siteResults).map(b => b._photos || []);

      const out = await migrateSitePhotos('mock4', 'mock4-results-v1', 'mock4-history-v1', extract);
      expect(out.failed).toBe(true);
      // original data completely untouched — still has the inline dataUrls, byte-for-byte the same JSON
      expect(localStorage.getItem('mock4-results-v1')).toBe(rawResultsJson);
      // the flag was never set
      expect(localStorage.getItem('mock4-photos-migrated-v1')).toBeFalsy();
      // no pre-migration backup was created (nothing succeeded)
      expect(localStorage.getItem('mock4-results-preMigration-v1')).toBeFalsy();
      // everything this run wrote to IndexedDB (the first photo's full+thumb, written before the 3rd call failed) was rolled back
      expect(putIds.length).toBe(2); // exactly the two calls that succeeded before the 3rd one threw
      for (const id of putIds) expect(await sitePhotoStore.get(id)).toBeUndefined();
    } finally { sitePhotoStore.put = origPut; Object.assign(sitePhotoIO, orig); }
  });
});

describe('backup-key retention: verified-trigger deletion and the 14-day fallback', () => {
  it('confirmPhotoMigrationVerified removes both pre-migration backup keys', () => {
    localStorage.setItem('mockb-results-preMigration-v1', '{}');
    localStorage.setItem('mockb-history-preMigration-v1', '[]');
    confirmPhotoMigrationVerified('mockb');
    expect(localStorage.getItem('mockb-results-preMigration-v1')).toBeNull();
    expect(localStorage.getItem('mockb-history-preMigration-v1')).toBeNull();
  });

  it('expirePhotoMigrationBackupIfStale does nothing when no migration flag exists', () => {
    localStorage.setItem('mockc-results-preMigration-v1', '{}');
    expirePhotoMigrationBackupIfStale('mockc');
    expect(localStorage.getItem('mockc-results-preMigration-v1')).toBe('{}'); // untouched
  });

  it('expirePhotoMigrationBackupIfStale does nothing before the 14-day bound', () => {
    const recent = new Date(Date.now() - 13 * 86400000).toISOString();
    localStorage.setItem('mockd-photos-migrated-v1', recent);
    localStorage.setItem('mockd-results-preMigration-v1', '{}');
    expirePhotoMigrationBackupIfStale('mockd');
    expect(localStorage.getItem('mockd-results-preMigration-v1')).toBe('{}'); // still there — not stale yet
  });

  it('expirePhotoMigrationBackupIfStale removes the backup once the 14-day bound is reached, regardless of the verified trigger ever firing', () => {
    const stale = new Date(Date.now() - 15 * 86400000).toISOString();
    localStorage.setItem('mocke-photos-migrated-v1', stale);
    localStorage.setItem('mocke-results-preMigration-v1', '{}');
    localStorage.setItem('mocke-history-preMigration-v1', '[]');
    expirePhotoMigrationBackupIfStale('mocke');
    expect(localStorage.getItem('mocke-results-preMigration-v1')).toBeNull();
    expect(localStorage.getItem('mocke-history-preMigration-v1')).toBeNull();
  });
});

// BACKUP CORE (Stage 1: build + inspect; nothing here writes to storage). FICTIONAL data.
// One plain zip (manifest.json + data.json + files/<store>/<n>.bin), written and read one entry at a time. Covered: the zip layer (valid, standard-compliant, damage detected), the key allow-list, a backup of
// all nine modules + both photo stores + both logo stores round-tripping through build -> inspect (data, photo bytes, thumbnails), photos optional, unknown keys ignored and listed, the envelope under a faked
// clock (deviceLocalDate is the LOCAL day, createdAtUtc is the UTC instant), and rejection of every kind of bad file with a clear message and NO change to storage.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import JSZip from 'jszip';
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, BACKUP_APP_VERSION, backupFilename, backupKeyAllowed, backupCollectLocalStorage, backupBuild, backupInspect, zipWriter, zipOpen, zipCrc32,
  sitePhotoStore, gsdPhotoStore, appLogoStore, siteLogoStore } from './App.jsx';
import { MODULES, liveStore, metaStore, histStore } from './test/item-dates-fixtures.js';

const DBS = [['sparkcheck-site-photos', 'photos'], ['sparkcheck-gsd-photos', 'photos'], ['sparkcheck-app-settings', 'logo'], ['sparkcheck-site-logos', 'logos']];
const withDb = (name, store, fn) => new Promise((res, rej) => { const rq = indexedDB.open(name, 1); rq.onupgradeneeded = () => rq.result.createObjectStore(store); rq.onsuccess = () => { const db = rq.result; const tx = db.transaction(store, 'readwrite'); const r = fn(tx.objectStore(store)); tx.oncomplete = () => { db.close(); res(r && r.result); }; tx.onerror = () => rej(tx.error); }; rq.onerror = () => rej(rq.error); });
const clearIdb = () => Promise.all(DBS.map(([n, s]) => withDb(n, s, st => st.clear())));
const idbSnapshot = async () => { const out = {}; for (const [n, s] of DBS) { const keys = await withDb(n, s, st => st.getAllKeys()); out[n] = {}; for (const k of keys) { const rec = await withDb(n, s, st => st.get(k)); out[n][k] = [rec.type, Array.from(new Uint8Array(rec.buf)).join(',')]; } } return out; };
const lsSnapshot = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; };
const bytes = (...n) => new Uint8Array(n).buffer;

async function seedAll() {
  MODULES.forEach(f => {
    rawSetItem(f.keys.p, JSON.stringify([f.project[0]])); rawSetItem(f.keys.r, JSON.stringify(liveStore(f))); rawSetItem(f.keys.m, JSON.stringify(metaStore(f))); rawSetItem(f.keys.h, JSON.stringify(histStore(f)));
    rawSetItem(`${f.mod}-audit-active-v1`, JSON.stringify({ v: 1, sites: { s1: {} } })); rawSetItem(`${f.mod}-dropdowns-v1`, JSON.stringify({ responsibility: ['A'], rectified: ['B'] }));
  });
  rawSetItem('rcd-mode-v6', '"push"'); rawSetItem('iel-cat-v2', '"estops"'); rawSetItem('tat-settings-v1', '{"a":1}'); rawSetItem('tat-freqs-v1', '["1","3"]'); rawSetItem('tat-names-v1', '["Drill"]'); rawSetItem('tat-defaults-v1', '{"freq":"3"}');
  rawSetItem('cal-events-v1', '[{"id":"e1"}]'); rawSetItem('app-settings-v1', '{"businessName":"Example Electrical Pty Ltd","abn":"98 765 432 109","licence":"EW123456","logoId":"logo"}');
  rawSetItem('elt-photos-migrated-v1', '"2026-09-29T00:00:00Z"'); rawSetItem('swb-results-preMigration-v1', '{"big":"copy"}');
  rawSetItem('some-other-app-key', 'x'); rawSetItem('welder-projects-v2-backup-old', '[]');                                    // not ours: ignored and listed
  await sitePhotoStore.put('p1', { buf: bytes(1, 2, 3), type: 'image/jpeg' }); await sitePhotoStore.put('p1~t', { buf: bytes(9), type: 'image/jpeg' }); await sitePhotoStore.put('p2', { buf: bytes(4, 5), type: 'image/png' });
  await gsdPhotoStore.put('g1', { buf: bytes(7, 7, 7, 7), type: 'image/jpeg' }); await gsdPhotoStore.put('g1~t', { buf: bytes(8, 8), type: 'image/jpeg' });
  await appLogoStore.put({ buf: bytes(10, 11), type: 'image/png' }); await siteLogoStore.put('swb', 's1', { buf: bytes(12), type: 'image/png' });
}
beforeEach(async () => { localStorage.clear(); await clearIdb(); });
afterEach(() => vi.useRealTimers());

describe('the zip layer', () => {
  const build = (entries) => { const w = zipWriter(new Date(2026, 9, 5, 12, 0, 0)); entries.forEach(([n, b]) => w.add(n, b)); return w.finish(); };
  it('is a STANDARD zip: a third-party reader opens it and reads every entry; ours reads it back; the CRC-32 is the standard one', async () => {
    const blob = build([['a.txt', new TextEncoder().encode('hello')], ['files/x/0.bin', new Uint8Array([0, 255, 1, 2, 3])]]);
    const z = await JSZip.loadAsync(await blob.arrayBuffer()); expect(Object.keys(z.files)).toEqual(['a.txt', 'files/x/0.bin']); expect(await z.file('a.txt').async('string')).toBe('hello'); expect(Array.from(await z.file('files/x/0.bin').async('uint8array'))).toEqual([0, 255, 1, 2, 3]);
    const mine = await zipOpen(blob); expect(mine.names()).toEqual(['a.txt', 'files/x/0.bin']); expect(Array.from(await mine.bytes('files/x/0.bin'))).toEqual([0, 255, 1, 2, 3]);
    expect(zipCrc32(new TextEncoder().encode('123456789'))).toBe(0xCBF43926);                                  // the well-known check value
  });
  it('rejects: not a zip, a damaged byte (checksum), a truncated file, a duplicate entry name, a compressed entry', async () => {
    await expect(zipOpen(new Blob([new Uint8Array(100)]))).rejects.toMatchObject({ code: 'zip' }); await expect(zipOpen(new Blob([]))).rejects.toMatchObject({ code: 'zip' });
    const blob = build([['a.bin', new Uint8Array(50).fill(7)]]); const raw = new Uint8Array(await blob.arrayBuffer()); raw[30 + 5 + 10] ^= 0xFF;     // inside the entry data
    await expect((await zipOpen(new Blob([raw]))).bytes('a.bin')).rejects.toMatchObject({ code: 'zip' });
    await expect(zipOpen(blob.slice(0, blob.size - 5))).rejects.toMatchObject({ code: 'zip' });
    expect(() => build([['a', new Uint8Array(1)], ['a', new Uint8Array(1)]])).toThrow(/duplicate/);
    const deflated = await new JSZip().file('a.txt', 'hello hello hello hello').generateAsync({ type: 'uint8array', compression: 'DEFLATE' }); await expect(zipOpen(new Blob([deflated])).then(z => z.names())).rejects.toMatchObject({ code: 'zip' });
  });
});

describe('the key allow-list', () => {
  it('accepts the keys this app owns and nothing else; the temporary preMigration copies are excluded and listed', () => {
    ['rcd-projects-v6', 'rcd-results-v6', 'rcd-meta-v6', 'rcd-history-v6', 'rcd-dropdowns-v6', 'rcd-audit-active-v1', 'rcd-mode-v6', 'iel-cat-v2', 'gsd-items-v1', 'tat-defaults-v1', 'tat-settings-v1', 'tat-freqs-v1', 'tat-names-v1', 'tat-dropdowns-v1',
      'cal-events-v1', 'app-settings-v1', 'elt-projects-v1', 'elt-projects-v2', 'welder-history-v2', 'swb-photos-migrated-v1', 'thermo-meta-v1', 'irt-results-v1'].forEach(k => expect(backupKeyAllowed(k), k).toBe(true));
    ['swb-results-preMigration-v1', 'some-other-app-key', 'rcd-projects', 'rcd-projects-v6-copy', 'xyz-results-v1', '__proto__', 'rcd-mode-vx', ''].forEach(k => expect(backupKeyAllowed(k), k).toBe(false));
    rawSetItem('swb-results-preMigration-v1', '1'); rawSetItem('other', '2'); rawSetItem('rcd-meta-v6', '{}');
    expect(backupCollectLocalStorage()).toEqual({ entries: { 'rcd-meta-v6': '{}' }, unknown: ['other'], excluded: ['swb-results-preMigration-v1'] });
  });
});

describe('a backup of all nine modules, both photo stores and both logo stores', () => {
  it('builds, is a valid zip, and inspects clean: counts, sites per module, nothing changed in storage; keys that are not ours stay OUT of the file and are listed in the manifest', async () => {
    await seedAll(); const before = [lsSnapshot(), await idbSnapshot()];
    const { blob, filename, manifest } = await backupBuild(); expect(blob.type).toBe('application/zip');
    expect([lsSnapshot(), await idbSnapshot()]).toEqual(before);                                                // building only READS
    const r = await backupInspect(blob); expect(r.ok, r.message).toBe(true);
    expect(r.summary).toMatchObject({ formatVersion: 1, includesPhotos: true, photos: 3, logos: 2, records: 7, unknownKeys: [], sites: { rcd: 1, iel: 1, tat: 1, thermo: 1, swb: 1, irt: 1, elt: 1, welder: 1, gsd: 1 }, fileBytes: blob.size });
    expect(manifest.notBackedUp).toEqual({ unknownKeys: ['some-other-app-key', 'welder-projects-v2-backup-old'], excludedKeys: ['swb-results-preMigration-v1'] });
    expect(filename).toMatch(/^SparkCheck-backup-\d{4}-\d{2}-\d{2}\.zip$/);
    expect([lsSnapshot(), await idbSnapshot()]).toEqual(before);                                                // and inspecting changes nothing either
  });
  it('the data and every photo / thumbnail / logo byte round-trip exactly (read back entry by entry)', async () => {
    await seedAll(); const { blob, manifest } = await backupBuild(); const z = await zipOpen(blob); const data = JSON.parse(new TextDecoder().decode(await z.bytes('data.json')));
    const expected = backupCollectLocalStorage().entries; expect(data).toEqual(expected); expect(Object.keys(data)).toHaveLength(MODULES.length * 6 + 6 + 2 + 1);   // nine modules x 6 keys + 6 TAT / mode / category keys + calendar + settings + one migration flag; no unknown, no preMigration key
    expect(Object.keys(data)).not.toContain('swb-results-preMigration-v1'); expect(Object.keys(data)).not.toContain('some-other-app-key');
    const got = {}; for (const [id, list] of Object.entries(manifest.stores)) for (const r of list) got[id + ':' + r.key] = [r.type, Array.from(await z.bytes(r.file)).join(',')];
    expect(got).toEqual({ 'site-photos:p1': ['image/jpeg', '1,2,3'], 'site-photos:p1~t': ['image/jpeg', '9'], 'site-photos:p2': ['image/png', '4,5'], 'gsd-photos:g1': ['image/jpeg', '7,7,7,7'], 'gsd-photos:g1~t': ['image/jpeg', '8,8'], 'app-logo:logo': ['image/png', '10,11'], 'site-logos:swb:s1': ['image/png', '12'] });
  });
  it('photos are optional: without them the photo stores are empty, the logos and all data are still in', async () => {
    await seedAll(); const { blob, manifest } = await backupBuild({ includePhotos: false }); const r = await backupInspect(blob);
    expect(r.ok).toBe(true); expect(r.summary).toMatchObject({ includesPhotos: false, photos: 0, logos: 2 }); expect(manifest.stores['site-photos']).toEqual([]); expect(manifest.stores['gsd-photos']).toEqual([]); expect(Object.keys(manifest.stores['site-logos'])).toHaveLength(1);
  });
  it('an empty app still makes a valid, tiny backup', async () => { const { blob } = await backupBuild(); const r = await backupInspect(blob); expect(r.ok).toBe(true); expect(r.summary).toMatchObject({ keys: 0, photos: 0, logos: 0 }); expect(blob.size).toBeLessThan(3000); });
});

describe('the envelope', () => {
  it('formatVersion, appVersion (the build id), createdAtUtc = the UTC instant, deviceLocalDate = the LOCAL day (not the UTC day), utcOffsetMinutes, and the file name uses the local day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); const now = new Date(2026, 9, 5, 0, 30, 0); vi.setSystemTime(now);                    // 00:30 local on 5 Oct, in whatever zone the run uses
    const { manifest, filename } = await backupBuild({ now });
    expect(manifest).toMatchObject({ format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION, appVersion: BACKUP_APP_VERSION, createdAtUtc: now.toISOString(), deviceLocalDate: '2026-10-05', utcOffsetMinutes: -now.getTimezoneOffset() });
    expect(filename).toBe('SparkCheck-backup-2026-10-05.zip'); expect(backupFilename(new Date(2026, 9, 5, 23, 30, 0))).toBe('SparkCheck-backup-2026-10-05.zip');
    expect(BACKUP_APP_VERSION).toMatch(/^[0-9a-f]{7}$|^dev$/);
  });
});

describe('rejection: every bad file is refused with a clear message and storage is untouched', () => {
  let snap;
  const rebuild = async (mutate) => {                                                                                       // a good archive, then rebuilt entry by entry with one change
    await seedAll(); const { blob } = await backupBuild(); const z = await zipOpen(blob); const w = zipWriter(new Date(2026, 9, 5)); const m = JSON.parse(new TextDecoder().decode(await z.bytes('manifest.json')));
    const files = {}; for (const n of z.names()) files[n] = await z.bytes(n); const out = mutate({ manifest: m, files }) || { manifest: m, files };
    for (const [n, b] of Object.entries(out.files)) if (n !== 'manifest.json') w.add(n, b); w.add('manifest.json', new TextEncoder().encode(JSON.stringify(out.manifest))); return w.finish();
  };
  beforeEach(async () => { snap = null; });
  const refused = async (blob, code, re) => { const before = [lsSnapshot(), await idbSnapshot()]; const r = await backupInspect(blob); expect(r.ok).toBe(false); expect(r.code).toBe(code); expect(r.message).toMatch(re); expect(typeof r.message).toBe('string'); expect([lsSnapshot(), await idbSnapshot()]).toEqual(before); };
  it('not a backup: random bytes, an empty file, a text file, a zip with no manifest, a truncated backup', async () => {
    await refused(new Blob([new Uint8Array(500).fill(65)]), 'not-a-backup', /not a SparkCheck backup/); await refused(new Blob([]), 'not-a-backup', /not a SparkCheck backup/); await refused(new Blob(['{"hello":1}']), 'not-a-backup', /not a SparkCheck backup/);
    await refused(await new JSZip().file('x.txt', 'hi').generateAsync({ type: 'blob', compression: 'STORE' }), 'not-a-backup', /no manifest/);
    await seedAll(); const { blob } = await backupBuild(); await refused(blob.slice(0, blob.size - 40), 'not-a-backup', /not a SparkCheck backup/);
  });
  it('wrong format name, a newer format (says to update the app), a missing / invalid version, an incomplete manifest', async () => {
    await refused(await rebuild(({ manifest, files }) => ({ manifest: { ...manifest, format: 'other-app-backup' }, files })), 'wrong-format', /not a SparkCheck backup/);
    await refused(await rebuild(({ manifest, files }) => ({ manifest: { ...manifest, formatVersion: 2 }, files })), 'newer-version', /newer version of SparkCheck.*Update the app/);
    for (const v of [0, '1', null, 1.5]) await refused(await rebuild(({ manifest, files }) => ({ manifest: { ...manifest, formatVersion: v }, files })), 'invalid', /format version/);
    await refused(await rebuild(({ manifest, files }) => { const m = { ...manifest }; delete m.localStorage; return { manifest: m, files }; }), 'invalid', /incomplete/);
  });
  it('damaged content: the data or a photo changed (checksum), a listed entry missing, a duplicate listing, a wrong size', async () => {
    await refused(await rebuild(({ manifest, files }) => { files['data.json'] = new TextEncoder().encode(JSON.stringify({ 'rcd-meta-v6': '{}' })); return { manifest, files }; }), 'damaged', /data does not match/);
    await refused(await rebuild(({ manifest, files }) => { const f = manifest.stores['site-photos'][0].file; files[f] = new Uint8Array(files[f].length).fill(1); return { manifest, files }; }), 'damaged', /does not match its checksum/);
    await refused(await rebuild(({ manifest, files }) => { delete files[manifest.stores['gsd-photos'][0].file]; return { manifest, files }; }), 'damaged', /missing/);
    await refused(await rebuild(({ manifest, files }) => { manifest.stores['site-photos'][1] = { ...manifest.stores['site-photos'][0] }; return { manifest, files }; }), 'invalid', /twice/);
    await refused(await rebuild(({ manifest, files }) => { manifest.stores['site-photos'][0].size += 1; return { manifest, files }; }), 'damaged', /checksum|damaged/);
  });
  it('malformed data: a value that is not text, a value that is not JSON; an unknown key is NOT an error (ignored and listed)', async () => {
    const sha = async b => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b)), x => x.toString(16).padStart(2, '0')).join('');
    const mk = async (obj) => { await seedAll(); const { blob } = await backupBuild(); const z = await zipOpen(blob); const w = zipWriter(new Date(2026, 9, 5)); const m = JSON.parse(new TextDecoder().decode(await z.bytes('manifest.json'))); const b = new TextEncoder().encode(JSON.stringify(obj)); m.localStorage = { ...m.localStorage, size: b.length, sha256: await sha(b) }; for (const n of z.names()) if (n !== 'manifest.json') w.add(n, n === 'data.json' ? b : await z.bytes(n)); w.add('manifest.json', new TextEncoder().encode(JSON.stringify(m))); return w.finish(); };
    await refused(await mk({ 'rcd-meta-v6': 5 }), 'invalid', /not text/); await refused(await mk({ 'rcd-meta-v6': '{not json' }), 'invalid', /damaged data for rcd-meta-v6/); await refused(await mk([1, 2]), 'invalid', /expected shape/);
    const ok = await backupInspect(await mk({ 'rcd-meta-v6': '{}', 'stranger-key': 'x' })); expect(ok.ok).toBe(true); expect(ok.summary.unknownKeys).toEqual(['stranger-key']); expect(ok.summary.keys).toBe(1);
  });
});

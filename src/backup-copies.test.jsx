// BACKUP / RESTORE, RELEASE O: a backup site whose ID is already on the phone but whose content DIFFERS is added as a separate COPY (FICTIONAL data). Look-alike sites; every photo's and logo's bytes are tagged with the
// number of the site they belong to, so a photo that lands on the wrong copy fails. Every module, engine level (the real screens are in backup-copies-screens.test.jsx).
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { backupBuild, backupRestore, backupUndo, siteLogoStore, sitePhotoStore, gsdPhotoStore, BACKUP_COPIES_KEY, backupCopyName, backupDayText, backupPointerIds } from './App.jsx';
import { MODULES } from './test/item-dates-fixtures.js';
import { wipe, lsSnapshot, idbSnapshot, patchKey } from './test/backup-fixtures.js';
import { SITES, PH, photoIdsOf, tagBytes, snapIdOf, seedLookAlike, diverge, removeSite } from './test/backup-copies-fixtures.js';

const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
const BACKUP_DAY = new Date(2026, 9, 5, 12, 0), RESTORE_DAY = new Date(2026, 9, 12, 12, 0);
const NAME_A = 'Plant Room A (backup 5 Oct 2026)', NAME_B = 'Plant Room B (backup 5 Oct 2026)';
beforeEach(wipe);
const read = k => JSON.parse(localStorage.getItem(k));
const names = f => read(f.keys.p).map(p => p.name);
// the phone before the restore: some weeks of work after the backup (pra renamed, prb has more results, pra2 untouched, pre deleted, prc new)
async function scenario(f) {
  await wipe(); await seedLookAlike(f, SITES); const { blob } = await backupBuild({ now: BACKUP_DAY });
  diverge(f); await removeSite(f, 'pre'); await seedLookAlike(f, [{ id: 'prc', name: 'Plant Room C', no: 5 }]);
  return blob;
}
// pure insertion: every old byte stays where it was (the new text goes before the closer)
const insertedOnly = (before, after) => before === after || (typeof after === 'string' && after.length > before.length && after.startsWith(before.slice(0, -1)) && after.endsWith(before.slice(-1)));
const stores = { 'site-photos': sitePhotoStore, 'gsd-photos': gsdPhotoStore };
async function idbBytes(storeId, key) { const r = await stores[storeId].get(key); return r ? Array.from(new Uint8Array(r.buf)) : null; }
const bytesOf = r => Array.from(new Uint8Array(r.buf));
function patchResults(f, id, tag) { const R = read(f.keys.r); const r = R[id]; if (Array.isArray(r)) r.push({ id: 'g-' + tag, areaId: 'a1', assetLocation: tag, category: 'Guarding', commonDefect: '', description: tag, descAuto: '', photos: [], priority: 'H', responsibility: '', dueDate: '' }); else r['extra-' + tag] = { note: tag }; rawSetItem(f.keys.r, JSON.stringify(R)); }
function renameSite(f, id, name) { const v = read(f.keys.p); v.find(p => p.id === id).name = name; rawSetItem(f.keys.p, JSON.stringify(v)); }
async function pointersOf(mod, f, id) { const R = read(f.keys.r), H = read(f.keys.h).filter(h => h.projectId === id); return backupPointerIds(mod, { results: R[id], snaps: H }); }

describe.each(MODULES.map(f => [f.mod, f]))('%s: copies of changed sites', (mod, f) => {
  it('adds a copy of each changed site (pra renamed, prb with more results), skips the identical one (pra2), adds the deleted one (pre) as today, and never writes into a site on the phone', async () => {
    const blob = await scenario(f); const before = lsSnapshot(), beforeIdb = await idbSnapshot();
    const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY }); expect(r.ok, r.message).toBe(true);
    expect(r.summary.copiesAdded, 'two copies').toBe(2); expect(r.summary.sitesAdded, 'the deleted one comes back as it always did').toBe(1);
    expect(r.summary.copyNames.slice().sort()).toEqual([NAME_A, NAME_B]);
    const list = read(f.keys.p), byName = n => list.find(p => p.name === n);
    expect(list.map(p => p.name).sort()).toEqual([NAME_A, 'Plant Room A (renamed)', 'Plant Room A2', 'Plant Room A (east)', 'Plant Room B', NAME_B, 'Plant Room C'].sort());
    const after = lsSnapshot();
    for (const k of Object.keys(before)) { if (/-audit-active-v1$/.test(k)) { const bs = JSON.parse(before[k]).sites, as = JSON.parse(after[k]).sites; for (const id of Object.keys(bs)) expect(as[id], k + ' ' + id).toEqual(bs[id]); } else expect(insertedOnly(before[k], after[k]), k + ' only gained text').toBe(true); }      // the phone's own sites are byte for byte as they were
    const afterIdb = await idbSnapshot(); for (const db of Object.keys(beforeIdb)) for (const k of Object.keys(beforeIdb[db])) expect(afterIdb[db][k], db + ' ' + k).toEqual(beforeIdb[db][k]);
    const ca = byName(NAME_A), cb = byName(NAME_B);
    for (const c of [ca, cb]) { expect(SITES.map(s => s.id).concat(['prc'])).not.toContain(c.id); expect(c.id).toMatch(/^plant-room-[ab]-backup-/); }
    const R = read(f.keys.r), M = read(f.keys.m), H = read(f.keys.h), histOf = id => H.filter(h => h.projectId === id);
    expect(Object.keys(R)).toContain(ca.id); expect(Object.keys(M)).toContain(ca.id);
    expect(histOf(ca.id).length).toBe(1); expect(histOf(cb.id).length).toBe(1); expect(histOf('pra').length, 'pra keeps its own History').toBe(1);
    const oldSnap = snapIdOf(SITES[0]); expect(histOf(ca.id)[0].id).not.toBe(oldSnap); expect(H.filter(h => h.id === oldSnap).length, 'the old snapshot id is used once').toBe(1);
    const mine = JSON.stringify([ca, R[ca.id], M[ca.id], histOf(ca.id)]); for (const old of ['"pra"', oldSnap, 'pra-L', 'pra-H']) expect(mine, 'the copy points at nothing of the site it came from: ' + old).not.toContain(old);
    expect(JSON.stringify(R.prb) !== JSON.stringify(R[cb.id]), 'the copy of prb is the BACKUP version (without the later results)').toBe(true);
    expect(JSON.stringify(R[cb.id])).not.toContain('added later');
  });
  it('every photo and the site logo of a copy are the backup\'s own photo for THAT site (bytes tagged by site), under new ids; the phone\'s own photos are untouched', async () => {
    if (!PH[mod]) return; const blob = await scenario(f); const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY }); expect(r.ok, r.message).toBe(true);
    const list = read(f.keys.p), ph = PH[mod], seen = new Set();
    for (const [no, nm] of [[1, NAME_A], [2, NAME_B]]) {
      const c = list.find(p => p.name === nm), ptrs = await pointersOf(mod, f, c.id); expect(ptrs.length, 'two live + one History photo').toBe(3);
      for (let i = 0; i < ptrs.length; i++) {
        const id = ptrs[i]; expect(id).not.toMatch(/^pr[a-z0-9]*-[LH]\d$/); expect(seen.has(id), 'no photo is shared by two copies').toBe(false); seen.add(id);
        expect(await idbBytes(ph.id, id), id + ' full').toEqual(bytesOf(tagBytes(no, 1, i + 1))); expect(await idbBytes(ph.id, id + '~t'), id + ' thumb').toEqual(bytesOf(tagBytes(no, 2, i + 1)));
      }
      expect(bytesOf(await siteLogoStore.get(mod, c.id)), 'site logo of the copy').toEqual(bytesOf(tagBytes(no, 3, 0)));
    }
    for (const s of SITES.slice(0, 3)) { const pi = photoIdsOf(s), all = [...pi.live, ...pi.hist]; for (let i = 0; i < all.length; i++) expect(await idbBytes(ph.id, all[i]), 'phone photo ' + all[i]).toEqual(bytesOf(tagBytes(s.no, 1, i + 1))); }
  });
  it('Undo takes exactly the copies away: every key and record is as it was before the restore, the copies note included', async () => {
    const blob = await scenario(f); const before = lsSnapshot(), beforeIdb = await idbSnapshot();
    const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY }); expect(r.ok, r.message).toBe(true); expect(localStorage.getItem(BACKUP_COPIES_KEY)).not.toBeNull();
    const u = await backupUndo({ storage: S, now: RESTORE_DAY }); expect(u.ok, u.message).toBe(true); expect(u.copies).toBe(2); expect(u.keptCopies).toBe(0);
    expect(lsSnapshot()).toEqual(before); expect(await idbSnapshot()).toEqual(beforeIdb);
  });
  it('the same backup restored again adds nothing more (the note remembers its copies)', async () => {
    const blob = await scenario(f); expect((await backupRestore(blob, { storage: S, now: RESTORE_DAY })).ok).toBe(true);
    const mid = lsSnapshot(), midIdb = await idbSnapshot(); const again = await backupRestore(blob, { storage: S, now: RESTORE_DAY });
    expect(again.ok, 'nothing to add').toBe(false); expect(again.code).toBe('nothing'); expect(lsSnapshot()).toEqual(mid); expect(await idbSnapshot()).toEqual(midIdb); expect(names(f).length).toBe(7);
  });
  it('a copy the person deleted is added again by the same backup; a copy that was renamed still counts as the copy (no second one)', async () => {
    const blob = await scenario(f); await backupRestore(blob, { storage: S, now: RESTORE_DAY });
    const cA = read(f.keys.p).find(p => p.name === NAME_A); await removeSite(f, cA.id);
    const r2 = await backupRestore(blob, { storage: S, now: RESTORE_DAY }); expect(r2.ok, r2.message).toBe(true); expect(r2.summary.copiesAdded).toBe(1); expect(names(f).filter(n => n === NAME_A).length).toBe(1);
    const cB = read(f.keys.p).find(p => p.name === NAME_B); renameSite(f, cB.id, 'My own name');
    const r3 = await backupRestore(blob, { storage: S, now: RESTORE_DAY }); expect(r3.ok, 'a renamed copy is still the copy').toBe(false); expect(r3.code).toBe('nothing');
  });
  it('a second, different backup gets its own copy named with ITS date; the first backup\'s copies stay', async () => {
    const blob = await scenario(f); await backupRestore(blob, { storage: S, now: RESTORE_DAY });
    const second = (await backupBuild({ now: new Date(2026, 9, 8, 12, 0) })).blob; renameSite(f, 'pra', 'Plant Room A (later)'); patchResults(f, 'prb', 'later');
    const r = await backupRestore(second, { storage: S, now: RESTORE_DAY }); expect(r.ok, r.message).toBe(true); expect(r.summary.copiesAdded).toBe(2);
    const nm = names(f); expect(nm).toContain('Plant Room A (renamed) (backup 8 Oct 2026)'); expect(nm).toContain('Plant Room B (backup 8 Oct 2026)'); expect(nm).toContain(NAME_A); expect(nm).toContain(NAME_B);
    const again = await backupRestore(second, { storage: S, now: RESTORE_DAY }); expect(again.ok).toBe(false); expect(again.code).toBe('nothing');
  });
  it('a copy the person worked in after the restore is KEPT by Undo (and counted); an untouched one is removed', async () => {
    const blob = await scenario(f); await backupRestore(blob, { storage: S, now: RESTORE_DAY });
    const cB = read(f.keys.p).find(p => p.name === NAME_B); patchResults(f, cB.id, 'worked');
    const u = await backupUndo({ storage: S, now: RESTORE_DAY }); expect(u.ok, u.message).toBe(true); expect(u.copies).toBe(1); expect(u.keptCopies).toBe(1);
    expect(names(f)).toContain(NAME_B); expect(names(f)).not.toContain(NAME_A);
    expect(Object.keys(read(BACKUP_COPIES_KEY))).toEqual([mod + ':' + cB.id]);
    expect(read(f.keys.h).filter(h => h.projectId === cB.id).length, 'its History stays with it').toBe(1);
    if (PH[mod]) for (const id of await pointersOf(mod, f, cB.id)) { expect(await idbBytes(PH[mod].id, id), 'a kept copy keeps its photo ' + id).not.toBeNull(); expect(await idbBytes(PH[mod].id, id + '~t')).not.toBeNull(); }
    expect(bytesOf(await siteLogoStore.get(mod, cB.id))).toEqual(bytesOf(tagBytes(2, 3, 0)));
  });
});
describe('names', () => {
  it('"<name> (backup 12 Oct 2026)", then " 2", " 3" when the name is taken (compared without case or edge spaces)', () => {
    expect(backupCopyName('Plant Room', '5 Oct 2026', new Set())).toBe('Plant Room (backup 5 Oct 2026)');
    expect(backupCopyName('Plant Room', '5 Oct 2026', new Set(['plant room (backup 5 oct 2026)']))).toBe('Plant Room (backup 5 Oct 2026) 2');
    expect(backupCopyName('Plant Room', '5 Oct 2026', new Set(['plant room (backup 5 oct 2026)', 'plant room (backup 5 oct 2026) 2']))).toBe('Plant Room (backup 5 Oct 2026) 3');
    const taken = new Set(); expect(backupCopyName(' Plant Room ', '5 Oct 2026', taken)).toBe(' Plant Room  (backup 5 Oct 2026)'); expect(taken.size).toBe(1);
  });
  it('the date is day (no leading zero), short English month name and year, with NO slash: every month, a two-digit day, and text that is not a date is left as it is', () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    months.forEach((m, i) => expect(backupDayText('2026-' + String(i + 1).padStart(2, '0') + '-' + (i === 11 ? '31' : '05'))).toBe((i === 11 ? '31' : '5') + ' ' + m + ' 2026'));
    expect(backupDayText('2026-10-12')).toBe('12 Oct 2026'); expect(backupDayText('2026-13-12')).toBe('2026-13-12'); expect(backupDayText('')).toBe(''); expect(backupDayText(undefined)).toBe('');
    for (let d = 1; d <= 12; d++) expect(backupDayText('2026-' + String(d).padStart(2, '0') + '-' + String(d).padStart(2, '0')), 'no slash in a name used for a file').not.toContain('/');
  });
});

describe.each(MODULES.map(f => [f.mod, f]))('%s: copies and the audit-in-progress flag', (mod, f) => {
  const activeKey = `${f.mod}-audit-active-v1`;
  it('a copy of a site that was MID-AUDIT is mid-audit (the flag is carried to the copy\'s new id); a copy of a site that was not is not; the phone\'s own flags are not touched', async () => {
    await wipe(); await seedLookAlike(f, SITES.slice(0, 2)); patchKey(activeKey, v => { v.sites.pra = { started: 'in the backup' }; delete v.sites.prb; });
    const { blob } = await backupBuild({ now: BACKUP_DAY });
    patchKey(f.keys.p, v => { v.forEach(p => { p.name += ' x'; }); }); const before = JSON.parse(localStorage.getItem(activeKey));
    const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY }); expect(r.ok, r.message).toBe(true); expect(r.summary.copiesAdded).toBe(2);
    const list = read(f.keys.p), copyA = list.find(p => p.name.startsWith('Plant Room A') && p.name.includes('(backup')), copyB = list.find(p => p.name.startsWith('Plant Room B') && p.name.includes('(backup')), sites = read(activeKey).sites;
    expect(sites[copyA.id], 'the copy of the mid-audit site is mid-audit, with the same flag').toEqual({ started: 'in the backup' }); expect(sites[copyB.id], 'the copy of a site that was not mid-audit is not').toBeUndefined();
    expect(sites.pra, 'the phone\'s own site: unchanged').toEqual(before.sites.pra); expect(Object.prototype.hasOwnProperty.call(sites, 'prb'), 'the phone\'s own site: still has no flag').toBe(false);
    const u = await backupUndo({ storage: S, now: RESTORE_DAY }); expect(u.ok, u.message).toBe(true); expect(read(activeKey)).toEqual(before);
  });
});

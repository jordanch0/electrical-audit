// BACKUP / RESTORE, RELEASE O: the rules behind "same" and "different", the safety checks that roll a restore back, id clashes, and old-format data (FICTIONAL data). Every module.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { backupBuild, backupRestore, backupPlan, backupSummaryText, siteLogoStore, sitePhotoStore, gsdPhotoStore, backupPointerIds, HOME_DATE_SPECS, BackupCrash, backupRecoverAtStart, backupFinishRecovery, backupVerifyCopies, zipOpen } from './App.jsx';
import { MODULES, HOME, clone } from './test/item-dates-fixtures.js';
import { wipe, lsSnapshot, idbSnapshot, seedModule, patchKey, rec } from './test/backup-fixtures.js';
import { SITES, PH, photoIdsOf, tagBytes, snapIdOf, seedLookAlike, diverge, removeSite } from './test/backup-copies-fixtures.js';

const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
const BACKUP_DAY = new Date(2026, 9, 5, 12, 0), RESTORE_DAY = new Date(2026, 9, 12, 12, 0);
beforeEach(wipe); afterEach(() => vi.restoreAllMocks());
const read = k => JSON.parse(localStorage.getItem(k));
const stores = { 'site-photos': sitePhotoStore, 'gsd-photos': gsdPhotoStore };
const bytesOf = r => Array.from(new Uint8Array(r.buf));
async function pointersOf(mod, f, id) { return backupPointerIds(mod, { results: read(f.keys.r)[id], snaps: read(f.keys.h).filter(h => h.projectId === id) }); }
const planOf = async blob => { const p = await backupPlan(blob, { storage: S }); expect(p.ok, p.message).toBe(true); return p; };
const modOf = (plan, m) => plan.modules.find(x => x.id === m);
async function twoPhones(f, one = [SITES[0]]) { await wipe(); await seedLookAlike(f, one); const { blob } = await backupBuild({ now: BACKUP_DAY }); return blob; }     // the phone IS the backup at this moment

describe.each(MODULES.map(f => [f.mod, f]))('%s: what counts as the same', (mod, f) => {
  it('identical content is "already on this phone", whatever the Home date follow did to the meta since (dateDay, test date, default next-due)', async () => {
    await wipe(); seedModule(f, { id: 'pra', name: 'Plant Room A', snapId: 'h-pra' }); { const R = read(f.keys.r), H = read(f.keys.h), M = read(f.keys.m); R.pra = clone(f.expLive); H[0] = { ...H[0], [f.snapField || 'results']: clone(f.expHist) }; M.pra = { ...M.pra, dateDay: '2026-10-01' }; rawSetItem(f.keys.r, JSON.stringify(R)); rawSetItem(f.keys.h, JSON.stringify(H)); rawSetItem(f.keys.m, JSON.stringify(M)); }
    const { blob } = await backupBuild({ now: BACKUP_DAY });          // a backup made by the current app: stamped items, dateDay
    patchKey(f.keys.m, v => { v.pra.dateDay = '2026-10-11'; for (const sp of HOME_DATE_SPECS[mod]) { v.pra[sp.test] = '2026-10-11'; if (sp.next) v.pra[sp.next] = '2027-10-11'; } });
    const plan = await planOf(blob); expect(modOf(plan, mod).sites.present.length).toBe(1); expect(plan.counts.sitesCopy).toBe(0); expect(plan.nothingToAdd).toBe(true);
  });
  it('anything else is a difference: a changed name, an added result, a changed note in meta, a missing History snapshot, an extra one', async () => {
    const cases = {
      name: () => patchKey(f.keys.p, v => { v[0].name += ' x'; }),
      result: () => patchKey(f.keys.r, v => { const r = v.pra; if (Array.isArray(r)) r[0].description = 'changed'; else r.extra = { note: 'x' }; }),
      meta: () => patchKey(f.keys.m, v => { v.pra.auditor = 'Someone Else'; }),
      noHistory: () => patchKey(f.keys.h, v => { v.splice(0, 1); }),
      moreHistory: () => patchKey(f.keys.h, v => { v.push({ ...v[0], id: 'h-extra' }); }),
    };
    for (const [why, change] of Object.entries(cases)) { const blob = await twoPhones(f); change(); const plan = await planOf(blob); expect(plan.counts.sitesCopy, why).toBe(1); expect(plan.counts.sitesPresent, why).toBe(0); }
  });
  it('a different site LOGO (same id) is a difference; so is a missing one', async () => {
    const blob = await twoPhones(f); await siteLogoStore.put(mod, 'pra', tagBytes(9, 3, 0)); expect((await planOf(blob)).counts.sitesCopy).toBe(1);
    await siteLogoStore.del(mod, 'pra'); expect((await planOf(blob)).counts.sitesCopy).toBe(1);
  });
  it('old-format data (made before item dates existed) compares as the same as that data after the app has stamped it: no false copy', async () => {
    await wipe(); seedModule(f, { id: 'pra', name: 'Plant Room A', snapId: 'h-pra' }); const { blob } = await backupBuild({ now: BACKUP_DAY });          // the backup holds the OLD format (the fixture)
    const R = read(f.keys.r), H = read(f.keys.h), M = read(f.keys.m); R.pra = clone(f.expLive); H[0] = { ...H[0], [f.snapField || 'results']: clone(f.expHist) }; M.pra = { ...M.pra, dateDay: '2026-10-01' };       // the phone holds it as the app stamped it
    rawSetItem(f.keys.r, JSON.stringify(R)); rawSetItem(f.keys.h, JSON.stringify(H)); rawSetItem(f.keys.m, JSON.stringify(M));
    const plan = await planOf(blob); expect(plan.counts.sitesCopy, 'no copy').toBe(0); expect(plan.counts.sitesPresent).toBe(1);
  });
});

describe.each(MODULES.filter(f => PH[f.mod]).map(f => [f.mod, f]))('%s: photo bytes', (mod, f) => {
  const ph = PH[mod], pid = photoIdsOf(SITES[0]).live[0];
  it('the same photo id with DIFFERENT bytes is a difference; a different thumbnail too', async () => {
    const blob = await twoPhones(f); await stores[ph.id].put(pid, tagBytes(7, 1, 1)); expect((await planOf(blob)).counts.sitesCopy).toBe(1);
    await stores[ph.id].put(pid, tagBytes(1, 1, 1)); expect((await planOf(blob)).counts.sitesCopy, 'back to the same').toBe(0);
    await stores[ph.id].put(pid + '~t', tagBytes(7, 2, 1)); expect((await planOf(blob)).counts.sitesCopy).toBe(1);
  });
  it('a backup made WITHOUT photos is compared without them: the phone\'s photos do not make every site look different', async () => {
    await wipe(); await seedLookAlike(f, [SITES[0]]); const { blob } = await backupBuild({ now: BACKUP_DAY, includePhotos: false });
    expect((await planOf(blob)).counts.sitesCopy).toBe(0); patchKey(f.keys.p, v => { v[0].name += ' x'; });
    const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY }); expect(r.ok, r.message).toBe(true); expect(r.summary.copiesAdded).toBe(1);
    const c = read(f.keys.p).find(p => p.name.includes('(backup')); const R = read(f.keys.r)[c.id], text = JSON.stringify(R);
    expect(text, 'the copy does not point at the phone\'s photo records').not.toContain('pra-L'); const keys = (await idbSnapshot())[ph.id === 'gsd-photos' ? 'sparkcheck-gsd-photos' : 'sparkcheck-site-photos'];
    for (const m of text.matchAll(/"id":"([a-z0-9]+)"/g)) if (!['pra-L1'].includes(m[1]) && /^[a-z0-9]{1,7}$/.test(m[1])) expect(Object.keys(keys), 'no record exists under the copy\'s new photo id').not.toContain(m[1]);
  });
  it('a photo that appears in both the live results and a History snapshot gets ONE new id in the copy (consistent), and two copies never share a photo record', async () => {
    await wipe(); await seedLookAlike(f, SITES.slice(0, 2));
    patchKey(f.keys.h, v => { const h = v.find(x => x.projectId === 'pra'); ph.hist(f.mod === 'gsd' ? h.items : h.results, [pid]); });            // History points at the SAME photo as the live results
    patchKey(f.keys.h, v => { const h = v.find(x => x.projectId === 'prb'); ph.hist(f.mod === 'gsd' ? h.items : h.results, [pid]); });                // and the other site\'s History points at pra\'s photo too (a damaged file)
    const { blob } = await backupBuild({ now: BACKUP_DAY }); patchKey(f.keys.p, v => { v.forEach(p => { p.name += ' x'; }); });
    const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY }); expect(r.ok, r.message).toBe(true); expect(r.summary.copiesAdded).toBe(2);
    const L = read(f.keys.p).filter(p => p.name.includes('(backup')), ids = L.map(c => [...new Set(backupPointerIds(mod, { results: read(f.keys.r)[c.id], snaps: read(f.keys.h).filter(h => h.projectId === c.id) }))]);
    expect(ids[0].length, 'one photo id for the live and the History pointer, one more live photo').toBe(2); expect(ids[1].length, 'the other copy: its own two photos plus the one its History pointed at (a damaged file)').toBe(3);
    expect(ids[0].filter(x => ids[1].includes(x)), 'no photo id is in both copies').toEqual([]);
  });
});

// ── safety net: a mismatch after the writes rolls EVERYTHING back (the existing journal)
describe.each(MODULES.map(f => [f.mod, f]))('%s: a mismatch rolls the whole restore back', (mod, f) => {
  const tamper = { // each one breaks a different promise AFTER the writes and BEFORE the commit
    'a copy\'s History moved to the other copy': () => patchKey(f.keys.h, v => { const a = v.filter(h => /backup/.test(JSON.stringify(read(f.keys.p).find(p => p.id === h.projectId) || {}))); if (a.length >= 2) a[0].projectId = a[1].projectId; else throw new Error('setup'); }),
    'a copy loses its results': () => patchKey(f.keys.r, v => { const c = read(f.keys.p).find(p => /backup/.test(p.name)); delete v[c.id]; }),
    'a copy gets the wrong name': () => patchKey(f.keys.p, v => { v.find(p => /backup/.test(p.name)).name = 'Plant Room Z'; }),
    'a copy points at the site it was copied from': () => patchKey(f.keys.r, v => { const c = read(f.keys.p).find(p => /backup/.test(p.name)); const r = v[c.id]; if (Array.isArray(r)) r[0].description = 'pra'; else r.zz = { ref: 'pra' }; }),
    'a copy is written over an existing site': () => patchKey(f.keys.p, v => { v.find(p => p.id === 'prb').name = 'Overwritten'; }),
  };
  for (const [why, fn] of Object.entries(tamper)) it(why + ': the restore fails and the phone is exactly as it was', async () => {
    await wipe(); await seedLookAlike(f, SITES.slice(0, 2)); const { blob } = await backupBuild({ now: BACKUP_DAY }); patchKey(f.keys.p, v => { v.forEach(p => { p.name += ' x'; }); });
    const before = lsSnapshot(), beforeIdb = await idbSnapshot();
    const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY, crashAt: async stage => { if (stage === 'keys-done') fn(); } });
    expect(r.ok, 'refused').toBe(false); expect(r.code).toBe('failed');
    if (/written over/.test(why)) { expect(read(f.keys.p).some(p => /backup/.test(p.name)), 'every copy is gone again').toBe(false); expect(read(f.keys.p).find(p => p.id === 'prb').name, 'the foreign change stays, as the rollback rule says').toBe('Overwritten'); expect(await idbSnapshot()).toEqual(beforeIdb); return; }
    expect(lsSnapshot()).toEqual(before); expect(await idbSnapshot()).toEqual(beforeIdb);
  });
});
describe.each(MODULES.filter(f => PH[f.mod]).map(f => [f.mod, f]))('%s: a photo on the wrong copy rolls the restore back', (mod, f) => {
  it('swapping two copies\' photo bytes, or giving a copy a photo of another site, fails the check and puts everything back', async () => {
    for (const swap of ['swap', 'foreign']) {
      await wipe(); await seedLookAlike(f, SITES.slice(0, 2)); const { blob } = await backupBuild({ now: BACKUP_DAY }); patchKey(f.keys.p, v => { v.forEach(p => { p.name += ' x'; }); });
      const before = lsSnapshot(), beforeIdb = await idbSnapshot();
      const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY, crashAt: async stage => {
        if (stage !== 'keys-done') return; const ids = read(f.keys.p).filter(p => /backup/.test(p.name)).map(c => backupPointerIds(mod, { results: read(f.keys.r)[c.id], snaps: [] })[0]);
        const a = await PH[mod].store.get(ids[0]), b = await PH[mod].store.get(ids[1]); if (swap === 'swap') { await PH[mod].store.put(ids[0], b); await PH[mod].store.put(ids[1], a); } else await PH[mod].store.put(ids[0], tagBytes(9, 1, 1));
      } });
      expect(r.ok, swap).toBe(false); expect(lsSnapshot(), swap).toEqual(before); expect(await idbSnapshot(), swap).toEqual(beforeIdb);
    }
  });
});

describe.each(MODULES.map(f => [f.mod, f]))('%s: ids that clash, and ids that sit where the app does not keep ids', (mod, f) => {
  it('a new id that is already used on the phone (site, History snapshot, photo) or by an earlier copy is never given out', async () => {
    await wipe(); await seedLookAlike(f, SITES.slice(0, 2)); const { blob } = await backupBuild({ now: BACKUP_DAY }); patchKey(f.keys.p, v => { v.forEach(p => { p.name += ' x'; }); });
    let n = 0; vi.spyOn(Math, 'random').mockImplementation(() => (n++ < 4 ? 0.5 : (0.2 + (n % 60) / 100)));       // the first four ids drawn are all "i"
    patchKey(f.keys.p, v => { v.push({ ...v[0], id: 'plant-room-a-backup--i', name: 'Planted' }); }); patchKey(f.keys.h, v => { v.push({ ...v[0], id: 'i', projectId: 'prb' }); });
    if (PH[mod]) await PH[mod].store.put('i', tagBytes(8, 1, 1));
    const before = lsSnapshot(); const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY }); expect(r.ok, r.message).toBe(true); expect(r.summary.copiesAdded).toBe(2);
    const P = read(f.keys.p), ids = P.map(p => p.id); expect(new Set(ids).size, 'every site id is unique').toBe(ids.length); const H = read(f.keys.h), hid = H.map(h => h.id); expect(new Set(hid).size, 'every snapshot id is unique').toBe(hid.length);
    expect(JSON.parse(before['sparkcheck-restore-v1'] || 'null')).toBeNull(); if (PH[mod]) expect(bytesOf(await PH[mod].store.get('i')), 'the planted photo is untouched').toEqual(bytesOf(tagBytes(8, 1, 1)));
  });
  it('a record that appears under a copy\x27s new photo id AFTER the plan was made (the second line of defence) makes the restore fail and is never written over', async () => {
    if (!PH[mod]) return; await wipe(); await seedLookAlike(f, SITES.slice(0, 1)); const { blob } = await backupBuild({ now: BACKUP_DAY }); patchKey(f.keys.p, v => { v[0].name += ' x'; });
    let n = 0; vi.spyOn(Math, 'random').mockImplementation(() => (++n === 3 ? 0.5 : 0.31 + n / 1000)); const before = lsSnapshot();                       // the third id drawn (the first photo) is "i": predictable
    const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY, crashAt: async stage => { if (stage === 'journal') await PH[mod].store.put('i', tagBytes(8, 1, 1)); } });
    expect(r.ok, 'refused').toBe(false); expect(lsSnapshot()).toEqual(before); expect(bytesOf(await PH[mod].store.get('i')), 'the record that appeared is untouched').toEqual(bytesOf(tagBytes(8, 1, 1)));
  });
  it('a new History snapshot id that is already on the phone is never given out (the second id drawn is "i" and a snapshot "i" exists)', async () => {
    await wipe(); await seedLookAlike(f, SITES.slice(0, 2)); const { blob } = await backupBuild({ now: BACKUP_DAY }); patchKey(f.keys.p, v => { v[0].name += ' x'; }); patchKey(f.keys.h, v => { v.push({ ...v[1], id: 'i' }); });
    let n = 0; vi.spyOn(Math, 'random').mockImplementation(() => (++n === 2 ? 0.5 : 0.31 + n / 1000));
    const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY }); expect(r.ok, r.message).toBe(true); const hid = read(f.keys.h).map(h => h.id); expect(new Set(hid).size, 'every snapshot id is unique').toBe(hid.length); expect(hid.filter(x => x === 'i').length).toBe(1);
  });
  it('a new photo id that is already a record on the phone is never given out (the third id drawn is "i" and a photo "i" exists)', async () => {
    if (!PH[mod]) return; await wipe(); await seedLookAlike(f, SITES.slice(0, 1)); const { blob } = await backupBuild({ now: BACKUP_DAY }); patchKey(f.keys.p, v => { v[0].name += ' x'; }); await PH[mod].store.put('i', tagBytes(8, 1, 1));
    let n = 0; vi.spyOn(Math, 'random').mockImplementation(() => (++n === 3 ? 0.5 : 0.31 + n / 1000));
    const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY }); expect(r.ok, r.message).toBe(true); expect(bytesOf(await PH[mod].store.get('i')), 'the record that was there is untouched').toEqual(bytesOf(tagBytes(8, 1, 1)));
    const c = read(f.keys.p).find(p => /backup/.test(p.name)); expect(await pointersOf(mod, f, c.id)).not.toContain('i');
  });
  it('a site id that also appears as a VALUE in its own data (so it cannot be re-pointed with certainty) is refused, listed as not restored, and nothing is written for it; the others still copy', async () => {
    const area = f.project[0].areas ? f.project[0].areas[0].id : 'a1'; await wipe(); seedModule(f, { id: area, name: 'Collides', snapId: 'h-c' }); seedModule(f, { id: 'pra', name: 'Plant Room A', snapId: 'h-pra' });
    const { blob } = await backupBuild({ now: BACKUP_DAY }); patchKey(f.keys.p, v => { v.forEach(p => { p.name += ' x'; }); });
    const before = lsSnapshot(), beforeIdb = await idbSnapshot(); const plan = await planOf(blob); const mm = modOf(plan, mod);
    expect(mm.sites.conflict.map(c => c.reason)).toContain('could not be copied safely'); expect(mm.sites.copy.map(c => c.copyName)).toEqual(['Plant Room A (backup 5 Oct 2026)']);
    expect(backupSummaryText(plan).groups.find(g => g.id === 'skipped').lines.join('\n')).toContain('could not be copied safely');
    const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY }); expect(r.ok, r.message).toBe(true); expect(r.summary.copiesAdded).toBe(1); expect(r.summary.notRestored).toBe(1);
    expect(read(f.keys.p).filter(p => /backup/.test(p.name)).length).toBe(1); expect(Object.keys(read(f.keys.r)).filter(k => k.includes('collid')).length).toBe(0);
  });
});

// ── a tab killed at any point of a restore that makes copies (photos, History, the note of copies): the next start puts everything back exactly
describe.each(MODULES.map(f => [f.mod, f]))('%s: a killed tab, with copies', (mod, f) => {
  const stages = [['after the journal', 'journal'], ['mid photos', 'put', 1], ['after the photos', 'puts-done'], ['mid keys', 'key', 1], ['after the last key', 'keys-done'], ['after the verify, before the commit', 'verified']];
  it.each(stages)('killed %s: the next start restores the phone exactly as it was (the copies, their photos and the note are all gone)', async (_n, stage, idx) => {
    await wipe(); await seedLookAlike(f, SITES.slice(0, 2)); const { blob } = await backupBuild({ now: BACKUP_DAY }); patchKey(f.keys.p, v => { v.forEach(p => { p.name += ' x'; }); });
    const before = lsSnapshot(), beforeIdb = await idbSnapshot();
    await expect(backupRestore(blob, { storage: S, now: RESTORE_DAY, crashAt: (st, i) => { if (st === stage && (idx === undefined || i === idx)) throw new BackupCrash('killed'); } })).rejects.toBeInstanceOf(BackupCrash);
    const r = backupRecoverAtStart(S); expect(r).toMatchObject({ recovered: true, unresolved: [] }); expect(await backupFinishRecovery(S)).toMatchObject({ ok: true });
    const after = lsSnapshot(); delete after['sparkcheck-restore-v1']; expect(after).toEqual(before); expect(await idbSnapshot()).toEqual(beforeIdb);
  });
});

// ── the after-write check (backupVerifyCopies), CALLED ON ITS OWN. In a whole restore, a fault put in after the writes is stopped by the earlier byte check ("does not hold what was written") before this check runs, so these
// tests call the check directly on a finished restore and look at WHICH check speaks. Each check has its own message; taking a check out of the function changes the message and fails the test for it.
describe.each(MODULES.map(f => [f.mod, f]))('%s: the after-write check on its own names each fault', (mod, f) => {
  async function restored() {
    await wipe(); await seedLookAlike(f, SITES.slice(0, 2)); const { blob } = await backupBuild({ now: BACKUP_DAY }); patchKey(f.keys.p, v => { v.forEach(p => { p.name += ' x'; }); });
    const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY }); expect(r.ok, r.message).toBe(true); expect(r.summary.copiesAdded).toBe(2); return { plan: r.plan, z: await zipOpen(blob) };
  }
  const copy = () => read(f.keys.p).find(p => /\(backup/.test(p.name));
  it('a finished restore passes', async () => { const { plan, z } = await restored(); await expect(backupVerifyCopies(plan, S, z)).resolves.toBeUndefined(); });
  it('OLD IDS: a copy that still holds the id of the site it was copied from -> "a copy still points at the site it was copied from" (the check for old ids)', async () => {
    const { plan, z } = await restored(); patchKey(f.keys.r, v => { const r = v[copy().id]; if (Array.isArray(r)) r[0].description = 'pra'; else r.zz = { ref: 'pra' }; });
    await expect(backupVerifyCopies(plan, S, z)).rejects.toThrow(/verify: a copy still points at the site it was copied from/);
  });
  it('THE COPY\'S HISTORY: a copy whose History snapshot is gone -> "a copy\'s History is not exactly its own"; one moved to another site -> the same; the same snapshot id used twice -> "a History id is used twice"', async () => {
    let t = await restored(); patchKey(f.keys.h, v => { const c = copy(); v.splice(v.findIndex(h => h.projectId === c.id), 1); });
    await expect(backupVerifyCopies(t.plan, S, t.z)).rejects.toThrow(/verify: a copy's History is not exactly its own/);
    t = await restored(); patchKey(f.keys.h, v => { const c = copy(); v.find(h => h.projectId === c.id).projectId = 'prb'; });
    await expect(backupVerifyCopies(t.plan, S, t.z)).rejects.toThrow(/verify: a copy's History is not exactly its own/);
    t = await restored(); patchKey(f.keys.h, v => { const c = copy(); v.push({ ...v.find(h => h.projectId === c.id), projectId: 'prb' }); });
    await expect(backupVerifyCopies(t.plan, S, t.z)).rejects.toThrow(/verify: a History id is used twice/);
  });
});

// BACKUP RESTORE ENGINE (Stage 3). FICTIONAL data. ADD-ONLY: nothing already on the phone is modified or deleted. The guarantee under test: after ANY failure (a failed IndexedDB put, a throwing setItem, the
// journal or the commit write failing, a tab killed at any point, a kill during the rollback itself) the phone is EXACTLY as it was, byte for byte (every localStorage key, every photo / thumbnail / logo
// record and its bytes), or the restore is fully added. All-or-nothing across modules. Existing text is preserved by PURE INSERTION; undo removes the restored IDs by parsing.
// The engine is given a storage ADAPTER over localStorage that writes through `rawSetItem` (the test setup wraps Storage.setItem to stamp a dateDay on meta records; the app does not), and failures are
// injected by wrapping that adapter, so exactly the calls the engine makes are the calls that fail.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { backupBuild, backupRestore, backupRecoverAtStart, backupFinishRecovery, backupUndoInfo, backupUndo, backupBuildInserts, backupPlan, backupRestoreProblem, backupUndoConfirmText, backupLastRestoreLine, BackupCrash, RESTORE_KEY, BACKUP_MODULE_INFO, BACKUP_MODULES,
  sitePhotoStore, siteLogoStore, appLogoStore } from './App.jsx';
import { idbSnapshot, lsSnapshot, rec, FM, seedModule, seedPhone, wipe, backupOf, seedSourceFull } from './test/backup-fixtures.js';

const adapter = (over = {}) => ({ getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; }, ...over });
const S = adapter();
const quota = () => Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
const failingNth = (n, skipRecord = true) => { let c = 0; return adapter({ setItem: (k, v) => { if (!(skipRecord && k === RESTORE_KEY) && ++c === n) throw quota(); rawSetItem(k, v); } }); };
const snap = async () => ({ ls: lsSnapshot(), idb: await idbSnapshot() });
const OWNED = [...BACKUP_MODULES.flatMap(m => Object.values(BACKUP_MODULE_INFO[m].keys)), 'cal-events-v1'];
const crashAt = (stage, idx) => (s, i) => { if (s === stage && (idx === undefined || i === idx)) throw new BackupCrash('killed at ' + stage + (idx === undefined ? '' : ' ' + idx)); };
// the phone the restore goes into: it already has its OWN site "local" in every module (so every key exists and is a real insertion target) plus an existing photo and logo, settings and a dropdown list
async function seedTarget() { seedPhone({ id: 'local', name: 'Local Site', snapId: 'hl' }); rawSetItem('cal-events-v1', JSON.stringify([{ id: 'eL', type: 'TAT', site: 'Local Site', dueDate: '2026-11-11' }])); rawSetItem('app-settings-v1', '{"businessName":"Mine"}'); rawSetItem('rcd-dropdowns-v6', '{"responsibility":["Mine"]}'); await sitePhotoStore.put('mine1', rec(5, 5)); await siteLogoStore.put('swb', 'local', rec(77)); }
const sourceFile = () => backupOf(seedSourceFull);
const expectUnchanged = async (before) => { const now = await snap(); expect(now.ls).toEqual(before.ls); expect(now.idb).toEqual(before.idb); };
const RESTORED_BEFORE = (before) => ({ ...before.ls, [RESTORE_KEY]: expect.any(String) });
beforeEach(wipe);
afterEach(() => { vi.restoreAllMocks(); });

describe('a restore into an empty phone', () => {
  it('adds every site, History snapshot, event, photo, thumbnail and logo, byte for byte; into an empty phone the Business tab record, the dropdown list and the TAT frequencies are filled too (the global logo only when the backup says it has one)', async () => {
    await wipe(); await seedSourceFull(); const src = await snap(); const { blob } = await backupBuild(); await wipe();
    const r = await backupRestore(blob, { storage: S, now: new Date(2026, 9, 5, 12, 0) });
    expect(r.ok).toBe(true); expect(r.summary).toMatchObject({ sitesAdded: 11, snapshotsAdded: 11, eventsAdded: 2, photosWritten: 6, alreadyOnPhone: 0, notRestored: 0, undoUntil: '2026-10-19' });
    const after = await snap();
    for (const k of OWNED) expect(JSON.parse(after.ls[k]), k).toEqual(JSON.parse(src.ls[k]));
    expect(Object.keys(after.ls).sort()).toEqual([...OWNED, 'app-settings-v1', 'rcd-dropdowns-v6', 'tat-freqs-v1', RESTORE_KEY].sort());                  // the three settings keys of the source phone are filled; nothing else
    expect(JSON.parse(after.ls['app-settings-v1'])).toEqual({ businessName: 'Example Electrical Pty Ltd', abn: '', licence: '', logoId: null }); expect(JSON.parse(after.ls['tat-freqs-v1'])).toEqual(['1']);
    expect(JSON.parse(after.ls['rcd-dropdowns-v6']).responsibility).toEqual(['A']); expect(Object.keys(JSON.parse(after.ls['rcd-dropdowns-v6'])).sort()).toEqual(['ampRating', 'cbType', 'rectified', 'responsibility']);   // a created key is complete
    const sp = src.idb['sparkcheck-site-photos'];
    expect(after.idb['sparkcheck-site-photos']).toEqual({ p1: sp.p1, 'p1~t': sp['p1~t'], p2: sp.p2 });                              // 'unused' (no site uses it) is not restored
    expect(after.idb['sparkcheck-gsd-photos']).toEqual(src.idb['sparkcheck-gsd-photos']); expect(after.idb['sparkcheck-site-logos']).toEqual(src.idb['sparkcheck-site-logos']); expect(after.idb['sparkcheck-app-settings']).toEqual({});
    expect(JSON.parse(after.ls[RESTORE_KEY]).journal).toBeNull(); expect(backupUndoInfo(S, new Date(2026, 9, 5, 12, 0))).toMatchObject({ until: '2026-10-19', counts: { sites: 11, snapshots: 11, events: 2, photos: 6 } });
  });
  it('a restore with nothing to add changes nothing at all and writes no record', async () => {
    await wipe(); await seedSourceFull(); const { blob } = await backupBuild(); const before = await snap();
    const r = await backupRestore(blob, { storage: S }); expect(r).toMatchObject({ ok: false, code: 'nothing' }); await expectUnchanged(before);
  });
  it('restoring twice: the second time everything is already on the phone', async () => {
    const file = await sourceFile(); expect((await backupRestore(file, { storage: S })).ok).toBe(true); const after1 = await snap();
    const r = await backupRestore(file, { storage: S }); expect(r).toMatchObject({ ok: false, code: 'nothing' }); await expectUnchanged(after1);
  });
});

describe('PURE INSERTION into a phone that already has data', () => {
  it('every existing byte stays exactly where it was (pretty-printed JSON included); other keys, photos, settings and dropdowns are untouched', async () => {
    const file = await sourceFile(); await seedTarget();
    for (const k of OWNED) { const raw = localStorage.getItem(k); if (raw) rawSetItem(k, JSON.stringify(JSON.parse(raw), null, 2) + '\n'); }       // formatting the app would never write: insertion must not re-serialise
    const before = await snap();
    const r = await backupRestore(file, { storage: S }); expect(r.ok).toBe(true); const after = await snap();
    for (const k of OWNED) {
      const b = before.ls[k], a = after.ls[k]; if (b === undefined) continue; if (k.endsWith('audit-active-v1')) { expect(JSON.parse(a).sites.local, k).toEqual(JSON.parse(b).sites.local); continue; }   // the tiny audit-active map is re-serialised
      const cut = b.trimEnd().length - 1;                                                                                 // the closing bracket
      expect(a.length, k).toBeGreaterThan(b.length); expect(a.startsWith(b.slice(0, cut)), k).toBe(true); expect(a.endsWith(b.slice(cut)), k).toBe(true);
    }
    for (const k of Object.keys(before.ls)) if (!OWNED.includes(k)) expect(after.ls[k], k).toBe(before.ls[k]);                // settings, dropdowns, anything else
    expect(after.idb['sparkcheck-site-photos'].mine1).toEqual(before.idb['sparkcheck-site-photos'].mine1); expect(after.idb['sparkcheck-site-logos']['swb:local']).toEqual(before.idb['sparkcheck-site-logos']['swb:local']);
    for (const m of BACKUP_MODULES) { const ps = JSON.parse(after.ls[BACKUP_MODULE_INFO[m].keys.projects]); expect(ps.map(p => p.id), m).toContain('local'); expect(ps.map(p => p.id), m).toContain('s1'); }
  });
  it('a site that is already on the phone (by ID, even renamed) is skipped and its data is untouched; the rest is added', async () => {
    const file = await sourceFile(); seedPhone({ name: 'Renamed Locally' }); const before = await snap();         // s1 exists everywhere under another name
    const r = await backupRestore(file, { storage: S }); expect(r.ok).toBe(true); expect(r.summary).toMatchObject({ sitesAdded: 2, eventsAdded: 2, alreadyOnPhone: 9 });          // only the two extra sites (swb s2, gsd s2)
    const after = await snap(); for (const m of BACKUP_MODULES) { const ps = JSON.parse(after.ls[BACKUP_MODULE_INFO[m].keys.projects]); expect(ps.find(p => p.id === 's1').name, m).toBe('Renamed Locally'); }
    expect(after.ls['rcd-projects-v6']).toBe(before.ls['rcd-projects-v6']);                                              // nothing to add in RCD: byte-identical
  });
  it('a site whose photo already exists with DIFFERENT bytes is not restored (conflicting photos); everything else is; the existing photo is untouched', async () => {
    const file = await sourceFile(); await sitePhotoStore.put('p2', rec(5, 4)); const before = await snap();
    const r = await backupRestore(file, { storage: S }); expect(r.ok).toBe(true); expect(r.summary.notRestored).toBe(1);
    const after = await snap(); expect(JSON.parse(after.ls['swb-projects-v1']).map(p => p.id)).toEqual(['s1']); expect(after.idb['sparkcheck-site-photos'].p2).toEqual(before.idb['sparkcheck-site-photos'].p2);
    expect(JSON.parse(after.ls['gsd-projects-v1']).map(p => p.id)).toEqual(['s1', 's2']);
  });
  it('refuses with the headroom message when there is not enough room, and changes nothing', async () => {
    const file = await sourceFile(); await seedTarget(); const before = await snap();
    const r = await backupRestore(file, { storage: S, estimate: async () => ({ quota: 30 * 1024 * 1024, usage: 29 * 1024 * 1024 }) });
    expect(r).toMatchObject({ ok: false, code: 'headroom' }); expect(r.message).toMatch(/Not enough free space/); await expectUnchanged(before);
  });
});

describe('FAILURE INJECTION: after any failure the phone is exactly as it was', () => {
  it('a failed IndexedDB put part-way through the photos', async () => {
    const file = await sourceFile(); await seedTarget(); const before = await snap();
    let c = 0; const orig = IDBObjectStore.prototype.put; vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (...a) { if (++c === 3) throw new Error('disk error'); return orig.apply(this, a); });
    const r = await backupRestore(file, { storage: S }); vi.restoreAllMocks();
    expect(c).toBeGreaterThanOrEqual(3); expect(r).toMatchObject({ ok: false, code: 'failed' }); expect(r.message).toMatch(/put back exactly as it was/); await expectUnchanged(before);
  });
  it('a throwing setItem part-way through the localStorage keys', async () => {
    const file = await sourceFile(); await seedTarget(); const before = await snap();
    const r = await backupRestore(file, { storage: failingNth(3) }); expect(r).toMatchObject({ ok: false, code: 'failed' }); await expectUnchanged(before);
  });
  it('all-or-nothing across modules: a failure on the LAST key puts back the keys of every earlier module', async () => {
    const file = await sourceFile(); await seedTarget(); const before = await snap(); const n = backupBuildInserts(await backupPlan(file, { storage: S }), S).length;
    const r = await backupRestore(file, { storage: failingNth(n) });
    expect(n).toBeGreaterThan(30); expect(r).toMatchObject({ ok: false, code: 'failed' }); await expectUnchanged(before);
  });
  it('the journal write failing (no room to even start): nothing was touched', async () => {
    const file = await sourceFile(); await seedTarget(); const before = await snap();
    const r = await backupRestore(file, { storage: adapter({ setItem: (k, v) => { if (k === RESTORE_KEY) throw quota(); rawSetItem(k, v); } }) });
    expect(r).toMatchObject({ ok: false, code: 'journal' }); expect(r.message).toMatch(/Free up space/); await expectUnchanged(before);
  });
  it('the COMMIT write failing: everything is put back (the journal is still intact)', async () => {
    const file = await sourceFile(); await seedTarget(); const before = await snap(); let c = 0;
    const r = await backupRestore(file, { storage: adapter({ setItem: (k, v) => { if (k === RESTORE_KEY && ++c === 2) throw quota(); rawSetItem(k, v); } }) });
    expect(c).toBeGreaterThanOrEqual(2); expect(r).toMatchObject({ ok: false, code: 'failed' }); await expectUnchanged(before);
  });
  it('a key changed behind our back before the verify: exactly the restored IDs are taken out of it BY PARSING (its other change stays), every other key is put back byte for byte, the photos are removed: no half-restored site is left', async () => {
    const file = await sourceFile(); await seedTarget(); const before = await snap();
    const r = await backupRestore(file, { storage: S, crashAt: async (s) => { if (s === 'keys-done') rawSetItem('rcd-projects-v6', localStorage.getItem('rcd-projects-v6') + ' '); } });
    expect(r).toMatchObject({ ok: false, code: 'failed', semantic: ['rcd-projects-v6'] }); expect(r.message).toMatch(/changed by something else/); const after = await snap();
    for (const k of Object.keys(before.ls)) if (k !== 'rcd-projects-v6') expect(after.ls[k], k).toBe(before.ls[k]);          // every OTHER key: the same bytes
    expect(JSON.parse(after.ls['rcd-projects-v6'])).toEqual(JSON.parse(before.ls['rcd-projects-v6']));                         // that key: the same data (re-serialised, so the formatting may differ)
    expect(after.idb).toEqual(before.idb); expect(Object.keys(after.ls)).not.toContain(RESTORE_KEY); expect(backupRestoreProblem(S)).toBeNull();
    for (const m of BACKUP_MODULES) expect(JSON.parse(after.ls[BACKUP_MODULE_INFO[m].keys.projects]).map(p => p.id), m).toEqual(['local']);   // no restored site is left in ANY module
  });
  it('a key that is no longer valid JSON cannot be put back: it is reported, the photos are KEPT (what is left in it may refer to them), every other key is put back, the problem is recorded and a later restore clears it', async () => {
    const file = await sourceFile(); await seedTarget(); const before = await snap();
    const r = await backupRestore(file, { storage: S, crashAt: async (s) => { if (s === 'keys-done') rawSetItem('rcd-projects-v6', '{broken'); } });
    expect(r).toMatchObject({ ok: false, code: 'rollback', unresolved: ['rcd-projects-v6'] }); expect(r.message).toMatch(/no longer readable/); const after = await snap();
    for (const k of Object.keys(before.ls)) if (k !== 'rcd-projects-v6') expect(after.ls[k], k).toBe(before.ls[k]);
    expect(after.ls['rcd-projects-v6']).toBe('{broken'); expect(Object.keys(after.idb['sparkcheck-site-photos']).sort()).toEqual(['mine1', 'p1', 'p1~t', 'p2']);   // restored photos kept
    expect(JSON.parse(after.ls[RESTORE_KEY])).toMatchObject({ journal: null, problem: { keys: ['rcd-projects-v6'] } }); expect(backupRestoreProblem(S)).toMatchObject({ keys: ['rcd-projects-v6'] });
    rawSetItem('rcd-projects-v6', before.ls['rcd-projects-v6']);                                                                // the user's data is repaired; restoring again works and the problem is gone
    expect((await backupRestore(file, { storage: S })).ok).toBe(true); expect(backupRestoreProblem(S)).toBeNull();
  });
});

describe('THE GUARANTEES, each proved: write order, the single commit write, only owned keys, nothing without a plan', () => {
  const recording = () => { const calls = []; const st = adapter({ setItem: (k, v) => { calls.push(['set', k, v]); rawSetItem(k, v); }, removeItem: k => { calls.push(['remove', k]); localStorage.removeItem(k); } }); return { st, calls }; };
  const recordIdb = () => { const calls = []; for (const name of ['put', 'delete', 'clear', 'add']) { const orig = IDBObjectStore.prototype[name]; vi.spyOn(IDBObjectStore.prototype, name).mockImplementation(function (...a) { calls.push([name, this.transaction.db.name]); return orig.apply(this, a); }); } return calls; };
  const PROTECTED = { 'app-settings-v1': '{"businessName":"Mine"}', 'rcd-dropdowns-v6': '{"responsibility":["Mine"]}', 'thermo-dropdowns-v1': '{"x":1}', 'tat-settings-v1': '{"a":1}', 'tat-freqs-v1': '["1","3"]', 'tat-names-v1': '["Drill"]', 'tat-defaults-v1': '{"freq":"3"}',
    'rcd-mode-v6': '"push"', 'iel-cat-v2': '"estops"', 'elt-photos-migrated-v1': '"2026-09-29T00:00:00Z"', 'swb-results-preMigration-v1': '{"big":"copy"}', 'elt-projects-v1': '[]', 'some-other-app': 'x' };
  it('the journal is the FIRST write, before any photo and before any inserted text; the commit is ONE setItem of ONE record and the LAST write; exactly two writes to the record key', async () => {
    const file = await sourceFile(); await seedTarget(); const { st, calls } = recording(); const idb = recordIdb();
    const r = await backupRestore(file, { storage: st }); expect(r.ok).toBe(true);
    expect(calls[0][0]).toBe('set'); expect(calls[0][1]).toBe(RESTORE_KEY); const journal = JSON.parse(calls[0][2]); expect(journal.journal).toBeTruthy(); expect(journal.journal.keys.length).toBeGreaterThan(30); expect(journal.journal.put.length).toBe(6);
    const recordWrites = calls.map((c, i) => [c, i]).filter(([c]) => c[1] === RESTORE_KEY); expect(recordWrites.length).toBe(2);                    // journal, then commit
    const last = calls[calls.length - 1]; expect(last[1]).toBe(RESTORE_KEY); expect(JSON.parse(last[2])).toMatchObject({ v: 1, journal: null, undo: { expiresOn: expect.any(String) } });
    expect(calls.slice(1, -1).every(c => c[1] !== RESTORE_KEY)).toBe(true); expect(calls.slice(1, -1).length).toBe(journal.journal.keys.length);          // between the two: only the planned inserts
    expect(idb.filter(c => c[0] === 'put').length).toBe(6);                                                                                         // the photos were put (after the journal: put calls only start once the journal call has returned, see the order test below)
  });
  it('no photo is put and no key inserted before the journal exists', async () => {
    const file = await sourceFile(); await seedTarget(); let journalSeenAtFirstPut = null, journalSeenAtFirstInsert = null;
    const orig = IDBObjectStore.prototype.put; vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (...a) { if (journalSeenAtFirstPut === null) journalSeenAtFirstPut = !!(JSON.parse(localStorage.getItem(RESTORE_KEY) || 'null') || {}).journal; return orig.apply(this, a); });
    const st = adapter({ setItem: (k, v) => { if (k !== RESTORE_KEY && journalSeenAtFirstInsert === null) journalSeenAtFirstInsert = !!(JSON.parse(localStorage.getItem(RESTORE_KEY) || 'null') || {}).journal; rawSetItem(k, v); } });
    expect((await backupRestore(file, { storage: st })).ok).toBe(true); expect(journalSeenAtFirstPut).toBe(true); expect(journalSeenAtFirstInsert).toBe(true);
  });
  it('restore and undo write ONLY owned module keys, the calendar events and the record; only the photo / site-logo stores; the values the phone already has (settings, dropdown lists, TAT lists, the global logo) and rcd-mode, iel-cat, migration flags, preMigration copies, legacy keys and other apps\' keys are never touched', async () => {
    const file = await sourceFile(); await seedTarget(); for (const k of Object.keys(PROTECTED)) rawSetItem(k, PROTECTED[k]); await appLogoStore.put(rec(99));
    const before = await snap(); const { st, calls } = recording(); const idb = recordIdb();
    expect((await backupRestore(file, { storage: st })).ok).toBe(true); expect((await backupUndo({ storage: st })).ok).toBe(true);
    const allowed = new Set([...OWNED, RESTORE_KEY]); expect(calls.map(c => c[1]).filter(k => !allowed.has(k))).toEqual([]);
    expect([...new Set(idb.map(c => c[1]))].sort()).toEqual(['sparkcheck-gsd-photos', 'sparkcheck-site-logos', 'sparkcheck-site-photos']); expect(idb.some(c => c[1] === 'sparkcheck-app-settings')).toBe(false);
    vi.restoreAllMocks(); const after = await snap(); for (const k of Object.keys(PROTECTED)) expect(after.ls[k], k).toBe(PROTECTED[k]); expect(after.idb['sparkcheck-app-settings']).toEqual(before.idb['sparkcheck-app-settings']);
  });
  it('the engine cannot run without a successful plan: a plan with nothing to add, one the headroom refuses, a damaged file and a file that is not a backup perform ZERO writes of any kind', async () => {
    const good = await sourceFile(); const damaged = new Blob([new Uint8Array(500)]);
    const cases = [[async () => { await wipe(); await seedSourceFull(); return (await backupBuild()).blob; }, {}, 'nothing'], [async () => { await seedTarget(); return good; }, { estimate: async () => ({ quota: 30 * 1024 * 1024, usage: 29 * 1024 * 1024 }) }, 'headroom'], [async () => damaged, {}, undefined]];
    for (const [prep, opts, code] of cases) {
      await wipe(); const file = await prep(); const { st, calls } = recording(); const idb = recordIdb();
      const r = await backupRestore(file, { storage: st, ...opts }); vi.restoreAllMocks();
      expect(r.ok).toBe(false); if (code) expect(r.code).toBe(code); expect(calls).toEqual([]); expect(idb).toEqual([]);
    }
  });
  it('the restore record is left out of backups (listed as excluded, not as an unknown key) and the engine takes its plan only from backupPlan (it has no parameter to pass one in)', async () => {
    const file = await sourceFile(); await backupRestore(file, { storage: S }); expect(localStorage.getItem(RESTORE_KEY)).not.toBeNull();
    const b = await backupBuild(); expect(b.manifest.notBackedUp.excludedKeys).toContain(RESTORE_KEY); expect(b.manifest.notBackedUp.unknownKeys).not.toContain(RESTORE_KEY);
    const z = JSON.parse(new TextDecoder().decode(await (await (await import('./App.jsx')).zipOpen(b.blob)).bytes('data.json'))); expect(Object.keys(z)).not.toContain(RESTORE_KEY);
    expect(backupRestore.length).toBe(1);                                                                                                          // (file, options): no plan argument
  });
  it('the undo confirmation says that work done inside the restored sites since the restore is removed too', async () => {
    const file = await sourceFile(); await backupRestore(file, { storage: S, now: new Date(2026, 9, 5, 12, 0) }); const text = backupUndoConfirmText(backupUndoInfo(S, new Date(2026, 9, 6)));
    expect(text).toContain('and any work you have done in them since'); expect(text).toContain('11 sites'); expect(text).toContain('2 calendar events'); expect(backupLastRestoreLine(backupUndoInfo(S, new Date(2026, 9, 6)))).toContain('Undo is available until 19/10/2026.');      // the undo window is stated in the Undo block's own line (and the restore result), not repeated in the question
  });
});

describe('a TAB KILLED at any point is recovered synchronously at the next start', () => {
  const stages = [['after the journal', 'journal'], ['mid photos', 'put', 2], ['after the photos', 'puts-done'], ['mid keys', 'key', 1], ['after the last key', 'keys-done'], ['after the verify, before the commit', 'verified']];
  it.each(stages)('killed %s: the localStorage part is put back at once (before the first render); the photo records are deleted in the background; the result is exactly as before', async (_n, stage, idx) => {
    const file = await sourceFile(); await seedTarget(); const before = await snap();
    await expect(backupRestore(file, { storage: S, crashAt: crashAt(stage, idx) })).rejects.toBeInstanceOf(BackupCrash);          // nothing after the kill ran
    const r = backupRecoverAtStart(S);                                                                                 // SYNCHRONOUS: no await
    expect(r).toMatchObject({ recovered: true, unresolved: [] }); expect(lsSnapshot()).toEqual(RESTORED_BEFORE(before));
    expect(await backupFinishRecovery(S)).toMatchObject({ ok: true }); await expectUnchanged(before);
  });
  it('a kill DURING the rollback itself: running the recovery again finishes it exactly', async () => {
    const file = await sourceFile(); await seedTarget(); const before = await snap();
    await expect(backupRestore(file, { storage: S, crashAt: crashAt('keys-done') })).rejects.toBeInstanceOf(BackupCrash);
    expect(() => backupRecoverAtStart(S, { crashAt: (s, i) => { if (i === 4) throw new BackupCrash('killed in rollback'); } })).toThrow(BackupCrash);
    expect(lsSnapshot()).not.toEqual(RESTORED_BEFORE(before));                                                         // half rolled back
    expect(backupRecoverAtStart(S)).toMatchObject({ recovered: true, unresolved: [] }); await backupFinishRecovery(S); await expectUnchanged(before);
  });
  it('a failing background photo cleanup: the journal stays and the next start finishes it', async () => {
    const file = await sourceFile(); await seedTarget(); const before = await snap();
    await expect(backupRestore(file, { storage: S, crashAt: crashAt('puts-done') })).rejects.toBeInstanceOf(BackupCrash); backupRecoverAtStart(S);
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function () { throw new Error('boom'); }); expect(await backupFinishRecovery(S)).toMatchObject({ ok: false });
    vi.restoreAllMocks(); expect(JSON.parse(localStorage.getItem(RESTORE_KEY)).journal.phase).toBe('idb');
    expect(backupRecoverAtStart(S)).toMatchObject({ recovered: true }); expect(await backupFinishRecovery(S)).toMatchObject({ ok: true }); await expectUnchanged(before);
  });
  it('killed AFTER the commit: the restore is complete, nothing is rolled back, undo is available', async () => {
    const file = await sourceFile(); await seedTarget();
    await expect(backupRestore(file, { storage: S, crashAt: crashAt('committed') })).rejects.toBeInstanceOf(BackupCrash); const after = await snap();
    expect(backupRecoverAtStart(S)).toMatchObject({ recovered: false }); await expectUnchanged(after); expect(backupUndoInfo(S)).not.toBeNull();
  });
  it('a restore that finds an interrupted one first finishes putting that right, then proceeds', async () => {
    const file = await sourceFile(); await seedTarget(); const before = await snap();
    await expect(backupRestore(file, { storage: S, crashAt: crashAt('key', 3) })).rejects.toBeInstanceOf(BackupCrash);
    const r = await backupRestore(file, { storage: S }); expect(r.ok).toBe(true); expect(JSON.parse(localStorage.getItem(RESTORE_KEY)).journal).toBeNull(); expect(lsSnapshot()['app-settings-v1']).toBe(before.ls['app-settings-v1']);
  });
  it('recovery with nothing to recover (or a damaged record) is a harmless no-op that never throws', async () => {
    expect(backupRecoverAtStart(S)).toMatchObject({ recovered: false }); rawSetItem(RESTORE_KEY, '{broken'); expect(backupRecoverAtStart(S)).toMatchObject({ recovered: false });
  });
});

describe('UNDO removes exactly what the restore added', () => {
  const at = new Date(2026, 9, 5, 12, 0);
  it('the phone goes back to what it was (every key parses to the same value; keys the restore created are removed; photos and logos are removed byte for byte)', async () => {
    const file = await sourceFile(); await seedTarget(); const before = await snap();
    expect((await backupRestore(file, { storage: S, now: at })).ok).toBe(true);
    const u = await backupUndo({ storage: S, now: at }); expect(u).toMatchObject({ ok: true, removed: { sites: 11, snapshots: 11, events: 2 } }); const after = await snap();
    for (const k of Object.keys(before.ls)) expect(JSON.parse(after.ls[k]), k).toEqual(JSON.parse(before.ls[k]));
    expect(Object.keys(after.ls).sort()).toEqual(Object.keys(before.ls).sort()); expect(after.idb).toEqual(before.idb); expect(backupUndoInfo(S, at)).toBeNull();
  });
  it('into an EMPTY phone the keys the restore created are removed again, so the phone is empty', async () => {
    const file = await sourceFile(); await backupRestore(file, { storage: S }); expect((await backupUndo({ storage: S })).ok).toBe(true);
    expect(lsSnapshot()).toEqual({}); const idb = await idbSnapshot(); for (const db of Object.keys(idb)) expect(idb[db], db).toEqual({});
  });
  it('work done inside a restored site since the restore goes with it (by design); photos taken there go too, but a photo still used by a remaining site stays', async () => {
    const file = await backupOf(() => { seedModule(FM.elt); }); seedModule(FM.elt, { id: 'local', name: 'Local' });
    const live = () => JSON.parse(localStorage.getItem('elt-results-v1'));
    await sitePhotoStore.put('keep1', rec(1)); await sitePhotoStore.put('keep1~t', rec(2));
    const r0 = live(); r0.local.x1.photos = [{ id: 'keep1', w: 1, h: 1 }]; rawSetItem('elt-results-v1', JSON.stringify(r0));
    expect((await backupRestore(file, { storage: S })).ok).toBe(true);
    const r1 = live(); r1.s1.x1.extra = { note: 'typed after the restore' }; r1.s1.x1.photos = [{ id: 'new1', w: 1, h: 1 }, { id: 'keep1', w: 1, h: 1 }]; rawSetItem('elt-results-v1', JSON.stringify(r1));       // a new photo + one shared with the remaining site
    await sitePhotoStore.put('new1', rec(8)); await sitePhotoStore.put('new1~t', rec(9));
    expect((await backupUndo({ storage: S })).ok).toBe(true);
    expect(Object.keys(live())).toEqual(['local']); const idb = (await idbSnapshot())['sparkcheck-site-photos']; expect(Object.keys(idb).sort()).toEqual(['keep1', 'keep1~t']);
  });
  it('a site you already deleted since is skipped silently; everything else is still removed', async () => {
    const file = await sourceFile(); await backupRestore(file, { storage: S });
    const p = JSON.parse(localStorage.getItem('swb-projects-v1')).filter(x => x.id !== 's2'); rawSetItem('swb-projects-v1', JSON.stringify(p));
    expect(await backupUndo({ storage: S })).toMatchObject({ ok: true, removed: { sites: 10 } });
  });
  it('only ONE undo generation: a second restore replaces the first, and undo removes only the second', async () => {
    const f1 = await backupOf(() => { seedModule(FM.rcd); }); const f2 = await backupOf(() => { seedModule(FM.rcd, { id: 's9', name: 'Nine', snapId: 'h9' }); });
    expect((await backupRestore(f1, { storage: S })).ok).toBe(true); expect((await backupRestore(f2, { storage: S })).ok).toBe(true);
    expect((await backupUndo({ storage: S })).removed.sites).toBe(1); expect(JSON.parse(localStorage.getItem('rcd-projects-v6')).map(p => p.id)).toEqual(['s1']); expect(await backupUndo({ storage: S })).toMatchObject({ ok: false, code: 'none' });
  });
  it('the undo window: available until the 14th day inclusive (local date), gone after; at 00:30 and 23:30 the date is the LOCAL day', async () => {
    for (const [h, m] of [[0, 30], [23, 30]]) {
      await wipe(); const file = await backupOf(() => { seedModule(FM.rcd); }); const t0 = new Date(2026, 9, 5, h, m);
      expect((await backupRestore(file, { storage: S, now: t0 })).summary.undoUntil).toBe('2026-10-19');
      expect(backupUndoInfo(S, new Date(2026, 9, 19, 23, 59))).toMatchObject({ until: '2026-10-19' }); expect(backupUndoInfo(S, new Date(2026, 9, 20, 0, 1))).toBeNull();
      expect(await backupUndo({ storage: S, now: new Date(2026, 9, 20, 0, 1) })).toMatchObject({ ok: false, code: 'expired' }); expect(JSON.parse(localStorage.getItem('rcd-projects-v6')).map(p => p.id)).toEqual(['s1']);   // expired: the data stays, only the undo goes
    }
  });
  it('undo is refused while a restore is still being put right', async () => {
    const file = await sourceFile(); await expect(backupRestore(file, { storage: S, crashAt: crashAt('keys-done') })).rejects.toBeInstanceOf(BackupCrash);
    expect(await backupUndo({ storage: S })).toMatchObject({ ok: false, code: 'unfinished' }); expect(backupUndoInfo(S)).toBeNull();
  });
});

describe('A RECORDED PROBLEM is carried forward by every write of the record; ONLY a successful commit clears it', () => {
  const PROBLEM = { keys: ['rcd-projects-v6'], at: '2026-10-05T01:00:00.000Z' };
  const record = () => JSON.parse(localStorage.getItem(RESTORE_KEY));
  const plant = (extra = {}) => { const cur = localStorage.getItem(RESTORE_KEY) ? record() : { v: 1, journal: null, undo: null }; rawSetItem(RESTORE_KEY, JSON.stringify({ ...cur, ...extra, problem: PROBLEM })); };
  it('the JOURNAL write carries it: with the journal in place the same record still holds the problem', async () => {
    const file = await sourceFile(); await seedTarget(); plant();
    await expect(backupRestore(file, { storage: S, crashAt: crashAt('journal') })).rejects.toBeInstanceOf(BackupCrash);
    expect(record()).toMatchObject({ journal: { keys: expect.any(Array) }, problem: PROBLEM });
  });
  it('a restore that FAILS after the journal (rolled back in the same call) still holds the problem afterwards', async () => {
    const file = await sourceFile(); await seedTarget(); plant();
    const r = await backupRestore(file, { storage: failingNth(3) }); expect(r).toMatchObject({ ok: false, code: 'failed' });
    expect(record()).toEqual({ v: 1, journal: null, undo: null, problem: PROBLEM }); expect(backupRestoreProblem(S)).toEqual(PROBLEM);
  });
  it('a restore killed part-way and recovered at the next start (both halves) still holds the problem', async () => {
    const file = await sourceFile(); await seedTarget(); const before = await snap(); plant();
    await expect(backupRestore(file, { storage: S, crashAt: crashAt('key', 2) })).rejects.toBeInstanceOf(BackupCrash);
    expect(backupRecoverAtStart(S)).toMatchObject({ recovered: true }); expect(record().problem).toEqual(PROBLEM);              // after the synchronous half
    expect(await backupFinishRecovery(S)).toMatchObject({ ok: true }); expect(record()).toEqual({ v: 1, journal: null, undo: null, problem: PROBLEM });   // after the background half
    for (const k of Object.keys(before.ls)) expect(localStorage.getItem(k), k).toBe(before.ls[k]);
  });
  it('a restore refused before the journal (no room to start) leaves the record, and so the problem, exactly as it was', async () => {
    const file = await sourceFile(); await seedTarget(); plant(); const raw = localStorage.getItem(RESTORE_KEY);
    const r = await backupRestore(file, { storage: adapter({ setItem: (k, v) => { if (k === RESTORE_KEY) throw quota(); rawSetItem(k, v); } }) });
    expect(r).toMatchObject({ ok: false, code: 'journal' }); expect(localStorage.getItem(RESTORE_KEY)).toBe(raw);
  });
  it('a new unresolved key is ADDED to the recorded problem (the earlier key is not forgotten)', async () => {
    const file = await sourceFile(); await seedTarget(); plant();
    const r = await backupRestore(file, { storage: S, crashAt: async (s) => { if (s === 'keys-done') rawSetItem('iel-results-v2', '{broken'); } });
    expect(r).toMatchObject({ ok: false, code: 'rollback', unresolved: ['iel-results-v2'] }); expect(record().problem.keys.slice().sort()).toEqual(['iel-results-v2', 'rcd-projects-v6']);
  });
  it('a successful UNDO and an expired undo do not clear it either', async () => {
    const file = await backupOf(() => { seedModule(FM.rcd); }); const t0 = new Date(2026, 9, 5, 12, 0);
    expect((await backupRestore(file, { storage: S, now: t0 })).ok).toBe(true); plant(); expect(record().undo).toBeTruthy();
    expect((await backupUndo({ storage: S, now: t0 })).ok).toBe(true); expect(record()).toEqual({ v: 1, journal: null, undo: null, problem: PROBLEM });
    expect((await backupRestore(file, { storage: S, now: t0 })).ok).toBe(true); expect(record().problem).toBeUndefined();     // (this restore was a successful commit: see the next test)
    plant(); expect(await backupUndo({ storage: S, now: new Date(2026, 9, 25) })).toMatchObject({ ok: false, code: 'expired' }); expect(record()).toEqual({ v: 1, journal: null, undo: null, problem: PROBLEM });
  });
  it('ONLY a successful commit clears it', async () => {
    const file = await sourceFile(); await seedTarget(); plant(); expect(backupRestoreProblem(S)).toEqual(PROBLEM);
    const r = await backupRestore(file, { storage: S }); expect(r.ok).toBe(true);
    expect(backupRestoreProblem(S)).toBeNull(); expect(record()).toMatchObject({ v: 1, journal: null, undo: expect.any(Object) }); expect(record().problem).toBeUndefined();
  });
});

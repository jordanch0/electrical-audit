// BACKUP / RESTORE: BUSINESS DETAILS, COMPANY LOGO, LISTS AND SETTINGS (release n). FICTIONAL data. NO MIXED SETS: the business details (business name, ABN, licence, company logo) are ONE set; each module's lists and settings are
// ONE set per module. A restore fills a set from the backup only when the whole set is empty on this phone, and otherwise leaves every item of it exactly as it is. Undo takes a set out only if it still holds exactly what the restore wrote.
// A failed restore puts everything back byte for byte; backups made by the releases that came before (files j to m are byte-identical) restore as they always did.
import 'fake-indexeddb/auto';
import fs from 'fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { backupBuild, backupRestore, backupPlan, backupUndo, backupUndoInfo, backupUndoConfirmText, backupRecoverAtStart, backupFinishRecovery, backupBizFill, backupKeyFill, backupKeyIsEmpty, backupSettingsInserts, backupDeepEqual, backupFilledText, BackupCrash, BACKUP_LIST_SPECS, zipOpen, RESTORE_KEY, appLogoStore } from './App.jsx';
import { idbSnapshot, lsSnapshot, rec, seedPhone, seedSourceFull, wipe, backupOf } from './test/backup-fixtures.js';

vi.setConfig({ testTimeout: 30000 });
const adapter = (over = {}) => ({ getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; }, ...over });
const S = adapter(), NOW = new Date(2026, 9, 11, 12, 0);
const quota = () => Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
const failingNth = n => { let c = 0; return adapter({ setItem: (k, v) => { if (k !== RESTORE_KEY && ++c === n) throw quota(); rawSetItem(k, v); } }); };
const crashAt = stage => (s) => { if (s === stage) throw new BackupCrash('killed at ' + stage); };
const snap = async () => ({ ls: lsSnapshot(), idb: await idbSnapshot() });
const BIZ = { businessName: 'Example Electrical Pty Ltd', abn: '12 345 678 901', licence: '123456C', logoId: 'logo' };
// a custom value for every list key, different from the built-in default, in the shape the key holds
const customOf = spec => Array.isArray(spec.defaults) ? ['Custom ' + spec.key]
  : Object.fromEntries(Object.keys(spec.defaults).map(f => [f, Array.isArray(spec.defaults[f]) ? ['Custom ' + spec.key + ' ' + f] : 'Custom ' + f]));
const CUSTOM = () => Object.fromEntries(BACKUP_LIST_SPECS().map(s => [s.key, customOf(s)]));
const MODS = [...new Set(BACKUP_LIST_SPECS().map(s => s.mod))], keysOf = mod => BACKUP_LIST_SPECS().filter(s => s.mod === mod).map(s => s.key);
const seedSettings = async () => { rawSetItem('app-settings-v1', JSON.stringify(BIZ)); for (const [k, v] of Object.entries(CUSTOM())) rawSetItem(k, JSON.stringify(v)); await appLogoStore.put(rec(10, 11, 12)); };
const full = async () => { await seedSourceFull(); await seedSettings(); };                       // a source phone with every item
const parsed = k => JSON.parse(localStorage.getItem(k));
const SITE_KEY = /-(projects|results|items|meta|history|audit-active)-v\d+$|^cal-events/;
// EVERY key and logo record the restore did not fill is byte-identical afterwards (the site keys grow, the restore's own record appears; nothing else may appear)
function expectUntouched(before, now, filledKeys, logoFilled) {
  for (const k of Object.keys(before.ls)) if (!filledKeys.includes(k) && !SITE_KEY.test(k)) expect(now.ls[k], k + ' is byte-identical').toBe(before.ls[k]);
  for (const k of Object.keys(now.ls)) if (!(k in before.ls)) expect(filledKeys.includes(k) || SITE_KEY.test(k) || k === RESTORE_KEY, k + ' is a new key the restore had no reason to write').toBe(true);
  for (const db of Object.keys(before.idb)) if (!(db === 'sparkcheck-app-settings' && logoFilled)) for (const k of Object.keys(before.idb[db])) expect(now.idb[db][k], db + '/' + k).toEqual(before.idb[db][k]);
}
beforeEach(wipe);
afterEach(() => { vi.restoreAllMocks(); });

describe('the Business details are ONE set: business name, ABN, licence and the company logo', () => {
  const cur = v => v === undefined ? { state: 'absent' } : { state: 'ok', v };
  it('the set is empty when the key is missing, or every text is missing, "" , spaces only or not text, and there is no logo record: the backup\'s non-blank texts fill (trimmed)', () => {
    expect(backupBizFill(cur(undefined), BIZ, false)).toEqual({ empty: true, fields: { businessName: { had: false, was: undefined, wrote: 'Example Electrical Pty Ltd' }, abn: { had: false, was: undefined, wrote: '12 345 678 901' }, licence: { had: false, was: undefined, wrote: '123456C' } } });
    const f = backupBizFill(cur({ businessName: '   ', abn: '', licence: null }), BIZ, false); expect(f.empty).toBe(true); expect(Object.keys(f.fields)).toEqual(['businessName', 'abn', 'licence']); expect(f.fields.businessName).toEqual({ had: true, was: '   ', wrote: 'Example Electrical Pty Ltd' });
    expect(backupBizFill(cur({ businessName: 7 }), { businessName: ' Text ', abn: '  ' }, false)).toEqual({ empty: true, fields: { businessName: { had: true, was: 7, wrote: 'Text' } } });      // a number is not a name; the backup's blank ABN fills nothing
  });
  it('if ANY ONE of the four is set, none of them is touched: the name alone, the ABN alone, the licence alone, the logo alone', () => {
    for (const own of [{ businessName: 'Mine' }, { abn: '99' }, { licence: 'L1' }]) expect(backupBizFill(cur(own), BIZ, false), JSON.stringify(own)).toEqual({ empty: false, fields: {} });
    expect(backupBizFill(cur({ businessName: ' ', abn: '', licence: '' }), BIZ, true), 'a logo record alone').toEqual({ empty: false, fields: {} });
    expect(backupBizFill(cur({ businessName: 'Same' }), { businessName: ' Same ' }, false)).toEqual({ empty: false, fields: {} });      // even when the backup holds the same text
  });
});

describe('Lists and settings are ONE set per module', () => {
  const spec = BACKUP_LIST_SPECS().find(s => s.key === 'rcd-dropdowns-v6'), tatNames = BACKUP_LIST_SPECS().find(s => s.key === 'tat-names-v1'), tatDef = BACKUP_LIST_SPECS().find(s => s.key === 'tat-defaults-v1'), elt = BACKUP_LIST_SPECS().find(s => s.key === 'elt-dropdowns-v1');
  const ok = v => ({ state: 'ok', v }), absent = { state: 'absent' }, D = spec.defaults;
  it('a key is empty when it is absent or exactly the built-in default (also a list the user edited back to the default); anything else, even an emptied list or an extra field, is not', () => {
    expect(backupKeyIsEmpty(spec, absent)).toBe(true); expect(backupKeyIsEmpty(spec, ok({ ...D }))).toBe(true); expect(backupKeyIsEmpty(spec, ok({ responsibility: [...D.responsibility] }))).toBe(true);
    for (const own of [[...D.responsibility, 'Own entry'], D.responsibility.slice(1), [...D.responsibility].reverse(), []]) expect(backupKeyIsEmpty(spec, ok({ ...D, responsibility: own })), JSON.stringify(own)).toBe(false);
    expect(backupKeyIsEmpty(spec, ok({ ...D, extra: 1 }))).toBe(false); expect(backupKeyIsEmpty(spec, ok('text'))).toBe(false); expect(backupKeyIsEmpty(spec, { state: 'bad' })).toBe(false);
    expect(backupKeyIsEmpty(tatNames, ok(tatNames.defaults))).toBe(true); expect(backupKeyIsEmpty(tatNames, ok(['Own']))).toBe(false); expect(backupKeyIsEmpty(tatNames, ok({ a: 1 }))).toBe(false);
  });
  it('Emergency Lighting: the old default Type list counts as the default (the module swaps it when it opens); a different list does not', () => {
    expect(backupKeyIsEmpty(elt, ok({ ...elt.defaults, types: ['Emergency Exit Sign', 'Combination Unit (Sign + 2 Side Lights)'] }))).toBe(true); expect(backupKeyIsEmpty(elt, ok({ ...elt.defaults, types: ['Spitfire'] }))).toBe(false);
  });
  it('a key is written WHOLE from the backup: a list as it is, a key of named lists with the default where the backup holds none; the backup\'s own default, blanks and fields the app does not know fill nothing', () => {
    const w = backupKeyFill(spec, absent, { responsibility: ['A'], rectified: ['B'], retired: ['x'] }); expect(w).toEqual({ created: true, whole: false, was: undefined, wrote: { ...D, responsibility: ['A'], rectified: ['B'] } });
    expect(backupKeyFill(spec, ok({ ...D }), { responsibility: ['A'] })).toMatchObject({ created: false, was: D, wrote: { ...D, responsibility: ['A'] } });
    expect(backupKeyFill(tatNames, absent, ['Mixer'])).toEqual({ created: true, whole: true, was: undefined, wrote: ['Mixer'] }); expect(backupKeyFill(tatNames, absent, [...tatNames.defaults])).toBeNull(); expect(backupKeyFill(tatNames, absent, 'text')).toBeNull();
    expect(backupKeyFill(tatDef, absent, { equipType: 'Kettle', freq: '  ', retired: 'x' }).wrote).toEqual({ ...tatDef.defaults, equipType: 'Kettle' });        // a blank text is ignored; the default stays where the backup brought none
    expect(backupKeyFill(spec, absent, { ...D })).toBeNull(); expect(backupKeyFill(spec, absent, { responsibility: 'not a list' })).toBeNull(); expect(backupKeyFill(spec, absent, ['not', 'an', 'object'])).toBeNull();
    expect(backupKeyFill(elt, ok({ ...elt.defaults }), { types: ['Mine'] }).wrote.types).toEqual(['Mine']); expect(backupDeepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true); expect(backupDeepEqual([1, 2], [2, 1])).toBe(false); expect(backupDeepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
  });
});

describe('a restore into an empty phone', () => {
  it('fills the business details, the company logo and every module\'s lists; rcd-mode, iel-cat and the photo-migration markers stay out; the sites come back exactly as before', async () => {
    let src; const file = await backupOf(async () => { await full(); rawSetItem('rcd-mode-v6', '"push"'); rawSetItem('iel-cat-v2', '"estops"'); rawSetItem('swb-photos-migrated-v1', '2026-01-01T00:00:00.000Z'); src = await snap(); });
    const r = await backupRestore(file, { storage: S, now: NOW }); expect(r.ok).toBe(true);
    expect(r.summary).toMatchObject({ sitesAdded: 11, snapshotsAdded: 11, eventsAdded: 2, photosWritten: 6, alreadyOnPhone: 0, notRestored: 0 }); expect(r.summary.filled).toEqual({ business: ['businessName', 'abn', 'licence'], logo: true, modules: 9 });
    expect(parsed('app-settings-v1')).toEqual(BIZ); for (const [k, v] of Object.entries(CUSTOM())) expect(parsed(k), k).toEqual(v);
    const now = await snap(); expect(now.idb['sparkcheck-app-settings']).toEqual(src.idb['sparkcheck-app-settings']);                                  // the logo, byte for byte
    for (const k of ['rcd-mode-v6', 'iel-cat-v2', 'swb-photos-migrated-v1']) expect(now.ls[k], k).toBeUndefined();
    expect(Object.keys(now.ls).sort()).toEqual([...Object.keys(src.ls).filter(k => !['rcd-mode-v6', 'iel-cat-v2', 'swb-photos-migrated-v1'].includes(k)), RESTORE_KEY].sort());
    for (const k of ['rcd-projects-v6', 'rcd-results-v6', 'rcd-history-v6', 'swb-projects-v1', 'gsd-projects-v1', 'cal-events-v1']) expect(now.ls[k], k).toBe(src.ls[k]);
    expect(backupFilledText(r.summary.filled)).toBe('the business details (business name, ABN, licence and company logo) and lists and settings in 9 modules');
  });
  it('Undo takes out exactly what the restore added, the business details, the logo and the lists included: the phone is empty again, byte for byte', async () => {
    const file = await backupOf(full); const before = await snap(); expect(before.ls).toEqual({});
    const r = await backupRestore(file, { storage: S, now: NOW }); expect(r.ok).toBe(true); expect(Object.keys((await snap()).ls).length).toBeGreaterThan(40);
    const u = await backupUndo({ storage: S, now: NOW }); expect(u.ok).toBe(true); expect(u.unfilled).toMatchObject({ fields: ['businessName', 'abn', 'licence'], logo: true, lists: 9, kept: 0, keptBiz: false, keptModules: 0 });
    const after = await snap(); expect(after.ls).toEqual({}); expect(after.idb).toEqual(before.idb);
  });
  it('the undo question counts what was filled; with nothing filled it is the old question word for word', async () => {
    const file = await backupOf(full); await backupRestore(file, { storage: S, now: NOW }); const info = backupUndoInfo(S, NOW);
    expect(info.counts.settings).toEqual({ biz: 3, logo: 1, lists: 13, modules: 9 }); expect(backupUndoConfirmText(info)).toBe('Undo the last restore? This removes the 11 sites, 11 History snapshots and 2 calendar events it added, with their photos, and any work you have done in them since. It also takes out the business details, logo, lists and settings it filled in, unless you have changed them since; then they are left as they are. Everything else is left as it is.');
    expect(backupUndoConfirmText({ counts: { sites: 1, snapshots: 0, events: 0 } })).toBe('Undo the last restore? This removes the 1 site, 0 History snapshots and 0 calendar events it added, with their photos, and any work you have done in them since. Everything else is left as it is.');
  });
});

describe('a restore into a phone with values of its own: a set is filled whole or not at all; everything not filled is byte-identical afterwards', () => {
  // the Business tab is empty (spaces, blanks); the Test & Tag set, Rcd, IEL and the rest differ in the ways named in each test
  async function ownPhone() {
    seedPhone({ id: 'local', name: 'Local Site', snapId: 'hl' });
    rawSetItem('app-settings-v1', JSON.stringify({ businessName: '   ', abn: '', licence: null, logoId: null, extra: 'kept' }));
    rawSetItem('rcd-dropdowns-v6', JSON.stringify({ responsibility: ['Own R'], rectified: ['Removed from Service', 'Scheduled for Repair', 'Replacement Required', 'Fuse Replaced & Retested', 'Circuit Isolated', 'Under Investigation', 'No Action Required'], ampRating: [], cbType: ['MCB'] }));
    rawSetItem('tat-names-v1', JSON.stringify(['My Drill'])); rawSetItem('iel-dropdowns-v1', JSON.stringify({ responsibility: ['A', 'B'], rectified: ['C'] }));
  }
  const FILLED_MODS = ['thermo', 'swb', 'irt', 'elt', 'welder', 'gsd'];                                          // rcd, iel and tat differ on this phone, so each is left alone as a whole
  it('an empty business set is filled whole; a module with ANY list of its own is left alone WHOLE (Test & Tag: all five keys, also the four still at the default); the other modules fill; every other byte is unchanged', async () => {
    const file = await backupOf(full); await wipe(); await ownPhone(); const before = await snap();
    const r = await backupRestore(file, { storage: S, now: NOW }); expect(r.ok).toBe(true); expect(r.summary.filled).toEqual({ business: ['businessName', 'abn', 'licence'], logo: true, modules: 6 });
    expect(parsed('app-settings-v1')).toEqual({ businessName: 'Example Electrical Pty Ltd', abn: '12 345 678 901', licence: '123456C', logoId: 'logo', extra: 'kept' });
    for (const mod of ['rcd', 'iel', 'tat']) for (const k of keysOf(mod)) expect(localStorage.getItem(k), k + ' (module ' + mod + ' left alone)').toBe(before.ls[k] === undefined ? null : before.ls[k]);
    for (const mod of FILLED_MODS) for (const k of keysOf(mod)) expect(parsed(k), k).toEqual(CUSTOM()[k]);
    expectUntouched(before, await snap(), ['app-settings-v1', ...FILLED_MODS.flatMap(keysOf)], true);
  });
  it('Undo reverses only the fills: the phone is exactly as before the restore', async () => {
    const file = await backupOf(full); await wipe(); await ownPhone(); const before = await snap();
    await backupRestore(file, { storage: S, now: NOW }); const u = await backupUndo({ storage: S, now: NOW }); expect(u.ok).toBe(true); expect(u.unfilled).toMatchObject({ lists: 6, kept: 0 });
    const after = await snap(); expect(after.ls).toEqual(before.ls); expect(after.idb).toEqual(before.idb);
  });
  it('a phone with ONLY a business name: no business detail is filled (not the ABN, not the licence, not the logo; the key is byte-identical); the lists and settings of modules still at the defaults are', async () => {
    const file = await backupOf(full); await wipe(); seedPhone({ id: 'local', name: 'Local Site', snapId: 'hl' }); rawSetItem('app-settings-v1', JSON.stringify({ businessName: 'Mine Pty' })); const before = await snap();
    const r = await backupRestore(file, { storage: S, now: NOW }); expect(r.ok).toBe(true); expect(r.summary.filled).toEqual({ business: [], logo: false, modules: 9 });
    expect(localStorage.getItem('app-settings-v1')).toBe(before.ls['app-settings-v1']); expect((await snap()).idb['sparkcheck-app-settings']).toEqual({});
    expectUntouched(before, await snap(), MODS.flatMap(keysOf), false);
    const u = await backupUndo({ storage: S, now: NOW }); expect(u.ok).toBe(true); const after = await snap(); expect(after.ls).toEqual(before.ls); expect(after.idb).toEqual(before.idb);
  });
  it('any ONE of name, ABN, licence or logo set on the phone keeps all four: nothing from the backup\'s business details is filled', async () => {
    const file = await backupOf(full);
    for (const own of [{ businessName: 'Mine' }, { abn: '99 999' }, { licence: 'MY1' }, { logo: true }]) {
      await wipe(); seedPhone({ id: 'local', name: 'Local Site', snapId: 'hl' }); if (own.logo) await appLogoStore.put(rec(99)); else rawSetItem('app-settings-v1', JSON.stringify({ businessName: '', abn: '', licence: '', logoId: null, ...own }));
      const before = await snap(); const r = await backupRestore(file, { storage: S, now: NOW }); expect(r.ok, JSON.stringify(own)).toBe(true); expect(r.summary.filled, JSON.stringify(own)).toMatchObject({ business: [], logo: false });
      expect(localStorage.getItem('app-settings-v1'), JSON.stringify(own)).toBe(before.ls['app-settings-v1'] === undefined ? null : before.ls['app-settings-v1']); expect((await snap()).idb['sparkcheck-app-settings'], JSON.stringify(own)).toEqual(before.idb['sparkcheck-app-settings']);
    }
  });
  it('a logo the phone has stays whatever the bytes; so does its flag; a logo record with no flag counts as a logo too (the texts stay empty)', async () => {
    const file = await backupOf(full); await wipe(); seedPhone({ id: 'local', name: 'Local Site', snapId: 'hl' }); rawSetItem('app-settings-v1', JSON.stringify({ businessName: '', abn: '', licence: '', logoId: 'logo' })); await appLogoStore.put(rec(99));
    const mine = (await idbSnapshot())['sparkcheck-app-settings'].logo; const r = await backupRestore(file, { storage: S, now: NOW }); expect(r.ok).toBe(true); expect(r.summary.filled.logo).toBe(false);
    expect((await idbSnapshot())['sparkcheck-app-settings'].logo).toEqual(mine); expect(parsed('app-settings-v1')).toEqual({ businessName: '', abn: '', licence: '', logoId: 'logo' });
    await wipe(); seedPhone({ id: 'local', name: 'Local Site', snapId: 'hl' }); await appLogoStore.put(rec(98)); const r2 = await backupRestore(file, { storage: S, now: NOW }); expect(r2.ok).toBe(true);
    expect((await idbSnapshot())['sparkcheck-app-settings'].logo.bytes).toEqual([98]); expect(localStorage.getItem('app-settings-v1')).toBeNull();
  });
  it('a flag with no logo record behind it (the logo file is missing) and no texts counts as an empty set: the texts and the logo record are filled together, the flag stays as it is', async () => {
    const file = await backupOf(full); await wipe(); seedPhone({ id: 'local', name: 'Local Site', snapId: 'hl' }); rawSetItem('app-settings-v1', JSON.stringify({ businessName: '', logoId: 'logo' }));
    const r = await backupRestore(file, { storage: S, now: NOW }); expect(r.ok).toBe(true); expect(r.summary.filled).toMatchObject({ business: ['businessName', 'abn', 'licence'], logo: true }); expect((await idbSnapshot())['sparkcheck-app-settings'].logo).toBeTruthy();
    const u = await backupUndo({ storage: S, now: NOW }); expect(u.ok).toBe(true); expect((await idbSnapshot())['sparkcheck-app-settings']).toEqual({}); expect(parsed('app-settings-v1')).toMatchObject({ businessName: '', logoId: 'logo' });
  });
  it('a backup without a saved logo flag brings no logo (an unsaved upload on the source phone is not a logo); its texts still fill an empty set', async () => {
    const file = await backupOf(async () => { await full(); rawSetItem('app-settings-v1', JSON.stringify({ ...BIZ, logoId: null })); }); await wipe();
    const r = await backupRestore(file, { storage: S, now: NOW }); expect(r.ok).toBe(true); expect(r.summary.filled.logo).toBe(false); expect(r.summary.filled.business).toEqual(['businessName', 'abn', 'licence']); expect((await idbSnapshot())['sparkcheck-app-settings']).toEqual({});
  });
});

describe('Undo when the person changed a filled set after the restore: that WHOLE set is left alone', () => {
  const restored = async () => { const file = await backupOf(full); await backupRestore(file, { storage: S, now: NOW }); };
  it('one business field edited: the whole business set stays (name, ABN, licence AND logo); the lists in every module the person did not change are taken out; the card counts the set', async () => {
    await restored(); const b = parsed('app-settings-v1'); rawSetItem('app-settings-v1', JSON.stringify({ ...b, abn: '99 999 999 999' }));
    const u = await backupUndo({ storage: S, now: NOW }); expect(u.ok).toBe(true); expect(u.unfilled).toMatchObject({ fields: [], logo: false, lists: 9, kept: 1, keptBiz: true, keptModules: 0 });
    expect(parsed('app-settings-v1')).toEqual({ ...BIZ, abn: '99 999 999 999' }); expect((await idbSnapshot())['sparkcheck-app-settings'].logo.bytes).toEqual([10, 11, 12]); expect(localStorage.getItem('tat-names-v1')).toBeNull();
  });
  it('the logo replaced: the whole business set stays, the texts too', async () => {
    await restored(); await appLogoStore.put(rec(77));
    const u = await backupUndo({ storage: S, now: NOW }); expect(u.ok).toBe(true); expect(u.unfilled).toMatchObject({ fields: [], logo: false, kept: 1, keptBiz: true }); expect(parsed('app-settings-v1')).toEqual(BIZ); expect((await idbSnapshot())['sparkcheck-app-settings'].logo.bytes).toEqual([77]);
  });
  it('the name emptied and the logo removed after the restore: nothing is brought back, and the set is counted as changed (it no longer holds what the restore wrote)', async () => {
    await restored(); rawSetItem('app-settings-v1', JSON.stringify({ ...parsed('app-settings-v1'), businessName: '', logoId: null })); await appLogoStore.del();
    const u = await backupUndo({ storage: S, now: NOW }); expect(u.ok).toBe(true); expect(u.unfilled).toMatchObject({ fields: [], logo: false, keptBiz: true, kept: 1 }); expect(parsed('app-settings-v1')).toMatchObject({ businessName: '', abn: '12 345 678 901', logoId: null });
  });
  it('one list edited in a module: the whole module stays (Test & Tag: all five keys); the other modules are taken out', async () => {
    await restored(); const t = parsed('tat-names-v1'); rawSetItem('tat-names-v1', JSON.stringify([...t, 'My own appliance']));
    const rd = parsed('rcd-dropdowns-v6'); rawSetItem('rcd-dropdowns-v6', JSON.stringify({ ...rd, responsibility: [...rd.responsibility, 'My own entry'] }));
    const u = await backupUndo({ storage: S, now: NOW }); expect(u.ok).toBe(true); expect(u.unfilled).toMatchObject({ fields: ['businessName', 'abn', 'licence'], logo: true, lists: 7, kept: 2, keptBiz: false, keptModules: 2 });
    for (const k of keysOf('tat')) expect(localStorage.getItem(k), k).not.toBeNull(); expect(parsed('tat-names-v1')).toContain('My own appliance'); expect(parsed('rcd-dropdowns-v6').responsibility).toContain('My own entry');
    for (const mod of MODS.filter(m => !['tat', 'rcd'].includes(m))) for (const k of keysOf(mod)) expect(localStorage.getItem(k), k + ' is taken out').toBeNull();
  });
  it('a key the restore did NOT fill counts too: if the person starts a list in it, the module is theirs', async () => {
    const file = await backupOf(async () => { rawSetItem('tat-names-v1', JSON.stringify(['Only Names'])); }); await backupRestore(file, { storage: S, now: NOW }); expect(parsed('tat-names-v1')).toEqual(['Only Names']); expect(localStorage.getItem('tat-freqs-v1')).toBeNull();
    rawSetItem('tat-freqs-v1', JSON.stringify(['Weekly']));
    const u = await backupUndo({ storage: S, now: NOW }); expect(u.ok).toBe(true); expect(u.unfilled).toMatchObject({ lists: 0, kept: 1, keptModules: 1 }); expect(parsed('tat-names-v1')).toEqual(['Only Names']); expect(parsed('tat-freqs-v1')).toEqual(['Weekly']);
  });
});

describe('an undo record made by the previous release', () => {
  it('has no "filled" part: Undo takes out the sites, events and photos as it always did and leaves the items the restore filled alone', async () => {
    const file = await backupOf(full); await backupRestore(file, { storage: S, now: NOW }); const r = JSON.parse(localStorage.getItem(RESTORE_KEY)); delete r.undo.filled; delete r.undo.counts.settings; rawSetItem(RESTORE_KEY, JSON.stringify(r));
    const u = await backupUndo({ storage: S, now: NOW }); expect(u.ok).toBe(true); expect(u.removed).toEqual({ sites: 11, snapshots: 11, events: 2 }); expect(u.unfilled).toEqual({ fields: [], business: {}, logo: false, lists: 0, kept: 0, keptBiz: false, keptModules: 0 });
    expect(parsed('app-settings-v1')).toEqual(BIZ); expect(localStorage.getItem('rcd-projects-v6')).toBeNull(); expect(backupUndoConfirmText({ counts: r.undo.counts })).not.toContain('filled in');
  });
});

describe('failure: the phone is exactly as it was', () => {
  const ownPhone = async () => { seedPhone({ id: 'local', name: 'Local Site', snapId: 'hl' }); rawSetItem('app-settings-v1', JSON.stringify({ businessName: ' ', abn: '' })); rawSetItem('rcd-dropdowns-v6', JSON.stringify({ responsibility: ['Own'], rectified: ['x'] })); };
  it('a setItem that fails at ANY point (every one of the restore\'s writes in turn) leaves every key and every record byte for byte as it was', async () => {
    const file = await backupOf(full); let ok = 0;
    for (let n = 1; n <= 80 && !ok; n++) {
      await wipe(); await ownPhone(); const before = await snap();
      const r = await backupRestore(file, { storage: failingNth(n), now: NOW });
      if (r.ok) { ok = n; break; } expect(r.ok, 'write ' + n).toBe(false); const now = await snap(); expect(now.ls, 'write ' + n).toEqual(before.ls); expect(now.idb, 'write ' + n).toEqual(before.idb);
    }
    expect(ok).toBeGreaterThan(15);
  });
  it('a tab killed after the keys are written (before the commit) is put back at the next start, the business details and the logo included', async () => {
    const file = await backupOf(full); await wipe(); await ownPhone(); const before = await snap();
    await expect(backupRestore(file, { storage: S, now: NOW, crashAt: crashAt('keys-done') })).rejects.toBeInstanceOf(BackupCrash);
    expect(parsed('app-settings-v1').abn).toBe('12 345 678 901'); backupRecoverAtStart(S); await backupFinishRecovery(S);
    const now = await snap(); expect(now.ls).toEqual(before.ls); expect(now.idb).toEqual(before.idb);
  });
});

describe('nothing to add, and settings alone', () => {
  it('a backup whose sites and events are all here and whose items are all set is "nothing to add" and writes nothing', async () => {
    const file = await backupOf(full); await full(); const before = await snap();
    const r = await backupRestore(file, { storage: S, now: NOW }); expect(r.ok).toBe(false); expect(r.code).toBe('nothing'); expect(await snap()).toEqual(before);
  });
  it('a backup that adds only lists (every site and event already here) is a real restore: the business name the phone has keeps the business set closed, RCD and Test & Tag (the phone\'s own lists) stay, the other seven modules fill; Undo removes only those', async () => {
    const file = await backupOf(full); await wipe(); await seedSourceFull(); const before = await snap();
    const plan = await backupPlan(file, { storage: S }); expect(plan.nothingToAdd).toBe(false); expect(plan.counts).toMatchObject({ sitesAdd: 0, eventsAdd: 0, settingsAdd: 7 }); expect(plan.settings).toMatchObject({ biz: [], bizKept: true, logo: false });
    expect([...new Set(plan.settings.lists.map(l => l.mod))].sort()).toEqual(['elt', 'gsd', 'iel', 'irt', 'swb', 'thermo', 'welder']); expect([...new Set(plan.settings.listsKept.map(l => l.mod))].sort()).toEqual(['rcd', 'tat']);
    const r = await backupRestore(file, { storage: S, now: NOW }); expect(r.ok).toBe(true); expect(r.summary).toMatchObject({ sitesAdded: 0, eventsAdded: 0 }); expect(parsed('iel-dropdowns-v1')).toEqual(CUSTOM()['iel-dropdowns-v1']);
    expect(localStorage.getItem('tat-names-v1')).toBeNull(); expect(localStorage.getItem('rcd-dropdowns-v6')).toBe('{"responsibility":["A"]}'); expect(localStorage.getItem('app-settings-v1')).toBe(before.ls['app-settings-v1']);
    const u = await backupUndo({ storage: S, now: NOW }); expect(u.ok).toBe(true); const after = await snap(); expect(after.ls).toEqual(before.ls); expect(after.idb).toEqual(before.idb);
  });
});

describe('old backups (made by the code of releases j, k, l and m: the files are byte-identical)', () => {
  const OLD = fs.readFileSync(process.cwd() + '/src/test/fixtures/backup-release-j-to-m.zip');
  const oldFile = () => new File([OLD], 'old.zip', { type: 'application/zip' });
  it('restore into an empty phone adds the same sites, History, events, photos and logos as before, and now also the business details, the logo and the lists the file holds', async () => {
    const r = await backupRestore(oldFile(), { storage: S, now: NOW }); expect(r.ok).toBe(true);
    expect(r.summary).toMatchObject({ sitesAdded: 11, snapshotsAdded: 11, eventsAdded: 2, photosWritten: 6, alreadyOnPhone: 0, notRestored: 0, undoUntil: '2026-10-25' });
    expect(parsed('app-settings-v1')).toEqual(BIZ); expect((await idbSnapshot())['sparkcheck-app-settings'].logo.bytes).toEqual([10, 11, 12]);
    const z = await zipOpen(new File([OLD], 'old.zip')), data = JSON.parse(new TextDecoder().decode(await z.bytes('data.json')));
    for (const spec of BACKUP_LIST_SPECS()) expect(parsed(spec.key), spec.key).toEqual(JSON.parse(data[spec.key]));                              // every list the file holds, as the file holds it
    for (const k of ['rcd-mode-v6', 'iel-cat-v2', 'swb-photos-migrated-v1']) expect(data[k], k + ' is in the file').toBeDefined(); for (const k of ['rcd-mode-v6', 'iel-cat-v2', 'swb-photos-migrated-v1']) expect(localStorage.getItem(k), k + ' is not restored').toBeNull();
  });
  it('into a phone with its own business name and its own Test & Tag list: the business details and the Test & Tag set stay byte-identical; the other eight modules fill; Undo returns the phone exactly', async () => {
    seedPhone({ id: 'local', name: 'Local Site', snapId: 'hl' }); rawSetItem('app-settings-v1', JSON.stringify({ businessName: 'Mine Pty' })); rawSetItem('tat-names-v1', JSON.stringify(['My Drill'])); const before = await snap();
    const r = await backupRestore(oldFile(), { storage: S, now: NOW }); expect(r.ok).toBe(true); expect(r.summary.filled).toEqual({ business: [], logo: false, modules: 8 });
    expect(localStorage.getItem('app-settings-v1')).toBe(before.ls['app-settings-v1']); for (const k of keysOf('tat')) expect(localStorage.getItem(k), k).toBe(before.ls[k] === undefined ? null : before.ls[k]);
    expectUntouched(before, await snap(), MODS.filter(m => m !== 'tat').flatMap(keysOf), false);
    const u = await backupUndo({ storage: S, now: NOW }); expect(u.ok).toBe(true); const after = await snap(); expect(after.ls).toEqual(before.ls); expect(after.idb).toEqual(before.idb);
  });
});

describe('a set that stops being empty between the plan and the writes: the restore does not start, so nothing is half filled', () => {
  it('the Business tab typed into, a module list changed or a module key that cannot be read: the step that builds the writes refuses, and says which set', async () => {
    const file = await backupOf(full); await wipe();
    let plan = await backupPlan(file, { storage: S }); expect(plan.work.settings.biz).toBeTruthy(); expect(backupSettingsInserts(plan.work.settings, S).length).toBeGreaterThan(10);      // nothing changed: it builds
    rawSetItem('app-settings-v1', JSON.stringify({ businessName: 'Typed meanwhile' })); expect(() => backupSettingsInserts(plan.work.settings, S)).toThrow(/the Business tab changed while the restore was starting/);
    await wipe(); plan = await backupPlan(file, { storage: S }); rawSetItem('tat-freqs-v1', JSON.stringify(['Own'])); expect(() => backupSettingsInserts(plan.work.settings, S)).toThrow(/the lists for tat changed while the restore was starting/);
    await wipe(); plan = await backupPlan(file, { storage: S }); rawSetItem('rcd-dropdowns-v6', '{not json'); expect(() => backupSettingsInserts(plan.work.settings, S)).toThrow(/this phone's lists for rcd can't be read/);
    await wipe(); plan = await backupPlan(file, { storage: S }); rawSetItem('app-settings-v1', '[1]'); expect(() => backupSettingsInserts(plan.work.settings, S)).toThrow(/can't be read/);
  });
});

describe('the plan counts SETS, not fields', () => {
  it('an empty phone and a backup holding everything: one business set and nine module sets = 10 (not 3 texts + logo + 13 list keys)', async () => {
    const file = await backupOf(full); const plan = await backupPlan(file, { storage: S });
    expect(plan.counts.settingsAdd).toBe(10); expect(new Set(plan.settings.lists.map(l => l.mod)).size).toBe(9); expect(plan.settings.lists.length).toBe(13);
  });
});

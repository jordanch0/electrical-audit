// THE WORDS OF THE RESTORE SCREEN (Round c). FICTIONAL data. backupSummaryText(plan) and backupMessageText(code, plan) are pure: every sentence is checked here. Lists are capped at 10 lines per group with "and N more"; every
// total is exact whatever is shown; no internal key name, file name or technical word ever appears.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { backupPlan, backupSummaryText, backupMessageText, backupMbText, BACKUP_LIST_CAP, BACKUP_MODULES, BACKUP_MODULE_INFO } from './App.jsx';
import { seedPhone, seedModule, FM, wipe, backupOf, seedSourceFull } from './test/backup-fixtures.js';

const MB = 1024 * 1024;
const LABEL = Object.fromEntries(BACKUP_MODULES.map(m => [m, BACKUP_MODULE_INFO[m].label]));
const names = (prefix, n) => Array.from({ length: n }, (_, i) => ({ id: prefix + i, name: prefix + ' ' + (i + 1) }));
// a plan with only what the builder reads
const mk = (o = {}) => { const mods = BACKUP_MODULES.map(id => ({ id, label: LABEL[id], status: 'nothing', sites: { add: [], present: [], conflict: [] }, snapshots: { add: 0 } }));
  for (const [id, part] of Object.entries(o.mods || {})) Object.assign(mods.find(m => m.id === id).sites, part.sites || {}), Object.assign(mods.find(m => m.id === id), { status: part.status || 'nothing' });
  const sum = k => mods.reduce((n, m) => n + m.sites[k].length, 0);
  return { ok: true, canRestore: true, includesPhotos: true, modules: mods, events: o.events || { status: 'nothing', add: [], present: [] }, unknownKeys: o.unknownKeys || [], summary: { deviceLocalDate: '2026-10-05', fileBytes: 41 * MB },
    counts: { sitesAdd: sum('add'), sitesPresent: sum('present'), sitesConflict: sum('conflict'), snapshotsAdd: o.snaps || 0, eventsAdd: (o.events && o.events.add.length) || 0, eventsPresent: (o.events && o.events.present.length) || 0 },
    work: { writes: o.writes || [] }, headroom: o.headroom || { ok: true, storage: { known: true, ok: true } }, ...(o.top || {}) }; };
const group = (t, id) => t.groups.find(g => g.id === id);
const allText = t => JSON.stringify(t);
beforeEach(wipe);

describe('the summary of a real plan', () => {
  it('an empty phone and the full source: exact totals in words, the added list capped at 10 with "and 1 more", names with their module, three groups at most, no key names', async () => {
    const file = await backupOf(seedSourceFull); const plan = await backupPlan(file, { estimate: async () => ({ quota: 1e9, usage: 0 }) }); const t = backupSummaryText(plan);
    expect(t.title).toMatch(/^This backup, made \d{2}\/\d{2}\/\d{4} \(under 1 MB\)$/); expect(t.canRestore).toBe(true);
    expect(t.groups.map(g => g.id)).toEqual(['added']); const g = group(t, 'added');
    expect(g).toMatchObject({ mark: '✓', heading: 'Will be added', summary: '11 sites, 11 History snapshots, 2 calendar events, 3 photos and 1 logo', more: 1 }); expect(g.lines.length).toBe(10);
    expect(g.lines[0]).toBe('Site One (RCD Testing)'); expect(g.lines[4]).toBe('Site One (Switchboard)'); expect(g.lines.length + g.more).toBe(11);
    expect(t.notes).toEqual(['There is enough free space.', 'Nothing already on this phone is changed or deleted.']);
    expect(allText(t)).not.toMatch(/-v\d|projects|results|\.json|rcd-|swb-|iel-/);
  });
  it('a phone that already has some of it: "Already on this phone" with the name it has here, and a calendar event', async () => {
    const file = await backupOf(() => { seedPhone(); rawSetItem('cal-events-v1', JSON.stringify([{ id: 'e1', type: 'RCD', site: 'A', dueDate: '2026-11-01' }])); });
    seedPhone({ name: 'Renamed Here' }); rawSetItem('cal-events-v1', JSON.stringify([{ id: 'e1', type: 'RCD', site: 'A', dueDate: '2026-11-01' }]));
    const t = backupSummaryText(await backupPlan(file)); expect(t.groups.map(g => g.id)).toEqual(['present']); const g = group(t, 'present');
    expect(g).toMatchObject({ mark: '○', heading: 'Already on this phone (left exactly as they are)', summary: '9 sites and 1 calendar event', more: 0 }); expect(g.lines[0]).toBe('Site One (RCD Testing), called "Renamed Here" here');
  });
  it('returns nothing for a plan that failed', () => { expect(backupSummaryText({ ok: false, code: 'damaged' })).toBeNull(); expect(backupSummaryText(null)).toBeNull(); expect(backupSummaryText(undefined)).toBeNull(); });
});

describe('lists are capped at 10 per group with "and N more"; totals are always exact', () => {
  it.each([[0], [1], [9], [10], [11], [25], [1000]])('%i sites to add', n => {
    const t = backupSummaryText(mk({ mods: { rcd: { sites: { add: names('Site', n) } } }, snaps: n }));
    if (!n) { expect(t.groups).toEqual([]); return; }
    const g = group(t, 'added'); expect(g.lines.length).toBe(Math.min(n, BACKUP_LIST_CAP)); expect(g.more).toBe(Math.max(0, n - BACKUP_LIST_CAP)); expect(g.lines.length + g.more).toBe(n);
    expect(g.summary).toBe(`${n} site${n === 1 ? '' : 's'} and ${n} History snapshot${n === 1 ? '' : 's'}`);                      // exact, whatever is shown
    expect(g.lines[0]).toBe('Site 1 (RCD Testing)');
  });
  it('the cap is per group: 25 to add, 12 already here, 15 not restored', () => {
    const t = backupSummaryText(mk({ mods: { rcd: { sites: { add: names('A', 25), present: names('P', 12), conflict: names('C', 15).map(x => ({ ...x, reason: 'conflicting photos', keys: 1 })) } } } }));
    expect([group(t, 'added'), group(t, 'present'), group(t, 'skipped')].map(g => [g.lines.length, g.more])).toEqual([[10, 15], [10, 2], [10, 5]]);
    expect(group(t, 'present').summary).toBe('12 sites'); expect(group(t, 'skipped').summary).toBe('');
  });
  it('the groups are in the order: added, already here, not restored; modules in the app\'s order; photos and logos counted without thumbnails', () => {
    const t = backupSummaryText(mk({ mods: { gsd: { sites: { add: names('G', 1) } }, rcd: { sites: { add: names('R', 1) } } }, writes: [{ store: 'site-photos', key: 'a' }, { store: 'site-photos', key: 'a~t' }, { store: 'gsd-photos', key: 'b' }, { store: 'gsd-photos', key: 'b~t' }, { store: 'site-logos', key: 'swb:s2' }] }));
    expect(group(t, 'added').lines).toEqual(['R 1 (RCD Testing)', 'G 1 (General Site Defects)']); expect(group(t, 'added').summary).toBe('2 sites, 2 photos and 1 logo');
  });
});

describe('what is not restored, in plain words', () => {
  it('every reason, once each, with the module or site in front, no key names', () => {
    const t = backupSummaryText(mk({ mods: {
      welder: { sites: { conflict: [{ id: 'w1', name: 'Gate 4', reason: 'conflicting photos', keys: 2 }] } }, rcd: { sites: { conflict: [{ id: 'r1', name: 'Yard', reason: 'existing data under the same ID', keys: 0 }] } },
      elt: { status: 'skipped-version' }, iel: { status: 'unreadable-here' }, tat: { status: 'unreadable-backup' } }, events: { status: 'unreadable-here', add: [], present: [] }, unknownKeys: ['client-acme-notes', 'some-other-app-key'] }));
    expect(group(t, 'skipped')).toMatchObject({ mark: '✕', heading: 'Not restored', more: 0 });
    expect(group(t, 'skipped').lines).toEqual(['Yard (RCD Testing): this phone already holds leftover data for it', "IEL Testing: this phone's saved data for it could not be read, so nothing was added", 'Test & Tag: the data in the file could not be read, so it was not added',
      'Emergency Lighting: made by a different version of SparkCheck, so it was not added', 'Gate 4 (Welder Testing): its photos differ from photos already on this phone', "Calendar events: this phone's saved data for them could not be read, so nothing was added", '2 items that are not SparkCheck data were ignored']);
  });
  it('one unrecognised item is singular', () => { expect(group(backupSummaryText(mk({ unknownKeys: ['x'] })), 'skipped').lines).toEqual(['1 item that is not SparkCheck data was ignored']); });
  it('NO KEY NAMES: a plan whose own notes, statuses and unknown keys are full of them produces text with none of them', () => {
    const plan = mk({ mods: { rcd: { status: 'skipped-version' }, swb: { status: 'unreadable-here' } }, unknownKeys: ['rcd-projects-v5', 'elt-projects-v1', 'client-acme-notes'] });
    plan.modules[0].note = 'This backup stores RCD Testing in a different format version (rcd-projects-v5 instead of rcd-projects-v6), so it was not restored.';
    const txt = allText(backupSummaryText(plan)); for (const bad of ['rcd-projects', 'elt-projects', 'client-acme', 'format version', '-v5', '-v6', '.json', 'zip']) expect(txt, bad).not.toContain(bad);
  });
});

describe('notes and the title', () => {
  it('a backup without photos says so; free space known or unknown; the last note is always there', () => {
    expect(backupSummaryText(mk({ top: { includesPhotos: false } })).notes[0]).toBe('This backup was made without photos, so the restored sites will show without them.');
    expect(backupSummaryText(mk({ headroom: { ok: true, storage: { known: false, ok: true } }, writes: [{ store: 'site-photos', key: 'a' }] })).notes[0]).toMatch(/^This device cannot report free space, so it could not be checked in advance\./);
    expect(backupSummaryText(mk({ headroom: { ok: true, storage: { known: false, ok: true } } })).notes).toEqual(['Nothing already on this phone is changed or deleted.']);          // nothing to check: no remark
    for (const t of [mk(), mk({ top: { includesPhotos: false } })]) expect(backupSummaryText(t).notes.slice(-1)[0]).toBe('Nothing already on this phone is changed or deleted.');
  });
  it('the title: the day it was made (as d/m/y) and the file size in MB', () => {
    expect(backupMbText(0)).toBe('0 MB'); expect(backupMbText(500 * 1024)).toBe('under 1 MB'); expect(backupMbText(1.5 * MB)).toBe('1.5 MB'); expect(backupMbText(9.96 * MB)).toBe('10.0 MB'); expect(backupMbText(41.4 * MB)).toBe('41 MB'); expect(backupMbText(120.6 * MB)).toBe('121 MB'); expect(backupMbText(undefined)).toBe('0 MB');
    expect(backupSummaryText(mk()).title).toBe('This backup, made 05/10/2026 (41 MB)');
  });
  it('canRestore follows the plan', () => { expect(backupSummaryText(mk({ top: { canRestore: false } })).canRestore).toBe(false); });
});

describe('refusals and failures: short plain sentences', () => {
  const E = { 'not-a-backup': ['This file cannot be restored', 'This is not a SparkCheck backup file.'], 'wrong-format': ['This file cannot be restored', 'This is not a SparkCheck backup file.'], damaged: ['This file cannot be restored', 'This backup file is damaged, so it cannot be restored.'],
    invalid: ['This file cannot be restored', 'This backup file is not complete, so it cannot be restored.'], 'newer-version': ['This file cannot be restored', 'This backup was made by a newer version of SparkCheck. Update the app, then try again.'],
    nothing: ['Nothing to add', 'Everything in this backup is already on this phone, so there is nothing to add.'], unfinished: ['A restore is still being put right', 'A previous restore was interrupted and is still being put right. Close and reopen SparkCheck, then try again.'],
    shape: ['The restore did not start', 'Something on this phone is not in the form the restore expects, so nothing was added. Nothing was changed.'], journal: ['Not enough room to start', 'There is not enough room on this phone to start the restore. Free up some space, then try again. Nothing was changed.'],
    failed: ['The restore did not finish', 'The restore could not be completed. Everything was put back exactly as it was.'], rollback: ['The restore did not finish', "The restore could not be completed, and one part of this phone's saved data could not be read, so it was left as it was. Make a backup now and contact support, quoting this message."],
    none: ['Nothing to undo', 'There is no restore to undo.'], expired: ['Undo is no longer available', 'The undo period for the last restore has ended.'], 'undo-failed': ['The undo did not finish', 'The undo could not be completed. Nothing was changed.'] };
  it.each(Object.entries(E))('%s', (code, [title, body]) => { expect(backupMessageText(code)).toEqual({ title, body }); });
  it('not enough room: the numbers when the device reports them, otherwise the saved-data wording', () => {
    expect(backupMessageText('headroom', { headroom: { storage: { known: true, ok: false, needBytes: 118 * MB, quota: 200 * MB, usage: 140 * MB } } })).toEqual({ title: 'Not enough room', body: 'There is not enough free space for the photos. About 118 MB is needed and 60 MB is free. Free up some space, then try again. Nothing was changed.' });
    expect(backupMessageText('headroom', { headroom: { storage: { known: true, ok: true }, local: { ok: false } } }).body).toBe("There is not enough room in this phone's saved data for this restore. Free up some space by deleting sites, History or calendar events you no longer need, then try again. Nothing was changed.");
    expect(backupMessageText('headroom').title).toBe('Not enough room');
  });
  it('an unknown code gets a safe sentence, never the code', () => { expect(backupMessageText('weird-internal-code')).toEqual({ title: 'Something went wrong', body: 'That did not work. Nothing was changed.' }); expect(JSON.stringify(backupMessageText('weird-internal-code'))).not.toContain('weird'); });
  it('NO technical words in any sentence: no zip, format, checksum, stored, JSON, key or file names, version numbers', () => {
    for (const code of [...Object.keys(E), 'headroom', 'weird']) { const m = backupMessageText(code, { headroom: { storage: { known: true, ok: false, needBytes: 5 * MB, quota: 9 * MB, usage: 8 * MB } } }); expect(JSON.stringify(m), code).not.toMatch(/zip|format|checksum|stored correctly|json|-v\d|projects|results|\.bin|manifest|sha/i); }
  });
});

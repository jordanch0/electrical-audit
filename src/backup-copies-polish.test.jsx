// RELEASE O ON TOP OF RELEASE N (FICTIONAL data): the places where the copies of release o and the three polish items of release n meet.
//   - the restore progress counts PHOTOS only, and the photos that belong to copies are photos too: the last value is the total, which is the sum of the numbers the summary shows (the added sites' photos and each copy's)
//   - the Undo question and the "Restore undone" card leave out zero counts, say "History snapshot", and name the copies in the list ("2 site copies"); a copy you changed since is kept and counted
//   - Delete all data removes the note of restored copies (sparkcheck-copies-v1); a backup never contains it
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobalSettingsView, backupBuild, backupRestore, backupPlan, backupSummaryText, backupUndo, backupUndoInfo, backupLastBackupText, backupUndoConfirmText, backupUndoResultText, backupLastRestoreLine, eraseOwnedKeys, zipOpen, BACKUP_COPIES_KEY } from './App.jsx';
import { MODULES } from './test/item-dates-fixtures.js';
import { wipe } from './test/backup-fixtures.js';
import { SITES, seedLookAlike, diverge, removeSite } from './test/backup-copies-fixtures.js';

vi.setConfig({ testTimeout: 60000 }); configure({ asyncUtilTimeout: 10000 });
const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
const BACKUP_DAY = new Date(2026, 9, 5, 12, 0), RESTORE_DAY = new Date(2026, 9, 12, 12, 0);
const read = k => JSON.parse(localStorage.getItem(k));
const slowClock = () => { let t = 0; vi.spyOn(performance, 'now').mockImplementation(() => (t += 200)); };       // every progress event is delivered: nothing is throttled away
const SWB = MODULES.find(m => m.mod === 'swb'), RCD = MODULES.find(m => m.mod === 'rcd');
// the backup holds four look-alike sites; the phone then renamed pra, changed prb, lost pre and gained prc: so pra and prb come back as COPIES, pre as a plain added site. Each Switchboard site has 3 photos (+ thumbnails) and a logo.
async function scenario(f) { await wipe(); await seedLookAlike(f, SITES); const { blob } = await backupBuild({ now: BACKUP_DAY }); diverge(f); await removeSite(f, 'pre'); await seedLookAlike(f, [{ id: 'prc', name: 'Plant Room C', no: 5 }]); return blob; }
beforeEach(wipe); afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('the restore progress counts photos, the photos of copies included', () => {
  it('Switchboard: 1 added site and 2 copies, 3 photos each = 9 photos; the events run 1 to 9 of 9 (never thumbnails or logos), and 9 is the sum of the numbers the summary shows', async () => {
    const blob = await scenario(SWB);
    const plan = await backupPlan(blob, { storage: S, estimate: async () => ({ quota: 1e9, usage: 0 }) }); const sum = backupSummaryText(plan);
    const added = sum.groups.find(g => g.id === 'added'), copies = sum.groups.find(g => g.id === 'copies');
    expect(added.summary).toContain('3 photos'); expect(copies.lines.every(l => l.includes(': 3 photos, 1 History snapshot'))).toBe(true); expect(copies.lines.length).toBe(2);
    slowClock(); const events = []; const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY, onProgress: e => events.push(e) }); expect(r.ok, r.message).toBe(true);
    const photos = events.filter(e => e.phase === 'photos'); expect(photos.map(e => e.done)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]); expect(photos.every(e => e.total === 9)).toBe(true);
    expect(3 + copies.lines.length * 3).toBe(photos[photos.length - 1].total);
  });
  it('a restore that brings only copies in a module with no photos sends no photo events; the later phases still run', async () => {
    const blob = await scenario(RCD); slowClock(); const events = []; const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY, onProgress: e => events.push(e) }); expect(r.ok, r.message).toBe(true);
    expect(events.filter(e => e.phase === 'photos')).toEqual([]); expect(events.some(e => e.phase === 'verifying')).toBe(true); expect(events.some(e => e.phase === 'saving')).toBe(true);
  });
  it('a copy whose backup was made without photos brings no photos: no photo events, and the copy is still added', async () => {
    await wipe(); await seedLookAlike(SWB, SITES); const { blob } = await backupBuild({ now: BACKUP_DAY, includePhotos: false }); diverge(SWB); slowClock(); const events = [];
    const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY, onProgress: e => events.push(e) }); expect(r.ok, r.message).toBe(true);
    expect(r.summary.copiesAdded).toBe(2); expect(events.filter(e => e.phase === 'photos')).toEqual([]);
  });
});

describe('the Undo question names the copies and leaves out zero counts', () => {
  const ASK = 'Undo the last restore? ', TAIL = 'Everything else is left as it is.', KEPT = 'A copy you have changed since is kept, with your changes. ';
  const q = counts => backupUndoConfirmText({ counts });
  it.each([
    [{ sites: 3, copies: 2, snapshots: 3, events: 0 }, '1 site, 2 site copies and 3 History snapshots'],
    [{ sites: 3, copies: 2, snapshots: 3, events: 1 }, '1 site, 2 site copies, 3 History snapshots and 1 calendar event'],
    [{ sites: 2, copies: 2, snapshots: 2, events: 0 }, '2 site copies and 2 History snapshots'],
    [{ sites: 1, copies: 1, snapshots: 0, events: 0 }, '1 site copy'],
    [{ sites: 2, copies: 1, snapshots: 1, events: 0 }, '1 site, 1 site copy and 1 History snapshot'],
  ])('%j reads "This removes the %s it added"', (counts, words) => {
    expect(q(counts)).toBe(ASK + 'This removes the ' + words + ' it added, with their photos, and any work you have done in them since. ' + KEPT + TAIL);
  });
  it('no copies: the sentence about a kept copy is not there, and the words are exactly those of release n', () => {
    expect(q({ sites: 2, copies: 0, snapshots: 3, events: 1 })).toBe(ASK + 'This removes the 2 sites, 3 History snapshots and 1 calendar event it added, with their photos, and any work you have done in them since. ' + TAIL);
    expect(q({ sites: 1, snapshots: 0, events: 2 })).toBe(ASK + 'This removes the 1 site and 2 calendar events it added, with their photos, and any work you have done in them since. ' + TAIL);
  });
  it('copies and filled sets together: copies in the list, then the kept-copy sentence, then the filled sets', () => {
    const t = q({ sites: 2, copies: 1, snapshots: 2, events: 0, settings: { biz: 1, logo: 1, lists: 2 } });
    expect(t).toBe(ASK + 'This removes the 1 site, 1 site copy and 2 History snapshots it added, with their photos, and any work you have done in them since. ' + KEPT + 'It also takes out the business details, logo, lists and settings it filled in, unless you have changed them since; then they are left as they are. ' + TAIL);
  });
});

describe('the "Restore undone" card names the copies, with the right verb', () => {
  const r = (removed, extra = {}) => backupUndoResultText({ removed, photosRemoved: 0, unfilled: null, ...extra });
  it('one site and one copy: two things, "were"; the photos come after', () => {
    expect(backupUndoResultText({ removed: { sites: 2, snapshots: 0, events: 0 }, photosRemoved: 6, unfilled: null, copiesRemoved: 1 })).toBe('1 site and 1 site copy were removed, with 6 photos.');
    expect(backupUndoResultText({ removed: { sites: 3, snapshots: 3, events: 0 }, photosRemoved: 9, unfilled: null, copiesRemoved: 2 })).toBe('1 site, 2 site copies and 3 History snapshots were removed, with 9 photos.');
  });
  it('exactly one copy and nothing else is "was"', () => { expect(r({ sites: 1, snapshots: 0, events: 0 }, { copiesRemoved: 1 })).toBe('1 site copy was removed.'); });
  it('copies kept because they were changed: counted with copy / copies and was / were', () => {
    expect(r({ sites: 1, snapshots: 1, events: 0 }, { copiesRemoved: 0, keptCopies: 1 })).toBe('1 site and 1 History snapshot were removed. 1 copy you changed since was kept.');
    expect(r({ sites: 0, snapshots: 0, events: 0 }, { keptCopies: 2 })).toBe('2 copies you changed since were kept.');
  });
  it('removed copies, a kept copy and a filled set together, in that order', () => {
    expect(backupUndoResultText({ removed: { sites: 2, snapshots: 2, events: 0 }, photosRemoved: 3, unfilled: { fields: ['businessName'], logo: false, lists: 1, keptBiz: false, keptModules: 0 }, copiesRemoved: 1, keptCopies: 1 }))
      .toBe('1 site, 1 site copy and 2 History snapshots were removed, with 3 photos. The business details, lists and settings it filled in were taken out. 1 copy you changed since was kept.');
  });
  it('no copies at all: exactly the release n text', () => { expect(r({ sites: 2, snapshots: 3, events: 1 })).toBe('2 sites, 3 History snapshots and 1 calendar event were removed.'); });
});

describe('the real restore and Undo on the Global Settings screen', () => {
  const deps = () => ({ reload: vi.fn(), now: () => RESTORE_DAY, restore: (file, o) => backupRestore(file, { ...o, storage: S, now: RESTORE_DAY }), undo: () => backupUndo({ storage: S, now: RESTORE_DAY }), undoInfo: () => backupUndoInfo(S, RESTORE_DAY), lastText: () => backupLastBackupText(S, RESTORE_DAY) });
  const T = id => screen.getByTestId(id);
  const mount = () => { const user = userEvent.setup(); render(<GlobalSettingsView onGoHome={() => {}} backupDeps={deps()} />); return user; };
  it('Switchboard: the question counts 1 site, 2 site copies and 3 History snapshots; after a copy is changed the card says what was removed and that 1 copy was kept; the unchanged copy and the plain site go', async () => {
    const blob = await scenario(SWB); const user = mount(); await user.click(screen.getByRole('tab', { name: 'Backup & Data' }));
    await user.upload(T('backup-file-input'), new File([blob], 'b.zip', { type: 'application/zip' })); await screen.findByTestId('backup-summary'); await user.click(T('backup-restore')); await user.click(T('backup-restore-confirm-yes'));
    await screen.findByTestId('backup-result-ok'); await user.click(T('backup-done'));
    const cB = read(SWB.keys.p).find(p => p.name === 'Plant Room B (backup 5 Oct 2026)'); const R = read(SWB.keys.r); R[cB.id].extraArea = { note: 'worked in the copy' }; rawSetItem(SWB.keys.r, JSON.stringify(R));
    await user.click(T('backup-undo-open'));
    expect(T('backup-undo-confirm').textContent).toContain('Undo the last restore? This removes the 1 site, 2 site copies and 3 History snapshots it added, with their photos, and any work you have done in them since. A copy you have changed since is kept, with your changes. Everything else is left as it is.');
    await user.click(T('backup-undo-confirm-yes')); const ok = (await screen.findByTestId('backup-undo-result-ok')).textContent;
    expect(ok).toContain('1 site, 1 site copy and 2 History snapshots were removed, with 6 photos. 1 copy you changed since was kept.');
    const names = read(SWB.keys.p).map(p => p.name); expect(names).toContain('Plant Room B (backup 5 Oct 2026)'); expect(names).not.toContain('Plant Room A (backup 5 Oct 2026)'); expect(names).not.toContain('Plant Room A (east)');
  });
  it('nothing was changed since: all three go, and the card names no kept copy', async () => {
    const blob = await scenario(SWB); const user = mount(); await user.click(screen.getByRole('tab', { name: 'Backup & Data' }));
    await user.upload(T('backup-file-input'), new File([blob], 'b.zip', { type: 'application/zip' })); await screen.findByTestId('backup-summary'); await user.click(T('backup-restore')); await user.click(T('backup-restore-confirm-yes'));
    await screen.findByTestId('backup-result-ok'); await user.click(T('backup-done')); await user.click(T('backup-undo-open')); await user.click(T('backup-undo-confirm-yes'));
    const ok = (await screen.findByTestId('backup-undo-result-ok')).textContent; expect(ok).toContain('1 site, 2 site copies and 3 History snapshots were removed, with 9 photos.'); expect(ok).not.toContain('kept');
  });
});

describe('the "Last restore:" line uses the same list as the Undo question', () => {
  const at = new Date(2026, 9, 19, 12, 0).getTime();
  const line = counts => backupLastRestoreLine({ counts, restoredAt: at, until: '2026-11-02' });
  it('copies read as "site copies", zero counts are left out, photos come last', () => {
    expect(line({ sites: 3, copies: 2, snapshots: 3, events: 0, photoFiles: 9 })).toBe('Last restore: 1 site, 2 site copies, 3 History snapshots and 9 photos added on 19/10/2026. Undo is available until 02/11/2026.');
    expect(line({ sites: 3, copies: 2, snapshots: 3, events: 1, photoFiles: 1 })).toBe('Last restore: 1 site, 2 site copies, 3 History snapshots, 1 calendar event and 1 photo added on 19/10/2026. Undo is available until 02/11/2026.');
    expect(line({ sites: 2, copies: 2, snapshots: 2, events: 0, photoFiles: 0 })).toBe('Last restore: 2 site copies and 2 History snapshots added on 19/10/2026. Undo is available until 02/11/2026.');
    expect(line({ sites: 1, copies: 1, snapshots: 0, events: 0, photoFiles: 0 })).toBe('Last restore: 1 site copy added on 19/10/2026. Undo is available until 02/11/2026.');
  });
  it('a restore with no copies reads exactly as before (counts of zero left out as they always were)', () => {
    expect(line({ sites: 11, snapshots: 11, events: 2, photoFiles: 3 })).toBe('Last restore: 11 sites, 11 History snapshots, 2 calendar events and 3 photos added on 19/10/2026. Undo is available until 02/11/2026.');
    expect(line({ sites: 1, copies: 0, snapshots: 0, events: 0, photoFiles: 0 })).toBe('Last restore: 1 site added on 19/10/2026. Undo is available until 02/11/2026.');
    expect(line({})).toBe('Last restore: nothing added on 19/10/2026. Undo is available until 02/11/2026.');
  });
  it('on the screen after a real restore of ONLY copies (two sites changed on the phone, nothing else in the file is new)', async () => {
    await wipe(); await seedLookAlike(SWB, SITES.slice(0, 2)); const { blob } = await backupBuild({ now: BACKUP_DAY }); diverge(SWB);
    const user = userEvent.setup(); render(<GlobalSettingsView onGoHome={() => {}} backupDeps={{ reload: vi.fn(), now: () => RESTORE_DAY, restore: (file, o) => backupRestore(file, { ...o, storage: S, now: RESTORE_DAY }), undo: () => backupUndo({ storage: S, now: RESTORE_DAY }), undoInfo: () => backupUndoInfo(S, RESTORE_DAY), lastText: () => backupLastBackupText(S, RESTORE_DAY) }} />);
    await user.click(screen.getByRole('tab', { name: 'Backup & Data' })); await user.upload(screen.getByTestId('backup-file-input'), new File([blob], 'b.zip', { type: 'application/zip' }));
    await screen.findByTestId('backup-summary'); await user.click(screen.getByTestId('backup-restore')); await user.click(screen.getByTestId('backup-restore-confirm-yes')); await screen.findByTestId('backup-result-ok'); await user.click(screen.getByTestId('backup-done'));
    expect(screen.getByTestId('backup-section').textContent).toContain('Last restore: 2 site copies, 2 History snapshots and 6 photos added on 12/10/2026. Undo is available until 26/10/2026.');
  });
});

describe('Delete all data and the note of restored copies', () => {
  it('a restore with copies writes sparkcheck-copies-v1; Delete all data removes it; a backup never contains it', async () => {
    const blob = await scenario(RCD); expect((await backupRestore(blob, { storage: S, now: RESTORE_DAY })).ok).toBe(true);
    expect(BACKUP_COPIES_KEY).toBe('sparkcheck-copies-v1'); expect(localStorage.getItem(BACKUP_COPIES_KEY)).not.toBeNull();
    const built = await backupBuild({ now: RESTORE_DAY, storage: S }); const z = await zipOpen(built.blob), data = JSON.parse(new TextDecoder().decode(await z.bytes('data.json')));
    expect(Object.keys(data)).not.toContain(BACKUP_COPIES_KEY);
    const res = eraseOwnedKeys(S); expect(res.failed).toBe(0); expect(localStorage.getItem(BACKUP_COPIES_KEY)).toBeNull();
  });
});

// UNDO WORDING: A COUNT OF ZERO IS LEFT OUT WITH ITS WORDS (release n). FICTIONAL data. In the Undo question and the "Restore undone" card only what was really there is named, with the right singular / plural and
// "was" / "were": "1 site and 2 calendar events", "2 sites, 3 History snapshots and 1 calendar event". The term is "History snapshot". The restore result card, the summary and the Last restore line already leave zeros out.
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackupRestoreSection, backupUndoConfirmText, backupUndoResultText, backupLastRestoreLine, backupRestore, backupUndo, backupUndoInfo } from './App.jsx';
import { FM, keyOf, seedModule, wipe, backupOf } from './test/backup-fixtures.js';

vi.setConfig({ testTimeout: 30000 });
configure({ asyncUtilTimeout: 10000 });
const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
const NOW = new Date(2026, 9, 9, 12, 0);
const T = id => screen.getByTestId(id);
const ASK = 'Undo the last restore? ', TAIL = 'Everything else is left as it is.';
const SETS = ' It also takes out the business details, logo, lists and settings it filled in, unless you have changed them since; then they are left as they are.';
beforeEach(wipe);
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('the Undo question', () => {
  const q = counts => backupUndoConfirmText({ counts });
  it.each([
    [{ sites: 1, snapshots: 0, events: 2 }, '1 site and 2 calendar events'],
    [{ sites: 2, snapshots: 3, events: 1 }, '2 sites, 3 History snapshots and 1 calendar event'],
    [{ sites: 1, snapshots: 1, events: 1 }, '1 site, 1 History snapshot and 1 calendar event'],
    [{ sites: 0, snapshots: 0, events: 1 }, '1 calendar event'],
    [{ sites: 0, snapshots: 5, events: 0 }, '5 History snapshots'],
    [{ sites: 4, snapshots: 0, events: 0 }, '4 sites'],
    [{ sites: 0, snapshots: 2, events: 2 }, '2 History snapshots and 2 calendar events'],
  ])('%j reads "%s", and no zero count appears', (counts, words) => {
    const t = q(counts); expect(t).toBe(ASK + 'This removes the ' + words + ' it added, with their photos, and any work you have done in them since. ' + TAIL);
    expect(t).not.toMatch(/\b0 (sites?|History|calendar)/); expect(t).not.toContain('snapshots and 0'); if (counts.snapshots) expect(t).toContain('History snapshot'); else expect(t).not.toContain('snapshot');
  });
  it('what the restore filled is added after it, with the counts unchanged', () => {
    expect(q({ sites: 1, snapshots: 0, events: 2, settings: { biz: 3, logo: 1, lists: 4, modules: 2 } })).toBe(ASK + 'This removes the 1 site and 2 calendar events it added, with their photos, and any work you have done in them since.' + SETS + ' ' + TAIL);
  });
  it('a restore that only filled the business details and lists (no site, snapshot or event) names none of them: "This takes out…", with no zero and no "with their photos"', () => {
    const t = q({ sites: 0, snapshots: 0, events: 0, settings: { biz: 3, logo: 0, lists: 13, modules: 9 } });
    expect(t).toBe(ASK + 'This takes out the business details, logo, lists and settings it filled in, unless you have changed them since; then they are left as they are. ' + TAIL);
    expect(t).not.toMatch(/\b0\b/); expect(t).not.toContain('with their photos'); expect(t).not.toContain('This removes the');
  });
  it('a missing info object does not throw and still asks the question', () => { expect(backupUndoConfirmText(null)).toBe(ASK + TAIL); expect(backupUndoConfirmText({})).toBe(ASK + TAIL); });
});

describe('the "Restore undone" card', () => {
  const r = (removed, photos, unfilled = null) => backupUndoResultText({ removed, photosRemoved: photos, unfilled });
  it.each([
    [{ sites: 1, snapshots: 0, events: 0 }, 0, '1 site was removed.'],
    [{ sites: 1, snapshots: 0, events: 0 }, 1, '1 site was removed, with 1 photo.'],
    [{ sites: 1, snapshots: 0, events: 2 }, 0, '1 site and 2 calendar events were removed.'],
    [{ sites: 2, snapshots: 3, events: 1 }, 5, '2 sites, 3 History snapshots and 1 calendar event were removed, with 5 photos.'],
    [{ sites: 0, snapshots: 0, events: 1 }, 0, '1 calendar event was removed.'],
    [{ sites: 0, snapshots: 3, events: 0 }, 0, '3 History snapshots were removed.'],
    [{ sites: 0, snapshots: 1, events: 0 }, 0, '1 History snapshot was removed.'],
    [{ sites: 11, snapshots: 11, events: 2 }, 3, '11 sites, 11 History snapshots and 2 calendar events were removed, with 3 photos.'],
  ])('%j with %i photos reads "%s"', (removed, photos, text) => { expect(r(removed, photos)).toBe(text); expect(text).not.toMatch(/\b0 /); });
  it('what was taken out or left as it is follows, one space apart; with nothing removed the card starts with it (no leading space, no "0")', () => {
    expect(r({ sites: 1, snapshots: 0, events: 0 }, 0, { fields: ['businessName'], logo: false, lists: 4 })).toBe('1 site was removed. The business details, lists and settings it filled in were taken out.');
    expect(r({ sites: 0, snapshots: 0, events: 0 }, 0, { fields: [], logo: true, lists: 0 })).toBe('The business details it filled in were taken out.');
    expect(r({ sites: 0, snapshots: 0, events: 0 }, 0, { fields: [], logo: false, lists: 3, keptBiz: true, keptModules: 2 })).toBe('The lists and settings it filled in were taken out. The business details you changed since were left as they are. The lists and settings in 2 modules you changed since were left as they are.');
    expect(r({ sites: 2, snapshots: 0, events: 0 }, 0, { fields: [], logo: false, lists: 0, keptModules: 1 })).toBe('2 sites were removed. The lists and settings in 1 module you changed since were left as they are.');
  });
  it('what was taken out has three forms: BOTH the business details and the lists and settings use the Undo question\'s own phrase; only one of them names only that one', () => {
    expect(r({ sites: 0, snapshots: 0, events: 0 }, 0, { fields: ['businessName', 'abn'], logo: true, lists: 5 })).toBe('The business details, lists and settings it filled in were taken out.');
    expect(r({ sites: 0, snapshots: 0, events: 0 }, 0, { fields: ['licence'], logo: false, lists: 0 })).toBe('The business details it filled in were taken out.');
    expect(r({ sites: 0, snapshots: 0, events: 0 }, 0, { fields: [], logo: false, lists: 5 })).toBe('The lists and settings it filled in were taken out.');
  });
  it('nothing at all removed and nothing filled: a plain sentence rather than an empty card', () => { expect(r({ sites: 0, snapshots: 0, events: 0 }, 0)).toBe('Nothing was removed.'); expect(backupUndoResultText({ removed: null, photosRemoved: undefined })).toBe('Nothing was removed.'); });
});

describe('on screen, after a real restore and a real undo (a backup of ONE site with no History snapshot and no calendar event)', () => {
  const OLD_HISTORY = () => localStorage.removeItem(keyOf('swb', 'history'));
  const deps = () => ({ reload: vi.fn(), now: () => NOW, restore: (f, o) => backupRestore(f, { ...o, storage: S, now: NOW }), undo: () => backupUndo({ storage: S, now: NOW }), undoInfo: () => backupUndoInfo(S, NOW) });
  it('the question says "1 site"; the card says "1 site was removed."; neither mentions a snapshot, an event or a photo', async () => {
    const file = await backupOf(async () => { seedModule(FM.swb, { id: 's2', name: 'Only Site' }); OLD_HISTORY(); });
    expect(await backupRestore(file, { storage: S, now: NOW })).toMatchObject({ ok: true, summary: { sitesAdded: 1, snapshotsAdded: 0, eventsAdded: 0 } });
    const user = userEvent.setup(); render(<BackupRestoreSection gate={{ current: { busy: false, reloadPending: false, reveal: null, reload: null } }} deps={deps()} />);
    expect(T('backup-last').textContent).not.toMatch(/\b0 /); await user.click(T('backup-undo-open'));
    const box = T('backup-undo-confirm'); expect(box.firstElementChild.textContent).toBe(ASK + 'This removes the 1 site it added, with their photos, and any work you have done in them since. ' + TAIL);
    await user.click(T('backup-undo-confirm-yes')); const ok = await screen.findByTestId('backup-undo-result-ok');
    expect(ok.textContent).toBe('Restore undone1 site was removed.'); expect(ok.textContent).not.toMatch(/snapshot|event|photo|\b0 /);
  });
  it('the restore result card and the Last restore line leave zeros out too (nothing to change there)', async () => {
    const file = await backupOf(async () => { seedModule(FM.swb, { id: 's2', name: 'Only Site' }); OLD_HISTORY(); });
    const gate = { current: { busy: false, reloadPending: false, reveal: null, reload: null } };
    const r = await backupRestore(file, { storage: S, now: NOW }); expect(r.ok).toBe(true);
    expect(backupLastRestoreLine(backupUndoInfo(S, NOW))).not.toMatch(/\b0 /);
    render(<BackupRestoreSection gate={gate} deps={deps()} />); expect(screen.getByTestId('backup-section').textContent).toMatch(/Last restore: 1 site added/);
  });
});

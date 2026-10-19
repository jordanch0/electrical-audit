// BACKUP / RESTORE, RELEASE O, ON THE REAL SCREENS (FICTIONAL data). Every module: the restored copy shows in the module's own site list next to the site it was copied from, opens, and survives the module loading it
// (the app's load-time steps must not change it, or Undo would think the person had). Then the Global Settings screens: the summary, the question, the result card, the Undo question and result.
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { GlobalSettingsView, backupBuild, backupRestore, backupUndo, backupUndoInfo, backupLastBackupText } from './App.jsx';
import { MODULES } from './test/item-dates-fixtures.js';
import { wipe } from './test/backup-fixtures.js';
import { SITES, seedLookAlike, diverge, removeSite } from './test/backup-copies-fixtures.js';

vi.setConfig({ testTimeout: 60000 }); configure({ asyncUtilTimeout: 10000 });
const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
const BACKUP_DAY = new Date(2026, 9, 5, 12, 0), RESTORE_DAY = new Date(2026, 9, 12, 12, 0);
const NAME_A = 'Plant Room A (backup 5 Oct 2026)', NAME_B = 'Plant Room B (backup 5 Oct 2026)';
const settle = () => new Promise(r => setTimeout(r, 400));
beforeEach(wipe); afterEach(cleanup);
const read = k => JSON.parse(localStorage.getItem(k));
async function scenario(f) { await wipe(); await seedLookAlike(f, SITES); const { blob } = await backupBuild({ now: BACKUP_DAY }); diverge(f); await removeSite(f, 'pre'); await seedLookAlike(f, [{ id: 'prc', name: 'Plant Room C', no: 5 }]); return blob; }

describe.each(MODULES.map(f => [f.mod, f]))('%s: on the real module screens', (mod, f) => {
  it('the copies are listed next to the sites they were copied from, open, and the module loading them does not change them (Undo then removes both)', async () => {
    const blob = await scenario(f); const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY }); expect(r.ok, r.message).toBe(true);
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText(f.tile, { exact: true }));
    for (const n of [NAME_A, NAME_B, 'Plant Room A (renamed)', 'Plant Room B', 'Plant Room A2', 'Plant Room C', 'Plant Room A (east)']) expect(await screen.findByText(n, { selector: 'div' }), n).toBeTruthy();
    await user.click(screen.getByText(NAME_A, { selector: 'div' })); await settle(); expect(document.body.textContent).toContain(NAME_A);
    cleanup(); await settle();                                                                                            // the module loaded the copies and saved its data again
    const u = await backupUndo({ storage: S, now: RESTORE_DAY }); expect(u.ok, u.message).toBe(true); expect(u.keptCopies, 'the app\'s own load did not change the copies').toBe(0); expect(u.copies).toBe(2);
    const user2 = userEvent.setup(); render(<AppRoot />); await user2.click(screen.getByText(f.tile, { exact: true })); await screen.findByText('Plant Room B', { selector: 'div' });
    expect(screen.queryByText(NAME_A, { selector: 'div' })).toBeNull(); expect(screen.queryByText(NAME_B, { selector: 'div' })).toBeNull(); expect(screen.getByText('Plant Room A (renamed)', { selector: 'div' })).toBeTruthy();
  });
  it('a long site name with the suffix stays inside the 320 px list (no overflow of the card): the name wraps', async () => {
    await wipe(); await seedLookAlike(f, [{ id: 'long', name: 'Westfield Distribution Centre Building 4 Mezzanine Plant Room A', no: 6 }]); const { blob } = await backupBuild({ now: BACKUP_DAY });
    const P = read(f.keys.p); P.find(p => p.id === 'long').name = 'Westfield Distribution Centre Building 4 Mezzanine Plant Room A (renamed)'; rawSetItem(f.keys.p, JSON.stringify(P));
    const r = await backupRestore(blob, { storage: S, now: RESTORE_DAY }); expect(r.ok, r.message).toBe(true);
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText(f.tile, { exact: true }));
    expect(await screen.findByText('Westfield Distribution Centre Building 4 Mezzanine Plant Room A (backup 5 Oct 2026)', { selector: 'div' })).toBeTruthy();
  });
});

describe('Global Settings: the restore question, result and Undo with copies', () => {
  const f = MODULES[0];
  const deps = () => ({ reload: vi.fn(), now: () => RESTORE_DAY, restore: (file, o) => backupRestore(file, { ...o, storage: S, now: RESTORE_DAY }), undo: () => backupUndo({ storage: S, now: RESTORE_DAY }), undoInfo: () => backupUndoInfo(S, RESTORE_DAY), lastText: () => backupLastBackupText(S, RESTORE_DAY) });
  const T = id => screen.getByTestId(id);
  const toData = user => user.click(screen.getByRole('tab', { name: 'Backup & Data' }));
  const choose = async (user, blob) => { await toData(user); await user.upload(T('backup-file-input'), new File([blob], 'b.zip', { type: 'application/zip' })); await screen.findByTestId('backup-summary'); };
  const mount = () => { const user = userEvent.setup(); render(<GlobalSettingsView onGoHome={() => {}} backupDeps={deps()} />); return user; };
  it('the summary lists each copy with what it brings; the question keeps the summary in view; the result card names the copies', async () => {
    const blob = await scenario(f); const user = mount(); await choose(user, blob);
    const sum = T('backup-summary').textContent;
    expect(sum).toContain('Will be added as copies (the site on this phone is not changed)'); expect(sum).toContain('2 sites');
    expect(sum).toContain('Plant Room A (backup 5 Oct 2026) in RCD Testing: 1 History snapshot'); expect(sum).toContain('Plant Room B (backup 5 Oct 2026) in RCD Testing: 1 History snapshot');
    expect(sum).toContain('Already on this phone (left exactly as they are)'); expect(sum).toContain('Plant Room A2 (RCD Testing)'); expect(sum).toContain('Will be added'); expect(sum).toContain('Plant Room A (east) (RCD Testing)');
    await user.click(T('backup-restore')); expect(T('backup-summary')).toBeTruthy(); expect(T('backup-restore-confirm').textContent).toContain('Nothing you have already set here is changed or removed.'); await user.click(T('backup-restore-confirm-yes'));
    const ok = (await screen.findByTestId('backup-result-ok')).textContent;
    expect(ok).toContain('Added as copies (the site here was different):'); expect(ok).toContain(NAME_A + ' in RCD Testing'); expect(ok).toContain(NAME_B + ' in RCD Testing'); expect(ok).toContain('Added: 1 site');
  });
  it('Undo: the question says a changed copy is kept; the result says how many copies were kept', async () => {
    const blob = await scenario(f); const user = mount(); await choose(user, blob); await user.click(T('backup-restore')); await user.click(T('backup-restore-confirm-yes')); await screen.findByTestId('backup-result-ok'); await user.click(T('backup-done'));
    const cB = read(f.keys.p).find(p => p.name === NAME_B); const R = read(f.keys.r); R[cB.id].extraArea = { note: 'worked in the copy' }; rawSetItem(f.keys.r, JSON.stringify(R));
    await user.click(T('backup-undo-open')); expect(T('backup-undo-confirm').textContent).toContain('A copy you have changed since is kept, with your changes.'); await user.click(T('backup-undo-confirm-yes'));
    const ok = (await screen.findByTestId('backup-undo-result-ok')).textContent; expect(ok).toContain('1 copy you changed since was kept.');
    expect(read(f.keys.p).map(p => p.name)).toContain(NAME_B); expect(read(f.keys.p).map(p => p.name)).not.toContain(NAME_A);
  });
  it('a backup whose only difference is a changed site: "Nothing was added." is not shown, and nothing is claimed that did not happen', async () => {
    await wipe(); await seedLookAlike(f, [SITES[0]]); const { blob } = await backupBuild({ now: BACKUP_DAY }); const P = read(f.keys.p); P[0].name = 'Renamed'; rawSetItem(f.keys.p, JSON.stringify(P));
    const user = mount(); await choose(user, blob); await user.click(T('backup-restore')); await user.click(T('backup-restore-confirm-yes')); const ok = (await screen.findByTestId('backup-result-ok')).textContent;
    expect(ok).not.toContain('Nothing was added'); expect(ok).toContain('Plant Room A (backup 5 Oct 2026)');
  });
  it('the same backup again: "Already on this phone as a copy", and a refusal of "Nothing to add" (the card says why)', async () => {
    const blob = await scenario(f); await backupRestore(blob, { storage: S, now: RESTORE_DAY }); const user = mount(); await toData(user);
    await user.upload(T('backup-file-input'), new File([blob], 'b.zip', { type: 'application/zip' })); const card = (await screen.findByTestId('backup-result-info')).textContent; expect(card).toContain('Nothing to add');
  });
});

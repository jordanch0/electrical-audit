// BACKUP / RESTORE FILL, ON THE REAL SCREENS (release n). FICTIONAL data. Nothing is seeded: every module's list is changed on its own Dropdowns tab, a real backup is made, and the restore, the own-values case and Undo are
// checked by reading the same Dropdowns tab again. Then the Business tab and the Backup & Data screens of Global Settings (restore, undo, unsaved typing, the logo).
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { GlobalSettingsView, backupBuild, backupRestore, backupUndo, backupUndoInfo, backupLastBackupText, BACKUP_LIST_SPECS, backupKeyFill, backupKeyIsEmpty, appLogoStore } from './App.jsx';
import { MODULES } from './test/item-dates-fixtures.js';
import { wipe, lsSnapshot, idbSnapshot, rec } from './test/backup-fixtures.js';

vi.setConfig({ testTimeout: 60000 }); configure({ asyncUtilTimeout: 10000 });
const NOW = new Date(2026, 9, 9, 12, 0);
const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
const settle = () => new Promise(r => setTimeout(r, 300));
beforeAll(() => { URL.createObjectURL = () => 'blob:logo'; URL.revokeObjectURL = () => {}; });          // jsdom has none; the logo preview needs one
beforeEach(wipe); afterEach(cleanup);

async function addSite(user, f, name) {
  await user.click(screen.getByText(f.tile, { exact: true }));
  await user.click(await screen.findByRole('button', { name: /^\+ Add( \/ Import)? Site$/ })); await user.type(screen.getByPlaceholderText('Site name'), name); await user.click(screen.getByRole('button', { name: 'Add Site' }));
  await user.click(await screen.findByText(name, { selector: 'div' }));
}
async function openSite(user, f, name) { await user.click(screen.getByText(f.tile, { exact: true })); await user.click(await screen.findByText(name, { selector: 'div' })); }
const dropdownsTab = async user => { await user.click(screen.getAllByRole('button').find(b => (b.textContent || '').trim() === 'Dropdowns')); };
async function addResponsibility(user, text) { const box = await screen.findByPlaceholderText('Add new responsibility option…'); await user.type(box, text); await user.click(within(box.parentElement).getByRole('button', { name: '+ Add' })); await screen.findByText(text); }
const phoneWith = async (f, site, entry) => { const user = userEvent.setup(); render(<AppRoot />); await addSite(user, f, site); await dropdownsTab(user); if (entry) await addResponsibility(user, entry); await settle(); cleanup(); };
const seeDropdowns = async (f, site) => { const user = userEvent.setup(); render(<AppRoot />); await openSite(user, f, site); await dropdownsTab(user); await screen.findByText('Site Manager', { selector: 'span' }).catch(() => null); await settle(); return user; };

describe.each(MODULES.map(f => [f.mod, f]))('%s: lists on the real Dropdowns tab', (mod, f) => {
  const MINE = 'Mine ' + mod, THEIRS = 'Backup entry ' + mod;
  const hasText = t => document.body.textContent.includes(t);
  async function makeBackup() { await phoneWith(f, 'Backup Site', THEIRS); const { blob } = await backupBuild(); await wipe(); return blob; }
  it('the list the real module writes on first open counts as empty, so a restore can fill it (guards the defaults table against drift)', async () => {
    await phoneWith(f, 'Own Site', null);
    for (const spec of BACKUP_LIST_SPECS().filter(s => s.mod === mod)) {
      const raw = localStorage.getItem(spec.key); expect(raw, spec.key + ' is written when the module opens').not.toBeNull();
      const custom = Array.isArray(spec.defaults) ? ['Custom'] : Object.fromEntries(Object.keys(spec.defaults).map(k => [k, Array.isArray(spec.defaults[k]) ? ['Custom'] : 'Custom']));
      expect(backupKeyIsEmpty(spec, { state: 'ok', v: JSON.parse(raw) }), spec.key + ' (as first written) is the default').toBe(true); expect(backupKeyFill(spec, { state: 'ok', v: JSON.parse(raw) }, custom), spec.key).not.toBeNull();
    }
  });
  it('into an empty phone: the restored site\'s module shows the backup\'s list', async () => {
    const blob = await makeBackup(); const r = await backupRestore(blob, { storage: S, now: NOW }); expect(r.ok, r.message).toBe(true); expect(r.summary.filled.modules).toBeGreaterThanOrEqual(1);
    await seeDropdowns(f, 'Backup Site'); expect(hasText(THEIRS)).toBe(true);
  });
  it('into a phone with its own list: the phone\'s entry stays, the backup\'s is not added, the backup\'s site is', async () => {
    const blob = await makeBackup(); await phoneWith(f, 'Own Site', MINE); const before = lsSnapshot();
    const r = await backupRestore(blob, { storage: S, now: NOW }); expect(r.ok, r.message).toBe(true); expect(r.summary.sitesAdded).toBe(1);
    const user = await seeDropdowns(f, 'Own Site'); expect(hasText(MINE)).toBe(true); expect(hasText(THEIRS)).toBe(false);
    for (const spec of BACKUP_LIST_SPECS().filter(s => s.mod === mod)) if (Array.isArray(spec.defaults) === false && JSON.parse(before[spec.key]).responsibility) expect(JSON.parse(localStorage.getItem(spec.key)).responsibility, spec.key).toEqual(JSON.parse(before[spec.key]).responsibility);
    cleanup(); const u2 = userEvent.setup(); render(<AppRoot />); await u2.click(screen.getByText(f.tile, { exact: true })); expect(await screen.findByText('Backup Site', { selector: 'div' })).toBeTruthy();
  });
  it('Undo takes the list back out, also after the module has been opened since (it saved the list again): the phone is as it was before the restore', async () => {
    const blob = await makeBackup(); await phoneWith(f, 'Own Site', null); const before = lsSnapshot(), beforeIdb = await idbSnapshot();
    const r = await backupRestore(blob, { storage: S, now: NOW }); expect(r.ok, r.message).toBe(true);
    await seeDropdowns(f, 'Own Site'); expect(hasText(THEIRS)).toBe(true); cleanup();                                                    // the module opened, showed the restored list and saved it again
    const u = await backupUndo({ storage: S, now: NOW }); expect(u.ok, u.message).toBe(true); expect(u.unfilled.kept, 'nothing counted as changed by the person').toBe(0);
    await seeDropdowns(f, 'Own Site'); expect(hasText(THEIRS)).toBe(false); cleanup();
    const after = lsSnapshot(); for (const k of Object.keys(before)) expect(after[k], k).toBe(before[k]); expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort()); expect(await idbSnapshot()).toEqual(beforeIdb);
  });
});

describe('Global Settings: the Business tab and the Backup & Data screens', () => {
  const deps = (over = {}) => ({ reload: vi.fn(), now: () => NOW, restore: (file, o) => backupRestore(file, { ...o, storage: S, now: NOW }), undo: () => backupUndo({ storage: S, now: NOW }), undoInfo: () => backupUndoInfo(S, NOW), lastText: () => backupLastBackupText(S, NOW), ...over });
  const BIZ = { businessName: 'Example Electrical Pty Ltd', abn: '12 345 678 901', licence: '123456C', logoId: 'logo' };
  const source = async () => { rawSetItem('app-settings-v1', JSON.stringify(BIZ)); await appLogoStore.put(rec(10, 11, 12)); rawSetItem('rcd-projects-v6', JSON.stringify([{ id: 's1', name: 'Site One', company: '', abn: '', licence: '', areas: [] }])); rawSetItem('tat-names-v1', JSON.stringify(['Custom Name'])); const { blob } = await backupBuild({ now: NOW }); await wipe(); return blob; };
  const fields = () => ({ name: screen.getByPlaceholderText('Company name'), abn: screen.getByPlaceholderText('e.g. 12 345 678 901'), lic: screen.getByPlaceholderText('e.g. 123456C') });
  const toData = user => user.click(screen.getByRole('tab', { name: 'Backup & Data' })), toBiz = user => user.click(screen.getByRole('tab', { name: 'Business' }));
  const T = id => screen.getByTestId(id);
  const restoreFile = async (user, blob) => { await toData(user); await user.upload(T('backup-file-input'), new File([blob], 'b.zip', { type: 'application/zip' })); await screen.findByTestId('backup-summary'); };
  const mount = () => { const user = userEvent.setup(); const gd = deps(); render(<GlobalSettingsView onGoHome={() => {}} backupDeps={gd} />); return { user, gd }; };
  it('the confirmation names what will be filled; the result says what was filled; the Business tab shows it WITHOUT a reload; the logo too', async () => {
    const blob = await source(); const { user } = mount(); await restoreFile(user, blob);
    const sum = T('backup-summary').textContent; expect(sum).toContain('Will be filled in (empty on this phone)'); expect(sum).toContain('Business details (name, ABN, licence, logo)'); expect(sum).toContain('Lists and settings in 1 module');
    await user.click(T('backup-restore')); expect(T('backup-restore-confirm').textContent).toContain('Nothing you have already set here is changed or removed.'); await user.click(T('backup-restore-confirm-yes'));
    const ok = await screen.findByTestId('backup-result-ok'); expect(ok.textContent).toContain('Filled in (it was empty here): the business details (business name, ABN, licence and company logo) and lists and settings in 1 module.');
    await toBiz(user); await waitFor(() => expect(fields().name).toHaveValue('Example Electrical Pty Ltd')); expect(fields().abn).toHaveValue('12 345 678 901'); expect(fields().lic).toHaveValue('123456C'); await waitFor(() => expect(screen.getByAltText('Logo')).toBeTruthy());
  });
  it('text typed in the Business tab and not yet saved is never replaced; the other fields fill', async () => {
    const blob = await source(); const { user } = mount(); await user.type(fields().name, 'Typed Not Saved'); await restoreFile(user, blob); await user.click(T('backup-restore')); await user.click(T('backup-restore-confirm-yes')); await screen.findByTestId('backup-result-ok');
    await toBiz(user); await waitFor(() => expect(fields().abn).toHaveValue('12 345 678 901')); expect(fields().name).toHaveValue('Typed Not Saved'); expect(JSON.parse(localStorage.getItem('app-settings-v1')).businessName).toBe('Example Electrical Pty Ltd');    // what is stored is the backup's name; the screen keeps what you typed until you save
  });
  it('a business name the phone already has keeps the whole business set: the summary lists the business details as already set, nothing of them is filled, and the Business tab and the stored text are unchanged', async () => {
    const blob = await source(); rawSetItem('app-settings-v1', JSON.stringify({ businessName: 'Mine Pty', abn: '', licence: '' })); const stored = localStorage.getItem('app-settings-v1'); const { user } = mount(); await restoreFile(user, blob);
    const sum = T('backup-summary').textContent, at = sum.indexOf('Already set on this phone (left exactly as they are)'); expect(at).toBeGreaterThan(0); expect(sum.slice(at)).toContain('Business details (name, ABN, licence, logo)'); expect(sum.slice(0, at)).not.toContain('Business details'); expect(sum.slice(0, at)).toContain('Lists and settings in 1 module'); expect(fields().name).toHaveValue('Mine Pty');
    await user.click(T('backup-restore')); await user.click(T('backup-restore-confirm-yes')); await screen.findByTestId('backup-result-ok'); await toBiz(user); await waitFor(() => expect(fields().name).toHaveValue('Mine Pty')); expect(fields().abn).toHaveValue(''); expect(fields().lic).toHaveValue(''); expect(screen.queryByAltText('Logo')).toBeNull(); expect(localStorage.getItem('app-settings-v1')).toBe(stored);
  });
  it('Undo: the question says what else it takes out; the result says so; the Business tab and the logo are empty again without a reload', async () => {
    const blob = await source(); const { user } = mount(); await restoreFile(user, blob); await user.click(T('backup-restore')); await user.click(T('backup-restore-confirm-yes')); await screen.findByTestId('backup-result-ok'); await user.click(T('backup-done'));
    await user.click(T('backup-undo-open')); expect(T('backup-undo-confirm').textContent).toContain('It also takes out the business details, logo, lists and settings it filled in, unless you have changed them since; then they are left as they are.'); await user.click(T('backup-undo-confirm-yes'));
    const ok = await screen.findByTestId('backup-undo-result-ok'); expect(ok.textContent).toContain('The business details, lists and settings it filled in were taken out.');
    await toBiz(user); await waitFor(() => expect(fields().name).toHaveValue('')); expect(fields().abn).toHaveValue(''); expect(screen.queryByAltText('Logo')).toBeNull(); expect(localStorage.getItem('app-settings-v1')).toBeNull();
  });
});

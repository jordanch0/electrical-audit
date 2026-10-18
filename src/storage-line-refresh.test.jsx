// THE STORAGE LINE FOLLOWS THE DATA (release n). FICTIONAL data. "Storage used: N of ~5 MB" in Global Settings was measured once, when the screen opened, so it stayed old after a save, a restore, an undo or a delete.
// Now it is measured again after each of them. If the measurement fails the old value stays quietly. Only the text and the bar change: the line is the same element, nothing is added or moved, nothing scrolls.
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobalSettingsView, localStorageUsageBytes, fmtBytes, STORAGE_QUOTA_ASSUMED_BYTES, backupRestore, backupUndo, backupUndoInfo, eraseBegin } from './App.jsx';
import { wipe, backupOf, seedSourceFull } from './test/backup-fixtures.js';

vi.setConfig({ testTimeout: 30000 });
configure({ asyncUtilTimeout: 10000 });
const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
const NOW = new Date(2026, 9, 9, 12, 0);
const T = id => screen.getByTestId(id);
const lineEl = () => screen.getByText(/Storage used:/);
const line = () => lineEl().textContent;
const expected = () => { const u = localStorageUsageBytes(); return `Storage used: ${fmtBytes(u)} of ~5 MB (${Math.min(100, (u / STORAGE_QUOTA_ASSUMED_BYTES) * 100).toFixed(0)}%, approximate)`; };
const mount = (over = {}) => { const user = userEvent.setup(); const reload = vi.fn(); const r = render(<GlobalSettingsView onGoHome={() => {}} backupDeps={{ reload, now: () => NOW, restore: (f, o) => backupRestore(f, { ...o, storage: S, now: NOW }), undo: () => backupUndo({ storage: S, now: NOW }), undoInfo: () => backupUndoInfo(S, NOW), eraseBegin: () => eraseBegin(S, NOW), ...over }} />); return { user, reload, ...r }; };
const dataTab = async user => { await user.click(await screen.findByRole('tab', { name: 'Backup & Data' })); };
const businessTab = async user => { await user.click(await screen.findByRole('tab', { name: 'Business' })); };
const save = async user => { await user.click(screen.getByRole('button', { name: 'Save' })); await screen.findByText('Saved'); };
const typeName = async (user, text) => { const box = screen.getAllByRole('textbox')[0]; await user.clear(box); await user.type(box, text); };
const restoreInto = async (user, file) => { await dataTab(user); await user.upload(T('backup-file-input'), new File([file], 'SparkCheck-backup-2026-10-05.zip', { type: 'application/zip' })); await screen.findByTestId('backup-summary'); await user.click(T('backup-restore')); await user.click(T('backup-restore-confirm-yes')); await screen.findByTestId('backup-result-ok'); };
beforeEach(async () => { await wipe(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete Element.prototype.scrollIntoView; });

describe('the Storage line is measured again', () => {
  it('after Save on the Business tab: 0 B -> the bytes the save wrote', async () => {
    const { user } = mount(); expect(line()).toBe('Storage used: 0 B of ~5 MB (0%, approximate)');
    await typeName(user, 'Example Electrical Pty Ltd'); await save(user); await dataTab(user);
    await waitFor(() => expect(line()).toBe(expected())); expect(localStorageUsageBytes()).toBeGreaterThan(0); expect(line()).not.toContain('0 B of');
  });
  it('after a second Save with a longer name: it grows by what was added, to the byte', async () => {
    const { user } = mount(); await typeName(user, 'Short'); await save(user); await dataTab(user); await waitFor(() => expect(line()).toBe(expected())); const first = line();
    await businessTab(user); await typeName(user, 'A much longer fictional business name than before'); await save(user); await dataTab(user);
    await waitFor(() => expect(line()).toBe(expected())); expect(line()).not.toBe(first);
  });
  it('after a restore: the data it added is counted as soon as the result card shows', async () => {
    const file = await backupOf(seedSourceFull); const { user } = mount(); const before = line(); expect(before).toBe('Storage used: 0 B of ~5 MB (0%, approximate)');
    await restoreInto(user, file); await waitFor(() => expect(line()).toBe(expected())); expect(line()).not.toBe(before); expect(localStorageUsageBytes()).toBeGreaterThan(1024);
  });
  it('after an undo: the data it removed is no longer counted', async () => {
    const file = await backupOf(seedSourceFull); const { user } = mount(); await restoreInto(user, file); await waitFor(() => expect(line()).toBe(expected())); const afterRestore = line();
    await user.click(T('backup-undo-open')); await user.click(T('backup-undo-confirm-yes')); await screen.findByTestId('backup-undo-result-ok');
    await waitFor(() => expect(line()).toBe(expected())); expect(line()).not.toBe(afterRestore);
  });
  it('after Delete all data is confirmed (before the restart): the marker it wrote is counted; the erase itself runs at the next start, which measures again', async () => {
    localStorage.setItem('k', 'x'.repeat(100)); const { user, reload } = mount(); expect(line()).toBe('Storage used: 202 B of ~5 MB (0%, approximate)');
    await dataTab(user); await user.click(T('erase-open')); await user.click(T('erase-confirm-yes')); await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(line()).toBe(expected()); expect(line()).not.toBe('Storage used: 202 B of ~5 MB (0%, approximate)');
  });
  it('a failed measurement keeps the old value, quietly: no error on screen, nothing thrown, and the next one works again', async () => {
    const { user } = mount(); await typeName(user, 'Example Electrical Pty Ltd'); await save(user); await dataTab(user); await waitFor(() => expect(line()).toBe(expected())); const kept = line();
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => { throw new Error('storage is not readable'); }); const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    await businessTab(user); await typeName(user, 'A different and longer fictional name for the second save'); await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved'); expect(line()).toBe(kept); expect(screen.queryAllByRole('alert')).toEqual([]); expect(warn).not.toHaveBeenCalled();
    vi.restoreAllMocks(); await user.click(screen.getByRole('button', { name: 'Save' })); await dataTab(user); await waitFor(() => expect(line()).toBe(expected())); expect(line()).not.toBe(kept);
  });
});

describe('it does not shift the page or scroll', () => {
  it('after a save the line is the same element in the same place (same parent, same number of siblings, same position among them), and nothing scrolls', async () => {
    const scroll = Element.prototype.scrollIntoView = vi.fn(); const { user } = mount(); await dataTab(user);
    const el = lineEl(), parent = el.parentElement, siblings = parent.childElementCount, at = [...parent.children].indexOf(el);
    await businessTab(user); await typeName(user, 'Example Electrical Pty Ltd'); await save(user); await dataTab(user); await waitFor(() => expect(line()).toBe(expected()));
    expect(lineEl()).toBe(el); expect(el.parentElement).toBe(parent); expect(parent.childElementCount).toBe(siblings); expect([...parent.children].indexOf(el)).toBe(at); expect(scroll).not.toHaveBeenCalled();
  });
  it('after a restore the line is still the same element in the same place (the result card is a new message, the line is not)', async () => {
    const file = await backupOf(seedSourceFull); const { user } = mount(); await dataTab(user); const el = lineEl(), parent = el.parentElement, siblings = parent.childElementCount, at = [...parent.children].indexOf(el);
    await restoreInto(user, file); await waitFor(() => expect(line()).toBe(expected())); expect(lineEl()).toBe(el); expect(parent.childElementCount).toBe(siblings); expect([...parent.children].indexOf(el)).toBe(at);
  });
});

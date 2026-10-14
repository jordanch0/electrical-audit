// MAKE BACKUP CHECKS THE FILE IT JUST BUILT. The built bytes go through the same check a restore runs (backupInspect) before "Share backup" is offered; a file that would not restore is never offered, in plain words. FICTIONAL data.
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackupRestoreSection, backupBuild, backupInspect, backupRestore, backupUndo, backupUndoInfo, backupLastBackupText, BACKUP_LAST_KEY } from './App.jsx';
import { wipe } from './test/backup-fixtures.js';

vi.setConfig({ testTimeout: 30000 }); configure({ asyncUtilTimeout: 10000 });
const NOW = new Date(2026, 9, 13, 12, 0);
const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
const deps = (over = {}) => ({ reload: vi.fn(), now: () => NOW, restore: (f, o) => backupRestore(f, { ...o, storage: S, now: NOW }), undo: () => backupUndo({ storage: S, now: NOW }), undoInfo: () => backupUndoInfo(S, NOW), lastText: () => backupLastBackupText(S, NOW), ...over });
const mount = d => { const user = userEvent.setup(); render(<BackupRestoreSection gate={{ current: { busy: false, reloadPending: false, reveal: null, reload: null } }} deps={d} />); return user; };
const T = id => screen.getByTestId(id), Q = id => screen.queryByTestId(id);
const seed = () => { rawSetItem('welder-projects-v2', JSON.stringify([{ id: 's1', name: 'Site One', areas: [] }])); };
beforeEach(async () => { await wipe(); seed(); }); afterEach(cleanup);

describe('Make backup checks the file it built', () => {
  it('a good file passes the check and is offered, as before (the real build, the real check)', async () => {
    const user = mount(deps()); await user.click(T('backup-make')); await screen.findByTestId('backup-card-ready'); expect(T('backup-share')).toBeTruthy(); expect(Q('backup-card-err')).toBeNull();
  });
  it('the check is run on the very bytes that would be shared, with the same function a restore uses', async () => {
    const inspect = vi.fn(backupInspect); let built; const build = vi.fn(async a => (built = await backupBuild(a)));
    const user = mount(deps({ inspect, build })); await user.click(T('backup-make')); await screen.findByTestId('backup-card-ready');
    expect(inspect).toHaveBeenCalledTimes(1); expect(inspect.mock.calls[0][0]).toBe(built.blob);
  });
  it('a file that would not restore (an owned key holding text that is not JSON) is NOT offered: plain words, no Share, nothing recorded, Try again', async () => {
    rawSetItem('welder-meta-v1', '{not json');                                                         // a damaged key; the real build copies it, the real check refuses it
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); const user = mount(deps()); await user.click(T('backup-make'));
    const card = await screen.findByTestId('backup-card-err');
    expect(card.textContent).toBe('The backup could not be used' + 'SparkCheck checked this backup and found it cannot be restored, so it was not offered. Nothing on this phone was changed. Please try again, or contact support if it keeps happening.');
    expect(Q('backup-share')).toBeNull(); expect(Q('backup-card-ready')).toBeNull(); expect(localStorage.getItem(BACKUP_LAST_KEY)).toBeNull();
    expect(card.textContent).not.toMatch(/welder-meta|JSON|manifest|checksum|invalid/i);                  // no key names or jargon on screen; the technical reason goes to the log only
    expect(warn.mock.calls.some(c => String(c[1]) === 'build-check-failed')).toBe(true);
    await user.click(T('backup-retry')); expect(T('backup-make')).toBeTruthy(); warn.mockRestore();
  });
  it('a check that cannot run at all (it throws) is the existing "could not be made" card, not a shared file', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); const user = mount(deps({ inspect: async () => { throw new Error('boom'); } })); await user.click(T('backup-make'));
    expect((await screen.findByTestId('backup-card-err')).textContent).toMatch(/^The backup could not be made/); expect(Q('backup-share')).toBeNull(); warn.mockRestore();
  });
  it('while the check is still running nothing is offered; the moment it passes, Share backup appears', async () => {
    let release; const user = mount(deps({ inspect: () => new Promise(r => { release = () => r({ ok: true }); }) })); await user.click(T('backup-make')); await waitFor(() => expect(release).toBeTruthy());
    expect(Q('backup-share')).toBeNull(); expect(Q('backup-card-ready')).toBeNull(); expect(screen.getByTestId('backup-section').textContent).toMatch(/Making your backup/);
    release(); await screen.findByTestId('backup-card-ready'); expect(T('backup-share')).toBeTruthy();
  });
  it('leaving the screen while the check runs offers nothing', async () => {
    let release; const user = mount(deps({ inspect: () => new Promise(r => { release = () => r({ ok: true }); }) })); await user.click(T('backup-make')); await waitFor(() => expect(release).toBeTruthy());
    cleanup(); release(); await new Promise(r => setTimeout(r, 50)); expect(Q('backup-share')).toBeNull(); expect(user).toBeTruthy();
  });
});

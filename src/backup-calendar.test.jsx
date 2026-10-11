// THE CALENDAR SURVIVES A LATER SAVE (Round d). The Calendar keeps its events in memory and writes ALL of them back on every change. A Calendar that was already open when a restore (or undo) added events would therefore
// erase them at its next save. That is why Done and the Modules pill reload the app after a successful restore or undo. FICTIONAL data.
//  1. NEGATIVE CONTROL: with a Calendar open across a restore (no reload), its next save wipes the restored events. This proves the hazard is real, and that the test below can fail.
//  2. THE FLOW THROUGH THE SCREENS: Calendar -> Home -> Settings -> restore through the section -> Done (the reload) -> a fresh app -> Calendar -> change an event -> the restored events are still stored.
//  3. The same for an undo (the events it removed stay removed, and the local one is kept).
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { GlobalSettingsView, backupRestore, backupUndo, backupUndoInfo } from './App.jsx';
import { wipe, backupOf, seedSourceFull, seedPhone } from './test/backup-fixtures.js';

vi.setConfig({ testTimeout: 30000 });
configure({ asyncUtilTimeout: 10000 });
const NOW = new Date(2026, 9, 9, 12, 0);
const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
const ids = () => JSON.parse(localStorage.getItem('cal-events-v1') || '[]').map(e => e.id).sort();
const local = () => { seedPhone({ id: 'local', name: 'Local Site', snapId: 'hl' }); rawSetItem('cal-events-v1', JSON.stringify([{ id: 'eL', type: 'tat', site: 'Local Site', dueDate: '2020-01-01' }])); };   // overdue: always listed, whatever the clock says
const sourceFile = () => backupOf(seedSourceFull);
const openCalendar = async user => { await user.click(screen.getByTestId('calendar-pill')); return (await screen.findAllByTitle('Mark complete'))[0]; };
const settingsDeps = reload => ({ reload, now: () => NOW, restore: (f, o) => backupRestore(f, { ...o, storage: S, now: NOW }), undo: () => backupUndo({ storage: S, now: NOW }), undoInfo: () => backupUndoInfo(S, NOW) });
beforeEach(async () => { await wipe(); });
afterEach(() => cleanup());

describe('the Calendar and a restore', () => {
  it('NEGATIVE CONTROL: a Calendar left open across a restore (no reload) erases the restored events at its next save', async () => {
    const file = await sourceFile(); local(); const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByTestId('calendar-pill')); const mark = await screen.findByTitle('Mark complete'); expect(ids()).toEqual(['eL']);
    await backupRestore(file, { storage: S, now: NOW }); expect(ids()).toEqual(['e1', 'e2', 'eL']);            // the restore added them...
    await user.click(mark);                                                                                      // ...then the open Calendar saves what IT holds
    await waitFor(() => expect(JSON.parse(localStorage.getItem('cal-events-v1')).find(e => e.id === 'eL').completed).toBe(true));
    expect(ids()).toEqual(['eL']);                                                                               // e1 and e2 are gone
  });

  it('THROUGH THE SCREENS: Calendar -> Home -> Settings -> restore -> Done (reload) -> fresh app -> Calendar change: the restored events stay', async () => {
    const file = await sourceFile(); local(); const user = userEvent.setup(); const first = render(<AppRoot />);
    await openCalendar(user); await user.click(screen.getByText('Modules')); await screen.findByTestId('settings-pill');           // out of the Calendar, Home
    await user.click(screen.getByTestId('settings-pill')); await screen.findByText('Business Identity'); first.unmount(); cleanup();                                 // (Settings is rendered below with its own reload)
    const reload = vi.fn(); render(<GlobalSettingsView onGoHome={() => {}} backupDeps={settingsDeps(reload)} />);
    await user.upload(await screen.findByTestId('backup-file-input'), new File([file], 'b.zip')); await screen.findByTestId('backup-summary'); await user.click(screen.getByTestId('backup-restore')); await user.click(screen.getByTestId('backup-restore-confirm-yes'));
    await screen.findByTestId('backup-result-ok'); expect(ids()).toEqual(['e1', 'e2', 'eL']); expect(reload).not.toHaveBeenCalled(); await user.click(screen.getByTestId('backup-done')); expect(reload).toHaveBeenCalledTimes(1);
    cleanup(); render(<AppRoot />);                                                                                // the app after the reload: Home, nothing carried in memory
    const mark = await openCalendar(user); await user.click(mark);
    await waitFor(() => expect(JSON.parse(localStorage.getItem('cal-events-v1')).some(e => e.completed)).toBe(true));
    expect(ids()).toEqual(['e1', 'e2', 'eL']);                                                                     // nothing was lost
  });

  it('THE SAME FOR AN UNDO: after Done and a fresh app, a later Calendar save keeps the local event and does not bring the removed ones back', async () => {
    const file = await sourceFile(); local(); await backupRestore(file, { storage: S, now: NOW }); const user = userEvent.setup(); const reload = vi.fn();
    render(<GlobalSettingsView onGoHome={() => {}} backupDeps={settingsDeps(reload)} />); await user.click(await screen.findByTestId('backup-undo-open')); await user.click(screen.getByTestId('backup-undo-confirm-yes')); await screen.findByTestId('backup-undo-result-ok');
    expect(ids()).toEqual(['eL']); await user.click(screen.getByTestId('backup-undo-done')); expect(reload).toHaveBeenCalledTimes(1);
    cleanup(); render(<AppRoot />); const mark = await openCalendar(user); await user.click(mark);
    await waitFor(() => expect(JSON.parse(localStorage.getItem('cal-events-v1')).find(e => e.id === 'eL').completed).toBe(true)); expect(ids()).toEqual(['eL']);
  });
});

// THE ERROR SCREEN (release r). A render crash ends in AppErrorBoundary's plain screen: something went wrong, the saved audits are still on the phone, the last change may not have been saved, Reload, and Make a backup
// (built with the app's own backup engine, which renders nothing, so it works without the crashed screen). FICTIONAL data in jsdom's own storage; a child that throws plays the crash. The boundary never writes to storage.
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { AppErrorBoundary, CrashScreen, backupInspect, backupBuild, backupMeasure } from './App.jsx';

configure({ asyncUtilTimeout: 5000 });
const SITE = 'ZQSITE-Mulberry-Depot';
let setItemSpy, warn;
const seed = () => { localStorage.clear(); localStorage.setItem('rcd-projects-v6', JSON.stringify([{ id: 'zq-1', name: SITE, company: 'Example Electrical Pty Ltd', abn: '98 765 432 109', licence: 'EW000000', areas: [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'p1', name: 'MSB1', circuits: ['CB1'] }] }] }])); };
const snapshot = () => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]));
beforeEach(() => { seed(); vi.spyOn(console, 'error').mockImplementation(() => {}); warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); setItemSpy = vi.spyOn(Storage.prototype, 'setItem'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });
const Bomb = ({ msg = 'Cannot read properties of undefined (reading ' + SITE + ')' }) => { throw new TypeError(msg); };
const deps = (o = {}) => ({ reload: vi.fn(), now: () => new Date(2026, 9, 21, 12, 0), canBackup: () => true, ...o });
const ok = { ok: true, method: 'share', recorded: true };

describe('the crash screen', () => {
  it('replaces the app, says what happened and what is safe, shows the error NAME only, and writes nothing', async () => {
    const before = snapshot(); setItemSpy.mockClear();
    render(<AppErrorBoundary deps={deps()}><Bomb /></AppErrorBoundary>);
    const s = screen.getByTestId('crash-screen'); expect(s.getAttribute('role')).toBe('alert');
    expect(s.textContent).toContain('Something went wrong'); expect(s.textContent).toContain('SparkCheck stopped. Your saved audits are still on this phone. The last change you made may not have been saved.');
    expect(screen.getByTestId('crash-name').textContent).toBe('Error: TypeError'); expect(document.body.textContent).not.toContain(SITE); expect(document.body.textContent).not.toMatch(/Cannot read/);
    expect(snapshot()).toBe(before); expect(setItemSpy).not.toHaveBeenCalled();
    expect(warn.mock.calls).toEqual([['[SparkCheck]', 'render-crash', 'TypeError']]);
  });
  it('a storage that throws on every read and write cannot stop the screen: it shows, the crash screen reads nothing and writes nothing', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage blocked'); }); setItemSpy.mockImplementation(() => { throw new Error('storage blocked'); });
    try {
      render(<AppErrorBoundary deps={{ reload: vi.fn() }}><Bomb /></AppErrorBoundary>);      // the real canBackup: it must not read storage either
      expect(screen.getByTestId('crash-screen')).toBeTruthy(); expect(screen.getByTestId('crash-reload')).toBeTruthy();
      expect(get).not.toHaveBeenCalled(); expect(setItemSpy).not.toHaveBeenCalled();
    } finally { get.mockRestore(); setItemSpy.mockRestore(); }
  });
  it('Reload calls the reload function; both buttons are 44 px or more and white-on-orange is the primary', async () => {
    const d = deps(); render(<AppErrorBoundary deps={d}><Bomb /></AppErrorBoundary>);
    const r = screen.getByTestId('crash-reload'), m = screen.getByTestId('crash-backup'); expect(r.textContent).toBe('Reload SparkCheck'); expect(m.textContent).toBe('Make a backup');
    expect(parseInt(r.style.minHeight, 10)).toBeGreaterThanOrEqual(44); expect(parseInt(m.style.minHeight, 10)).toBeGreaterThanOrEqual(44); expect(r.style.background).toBe('rgb(163, 83, 15)'); expect(r.style.color).toBe('rgb(255, 255, 255)');
    await userEvent.setup().click(r); expect(d.reload).toHaveBeenCalledTimes(1);
  });
  it('a crash AFTER the real app was running: the app is gone, the screen is up, every stored byte is as it was, nothing was written', async () => {
    const user = userEvent.setup(); let boom; const Trigger = () => { const [b, setB] = React.useState(false); boom = () => setB(true); if (b) throw new RangeError('later'); return null; };
    render(<AppErrorBoundary deps={deps()}><AppRoot /><Trigger /></AppErrorBoundary>);
    await screen.findByText('Select Module'); await user.click(await screen.findByText('RCD TESTING')); await screen.findAllByText(SITE, { selector: 'div' });
    const before = snapshot(); setItemSpy.mockClear(); act(() => boom());
    expect(await screen.findByTestId('crash-screen')).toBeTruthy(); expect(screen.queryByText('Select Module')).toBeNull(); expect(screen.getByTestId('crash-name').textContent).toBe('Error: RangeError');
    expect(snapshot()).toBe(before); expect(setItemSpy).not.toHaveBeenCalled();
  });
  it('the fallback cannot throw: odd error objects, a throwing canBackup, a throwing reload', async () => {
    const Odd = ({ e }) => { throw e; }; const weird = { get name() { throw new Error('getter'); } };
    for (const e of [undefined, null, 'a string', 42, weird, { name: 123 }, Object.create(null)]) { cleanup(); render(<AppErrorBoundary deps={deps()}><Odd e={e} /></AppErrorBoundary>); expect(screen.getByTestId('crash-screen')).toBeTruthy(); expect(screen.getByTestId('crash-name').textContent).toMatch(/^Error: [A-Za-z]+$/); }
    cleanup(); render(<CrashScreen name={undefined} deps={deps({ canBackup: () => { throw new Error('x'); }, reload: () => { throw new Error('y'); } })} />);
    expect(screen.queryByTestId('crash-backup')).toBeNull(); await userEvent.setup().click(screen.getByTestId('crash-reload')); expect(screen.getByTestId('crash-screen')).toBeTruthy();
  });
  it('a healthy app is untouched: the children render and there is no screen', () => {
    render(<AppErrorBoundary deps={deps()}><div>fine</div></AppErrorBoundary>); expect(screen.getByText('fine')).toBeTruthy(); expect(screen.queryByTestId('crash-screen')).toBeNull();
  });
  it('no Make a backup while an erase is unfinished (canBackup false)', () => { render(<CrashScreen name="Error" deps={deps({ canBackup: () => false })} />); expect(screen.queryByTestId('crash-backup')).toBeNull(); expect(screen.getByTestId('crash-reload')).toBeTruthy(); });
});

describe('Make a backup from the crash screen (fake engine for every branch)', () => {
  const MB = 1024 * 1024;
  const eng = (o = {}) => deps({ measure: vi.fn(async () => ({ estimatedBytes: 5 * MB })), build: vi.fn(async () => ({ blob: new Blob(['zip'], { type: 'application/zip' }), filename: 'SparkCheck-backup-2026-10-21.zip' })), inspect: vi.fn(async () => ({ ok: true })), deliver: vi.fn(async () => ok), ...o });
  it('measure -> build WITH photos -> inspect -> "Backup ready", then a SECOND tap shares it and nothing is recorded before that', async () => {
    const d = eng(), user = userEvent.setup(); render(<CrashScreen name="Error" deps={d} />);
    await user.click(screen.getByTestId('crash-backup')); const ready = await screen.findByTestId('crash-backup-ready');
    expect(ready.textContent).toContain('Backup ready, under 1 MB'); expect(ready.textContent).toContain('It is not saved yet. Tap Share backup to save it.'); expect(ready.textContent).not.toContain('Photos are not in this backup');
    expect(d.build).toHaveBeenCalledWith({ includePhotos: true, now: expect.any(Date) }); expect(d.inspect).toHaveBeenCalledTimes(1); expect(d.deliver).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('crash-share')); const done = await screen.findByTestId('crash-backup-shared');
    expect(done.textContent).toBe('Backup sharedIf you chose Save to Files, it is in the folder you picked.'); expect(d.deliver).toHaveBeenCalledWith(expect.any(Blob), 'SparkCheck-backup-2026-10-21.zip', { includesPhotos: true, now: expect.any(Date) });
  });
  it('an estimate of 100 MB or more builds WITHOUT photos and says so', async () => {
    const d = eng({ measure: vi.fn(async () => ({ estimatedBytes: 100 * MB })) }); render(<CrashScreen name="Error" deps={d} />);
    await userEvent.setup().click(screen.getByTestId('crash-backup')); const r = await screen.findByTestId('crash-backup-ready');
    expect(d.build).toHaveBeenCalledWith({ includePhotos: false, now: expect.any(Date) }); expect(r.textContent).toContain('Photos are not in this backup. They are still on this phone.');
  });
  it('the button is disabled and the screen says to keep it open while the backup is made', async () => {
    let release; const d = eng({ build: vi.fn(() => new Promise(r => { release = () => r({ blob: new Blob(['z']), filename: 'f.zip' }); })) }); render(<CrashScreen name="Error" deps={d} />);
    await userEvent.setup().click(screen.getByTestId('crash-backup')); await screen.findByTestId('crash-backup-making');
    const b = screen.getByTestId('crash-backup'); expect(b.disabled).toBe(true); expect(b.textContent).toBe('Making the backup…'); expect(screen.getByTestId('crash-backup-making').textContent).toBe('Keep this screen open while the backup is made.'); await act(async () => release());
    await screen.findByTestId('crash-backup-ready');
  });
  it.each([['measure throws', { measure: vi.fn(async () => { throw new Error('ZQSITE-m'); }) }], ['build throws', { build: vi.fn(async () => { throw new Error('ZQSITE-b'); }) }], ['the built file fails the check', { inspect: vi.fn(async () => ({ ok: false, message: 'ZQSITE-i' })) }]])('%s -> "could not be made", nothing offered, no name in the log', async (_, over) => {
    const d = eng(over); render(<CrashScreen name="Error" deps={d} />); await userEvent.setup().click(screen.getByTestId('crash-backup'));
    const f = await screen.findByTestId('crash-backup-failed'); expect(f.textContent).toBe('The backup could not be madeNothing on this phone was changed. Please try again.'); expect(screen.queryByTestId('crash-share')).toBeNull(); expect(d.deliver).not.toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('ZQSITE'); expect(screen.getByTestId('crash-reload')).toBeTruthy();
  });
  it('a closed share sheet keeps the backup ready; a failed share and a throwing share say "could not be saved"', async () => {
    const user = userEvent.setup(); let d = eng({ deliver: vi.fn(async () => ({ ok: false, cancelled: true })) }); render(<CrashScreen name="Error" deps={d} />);
    await user.click(screen.getByTestId('crash-backup')); await user.click(await screen.findByTestId('crash-share')); expect((await screen.findByTestId('crash-backup-ready')).textContent).toContain('The share sheet was closed, so no backup was saved. Your backup is still ready.');
    for (const dl of [vi.fn(async () => ({ ok: false, error: true, message: 'ZQSITE' })), vi.fn(async () => { throw new Error('ZQSITE'); }), vi.fn(() => { throw new Error('ZQSITE'); })]) {
      cleanup(); d = eng({ deliver: dl }); render(<CrashScreen name="Error" deps={d} />); await user.click(screen.getByTestId('crash-backup')); await user.click(await screen.findByTestId('crash-share'));
      expect((await screen.findByTestId('crash-backup-failed-save')).textContent).toBe('The backup could not be savedNothing was recorded as saved. Please try again.');
    }
    expect(JSON.stringify(warn.mock.calls)).not.toContain('ZQSITE');
  });
});

describe('Make a backup with the REAL engine over seeded fictional data', () => {
  it('the file it offers passes the same check a restore runs and holds the seeded site; the data is unchanged', async () => {
    const before = snapshot(); let blob; const d = deps({ measure: backupMeasure, build: backupBuild, inspect: backupInspect, deliver: vi.fn(async b => { blob = b; return ok; }) });
    render(<CrashScreen name="Error" deps={d} />); const user = userEvent.setup();
    await user.click(screen.getByTestId('crash-backup')); await screen.findByTestId('crash-backup-ready', {}, { timeout: 8000 }); await user.click(screen.getByTestId('crash-share')); await screen.findByTestId('crash-backup-shared');
    expect(blob).toBeInstanceOf(Blob); const chk = await backupInspect(blob); expect(chk.ok).toBe(true); expect(new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()))).toContain('rcd-projects-v6');
    expect(snapshot()).toBe(before);
  }, 30000);
});

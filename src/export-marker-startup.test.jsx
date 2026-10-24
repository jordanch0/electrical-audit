// THE EXPORT MARKER (release t), the start-up side. FICTIONAL data. When the phone kills the page in the middle of an export, the record is still there at the next start. exportMarkCheck() (called from main.jsx one tick after
// the first render) finds it and shows ONE quiet notice at the top, in the app's single notice slot: the default words blame memory and give the advice; a record whose page was ever hidden says the page was closed or left in the
// background. A record of this very page is not a crash; a fresh heartbeat belongs to another tab and is looked at once more after 16 s; junk is ignored; the key is removed BEFORE the notice, so it shows once. Timer rule (release r).
import fs from 'node:fs';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { runExport, exportMarkCheck, exportMarkRead, EXPORT_MARK_KEY, installGlobalErrorNotice, AppErrorBoundary } from './App.jsx';

const fakeTimers = toFake => { vi.useRealTimers(); vi.useFakeTimers({ toFake: [...new Set([...toFake, ...(process.env.CLOCK_AT ? ['Date'] : [])])] }); if (process.env.CLOCK_AT) vi.setSystemTime(new Date(process.env.CLOCK_AT)); };
let uninstall, warn;
beforeEach(() => { localStorage.clear(); warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); document.body.innerHTML = ''; uninstall = installGlobalErrorNotice(); });
afterEach(() => { cleanup(); try { uninstall(); } catch (_) {} vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML = ''; });
const notice = () => document.querySelector('[data-testid="export-unfinished-notice"]');
const put = o => localStorage.setItem(EXPORT_MARK_KEY, JSON.stringify({ v: 1, mod: 'gsd', at: '2026-10-23T01:00:00.000Z', beat: Date.now() - 60000, tab: 'otherpage', hid: false, ...o }));
const MEMORY = 'The phone probably ran out of memory. Your saved audits are safe. Close other apps and try again. If it keeps happening, this site may have too many photos for one export.';

describe('a stale record: one quiet notice, once', () => {
  it('nothing stored: nothing happens', () => { expect(exportMarkCheck()).toBe('none'); expect(notice()).toBeNull(); expect(warn).not.toHaveBeenCalled(); });
  it('a stale record shows ONE notice with the memory words and the advice, removes the key first, and never shows twice', () => {
    put({}); expect(exportMarkCheck()).toBe('shown'); const n = notice(); expect(n).not.toBeNull(); expect(n.getAttribute('role')).toBe('alert');
    expect(n.textContent).toContain('The last export did not finish.'); expect(n.textContent).toContain(MEMORY); expect(n.textContent).not.toMatch(/keep SparkCheck open|closed or left/);
    expect(localStorage.getItem(EXPORT_MARK_KEY)).toBeNull(); expect(exportMarkCheck()).toBe('none'); expect(document.querySelectorAll('[data-testid="export-unfinished-notice"]')).toHaveLength(1);
  });
  it('it is dismissible with a 44 px Dismiss button, sits at the top, and carries no claim about the data beyond "saved audits are safe"', () => {
    put({}); exportMarkCheck(); const n = notice(); const btn = n.querySelector('[data-testid="app-error-notice-dismiss"]'); expect(btn.textContent).toBe('Dismiss'); expect(btn.style.minHeight).toBe('44px'); expect(n.style.top).toContain('safe-area-inset-top'); expect(n.style.bottom).toBe('');
    btn.click(); expect(notice()).toBeNull(); expect(n.textContent).not.toMatch(/device/i);
  });
  it('hid true: the words say the page was closed or left in the background and do not blame memory', () => {
    put({ hid: true }); exportMarkCheck(); const t = notice().textContent; expect(t).toContain('The last export did not finish because SparkCheck was closed or left in the background.'); expect(t).toContain('Your saved audits are safe.'); expect(t).toContain('keep SparkCheck open'); expect(t).not.toMatch(/memory/);
  });
  it('the log line is the code and the module key only, and a hostile module value is logged as "export"', () => {
    put({ mod: 'iel' }); exportMarkCheck(); put({ mod: 'ZQ Site: Mulberry' }); document.body.innerHTML = ''; uninstall(); uninstall = installGlobalErrorNotice(); exportMarkCheck();
    const calls = warn.mock.calls.filter(c => c[1] === 'export-unfinished'); expect(calls).toEqual([['[SparkCheck]', 'export-unfinished', 'iel', 'Error'], ['[SparkCheck]', 'export-unfinished', 'export', 'Error']]); expect(JSON.stringify(calls)).not.toMatch(/Mulberry|ZQ/);
  });
  it('the notice uses the app\'s one slot: with another notice already up, none is stacked (and the record is still taken away)', () => {
    window.dispatchEvent(new ErrorEvent('error', { message: 'x', error: new Error('x') })); expect(document.querySelector('[data-testid="app-error-notice"]')).not.toBeNull(); put({}); exportMarkCheck();
    expect(notice()).toBeNull(); expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1); expect(localStorage.getItem(EXPORT_MARK_KEY)).toBeNull();
  });
  it('the error screen suppresses the notice (the record is still removed, so it does not come back after a reload)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {}); const Bomb = () => { throw new Error('x'); };
    const { unmount } = render(<AppErrorBoundary deps={{ reload: vi.fn(), canBackup: () => false }}><Bomb /></AppErrorBoundary>); put({}); expect(exportMarkCheck()).toBe('crash-screen'); expect(notice()).toBeNull(); expect(localStorage.getItem(EXPORT_MARK_KEY)).toBeNull(); unmount();
  });
});

describe('records that are not a crash', () => {
  it('a fresh heartbeat (another tab still building) is left alone and looked at once more after 16 s; if it is still there and stale then, the notice shows', async () => {
    fakeTimers(['setTimeout', 'clearTimeout', 'Date']); put({ beat: Date.now() - 3000 }); expect(exportMarkCheck()).toBe('fresh'); expect(notice()).toBeNull(); expect(exportMarkRead()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(15900); expect(notice()).toBeNull(); await vi.advanceTimersByTimeAsync(200); expect(notice()).not.toBeNull(); expect(localStorage.getItem(EXPORT_MARK_KEY)).toBeNull();
  });
  it('a fresh heartbeat whose build then finished (the key is gone at the second look) is never reported', async () => {
    fakeTimers(['setTimeout', 'clearTimeout']); put({ beat: Date.now() - 3000 }); exportMarkCheck(); localStorage.removeItem(EXPORT_MARK_KEY); await vi.advanceTimersByTimeAsync(20000); expect(notice()).toBeNull();
  });
  it('the second look is the last one: a record that is fresh again is not looked at a third time', async () => {
    fakeTimers(['setTimeout', 'clearTimeout', 'Date']); put({ beat: Date.now() - 3000 }); exportMarkCheck(); await vi.advanceTimersByTimeAsync(15000); put({ beat: Date.now() }); await vi.advanceTimersByTimeAsync(1100);
    expect(notice()).toBeNull(); expect(exportMarkRead()).not.toBeNull(); expect(vi.getTimerCount()).toBe(0);
  });
  it('the record of THIS very page (a build running now) is not a crash', () => {
    const p = runExport('gsd:snap:a', () => new Promise(() => {})); expect(exportMarkRead().tab).toMatch(/^[a-z0-9]{1,8}$/); expect(exportMarkCheck()).toBe('own'); expect(notice()).toBeNull(); expect(exportMarkRead()).not.toBeNull(); expect(p).toBeInstanceOf(Promise);
  });
  it.each([['not json', 'not json'], ['an array', '[1,2]'], ['no beat', '{"v":1,"tab":"x"}'], ['a text beat', '{"v":1,"beat":"x","tab":"x"}'], ['no tab', '{"v":1,"beat":1}'], ['another version', '{"v":2,"beat":1,"tab":"x"}'], ['null', 'null']])('junk (%s) is ignored without a notice or an error', (_n, text) => {
    localStorage.setItem(EXPORT_MARK_KEY, text); expect(exportMarkCheck()).toBe('none'); expect(notice()).toBeNull(); expect(warn).not.toHaveBeenCalled();
  });
  it('a storage that throws when read gives "none", not an error', () => { vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); }); expect(exportMarkCheck()).toBe('none'); expect(notice()).toBeNull(); });
});

describe('source scan: main.jsx', () => {
  const MAIN = fs.readFileSync(process.cwd() + '/src/main.jsx', 'utf8').replace(/\r\n/g, '\n');
  it('imports exportMarkCheck and calls it in its own zero-delay timer, guarded by the Settings-only flag and a try, AFTER the first render and after the persist call', () => {
    expect(MAIN).toMatch(/import App, \{[^}]*\bexportMarkCheck\b[^}]*\} from '\.\/App\.jsx'/);
    expect(MAIN).toContain("setTimeout(() => { try { if (!eraseRuntime.state.settingsOnly) exportMarkCheck() } catch (_) {} }, 0)");
    expect(MAIN.match(/exportMarkCheck\(\)/g)).toHaveLength(1);
    expect(MAIN.indexOf('exportMarkCheck()')).toBeGreaterThan(MAIN.indexOf('requestPersistentStorage() }')); expect(MAIN.indexOf('exportMarkCheck()')).toBeGreaterThan(MAIN.indexOf('window.__sparkcheckBooted = true'));
  });
  it('the notice words are the ones Jordan chose (the advice sentence) and never say "device"', () => {
    const SRC = fs.readFileSync(process.cwd() + '/src/App.jsx', 'utf8'); expect(SRC).toContain('Close other apps and try again. If it keeps happening, this site may have too many photos for one export.');
    const a = SRC.indexOf('const EXPORT_NOTICE_MEMORY'), z = SRC.indexOf('async function runExport(scope, fn) {'); expect(SRC.slice(a, z)).not.toMatch(/\bdevice\b/i);
  });
});

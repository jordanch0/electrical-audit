// THE ONE SMALL NOTICE FOR UNHANDLED ERRORS AND REJECTIONS (release r). Real window "error" / "unhandledrejection" events in jsdom. One notice at a time at the TOP of the screen (never over the bottom Storage-full
// banner or the update toast), dismissible, no claim about the data, no auto-hide; harmless browser noise is ignored; it is quiet while the error screen is up; it never stops the error; the log holds a code and the error name.
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installGlobalErrorNotice, AppErrorBoundary } from './App.jsx';

let uninstall, warn;
beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); uninstall = installGlobalErrorNotice(); });
afterEach(() => { uninstall(); cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); document.body.innerHTML = ''; });
const err = (o = {}) => { const e = new ErrorEvent('error', { message: 'boom', filename: 'https://example.test/assets/index-abc.js', error: new Error('boom'), cancelable: true, ...o }); window.dispatchEvent(e); return e; };
const rej = reason => { const e = new Event('unhandledrejection', { cancelable: true }); e.reason = reason; e.promise = Promise.resolve(); window.dispatchEvent(e); return e; };
const notice = () => document.querySelector('[data-testid="app-error-notice"]');
const pause = ms => new Promise(r => setTimeout(r, ms));

describe('what it shows', () => {
  it('one notice: the words, role alert, an icon, a real Dismiss button of 44 px; it is a child of the body, not of #root', () => {
    const root = document.createElement('div'); root.id = 'root'; document.body.appendChild(root); err();
    const n = notice(); expect(n.getAttribute('role')).toBe('alert'); expect(n.textContent).toBe('Something went wrong in the background.If a screen looks wrong, close and reopen SparkCheck.Dismiss');
    expect(n.querySelector('svg')).toBeTruthy(); const d = n.querySelector('button'); expect(d.textContent).toBe('Dismiss'); expect(d.style.minHeight).toBe('44px'); expect(n.parentElement).toBe(document.body); expect(root.contains(n)).toBe(false);
  });
  it('it makes no claim about the data', () => { err(); expect(notice().textContent).not.toMatch(/saved|data|audit|lost|backup/i); });
  it('it is fixed, above the page but BELOW the bottom banner / update toast (99999), and set only from the top', () => {
    err(); const s = notice().style; expect(s.position).toBe('fixed'); expect(s.zIndex).toBe('99998'); expect(s.bottom).toBe(''); expect(s.maxWidth).toBe('480px');
  });
  it('the source places it from the top, below the safe area, and the bottom banner and toast are the bottom ones', () => {
    const app = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8'), main = fs.readFileSync(path.join(__dirname, 'main.jsx'), 'utf8');
    expect(app).toMatch(/top:calc\(env\(safe-area-inset-top, 0px\) \+ 8px\);max-width:480px/); expect(app).not.toMatch(/data-testid", "app-error-notice"[\s\S]{0,400}bottom:/);
    expect(app).toMatch(/position:fixed;left:16px;right:16px;bottom:16px;[^'"]*z-index:99999/); expect(main).toMatch(/bottom: 12[\s\S]{0,40}zIndex: 99999/);
  });
  it('no auto-hide: it is still there a long time later', async () => { vi.useRealTimers(); vi.useFakeTimers(); err(); await vi.advanceTimersByTimeAsync(10 * 60 * 1000); expect(notice()).toBeTruthy(); });
});

describe('one at a time, Dismiss, cooldown', () => {
  it('a second error while it is showing adds nothing', () => { err(); err({ message: 'second', error: new Error('second') }); rej(new Error('third')); expect(document.querySelectorAll('[data-testid="app-error-notice"]')).toHaveLength(1); });
  it('Dismiss removes it; nothing new within 10 s; a new one after 10 s', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 21, 12, 0, 0)); err();
    await userEvent.setup({ advanceTimers: () => {} }).click(notice().querySelector('button')); expect(notice()).toBeNull();
    vi.setSystemTime(new Date(2026, 9, 21, 12, 0, 9)); err(); expect(notice()).toBeNull();
    vi.setSystemTime(new Date(2026, 9, 21, 12, 0, 11)); err(); expect(notice()).toBeTruthy();
  });
});

describe('harmless noise is ignored', () => {
  it.each([
    ['ResizeObserver loop (completed)', () => err({ message: 'ResizeObserver loop completed with undelivered notifications.', error: undefined })],
    ['ResizeObserver loop (limit)', () => err({ message: 'ResizeObserver loop limit exceeded', error: undefined })],
    ['a browser-extension script (chrome)', () => err({ filename: 'chrome-extension://abcdef/content.js' })],
    ['a browser-extension script (moz)', () => err({ filename: 'moz-extension://abcdef/content.js' })],
    ['a browser-extension script (safari)', () => err({ filename: 'safari-web-extension://abcdef/content.js' })],
    ['an extension in the stack only', () => err({ error: Object.assign(new Error('x'), { stack: 'Error: x\n    at f (safari-extension://abc/x.js:1:1)' }) })],
    ['"Script error." with no file', () => err({ message: 'Script error.', filename: '', error: undefined })],
    ['a closed share sheet (AbortError)', () => rej(Object.assign(new Error('Share canceled'), { name: 'AbortError' }))],
    ['an empty rejection (undefined)', () => rej(undefined)],
    ['an empty rejection (null)', () => rej(null)],
    ['the offline service-worker update check', () => rej(new TypeError('Failed to update a ServiceWorker for scope ("https://example.test/") with script ("sw.js"): Load failed'))],
    ['an extension rejection', () => rej(Object.assign(new Error('x'), { stack: 'Error: x\n at chrome-extension://abc/y.js:2:2' }))],
  ])('%s', (_, fire) => { fire(); expect(notice()).toBeNull(); });
  it.each([
    ['an ordinary error', () => err()], ['an ordinary rejection (an Error)', () => rej(new Error('save failed'))], ['a rejection that is a string', () => rej('nope')], ['"Script error." WITH a file', () => err({ message: 'Script error.', filename: 'https://example.test/a.js' })],
  ])('%s shows the notice', (_, fire) => { fire(); expect(notice()).toBeTruthy(); });
});

describe('it never gets in the way', () => {
  it('it does not stop the error (no preventDefault on an error or a rejection)', () => { expect(err().defaultPrevented).toBe(false); expect(rej(new Error('x')).defaultPrevented).toBe(false); });
  it('the log is a code and the error NAME only: no message, no stack (every error is logged, only one notice is shown)', () => {
    err({ error: new RangeError('ZQSITE-Mulberry-Depot at /secret/path') }); rej(new TypeError('ZQSITE-Mulberry-Depot')); const l = warn.mock.calls;
    expect(l).toEqual([['[SparkCheck]', 'uncaught', 'RangeError'], ['[SparkCheck]', 'rejected', 'TypeError']]); expect(JSON.stringify(l)).not.toContain('ZQSITE'); expect(document.querySelectorAll('[data-testid="app-error-notice"]')).toHaveLength(1);
  });
  it('quiet while the error screen is up; works again once it is gone (also for a boundary-caught error React reports on window in development)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {}); const Bomb = () => { throw new Error('x'); };
    const { unmount } = render(<AppErrorBoundary deps={{ reload: vi.fn(), canBackup: () => false }}><Bomb /></AppErrorBoundary>);
    expect(screen.getByTestId('crash-screen')).toBeTruthy(); err(); rej(new Error('y')); expect(notice()).toBeNull(); unmount(); err(); expect(notice()).toBeTruthy();
  });
  it('uninstall removes the listeners and any notice', () => {
    err(); expect(notice()).toBeTruthy(); uninstall(); expect(notice()).toBeNull();
    const swallow = e => e.preventDefault(); window.addEventListener('error', swallow); err(); window.removeEventListener('error', swallow); expect(notice()).toBeNull(); uninstall = installGlobalErrorNotice();
  });
  it('it never reads or writes storage', () => { const s = vi.spyOn(Storage.prototype, 'setItem'), g = vi.spyOn(Storage.prototype, 'getItem'); err(); rej(new Error('x')); expect(s).not.toHaveBeenCalled(); expect(g).not.toHaveBeenCalled(); });
});

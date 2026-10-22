// THE OLD INLINE PAGE-WIPE HANDLERS ARE A START-UP NET ONLY (release r). index.html used to replace document.body with a raw stack trace on ANY uncaught error or rejection (so a failed export, a ResizeObserver message or an
// extension error wiped the app). Now they act only until src/main.jsx has handed the first render to React (window.__sparkcheckBooted); after that the app's own error screen and one small notice take over.
// main.jsx wraps the app (and only the app) in the error screen, so the update toast still works on it.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, afterEach, vi } from 'vitest';

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'), MAIN = fs.readFileSync(path.join(__dirname, 'main.jsx'), 'utf8');
const block = HTML.slice(HTML.indexOf('window.onerror = function'), HTML.indexOf('window.__hideLoading = function'));

describe('index.html', () => {
  it('both handlers return before showErr once the app has started', () => {
    const oe = block.slice(block.indexOf('window.onerror'), block.indexOf('window.addEventListener'));
    const ur = block.slice(block.indexOf("window.addEventListener('unhandledrejection'"));
    expect(oe.indexOf('if (window.__sparkcheckBooted) return false;')).toBeGreaterThan(-1); expect(oe.indexOf('__sparkcheckBooted')).toBeLessThan(oe.indexOf('showErr('));
    expect(ur.indexOf('if (window.__sparkcheckBooted) return;')).toBeGreaterThan(-1); expect(ur.indexOf('__sparkcheckBooted')).toBeLessThan(ur.indexOf('showErr('));
  });
  it('the start-up net is still there before the app starts (a script that fails to load still shows the plain error page)', () => { expect(block).toContain("showErr('Error line '"); expect(block).toContain("showErr('Promise Error'"); });
  describe('run for real', () => {
    afterEach(() => { window.onerror = null; delete window.__sparkcheckBooted; });
    const install = () => { const showErr = vi.fn(); const listeners = []; const orig = window.addEventListener.bind(window); const spy = vi.spyOn(window, 'addEventListener').mockImplementation((t, f, o) => { listeners.push([t, f]); return orig(t, f, o); }); new Function('showErr', block)(showErr); spy.mockRestore(); return { showErr, listeners }; };
    it('before start: an error and a rejection show the plain page; after start: nothing is replaced and onerror does not swallow the error', () => {
      const { showErr, listeners } = install(); const rejection = listeners.find(l => l[0] === 'unhandledrejection')[1];
      expect(window.onerror('boom', 'a.js', 3, 4, new Error('boom'))).toBe(true); rejection({ reason: 'nope' }); expect(showErr).toHaveBeenCalledTimes(2);
      showErr.mockClear(); window.__sparkcheckBooted = true;
      expect(window.onerror('ResizeObserver loop completed with undelivered notifications.', '', 0, 0, null)).toBe(false); rejection({ reason: new Error('x') }); expect(showErr).not.toHaveBeenCalled();
      listeners.forEach(([t, f]) => window.removeEventListener(t, f));
    });
  });
});

describe('main.jsx', () => {
  it('wraps the app in AppErrorBoundary and keeps the update toast OUTSIDE it', () => {
    expect(MAIN).toMatch(/import App, \{[^}]*\bAppErrorBoundary\b[^}]*\binstallGlobalErrorNotice\b[^}]*\} from '\.\/App\.jsx'/);
    expect(MAIN).toMatch(/React\.createElement\(AppErrorBoundary, null, React\.createElement\(App\)\),\s*React\.createElement\(UpdateToast\)/);
  });
  it('sets the boot flag after the first render is handed to React, then installs the notice (own try/catch, never throws)', () => {
    const r = MAIN.indexOf('root.render('), f = MAIN.indexOf('window.__sparkcheckBooted = true'), i = MAIN.indexOf('installGlobalErrorNotice()');
    expect(r).toBeGreaterThan(-1); expect(f).toBeGreaterThan(r); expect(i).toBeGreaterThan(f); expect(MAIN.slice(f)).toMatch(/^[^\n]*\r?\n\s*try \{ installGlobalErrorNotice\(\) \} catch \(_\) \{\}/);
  });
});

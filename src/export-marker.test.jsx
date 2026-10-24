// THE EXPORT MARKER (release t), the writing side. FICTIONAL names. A snapshot export that builds a big file can be killed by the phone (out of memory) and leave no trace. runExport writes ONE small record before the build
// (key sparkcheck-export-running-v1: v, mod, at, beat, tab, hid and nothing else) and removes it when the build function settles: success, a build failure, a handler error, a throw from the hand-over. It is never removed by a
// share sheet closing (that is a later tap). A template is not marked. The 2 s heartbeat timer and the visibility listener end WITH the record: no timer may outlive the build. Every read and write is wrapped: a storage that refuses
// the write means no marker, no timer, and the export runs exactly as before. Timer rule (release r): a test that fakes timers resets first and keeps Date faked at CLOCK_AT when it is set.
import fs from 'node:fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runExport, exportMarkStart, exportMarkRead, EXPORT_MARK_KEY, ExportDeliveryError, backupKeyExcluded, backupKeyAllowed, eraseOwnedKeys } from './App.jsx';
import { phoneOn, phoneOff } from './test/share-env.js';

const SRC = fs.readFileSync(process.cwd() + '/src/App.jsx', 'utf8');
const fakeTimers = toFake => { vi.useRealTimers(); vi.useFakeTimers({ toFake: [...new Set([...toFake, ...(process.env.CLOCK_AT ? ['Date'] : [])])] }); if (process.env.CLOCK_AT) vi.setSystemTime(new Date(process.env.CLOCK_AT)); };
const TIMERS = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'];
beforeEach(() => { localStorage.clear(); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); phoneOff(); Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });
const gone = () => localStorage.getItem(EXPORT_MARK_KEY) === null;

describe('the record: written before the build, exactly six fields, no names', () => {
  it('is there while the build runs with v, mod, at, beat, tab, hid and nothing else; no site name, file name, scope id or size', async () => {
    let release, seen; const p = runExport('gsd:snap:ZQSITE-Mulberry-uid1', () => new Promise(r => { seen = JSON.parse(localStorage.getItem(EXPORT_MARK_KEY)); release = r; }));
    expect(Object.keys(seen).sort()).toEqual(['at', 'beat', 'hid', 'mod', 'tab', 'v']); expect(seen.v).toBe(1); expect(seen.mod).toBe('gsd'); expect(seen.hid).toBe(false);
    expect(typeof seen.beat).toBe('number'); expect(new Date(seen.at).toISOString()).toBe(seen.at); expect(seen.tab).toMatch(/^[a-z0-9]{1,8}$/); expect(JSON.stringify(seen)).not.toMatch(/ZQSITE|Mulberry|uid1|xlsx|snap/);
    release(); await p;
  });
  it('the module is the part of the scope before the first colon, for every module key', async () => {
    for (const mod of ['rcd', 'iel', 'tat', 'thermo', 'swb', 'irt', 'elt', 'welder', 'gsd']) { let m; await runExport(mod + ':snap:zq', async () => { m = exportMarkRead().mod; }); expect(m).toBe(mod); expect(gone()).toBe(true); }
  });
  it('a template is never marked', async () => {
    let during = 'unset'; await runExport('iel:template', async () => { during = localStorage.getItem(EXPORT_MARK_KEY); }); expect(during).toBeNull(); expect(gone()).toBe(true);
  });
});

describe('the heartbeat and the visibility flag', () => {
  it('beat moves every 2 s while the build runs', async () => {
    fakeTimers([...TIMERS, 'Date']); let release; const p = runExport('gsd:snap:a', () => new Promise(r => { release = r; })); const b0 = exportMarkRead().beat;
    await vi.advanceTimersByTimeAsync(2100); expect(exportMarkRead().beat - b0).toBeGreaterThanOrEqual(2000); await vi.advanceTimersByTimeAsync(3000); expect(exportMarkRead().beat - b0).toBeGreaterThanOrEqual(4000); expect(vi.getTimerCount()).toBeGreaterThan(0);
    release(); await p;
  });
  it('the page being hidden during the build sets hid true; a page that stays visible keeps it false', async () => {
    let release; const p = runExport('gsd:snap:a', () => new Promise(r => { release = r; })); expect(exportMarkRead().hid).toBe(false);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); expect(exportMarkRead().hid).toBe(true); release(); await p; expect(gone()).toBe(true);
  });
  it('a heartbeat that cannot be written takes the record away (no false alarm in another tab) and the export still finishes', async () => {
    fakeTimers(TIMERS); const real = Storage.prototype.setItem; let fail = false;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) { if (k === EXPORT_MARK_KEY && fail) throw new DOMException('full', 'QuotaExceededError'); return real.call(this, k, v); });
    let release; const fn = vi.fn(() => new Promise(r => { release = r; })); const p = runExport('gsd:snap:a', fn); expect(exportMarkRead()).not.toBeNull();
    fail = true; await vi.advanceTimersByTimeAsync(2100); expect(gone()).toBe(true); release(); await p; expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('the record and every timer end when the build settles', () => {
  it('success: the record is gone and no timer is left', async () => {
    fakeTimers(TIMERS); let release; const p = runExport('gsd:snap:ZQ', () => new Promise(r => { release = r; })); release(); await p;
    expect(gone()).toBe(true); await vi.advanceTimersByTimeAsync(30000); expect(vi.getTimerCount()).toBe(0); expect(gone()).toBe(true);
  });
  it('a build failure (async throw): gone, no timer, the failure card path still runs', async () => {
    fakeTimers(TIMERS); await runExport('iel:snap:a', async () => { throw new TypeError('boom'); }); expect(gone()).toBe(true); await vi.advanceTimersByTimeAsync(30000); expect(vi.getTimerCount()).toBe(0);
  });
  it('a handler that throws at once (a synchronous throw): gone, no timer', async () => {
    fakeTimers(TIMERS); await runExport('tat:snap:a', () => { throw new RangeError('sync'); }); expect(gone()).toBe(true); await vi.advanceTimersByTimeAsync(30000); expect(vi.getTimerCount()).toBe(0);
  });
  it('a throw from the hand-over (a delivery error): gone, no timer', async () => {
    fakeTimers(TIMERS); await runExport('swb:snap:a', async () => { throw new ExportDeliveryError('x'); }); expect(gone()).toBe(true); await vi.advanceTimersByTimeAsync(30000); expect(vi.getTimerCount()).toBe(0);
  });
  it('the visibility listener is removed with the record (a hidden page afterwards writes nothing)', async () => {
    const add = vi.spyOn(document, 'addEventListener'), rem = vi.spyOn(document, 'removeEventListener'); await runExport('gsd:snap:a', async () => {});
    const added = add.mock.calls.filter(c => c[0] === 'visibilitychange'), removed = rem.mock.calls.filter(c => c[0] === 'visibilitychange'); expect(added).toHaveLength(1); expect(removed).toHaveLength(1); expect(removed[0][1]).toBe(added[0][1]);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); expect(gone()).toBe(true);
  });
  it('the record is cleared when the BUILD settles, not when a share sheet closes: a held ready file leaves no record, and sharing it later writes none', async () => {
    const share = phoneOn({ share: vi.fn(() => new Promise(() => {})) }); const setItem = vi.spyOn(Storage.prototype, 'setItem');
    await runExport('gsd:snap:a', async h => { h('QUJD', 'f.xlsx'); }); expect(gone()).toBe(true); const marks = setItem.mock.calls.filter(c => c[0] === EXPORT_MARK_KEY).length; expect(marks).toBeGreaterThan(0); expect(share).not.toHaveBeenCalled();
    expect(setItem.mock.calls.filter(c => c[0] === EXPORT_MARK_KEY)).toHaveLength(marks);
  });
});

describe('several builds, repeat taps, a refusing storage', () => {
  it('a repeat tap on a running scope starts no second marker and no second build', async () => {
    let release; const fn = vi.fn(() => new Promise(r => { release = r; })); const a = runExport('swb:snap:a', fn); const setItem = vi.spyOn(Storage.prototype, 'setItem'); runExport('swb:snap:a', fn);
    expect(fn).toHaveBeenCalledTimes(1); expect(setItem.mock.calls.filter(c => c[0] === EXPORT_MARK_KEY)).toHaveLength(0); release(); await a; expect(gone()).toBe(true);
  });
  it('two builds at once share one record and one timer; it goes only when the LAST one ends', async () => {
    fakeTimers(TIMERS); let r1, r2; const a = runExport('elt:snap:a', () => new Promise(r => { r1 = r; })), b = runExport('welder:snap:b', () => new Promise(r => { r2 = r; })); const timers = vi.getTimerCount();
    r1(); await a; expect(exportMarkRead()).not.toBeNull(); expect(vi.getTimerCount()).toBeGreaterThan(0); r2(); await b; expect(gone()).toBe(true); await vi.advanceTimersByTimeAsync(30000); expect(vi.getTimerCount()).toBe(0); expect(timers).toBeGreaterThan(0);
  });
  it('the end function works once only: ending the same start twice does not end the other build', () => {
    fakeTimers(TIMERS); const a = exportMarkStart('iel:snap:a'), b = exportMarkStart('tat:snap:b'); a(); a(); expect(exportMarkRead()).not.toBeNull(); b(); expect(gone()).toBe(true); b(); expect(vi.getTimerCount()).toBe(0);
  });
  it('a storage that refuses the first write (full, private mode) means no record, no timer, and the export runs', async () => {
    fakeTimers(TIMERS); const real = Storage.prototype.setItem; vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) { if (k === EXPORT_MARK_KEY) throw new DOMException('full', 'QuotaExceededError'); return real.call(this, k, v); });
    const fn = vi.fn(async () => {}); await runExport('gsd:snap:a', fn); expect(fn).toHaveBeenCalledTimes(1); expect(gone()).toBe(true); await vi.advanceTimersByTimeAsync(30000); expect(vi.getTimerCount()).toBe(0);
  });
  it('a storage that throws on every access (read, write and remove) still lets the export run and end', async () => {
    const boom = () => { throw new Error('blocked'); }; vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom); vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom); vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom);
    const fn = vi.fn(async () => {}); await expect(runExport('iel:snap:a', fn)).resolves.toBeUndefined(); expect(fn).toHaveBeenCalledTimes(1); expect(exportMarkRead()).toBeNull();
  });
  it('a failure of the build is still reported as before (one log line, the failure kept for the card)', async () => {
    await runExport('iel:snap:a', async () => { throw new TypeError('boom'); }); const calls = console.warn.mock.calls.filter(c => c[0] === '[SparkCheck export]'); expect(calls).toEqual([['[SparkCheck export]', 'build-failed', 'iel', 'TypeError']]);
  });
});

describe('the key is an app note: not in a backup, removed by Delete all data', () => {
  it('backupKeyExcluded names it, backupKeyAllowed does not, and Delete all data (eraseOwnedKeys) removes it', () => {
    expect(EXPORT_MARK_KEY).toBe('sparkcheck-export-running-v1'); expect(backupKeyExcluded(EXPORT_MARK_KEY)).toBe(true); expect(backupKeyAllowed(EXPORT_MARK_KEY)).toBe(false);
    localStorage.setItem(EXPORT_MARK_KEY, '{"v":1}'); localStorage.setItem('some-other-app-key', 'x'); const r = eraseOwnedKeys(localStorage); expect(r.failed).toBe(0); expect(gone()).toBe(true); expect(localStorage.getItem('some-other-app-key')).toBe('x');
  });
  it('it has plain words for a message that must name it', () => { expect(SRC).toContain('"sparkcheck-export-running-v1": "Export in progress note"'); });
});

describe('source scan: what the marker is allowed to be', () => {
  const a = SRC.indexOf('// ── THE EXPORT MARKER (release t)'), z = SRC.indexOf('async function runExport(scope, fn) {'); const block = SRC.slice(a, z);
  const code = block.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  it('the record literal has exactly the six keys and the module comes only from the scope\'s first part', () => {
    const m = /exportMarkRec = \{([^}]*)\}/.exec(code); expect(m).not.toBeNull(); expect(m[1].split(',').map(s => s.split(':')[0].trim())).toEqual(['v', 'mod', 'at', 'beat', 'tab', 'hid']); expect(m[1]).toContain('String(scope).split(":")[0]');
    expect((code.match(/\bscope\b/g) || [])).toHaveLength(2);       // the parameter and that one use
  });
  it('the only storage write is the one in exportMarkWrite; the only removes are in the marker functions; no other storage is touched', () => {
    expect(code.match(/localStorage\.setItem\(/g)).toHaveLength(1); expect(/function exportMarkWrite\(rec\) \{ try \{ localStorage\.setItem\(EXPORT_MARK_KEY, JSON\.stringify\(rec\)\)/.test(code)).toBe(true);
    expect(code).not.toMatch(/sessionStorage|indexedDB|save\(|\.setItem\((?!EXPORT_MARK_KEY)/);
  });
  it('every storage call in the marker code is inside a try (read, write, remove, the heartbeat, the visibility handler, the end function)', () => {
    const lines = code.split('\n').filter(l => /localStorage\./.test(l)); expect(lines.length).toBeGreaterThanOrEqual(5);
    for (const l of lines) { const i = code.indexOf(l); const before = code.slice(0, i + l.indexOf('localStorage.')); const tries = (before.match(/\btry \{/g) || []).length, catches = (before.match(/\bcatch \(_\)/g) || []).length; expect(tries - catches, l.trim().slice(0, 80)).toBeGreaterThan(0); }
  });
  it('runExport: the marker starts before the first await, the original body is untouched inside an outer try, and the outer finally ends the marker', () => {
    const r = SRC.slice(SRC.indexOf('async function runExport(scope, fn) {'), SRC.indexOf('// ── EXPORT HAND-OVER (release t)'));
    expect(r.match(/exportMarkStart\(scope\)/g)).toHaveLength(1); expect(r).toMatch(/const markEnd = \/:template\$\/\.test\(scope\) \? \(\) => \{\} : exportMarkStart\(scope\);/); expect(r.match(/\} finally \{ markEnd\(\); \}/g)).toHaveLength(1);
    expect(r.indexOf('exportMarkStart(scope)')).toBeLessThan(r.indexOf('await fn(')); expect(r.indexOf('} finally { markEnd(); }')).toBeGreaterThan(r.indexOf('finally { clearTimeout(timer);'));
    expect(r).toContain('try { await fn((base64, filename, done) => exportHandOver(scope, { base64, filename, mimeType: XLSX_MIME }, done)); }');
  });
  it('the timer and the listener are created only in exportMarkStart and removed only in its end function', () => {
    expect(code.match(/setInterval\(/g)).toHaveLength(1); expect(code.match(/clearInterval\(/g)).toHaveLength(1); expect(code.match(/addEventListener\("visibilitychange"/g)).toHaveLength(1); expect(code.match(/removeEventListener\("visibilitychange"/g)).toHaveLength(1);
  });
});

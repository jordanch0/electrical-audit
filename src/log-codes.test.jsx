// THE TWO OLDER console.error LINES NOW LOG A CODE, THE MODULE KEY AND THE ERROR NAME ONLY (release s). "Storage save failed" (in save()) and "Load error" (RCD load) used to print the whole error object, whose
// message and stack can carry text from stored data. Both now go through appLog like every other line: a code, the first word of a fixed storage key (never a site name) and the error NAME. Nothing reads these
// logs (no test, no screen, no remote logging); they are for a person with the developer tools open. FICTIONAL names.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { save, appLog } from './App.jsx';

const SITE = 'ZQSITE-Mulberry-Depot';
let warn, err;
beforeEach(() => { localStorage.clear(); warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); err = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); document.querySelectorAll('[role="alert"]').forEach(el => el.remove()); });
const quota = (msg = 'The quota has been exceeded for ' + SITE) => { const e = new Error(msg); e.name = 'QuotaExceededError'; return e; };

describe('save(): a failed write', () => {
  it('logs [SparkCheck], the code, the module key and the error name; nothing else; no console.error', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw quota(); });
    await save('rcd-projects-v6', [{ name: SITE }]);
    expect(warn.mock.calls).toEqual([['[SparkCheck]', 'storage-save-failed', 'rcd', 'QuotaExceededError']]); expect(err).not.toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SITE);
  });
  it('the module key is the first word of the storage key, whatever the module', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw quota(); });
    for (const key of ['iel-results-v2', 'welder-projects-v2', 'gsd-history-v1', 'app-settings-v1', 'sparkcheck-last-backup-v1']) await save(key, {});
    expect(warn.mock.calls.map(c => c[2])).toEqual(['iel', 'welder', 'gsd', 'app', 'sparkcheck']);
  });
  it('an error whose name is not a plain word is logged as Error, and a thrown string too', async () => {
    const odd = new Error('x'); odd.name = 'ZQ Site: Mulberry (Depot)';
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw odd; }).mockImplementationOnce(() => { throw 'a string with ' + SITE; });
    await save('tat-projects-v2', {}); await save('tat-projects-v2', {});
    expect(warn.mock.calls).toEqual([['[SparkCheck]', 'storage-save-failed', 'tat', 'Error'], ['[SparkCheck]', 'storage-save-failed', 'tat', 'Error']]); expect(JSON.stringify(warn.mock.calls)).not.toContain(SITE);
  });
  it('the blocking Storage-full banner still shows (the behaviour around the log is unchanged)', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw quota(); }); await save('rcd-results-v6', {});
    expect(document.querySelector('[role="alert"]').textContent).toMatch(/Storage full/);
  });
  it('a good save logs nothing', async () => { await save('rcd-meta-v6', { a: 1 }); expect(warn).not.toHaveBeenCalled(); expect(err).not.toHaveBeenCalled(); });
});

describe('appLog', () => {
  it('with a module key: code, module, error name; without one: code and error name only (the earlier lines keep their shape)', () => {
    appLog('load-failed', new RangeError('ZQ ' + SITE), 'rcd'); appLog('crash-screen', new TypeError('ZQ'));
    expect(warn.mock.calls).toEqual([['[SparkCheck]', 'load-failed', 'rcd', 'RangeError'], ['[SparkCheck]', 'crash-screen', 'TypeError']]);
  });
  it('never throws, even for a hostile error object', () => {
    const hostile = { get name() { throw new Error('no'); } }; expect(() => appLog('x', hostile, 'rcd')).not.toThrow(); expect(warn.mock.calls[0]).toEqual(['[SparkCheck]', 'x', 'rcd', 'Error']);
  });
});

describe('source', () => {
  const app = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8');
  it('src/App.jsx contains no console.error call at all', () => { expect(app.split('\n').filter(l => /console\.error\(/.test(l) && !/^\s*\/\//.test(l))).toEqual([]); });
  it('the RCD load catch and save() use appLog with a code and a module key', () => {
    expect(app).toContain('appLog("load-failed", loadErr, "rcd")'); expect(app).toContain('appLog("storage-save-failed", e, key)');
  });
});

// THE CONSOLE LOG NEVER CARRIES CLIENT OR SITE NAMES (Round d). Distinctive FICTIONAL names are put in the backup files (inside corrupt JSON, inside damaged values, inside real sites) and the restore is driven through
// EVERY refusal and failure path of the real Backup and restore section. Everything written to console.warn / log / info / error / debug is collected, and neither the log nor the words on screen may contain a name.
// The log may hold internal reasons only ("[SparkCheck backup]", a code, a short reason). The summary card legitimately names sites (that is its job), so the on-screen check covers the refusal and failure cards.
import 'fake-indexeddb/auto';
import React from 'react';
import { webcrypto } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackupRestoreSection, backupRestore, backupUndo, backupUndoInfo, zipWriter, backupLogReason } from './App.jsx';
import { wipe, backupOf, seedSourceFull, seedPhone } from './test/backup-fixtures.js';

vi.setConfig({ testTimeout: 30000 });
configure({ asyncUtilTimeout: 10000 });
const NAMES = ['ZQCLIENT-Hartwell', 'ZQSITE-Mulberry-Depot', 'ZQCLIENT-Ng', 'ZQ-ABN-99887766554'];
const NOW = new Date(2026, 9, 9, 12, 0);
const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
const enc = new TextEncoder();
const sha = async b => Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256', b))).map(x => x.toString(16).padStart(2, '0')).join('');
const zipOf = entries => { const w = zipWriter(new Date(2026, 9, 5, 12)); entries.forEach(([n, b]) => w.add(n, typeof b === 'string' ? enc.encode(b) : b)); return w.finish(); };
const manifestFor = (dataBytes, over = {}) => async () => ({ format: 'sparkcheck-backup', formatVersion: 1, appVersion: 'x', createdAtUtc: '2026-10-05T00:00:00Z', deviceLocalDate: '2026-10-05', utcOffsetMinutes: 600, localStorage: { file: 'localStorage.json', size: dataBytes.length, sha256: await sha(dataBytes) }, stores: {}, ...over });
const withData = async (dataText, over) => { const bytes = enc.encode(dataText); const m = await manifestFor(bytes, over)(); return zipOf([['manifest.json', JSON.stringify(m)], ['localStorage.json', bytes]]); };
let logged;
beforeEach(async () => { await wipe(); logged = []; for (const m of ['warn', 'log', 'info', 'error', 'debug']) vi.spyOn(console, m).mockImplementation((...a) => { logged.push(m + ': ' + a.map(x => (typeof x === 'string' ? x : x instanceof Error ? x.message + ' ' + x.stack : JSON.stringify(x))).join(' ')); }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const mountIt = () => { const user = userEvent.setup(); render(<BackupRestoreSection gate={{ current: { busy: false, reloadPending: false, reveal: null } }} deps={{ reload: vi.fn(), now: () => NOW, restore: (f, o) => backupRestore(f, { ...o, storage: S, now: NOW }), undo: () => backupUndo({ storage: S, now: NOW }), undoInfo: () => backupUndoInfo(S, NOW) }} />); return user; };
const noNames = (label) => { const all = logged.join('\n') + '\n' + document.body.textContent; for (const n of NAMES) expect(all, label + ' leaked ' + n).not.toContain(n); };
const tryFile = async (blob, label) => { cleanup(); const user = mountIt(); await user.upload(screen.getByTestId('backup-file-input'), new File([blob], 'b.zip')); await screen.findByTestId(/backup-result-(err|info)|backup-summary/); noNames(label); return user; };

describe('no client or site name reaches the console or a refusal card', () => {
  it('a manifest that is not JSON but contains names (a SyntaxError would quote a piece of it)', async () => { await tryFile(zipOf([['manifest.json', '{"format":"sparkcheck-backup","client":"' + NAMES[0] + '", ' + NAMES[1] + ' oops']]), 'corrupt manifest'); expect(logged.some(l => l.includes('[SparkCheck backup]'))).toBe(true); });
  it('a data file whose checksum is right but whose text is not JSON and contains names', async () => { await tryFile(await withData('{"rcd-projects-v6": "' + NAMES[0] + ' ' + NAMES[1] + ' ' + NAMES[2] + ' broken'), 'corrupt data'); expect(logged.join('\n')).toMatch(/\[SparkCheck backup\] invalid/); });
  it('a data file that is JSON but a value is damaged JSON containing names', async () => { await tryFile(await withData(JSON.stringify({ 'swb-projects-v1': '[{"name":"' + NAMES[1] + '","client":"' + NAMES[0] + '"' })), 'damaged value'); });
  it('a data file that is the wrong shape and holds names', async () => { await tryFile(await withData(JSON.stringify([NAMES[0], NAMES[1]])), 'wrong shape'); await tryFile(await withData(JSON.stringify({ 'swb-projects-v1': { name: NAMES[1] } })), 'non-text value'); });
  it('a wrong-format or newer manifest that has names in it', async () => { await tryFile(zipOf([['manifest.json', JSON.stringify({ format: 'other', note: NAMES[0] + NAMES[1] })]]), 'wrong format'); await tryFile(zipOf([['manifest.json', JSON.stringify({ format: 'sparkcheck-backup', formatVersion: 9, note: NAMES[0] })]]), 'newer'); });
  it('a file that is not a zip at all (names in the bytes)', async () => { await tryFile(new Blob([enc.encode(NAMES.join(' ').repeat(40))]), 'not a zip'); });
  it('a real backup of named sites: "nothing to add", not enough room, and a failure part-way', async () => {
    const named = async () => { await seedSourceFull(); const raw = JSON.parse(localStorage.getItem('swb-projects-v1')); raw[0].name = NAMES[1]; raw[0].client = NAMES[0]; rawSetItem('swb-projects-v1', JSON.stringify(raw)); };
    const file = await backupOf(named);
    await named(); await tryFile(file, 'nothing to add'); cleanup(); logged.length = 0; await wipe();
    const user = mountIt(); await user.upload(screen.getByTestId('backup-file-input'), new File([file], 'b.zip')); await screen.findByTestId('backup-summary');
    let c = 0; const orig = IDBObjectStore.prototype.put; vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (...a) { if (++c === 2) throw new Error('disk error for "' + NAMES[0] + '" at ' + NAMES[1]); return orig.apply(this, a); });
    await user.click(screen.getByTestId('backup-restore')); await user.click(screen.getByTestId('backup-restore-confirm-yes')); await screen.findByTestId('backup-result-err');
    const all = logged.join('\n'); for (const n of NAMES) expect(all, 'failure leaked ' + n).not.toContain(n); expect(all).toContain('[SparkCheck backup] failed The restore could not be completed (detail withheld).');
    for (const n of NAMES) expect(screen.getByTestId('backup-result-err').textContent).not.toContain(n);
  });
  it('the redaction itself: quoted pieces are removed, the line is capped, nothing else is changed', () => {
    expect(backupLogReason('Unexpected token in JSON at position 5 near "' + NAMES[0] + '"')).not.toContain(NAMES[0]); expect(backupLogReason('x ' + `\`${NAMES[1]}\``)).not.toContain(NAMES[1]);
    expect(backupLogReason('The restore could not be completed (disk error at ' + NAMES[1] + '). Everything was put back.')).toBe('The restore could not be completed (detail withheld). Everything was put back.');
    expect(backupLogReason('This backup file holds damaged data for ' + NAMES[0] + '.')).toBe('This backup file holds damaged data for a key.'); expect(backupLogReason('This backup file holds a value for ' + NAMES[0] + ' that is not text.')).toBe('This backup file holds a value for a key that is not text.');
    expect(backupLogReason('a'.repeat(1000)).length).toBe(300); expect(backupLogReason('the data does not match its checksum')).toBe('the data does not match its checksum'); expect(backupLogReason(undefined)).toBe('');
  });
  it('every log line starts with the prefix and a code (nothing else is ever written to the console by the section)', async () => {
    await tryFile(new Blob([new Uint8Array(300)]), 'plain'); const lines = logged.filter(l => !l.startsWith('warn: [SparkCheck backup]')); expect(lines).toEqual([]);
  });
});

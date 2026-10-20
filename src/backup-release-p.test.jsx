// RELEASE p, Global Settings wording. FICTIONAL data.
//  - a restore-summary line for a COPY leaves out any zero count (photos only when the module keeps photos AND there are some; History snapshots only when there are some; neither = just the name and module, no colon)
//  - a backup file that STARTS as a zip and then runs out (cut short, or cut in the middle) is "incomplete" (it did not finish saving or downloading); only a file that is not a zip, or another app's zip, is "not a SparkCheck backup file".
//    Checked in the engine (backupInspect) and end to end on the real screen, where the technical text stays in the log and never on screen.
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JSZip from 'jszip';
import { BackupRestoreSection, backupInspect, backupMessageText, backupSummaryText, backupRestore, backupUndo, backupUndoInfo, backupLastBackupText, zipWriter } from './App.jsx';
import { wipe, backupOf, seedSourceFull } from './test/backup-fixtures.js';

vi.setConfig({ testTimeout: 30000 }); configure({ asyncUtilTimeout: 10000 });
const NOW = new Date(2026, 9, 9, 12, 0);
const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
const deps = () => ({ reload: vi.fn(), now: () => NOW, restore: (f, o) => backupRestore(f, { ...o, storage: S, now: NOW }), undo: () => backupUndo({ storage: S, now: NOW }), undoInfo: () => backupUndoInfo(S, NOW), lastText: () => backupLastBackupText(S, NOW) });
let warn;
beforeEach(async () => { await wipe(); warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('the copy lines of the restore summary leave out zero counts', () => {
  const plan = copies => ({ ok: true, modules: [], counts: {}, work: { writes: [] }, events: { add: [], present: [] }, settings: null, headroom: {}, summary: { deviceLocalDate: '2026-10-12', fileBytes: 1000 }, canRestore: true, copies });
  const lines = copies => (backupSummaryText(plan(copies)).groups.find(g => g.id === 'copies') || { lines: [] }).lines;
  it('photos only (a module that keeps photos, a copy with photos and no History snapshot)', () => {
    expect(lines([{ copyName: 'Small Site (backup 12 Oct 2026)', label: 'General Site Defects', photos: 5, snapshots: 0, hasPhotos: true }])).toEqual(['Small Site (backup 12 Oct 2026) in General Site Defects: 5 photos']);
  });
  it('History snapshots only (a module without photos, or a site with no photo)', () => {
    expect(lines([{ copyName: 'Plant Room A (backup 5 Oct 2026)', label: 'RCD Testing', photos: 0, snapshots: 1, hasPhotos: false }])).toEqual(['Plant Room A (backup 5 Oct 2026) in RCD Testing: 1 History snapshot']);
    expect(lines([{ copyName: 'Plant Room B (backup 5 Oct 2026)', label: 'Switchboard', photos: 0, snapshots: 3, hasPhotos: true }])).toEqual(['Plant Room B (backup 5 Oct 2026) in Switchboard: 3 History snapshots']);
  });
  it('neither: just the copy name and the module, no colon; and both: photos then History snapshots', () => {
    expect(lines([{ copyName: 'Cap Site 1 (backup 20 Oct 2026)', label: 'General Site Defects', photos: 0, snapshots: 0, hasPhotos: true }])).toEqual(['Cap Site 1 (backup 20 Oct 2026) in General Site Defects']);
    expect(lines([{ copyName: 'Cap Site 2 (backup 20 Oct 2026)', label: 'RCD Testing', photos: 0, snapshots: 0, hasPhotos: false }])).toEqual(['Cap Site 2 (backup 20 Oct 2026) in RCD Testing']);
    expect(lines([{ copyName: 'X (backup 1 Oct 2026)', label: 'Switchboard', photos: 2, snapshots: 1, hasPhotos: true }])).toEqual(['X (backup 1 Oct 2026) in Switchboard: 2 photos, 1 History snapshot']);
  });
  it('a module that keeps no photos never shows a photo count, whatever the number says', () => {
    expect(lines([{ copyName: 'Plant Room A (backup 5 Oct 2026)', label: 'RCD Testing', photos: 3, snapshots: 2, hasPhotos: false }])).toEqual(['Plant Room A (backup 5 Oct 2026) in RCD Testing: 2 History snapshots']);
  });
  it('the summary object is otherwise unchanged: the group heading and its count of sites', () => {
    const g = backupSummaryText(plan([{ copyName: 'A (backup 1 Oct 2026)', label: 'RCD Testing', photos: 0, snapshots: 0, hasPhotos: false }, { copyName: 'B (backup 1 Oct 2026)', label: 'RCD Testing', photos: 0, snapshots: 1, hasPhotos: false }])).groups.find(x => x.id === 'copies');
    expect(g.heading).toBe('Will be added as copies (the site on this phone is not changed)'); expect(g.summary).toBe('2 sites'); expect(g.lines.length).toBe(2); expect(g.mark).toBe('✓');
  });
});

describe('backupInspect: a file that starts as a zip and runs out is "incomplete"', () => {
  const real = async () => backupOf(seedSourceFull);
  const cutMiddle = blob => new Blob([blob.slice(0, 120), blob.slice(420)]);          // 300 bytes gone from the middle, the end record kept: its directory now points outside the file
  const zipOf = entries => { const w = zipWriter(new Date(2026, 9, 5, 12)); entries.forEach(([n, b]) => w.add(n, new TextEncoder().encode(b))); return w.finish(); };
  it('cut short (the end of the file is gone)', async () => { const f = await real(); for (const cut of [40, 200, 2000]) { const r = await backupInspect(f.slice(0, f.size - cut)); expect(r.ok).toBe(false); expect(r.code, 'cut ' + cut).toBe('incomplete'); expect(r.message).toMatch(/incomplete/); } });
  it('cut in the middle (the end record is there, the directory is outside the file)', async () => { const r = await backupInspect(cutMiddle(await real())); expect(r.ok).toBe(false); expect(r.code).toBe('incomplete'); expect(r.message).toMatch(/directory is outside the file/); });
  it('only the first bytes of a zip are there', async () => { const f = await real(); const r = await backupInspect(f.slice(0, 10)); expect(r.code).toBe('incomplete'); });
  // a zip whose directory says an entry is longer than the file: the entry itself is cut short (a copy that stopped part-way, with its directory intact)
  const bumpEntry = (bytes, name) => { const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), end = bytes.length - 22, cdOff = dv.getUint32(end + 16, true), count = dv.getUint16(end + 10, true); let q = cdOff, hit = 0;
    for (let i = 0; i < count; i++) { const nl = dv.getUint16(q + 28, true), xl = dv.getUint16(q + 30, true), cl = dv.getUint16(q + 32, true), nm = new TextDecoder().decode(bytes.subarray(q + 46, q + 46 + nl)); if (nm === name) { dv.setUint32(q + 20, bytes.length + 5000, true); dv.setUint32(q + 24, bytes.length + 5000, true); hit++; } q += 46 + nl + xl + cl; } return hit; };
  const entryNames = async f => { const bytes = new Uint8Array(await f.arrayBuffer()); const dv = new DataView(bytes.buffer), end = bytes.length - 22, count = dv.getUint16(end + 10, true); let q = dv.getUint32(end + 16, true); const names = []; for (let i = 0; i < count; i++) { const nl = dv.getUint16(q + 28, true), xl = dv.getUint16(q + 30, true), cl = dv.getUint16(q + 32, true); names.push(new TextDecoder().decode(bytes.subarray(q + 46, q + 46 + nl))); q += 46 + nl + xl + cl; } return names; };
  it('an entry that runs past the end of the file is incomplete: the manifest, the data and a photo', async () => {
    const f = await real(); const names = await entryNames(f); const photo = names.find(n => n.startsWith('files/'));
    for (const name of ['manifest.json', 'data.json', photo]) {
      expect(name, 'the backup has this entry').toBeTruthy(); const bytes = new Uint8Array(await f.arrayBuffer()); expect(bumpEntry(bytes, name)).toBe(1);
      const r = await backupInspect(new Blob([bytes])); expect(r.ok, name).toBe(false); expect(r.code, name).toBe('incomplete'); expect(r.message, name).toMatch(/entry is truncated/);
    }
  });
  it('NOT incomplete: a file that does not start as a zip, an empty file, a zip with no manifest, a compressed zip of another app, a manifest of another format', async () => {
    expect((await backupInspect(new Blob(['This is a text file named .zip.']))).code).toBe('not-a-backup');
    expect((await backupInspect(new Blob([new Uint8Array(500).fill(65)]))).code).toBe('not-a-backup');
    expect((await backupInspect(new Blob([]))).code).toBe('not-a-backup');
    expect((await backupInspect(new Blob([new Uint8Array([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])]))).code).toBe('not-a-backup');   // an EMPTY zip (end record only) is a zip, but not a backup
    expect((await backupInspect(await new JSZip().file('notes.txt', 'fictional').generateAsync({ type: 'blob', compression: 'STORE' }))).code).toBe('not-a-backup');
    expect((await backupInspect(await new JSZip().file('manifest.json', JSON.stringify({ format: 'other-app-backup' })).file('notes.txt', 'fictional fictional fictional').generateAsync({ type: 'blob', compression: 'DEFLATE' }))).code).toBe('not-a-backup');
    expect((await backupInspect(zipOf([['manifest.json', JSON.stringify({ format: 'other-app-backup', formatVersion: 1 })]]))).code).toBe('wrong-format');
  });
  it('a damaged entry is still "damaged" (a flipped byte), not incomplete', async () => {
    const f = await real(); const bytes = new Uint8Array(await f.arrayBuffer()); for (let i = 60; i < 90; i++) bytes[i] ^= 0xff; const r = await backupInspect(new Blob([bytes]));
    expect(r.ok).toBe(false); expect(['damaged', 'invalid']).toContain(r.code); expect(r.code).not.toBe('incomplete');
  });
  it('the sentences: incomplete says what to do; not a backup no longer says "or it is incomplete"', () => {
    expect(backupMessageText('incomplete')).toEqual({ title: 'This file cannot be restored', body: 'This backup file is incomplete. It may not have finished saving or downloading. Make the backup again, or copy it to this phone again, then try again.' });
    for (const c of ['not-a-backup', 'wrong-format']) expect(backupMessageText(c)).toEqual({ title: 'This file cannot be restored', body: 'This is not a SparkCheck backup file.' });
    expect(backupMessageText('damaged')).toEqual({ title: 'This file cannot be restored', body: 'This backup file is damaged.' });
  });
});

describe('on the real screen: the five files, the sentence on screen, the technical text only in the log', () => {
  const mount = () => { const user = userEvent.setup(); render(<BackupRestoreSection gate={{ current: { busy: false, reloadPending: false, reveal: null, reload: null } }} deps={deps()} />); return user; };
  const upload = async (user, blob) => { await user.upload(screen.getByTestId('backup-file-input'), new File([blob], 'SparkCheck-backup-2026-10-05.zip', { type: 'application/zip' })); };
  const card = async () => { const c = await screen.findByTestId('backup-result-err'); expect(c.getAttribute('role')).toBe('alert'); expect(screen.queryByTestId('backup-restore')).toBeNull(); return c.textContent; };
  const BAD = 'This file cannot be restored', NOT = 'This is not a SparkCheck backup file.';
  const INC = 'This backup file is incomplete. It may not have finished saving or downloading. Make the backup again, or copy it to this phone again, then try again.';
  const noTech = t => { for (const w of ['zip', 'end record', 'directory', 'checksum', 'manifest', 'truncated', 'compression']) expect(t.toLowerCase(), w).not.toContain(w); };
  it('1 truncated (the last bytes gone)', async () => { const f = await backupOf(seedSourceFull); const user = mount(); await upload(user, f.slice(0, f.size - 40)); const t = await card(); expect(t).toBe(BAD + INC); noTech(t); expect(warn.mock.calls.some(c => c[1] === 'incomplete')).toBe(true); });
  it('2 cut in the middle (the end record is kept)', async () => { const f = await backupOf(seedSourceFull); const user = mount(); await upload(user, new Blob([f.slice(0, 120), f.slice(420)])); const t = await card(); expect(t).toBe(BAD + INC); noTech(t); expect(warn.mock.calls.some(c => c[1] === 'incomplete')).toBe(true); });
  it('3 not a zip (a text file)', async () => { const user = mount(); await upload(user, new Blob(['This is a text file named .zip, fictional.\n'])); const t = await card(); expect(t).toBe(BAD + NOT); noTech(t); expect(warn.mock.calls.some(c => c[1] === 'not-a-backup')).toBe(true); });
  it('4 another app, compressed', async () => { const user = mount(); await upload(user, await new JSZip().file('manifest.json', JSON.stringify({ format: 'other-app-backup', version: 3 })).file('notes.txt', 'fictional fictional fictional fictional').generateAsync({ type: 'blob', compression: 'DEFLATE' })); const t = await card(); expect(t).toBe(BAD + NOT); noTech(t); });
  it('5 another app, stored (a manifest of another format)', async () => { const w = zipWriter(new Date(2026, 9, 5, 12)); w.add('manifest.json', new TextEncoder().encode(JSON.stringify({ format: 'other-app-backup', formatVersion: 1 }))); const user = mount(); await upload(user, w.finish()); const t = await card(); expect(t).toBe(BAD + NOT); noTech(t); expect(warn.mock.calls.some(c => c[1] === 'wrong-format')).toBe(true); });
});

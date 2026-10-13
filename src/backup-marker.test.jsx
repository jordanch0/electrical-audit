// The photo-migration marker (`<module>-photos-migrated-v1`) is written by the app as PLAIN DATE TEXT, not JSON. A backup made after a module opened holds it, so the restore check must not demand JSON for it
// (it used to: "This backup file is not complete" on a file made by the real app). FICTIONAL data only.
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';
import AppRoot, { backupBuild, backupInspect, backupRestore } from './App.jsx';
import { wipe } from './test/backup-fixtures.js';
import { JPEG_A } from './test/jpeg-fixtures.js';

vi.setConfig({ testTimeout: 30000 }); configure({ asyncUtilTimeout: 10000 });
const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
const MARKER = 'welder-photos-migrated-v1', RAW_DATE = new Date().toISOString();       // exactly what migrateSitePhotos writes: plain date text
beforeEach(async () => {
  await wipe();
  vi.stubGlobal('Image', class { set src(v) { this._s = v; queueMicrotask(() => { this.width = 4000; this.height = 3000; this.onload && this.onload(); }); } get src() { return this._s; } });
  HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} }); HTMLCanvasElement.prototype.toDataURL = function () { return this.width > 200 ? JPEG_A : 'data:image/jpeg;base64,AAAA'; };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const mkBackup = async () => (await backupBuild()).blob;

describe('the photo-migration marker in a backup', () => {
  it('as the app writes it (plain date text) the file is complete and restores, and the marker is not restored', async () => {
    rawSetItem('welder-projects-v2', JSON.stringify([{ id: 's1', name: 'Site One', areas: [] }])); rawSetItem(MARKER, RAW_DATE);
    const blob = await mkBackup(); expect(await backupInspect(blob)).toMatchObject({ ok: true });
    await wipe(); const r = await backupRestore(blob, { storage: S }); expect(r.ok, r.message).toBe(true); expect(r.summary).toMatchObject({ sitesAdded: 1 });
    expect(localStorage.getItem(MARKER)).toBeNull();                                                  // the marker is this phone's own business: never restored
  });
  it('a key that is NOT the marker still has to hold JSON (the check is not switched off)', async () => {
    rawSetItem('welder-projects-v2', JSON.stringify([{ id: 's1', name: 'Site One', areas: [] }])); rawSetItem('welder-meta-v1', '{not json');
    expect(await backupInspect(await mkBackup())).toMatchObject({ ok: false, code: 'invalid', message: /damaged data for welder-meta-v1/ });
  });
  it('the real app: open Welder, Make backup with a photo just added, restore those bytes (Delete all data in between)', async () => {
    const user = userEvent.setup(); render(<AppRoot />);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Test Site — Welder Test'], ['SparkCheck'], [''], [''], ['Location', 'Asset ID', 'Welder (Machine)', 'Serial Number'], ['Shed', 'W1', 'Kemppi Evo', 'S1']]), 'S');
    await user.click(screen.getByText('WELDER TESTING')); await user.click(await screen.findByRole('button', { name: '+ Add / Import Site' })); await user.click(screen.getByRole('button', { name: /Import Excel/ }));
    await user.upload(screen.getByTestId('welder-import-file'), new File([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], 'welders.xlsx'));
    await screen.findByText('✓ Preview'); await user.click(screen.getByRole('button', { name: /Import Site/ })); await screen.findByText('Test Site', { selector: 'div' });
    const id = JSON.parse(localStorage.getItem('welder-projects-v2'))[0].id; cleanup();
    rawSetItem('welder-meta-v1', JSON.stringify({ [id]: { auditor: 'J', testDate: '2026-10-13' } })); rawSetItem('welder-audit-active-v1', JSON.stringify({ v: 1, sites: { [id]: {} } }));
    render(<AppRoot />); await user.click(screen.getByText('WELDER TESTING')); await user.click(await screen.findByText('Test Site', { selector: 'div' })); await user.click(screen.getByRole('button', { name: 'Audit' }));
    await user.click(await screen.findByText(/W1/));
    fireEvent.change(await screen.findByTestId('welder-photo-input'), { target: { files: [new File([new Uint8Array([1, 2, 3])], 'cam.jpg', { type: 'image/jpeg' })] } });
    await new Promise(r => setTimeout(r, 300));                                                       // the photo is saved (a person needs seconds to reach Make backup)
    expect(localStorage.getItem(MARKER)).toMatch(/^\d{4}-\d\d-\d\dT/);                                // the real app wrote the marker as plain text
    const { blob, manifest } = await backupBuild(); expect(manifest.stores['site-photos'].length).toBe(2); cleanup();
    expect(await backupInspect(blob)).toMatchObject({ ok: true });
    await wipe(); const r = await backupRestore(blob, { storage: S }); expect(r.ok, r.message).toBe(true); expect(r.summary).toMatchObject({ sitesAdded: 1, photosWritten: 2 });
  });
});

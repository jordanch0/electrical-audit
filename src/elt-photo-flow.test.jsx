// Real UI pipeline for photos: file input -> resize -> component state -> localStorage -> Complete Audit ->
// History -> Export -> unzip the downloaded .xlsx. The direct export tests build their fixtures by hand and
// cannot catch a break anywhere upstream of the export function; this one can.
// jsdom cannot decode images, so Image/canvas are stubbed to hand back real fixture JPEGs.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import crypto from 'crypto';
import AppRoot from './App.jsx';
import { JPEG_A, JPEG_B } from './test/jpeg-fixtures.js';

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const bytes = url => Buffer.from(url.split(',')[1], 'base64');
const project = { id:'p1', name:'Site A', company:'Co', abn:'1', licence:'L1', assets:[
  { id:'a1', location:'Site A', assetLocation:'SE Door', assetId:'', type:'Emergency Exit Sign', maintained:'Maintained', fitting:'X' },
  { id:'a2', location:'Site A', assetLocation:'SW Roof', assetId:'', type:'Emergency Exit Sign', maintained:'Maintained', fitting:'Y' },
] };
let payload; let shot;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('elt-projects-v1', JSON.stringify([project]));
  localStorage.setItem('elt-meta-v1', JSON.stringify({ p1:{ auditor:'Jane', testDate:'2026-09-21', nextTestDate:'2027-03-21' } }));
  payload = null; shot = 0;
  window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } };
  vi.stubGlobal('Image', class { set src(v) { this._s = v; queueMicrotask(() => { this.width = 4000; this.height = 3000; this.onload && this.onload(); }); } get src() { return this._s; } });
  HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
  HTMLCanvasElement.prototype.toDataURL = () => (shot++ % 2 === 0 ? JPEG_A : JPEG_B); // 1st capture -> A, 2nd -> B
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete window.webkit; });

async function addPhoto(user) {
  const input = document.querySelector('input[type=file]');
  fireEvent.change(input, { target: { files: [new File([new Uint8Array([1, 2, 3])], 'cam.jpg', { type: 'image/jpeg' })] } });
  await waitFor(() => expect(document.querySelectorAll('img[src^="data:image"]').length).toBeGreaterThan(0));
}

describe('ELT photo -> export through the real UI', () => {
  it('photos on fully tested, partly tested and untested fittings all reach the exported .xlsx intact', async () => {
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('EMERGENCY LIGHTING'));
    await user.click(await screen.findByText('Site A', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));

    // fitting 1: photo + all four checks
    await user.click(await screen.findByText('SE Door'));
    await addPhoto(user);
    for (let i = 0; i < 4; i++) await user.click(screen.getAllByRole('button', { name: 'PASS' })[i]);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    // fitting 2: photo only, no checks at all
    await user.click(await screen.findByText('SW Roof'));
    await addPhoto(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // both photos are in stored state
    await waitFor(() => {
      const r = JSON.parse(localStorage.getItem('elt-results-v1')).p1;
      expect(r.a1.photos).toHaveLength(1); expect(r.a2.photos).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: /^Home$/ }));
    await user.click(await screen.findByRole('button', { name: /Complete Audit & Archive/ }));
    await user.click(screen.getByRole('button', { name: /Yes, Complete/ }));
    await user.click(screen.getByRole('button', { name: /History/ }));
    await user.click(await screen.findByText('Emergency Lighting Audit'));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(payload).toBeTruthy());

    const buf = Buffer.from(payload.base64, 'base64');
    const zip = await JSZip.loadAsync(buf);
    const media = await Promise.all(Object.keys(zip.files).filter(n => n.startsWith('xl/media/') && !zip.files[n].dir).sort().map(n => zip.file(n).async('nodebuffer')));
    expect(media.map(sha)).toEqual([sha(bytes(JPEG_A)), sha(bytes(JPEG_B))]);

    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
    expect(wb.worksheets.map(w => w.name)).toEqual(['Emergency Lighting', 'Photos']);
    const reg = wb.getWorksheet('Emergency Lighting');
    expect(String(reg.getCell('B6').value)).toBe('SE Door');   // only the tested fitting is in the register
    expect(reg.getCell('B7').value == null || String(reg.getCell('B7').value) === '').toBe(true);
    const ps = wb.getWorksheet('Photos');
    expect(ps.getImages()).toHaveLength(2);
    expect([2, 3].map(r => String(ps.getCell(r, 2).value))).toEqual(['SE Door', 'SW Roof']);
  });

  it('Complete Audit is offered when a fitting has only a photo (so it can be exported)', async () => {
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('EMERGENCY LIGHTING'));
    await user.click(await screen.findByText('Site A', { selector: 'div' }));
    expect(screen.queryByRole('button', { name: /Complete Audit & Archive/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    await user.click(await screen.findByText('SE Door'));
    await addPhoto(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: /^Home$/ }));
    expect(await screen.findByRole('button', { name: /Complete Audit & Archive/ })).toBeInTheDocument();
  });
});

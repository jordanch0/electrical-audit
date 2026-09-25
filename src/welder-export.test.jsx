// Welder export: structure, gating, borders and photos — both directly and through the real UI pipeline
// (file input -> state -> Complete Audit -> History -> Export -> unzip the .xlsx).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import crypto from 'crypto';
import AppRoot, { exportWelderExcel, WELDER_CHECKLIST, WELDER_COLUMNS } from './App.jsx';
import { JPEG_A, JPEG_B } from './test/jpeg-fixtures.js';

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const bytes = url => Buffer.from(url.split(',')[1], 'base64');
const keys = WELDER_CHECKLIST.map(c => c.key);
const rec = (pattern, extra = {}) => ({
  items: Object.fromEntries(keys.map((k, i) => [k, { result: { P: 'pass', F: 'fail', N: 'na', '.': '' }[pattern[i]], value: i === 3 ? '9.9 MΩ' : '', action: '' }])),
  ...extra,
});
const project = { id: 'p1', name: 'Site A', company: 'Co', abn: '1', licence: 'L1', assets: [
  { id: 'a1', location: 'ONR Workshop', assetId: 'W001', brand: 'Kemppi', model: 'Evo', serial: '2699294' },
  { id: 'a2', location: 'ONR Workshop', assetId: 'W002', brand: 'Unimig', model: 'Razor', serial: 'N/A' },
  { id: 'a3', location: 'ONR Workshop', assetId: 'W003', brand: '', model: '', serial: '' },
  { id: 'a4', location: 'ONR Workshop', assetId: 'W/004', brand: '', model: '', serial: '' },
] };
const stale = { rectified: 'Removed from Service', defectId: 'D-9', responsibility: 'Site Electrician', priority: 'H' };
const meta = { auditor: 'Jane', testDate: '2026-07-13', nextTestDate: '2026-10-13', instruments: 'Fluke 1587' };
let payload;
beforeEach(() => { localStorage.clear(); payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete window.webkit; });

async function build(results, proj = project) {
  await exportWelderExcel(proj, { [proj.id]: results }, meta);
  await waitFor(() => expect(payload).toBeTruthy());
  const buf = Buffer.from(payload.base64, 'base64');
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
  return { wb, buf };
}
const V = c => (c.value == null ? '' : String(c.value));

describe('Welder export structure', () => {
  const results = {
    a1: rec('PPPPPNNNPPNN', { date: '2026-07-13', ...stale, notes: 'All good' }),               // PASS with retained defect data
    a2: rec('PPPPPPPPPPPF', { date: '2026-07-13', ...stale, rectifiedDate: '2026-08-01', notes: 'Return to supplier' }), // FAIL
    a3: rec('PPP.........'),                                                                    // untested
  };

  it('Register + one sheet per welder (unique, valid names); register lists ALL welders with the 13 columns', async () => {
    const { wb } = await build(results);
    expect(wb.worksheets.map(w => w.name)).toEqual(['Register', 'W001', 'W002', 'W003', 'W-004']);
    const reg = wb.getWorksheet('Register');
    expect(V(reg.getCell('A1'))).toBe('Site A — Welder Test');
    expect(V(reg.getCell('A2'))).toBe('Co  |  ABN: 1  |  Electrical Licence: L1');
    expect(V(reg.getCell('A3'))).toBe('Auditor: Jane');
    expect(V(reg.getCell('E3'))).toBe('Next Test Due: 13/10/2026');
    expect(WELDER_COLUMNS.map((_, i) => V(reg.getCell(5, i + 1)))).toEqual(WELDER_COLUMNS);
    expect([6, 7, 8, 9].map(r => V(reg.getCell(r, 2)))).toEqual(['W001', 'W002', 'W003', 'W/004']);
    expect(V(reg.getCell('D7'))).toBe('N/A');
    expect(V(reg.getCell('F6'))).toBe('Pass'); expect(V(reg.getCell('F7'))).toBe('Fail'); expect(V(reg.getCell('F8'))).toBe('');
    expect(V(reg.getCell('M6'))).toBe('13/10/2026');
  });

  it('header block rows 1–5 are unstyled; data rows have full-grid borders; Pass / Fail cells are tinted', async () => {
    const { wb } = await build(results);
    const reg = wb.getWorksheet('Register');
    ['A1', 'A2', 'A3', 'A4'].forEach(a => { expect(reg.getCell(a).fill).toBeFalsy(); expect(reg.getCell(a).border || {}).toEqual({}); });
    const hasGrid = c => ['top', 'bottom', 'left', 'right'].every(s => c.border && c.border[s] && c.border[s].style === 'thin');
    for (const r of [6, 7, 8, 9]) for (let c = 1; c <= 13; c++) expect(hasGrid(reg.getCell(r, c))).toBe(true);
    expect(reg.getCell('F6').fill.fgColor.argb).toBe('FFE2EFDA');
    expect(reg.getCell('F7').fill.fgColor.argb).toBe('FFFFC7CE');
  });

  it('defect columns are gated on the derived result (PASS welder with retained data shows none; FAIL welder shows them)', async () => {
    const { wb } = await build(results);
    const reg = wb.getWorksheet('Register');
    expect(['G6', 'H6', 'I6', 'J6', 'L6'].map(a => V(reg.getCell(a)))).toEqual(['', '', '', '', '']);
    expect(['G7', 'H7', 'I7', 'J7', 'K7', 'L7'].map(a => V(reg.getCell(a)))).toEqual(['Removed from Service', '01/08/2026', 'D-9', 'Site Electrician', 'Return to supplier', 'H']);
    const w1 = wb.getWorksheet('W001'); const text1 = []; w1.eachRow(r => r.eachCell(c => text1.push(V(c))));
    expect(text1).not.toContain('D-9'); expect(text1).not.toContain('Defect ID');
    const w2 = wb.getWorksheet('W002'); const text2 = []; w2.eachRow(r => r.eachCell(c => text2.push(V(c))));
    expect(text2).toContain('D-9'); expect(text2).toContain('Defect ID');
  });

  it('welder sheet: header fields, Audit Summary (W001 shape = 12 / 7 / 0 / 5 / 100.0% / 0 / PASS) and the 12 checklist rows with criteria', async () => {
    const { wb } = await build(results);
    const sh = wb.getWorksheet('W001');
    expect(V(sh.getCell('A1'))).toBe('Welder Inspection & Audit Checklist');
    expect(V(sh.getCell('A3'))).toBe('Location: ONR Workshop'); expect(V(sh.getCell('C3'))).toBe('Asset ID: W001');
    expect(V(sh.getCell('A5'))).toBe('Serial Number: 2699294'); expect(V(sh.getCell('C6'))).toBe('Test Instruments: Fluke 1587');
    const summary = {}; for (let r = 9; r <= 15; r++) summary[V(sh.getCell(r, 1))] = V(sh.getCell(r, 2));
    expect(summary).toEqual({ 'Total Items': '12', Pass: '7', Fail: '0', 'N/A': '5', Score: '100.0%', 'Actions Required': '0', Overall: 'PASS' });
    expect(['Item', 'Test / Pass Criteria', 'Result', 'Measured Value / Notes', 'Corrective Action Required'].map((_, i) => V(sh.getCell(17, i + 1))))
      .toEqual(['Item', 'Test / Pass Criteria', 'Result', 'Measured Value / Notes', 'Corrective Action Required']);
    expect(V(sh.getCell('A18'))).toBe('1. Visual Inspection');
    expect(V(sh.getCell('B21'))).toBe('Min insulation resistance 5 MΩ');
    expect(V(sh.getCell('C21'))).toBe('Pass'); expect(V(sh.getCell('D21'))).toBe('9.9 MΩ'); expect(V(sh.getCell('C23'))).toBe('N/A');
    expect(V(sh.getCell('C18'))).toBe('Pass');
    expect(V(sh.getCell('A31'))).toBe('Auditor Comments / Overall Notes'); expect(V(sh.getCell('B31'))).toBe('All good');
  });
});

describe('Welder photo -> export through the real UI', () => {
  it('photos on a fully tested welder and on an untested welder reach their own sheets intact', async () => {
    let shot = 0;
    localStorage.setItem('welder-projects-v1', JSON.stringify([{ ...project, assets: project.assets.slice(0, 2) }]));
    localStorage.setItem('welder-meta-v1', JSON.stringify({ p1: meta }));
    vi.stubGlobal('Image', class { set src(v) { this._s = v; queueMicrotask(() => { this.width = 4000; this.height = 3000; this.onload && this.onload(); }); } get src() { return this._s; } });
    HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
    HTMLCanvasElement.prototype.toDataURL = () => (shot++ % 2 === 0 ? JPEG_A : JPEG_B);
    const user = userEvent.setup();
    const addPhoto = async () => {
      const before = document.querySelectorAll('img[src^="data:image"]').length;
      fireEvent.change(screen.getByTestId('welder-photo-input'), { target: { files: [new File([new Uint8Array([1, 2, 3])], 'cam.jpg', { type: 'image/jpeg' })] } });
      await waitFor(() => expect(document.querySelectorAll('img[src^="data:image"]').length).toBe(before + 1));
    };
    render(<AppRoot />);
    await user.click(screen.getByText('WELDER TESTING'));
    await user.click(await screen.findByText('Site A', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    await user.click(await screen.findByText('W001'));
    await addPhoto();
    for (let i = 0; i < 12; i++) await user.click(screen.getAllByRole('button', { name: 'PASS' })[i]);
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    await user.click(await screen.findByText('W002'));
    await addPhoto();
    await waitFor(() => { const r = JSON.parse(localStorage.getItem('welder-results-v1')).p1; expect(r.a1.photos).toHaveLength(1); expect(r.a2.photos).toHaveLength(1); });

    await user.click(screen.getByRole('button', { name: /^Home$/ }));
    await user.click(await screen.findByRole('button', { name: 'Complete Welder Audit' }));
    await user.click(screen.getByRole('button', { name: /Yes, Complete/ }));
    await user.click(screen.getByRole('button', { name: /History/ }));
    await user.click(await screen.findByText('Welder Audit'));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(payload).toBeTruthy());

    const buf = Buffer.from(payload.base64, 'base64');
    const zip = await JSZip.loadAsync(buf);
    const media = await Promise.all(Object.keys(zip.files).filter(n => n.startsWith('xl/media/') && !zip.files[n].dir).sort().map(n => zip.file(n).async('nodebuffer')));
    expect(media.map(sha)).toEqual([sha(bytes(JPEG_A)), sha(bytes(JPEG_B))]);
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
    expect(wb.worksheets.map(w => w.name)).toEqual(['Register', 'W001', 'W002']);
    expect(wb.getWorksheet('W001').getImages()).toHaveLength(1);
    expect(wb.getWorksheet('W002').getImages()).toHaveLength(1);
    expect(V(wb.getWorksheet('Register').getCell('F6'))).toBe('Pass');
    expect(V(wb.getWorksheet('Register').getCell('F7'))).toBe(''); // W002 untested: photo only
  });
});

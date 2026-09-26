// General Site Defects: visit lifecycle (complete / history / reset / deletes — photos follow their owner) and the export.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import AppRoot, { exportGSDExcel, gsdPhotoIO, gsdPhotoStore } from './App.jsx';
import { JPEG_A } from './test/jpeg-fixtures.js';

const ls = k => JSON.parse(localStorage.getItem(k));
const ab = n => new Uint8Array(n).buffer;
beforeAll(() => {
  URL.createObjectURL = () => 'blob:gsd-test'; URL.revokeObjectURL = () => {};
  gsdPhotoIO.exportCopy = async () => ({ dataUrl: JPEG_A });
});
afterEach(() => cleanup());
const bins = () => screen.getAllByRole('button').filter(b => b.textContent === '' && b.querySelector('svg'));   // icon-only delete bins
const confirmNo = async user => { const bs = screen.getAllByRole('button'); await user.click(bs[bs.findIndex(b => b.textContent === 'Keep') - 1]); };  // the button before "Keep" is the (compact) confirm
const idbKeys = () => new Promise((res, rej) => { const rq = indexedDB.open('sparkcheck-gsd-photos', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('photos'); rq.onsuccess = () => { const db = rq.result; const q = db.transaction('photos').objectStore('photos').getAllKeys(); q.onsuccess = () => { db.close(); res(q.result.map(String).sort()); }; q.onerror = () => rej(q.error); }; rq.onerror = () => rej(rq.error); });
const clearIdb = () => new Promise(res => { const rq = indexedDB.open('sparkcheck-gsd-photos', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('photos'); rq.onsuccess = () => { const db = rq.result; const t = db.transaction('photos', 'readwrite'); t.objectStore('photos').clear(); t.oncomplete = () => { db.close(); res(); }; }; rq.onerror = () => res(); });
beforeEach(async () => { cleanup(); localStorage.clear(); await clearIdb(); });

const seedSite = (areas = ['Concrete Plant', 'Workshop']) => {
  localStorage.setItem('gsd-projects-v1', JSON.stringify([{ id: 's1', name: 'Site G', company: 'Co', abn: '', licence: '', areas: areas.map((n, i) => ({ id: 'a' + (i + 1), name: n })) }]));
  localStorage.setItem('gsd-meta-v1', JSON.stringify({ s1: { auditor: 'Jane', testDate: '2026-09-21' } }));
};
async function open(user, tab) {
  render(<AppRoot />);
  await user.click(screen.getByText('GENERAL SITE DEFECTS'));
  await user.click(await screen.findByText('Site G', { selector: 'div' }));
  if (tab) await user.click(screen.getByRole('button', { name: tab }));
}
const mk = (id, areaId, dims, extra = {}) => ({ id, areaId, assetLocation: 'Loc ' + id, category: 'Guarding', commonDefect: '', description: 'Defect ' + id, descAuto: '', photos: dims.map((d, i) => ({ id: `${id}p${i}`, w: d[0], h: d[1] })), priority: 'H', responsibility: 'Site Manager', dueDate: '', ...extra });
const seedPhotos = async items => { for (const it of items) for (const p of it.photos) { await gsdPhotoStore.put(p.id, { buf: ab(8), type: 'image/jpeg' }); await gsdPhotoStore.put(p.id + '~t', { buf: ab(4), type: 'image/jpeg' }); } };
const seedItems = async () => { seedSite(); const items = [mk('i1', 'a1', [[300, 400], [300, 400]]), mk('i2', 'a2', [[300, 400]])]; localStorage.setItem('gsd-items-v1', JSON.stringify({ s1: items })); await seedPhotos(items); return items; };

describe('Complete audit, History, Reset, deletes — photos follow their owner', () => {
  it('Complete archives the visit (items + areas + meta, photos KEPT for the snapshot), clears the current visit', async () => {
    await seedItems(); const user = userEvent.setup(); await open(user, null);
    await user.click(screen.getByRole('button', { name: 'Complete Site Defects Audit' }));
    await user.click(await screen.findByRole('button', { name: /Yes, Complete/ }));
    await waitFor(() => expect(ls('gsd-history-v1')).toHaveLength(1));
    const snap = ls('gsd-history-v1')[0]; expect(snap.items).toHaveLength(2); expect(snap.areas.map(a => a.name)).toEqual(['Concrete Plant', 'Workshop']); expect(snap.auditor).toBe('Jane'); expect(snap.testDate).toBe('2026-09-21');
    expect(ls('gsd-items-v1').s1).toEqual([]);
    expect((await idbKeys()).length).toBe(6);                                            // 3 photos x (full + thumb): the snapshot still owns them
    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(await screen.findByText(/Jane · 2 defects · 3 photos/)).toBeInTheDocument();
  });
  it('deleting a history snapshot deletes ITS photos', async () => {
    await seedItems(); const user = userEvent.setup(); await open(user, null);
    await user.click(screen.getByRole('button', { name: 'Complete Site Defects Audit' })); await user.click(await screen.findByRole('button', { name: /Yes, Complete/ }));
    await waitFor(() => expect(ls('gsd-history-v1')).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'History' })); await screen.findByText(/2 defects/);
    await user.click(bins()[bins().length - 1]); await confirmNo(user);
    await waitFor(() => expect(ls('gsd-history-v1')).toEqual([])); await waitFor(async () => expect(await idbKeys()).toEqual([]));
  });
  it('Reset all results asks first (Keep leaves everything), then clears the current visit AND its photos, with no snapshot', async () => {
    await seedItems(); const user = userEvent.setup(); await open(user, null);
    await user.click(screen.getByRole('button', { name: 'Reset all test results' }));
    expect(screen.getByText('Reset all results?')).toBeInTheDocument(); await user.click(screen.getByRole('button', { name: 'Keep' }));
    expect(ls('gsd-items-v1').s1).toHaveLength(2); expect(await idbKeys()).toHaveLength(6);
    await user.click(screen.getByRole('button', { name: 'Reset all test results' })); await user.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(ls('gsd-items-v1').s1).toEqual([])); await waitFor(async () => expect(await idbKeys()).toEqual([]));
    expect(ls('gsd-history-v1')).toEqual([]);
  });
  it('removing an AREA (Manage) removes its defects and their photos; other areas are untouched', async () => {
    await seedItems(); const user = userEvent.setup(); await open(user, 'Manage');
    await screen.findByText('Concrete Plant'); await user.click(bins()[0]); await confirmNo(user);
    await waitFor(() => expect(ls('gsd-projects-v1')[0].areas.map(a => a.name)).toEqual(['Workshop']));
    expect(ls('gsd-items-v1').s1.map(i => i.id)).toEqual(['i2']);
    await waitFor(async () => expect(await idbKeys()).toEqual(['i2p0', 'i2p0~t']));
  });
  it('removing a SITE removes its defects, history and every photo', async () => {
    await seedItems(); const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('GENERAL SITE DEFECTS')); await screen.findByText('Site G', { selector: 'div' });
    await user.click(bins()[0]); await confirmNo(user);
    await waitFor(() => expect(ls('gsd-projects-v1')).toEqual([])); await waitFor(async () => expect(await idbKeys()).toEqual([]));
  });
  it('Manage: a rename to an existing area is refused; Dropdowns lists Category / Common Defect / Responsibility (no Priority list)', async () => {
    seedSite(); const user = userEvent.setup(); await open(user, 'Manage');
    await user.click(screen.getByRole('button', { name: 'Rename Workshop' })); await user.clear(screen.getByLabelText('Rename area')); await user.type(screen.getByLabelText('Rename area'), 'concrete plant'); await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('"concrete plant" is already an area')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dropdowns' }));
    expect(await screen.findByText('CATEGORY')).toBeInTheDocument(); expect(screen.getByText('COMMON DEFECT')).toBeInTheDocument(); expect(screen.getByText('RESPONSIBILITY')).toBeInTheDocument(); expect(screen.queryByText('PRIORITY')).not.toBeInTheDocument();
    expect(screen.getByText('Site Manager')).toBeInTheDocument();
  });
  it('Report tab: tiles, per-area defects with #, and the empty state', async () => {
    await seedItems(); const user = userEvent.setup(); await open(user, 'Report');
    expect(await screen.findByText('SITE DEFECTS REPORT · Jane')).toBeInTheDocument(); expect(screen.getByText(/^defects$/i)).toBeInTheDocument(); expect(screen.getByText('High / Urgent', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Defect i1', { exact: false })).toBeInTheDocument(); expect(screen.getAllByText('Guarding · High · Site Manager').length).toBe(2);
    cleanup(); localStorage.setItem('gsd-items-v1', JSON.stringify({ s1: [] })); await open(userEvent.setup(), 'Report'); expect(await screen.findByText('✓ No defects recorded')).toBeInTheDocument();
  });
});

// ── export ──
let payload;
const readExport = async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64')); return wb; };
describe('export: photo report + Register', () => {
  beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
  afterEach(() => { delete window.webkit; });
  const meta = { auditor: 'Jane', testDate: '2026-09-21', nextTestDate: '2027-09-21' };
  const project = { id: 's1', name: 'Site G', company: 'Co', abn: '', licence: '', areas: [{ id: 'a1', name: 'Concrete Plant' }, { id: 'a2', name: 'Workshop' }, { id: 'a3', name: 'Empty Area' }] };
  const mkI = (id, areaId, dims, extra = {}) => mk(id, areaId, dims, { dueDate: '2026-10-31', ...extra });
  it('two sheets; header block; a FULL-WIDTH olive bar BEFORE its defects; caption ABOVE photos; small gap; empty areas omitted; photo sizes fit 120 x 160', async () => {
    const items = [mkI('i1', 'a1', [[300, 400], [400, 300]]), mkI('i2', 'a2', [[300, 400]])]; await seedPhotos(items);
    await exportGSDExcel(project, items, meta); const wb = await readExport();
    expect(wb.worksheets.map(w => w.name)).toEqual(['Defects Report', 'Register']);
    const ws = wb.getWorksheet('Defects Report');
    expect(ws.getCell('A1').value).toBe('Site G — General Site Defects'); expect(ws.getCell('A3').value).toBe('Auditor: Jane'); expect(ws.getCell('C3').value).toBe('Date Audited: 21/09/2026'); expect(ws.getCell('E3').value).toBe('Next Audit Due: 21/09/2027');
    const txt = []; for (let r = 5; r <= ws.rowCount; r++) { const v = ws.getCell(r, 1).value; if (v) txt.push(String(v)); }
    expect(txt).toEqual(['Concrete Plant', '#1  Loc i1 — Defect i1', 'Guarding · High · Site Manager · Fix by 31/10/2026', 'Workshop', '#2  Loc i2 — Defect i2', 'Guarding · High · Site Manager · Fix by 31/10/2026']);   // no "Empty Area"
    expect(ws.getCell('A5').fill).toMatchObject({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4D7C0F' } });
    expect(ws.getCell('A5').font).toMatchObject({ bold: true, color: { argb: 'FFFFFFFF' } });
    expect(ws.model.merges).toContain('A5:E5');                                                       // full width
    expect(ws.getRow(6).height).toBe(8);                                                              // the small gap after the bar
    expect(ws.getCell('A7').value).toBe('#1  Loc i1 — Defect i1');                                    // caption on the row ABOVE its photos
    const imgs = ws.getImages(); expect(imgs).toHaveLength(3);
    expect(imgs[0].range.ext).toMatchObject({ width: 120, height: 160 });                            // portrait 3:4 -> 120 x 160
    expect(imgs[1].range.ext).toMatchObject({ width: 120, height: 90 });                              // landscape 4:3 -> 120 x 90
    expect(Math.floor(imgs[0].range.tl.col)).toBe(0); expect(Math.floor(imgs[1].range.tl.col)).toBe(1); expect(Math.floor(imgs[0].range.tl.row)).toBe(Math.floor(imgs[1].range.tl.row));   // same row, next column
    expect(Math.floor(imgs[0].range.tl.row)).toBeGreaterThanOrEqual(8 - 1);                          // below the caption (row 7) and detail (row 8)
  });
  it('portrait A4 at 100% scale (Excel ignores manual page breaks under fit-to-page), page footer, five 140 px columns', async () => {
    const items = [mkI('i1', 'a1', [[300, 400]])]; await seedPhotos(items); await exportGSDExcel(project, items, meta); const ws = (await readExport()).getWorksheet('Defects Report');
    expect(ws.pageSetup).toMatchObject({ paperSize: 9, orientation: 'portrait', scale: 100 }); expect(ws.pageSetup.fitToPage).toBeFalsy(); expect(ws.headerFooter.oddFooter).toContain('Page &P of &N');
    for (let c = 1; c <= 5; c++) expect(ws.getColumn(c).width).toBeCloseTo((140 - 5) / 7, 1);
  });
  it('a long report gets manual page breaks that never split a bar from its first defect, or a caption from its photos', async () => {
    const items = Array.from({ length: 14 }, (_, i) => mkI('n' + i, i < 9 ? 'a1' : 'a2', [[300, 400], [300, 400]])); await seedPhotos(items);
    await exportGSDExcel(project, items, meta); const ws = (await readExport()).getWorksheet('Defects Report');
    const xml = await (await JSZip.loadAsync(Buffer.from(payload.base64, 'base64'))).file('xl/worksheets/sheet1.xml').async('string');
    const breaks = [...xml.matchAll(/<brk id="(\d+)"[^>]*man="1"/g)].map(m => +m[1]); expect(breaks.length).toBeGreaterThan(0);
    breaks.forEach(id => {                                                                            // a break AFTER row `id`
      const c = ws.getCell(id, 1); const isBar = c.fill && c.fill.fgColor && c.fill.fgColor.argb === 'FF4D7C0F';
      expect(!!isBar, `break after a bar (row ${id})`).toBe(false); expect(/^#\d+ /.test(String(c.value || '')), `break after a caption (row ${id})`).toBe(false);
    });
  });
  it('a missing stored photo is skipped without failing the export', async () => {
    const items = [mkI('i1', 'a1', [[300, 400], [300, 400]])]; await gsdPhotoStore.put('i1p0', { buf: ab(8), type: 'image/jpeg' });   // i1p1 is missing
    await exportGSDExcel(project, items, meta); expect((await readExport()).getWorksheet('Defects Report').getImages()).toHaveLength(1);
  });
  it('Register: one row per defect, # matching the report (area order), Priority coloured with the shared swbXPC palette, landscape', async () => {
    const items = [mkI('i1', 'a2', [[300, 400]], { priority: 'U' }), mkI('i2', 'a1', [[300, 400], [300, 400]], { priority: '', dueDate: '' })]; await seedPhotos(items);
    await exportGSDExcel(project, items, meta); const ws = (await readExport()).getWorksheet('Register');
    expect(ws.getRow(5).values.slice(1)).toEqual(['#', 'Area', 'Asset Location', 'Category', 'Description', 'Priority', 'Responsibility', 'Fix By Date', 'Photos']);
    expect(ws.getRow(6).values.slice(1)).toEqual([1, 'Concrete Plant', 'Loc i2', 'Guarding', 'Defect i2', '', 'Site Manager', '', 2]);      // area order first: the a1 defect is #1
    expect(ws.getRow(7).values.slice(1)).toEqual([2, 'Workshop', 'Loc i1', 'Guarding', 'Defect i1', 'U', 'Site Manager', '31/10/2026', 1]);
    expect(ws.getCell('F7').fill.fgColor.argb).toBe('FF9B0000');
    expect(ws.pageSetup).toMatchObject({ orientation: 'landscape', fitToPage: true, fitToWidth: 1 }); expect(ws.getColumn(8).width).toBeGreaterThanOrEqual(13);
  });
  it('no defects: both sheets still exist, with "No defects recorded" and their headings', async () => {
    await exportGSDExcel(project, [], meta); const wb = await readExport();
    expect(wb.getWorksheet('Defects Report').getCell('A6').value).toBe('No defects recorded'); expect(wb.getWorksheet('Register').getCell('A6').value).toBe('No defects recorded');
    expect(wb.getWorksheet('Register').getRow(5).values.slice(1)).toContain('Priority');
  });
  it('the export is reachable from History and uses the ARCHIVED areas / items / photos', async () => {
    await seedItems(); const user = userEvent.setup(); await open(user, null);
    await user.click(screen.getByRole('button', { name: 'Complete Site Defects Audit' })); await user.click(await screen.findByRole('button', { name: /Yes, Complete/ }));
    await waitFor(() => expect(ls('gsd-history-v1')).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'History' })); await user.click(await screen.findByRole('button', { name: 'Export' }));
    await waitFor(() => expect(payload).toBeTruthy()); const ws = (await readExport()).getWorksheet('Defects Report');
    expect(String(ws.getCell('A5').value)).toBe('Concrete Plant'); expect(ws.getImages()).toHaveLength(3);
  });
});

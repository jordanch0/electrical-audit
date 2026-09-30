// Export header block (2026-09-30 bug + fix): the title / company / auditor-meta rows (1-4 of most sheets) merge
// correctly across each sheet's REAL column count — confirmed here by reading real generated files, this was never
// actually broken — but were never CENTERED within that merge. `put`/`setCell` only applies a cell style when one
// is passed, and none of these header calls ever passed one, so `cell.alignment` stayed undefined; Excel/Sheets
// render unset-alignment text flush-left in a wide merged cell, not centred. Fixed with a shared XJ_HEADER_CENTER
// constant applied at every header-writing call site (the shared xjSheet/xjSplit builder, AND every direct-write
// header block: SWB Register + per-board, Welder Register + per-welder, ELT Register + Defects, GSD Report) so the
// fix can't drift out of sync between them again. No fill/font/border was added — the header block stays
// deliberately plain (CLAUDE.md) — only `alignment`. Confirmed the fix doesn't touch data-row column widths, which
// are set via a completely separate, untouched code path.
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import ExcelJS from 'exceljs';
import { exportExcel, exportSWBExcel, exportWelderExcel, exportELTExcel, exportGSDExcel, migrateProjectToAreas, sitePhotoStore, sitePhotoIO, gsdPhotoStore, gsdPhotoIO } from './App.jsx';
import 'fake-indexeddb/auto';

let payload;
beforeAll(() => {
  sitePhotoIO.imageSize = async () => ({ w: 10, h: 10 });
  sitePhotoIO.thumbFromDataUrl = async url => url;
  sitePhotoIO.exportCopy = async () => ({ dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' });
  gsdPhotoIO.exportCopy = sitePhotoIO.exportCopy;
});
beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { delete window.webkit; });

async function load(exportFn, ...args) {
  await exportFn(...args);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(payload.base64, 'base64'));
  return wb;
}
const CENTER = { horizontal: 'center' };
// Asserts rows 1-3 of a sheet are merged across its FULL real column count (n) with the expected sub-splits on row
// 3, and that every one of those merged header cells is centred (never checks row 4, which is a blank spacer with
// nothing written to it in most sheets, or the styled data/heading rows below).
function expectHeaderCentered(ws, n, { row3Splits } = { row3Splits: [[1, 2], [3, 4], [5, n]] }) {
  const merges = Object.values(ws._merges).map(m => m.range);
  expect(merges).toContain(`A1:${xlCol(n)}1`);
  expect(merges).toContain(`A2:${xlCol(n)}2`);
  row3Splits.forEach(([c1, c2]) => expect(merges).toContain(`${xlCol(c1)}3:${xlCol(c2)}3`));
  expect(ws.getCell(1, 1).alignment).toMatchObject(CENTER);
  expect(ws.getCell(2, 1).alignment).toMatchObject(CENTER);
  row3Splits.forEach(([c1]) => expect(ws.getCell(3, c1).alignment).toMatchObject(CENTER));
}
function xlCol(n) { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }

describe('Export header block: merge spans the real column count AND is centred (shared xjSheet builder)', () => {
  it('RCD Push Test (9 cols) and its Defects sheet (9 cols)', async () => {
    const project = { id: 'p', name: 'Site R', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'pn', name: 'MSB', circuits: ['CB1'] }] }] };
    const wb = await load(exportExcel, {}, project, { auditor: 'J', pushDate: '2026-09-21' }, 'push');
    expectHeaderCentered(wb.getWorksheet('Push Test'), 9);
    expectHeaderCentered(wb.getWorksheet('Defects'), 9);
  });
});

describe('Export header block: the FOUR direct-write sheets the user named are all fixed', () => {
  it('SWB Register (16 cols) and per-board sheet (7 cols, different row-3/4 split)', async () => {
    const project = { id: 's1', name: 'Site S', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'ar1', name: 'Area 1', boards: [{ id: 'b1', name: 'MSB' }] }] };
    const results = { s1: { ar1: { b1: { enclosure: { status: 'pass' } } } } };
    const wb = await load(exportSWBExcel, project, results, { auditor: 'J', testDate: '2026-09-21' });
    expectHeaderCentered(wb.getWorksheet('Register'), 16);
    const board = wb.getWorksheet('MSB');
    // per-board header is 5 rows (title, site|company, area/board, auditor/date, next-due) each merged across 7 cols
    const merges = Object.values(board._merges).map(m => m.range);
    ['A1:G1', 'A2:G2', 'A3:B3', 'C3:G3', 'A4:B4', 'C4:G4', 'A5:G5'].forEach(m => expect(merges).toContain(m));
    [1, 2, 3, 4, 5].forEach(r => expect(board.getCell(r, 1).alignment).toMatchObject(CENTER));
    expect(board.getCell(3, 3).alignment).toMatchObject(CENTER); // "Board: ..." half of row 3
    expect(board.getCell(4, 3).alignment).toMatchObject(CENTER); // "Date Tested: ..." half of row 4
  });

  it('Welder Register (13 cols) and per-welder sheet (5 cols, 4 identity rows)', async () => {
    const project = migrateProjectToAreas({ id: 'p', name: 'Site W', company: 'Co', abn: '1', licence: 'L', assets: [{ id: 'a1', location: 'Shop', assetId: 'W001', brand: 'Kemppi', model: 'M', serial: '1' }] });
    const wb = await load(exportWelderExcel, project, {}, { auditor: 'J', testDate: '2026-09-21', nextTestDate: '2026-12-21' });
    expectHeaderCentered(wb.getWorksheet('Register'), 13);
    const w = wb.getWorksheet('W001');
    [1, 2, 3, 4, 5, 6].forEach(r => expect(w.getCell(r, 1).alignment).toMatchObject(CENTER));
    expect(w.getCell(3, 3).alignment).toMatchObject(CENTER); // "Asset ID: ..."
    expect(w.getCell(4, 3).alignment).toMatchObject(CENTER); // "Model: ..."
    expect(w.getCell(5, 3).alignment).toMatchObject(CENTER); // "Date Tested: ..."
    expect(w.getCell(6, 3).alignment).toMatchObject(CENTER); // "Test Instruments: ..."
  });

  it('ELT Register (16 cols) and Defects (10 cols)', async () => {
    const pass4 = { visual: 'pass', discharge: 'pass', switching: 'pass', charging: 'pass' };
    const project = migrateProjectToAreas({ id: 'p', name: 'Site E', company: 'Co', abn: '1', licence: 'L', assets: [{ id: 'a1', location: 'Site E', assetLocation: 'SE Door', type: 'Emergency Exit Sign', maintained: 'Maintained', fitting: 'X' }] });
    const results = { p: { a1: { ...pass4, visual: 'fail' } } };
    const wb = await load(exportELTExcel, project, results, { auditor: 'J', testDate: '2026-09-21', nextTestDate: '2027-03-21' });
    expectHeaderCentered(wb.getWorksheet('Emergency Lighting'), 16);
    expectHeaderCentered(wb.getWorksheet('Defects'), 10);
  });

  it('GSD Report (Defects Report + Register, 5/9 cols)', async () => {
    const project = { id: 'p', name: 'Site G', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a1', name: 'Area 1' }] };
    const items = [{ id: 'i1', areaId: 'a1', assetLocation: 'x', category: 'c', commonDefect: '', description: 'd', photos: [], priority: 'H', responsibility: '', dueDate: '' }];
    const wb = await load(exportGSDExcel, project, items, { auditor: 'J', testDate: '2026-09-21', nextAuditDate: '2027-09-21' });
    // The Defects Report sheet is only 5 columns wide, so row 3's third piece (Next Audit Due) has just ONE column
    // (col 5) to itself — not a real 2-cell merge like Auditor/Date get, so it's checked directly rather than via
    // expectHeaderCentered's default 3-way split.
    expectHeaderCentered(wb.getWorksheet('Defects Report'), 5, { row3Splits: [[1, 2], [3, 4]] });
    expect(wb.getWorksheet('Defects Report').getCell(3, 5).alignment).toMatchObject(CENTER);
    expectHeaderCentered(wb.getWorksheet('Register'), 9);
  });
});

describe('The fix never touches data-row column widths', () => {
  it('SWB Register + per-board columns keep their exact hardcoded widths after the alignment fix', async () => {
    const project = { id: 's1', name: 'Site S', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'ar1', name: 'Area 1', boards: [{ id: 'b1', name: 'MSB' }] }] };
    const results = { s1: { ar1: { b1: { enclosure: { status: 'pass' } } } } };
    const wb = await load(exportSWBExcel, project, results, { auditor: 'J', testDate: '2026-09-21' });
    const reg = wb.getWorksheet('Register');
    expect([22, 26, 13, 11, 7, 7, 7].map((_, i) => reg.getColumn(i + 1).width).slice(0, 4)).toEqual([22, 26, 13, 11]);
    const board = wb.getWorksheet('MSB');
    expect([34, 52, 10, 12, 36, 10, 30]).toEqual(Array.from({ length: 7 }, (_, i) => board.getColumn(i + 1).width));
  });
});

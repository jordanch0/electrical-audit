// Export header block (2026-09-30 bug + fix, PART 1): the title / company / auditor-meta rows (1-4 of most sheets)
// merge correctly across each sheet's REAL column count — confirmed here by reading real generated files, this was
// never actually broken — but were never CENTERED within that merge. `put`/`setCell` only applies a cell style when
// one is passed, and none of these header calls ever passed one, so `cell.alignment` stayed undefined; Excel/Sheets
// render unset-alignment text flush-left in a wide merged cell, not centred. Fixed with a shared XJ_HEADER_CENTER
// constant applied at every header-writing call site (the shared xjSheet/xjSplit builder, AND every direct-write
// header block: SWB Register + per-board, Welder Register + per-welder, ELT Register + Defects, GSD Report) so the
// fix can't drift out of sync between them again. No fill/font/border was added — the header block stays
// deliberately plain (CLAUDE.md) — only `alignment`. Confirmed the fix doesn't touch data-row column widths, which
// are set via a completely separate, untouched code path.
//
// PART 2 (2026-09-30, same day): row 3 (and, on sheets whose own layout differs — SWB per-board, Welder per-welder —
// their equivalent split rows) is now ONE joined "  |  " string in ONE full-width merged cell, matching row 2
// (coLine)'s existing format, instead of 2-3 separate sub-merges each centred within its own narrow span. Applied to
// all 8 header-writing locations: the shared xjSheet/xjSplit builder (covers RCD/IEL/TAT/Thermo/IRT/GSD Register/all
// Defects sheets) plus the 7 direct-write sheets (SWB Register + per-board, Welder Register + per-welder, ELT
// Register + Defects, GSD Report). SWB per-board and Welder per-welder have no single Auditor/Date/Next-Due triple
// in their own layout (Area/Board, Auditor/Date, Next-Due are on separate rows for SWB per-board; Location/AssetID,
// Brand/Model, Serial/DateTested, PreparedBy/Instruments for Welder per-welder) — the same "join this row's own
// split pieces into one full-width cell" principle is applied to each of THEIR rows individually, without
// collapsing separate rows together (so the downstream Audit Summary row-index math, `rr = N + off`, is untouched).
//
// PART 3: the logo strip (`xjLogo`, drawn in row 1 when `xjGetLogoDataUrl` resolves one) was investigated as a
// possible regression from the header-centering fix — it is not: `xjLogo`/`XJ_LOGO*` were untouched by that commit
// (confirmed via `git diff`), and it continues to work identically. These tests lock that in going forward.
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import ExcelJS from 'exceljs';
import { exportExcel, exportSWBExcel, exportWelderExcel, exportELTExcel, exportGSDExcel, migrateProjectToAreas, sitePhotoStore, sitePhotoIO, siteLogoStore, gsdPhotoStore, gsdPhotoIO } from './App.jsx';
import 'fake-indexeddb/auto';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
function dataUrlToRec(dataUrl) {
  const [meta, b64] = dataUrl.split(',');
  const type = meta.match(/data:(.*);base64/)[1];
  return { buf: Buffer.from(b64, 'base64'), type };
}

let payload;
beforeAll(() => {
  sitePhotoIO.imageSize = async () => ({ w: 10, h: 10 });
  sitePhotoIO.thumbFromDataUrl = async url => url;
  sitePhotoIO.exportCopy = async () => ({ dataUrl: PNG });
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
// Asserts rows 1-3 of a sheet are each a SINGLE merge across its FULL real column count (n) and centred. (Row 4 is
// a blank spacer row; whether IT is also merged varies sheet to sheet — xjSheet and ELT merge it, SWB/Welder
// Register don't — so it's checked per-sheet below rather than assumed here.)
function expectHeaderCentered(ws, n) {
  const merges = Object.values(ws._merges).map(m => m.range);
  expect(merges).toContain(`A1:${xlCol(n)}1`);
  expect(merges).toContain(`A2:${xlCol(n)}2`);
  expect(merges).toContain(`A3:${xlCol(n)}3`);
  expect(ws.getCell(1, 1).alignment).toMatchObject(CENTER);
  expect(ws.getCell(2, 1).alignment).toMatchObject(CENTER);
  expect(ws.getCell(3, 1).alignment).toMatchObject(CENTER);
}
function xlCol(n) { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }

describe('Export header block: merge spans the real column count AND is centred (shared xjSheet builder)', () => {
  it('RCD Push Test (9 cols) and its Defects sheet (9 cols)', async () => {
    const project = { id: 'p', name: 'Site R', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'pn', name: 'MSB', circuits: ['CB1'] }] }] };
    const wb = await load(exportExcel, {}, project, { auditor: 'J', pushDate: '2026-09-21' }, 'push');
    expectHeaderCentered(wb.getWorksheet('Push Test'), 9);
    expectHeaderCentered(wb.getWorksheet('Defects'), 9);
    // Row 3 is one joined "  |  " string, e.g. "Auditor: J  |  Date Tested: 21/09/2026  |  Next Push Test Due: ...".
    expect(String(wb.getWorksheet('Push Test').getCell(3, 1).value)).toMatch(/^Auditor: J {2}\| {2}Date Tested: .+ {2}\| {2}Next .*Due: .+$/);
  });
});

describe('Export header block: the direct-write sheets are all fixed (row 3/4 joined into one full-width cell)', () => {
  it('SWB Register (16 cols) and per-board sheet (7 cols, rows 3-4 each joined, row 5 already full-width)', async () => {
    const project = { id: 's1', name: 'Site S', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'ar1', name: 'Area 1', boards: [{ id: 'b1', name: 'MSB' }] }] };
    const results = { s1: { ar1: { b1: { enclosure: { status: 'pass' } } } } };
    const wb = await load(exportSWBExcel, project, results, { auditor: 'J', testDate: '2026-09-21' });
    expectHeaderCentered(wb.getWorksheet('Register'), 16);
    expect(String(wb.getWorksheet('Register').getCell(3, 1).value)).toBe('Auditor: J  |  Date Tested: 21/09/2026  |  Next Audit Due: 21/09/2027');

    const board = wb.getWorksheet('MSB');
    const merges = Object.values(board._merges).map(m => m.range);
    ['A1:G1', 'A2:G2', 'A3:G3', 'A4:G4', 'A5:G5'].forEach(m => expect(merges).toContain(m));
    [1, 2, 3, 4, 5].forEach(r => expect(board.getCell(r, 1).alignment).toMatchObject(CENTER));
    expect(String(board.getCell(3, 1).value)).toBe('Area: Area 1  |  Board: MSB');
    expect(String(board.getCell(4, 1).value)).toBe('Auditor: J  |  Date Tested: 21/09/2026');
    expect(String(board.getCell(5, 1).value)).toBe('Next Audit Due: 21/09/2027');
  });

  it('Welder Register (13 cols) and per-welder sheet (5 cols, rows 3-6 each joined)', async () => {
    const project = migrateProjectToAreas({ id: 'p', name: 'Site W', company: 'Co', abn: '1', licence: 'L', assets: [{ id: 'a1', location: 'Shop', assetId: 'W001', brand: 'Kemppi', model: 'M', serial: '1' }] });
    const wb = await load(exportWelderExcel, project, {}, { auditor: 'J', testDate: '2026-09-21', nextTestDate: '2026-12-21' });
    expectHeaderCentered(wb.getWorksheet('Register'), 13);
    expect(String(wb.getWorksheet('Register').getCell(3, 1).value)).toBe('Auditor: J  |  Date Tested: 21/09/2026  |  Next Test Due: 21/12/2026');

    const w = wb.getWorksheet('W001');
    const merges = Object.values(w._merges).map(m => m.range);
    ['A1:E1', 'A2:E2', 'A3:E3', 'A4:E4', 'A5:E5', 'A6:E6'].forEach(m => expect(merges).toContain(m));
    [1, 2, 3, 4, 5, 6].forEach(r => expect(w.getCell(r, 1).alignment).toMatchObject(CENTER));
    expect(String(w.getCell(3, 1).value)).toBe('Location: Shop  |  Asset ID: W001');
    expect(String(w.getCell(4, 1).value)).toBe('Brand: Kemppi  |  Model: M');
    expect(String(w.getCell(5, 1).value)).toBe('Serial Number: 1  |  Date Tested: 21/09/2026');
    expect(String(w.getCell(6, 1).value)).toBe('Prepared By: J  |  Test Instruments: ');
  });

  it('ELT Register (16 cols) and Defects (10 cols)', async () => {
    const pass4 = { visual: 'pass', discharge: 'pass', switching: 'pass', charging: 'pass' };
    const project = migrateProjectToAreas({ id: 'p', name: 'Site E', company: 'Co', abn: '1', licence: 'L', assets: [{ id: 'a1', location: 'Site E', assetLocation: 'SE Door', type: 'Emergency Exit Sign', maintained: 'Maintained', fitting: 'X' }] });
    const results = { p: { a1: { ...pass4, visual: 'fail' } } };
    const wb = await load(exportELTExcel, project, results, { auditor: 'J', testDate: '2026-09-21', nextTestDate: '2027-03-21' });
    expectHeaderCentered(wb.getWorksheet('Emergency Lighting'), 16);
    expectHeaderCentered(wb.getWorksheet('Defects'), 10);
    expect(String(wb.getWorksheet('Emergency Lighting').getCell(3, 1).value)).toBe('Auditor: J  |  Date Tested: 21/09/2026  |  Next Test Due: 21/03/2027');
    expect(String(wb.getWorksheet('Defects').getCell(3, 1).value)).toBe('Defects recorded: 1  |  Date Tested: 21/09/2026  |  Priority: L Low · M Medium · H High · U Urgent');
  });

  it('GSD Report (Defects Report + Register, 5/9 cols)', async () => {
    const project = { id: 'p', name: 'Site G', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a1', name: 'Area 1' }] };
    const items = [{ id: 'i1', areaId: 'a1', assetLocation: 'x', category: 'c', commonDefect: '', description: 'd', photos: [], priority: 'H', responsibility: '', dueDate: '' }];
    const wb = await load(exportGSDExcel, project, items, { auditor: 'J', testDate: '2026-09-21', nextAuditDate: '2027-09-21' });
    expectHeaderCentered(wb.getWorksheet('Defects Report'), 5);
    expect(String(wb.getWorksheet('Defects Report').getCell(3, 1).value)).toBe('Auditor: J  |  Date Audited: 21/09/2026  |  Next Audit Due: 21/09/2027');
    expectHeaderCentered(wb.getWorksheet('Register'), 9);
    expect(String(wb.getWorksheet('Register').getCell(3, 1).value)).toBe('Auditor: J  |  Date Audited: 21/09/2026  |  Next Audit Due: 21/09/2027');
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

describe('Export header block: the logo strip (investigated as a possible regression, confirmed NOT one)', () => {
  const project = { id: 's1', name: 'Site S', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'ar1', name: 'Area 1', boards: [{ id: 'b1', name: 'MSB' }] }] };
  const results = { s1: { ar1: { b1: { enclosure: { status: 'pass' } } } } };

  it('renders in row 1 (image present, row 1 height set, header rows pushed down by 1) when a per-site logo is set — SWB (direct-write)', async () => {
    await siteLogoStore.put('swb', 's1', dataUrlToRec(PNG));
    try {
      const wb = await load(exportSWBExcel, project, results, { auditor: 'J', testDate: '2026-09-21' });
      const reg = wb.getWorksheet('Register');
      expect(reg.getImages()).toHaveLength(1);
      expect(reg.getRow(1).height).toBe(46); // XJ_LOGO_ROW_PT
      expect(String(reg.getCell(2, 1).value)).toBe('Site S — Switchboard / Enclosure Audit'); // title pushed to row 2 by off=1
    } finally { await siteLogoStore.del('swb', 's1'); }
  });

  it('renders in row 1 for RCD (shared xjSheet builder) when a per-site logo is set', async () => {
    const rcdProject = { id: 'p-logo', name: 'Site R', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'pn', name: 'MSB', circuits: ['CB1'] }] }] };
    await siteLogoStore.put('rcd', 'p-logo', dataUrlToRec(PNG));
    try {
      const wb = await load(exportExcel, {}, rcdProject, { auditor: 'J', pushDate: '2026-09-21' }, 'push');
      const ws = wb.getWorksheet('Push Test');
      expect(ws.getImages()).toHaveLength(1);
      expect(ws.getRow(1).height).toBe(46);
    } finally { await siteLogoStore.del('rcd', 'p-logo'); }
  });

  it('is absent (no row-1 reservation) when no logo is set — the default/no-op case', async () => {
    const wb = await load(exportSWBExcel, project, results, { auditor: 'J', testDate: '2026-09-21' });
    const reg = wb.getWorksheet('Register');
    expect(reg.getImages()).toHaveLength(0);
    expect(String(reg.getCell(1, 1).value)).toBe('Site S — Switchboard / Enclosure Audit'); // title at row 1, off=0
  });
});

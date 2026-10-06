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
// The SHARED header (2026-10-02, xjHeader): rows 1-5 are each ONE merge across the full width (n columns), heights 45.75/31.5/15.75/15.75/6, text in rows 2-4 centred
// horizontally (and only horizontally — reference file), row 1 (logo) and row 5 (spacer) empty and unstyled, no border anywhere.
function expectSharedHeader(ws, n) {
  const merges = Object.values(ws._merges).map(m => m.range);
  [1, 2, 3, 4, 5].forEach(r => expect(merges, `${ws.name} row ${r}`).toContain(`A${r}:${xlCol(n)}${r}`));
  [2, 3, 4].forEach(r => expect(ws.getCell(r, 1).alignment, `${ws.name} row ${r}`).toMatchObject(CENTER));
  [1, 5].forEach(r => expect(ws.getCell(r, 1).value == null || ws.getCell(r, 1).value === '', `${ws.name} row ${r} empty`).toBe(true));
  expect([1, 2, 3, 4, 5].map(r => ws.getRow(r).height)).toEqual([45.75, 31.5, 15.75, 15.75, 6]);
  for (let r = 1; r <= 5; r++) expect(!ws.getCell(r, 1).border || Object.keys(ws.getCell(r, 1).border).length === 0, `${ws.name} row ${r} border`).toBe(true);
}

describe('Export header block: merge spans the real column count AND is centred (shared xjSheet builder)', () => {
  it('RCD Push Test (9 cols) and its Defects sheet (9 cols)', async () => {
    const project = { id: 'p', name: 'Site R', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'pn', name: 'MSB', circuits: ['CB1'] }] }] };
    const wb = await load(exportExcel, {}, project, { auditor: 'J', pushDate: '2026-09-21' }, 'push');
    expectSharedHeader(wb.getWorksheet('Push Test'), 9);
    expectSharedHeader(wb.getWorksheet('Defects'), 9);
    // Row 4 is one joined "  |  " string, e.g. "Auditor: J  |  Date Tested: 21/09/2026  |  Next Push Test Due: ...".
    expect(String(wb.getWorksheet('Push Test').getCell(4, 1).value)).toMatch(/^Auditor: J {2}\| {2}Date Tested: .+ {2}\| {2}Next Push Test Due: .+$/);
    // row 2 is the SAME on both sheets (no "– Defects" suffix): "{Site}  –  RCD & ELR Test  (Push Test)" with an EN dash and double spaces
    expect(String(wb.getWorksheet('Push Test').getCell(2, 1).value)).toBe('Site R  –  RCD & ELR Test  (Push Test)');
    expect(String(wb.getWorksheet('Defects').getCell(2, 1).value)).toBe('Site R  –  RCD & ELR Test  (Push Test)');
  });
});

describe('Export header block: the direct-write sheets use the SAME shared header (xjHeader) as the xjSheet modules', () => {
  const HDR_TEXT = (title, extra) => ({ title, co: 'Co  |  ABN: 1  |  Electrical Licence: L', ...extra });
  it('SWB Register (16 cols) and per-board sheet (8 cols): identical rows 1-5; Area / Board are an "Asset Details" block from row 6', async () => {
    const project = { id: 's1', name: 'Site S', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'ar1', name: 'Area 1', boards: [{ id: 'b1', name: 'MSB' }] }] };
    const results = { s1: { ar1: { b1: { enclosure: { status: 'pass' } } } } };
    const wb = await load(exportSWBExcel, project, results, { auditor: 'J', testDate: '2026-09-21' });
    const reg = wb.getWorksheet('Register'); const board = wb.getWorksheet('MSB');
    expectSharedHeader(reg, 16); expectSharedHeader(board, 8);
    [reg, board].forEach(ws => {
      expect(String(ws.getCell(2, 1).value)).toBe('Site S  –  Switchboard / Enclosure Audit  (Visual Inspection)');
      expect(String(ws.getCell(3, 1).value)).toBe('Co  |  ABN: 1  |  Electrical Licence: L');
      expect(String(ws.getCell(4, 1).value)).toBe('Auditor: J  |  Date Tested: 21/09/2026  |  Next Audit Due: 21/09/2027');
    });
    expect(String(reg.getCell(6, 1).value)).toBe('Area');                      // the Register's table headings are row 6
    expect(['A6', 'A7', 'B7', 'A8', 'B8', 'A10'].map(a => String(board.getCell(a).value))).toEqual(['Asset Details', 'Area', 'Area 1', 'Board', 'MSB', 'Audit Summary']);
  });

  it('Welder Register (13 cols) and per-welder sheet (5 cols): identical rows 1-5; identity + Test Instruments are an "Asset Details" block from row 6', async () => {
    const project = migrateProjectToAreas({ id: 'p', name: 'Site W', company: 'Co', abn: '1', licence: 'L', assets: [{ id: 'a1', location: 'Shop', assetId: 'W001', brand: 'Kemppi', model: 'M', serial: '1' }] });
    const wb = await load(exportWelderExcel, project, {}, { auditor: 'J', testDate: '2026-09-21', nextTestDate: '2026-12-21', instruments: 'Fluke' });
    const reg = wb.getWorksheet('Register'); const w = wb.getWorksheet('W001');
    expectSharedHeader(reg, 13); expectSharedHeader(w, 5);
    [reg, w].forEach(ws => {
      expect(String(ws.getCell(2, 1).value)).toBe('Site W  –  Welder Test  (Inspection & Audit Checklist)');
      expect(String(ws.getCell(4, 1).value)).toBe('Auditor: J  |  Date Tested: 21/09/2026  |  Next Test Due: 21/12/2026');
    });
    expect(String(reg.getCell(6, 1).value)).toBe('Location');
    expect([6, 7, 8, 9, 10, 11, 12].map(r => String(w.getCell(r, 1).value))).toEqual(['Asset Details', 'Location', 'Asset ID', 'Brand', 'Model', 'Serial Number', 'Test Instruments']);
    expect([7, 8, 9, 10, 11, 12].map(r => String(w.getCell(r, 2).value))).toEqual(['Shop', 'W001', 'Kemppi', 'M', '1', 'Fluke']);
  });

  it('ELT Register (16 cols), Defects (10 cols) and Photos (4 cols, merged out to a wider header): identical rows 1-5', async () => {
    const pass4 = { visual: 'pass', discharge: 'pass', switching: 'pass', charging: 'pass' };
    const project = migrateProjectToAreas({ id: 'p', name: 'Site E', company: 'Co', abn: '1', licence: 'L', assets: [{ id: 'a1', location: 'Site E', assetLocation: 'SE Door', type: 'Emergency Exit Sign', maintained: 'Maintained', fitting: 'X' }] });
    const results = { p: { a1: { ...pass4, visual: 'fail', photos: [{ id: 'ph', w: 1, h: 1 }] } } };
    const wb = await load(exportELTExcel, project, results, { auditor: 'J', testDate: '2026-09-21', nextTestDate: '2027-03-21' });
    const reg = wb.getWorksheet('Emergency Lighting'); const def = wb.getWorksheet('Defects'); const ph = wb.getWorksheet('Photos');
    expectSharedHeader(reg, 16); expectSharedHeader(def, 10);
    [reg, def, ph].forEach(ws => {
      expect(String(ws.getCell(2, 1).value)).toBe('Site E  –  Emergency Lighting Test  (AS/NZS 2293.2:2019)');
      expect(String(ws.getCell(4, 1).value)).toBe('Auditor: J  |  Date Tested: 21/09/2026  |  Next Test Due: 21/03/2027');
    });
    // Photos: a 4-column table (580px) narrower than the header text needs -> the merge is widened to column E (5 columns), as in the reference Summary
    expectSharedHeader(ph, 5);
    expect(String(def.getCell(6, 1).value)).toBe('#'); expect(String(ph.getCell(6, 1).value)).toBe('Location');
  });

  it('GSD Defects Report (5 cols) and Register (10 cols): identical rows 1-5, "Date Tested" (not "Date Audited"); the report content starts on row 6', async () => {
    const project = { id: 'p', name: 'Site G', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a1', name: 'Area 1' }] };
    const items = [{ id: 'i1', areaId: 'a1', assetLocation: 'x', category: 'c', commonDefect: '', description: 'd', photos: [], priority: 'H', responsibility: '', dueDate: '' }];
    const wb = await load(exportGSDExcel, project, items, { auditor: 'J', testDate: '2026-09-21', nextTestDate: '2027-09-21' });
    const rep = wb.getWorksheet('Defects Report'); const reg = wb.getWorksheet('Register');
    expectSharedHeader(rep, 5); expectSharedHeader(reg, 10);
    [rep, reg].forEach(ws => {
      expect(String(ws.getCell(2, 1).value)).toBe('Site G  –  General Site Defects  (Punch-List Report)');
      expect(String(ws.getCell(4, 1).value)).toBe('Auditor: J  |  Date Tested: 21/09/2026  |  Next Audit Due: 21/09/2027');
    });
    expect(String(rep.getCell(6, 1).value)).toMatch(/Area 1/);                 // the first report row (the area bar) is on row 6
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

describe('Export header block: the logo strip (row 1 is ALWAYS reserved by the shared header; the logo only adds the image)', () => {
  const project = { id: 's1', name: 'Site S', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'ar1', name: 'Area 1', boards: [{ id: 'b1', name: 'MSB' }] }] };
  const results = { s1: { ar1: { b1: { enclosure: { status: 'pass' } } } } };

  it('SWB (direct-write) with a per-site logo: one image in row 1, row 1 is 45.75pt, the title is on row 2 and the table headings are on row 6', async () => {
    await siteLogoStore.put('swb', 's1', dataUrlToRec(PNG));
    try {
      const wb = await load(exportSWBExcel, project, results, { auditor: 'J', testDate: '2026-09-21' });
      const reg = wb.getWorksheet('Register');
      expect(reg.getImages()).toHaveLength(1);
      expect(reg.getRow(1).height).toBe(45.75);
      expect(String(reg.getCell(2, 1).value)).toBe('Site S  –  Switchboard / Enclosure Audit  (Visual Inspection)');
      expect(String(reg.getCell(6, 1).value)).toBe('Area');
      expect(wb.getWorksheet('MSB').getImages()).toHaveLength(1);              // the per-board sheet carries the logo too
    } finally { await siteLogoStore.del('swb', 's1'); }
  });

  it('renders in row 1 for RCD (shared xjSheet builder) when a per-site logo is set', async () => {
    const rcdProject = { id: 'p-logo', name: 'Site R', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'pn', name: 'MSB', circuits: ['CB1'] }] }] };
    await siteLogoStore.put('rcd', 'p-logo', dataUrlToRec(PNG));
    try {
      const wb = await load(exportExcel, {}, rcdProject, { auditor: 'J', pushDate: '2026-09-21' }, 'push');
      const ws = wb.getWorksheet('Push Test');
      expect(ws.getImages()).toHaveLength(1);
      expect(ws.getRow(1).height).toBe(45.75);                                 // the always-reserved logo row (shared header)
      expect(String(ws.getCell(2, 1).value)).toBe('Site R  –  RCD & ELR Test  (Push Test)');
      expect(String(ws.getCell(6, 1).value)).toBe('#');                         // the table headings are on row 6 with or without a logo
    } finally { await siteLogoStore.del('rcd', 'p-logo'); }
  });

  it('RCD (shared builder) with NO logo: row 1 is STILL reserved (45.75pt, empty, no image) and the table headings are still on row 6', async () => {
    const rcdProject = { id: 'p-nologo', name: 'Site R', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'pn', name: 'MSB', circuits: ['CB1'] }] }] };
    const wb = await load(exportExcel, {}, rcdProject, { auditor: 'J', pushDate: '2026-09-21' }, 'push');
    const ws = wb.getWorksheet('Push Test');
    expect(ws.getImages()).toHaveLength(0);
    expect(ws.getRow(1).height).toBe(45.75);
    expect(ws.getCell(1, 1).value == null || ws.getCell(1, 1).value === '').toBe(true);
    expect(String(ws.getCell(2, 1).value)).toBe('Site R  –  RCD & ELR Test  (Push Test)');
    expect(String(ws.getCell(6, 1).value)).toBe('#');
  });

  it('SWB with NO logo: no image, but row 1 is still reserved and everything sits where it does with a logo (identical layout either way)', async () => {
    const wb = await load(exportSWBExcel, project, results, { auditor: 'J', testDate: '2026-09-21' });
    const reg = wb.getWorksheet('Register');
    expect(reg.getImages()).toHaveLength(0);
    expect(reg.getRow(1).height).toBe(45.75);
    expect(String(reg.getCell(2, 1).value)).toBe('Site S  –  Switchboard / Enclosure Audit  (Visual Inspection)');
    expect(String(reg.getCell(6, 1).value)).toBe('Area');
  });
});

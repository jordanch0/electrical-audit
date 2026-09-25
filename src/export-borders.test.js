// SWB and ELT are the only ExcelJS-based exports (the rest go through SheetJS, which drops all styles),
// so they are the reference pair for real cell styling. Their data-row borders must stay identical.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import { exportSWBExcel, exportELTExcel, migrateProjectToAreas as toAreas } from './App.jsx';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
let payload;
beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { delete window.webkit; });

async function load(exportFn, ...args) {
  await exportFn(...args);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(payload.base64, 'base64'));
  return wb;
}

const swbProject = { id:'s1', name:'Site S', company:'Co', abn:'1', licence:'L', areas:[{ id:'ar1', name:'Area 1', boards:[{ id:'b1', name:'MSB' }] }] };
const swbResults = { s1: { ar1: { b1: {
  enclosure:   { status:'pass', comment:'ok' },
  ventilation: { status:'fail', comment:'blocked', risk:'H', defectId:'D1' },
  _photos: [{ id:'p1', dataUrl:PNG }, { id:'p2', dataUrl:PNG }],
} } } };
const swbMeta = { auditor:'Jane', testDate:'2026-09-21', nextTestDate:'2027-09-21' };

const pass4 = { visual:'pass', discharge:'pass', switching:'pass', charging:'pass' };
const eltProject = toAreas({ id:'e1', name:'Site E', company:'Co', abn:'1', licence:'L', assets:[
  { id:'a1', location:'Site E', assetLocation:'SE Door', type:'Emergency Exit Sign', maintained:'Maintained', fitting:'X' },
  { id:'a2', location:'Site E', assetLocation:'SW Roof', type:'Emergency Exit Sign', maintained:'Maintained', fitting:'Y' },
] });
const eltResults = { e1: { a1: { ...pass4 }, a2: { ...pass4, visual:'fail', rectified:'Repaired On-Site' } } };

const sides = ['top','bottom','left','right'];
const sig = cell => JSON.stringify(sides.map(s => { const b = (cell.border || {})[s] || {}; return [b.style, b.color && b.color.argb]; }));

describe('SWB / ELT data-row borders', () => {
  // SWB export = Register (one row per board) + one sheet per board. Its data rows must carry the SAME full thin grid as ELT's.
  it('SWB Register rows AND per-board checklist rows have full four-side thin borders identical to ELT data rows', async () => {
    const wb = await load(exportSWBExcel, swbProject, swbResults, swbMeta);
    const reg = wb.getWorksheet('Register'); const board = wb.getWorksheet('MSB');
    const elt = (await load(exportELTExcel, eltProject, eltResults, swbMeta)).getWorksheet('Emergency Lighting');

    const swbDataCells = [];
    for (let c = 1; c <= 12; c++) swbDataCells.push(reg.getCell(6, c));                       // Register: header row 5, data from row 6
    for (let r = 17; r <= 27; r++) for (let c = 1; c <= 7; c++) swbDataCells.push(board.getCell(r, c)); // board sheet: the 11 checklist rows
    const eltDataCells = [];
    for (let r = 6; r <= 7; r++) for (let c = 1; c <= 15; c++) eltDataCells.push(elt.getCell(r, c));

    const reference = sig(eltDataCells[0]);
    JSON.parse(reference).forEach(([style, color]) => { expect(style).toBe('thin'); expect(color).toBe('FFD9D9D9'); });
    swbDataCells.forEach(c => expect(sig(c), 'SWB ' + c.worksheet.name + '!' + c.address).toBe(reference));
    eltDataCells.forEach(c => expect(sig(c), 'ELT ' + c.address).toBe(reference));
  });

  it('SWB Register header block (rows 1–5) is plain — no fill, font or border — like ELT and Welder; the board sheet keeps a styled Audit Summary heading', async () => {
    const wb = await load(exportSWBExcel, swbProject, swbResults, swbMeta);
    const reg = wb.getWorksheet('Register');
    for (let r = 1; r <= 5; r++) for (let c = 1; c <= 16; c++) {
      const cell = reg.getCell(r, c);
      expect(cell.fill, 'fill r' + r + ' c' + c).toBeUndefined();
      expect(cell.border, 'border r' + r + ' c' + c).toBeUndefined();
    }
    expect(String(reg.getCell('A1').value)).toBe('Site S — Switchboard / Enclosure Audit');
    expect([1, 2, 3, 4, 5].map(r => reg.getRow(r).height)).toEqual([32, 16, 16, 6, 40]);
    expect(Object.keys(reg._merges).map(k => reg._merges[k].range).sort()).toEqual(['A1:P1', 'A2:P2', 'A3:B3', 'A4:P4', 'C3:D3', 'E3:P3'].sort());
    const board = wb.getWorksheet('MSB');
    expect(board.getCell('A7').fill.fgColor.argb).toBe('FFD9D9D9');                            // "Audit Summary" heading
  });

  it('SWB photos are embedded on the board\'s own sheet (one per row), with the defect row intact', async () => {
    const wb = await load(exportSWBExcel, swbProject, swbResults, swbMeta);
    expect(wb.worksheets.map(w => w.name)).toEqual(['Register', 'MSB']);
    const ws = wb.getWorksheet('MSB');
    expect(ws.getImages()).toHaveLength(2);
    expect(wb.getWorksheet('Register').getImages()).toHaveLength(0);
    const labels = [];
    ws.eachRow(row => labels.push(String(row.getCell(1).value || '')));
    expect(labels).toEqual(expect.arrayContaining(['Photo 1', 'Photo 2']));
    expect(String(ws.getCell('A18').value)).toBe('2. Ventilation');
    expect(String(ws.getCell('C18').value)).toBe('Fail');
    expect(String(ws.getCell('D18').value)).toBe('D1');
    expect(String(ws.getCell('E18').value)).toBe('blocked');
  });
});

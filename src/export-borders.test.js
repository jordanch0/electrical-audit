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
const eltResults = { e1: { a1: { ...pass4 }, a2: { ...pass4, visual:'fail', failReason:'Lamp Failure', action:'Repaired On-Site' } } };

const sides = ['top','bottom','left','right'];
const sig = cell => JSON.stringify(sides.map(s => { const b = (cell.border || {})[s] || {}; return [b.style, b.color && b.color.argb]; }));

describe('SWB / ELT data-row borders', () => {
  it('SWB data rows have full four-side thin borders identical to ELT data rows', async () => {
    const swb = (await load(exportSWBExcel, swbProject, swbResults, swbMeta)).worksheets[0];
    const elt = (await load(exportELTExcel, eltProject, eltResults, swbMeta)).getWorksheet('Emergency Lighting');

    // SWB: header row 5, board title row 6, then the 11-point checklist rows
    const swbDataCells = [];
    for (let r = 7; r <= 17; r++) for (let c = 1; c <= 6; c++) swbDataCells.push(swb.getCell(r, c));
    const eltDataCells = [];
    for (let r = 6; r <= 7; r++) for (let c = 1; c <= 14; c++) eltDataCells.push(elt.getCell(r, c));

    const reference = sig(eltDataCells[0]);
    const parsed = JSON.parse(reference);
    parsed.forEach(([style, color]) => { expect(style).toBe('thin'); expect(color).toBe('FFD9D9D9'); });
    swbDataCells.forEach(c => expect(sig(c), 'SWB ' + c.address).toBe(reference));
    // the Pass/Fail-coloured ELT cells (which use their own fills) share the same border too
    eltDataCells.forEach(c => expect(sig(c), 'ELT ' + c.address).toBe(reference));
  });

  it('SWB header block, column header row and board title row styling is unchanged', async () => {
    const ws = (await load(exportSWBExcel, swbProject, swbResults, swbMeta)).worksheets[0];
    expect(ws.getCell('A1').font).toMatchObject({ bold:true, size:14 });
    expect(ws.getCell('A3').fill.fgColor.argb).toBe('FFF5F5F5');
    ['A5','F5'].forEach(a => expect(sig(ws.getCell(a))).toBe(sig(ws.getCell('A7'))) );  // header row already used the same full grid
    expect(ws.getCell('A6').border.top.style).toBe('medium'); // board title row keeps its medium top/bottom rule
    expect(ws.getCell('A6').border.left).toBeUndefined();
  });

  it('SWB photos are still embedded (same sheet, under the board) with data intact', async () => {
    const wb = await load(exportSWBExcel, swbProject, swbResults, swbMeta);
    expect(wb.worksheets.map(w => w.name)).toEqual(['Switchboard Audit']);
    const ws = wb.worksheets[0];
    expect(ws.getImages()).toHaveLength(2);
    const labels = [];
    ws.eachRow(row => labels.push(String(row.getCell(1).value || '')));
    expect(labels).toContain('Photos');
    expect(String(ws.getCell('A8').value)).toBe('Ventilation');
    expect(String(ws.getCell('B8').value)).toBe('Fail');
    expect(String(ws.getCell('D8').value)).toBe('blocked');
  });
});

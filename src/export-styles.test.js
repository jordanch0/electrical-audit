// Styling of the exports that have been moved from SheetJS (which silently drops every style) to ExcelJS: real thin borders, coloured
// Pass / Fail / N/A / MONITOR cells, zebra rows, coloured Priority on the Defects sheet, plain header block, wrapped headings, native
// page setup. Real generated files are loaded back with ExcelJS. Modules are added here as each is converted.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import { exportIELExcel, exportThermoExcel } from './App.jsx';

let payload;
beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { delete window.webkit; });
const meta = { auditor: 'Jane', testDate: '2026-09-21', nextTestDate: '2027-09-21' };
const load = async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64')); return wb; };
const argb = c => c && c.fill && c.fill.fgColor && c.fill.fgColor.argb;
const PALETTE = { pass: 'FFE2EFDA', fail: 'FFFFC7CE', na: 'FFD9D9D9', monitor: 'FFFFD966', white: 'FFFFFFFF', zebra: 'FFF5F5F5', U: 'FF9B0000', H: 'FFFFC7CE', M: 'FFFFD966', L: 'FFE2EFDA' };
const failD = (i, priority) => ({ defectId: 'D-' + i, rectified: 'Scheduled for Repair', responsibility: 'Client', priority });

// [module, run(), main sheet, expected result-column heading, [expected Pass/Fail text per data row]]
const ielProject = { id: 'p', name: 'Site I', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'p1', name: 'estops', circuits: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], machineNames: { a: 'M1', b: 'M2', c: 'M3', d: 'M4', e: 'M5', f: 'M6', g: 'M7' } }] }] };
const ielResults = { a: { estops: { a: { status: 'fail', ...failD(1, 'U') }, b: { status: 'pass' }, c: { status: 'na' }, d: { status: 'untested' }, e: { status: 'fail', ...failD(2, 'H') }, f: { status: 'fail', ...failD(3, 'M') }, g: { status: 'fail', ...failD(4, 'L') } } } };
// Thermo: PASS / FAIL / MONITOR (its own amber state) / untested (no photo -> blank result)
const thermoProject = { id: 'p', name: 'Site H', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Plant', boards: [{ id: 'b', name: 'MSB', circuits: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'], circuitNames: { c1: 'One', c2: 'Two', c3: 'Three', c4: 'Four', c5: 'Five', c6: 'Six', c7: 'Seven' } }] }] };
const ph = (id, result, extra) => ({ id, flirFile: '10' + id, temp: '40', result, notes: '', rectifiedDate: '', ...extra });
const thermoResults = { a: { b: { c1: [ph('1', 'FAIL', failD(1, 'U'))], c2: [ph('2', 'PASS')], c3: [ph('3', 'MONITOR', failD(3, 'M'))], c5: [ph('5', 'FAIL', failD(5, 'H'))], c6: [ph('6', 'FAIL', failD(6, 'L'))], c7: [ph('7', 'PASS')] } } };
const MODULES = [
  ['IEL', () => exportIELExcel(ielProject, ielResults, meta), 'Isolators EStops Lanyards', ['Fail', 'Pass', 'N/A', 'Untested', 'Fail', 'Fail', 'Fail']],
  ['Thermo', () => exportThermoExcel(thermoProject, thermoResults, meta), 'Thermographic Test', ['FAIL', 'PASS', 'MONITOR', '', 'FAIL', 'FAIL', 'PASS']],
];

describe.each(MODULES)('%s export styling (ExcelJS)', (name, run, mainSheet, expectedResults) => {
  const dataCells = (ws, from, count) => { const out = []; for (let r = from; r < from + count; r++) ws.getRow(r).eachCell({ includeEmpty: false }, (c, col) => out.push({ c, r, col })); return out; };

  it('every data cell on the main AND Defects sheets has full thin borders on all four sides (like ELT / SWB)', async () => {
    await run(); const wb = await load();
    for (const [sheet, n] of [[mainSheet, expectedResults.length], ['Defects', 4]]) {
      const ws = wb.getWorksheet(sheet); const cols = ws.getRow(5).cellCount;
      for (let r = 6; r < 6 + n; r++) for (let c = 1; c <= cols; c++) {
        const b = ws.getCell(r, c).border || {};
        ['top', 'bottom', 'left', 'right'].forEach(side => expect(b[side] && b[side].style, `${sheet} r${r} c${c} ${side}`).toBe('thin'));
      }
    }
  });

  it('Pass green / Fail red (bold) / N/A grey; Untested stays a plain zebra cell', async () => {
    await run(); const wb = await load(); const ws = wb.getWorksheet(mainSheet);
    const col = ws.getRow(5).values.indexOf('Pass / Fail');
    expectedResults.forEach((txt, i) => {
      const cell = ws.getCell(6 + i, col); expect(String(cell.value == null ? '' : cell.value), 'row ' + (6 + i)).toBe(txt);
      const expected = { PASS: PALETTE.pass, FAIL: PALETTE.fail, 'N/A': PALETTE.na, MONITOR: PALETTE.monitor }[txt.toUpperCase()];
      if (expected) { expect(argb(cell), txt).toBe(expected); expect(cell.font.bold, txt).toBe(true); }
      else expect([PALETTE.white, PALETTE.zebra]).toContain(argb(cell));                                // Untested / blank: zebra, not coloured
    });
    const first = word => { const i = expectedResults.findIndex(t => t.toUpperCase() === word); return ws.getCell(6 + i, col); };
    expect(first('FAIL').font.color.argb).toBe('FF9C0006');                                            // Fail text is dark red
    expect(first('PASS').font.color.argb).toBe('FF375623');                                            // Pass text is dark green
    if (expectedResults.includes('MONITOR')) expect(first('MONITOR').font.color.argb).toBe('FF7F6000');   // MONITOR: dark amber text on amber
  });

  it('other cells alternate white / light-grey zebra rows', async () => {
    await run(); const wb = await load(); const ws = wb.getWorksheet(mainSheet);
    for (let i = 0; i < expectedResults.length; i++) expect(argb(ws.getCell(6 + i, 2)), 'row ' + (6 + i)).toBe(i % 2 === 0 ? PALETTE.white : PALETTE.zebra);
  });

  it('the header block stays PLAIN (no fill / border / bold, like ELT / SWB / Welder); the heading row only wraps and centres; row heights 32/16/16/6/44', async () => {
    await run(); const wb = await load();
    for (const ws of wb.worksheets) {
      for (let r = 1; r <= 5; r++) ws.getRow(r).eachCell({ includeEmpty: true }, (cell, c) => {
        expect(cell.fill === undefined || cell.fill.pattern === 'none', `${ws.name} r${r} c${c} fill`).toBe(true);
        expect(!cell.border || Object.keys(cell.border).length === 0, `${ws.name} r${r} c${c} border`).toBe(true);
        expect(!cell.font || !cell.font.bold, `${ws.name} r${r} c${c} bold`).toBe(true);
      });
      ws.getRow(5).eachCell(cell => expect(cell.alignment).toMatchObject({ wrapText: true, horizontal: 'center' }));
      expect([1, 2, 3, 4, 5].map(r => ws.getRow(r).height)).toEqual([32, 16, 16, 6, 44]);
    }
  });

  it('Defects sheet: Priority is colour-coded U dark red / H red / M amber / L green', async () => {
    await run(); const wb = await load(); const ws = wb.getWorksheet('Defects');
    const col = ws.getRow(5).values.indexOf('Priority'); expect(col).toBeGreaterThan(0);
    const seen = {}; for (let r = 6; r < 10; r++) seen[String(ws.getCell(r, col).value)] = ws.getCell(r, col);
    ['U', 'H', 'M', 'L'].forEach(p => expect(argb(seen[p]), p).toBe(PALETTE[p]));
    expect(seen.U.font.color.argb).toBe('FFFFFFFF'); expect(seen.U.font.bold).toBe(true);           // urgent = white bold on dark red
  });

  it('page setup is NATIVE in the file: A4, landscape, fit to 1 page wide, heading row repeated, footer', async () => {
    await run(); const wb = await load();
    for (const ws of wb.worksheets) {
      expect(ws.pageSetup, ws.name).toMatchObject({ paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '5:5' });
      expect(ws.headerFooter.oddFooter).toContain('Page &P of &N');
    }
  });
});

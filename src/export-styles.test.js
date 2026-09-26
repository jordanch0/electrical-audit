// Styling of the exports that have been moved from SheetJS (which silently drops every style) to ExcelJS: real thin borders, coloured
// Pass / Fail / N/A / MONITOR cells, zebra rows, coloured Priority on the Defects sheet, plain header block, wrapped headings, native
// page setup. Real generated files are loaded back with ExcelJS. Modules are added here as each is converted.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import { exportIELExcel, exportThermoExcel, exportTATExcel, exportExcel, exportIRTExcel } from './App.jsx';

let payload;
beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { delete window.webkit; });
const meta = { auditor: 'Jane', testDate: '2026-09-21', nextTestDate: '2027-09-21', pushDate: '2026-09-21', injectDate: '2026-09-21' };
const load = async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64')); return wb; };
const argb = c => c && c.fill && c.fill.fgColor && c.fill.fgColor.argb;
const PALETTE = { pass: 'FFE2EFDA', fail: 'FFFFC7CE', na: 'FFD9D9D9', monitor: 'FFFFD966', white: 'FFFFFFFF', zebra: 'FFF5F5F5', U: 'FF9B0000', H: 'FFFFC7CE', M: 'FFFFD966', L: 'FFE2EFDA' };
const failD = (i, priority) => ({ lastTested: '2026-09-21', defectId: 'D-' + i, rectified: 'Scheduled for Repair', responsibility: 'Client', priority });

// [module, run(), main sheet, expected result-column heading, [expected Pass/Fail text per data row]]
const ielProject = { id: 'p', name: 'Site I', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'p1', name: 'estops', circuits: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], machineNames: { a: 'M1', b: 'M2', c: 'M3', d: 'M4', e: 'M5', f: 'M6', g: 'M7' } }] }] };
const ielResults = { a: { estops: { a: { status: 'fail', ...failD(1, 'U') }, b: { status: 'pass' }, c: { status: 'na' }, d: { status: 'untested' }, e: { status: 'fail', ...failD(2, 'H') }, f: { status: 'fail', ...failD(3, 'M') }, g: { status: 'fail', ...failD(4, 'L') } } } };
// Thermo: PASS / FAIL / MONITOR (its own amber state) / untested (no photo -> blank result)
const thermoProject = { id: 'p', name: 'Site H', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Plant', boards: [{ id: 'b', name: 'MSB', circuits: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'], circuitNames: { c1: 'One', c2: 'Two', c3: 'Three', c4: 'Four', c5: 'Five', c6: 'Six', c7: 'Seven' } }] }] };
const ph = (id, result, extra) => ({ id, flirFile: '10' + id, temp: '40', result, notes: '', rectifiedDate: '', ...extra });
const thermoResults = { a: { b: { c1: [ph('1', 'FAIL', failD(1, 'U'))], c2: [ph('2', 'PASS')], c3: [ph('3', 'MONITOR', failD(3, 'M'))], c5: [ph('5', 'FAIL', failD(5, 'H'))], c6: [ph('6', 'FAIL', failD(6, 'L'))], c7: [ph('7', 'PASS')] } } };
const tatProject = { id: 'p', name: 'Site T', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Workshop', defaultFreq: '3', items: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], itemNames: { a: 'Grinder', b: 'Drill', c: 'Saw', d: 'Lead', e: 'Kettle', f: 'Fan', g: 'Heater' }, itemTags: { a: 'T1', b: 'T2', c: 'T3', d: 'T4', e: 'T5', f: 'T6', g: 'T7' }, itemEquipTypes: {}, itemFreqs: { a: '3', b: '1', c: '6', d: '12', e: '3', f: '2', g: '3' } }] };
const tatResults = { a: { a: { status: 'fail', ...failD(1, 'U') }, b: { status: 'pass' }, c: { status: 'na' }, d: { status: 'untested' }, e: { status: 'fail', ...failD(2, 'H') }, f: { status: 'fail', ...failD(3, 'M') }, g: { status: 'fail', ...failD(4, 'L') } } };
const rcdProject = { id: 'p', name: 'Site R', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'pn', name: 'MSB', circuits: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], circuitMeta: {} }] }] };
const both = (s, extra) => ({ push: { status: s, ...extra }, inject: { status: s, ...(s === 'pass' ? { resultPos: '12', resultNeg: '14' } : {}), ...extra } });
const rcdResults = { p: { a: { pn: { a: both('fail', failD(1, 'U')), b: both('pass'), c: both('na'), d: both('untested'), e: both('fail', failD(2, 'H')), f: both('fail', failD(3, 'M')), g: both('fail', failD(4, 'L')) } } } };
const RCD_RESULTS = ['Fail', 'Pass', 'N/A', 'Untested', 'Fail', 'Fail', 'Fail'];
// IRT: the status is derived from the readings (a low reading = FAIL); no readings = UNTESTED
const irtProject = { id: 'p', name: 'Site N', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'pn', name: 'MCC1', items: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], itemNames: { a: 'Motor A', b: 'Motor B', c: 'Motor C', d: 'Motor D', e: 'Motor E', f: 'Motor F', g: 'Motor G' } }] }] };
const goodR = { L1E: '>200', L2E: '>200', L3E: '>200', NE: '>200', L1L2: '>200', L1L3: '>200', L2L3: '>200', L1N: '>200', L2N: '>200', L3N: '>200' };
const badR = { L1E: '0.4', L2E: '250', L3E: '250', NE: '300' };
const irtItem = (readings, extra) => ({ status: 'untested', testVoltage: '500V', readings, notes: 'n', ...extra });
const irtResults = { p: { a: { pn: { a: irtItem(badR, failD(1, 'U')), b: irtItem(goodR), c: irtItem(goodR), d: irtItem({}), e: irtItem(badR, failD(2, 'H')), f: irtItem(badR, failD(3, 'M')), g: irtItem(badR, failD(4, 'L')) } } } };
const MODULES = [
  ['IRT', () => exportIRTExcel(irtProject, irtResults, meta), 'Register', ['FAIL', 'PASS', 'PASS', 'UNTESTED', 'FAIL', 'FAIL', 'FAIL']],
  ['RCD push', () => exportExcel(rcdResults, rcdProject, meta, 'push', null), 'Push Test', RCD_RESULTS],
  ['RCD injection', () => exportExcel(rcdResults, rcdProject, meta, 'inject', null), 'Injection Test', RCD_RESULTS],
  ['IEL', () => exportIELExcel(ielProject, ielResults, meta), 'Isolators EStops Lanyards', ['Fail', 'Pass', 'N/A', 'Untested', 'Fail', 'Fail', 'Fail']],
  ['TAT', () => exportTATExcel(tatProject, tatResults, meta), 'Test & Tag', ['Fail', 'Pass', 'N/A', 'Untested', 'Fail', 'Fail', 'Fail']],
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
    for (const ws of wb.worksheets.filter(s => s.name !== 'Summary')) {
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

  it('every DATE column is wide enough for a full "dd/mm/yyyy" on ONE line (dates are wrapping TEXT cells; Excel / Sheets break a tight one at the "/")', async () => {
    await run(); const wb = await load(); let checked = 0;
    for (const ws of wb.worksheets.filter(s => s.name !== 'Summary')) {
      ws.getRow(5).values.forEach((h, col) => {
        if (!/^(Date|Test Date|Next Test)/.test(String(h))) return;
        // 10 characters + a 30% margin for other apps' font metrics; the column width is what the file declares
        expect(ws.getColumn(col).width, `${ws.name} / "${h}"`).toBeGreaterThanOrEqual(13);
        for (let r = 6; r < ws.rowCount + 1; r++) {
          const v = ws.getCell(r, col).value; if (v == null || v === '') continue;
          expect(String(v), `${ws.name} / "${h}" r${r}`).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);   // plain 10-character text, never a longer date-time string
          checked++;
        }
      });
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('the Pass / Fail column is wide enough for its longest value ("UNTESTED" / "Untested" = 8 characters, "MONITOR") on ONE line, on every sheet that has one', async () => {
    await run(); const wb = await load(); let sheets = 0;
    for (const ws of wb.worksheets.filter(s => s.name !== 'Summary')) {
      const col = ws.getRow(5).values.indexOf('Pass / Fail'); if (col < 1) continue; sheets++;
      let longest = 8;                                                                            // never below "UNTESTED", even if a dataset has none
      for (let r = 6; r < ws.rowCount + 1; r++) { const v = ws.getCell(r, col).value; if (v != null) longest = Math.max(longest, String(v).length); }
      expect(ws.getColumn(col).width, `${ws.name} Pass / Fail`).toBeGreaterThanOrEqual(Math.ceil(longest * 1.3));   // +30% for other apps' font metrics (and bold caps)
    }
    expect(sheets).toBeGreaterThan(0);
  });

  it('page setup is NATIVE in the file: A4, landscape, fit to 1 page wide, heading row repeated, footer', async () => {
    await run(); const wb = await load();
    for (const ws of wb.worksheets.filter(s => s.name !== 'Summary')) {
      expect(ws.pageSetup, ws.name).toMatchObject({ paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '5:5' });
      expect(ws.headerFooter.oddFooter).toContain('Page &P of &N');
    }
  });
});

describe('TAT (ExcelJS): the Frequency column still shows the plain interval only', () => {
  it('"1 Month" / "3 Months" / "6 Months" / "12 Months" / "2 Months" — no site-type description — in a narrow column', async () => {
    await exportTATExcel(tatProject, tatResults, meta); const wb = await load(); const ws = wb.getWorksheet('Test & Tag');
    const col = ws.getRow(5).values.indexOf('Test Frequency');
    const vals = []; for (let r = 6; r < 13; r++) vals.push(String(ws.getCell(r, col).value));
    expect(vals).toEqual(['3 Months', '1 Month', '6 Months', '12 Months', '3 Months', '2 Months', '3 Months']);
    expect(JSON.stringify(vals)).not.toMatch(/Construction|Hire|Demolition|Warehouse|Hostile| — /);
    expect(ws.getColumn(col).width).toBeLessThanOrEqual(10);
  });
});

describe('RCD Summary sheet (ExcelJS): counts only, points to Defects, portrait, boxed', () => {
  it.each(['push', 'inject'])('%s: sheet order Test / Defects / Summary; Summary is portrait fit-to-width, boxed cells, Fail count red, and says where the failed circuits went', async mode => {
    await exportExcel(rcdResults, rcdProject, meta, mode, null); const wb = await load();
    expect(wb.worksheets.map(w => w.name)).toEqual([mode === 'push' ? 'Push Test' : 'Injection Test', 'Defects', 'Summary']);
    const ss = wb.getWorksheet('Summary');
    expect(ss.pageSetup).toMatchObject({ paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 });
    const val = label => { for (let r = 1; r <= 20; r++) if (ss.getCell(r, 1).value === label) return { cell: ss.getCell(r, 2), r }; };
    expect(val('Failed circuits').cell.value).toBe('4 — see the Defects sheet');
    expect(String(val('Fail').cell.value)).toBe('4'); expect(argb(val('Fail').cell)).toBe(PALETTE.fail);   // failures present -> red
    expect(String(val('Pass').cell.value)).toBe('1'); expect(argb(val('Pass').cell)).toBe(PALETTE.pass);
    for (const label of ['Total', 'N/A', 'Untested', 'Next Test Due']) { const b = val(label).cell.border || {}; ['top', 'bottom', 'left', 'right'].forEach(s => expect(b[s] && b[s].style, label + ' ' + s).toBe('thin')); }
    expect(JSON.stringify(ss.getSheetValues())).not.toMatch(/Failed Circuits/);                             // the old list is gone
  });
});

describe('IRT (ExcelJS): Register / Readings / Defects — sheet order, styling of all three, and the # cross-reference', () => {
  it('three sheets in order; Readings is boxed, has coloured results, a units line, wrapped headings and native page setup like the others', async () => {
    await exportIRTExcel(irtProject, irtResults, meta); const wb = await load();
    expect(wb.worksheets.map(w => w.name)).toEqual(['Register', 'Readings', 'Defects']);
    const rd = wb.getWorksheet('Readings');
    expect(String(rd.getCell('E3').value)).toBe('All readings in MΩ');
    const col = rd.getRow(5).values.indexOf('Pass / Fail');
    ['FAIL', 'PASS', 'PASS', 'UNTESTED', 'FAIL', 'FAIL', 'FAIL'].forEach((txt, i) => {
      const cell = rd.getCell(6 + i, col); expect(String(cell.value)).toBe(txt);
      const want = { PASS: PALETTE.pass, FAIL: PALETTE.fail }[txt]; if (want) { expect(argb(cell)).toBe(want); expect(cell.font.bold).toBe(true); }
    });
    for (let r = 6; r < 13; r++) for (let c = 1; c <= 16; c++) { const b = rd.getCell(r, c).border || {}; ['top', 'bottom', 'left', 'right'].forEach(s => expect(b[s] && b[s].style, `Readings r${r} c${c}`).toBe('thin')); }
    expect(rd.getCell(6, 6).alignment.horizontal).toBe('center');                                        // a reading value is centred
    expect(rd.pageSetup).toMatchObject({ orientation: 'landscape', fitToWidth: 1, printTitlesRow: '5:5' });
  });

  it('# lines up: the same # is the same circuit on Register, Readings AND Defects, and the Register carries none of the reading columns', async () => {
    await exportIRTExcel(irtProject, irtResults, meta); const wb = await load();
    const reg = wb.getWorksheet('Register'); const rd = wb.getWorksheet('Readings'); const df = wb.getWorksheet('Defects');
    const head = ws => ws.getRow(5).values;
    expect(head(reg).slice(1)).toEqual(['#', 'Location', 'Panel / DB', 'Equipment / Circuit', 'Test Date', 'Pass / Fail', 'Notes / Recommendations']);
    const name = ws => ws.getRow(5).values.indexOf('Equipment / Circuit');
    for (let i = 0; i < 7; i++) {
      expect(reg.getCell(6 + i, 1).value).toBe(i + 1); expect(rd.getCell(6 + i, 1).value).toBe(i + 1);
      expect(reg.getCell(6 + i, name(reg)).value).toBe(rd.getCell(6 + i, name(rd)).value);              // same circuit on each #
    }
    for (let r = 6; r < 10; r++) { const n = df.getCell(r, 1).value; expect(df.getCell(r, name(df)).value).toBe(reg.getCell(5 + n, name(reg)).value); }   // Defects # points at the Register row
    expect(head(reg).some(h => /^L\d|^N-E/.test(String(h)))).toBe(false);
  });

  it('the Register Test Date column is wide enough for dd/mm/yyyy on one line', async () => {
    await exportIRTExcel(irtProject, irtResults, meta); const wb = await load(); const reg = wb.getWorksheet('Register');
    const c = reg.getRow(5).values.indexOf('Test Date'); expect(reg.getColumn(c).width).toBeGreaterThanOrEqual(13);
    expect(String(reg.getCell(6, c).value)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

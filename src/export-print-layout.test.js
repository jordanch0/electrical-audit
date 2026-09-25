// Print-friendly Excel exports: the wide flat tables (RCD, IEL, TAT, Thermo, IRT, ELT) are split into a NARROW main results table + a
// separate Defects sheet (FAIL rows only, always present) linked by a "#" column, and every sheet carries real page setup in the file
// itself (landscape / fit to one page wide / repeating heading row / gridlines / page footer). SheetJS drops page setup, so the five
// SheetJS exports are post-processed (xlPrintify); ELT (ExcelJS) sets it natively. These tests parse the REAL generated files.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { exportExcel, exportIELExcel, exportTATExcel, exportThermoExcel, exportIRTExcel, exportELTExcel, xlPrintify, parseIELExcel, parseTATExcel, parseThermoExcel, parseIRTExcel, parseExcelToProject, migrateProjectToAreas } from './App.jsx';

let payload;
beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { delete window.webkit; });

const meta = { auditor: 'Jane', testDate: '2026-09-21', nextTestDate: '2027-09-21', pushDate: '2026-09-21', injectDate: '2026-09-21' };
const LAND_PX = (11.69 - 0.5) * 96;
const readZip = () => JSZip.loadAsync(Buffer.from(payload.base64, 'base64'));
const readWb = () => XLSX.read(payload.base64, { type: 'base64' });
const grid = (wb, name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }).map(r => r.map(String));
const sheetNames = async zip => [...(await zip.file('xl/workbook.xml').async('string')).matchAll(/<sheet [^>]*?name="([^"]*)"/g)].map(m => m[1]);
const widthsOf = xml => [...xml.matchAll(/<col [^>]*?min="(\d+)" max="(\d+)"[^>]*?width="([\d.]+)"/g)].flatMap(m => Array(+m[2] - +m[1] + 1).fill(+m[3]));
const fitScale = (xml, n) => Math.min(1, LAND_PX / widthsOf(xml).slice(0, n).reduce((a, w) => a + w * 7 + 5, 0));
const failD = i => ({ defectId: 'D-' + i, rectified: 'Scheduled for Repair', responsibility: 'Client', priority: 'H' });

// One tiny dataset per module: row 0 = FAIL (with defect data), row 1 = PASS carrying STALE defect data, row 2 = PASS
const rcdProject = { id: 'p', name: 'Site R', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'pn', name: 'MSB', circuits: ['C1', 'C2', 'C3'], circuitMeta: {} }] }] };
const rcdResults = { p: { a: { pn: {
  C1: { push: { status: 'fail', comment: 'Slow trip', ...failD(1), scheduledDate: '2026-10-05' }, inject: { status: 'fail', resultPos: '>300', resultNeg: '25', comment: 'Slow', ...failD(1), scheduledDate: '2026-10-05' } },
  C2: { push: { status: 'pass', comment: 'fine', defectId: 'STALE', rectified: 'STALE', priority: 'L' }, inject: { status: 'pass', resultPos: '12', resultNeg: '14', defectId: 'STALE' } },
  C3: { push: { status: 'pass' }, inject: { status: 'pass', resultPos: '10', resultNeg: '11' } } } } } };
const ielProject = { id: 'p', name: 'Site I', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'p1', name: 'estops', circuits: ['x', 'y', 'z'], machineNames: { x: 'Conv 1', y: 'Conv 2', z: 'Conv 3' } }] }] };
const ielResults = { a: { estops: { x: { status: 'fail', notes: 'Cable damaged', ...failD(1) }, y: { status: 'pass', notes: 'ok', defectId: 'STALE' }, z: { status: 'pass' } } } };
const tatProject = { id: 'p', name: 'Site T', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'Workshop', defaultFreq: '3', items: ['x', 'y', 'z'], itemNames: { x: 'Grinder', y: 'Drill', z: 'Saw' }, itemTags: { x: 'T1', y: 'T2', z: 'T3' }, itemEquipTypes: {}, itemFreqs: {} }] };
const tatResults = { a: { x: { status: 'fail', notes: 'Frayed lead', ...failD(1) }, y: { status: 'pass', notes: 'ok', defectId: 'STALE' }, z: { status: 'pass' } } };
const thermoProject = { id: 'p', name: 'Site H', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'Plant', boards: [{ id: 'b', name: 'MSB', circuits: ['c1', 'c2', 'c3'], circuitNames: { c1: 'One', c2: 'Two', c3: 'Three' } }] }] };
const ph = (id, result, extra) => ({ id, flirFile: '10' + id, temp: '40', result, notes: 'n' + id, rectifiedDate: '', ...extra });
const thermoResults = { a: { b: { c1: [ph('1', 'FAIL', failD(1))], c2: [ph('2', 'PASS', { defectId: 'STALE' })], c3: [ph('3', 'MONITOR', failD(3))] } } };
const irtProject = { id: 'p', name: 'Site N', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'pn', name: 'MCC1', items: ['x', 'y', 'z'], itemNames: { x: 'Motor 1', y: 'Motor 2', z: 'Motor 3' } }] }] };
const good = { L1E: '>200', L2E: '>200', L3E: '>200', NE: '>200', L1L2: '>200', L1L3: '>200', L2L3: '>200', L1N: '>200', L2N: '>200', L3N: '>200' };
const irtResults = { p: { a: { pn: {
  x: { status: 'untested', testVoltage: '500V', readings: { L1E: '0.4', L2E: '250', L3E: '250', NE: '300' }, notes: 'Wet', ...failD(1), scheduledDate: '2026-10-05' },
  y: { status: 'untested', testVoltage: '500V', readings: good, notes: 'ok', defectId: 'STALE' },
  z: { status: 'untested', testVoltage: '250V', readings: good } } } } };

// [name, run, main sheet, defect sheet, number of extra sheets, # of FAIL rows, id-heading count]
const MODULES = [
  ['RCD push', () => exportExcel(rcdResults, rcdProject, meta, 'push', null), 'Push Test', 1],
  ['RCD injection', () => exportExcel(rcdResults, rcdProject, meta, 'inject', null), 'Injection Test', 1],
  ['IEL', () => exportIELExcel(ielProject, ielResults, meta), 'Isolators EStops Lanyards', 1],
  ['TAT', () => exportTATExcel(tatProject, tatResults, meta), 'Test &amp; Tag', 1],
  ['Thermo', () => exportThermoExcel(thermoProject, thermoResults, meta), 'Thermographic Test', 2],   // FAIL + MONITOR
  ['IRT', () => exportIRTExcel(irtProject, irtResults, meta), 'Register', 1],
];
const DEFECT_HEADS = ['Defect ID', 'Rectified / Scheduled', 'Date Rectified / Scheduled', 'Responsibility', 'Priority'];

describe.each(MODULES)('%s export: narrow main table + Defects sheet + real page setup', (name, run, mainSheet, failCount) => {
  it('every sheet carries page setup in the file: A4, fit to 1 page wide (height free), 0.25" side margins, gridlines, footer, repeating heading row', async () => {
    await run(); const zip = await readZip(); const names = await sheetNames(zip);
    const wbXml = await zip.file('xl/workbook.xml').async('string');
    for (let i = 0; i < names.length; i++) {
      const x = await zip.file(`xl/worksheets/sheet${i + 1}.xml`).async('string');
      expect(x, names[i]).toContain('<pageSetUpPr fitToPage="1"/>');
      expect(x, names[i]).toMatch(/<pageSetup paperSize="9" orientation="(landscape|portrait)" fitToWidth="1" fitToHeight="0"\/>/);
      expect(x, names[i]).toContain('<pageMargins left="0.25" right="0.25"');
      expect(x, names[i]).toContain('<printOptions gridLines="1"/>');
      expect(x, names[i]).toContain('Page &amp;P of &amp;N');
      expect((x.match(/<pageSetup /g) || []).length).toBe(1);                       // never duplicated
      if (names[i] !== 'Summary') {
        expect(x, names[i]).toContain('orientation="landscape"');
        expect(wbXml, names[i]).toMatch(new RegExp(`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${names[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'!\\$5:\\$5</definedName>`));
      }
    }
  });

  it('the real readers accept the file (SheetJS and ExcelJS) and ExcelJS reads the page setup back', async () => {
    await run();
    const wb = readWb(); expect(wb.SheetNames.length).toBeGreaterThanOrEqual(2);
    const ej = new ExcelJS.Workbook(); await ej.xlsx.load(Buffer.from(payload.base64, 'base64'));
    const ws = ej.worksheets[0];
    expect(ws.pageSetup).toMatchObject({ paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '5:5' });
    expect(ws.pageSetup.margins).toMatchObject({ left: 0.25, right: 0.25 });
  });

  it('the main table carries NO defect columns, starts with #, and fits a landscape page at >= 85% scale', async () => {
    await run(); const zip = await readZip(); const wb = readWb();
    const main = wb.SheetNames[0]; const g = grid(wb, main);
    expect(g[4][0]).toBe('#');
    DEFECT_HEADS.forEach(h => expect(g[4], h).not.toContain(h));
    expect(g[4].some(h => /^Priority/.test(h))).toBe(false);
    const xml = await zip.file('xl/worksheets/sheet1.xml').async('string');
    expect(fitScale(xml, g[4].length)).toBeGreaterThanOrEqual(0.85);
    expect(g[4].some(h => /^Notes/.test(h))).toBe(true);                             // Notes stays in the main table
    expect(g[4].some(h => /Date|Next Test/.test(h))).toBe(true);                     // compliance dates stay in the main table
  });

  it('no heading is cut off: SheetJS cannot wrap a heading, so every heading fits its column', async () => {
    await run(); const zip = await readZip(); const wb = readWb();
    for (let i = 0; i < wb.SheetNames.length; i++) {
      if (wb.SheetNames[i] === 'Summary') continue;
      const xml = await zip.file(`xl/worksheets/sheet${i + 1}.xml`).async('string'); const w = widthsOf(xml); const head = grid(wb, wb.SheetNames[i])[4];
      head.forEach((h, c) => expect(h.length, `${wb.SheetNames[i]}: "${h}" in a ${w[c]}-wide column`).toBeLessThanOrEqual(w[c] + 1));
    }
  });

  it('Defects sheet: FAIL rows only, same # as the main table, identifiers repeated, stale data on PASS rows never listed', async () => {
    await run(); const wb = readWb();
    const m = grid(wb, wb.SheetNames[0]).slice(5).filter(r => /^\d+$/.test(r[0])); const d = grid(wb, 'Defects');
    DEFECT_HEADS.forEach(h => expect(d[4], h).toContain(h));
    const rows = d.slice(5).filter(r => /^\d+$/.test(r[0]));
    expect(rows).toHaveLength(failCount);
    const passFailCol = grid(wb, wb.SheetNames[0])[4].findIndex(h => /Pass \/ Fail/.test(h));
    rows.forEach(r => {
      const mainRow = m.find(x => x[0] === r[0]);
      expect(mainRow, '# ' + r[0]).toBeTruthy();
      expect(mainRow[passFailCol].toUpperCase()).toMatch(/FAIL|MONITOR/);          // # points at a failing row
      const mh = grid(wb, wb.SheetNames[0])[4]; d[4].slice(1, 1 + d[4].findIndex(h => h === 'Defect ID') - 1).forEach((h, k) => expect(mainRow[mh.indexOf(h)], h).toBe(r[1 + k]));   // every identifier heading shared with the main table agrees
    });
    expect(JSON.stringify(d)).not.toContain('STALE');
    expect(JSON.stringify(grid(wb, wb.SheetNames[0]))).not.toContain('STALE');
    expect(d[2][0]).toBe(`Defects recorded: ${failCount}`);
  });

  it('with ZERO fails the Defects sheet still exists with its headings and a "No defects recorded" line', async () => {
    const clean = JSON.parse(JSON.stringify({ rcdResults, ielResults, tatResults, thermoResults, irtResults }));
    const passAll = o => { const walk = v => { if (v && typeof v === 'object') { if (v.status === 'fail') v.status = 'pass'; if (v.result === 'FAIL' || v.result === 'MONITOR') v.result = 'PASS'; if (v.readings && v.readings.L1E === '0.4') v.readings = good; if (v.resultPos === '>300') v.resultPos = '12'; Object.values(v).forEach(walk); } }; walk(o); return o; };
    const c = passAll(clean);
    const runs = { 'RCD push': () => exportExcel(c.rcdResults, rcdProject, meta, 'push', null), 'RCD injection': () => exportExcel(passAll(JSON.parse(JSON.stringify(c.rcdResults))), rcdProject, meta, 'inject', null),
      IEL: () => exportIELExcel(ielProject, c.ielResults, meta), TAT: () => exportTATExcel(tatProject, c.tatResults, meta), Thermo: () => exportThermoExcel(thermoProject, c.thermoResults, meta), IRT: () => exportIRTExcel(irtProject, c.irtResults, meta) };
    await runs[name](); const wb = readWb(); const d = grid(wb, 'Defects');
    DEFECT_HEADS.forEach(h => expect(d[4], h).toContain(h));
    expect(d[5][0]).toBe('No defects recorded'); expect(d[2][0]).toBe('Defects recorded: 0');
  });
});

describe('RCD: the Defects sheet REPLACES the old "Failed Circuits" list on Summary, with no data lost', () => {
  it.each(['push', 'inject'])('%s: every field the old list carried (Area, Panel, Circuit, Notes, Priority) is on Defects; Summary keeps only the counts and points to it', async mode => {
    await exportExcel(rcdResults, rcdProject, meta, mode, null);
    const wb = readWb(); const sum = grid(wb, 'Summary'); const d = grid(wb, 'Defects');
    expect(JSON.stringify(sum)).not.toMatch(/Failed Circuits|"Area","Panel","Circuit"/);
    expect(sum.find(r => r[0] === 'Failed circuits')[1]).toBe('1 — see the Defects sheet');
    expect(sum.find(r => r[0] === 'Fail')[1]).toBe('1');                               // the counts are still there
    const row = d.slice(5).find(r => r[0] === '1');
    expect(row.slice(1, 3)).toEqual(['Plant', 'MSB C1']);                              // Area + Panel + Circuit (panel and circuit share the cell, as in the main table)
    expect(row).toContain(mode === 'push' ? 'Slow trip' : 'Slow');                     // Notes
    expect(row).toContain('H');                                                        // Priority
    expect(row).toEqual(expect.arrayContaining(['D-1', 'Scheduled for Repair', '05/10/2026', 'Client']));   // + the fields the old list never had
  });
  it('a >300 ms injection result counts as a defect even when the stored status is not FAIL (the old list missed these)', async () => {
    const res = JSON.parse(JSON.stringify(rcdResults)); res.p.a.pn.C3.inject = { status: 'pass', resultPos: '>300', resultNeg: '20', comment: 'slow', priority: 'M' };
    await exportExcel(res, rcdProject, meta, 'inject', null);
    const d = grid(readWb(), 'Defects').slice(5).filter(r => /^\d+$/.test(r[0]));
    expect(d.map(r => r[2])).toEqual(['MSB C1', 'MSB C3']);
  });
});

describe('IRT: three linked sheets — Register (short + narrow), Readings (full 10-reading breakdown), Defects', () => {
  it('sheet order, Register columns, Readings columns and values, identical # ordering, no rows lost', async () => {
    await exportIRTExcel(irtProject, irtResults, meta); const wb = readWb(); const zip = await readZip();
    expect(wb.SheetNames).toEqual(['Register', 'Readings', 'Defects']);              // Register FIRST: it is the sheet the importer reads and the one for a client PDF
    const reg = grid(wb, 'Register'); const rd = grid(wb, 'Readings');
    expect(reg[4]).toEqual(['#', 'Location', 'Panel / DB', 'Equipment / Circuit', 'Test Date', 'Pass / Fail', 'Notes / Recommendations']);
    expect(rd[4]).toEqual(['#', 'Location', 'Panel / DB', 'Equipment / Circuit', 'Test Voltage', 'L1-E', 'L2-E', 'L3-E', 'N-E', 'L1-L2', 'L1-L3', 'L2-L3', 'L1-N', 'L2-N', 'L3-N', 'Pass / Fail']);
    expect(rd[2]).toContain('All readings in MΩ');                                   // the unit is stated once, not on every heading
    const regRows = reg.slice(5).filter(r => /^\d+$/.test(r[0])); const rdRows = rd.slice(5).filter(r => /^\d+$/.test(r[0]));
    expect(regRows).toHaveLength(3); expect(rdRows).toHaveLength(3);                 // same number of circuits on both — nothing lost
    expect(regRows.map(r => r[0])).toEqual(rdRows.map(r => r[0]));
    expect(regRows.map(r => r[3])).toEqual(rdRows.map(r => r[3]));                   // same circuit on each # (matching Equipment / Circuit)
    expect(rdRows[0].slice(4)).toEqual(['500V', '0.4', '250', '250', '300', '', '', '', '', '', '', 'FAIL']);   // every reading + voltage preserved
    expect(rdRows[2].slice(4, 5)).toEqual(['250V']);
    expect(regRows.map(r => r[5])).toEqual(['FAIL', 'PASS', 'PASS']);
    // the Register is the short/narrow sheet: 7 columns, prints at 100%; Readings keeps all the measurement columns
    const x1 = await zip.file('xl/worksheets/sheet1.xml').async('string'); const x2 = await zip.file('xl/worksheets/sheet2.xml').async('string');
    expect(fitScale(x1, 7)).toBe(1); expect(fitScale(x2, 16)).toBeGreaterThanOrEqual(0.85);
    expect(reg[4].length).toBeLessThan(rd[4].length);
  });
});

describe('a re-import of each export still reads the structure (importers find columns by heading, and the first sheet is the main table)', () => {
  const asData = () => XLSX.read(payload.base64, { type: 'base64' });
  it('IEL', async () => { await exportIELExcel(ielProject, ielResults, meta); const p = parseIELExcel(asData()); expect(p.areas.length).toBe(1); expect(JSON.stringify(p)).toMatch(/Conv 1/); expect(JSON.stringify(p)).toMatch(/Conv 3/); });
  it('TAT', async () => { await exportTATExcel(tatProject, tatResults, meta); const p = parseTATExcel(asData()); expect(JSON.stringify(p)).toMatch(/Grinder/); expect(JSON.stringify(p)).toMatch(/T3/); });
  it('Thermo', async () => { await exportThermoExcel(thermoProject, thermoResults, meta); const p = parseThermoExcel(asData(), '', XLSX); expect(JSON.stringify(p)).toMatch(/One/); expect(JSON.stringify(p)).toMatch(/Three/); });
  it('IRT (the "#" column must not be mistaken for the Area column)', async () => {
    await exportIRTExcel(irtProject, irtResults, meta); const p = parseIRTExcel(asData());
    expect(p.areas.map(a => a.name)).toEqual(['Plant']);
    expect(p.areas[0].panels.map(x => x.name)).toEqual(['MCC1']);
    expect(Object.values(p.areas[0].panels[0].itemNames)).toEqual(['Motor 1', 'Motor 2', 'Motor 3']);
  });
  it('RCD', async () => { await exportExcel(rcdResults, rcdProject, meta, 'push', null); const p = parseExcelToProject(asData(), 'X', '', '', ''); expect(JSON.stringify(p)).toMatch(/Plant/); expect(JSON.stringify(p)).toMatch(/C3/); });
});

describe('ELT (ExcelJS): native page setup on every sheet, main + Defects + Photos', () => {
  it('main and Defects are landscape / fit to width / repeat the heading row; Photos is portrait', async () => {
    const project = migrateProjectToAreas({ id: 'p1', name: 'E', company: '', abn: '', licence: '', assets: [{ id: 'a1', location: 'E', assetLocation: 'Door', type: 'Exit Signs', maintained: 'Maintained', fitting: 'X' }] });
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    await exportELTExcel(project, { p1: { a1: { visual: 'fail', discharge: 'pass', switching: 'pass', charging: 'pass', photos: [{ id: '1', dataUrl: png }] } } }, meta);
    const ej = new ExcelJS.Workbook(); await ej.xlsx.load(Buffer.from(payload.base64, 'base64'));
    expect(ej.worksheets.map(w => w.name)).toEqual(['Emergency Lighting', 'Defects', 'Photos']);
    for (const [i, orient, title] of [[0, 'landscape', '5:5'], [1, 'landscape', '5:5'], [2, 'portrait', '1:1']]) {
      expect(ej.worksheets[i].pageSetup, ej.worksheets[i].name).toMatchObject({ paperSize: 9, orientation: orient, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: title });
      expect(ej.worksheets[i].headerFooter.oddFooter).toContain('Page &P of &N');
    }
  });
});

describe('xlPrintify itself', () => {
  it('handles awkward sheet names (& and apostrophes), leaves cell data untouched, and produces a file both readers accept', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['a', 'b'], [1, 'x & y']]), "Bob's & Sons");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['c']]), 'Second');
    const raw = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const out = await xlPrintify(raw, [{ titleRow: 1 }, { landscape: false }]);
    const back = XLSX.read(out, { type: 'base64' });
    expect(back.SheetNames).toEqual(["Bob's & Sons", 'Second']);
    expect(XLSX.utils.sheet_to_json(back.Sheets["Bob's & Sons"], { header: 1 })).toEqual([['a', 'b'], [1, 'x & y']]);
    const ej = new ExcelJS.Workbook(); await ej.xlsx.load(Buffer.from(out, 'base64'));
    expect(ej.worksheets[0].pageSetup.printTitlesRow).toBe('1:1');
    expect(ej.worksheets[1].pageSetup.orientation).toBe('portrait');
    const zip = await JSZip.loadAsync(out, { base64: true });
    expect((await zip.file('xl/workbook.xml').async('string')).match(/_xlnm.Print_Titles/g)).toHaveLength(1);
  });
});

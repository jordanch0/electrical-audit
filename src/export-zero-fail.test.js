// Every module's export must ALWAYS carry its fail-only / defect column headings — even when the dataset has zero failures (and
// even when nothing has been tested at all). Headings come from static arrays, never from "are there any fails?" (that is a separate
// concern: defectGate only blanks the VALUES on non-FAIL rows). Covers RCD (push + injection), IEL, TAT, Thermo, SWB (Register AND
// board sheet), IRT, ELT and Welder (Register AND the per-welder sheet).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { exportExcel, exportIELExcel, exportTATExcel, exportThermoExcel, exportIRTExcel, exportSWBExcel, exportELTExcel, exportWelderExcel, migrateProjectToAreas, SWB_CHECKLIST, WELDER_CHECKLIST } from './App.jsx';

let payload;
beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { delete window.webkit; });

const meta = { auditor: 'Jane', testDate: '2026-09-21', nextTestDate: '2027-09-21', pushDate: '2026-09-21', injectDate: '2026-09-21' };
const norm = s => String(s).replace(/\s+/g, ' ');
// SheetJS output (RCD / IEL / TAT / Thermo / IRT): the text of every sheet
const sheetJsText = () => { const wb = XLSX.read(payload.base64, { type: 'base64' }); return wb.SheetNames.map(n => norm(XLSX.utils.sheet_to_csv(wb.Sheets[n]))).join('\n'); };
// ExcelJS output (SWB / ELT / Welder): text per sheet name
async function exceljsSheets() {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64'));
  const out = {}; wb.eachSheet(ws => { const t = []; ws.eachRow(r => r.eachCell(c => t.push(norm(c.value == null ? '' : (c.value.result ?? c.value))))); out[ws.name] = t; });
  return out;
}
const has = (texts, wanted) => wanted.forEach(w => expect(texts, w).toContain(w));
const csvHas = (csv, wanted) => wanted.forEach(w => expect(csv, w).toContain(w));
const DEFECT = ['Defect ID', 'Responsibility'];

// A dataset with ZERO failures, and one with nothing recorded at all
const ZERO = ['only passes', 'nothing tested'];

describe.each(ZERO)('zero-fail exports keep every defect heading (%s)', kind => {
  const pass = kind === 'only passes';

  it('RCD push + injection', () => {
    const project = { id: 'p', name: 'Site R', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'A', panels: [{ id: 'pn', name: 'MSB', circuits: ['C1'], circuitMeta: {} }] }] };
    const results = pass ? { p: { a: { pn: { C1: { push: { status: 'pass' }, inject: { status: 'pass', resultPos: '12', resultNeg: '12' } } } } } } : {};
    for (const mode of ['push', 'inject']) {
      payload = null; exportExcel(results, project, meta, mode, null);
      csvHas(sheetJsText(), [...DEFECT, 'Rectified / Scheduled', 'Priority']);
    }
  });

  it('IEL', () => {
    const project = { id: 'p', name: 'Site I', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'A', panels: [{ id: 'p1', name: 'estops', circuits: ['x'], machineNames: { x: 'X' } }] }] };
    exportIELExcel(project, pass ? { a: { estops: { x: { status: 'pass' } } } } : {}, meta);
    csvHas(sheetJsText(), [...DEFECT, 'Rectified / Scheduled', 'Priority']);
  });

  it('TAT', () => {
    const project = { id: 'p', name: 'Site T', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'A', defaultFreq: '3', items: ['x'], itemNames: { x: 'X' }, itemTags: {}, itemEquipTypes: {}, itemFreqs: {} }] };
    exportTATExcel(project, pass ? { a: { x: { status: 'pass' } } } : {}, meta);
    csvHas(sheetJsText(), [...DEFECT, 'Rectified / Scheduled', 'Priority']);
  });

  it('Thermo', () => {
    const project = { id: 'p', name: 'Site H', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'A', boards: [{ id: 'b', name: 'MSB', circuits: ['c1'], circuitNames: { c1: 'C1' } }] }] };
    const results = pass ? { a: { b: { c1: [{ id: '1', flirFile: '0001', temp: '', result: 'PASS', notes: '', rectifiedDate: '' }] } } } : {};
    exportThermoExcel(project, results, meta);
    csvHas(sheetJsText(), [...DEFECT, 'Rectified / Scheduled', 'Priority']);
  });

  it('IRT', () => {
    const project = { id: 'p', name: 'Site N', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'A', panels: [{ id: 'pn', name: 'MCC1', items: ['x'], itemNames: { x: 'X' } }] }] };
    const results = pass ? { p: { a: { pn: { x: { status: 'pass', testVoltage: '500V', readings: { L1E: '500' } } } } } } : {};
    exportIRTExcel(project, results, meta);
    csvHas(sheetJsText(), [...DEFECT, 'Rectified / Scheduled', 'Priority']);
  });

  it('SWB: the Register AND every board sheet', async () => {
    const project = { id: 's1', name: 'Site S', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Area', boards: [{ id: 'b', name: 'MSB' }] }] };
    const results = pass ? { s1: { ar: { b: Object.fromEntries(SWB_CHECKLIST.map(c => [c.key, { status: 'pass' }])) } } } : {};
    await exportSWBExcel(project, results, meta);
    const sheets = await exceljsSheets();
    has(sheets.Register, [...DEFECT, 'Rectified / Scheduled', 'Priority (L,M,H,U)']);
    has(sheets.MSB, ['Defect ID', 'Risk Rating', 'Responsibility / Action']);
  });

  it('ELT', async () => {
    const project = migrateProjectToAreas({ id: 'p1', name: 'Site E', company: '', abn: '', licence: '', assets: [{ id: 'a1', location: 'Site E', assetLocation: 'SE Door', type: 'Exit Signs', maintained: 'Maintained', fitting: 'X' }] });
    const results = pass ? { p1: { a1: { visual: 'pass', discharge: 'pass', switching: 'pass', charging: 'pass' } } } : {};
    await exportELTExcel(project, results, meta);
    const sheets = await exceljsSheets();
    has(sheets['Emergency Lighting'], [...DEFECT, 'Rectified / Scheduled', 'Date Rectified / Scheduled', 'Priority (L,M,H,U)']);
  });

  it('Welder: the Register AND the per-welder sheet (defect block present, blank)', async () => {
    const project = { id: 'w', name: 'Site W', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Site W', assets: [{ id: 'a1', assetId: 'W001', brand: 'K', model: 'E', serial: '1' }] }] };
    const results = pass ? { a1: { items: Object.fromEntries(WELDER_CHECKLIST.map(c => [c.key, { result: 'pass' }])) } } : {};
    await exportWelderExcel(project, { w: results }, meta);
    const sheets = await exceljsSheets();
    has(sheets.Register, [...DEFECT, 'Rectified / Scheduled', 'Date Rectified / Scheduled', 'Priority (L,M,H,U)']);
    has(sheets.W001, [...DEFECT, 'Rectified / Scheduled', 'Date Rectified / Scheduled', 'Priority']);
  });
});

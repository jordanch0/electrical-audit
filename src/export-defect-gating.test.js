// Defect details (Defect ID, Responsibility, Priority, Rectified / Scheduled, Risk) are retained on an item when it leaves
// FAIL, so every export must only write them for FAIL rows. Each case has one FAIL row and one PASS row carrying stale
// defect data: the FAIL data must be exported, the PASS data must not.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { exportExcel, exportIELExcel, exportTATExcel, exportThermoExcel, exportIRTExcel, exportSWBExcel } from './App.jsx';

let payload;
beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { delete window.webkit; });

const sheetText = () => {
  const wb = XLSX.read(payload.base64, { type: 'base64' });
  return wb.SheetNames.map(n => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n');
};
const failD = { defectId: 'D-FAIL', rectified: 'R-FAIL', responsibility: 'RESP-FAIL', priority: 'H' };
const passD = { defectId: 'D-PASS', rectified: 'R-PASS', responsibility: 'RESP-PASS', priority: 'L' };
const meta = { auditor: 'Jane', testDate: '2026-09-21', nextTestDate: '2027-09-21', pushDate: '2026-09-21', injectDate: '2026-09-21' };
const noStale = txt => { for (const t of ['D-PASS', 'R-PASS', 'RESP-PASS']) expect(txt).not.toContain(t); };
const hasFail = txt => { for (const t of ['D-FAIL', 'R-FAIL', 'RESP-FAIL']) expect(txt).toContain(t); };

describe('RCD export', () => {
  const project = { id: 'p', name: 'Site R', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'A', panels: [{ id: 'pn', name: 'MSB', circuits: ['C1', 'C2'], circuitMeta: {} }] }] };
  it('push export includes defect details for FAIL rows only (push had none before)', async () => {
    const results = { p: { a: { pn: { C1: { push: { status: 'fail', ...failD }, inject: {} }, C2: { push: { status: 'pass', ...passD }, inject: {} } } } } };
    exportExcel(results, project, meta, 'push', null);
    const txt = sheetText();
    expect(txt).toContain('Defect ID');
    hasFail(txt); noStale(txt);
  });
  it('injection export includes defect details for FAIL rows only', async () => {
    const results = { p: { a: { pn: { C1: { push: {}, inject: { status: 'fail', resultPos: '>300', ...failD } }, C2: { push: {}, inject: { status: 'pass', resultPos: '12', resultNeg: '12', ...passD } } } } } };
    exportExcel(results, project, meta, 'inject', null);
    const txt = sheetText(); hasFail(txt); noStale(txt);
  });
});

describe('IEL export', () => {
  it('only FAIL rows carry defect details', () => {
    const project = { id: 'p', name: 'Site I', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'A', panels: [{ id: 'p1', name: 'estops', circuits: ['x', 'y'], machineNames: { x: 'X', y: 'Y' } }] }] };
    const results = { a: { estops: { x: { status: 'fail', ...failD, notes: 'n' }, y: { status: 'pass', ...passD, notes: 'n' } } } };
    exportIELExcel(project, results, meta);
    const txt = sheetText(); hasFail(txt); noStale(txt);
  });
});

describe('TAT export', () => {
  it('only FAIL rows carry defect details', () => {
    const project = { id: 'p', name: 'Site T', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'A', defaultFreq: '3', items: ['x', 'y'], itemNames: { x: 'X', y: 'Y' }, itemTags: {}, itemEquipTypes: {}, itemFreqs: {} }] };
    const results = { a: { x: { status: 'fail', ...failD }, y: { status: 'pass', ...passD } } };
    exportTATExcel(project, results, meta);
    const txt = sheetText(); hasFail(txt); noStale(txt);
  });
});

describe('Thermo export', () => {
  it('FAIL and MONITOR photos carry defect details; PASS photos do not', () => {
    const project = { id: 'p', name: 'Site H', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'A', boards: [{ id: 'b', name: 'MSB', circuits: ['c1', 'c2', 'c3'], circuitNames: { c1: 'C1', c2: 'C2', c3: 'C3' } }] }] };
    const photo = (id, file, result, d) => ({ id, flirFile: file, temp: '', result, notes: '', rectifiedDate: '', ...d });
    const results = { a: { b: {
      c1: [photo('1', '0001', 'FAIL', failD)],
      c2: [photo('2', '0002', 'PASS', passD)],
      c3: [photo('3', '0003', 'MONITOR', { defectId: 'D-MON', rectified: 'R-MON', responsibility: 'RESP-MON', priority: 'M' })],
    } } };
    exportThermoExcel(project, results, meta);
    const txt = sheetText(); hasFail(txt); noStale(txt);
    expect(txt).toContain('D-MON'); // the MONITOR panel collects the same details on purpose
  });
});

describe('IRT export', () => {
  it('only FAIL rows (manual or auto-detected) carry defect details', () => {
    const project = { id: 'p', name: 'Site N', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'A', panels: [{ id: 'pn', name: 'MCC1', items: ['x', 'y'], itemNames: { x: 'X', y: 'Y' } }] }] };
    const results = { p: { a: { pn: {
      x: { status: 'untested', testVoltage: '500V', readings: { L1E: '<1' }, ...failD }, // auto-detected FAIL
      y: { status: 'pass', testVoltage: '500V', readings: { L1E: '500' }, ...passD },
    } } } };
    exportIRTExcel(project, results, meta);
    const txt = sheetText(); hasFail(txt); noStale(txt);
  });
});

describe('SWB export', () => {
  it('only FAIL rows carry defect details', async () => {
    const project = { id: 's1', name: 'Site S', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Area', boards: [{ id: 'b', name: 'MSB' }] }] };
    const results = { s1: { ar: { b: {
      ventilation: { status: 'fail', comment: 'x', risk: 'H', ...failD },
      enclosure: { status: 'pass', comment: 'x', risk: 'L', ...passD },
    } } } };
    await exportSWBExcel(project, results, meta);
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64'));
    const cells = []; wb.eachSheet(ws => ws.eachRow(r => r.eachCell(c => cells.push(String(c.value?.result ?? c.value ?? '')))));
    const txt = cells.join('\n'); hasFail(txt); noStale(txt);
  });
});

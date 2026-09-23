import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseSWBExcel } from './App.jsx';

// Builds an XLSX "workbook data" object shaped like the ones exportSWBExcel
// produces (and that users then re-import via "Import from Excel" as their
// "previous report"): a merged "Area › Board" title row, followed by one row
// per checklist test item (label + Pass/Fail/N/A/Untested + other columns).
function buildExportedReportWorkbook() {
  const rows = [
    ['Test Site  —  Switchboard / Enclosure Audit'],
    ['Some Co Pty Ltd  |  ABN: 12 345 678 901'],
    ['Auditor: Jane', '', 'Date Tested: 01/01/2026', '', 'Next Annual Audit Due: 01/01/2027'],
    [],
    ['Item', 'Pass / Fail', 'Defect ID', 'Comments', 'Risk Rating', 'Responsibility / Action'],
    ['Wash Plant  ›  MSB — Main Switchboard', '', '', '', '', ''],
    ['Enclosure Condition', 'Pass', '', '', '', ''],
    ['Ventilation', 'Fail', 'D-001', 'Blocked vents', 'High', 'Site Electrician'],
    ['Moisture / Vermin', 'N/A', '', '', '', ''],
    ['Wash Plant  ›  MCC 1 — Motor Control Centre', '', '', '', '', ''],
    ['Enclosure Condition', 'Untested', '', '', '', ''],
    ['Sub Station  ›  MSB — Sub Station', '', '', '', '', ''],
    ['Enclosure Condition', 'Pass', '', '', '', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Switchboard Audit');
  return wb;
}

function buildTemplateWorkbook() {
  const rows = [
    ['Test Site'],
    ['Some Co Pty Ltd  |  ABN: 12 345 678 901'],
    [''],
    ['INSTRUCTIONS: ...'],
    ['Area', 'Board / Panel Name'],
    ['Wash Plant', 'MSB — Main Switchboard'],
    ['Wash Plant', 'MCC 1 — Motor Control Centre'],
    ['Sub Station', 'MSB — Sub Station'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'SWB Import');
  return wb;
}

describe('parseSWBExcel', () => {
  it('imports only areas/boards from a previously-exported report, excluding test items', () => {
    const parsed = parseSWBExcel(buildExportedReportWorkbook());
    expect(parsed).not.toBeNull();

    const boardNames = parsed.areas.flatMap(a => a.boards.map(b => b.name));
    const totalBoards = boardNames.length;

    // Exactly the 3 real boards — never the checklist item labels or Pass/Fail/N/A/Untested values
    expect(totalBoards).toBe(3);
    expect(boardNames).toEqual(
      expect.arrayContaining(['MSB — Main Switchboard', 'MCC 1 — Motor Control Centre', 'MSB — Sub Station'])
    );
    const forbidden = ['Enclosure Condition', 'Ventilation', 'Moisture / Vermin', 'Pass', 'Fail', 'N/A', 'Untested'];
    forbidden.forEach(bad => expect(boardNames).not.toContain(bad));

    expect(parsed.areas.map(a => a.name).sort()).toEqual(['Sub Station', 'Wash Plant']);
  });

  it('still imports the plain Area / Board template format correctly', () => {
    const parsed = parseSWBExcel(buildTemplateWorkbook());
    expect(parsed).not.toBeNull();
    const boardNames = parsed.areas.flatMap(a => a.boards.map(b => b.name));
    expect(boardNames).toEqual([
      'MSB — Main Switchboard',
      'MCC 1 — Motor Control Centre',
      'MSB — Sub Station',
    ]);
    expect(parsed.siteName).toBe('Test Site');
  });
});

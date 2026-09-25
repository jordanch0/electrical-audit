import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import * as XLSX from 'xlsx';
import { parseSWBExcel, exportSWBExcel, SWB_CHECKLIST } from './App.jsx';

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

// ─── Stage 4: exact headings, exact-suffix site name, old / new / template coverage ───
const aoa = (rows, sheet = 'S') => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheet); return wb; };
const boardsOf = p => p.areas.map(a => [a.name, a.boards.map(b => b.name)]);

describe('parseSWBExcel — a REAL current export (Register + board sheets) round-trips', () => {
  let payload;
  beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
  afterEach(() => { delete window.webkit; });
  it('brings back areas, boards (incl. the same board name in two areas), the hyphenated site name, company / ABN / licence — and no results', async () => {
    const keys = SWB_CHECKLIST.map(c => c.key);
    const project = { id: 's1', name: 'Hearse Road - Firestone', company: 'Acme Pty Ltd', abn: '98 765 432 109', licence: 'EW1', areas: [
      { id: 'wp', name: 'Wash Plant', boards: [{ id: 'a', name: 'MSB' }, { id: 'b', name: 'MCC 1' }] },
      { id: 'ss', name: 'Sub Station', boards: [{ id: 'c', name: 'MSB' }] } ] };
    const results = { s1: { wp: { a: Object.fromEntries(keys.map((k, i) => [k, { status: i % 3 === 0 ? 'fail' : 'pass', comment: 'secret note' }])) } } };
    await exportSWBExcel(project, results, { auditor: 'Jane', testDate: '2026-09-25', nextTestDate: '2027-09-25' });
    await waitFor(() => expect(payload).toBeTruthy());
    const parsed = parseSWBExcel(XLSX.read(Buffer.from(payload.base64, 'base64'), { type: 'buffer' }));
    expect(parsed.siteName).toBe('Hearse Road - Firestone');                 // hyphen survives; the " — Switchboard / Enclosure Audit" suffix is stripped
    expect([parsed.company, parsed.abn, parsed.licence]).toEqual(['Acme Pty Ltd', '98 765 432 109', 'EW1']);
    expect(boardsOf(parsed)).toEqual([['Wash Plant', ['MSB', 'MCC 1']], ['Sub Station', ['MSB']]]);
    expect(JSON.stringify(parsed)).not.toMatch(/secret note|Enclosure Condition/);   // structure only
  });
});

describe('parseSWBExcel — site name and company', () => {
  const HEAD = ['Area', 'Board'];
  it.each([
    ['Hearse Road - Firestone  —  Switchboard / Enclosure Audit', 'Hearse Road - Firestone'],   // old two-space spacing
    ['Hearse Road - Firestone — Switchboard / Enclosure Audit', 'Hearse Road - Firestone'],      // single-space spacing
    ['Dixon Quarry - Switchboard Audit', 'Dixon Quarry'],
    ['Plain Site Name', 'Plain Site Name'],
    ['Wash Area Switchboard — Switchboard / Enclosure Audit', 'Wash Area Switchboard'],          // a name containing "area" AND "board" must not confuse anything
  ])('%s -> %s', (title, expected) => {
    const p = parseSWBExcel(aoa([[title], ['Co  |  ABN: 1'], [''], [''], HEAD, ['Plant', 'MSB']]));
    expect(p.siteName).toBe(expected);
    expect(boardsOf(p)).toEqual([['Plant', ['MSB']]]);
  });
  it('ignores the template / export placeholders and strips the old "Electrical Audit Software Pty. Ltd." company suffix', () => {
    const tpl = parseSWBExcel(aoa([['Site Name — enter your site name here'], ['Company Name  |  ABN: 12 345 678 901  |  Electrical Licence: 123456C'], [''], ['INSTRUCTIONS: '.padEnd(90, 'x')], ['Area', 'Board / Panel Name'], ['Wash Plant', 'MSB']]));
    expect(tpl).toMatchObject({ siteName: '', company: '', abn: '', licence: '' });
    const blank = parseSWBExcel(aoa([['S — Switchboard / Enclosure Audit'], ['SparkCheck'], [''], [''], HEAD, ['P', 'B']]));
    expect(blank.company).toBe('');
    const old = parseSWBExcel(aoa([['S  —  Switchboard / Enclosure Audit'], ['Some Co Pty Ltd Electrical Audit Software Pty. Ltd.  |  ABN: 98 765  |  Electrical Licence: EW9'], [''], [''], HEAD, ['P', 'B']]));
    expect([old.company, old.abn, old.licence]).toEqual(['Some Co Pty Ltd', '98 765', 'EW9']);
  });
});

describe('parseSWBExcel — exact header matching (never a "contains" match)', () => {
  it('a title row containing "area" and "board" is not the header; the real Area / Board row is', () => {
    const p = parseSWBExcel(aoa([['Wash Area Switchboard Report'], [''], [''], [''], ['Area', 'Board / Panel Name', 'Notes'], ['Plant', 'MSB', 'x']]));
    expect(boardsOf(p)).toEqual([['Plant', ['MSB']]]);
  });
  it('headings that merely CONTAIN the words ("Area Name", "Panel Board") are not accepted — nothing is invented', () => {
    const p = parseSWBExcel(aoa([['Site'], [''], [''], [''], ['Area Name', 'Panel Board'], ['Plant', 'MSB']]));
    expect(p.areas).toEqual([]);
  });
  it('a Register with extra columns (Score, Failed Items …) only reads Area and Board, and de-duplicates boards', () => {
    const p = parseSWBExcel(aoa([['S — Switchboard / Enclosure Audit'], [''], [''], [''],
      ['Area', 'Board', 'Date Tested', 'Pass/Fail', 'Pass', 'Fail', 'N/A', 'Untested', 'Score', 'Highest Risk', 'Failed Items', 'Next Audit Due'],
      ['Wash Plant', 'MSB', '', 'Pass', 11, 0, 0, 0, '100.0%', '', '', ''], ['Wash Plant', 'MSB', '', '', 0, 0, 0, 11, '0.0%', '', '', ''], ['Wash Plant', 'MCC', '', '', 0, 0, 0, 11, '0.0%', '', 'Ventilation', '']]));
    expect(boardsOf(p)).toEqual([['Wash Plant', ['MSB', 'MCC']]]);
  });
  it('an OLD single-sheet export whose title contains "area" / "board" still uses the legacy Area › Board rows', () => {
    const p = parseSWBExcel(aoa([['Wash Area Switchboard  —  Switchboard / Enclosure Audit'], ['Co'], ['Auditor: Jane'], [], ['Item', 'Pass / Fail', 'Defect ID', 'Comments', 'Risk Rating', 'Responsibility / Action'],
      ['Wash Plant  ›  MSB', '', '', '', '', ''], ['Enclosure Condition', 'Pass', '', '', '', ''], ['Sub Station  ›  DB 1', '', '', '', '', ''], ['Ventilation', 'Fail', '', '', '', '']]));
    expect(p.siteName).toBe('Wash Area Switchboard');
    expect(boardsOf(p)).toEqual([['Wash Plant', ['MSB']], ['Sub Station', ['DB 1']]]);
  });
  it('finds the Area / Board headings on a later sheet when the first sheet has none', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Notes only']]), 'Cover');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Site'], [''], [''], [''], ['Area', 'Board'], ['A1', 'B1']]), 'Register');
    expect(boardsOf(parseSWBExcel(wb))).toEqual([['A1', ['B1']]]);
  });
  it('empty / unreadable input returns null instead of throwing', () => {
    expect(parseSWBExcel({ SheetNames: [] })).toBeNull();
    expect(parseSWBExcel(null)).toBeNull();
  });
});

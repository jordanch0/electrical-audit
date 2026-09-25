// ELT Excel import: structure only (the fitting register). Header detection follows the SWB rule learned from its re-import
// bug: a row is only the header if >= 3 ELT headings match a cell exactly, and Asset Location must be one of them.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as XLSX from 'xlsx';
import { parseELTExcel, downloadELTTemplate, exportELTExcel, exportIELExcel, ELT_COLUMNS, migrateProjectToAreas as toAreas } from './App.jsx';

let payload;
beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { delete window.webkit; });

const wbFromRows = rows => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1'); return wb; };
const HEAD = ['Location', 'Asset Location', 'Asset ID', 'Type', 'Maintained/Non-Maintained', 'Fitting Type/Manufacturer'];
const readPayload = () => XLSX.read(payload.base64, { type: 'base64' });

const project = toAreas({ id: 'e1', name: 'Hearse Road - Firestone', company: 'Co Pty Ltd', abn: '98 765 432 109', licence: 'EW1234', assets: [
  { id: 'a1', location: 'Hearse Road - Firestone', assetLocation: 'SE Door', assetId: '007', type: 'Emergency Exit Sign', typeOther: '', maintained: 'Maintained', fitting: 'Clevertronics 24m' },
  { id: 'a2', location: 'Hearse Road - Firestone', assetLocation: 'SW Roof', assetId: '', type: 'Other', typeOther: 'Bulkhead Light', maintained: 'Non-Maintained', fitting: 'Y' },
] });
const pass4 = { visual: 'pass', discharge: 'pass', switching: 'pass', charging: 'pass' };
const meta = { auditor: 'Jane', testDate: '2026-09-21', nextTestDate: '2027-03-21' };

describe('round trip: re-importing an ELT export', () => {
  it('brings back the fitting register, site name (with its hyphen) and company details — and no results', async () => {
    await exportELTExcel(project, { e1: { a1: pass4, a2: { ...pass4, discharge: 'fail', failReason: 'Lamp Failure', action: 'Repaired On-Site', notes: 'x' } } }, meta);
    const parsed = parseELTExcel(readPayload());
    expect(parsed.ok).toBe(true);
    expect(parsed.siteName).toBe('Hearse Road - Firestone'); // the other modules would truncate this at the hyphen
    expect(parsed).toMatchObject({ company: 'Co Pty Ltd', abn: '98 765 432 109', licence: 'EW1234' });
    expect(parsed.assets.map(a => ({ ...a, id: undefined }))).toEqual([
      { id: undefined, location: 'Hearse Road - Firestone', assetLocation: 'SE Door', assetId: '007', type: 'Emergency Exit Sign', typeOther: '', maintained: 'Maintained', fitting: 'Clevertronics 24m' },
      { id: undefined, location: 'Hearse Road - Firestone', assetLocation: 'SW Roof', assetId: '', type: 'Other', typeOther: 'Bulkhead Light', maintained: 'Non-Maintained', fitting: 'Y' },
    ]);
    for (const a of parsed.assets) { expect(a).not.toHaveProperty('visual'); expect(a).not.toHaveProperty('failReason'); } // structure only
  });

  it('ignores the "SparkCheck" company placeholder the export writes when the company is blank', async () => {
    await exportELTExcel({ ...project, company: '', abn: '', licence: '' }, { e1: { a1: pass4, a2: pass4 } }, meta);
    const parsed = parseELTExcel(readPayload());
    expect(parsed.company).toBe('');
  });
});

describe('blank template', () => {
  it('downloads with the same headings and imports cleanly with placeholders ignored', () => {
    downloadELTTemplate();
    const wb = readPayload();
    const parsed = parseELTExcel(wb);
    expect(parsed.ok).toBe(true);
    expect(parsed.assets.map(a => a.assetLocation)).toEqual(['SE Door', 'SW Roof']);
    expect(parsed.siteName).toBe(''); // "Site Name — enter your site name here" is a placeholder, not a name
    expect(parsed).toMatchObject({ company: '', abn: '', licence: '' });
    expect(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })[4]).toEqual(ELT_COLUMNS); // same 14 headings as the export
  });
});

describe('header detection and validation', () => {
  it("rejects another module's export (IEL has Location/Type but no Asset Location)", () => {
    const iel = { id: 'p', name: 'Site I', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'A', panels: [{ id: 'p1', name: 'estops', circuits: ['x'], machineNames: { x: 'X' } }] }] };
    exportIELExcel(iel, { a: { estops: { x: { status: 'pass' } } } }, meta);
    const parsed = parseELTExcel(readPayload());
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/column headings/);
  });

  it('is not fooled by title / meta text that merely contains "location" or "type"', () => {
    const wb = wbFromRows([
      ['Location Type Asset ID — Emergency Lighting Test'],
      ['Some Co  |  ABN: 1  |  Type of business: electrical'],
      ['Auditor: Jane', '', 'Date Tested: x', '', 'Next Test Due: y'],
      ['Each row below is a fitting. Location and Type are optional; only Asset Location is required, so fill that in first please.'],
      HEAD,
      ['Site', 'SE Door', '', 'Emergency Exit Sign', 'Maintained', 'X'],
    ]);
    const parsed = parseELTExcel(wb);
    expect(parsed.ok).toBe(true);
    expect(parsed.assets).toHaveLength(1);
    expect(parsed.assets[0].assetLocation).toBe('SE Door'); // header was row 5, not the title / instruction rows
  });

  it('errors clearly when the Asset Location column is missing', () => {
    const parsed = parseELTExcel(wbFromRows([['Location', 'Asset ID', 'Type', 'Maintained/Non-Maintained'], ['Site', '1', 'Emergency Exit Sign', 'Maintained']]));
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/Asset Location/);
  });

  it('errors when no row has an Asset Location, and when the sheet has no headings at all', () => {
    expect(parseELTExcel(wbFromRows([HEAD, ['Site', '', '1', 'Emergency Exit Sign', 'Maintained', 'X']])).error).toMatch(/No fittings found/);
    expect(parseELTExcel(wbFromRows([['just', 'some'], ['random', 'cells']])).ok).toBe(false);
  });

  it('skips blank rows silently, counts rows with no Asset Location, and collapses duplicates', () => {
    const parsed = parseELTExcel(wbFromRows([
      HEAD,
      ['Site', 'SE Door', '1', 'Emergency Exit Sign', 'Maintained', 'X'],
      ['', '', '', '', '', ''],
      ['Site', '', '2', 'Emergency Exit Sign', 'Maintained', 'X'],
      ['Site', 'se door', '1', 'Emergency Exit Sign', 'Maintained', 'X'],
      ['Site', 'SW Roof', '', '', '', ''],
    ]));
    expect(parsed.ok).toBe(true);
    expect(parsed.assets.map(a => a.assetLocation)).toEqual(['SE Door', 'SW Roof']);
    expect(parsed.skipped).toBe(1);
    expect(parsed.duplicates).toBe(1);
  });
});

describe('field mapping', () => {
  it('matches Type against the list case-insensitively; unknown types import as Other + the text', () => {
    const parsed = parseELTExcel(wbFromRows([
      HEAD,
      ['S', 'A', '', 'emergency exit sign', 'Maintained', ''],
      ['S', 'B', '', 'Bulkhead Light', 'Maintained', ''],
      ['S', 'C', '', 'bulkhead light', 'Maintained', ''],
      ['S', 'D', '', 'Other', '', ''],
      ['S', 'E', '', '', '', ''],
    ]), ['Emergency Exit Sign', 'Combination Unit (Sign + 2 Side Lights)']);
    expect(parsed.assets.map(a => [a.type, a.typeOther])).toEqual([
      ['Emergency Exit Sign', ''], ['Other', 'Bulkhead Light'], ['Other', 'bulkhead light'], ['Other', ''], ['', ''],
    ]);
    expect(parsed.unknownTypes).toEqual(['Bulkhead Light']); // listed once, case-insensitively
  });

  it('normalises Maintained values and blanks unrecognised ones (counted)', () => {
    const parsed = parseELTExcel(wbFromRows([
      HEAD,
      ['S', 'A', '', '', 'maintained', ''],
      ['S', 'B', '', '', 'non maintained', ''],
      ['S', 'C', '', '', 'NON-MAINTAINED', ''],
      ['S', 'D', '', '', 'sometimes', ''],
    ]));
    expect(parsed.assets.map(a => a.maintained)).toEqual(['Maintained', 'Non-Maintained', 'Non-Maintained', '']);
    expect(parsed.badMaintained).toBe(1);
  });

  it('keeps Asset IDs as text (leading zeros survive) and reads CSV files', () => {
    const csv = XLSX.read('Location,Asset Location,Asset ID,Type,Maintained/Non-Maintained,Fitting Type/Manufacturer\nS,SE Door,007,Emergency Exit Sign,Maintained,X\n', { type: 'string' });
    const parsed = parseELTExcel(csv);
    expect(parsed.ok).toBe(true);
    expect(parsed.assets[0].assetId).toBe('007');
  });
});

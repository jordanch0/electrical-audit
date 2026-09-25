// SWB export = Register (one row per board) + one full sheet per board — the same physical structure as Welder's export.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import { exportSWBExcel, swbRegisterRows, swbBoardOverall, swbSheetName, SWB_REGISTER_COLUMNS, SWB_CHECKLIST } from './App.jsx';
import { JPEG_A, JPEG_B } from './test/jpeg-fixtures.js';

let payload;
beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { delete window.webkit; });
const V = c => (c.value == null ? '' : String(c.value));
const meta = { auditor: 'Jane', testDate: '2026-07-13', nextTestDate: '2027-07-13' };
async function build(project, results, m = meta) {
  await exportSWBExcel(project, results, m);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64'));
  return wb;
}
const allKeys = SWB_CHECKLIST.map(c => c.key);
const answered = (pattern, extra = {}) => Object.fromEntries(allKeys.map((k, i) => [k, { status: { P: 'pass', F: 'fail', N: 'na', '.': 'untested' }[pattern[i]], ...(extra[k] || {}) }]));

const project = { id: 's1', name: 'Hearse Road - Firestone', company: 'Acme Pty Ltd', abn: '99 999', licence: 'EW1', areas: [
  { id: 'wp', name: 'Wash Plant', boards: [{ id: 'msb', name: 'MSB' }, { id: 'mcc', name: 'MCC 1' }] },
  { id: 'ss', name: 'Sub Station', boards: [{ id: 'msb2', name: 'MSB' }, { id: 'db', name: 'DB/1: North?' }] },
] };
const results = { s1: {
  wp: {
    msb: { ...answered('PPPPPPPPPPP') },                                                                  // all pass
    mcc: { ...answered('PFN........', { ventilation: { risk: 'M', defectId: 'D-7', comment: 'blocked', rectified: 'Scheduled for Repair', responsibility: 'Site Electrician' }, enclosure: { risk: 'H', defectId: 'STALE', comment: 'old' } }),
           _photos: [{ id: 'p1', dataUrl: JPEG_A }, { id: 'p2', dataUrl: JPEG_B }] },                   // partly answered, 1 fail, 2 photos
  },
  ss: {
    msb2: { ...answered('PPPPPPPPPPF', { earthing: { risk: 'U', defectId: 'D-9' } }), _photos: [{ id: 'p3', dataUrl: JPEG_A }] }, // complete, 1 fail, 1 photo
    // db: not tested at all
  },
} };

describe('swbRegisterRows / board overall (same rule as Welder)', () => {
  it('overall is untested until all 11 items are answered; then any Fail -> fail, else pass (N/A counts as answered)', () => {
    expect(swbBoardOverall({ untested: 1, fail: 1 })).toBe('untested');    // a Fail among blanks does not decide it
    expect(swbBoardOverall({ untested: 0, fail: 0 })).toBe('pass');
    expect(swbBoardOverall({ untested: 0, fail: 2 })).toBe('fail');
  });
  it('lists EVERY board (tested or not) in area order with the approved columns (defect set included)', () => {
    expect(SWB_REGISTER_COLUMNS).toEqual(['Area', 'Board', 'Date Tested', 'Pass/Fail', 'Pass', 'Fail', 'N/A', 'Untested', 'Score', 'Highest Risk', 'Failed Items', 'Rectified / Scheduled', 'Defect ID', 'Responsibility', 'Priority (L,M,H,U)', 'Next Audit Due']);
    const rows = swbRegisterRows(project, results, meta);
    expect(rows.map(r => [r.cells[0], r.cells[1]])).toEqual([['Wash Plant', 'MSB'], ['Wash Plant', 'MCC 1'], ['Sub Station', 'MSB'], ['Sub Station', 'DB/1: North?']]);
    const [msb, mcc, msb2, db] = rows.map(r => r.cells);
    expect(msb).toEqual(['Wash Plant', 'MSB', '13/07/2026', 'Pass', 11, 0, 0, 0, '100.0%', '', '', '', '', '', '', '13/07/2027']);
    // partly answered: Pass/Fail blank, no date, score counts blanks against it (1 pass, 1 fail, 1 N/A: 1 / (11-1)), failed items list only FAIL items
    expect(mcc).toEqual(['Wash Plant', 'MCC 1', '', '', 1, 1, 1, 8, '10.0%', 'Medium', 'Ventilation', 'Scheduled for Repair', 'D-7', 'Site Electrician', '', '13/07/2027']);   // defect set from the FAIL item only (the passing item's stale D STALE is ignored)
    expect(msb2).toEqual(['Sub Station', 'MSB', '13/07/2026', 'Fail', 10, 1, 0, 0, '90.9%', 'Urgent', 'Door Earthing', '', 'D-9', '', '', '13/07/2027']);
    expect(db).toEqual(['Sub Station', 'DB/1: North?', '', '', 0, 0, 0, 11, '0.0%', '', '', '', '', '', '', '13/07/2027']);
  });
  it('Highest Risk ignores a stale risk on a passing item (only FAIL items count)', () => {
    const [, mcc] = swbRegisterRows(project, results, meta);
    expect(mcc.cells[9]).toBe('Medium');                     // the passing Enclosure item retains risk "H" — must not win
  });
});

describe('swbSheetName', () => {
  it('sanitises, keeps <= 31 chars, and de-duplicates (area name first, then a counter); "Register" is reserved', () => {
    const used = new Set();
    expect(swbSheetName({ name: 'MSB' }, { name: 'Wash Plant' }, used)).toBe('MSB');
    expect(swbSheetName({ name: 'MSB' }, { name: 'Wash Plant' }, used)).toBe('MSB (Wash Plant)');
    expect(swbSheetName({ name: 'MSB' }, { name: 'Wash Plant' }, used)).toBe('MSB (Wash Plant) (2)');
    expect(swbSheetName({ name: 'DB/1: North?' }, { name: 'X' }, used)).toBe('DB-1- North-');
    expect(swbSheetName({ name: 'Register' }, { name: 'Sub' }, used)).toBe('Register (Sub)');
    const long = swbSheetName({ name: 'A very long switchboard name that goes on and on' }, { name: 'Area' }, new Set());
    expect(long.length).toBeLessThanOrEqual(31);
  });
});

describe('exportSWBExcel structure', () => {
  it('Register + one sheet per board, in order, with unique valid names', async () => {
    const wb = await build(project, results);
    expect(wb.worksheets.map(w => w.name)).toEqual(['Register', 'MSB', 'MCC 1', 'MSB (Sub Station)', 'DB-1- North-']);
    wb.worksheets.forEach(w => expect(w.name.length).toBeLessThanOrEqual(31));
  });

  it('Register: plain header block, one row per board with the derived values, Pass/Fail cells tinted', async () => {
    const reg = (await build(project, results)).getWorksheet('Register');
    expect(V(reg.getCell('A1'))).toBe('Hearse Road - Firestone — Switchboard / Enclosure Audit');
    expect(V(reg.getCell('A2'))).toBe('Acme Pty Ltd  |  ABN: 99 999  |  Electrical Licence: EW1');
    expect(V(reg.getCell('A3'))).toBe('Auditor: Jane'); expect(V(reg.getCell('C3'))).toBe('Date Tested: 13/07/2026'); expect(V(reg.getCell('E3'))).toBe('Next Audit Due: 13/07/2027');
    expect(SWB_REGISTER_COLUMNS.map((t, i) => V(reg.getCell(5, i + 1)))).toEqual(SWB_REGISTER_COLUMNS);
    expect(V(reg.getCell('D6'))).toBe('Pass'); expect(V(reg.getCell('D8'))).toBe('Fail'); expect(V(reg.getCell('D7'))).toBe('');
    expect(reg.getCell('D6').fill.fgColor.argb).toBe('FFE2EFDA'); expect(reg.getCell('D8').fill.fgColor.argb).toBe('FFFFC7CE');
    expect(V(reg.getCell('I6'))).toBe('100.0%'); expect(V(reg.getCell('I7'))).toBe('10.0%');
    expect(V(reg.getCell('K7'))).toBe('Ventilation'); expect(V(reg.getCell('J8'))).toBe('Urgent');
    expect(Number(reg.getCell('E9').value)).toBe(0); expect(Number(reg.getCell('H9').value)).toBe(11);   // untested board still listed
  });

  it('board sheet: header, Audit Summary with Score, the 11 checklist rows with criteria; defect data ONLY on FAIL rows', async () => {
    const sh = (await build(project, results)).getWorksheet('MCC 1');
    expect(V(sh.getCell('A1'))).toBe('Switchboard / Enclosure Audit');
    expect(V(sh.getCell('A3'))).toBe('Area: Wash Plant'); expect(V(sh.getCell('C3'))).toBe('Board: MCC 1');
    const summary = {}; for (let r = 8; r <= 14; r++) summary[V(sh.getCell(r, 1))] = V(sh.getCell(r, 2));
    expect(summary).toEqual({ 'Total Items': '11', Pass: '1', Fail: '1', 'N/A': '1', Untested: '8', Score: '10.0%', Overall: 'UNTESTED' });
    expect(V(sh.getCell('A16'))).toBe('Item'); expect(V(sh.getCell('G16'))).toBe('Responsibility / Action');
    for (let i = 0; i < 11; i++) expect(V(sh.getCell(17 + i, 1))).toBe(`${i + 1}. ${SWB_CHECKLIST[i].label}`);
    expect(V(sh.getCell('B17'))).toMatch(/structurally sound/);                       // pass criteria text
    // Enclosure (row 17) PASSED but retains a risk / defect id -> blank in the export (a plain comment is not defect data and stays);
    // Ventilation (row 18) FAILED -> defect details shown
    expect([V(sh.getCell('C17')), V(sh.getCell('D17')), V(sh.getCell('E17')), V(sh.getCell('F17'))]).toEqual(['Pass', '', 'old', '']);
    expect([V(sh.getCell('C18')), V(sh.getCell('D18')), V(sh.getCell('E18')), V(sh.getCell('F18')), V(sh.getCell('G18'))]).toEqual(['Fail', 'D-7', 'blocked', 'M', 'Scheduled for Repair | Site Electrician']);
    expect(V(sh.getCell('C19'))).toBe('N/A'); expect(V(sh.getCell('C20'))).toBe('');
    expect(JSON.stringify(sh.getRow(17).values)).not.toMatch(/STALE/);        // the stale defect id never appears
  });

  it('a complete board reads Overall FAIL / PASS on its sheet', async () => {
    const wb = await build(project, results);
    expect(V(wb.getWorksheet('MSB (Sub Station)').getCell('B14'))).toBe('FAIL');
    expect(V(wb.getWorksheet('MSB').getCell('B14'))).toBe('PASS');
    expect(V(wb.getWorksheet('MSB (Sub Station)').getCell('B13'))).toBe('90.9%');
  });

  it('photos land on their OWN board sheet (1:1), one per row, nothing on the Register or other boards', async () => {
    const wb = await build(project, results);
    const count = n => wb.getWorksheet(n).getImages().length;
    expect([count('Register'), count('MSB'), count('MCC 1'), count('MSB (Sub Station)'), count('DB-1- North-')]).toEqual([0, 0, 2, 1, 0]);
    const labels = ws => { const out = []; ws.eachRow(r => out.push(String(r.getCell(1).value || ''))); return out.filter(l => /^Photo \d+$/.test(l)); };
    expect(labels(wb.getWorksheet('MCC 1'))).toEqual(['Photo 1', 'Photo 2']);
    expect(labels(wb.getWorksheet('MSB (Sub Station)'))).toEqual(['Photo 1']);
  });

  it('stray item-level photos from an earlier build are folded onto the board sheet too (nothing dropped)', async () => {
    const proj = { id: 'p', name: 'S', areas: [{ id: 'a', name: 'A', boards: [{ id: 'b', name: 'B' }] }] };
    const wb = await build(proj, { p: { a: { b: { enclosure: { status: 'pass', photos: [{ id: 'x', dataUrl: JPEG_A }] }, _photos: [{ id: 'y', dataUrl: JPEG_B }] } } } });
    expect(wb.getWorksheet('B').getImages()).toHaveLength(2);
  });

  it('a site with no boards still exports a valid Register-only workbook', async () => {
    const wb = await build({ id: 'p', name: 'Empty', areas: [] }, {});
    expect(wb.worksheets.map(w => w.name)).toEqual(['Register']);
  });
});

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import ExcelJS from 'exceljs';
import { exportELTExcel, eltOverall, ELT_COLUMNS, ELT_DEFECT_COLUMNS, migrateProjectToAreas as toAreas, sitePhotoStore, sitePhotoIO } from './App.jsx';
import 'fake-indexeddb/auto'; // ELT's photos now live in IndexedDB (Stage 3, 2026-09-29)

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
// These tests check image COUNT/POSITION/LABELS, never byte content — a single fixed stub is enough, no need to
// differentiate which underlying record produced which copy.
beforeAll(() => { sitePhotoIO.exportCopy = async () => ({ dataUrl: PNG }); });
beforeEach(async () => { await sitePhotoStore.put('ph1', { buf: new Uint8Array([1]).buffer, type: 'image/png' }); await sitePhotoStore.put('ph2', { buf: new Uint8Array([2]).buffer, type: 'image/png' }); await sitePhotoStore.put('x', { buf: new Uint8Array([3]).buffer, type: 'image/png' }); await sitePhotoStore.put('y', { buf: new Uint8Array([4]).buffer, type: 'image/png' }); });
const pass4 = { visual:'pass', discharge:'pass', switching:'pass', charging:'pass', lastTested:'2026-09-21' };

const project = toAreas({
  id: 'p1', name: 'Hearse Road Firestone', company: 'Dixon Quarry Group', abn: '12 345 678 901', licence: 'EW123456',
  assets: [
    { id:'a1', location:'Hearse Road Firestone', assetLocation:'SE Door',  assetId:'EL-001', type:'Emergency Exit Sign', maintained:'Maintained', fitting:'Clevertronics 24m' },
    { id:'a2', location:'Hearse Road Firestone', assetLocation:'SW Roof',  assetId:'',       type:'Combination Unit (Sign + 2 Side Lights)', maintained:'Non-Maintained', fitting:'Clevertronics Twin Spots' },
    { id:'a3', location:'Hearse Road Firestone', assetLocation:'Workshop', assetId:'EL-003', type:'Other', typeOther:'Bunker light', maintained:'Maintained', fitting:'Generic LED' },
    { id:'a4', location:'Hearse Road Firestone', assetLocation:'Store Room', assetId:'EL-004', type:'Emergency Exit Sign', maintained:'Maintained', fitting:'Untested one' },
    { id:'a5', location:'Hearse Road Firestone', assetLocation:'Office', assetId:'EL-005', type:'Emergency Exit Sign', maintained:'Non-Maintained', fitting:'Photo one' },
  ],
});
const results = { p1: {
  a1: { ...pass4, notes:'Working well', rectified:'Stale', defectId:'99', responsibility:'Client', priority:'U', rectifiedDate:'2026-01-01' }, // PASS with RETAINED defect data
  a2: { ...pass4, discharge:'fail', rectified:'Scheduled for Repair', rectifiedDate:'2026-10-01', defectId:'74', responsibility:'Client', priority:'H', notes:'Seal cracked' },
  a3: { ...pass4, visual:'fail', rectified:'Removed from Service', responsibility:'Site Electrician' },
  // a4 left completely untested (no entry)
  a5: { ...pass4, photos:[{id:'ph1',w:1,h:1},{id:'ph2',w:1,h:1}] },
}};
const meta = { auditor:'Jane Auditor', testDate:'2026-09-21', nextTestDate:'2027-03-21' };

let payload;
beforeEach(() => {
  payload = null;
  window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } };
});
afterEach(() => { delete window.webkit; });

async function runExport(proj, res, m) {
  await exportELTExcel(proj, res, m);
  expect(payload).toBeTruthy();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(payload.base64, 'base64'));
  return wb;
}
const text = c => { const v = c.value; return v==null ? '' : (typeof v==='object' && v.richText ? v.richText.map(t=>t.text).join('') : String(v)); };
const rowVals = (ws, r, n=16) => Array.from({length:n},(_,i)=>text(ws.getCell(r,i+1)));

describe('ELT Excel export structure', () => {
  it('writes header block, exact 16 columns (# first, Score after Pass/Fail; defect detail is on the Defects sheet), and only tested fittings', async () => {
    const wb = await runExport(project, results, meta);
    const ws = wb.getWorksheet('Emergency Lighting');
    expect(ws).toBeTruthy();

    // header block
    // shared header (2026-10-02): row 1 = the always-reserved logo row (empty), row 2 = "{Site}  –  {Module}  ({Test type})", row 3 = company, row 4 = auditor / dates
    expect(text(ws.getCell('A1'))).toBe('');
    expect(text(ws.getCell('A2'))).toBe('Hearse Road Firestone  –  Emergency Lighting Test  (AS/NZS 2293.2:2019)');
    const co = text(ws.getCell('A3'));
    expect(co).toContain('Dixon Quarry Group'); expect(co).toContain('12 345 678 901'); expect(co).toContain('EW123456');
    expect(text(ws.getCell('A4'))).toBe('Auditor: Jane Auditor  |  Date Tested: 21/09/2026  |  Next Test Due: 21/03/2027');
    // Rows 1-5 carry no INTENTIONAL fill/font/border styling — never bold, never a fill colour, never a border —
    // same as the real IEL/RCD/TAT/Thermo files. (A cell that has ANY style property set, even just alignment,
    // gets the workbook's plain default font baked in once the file round-trips through a real save/reload — e.g.
    // {name:"Calibri",size:11,...} with no bold/italic/custom colour — which is a metadata artifact of the xlsx
    // format itself, not a visual difference from a truly untouched cell, so it's accepted here too.) Alignment:
    // rows 1-3 are centred (2026-09-30 fix — they used to carry no alignment at all, which meant the wide merged
    // header text rendered flush-left instead of centred); row 4 is a blank spacer no code ever writes to, so it
    // stays fully untouched; row 5 (the headings) carries wrap-text alignment ONLY, so a narrow column can hold a
    // long heading.
    for (let r = 1; r <= 5; r++) for (let c = 1; c <= 16; c++) {
      const cell = ws.getCell(r, c);
      expect(cell.fill === undefined || cell.fill.pattern === 'none', 'fill r'+r+' c'+c).toBe(true);
      expect(!cell.font || (!cell.font.bold && !cell.font.italic), 'font r'+r+' c'+c+' should never be bold/italic').toBe(true);
      expect(!cell.border || Object.keys(cell.border).length === 0, 'border r'+r+' c'+c).toBe(true);
      if (r >= 2 && r <= 4 && c === 1) expect(cell.alignment, 'alignment r'+r).toMatchObject({ horizontal: 'center' });
      else if (r === 1 || r === 5) expect(cell.alignment, 'alignment r'+r+' c'+c).toBeUndefined();   // the logo row and the spacer are never written to
    }
    for (let c = 1; c <= 16; c++) expect(ws.getCell(6, c).alignment).toMatchObject({ wrapText: true });   // the table headings are row 6
    // same merges and row heights as IEL (adjusted for 16 columns). Row 3 (2026-09-30 fix): one full-width merge
    // (was 3 sub-merges).
    const merged = Object.keys(ws._merges).map(k => ws._merges[k].range).sort();
    expect(merged).toEqual(['A1:P1','A2:P2','A3:P3','A4:P4','A5:P5'].sort());   // all five header rows incl. the spacer are merged full width
    expect([1,2,3,4,5,6].map(r => ws.getRow(r).height)).toEqual([45.75,31.5,15.75,15.75,6,43.5]);

    // blank 6pt spacer row 5, then the column headings on row 6; no summary block or sheet
    expect(rowVals(ws, 5).every(v => v === '')).toBe(true);
    expect(wb.getWorksheet('Summary')).toBeUndefined();

    // percentages only in the Score column (col 14) of the data rows; no "pass rate" text and no % anywhere else in either sheet
    wb.eachSheet(sheet => sheet.eachRow((row, rowNo) => row.eachCell((c, colNo) => {
      const isScoreCell = sheet.name === 'Emergency Lighting' && rowNo >= 7 && colNo === 14;
      if (isScoreCell) expect(text(c)).toMatch(/^\d+\.\d%$/); else expect(text(c)).not.toMatch(/%|pass rate/i);
    })));

    // exact column order
    expect(rowVals(ws, 6)).toEqual(ELT_COLUMNS);
    expect(ELT_COLUMNS).toEqual(['#','Location','Asset Location','Asset ID','Type','Maintained/Non-Maintained','Fitting Type/Manufacturer','Date','Visual Inspection','90-Min Discharge Test','Automatic Switching Test','Charging Circuit Test','Pass/Fail','Score','Notes / Recommendations','Next Test Due']);

    // register rows: 4 tested, untested excluded
    const rows = [7,8,9,10].map(r => rowVals(ws, r));
    expect(text(ws.getCell(11,1))).toBe('');
    expect(rows.map(r => r[2])).toEqual(['SE Door','SW Roof','Workshop','Office']);
    expect(rows.map(r => r[0])).toEqual(['1','2','3','4']);                        // the # cross-reference
    expect(rows.some(r => r[2]==='Store Room' || r[6]==='Untested one')).toBe(false);

    // types incl. Other custom text
    expect(rows.map(r => r[4])).toEqual(['Emergency Exit Sign','Combination Unit (Sign + 2 Side Lights)','Bunker light','Emergency Exit Sign']);
    expect(rows[1][3]).toBe(''); // blank asset id preserved

    // dates always come from the report-level defaults
    rows.forEach(r => { expect(r[7]).toBe('21/09/2026'); expect(r[15]).toBe('21/03/2027'); expect(r[13]).toMatch(/^\d+\.\d%$/); });

    // data rows keep real thin borders on all four sides (SWB's swbXAB); headings are plain
    for (const r of [7,8,9,10]) for (let c = 1; c <= 16; c++) {
      const b = ws.getCell(r,c).border || {};
      ['top','bottom','left','right'].forEach(side => expect(b[side] && b[side].style, 'border r'+r+' c'+c+' '+side).toBe('thin'));
    }

    // sub-check + overall cells
    expect(rows[0].slice(8,13)).toEqual(['Pass','Pass','Pass','Pass','Pass']);
    expect(rows[1].slice(8,13)).toEqual(['Pass','Fail','Pass','Pass','Fail']);
    expect(rows[2].slice(8,13)).toEqual(['Fail','Pass','Pass','Pass','Fail']);

    // the main table carries NO defect columns, but Notes stays (pass-row comments matter)
    expect(rows.map(r => r[14])).toEqual(['Working well','Seal cracked','','']);

    // Defects sheet: FAIL fittings only, keyed by the same # (2 = SW Roof, 3 = Workshop); the PASS row's retained defect data is not listed
    const ds = wb.getWorksheet('Defects');
    expect(rowVals(ds, 6, 10)).toEqual(ELT_DEFECT_COLUMNS);
    expect(rowVals(ds, 7, 10)).toEqual(['2','Hearse Road Firestone','SW Roof','','74','H','Scheduled for Repair','01/10/2026','Client','Seal cracked']);
    expect(rowVals(ds, 8, 10)).toEqual(['3','Hearse Road Firestone','Workshop','EL-003','','','Removed from Service','','Site Electrician','']);
    expect(rowVals(ds, 9, 10).every(v => v === '')).toBe(true);            // the blank row between the table and the footer
    // footer (always written): the count COMPUTED from the 2 defect rows, then the priority legend
    expect(text(ds.getCell('A10'))).toBe('Defects recorded: 2');
    expect(text(ds.getCell('A11'))).toBe('Priority: L Low · M Medium · H High · U Urgent');
    expect(wb.worksheets.map(w => w.name)).toEqual(['Emergency Lighting','Defects','Photos']);
  });

  it('does not leak retained pre-standard Failure Reason/Action (or standard defect data) into a passing row', async () => {
    const res = { p1: { a1: { ...pass4, failReason:'Lamp Failure', action:'Repaired On-Site', rectified:'Stale', notes:'ok' } } };
    const wb = await runExport({ ...project, areas:[{ ...project.areas[0], assets:[project.areas[0].assets[0]] }] }, res, meta);
    expect(text(wb.getWorksheet('Emergency Lighting').getCell('O7'))).toBe('ok');
  });
});

describe('ELT Photos sheet', () => {
  it('is present with traceable labels next to each image when photos exist', async () => {
    const wb = await runExport(project, results, meta);
    const ps = wb.getWorksheet('Photos');
    expect(ps).toBeTruthy();
    expect(wb.worksheets.map(w => w.name)).toEqual(['Emergency Lighting','Defects','Photos']);
    expect(rowVals(ps, 6, 4)).toEqual(['Location','Asset Location','Asset ID','Photo']);   // the Photos sheet now has the shared header; headings on row 6
    const images = ps.getImages();
    expect(images).toHaveLength(2);
    // ExcelJS reports the anchor as 0-based row; Excel row = floor(row)+1
    const excelRows = images.map(im => Math.floor(im.range.tl.row) + 1).sort((a,b)=>a-b);
    expect(excelRows).toEqual([7,8]);
    excelRows.forEach(r => {
      expect(rowVals(ps, r, 3)).toEqual(['Hearse Road Firestone','Office','EL-005']);
    });
    // no rows for fittings without photos
    expect(text(ps.getCell(9,2))).toBe('');
  });

  it('is omitted when no fitting has photos', async () => {
    const noPhotos = { p1: { ...results.p1, a5: { ...pass4 } } };
    const wb = await runExport(project, noPhotos, meta);
    expect(wb.getWorksheet('Photos')).toBeUndefined();
    expect(wb.worksheets.map(w => w.name)).toEqual(['Emergency Lighting','Defects']);
  });

  it('exports photos of untested/partly tested fittings (labelled), while keeping them out of the register', async () => {
    const res = { p1: { a4: { photos:[{id:'x',w:1,h:1}] }, a3: { visual:'pass', photos:[{id:'y',w:1,h:1}] } } };
    const wb = await runExport(project, res, meta);
    const ps = wb.getWorksheet('Photos');
    expect(ps).toBeTruthy();
    expect(ps.getImages()).toHaveLength(2);
    expect([7,8].map(r => text(ps.getCell(r,2))).sort()).toEqual(['Store Room','Workshop']);
    const reg = wb.getWorksheet('Emergency Lighting');
    expect(reg.getCell('A7').value == null || text(reg.getCell('A7')) === '').toBe(true); // no register rows
  });
});

describe('overall result state machine', () => {
  const R = o => ({ visual:'', discharge:'', switching:'', charging:'', ...o });
  it('0 of 4 recorded → untested', () => { expect(eltOverall(R({}))).toBe('untested'); });
  it('1–3 recorded, no fails → still untested (no false PASS)', () => {
    expect(eltOverall(R({ visual:'pass' }))).toBe('untested');
    expect(eltOverall(R({ visual:'pass', discharge:'pass' }))).toBe('untested');
    expect(eltOverall(R({ visual:'pass', discharge:'pass', switching:'pass' }))).toBe('untested');
  });
  it('1–3 recorded with a fail → FAIL immediately', () => {
    expect(eltOverall(R({ charging:'fail' }))).toBe('fail');
    expect(eltOverall(R({ visual:'pass', switching:'fail' }))).toBe('fail');
    expect(eltOverall(R({ visual:'pass', discharge:'pass', switching:'fail' }))).toBe('fail');
  });
  it('all 4 pass → PASS; all 4 recorded with a fail → FAIL', () => {
    expect(eltOverall(R(pass4))).toBe('pass');
    expect(eltOverall(R({ ...pass4, discharge:'fail' }))).toBe('fail');
  });
  it('fail → flipped back to pass: overall PASS, fail fields untouched by the derivation', () => {
    const failed = R({ ...pass4, visual:'fail', rectified:'Repaired On-Site', defectId:'7' });
    expect(eltOverall(failed)).toBe('fail');
    const fixed = { ...failed, visual:'pass' };
    expect(eltOverall(fixed)).toBe('pass');
    expect(fixed).toMatchObject({ rectified:'Repaired On-Site', defectId:'7' });
  });
});

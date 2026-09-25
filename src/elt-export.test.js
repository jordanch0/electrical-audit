import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import { exportELTExcel, eltOverall, ELT_COLUMNS, migrateProjectToAreas as toAreas } from './App.jsx';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const pass4 = { visual:'pass', discharge:'pass', switching:'pass', charging:'pass' };

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
  a1: { ...pass4, notes:'Working well' },
  a2: { ...pass4, discharge:'fail', failReason:'Other', failReasonOther:'Water ingress', action:'Given to Site Contact', notes:'Seal cracked' },
  a3: { ...pass4, visual:'fail', failReason:'Lamp Failure', action:'Other', actionOther:'Ordered part' },
  // a4 left completely untested (no entry)
  a5: { ...pass4, photos:[{id:'ph1',dataUrl:PNG},{id:'ph2',dataUrl:PNG}] },
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
const rowVals = (ws, r, n=14) => Array.from({length:n},(_,i)=>text(ws.getCell(r,i+1)));

describe('ELT Excel export structure', () => {
  it('writes header block, exact 14 columns, and only tested fittings', async () => {
    const wb = await runExport(project, results, meta);
    const ws = wb.getWorksheet('Emergency Lighting');
    expect(ws).toBeTruthy();

    // header block
    expect(text(ws.getCell('A1'))).toBe('Hearse Road Firestone — Emergency Lighting Test');
    const co = text(ws.getCell('A2'));
    expect(co).toContain('Dixon Quarry Group'); expect(co).toContain('12 345 678 901'); expect(co).toContain('EW123456');
    expect(text(ws.getCell('A3'))).toBe('Auditor: Jane Auditor');
    expect(text(ws.getCell('C3'))).toBe('Date Tested: 21/09/2026');
    expect(text(ws.getCell('E3'))).toBe('Next Test Due: 21/03/2027');
    // Rows 1-5 carry NO styling (same as the real IEL/RCD/TAT/Thermo files): no fill, font, border or alignment
    for (let r = 1; r <= 5; r++) for (let c = 1; c <= 14; c++) {
      const cell = ws.getCell(r, c);
      expect(cell.fill, 'fill r'+r+' c'+c).toBeUndefined();
      expect(cell.font, 'font r'+r+' c'+c).toBeUndefined();
      expect(cell.border, 'border r'+r+' c'+c).toBeUndefined();
      expect(cell.alignment, 'alignment r'+r+' c'+c).toBeUndefined();
    }
    // same merges and row heights as IEL (adjusted for 14 columns)
    const merged = Object.keys(ws._merges).map(k => ws._merges[k].range).sort();
    expect(merged).toEqual(['A1:N1','A2:N2','A3:B3','A4:N4','C3:D3','E3:N3'].sort());
    expect([1,2,3,4,5].map(r => ws.getRow(r).height)).toEqual([32,16,16,6,40]);

    // blank 6pt spacer row 4, then the column headings on row 5; no summary block or sheet
    expect(rowVals(ws, 4).every(v => v === '')).toBe(true);
    expect(wb.getWorksheet('Summary')).toBeUndefined();

    // no percentage / pass-rate anywhere in either sheet
    wb.eachSheet(sheet => sheet.eachRow(row => row.eachCell(c => {
      expect(text(c)).not.toMatch(/%|pass rate/i);
    })));

    // exact column order
    expect(rowVals(ws, 5)).toEqual(ELT_COLUMNS);
    expect(ELT_COLUMNS).toEqual(['Location','Asset Location','Asset ID','Type','Maintained/Non-Maintained','Fitting Type/Manufacturer','Date','Visual Inspection','90-Min Discharge Test','Automatic Switching Test','Charging Circuit Test','Pass/Fail','Next Test Due','Notes']);

    // register rows: 4 tested, untested excluded
    const rows = [6,7,8,9].map(r => rowVals(ws, r));
    expect(text(ws.getCell(10,1))).toBe('');
    expect(rows.map(r => r[1])).toEqual(['SE Door','SW Roof','Workshop','Office']);
    expect(rows.some(r => r[1]==='Store Room' || r[5]==='Untested one')).toBe(false);

    // types incl. Other custom text
    expect(rows.map(r => r[3])).toEqual(['Emergency Exit Sign','Combination Unit (Sign + 2 Side Lights)','Bunker light','Emergency Exit Sign']);
    expect(rows[1][2]).toBe(''); // blank asset id preserved

    // dates always come from the report-level defaults
    rows.forEach(r => { expect(r[6]).toBe('21/09/2026'); expect(r[12]).toBe('21/03/2027'); });

    // data rows keep real thin borders on all four sides (SWB's swbXAB); headings are plain
    for (const r of [6,7,8,9]) for (let c = 1; c <= 14; c++) {
      const b = ws.getCell(r,c).border || {};
      ['top','bottom','left','right'].forEach(side => expect(b[side] && b[side].style, 'border r'+r+' c'+c+' '+side).toBe('thin'));
    }

    // sub-check + overall cells
    expect(rows[0].slice(7,12)).toEqual(['Pass','Pass','Pass','Pass','Pass']);
    expect(rows[1].slice(7,12)).toEqual(['Pass','Fail','Pass','Pass','Fail']);
    expect(rows[2].slice(7,12)).toEqual(['Fail','Pass','Pass','Pass','Fail']);

    // notes column
    expect(rows[0][13]).toBe('Working well');                                   // PASS: notes only
    expect(rows[1][13]).toBe('Water ingress — Given to Site Contact. Seal cracked'); // Other reason + normal action + notes
    expect(rows[2][13]).toBe('Lamp Failure — Ordered part');                    // normal reason + Other action, no notes
    expect(rows[3][13]).toBe('');                                                // PASS with no notes
  });

  it('does not leak retained Failure Reason/Action into a passing row', async () => {
    const res = { p1: { a1: { ...pass4, failReason:'Lamp Failure', action:'Repaired On-Site', notes:'ok' } } };
    const wb = await runExport({ ...project, areas:[{ ...project.areas[0], assets:[project.areas[0].assets[0]] }] }, res, meta);
    expect(text(wb.getWorksheet('Emergency Lighting').getCell('N6'))).toBe('ok');
  });
});

describe('ELT Photos sheet', () => {
  it('is present with traceable labels next to each image when photos exist', async () => {
    const wb = await runExport(project, results, meta);
    const ps = wb.getWorksheet('Photos');
    expect(ps).toBeTruthy();
    expect(wb.worksheets.map(w => w.name)).toEqual(['Emergency Lighting','Photos']);
    expect(rowVals(ps, 1, 4)).toEqual(['Location','Asset Location','Asset ID','Photo']);
    const images = ps.getImages();
    expect(images).toHaveLength(2);
    // ExcelJS reports the anchor as 0-based row; Excel row = floor(row)+1
    const excelRows = images.map(im => Math.floor(im.range.tl.row) + 1).sort((a,b)=>a-b);
    expect(excelRows).toEqual([2,3]);
    excelRows.forEach(r => {
      expect(rowVals(ps, r, 3)).toEqual(['Hearse Road Firestone','Office','EL-005']);
    });
    // no rows for fittings without photos
    expect(text(ps.getCell(4,2))).toBe('');
  });

  it('is omitted when no fitting has photos', async () => {
    const noPhotos = { p1: { ...results.p1, a5: { ...pass4 } } };
    const wb = await runExport(project, noPhotos, meta);
    expect(wb.getWorksheet('Photos')).toBeUndefined();
    expect(wb.worksheets.map(w => w.name)).toEqual(['Emergency Lighting']);
  });

  it('exports photos of untested/partly tested fittings (labelled), while keeping them out of the register', async () => {
    const res = { p1: { a4: { photos:[{id:'x',dataUrl:PNG}] }, a3: { visual:'pass', photos:[{id:'y',dataUrl:PNG}] } } };
    const wb = await runExport(project, res, meta);
    const ps = wb.getWorksheet('Photos');
    expect(ps).toBeTruthy();
    expect(ps.getImages()).toHaveLength(2);
    expect([2,3].map(r => text(ps.getCell(r,2))).sort()).toEqual(['Store Room','Workshop']);
    const reg = wb.getWorksheet('Emergency Lighting');
    expect(reg.getCell('A6').value == null || text(reg.getCell('A6')) === '').toBe(true); // no register rows
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
    const failed = R({ ...pass4, visual:'fail', failReason:'Other', failReasonOther:'Water ingress', action:'Repaired On-Site' });
    expect(eltOverall(failed)).toBe('fail');
    const fixed = { ...failed, visual:'pass' };
    expect(eltOverall(fixed)).toBe('pass');
    expect(fixed).toMatchObject({ failReason:'Other', failReasonOther:'Water ingress', action:'Repaired On-Site' });
  });
});

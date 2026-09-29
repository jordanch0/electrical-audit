// Every export row that wraps text gets an EXPLICIT height sized from its content (phone viewers do not autofit; merged rows never autofit), and every embedded photo is
// shown at its natural aspect in a row sized from the embedded height — so neither text nor photos are clipped.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { xjFitRows, xjWrapLines, xjImageSize, xjPhotoBox, xjPhotoRowPt, exportSWBExcel, exportWelderExcel, exportELTExcel, exportGSDExcel, gsdPhotoStore, gsdPhotoIO, sitePhotoStore, sitePhotoIO, SWB_CHECKLIST, migrateProjectToAreas } from './App.jsx';
import 'fake-indexeddb/auto';
import { JPEG_A } from './test/jpeg-fixtures.js';

let payload;
beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { delete window.webkit; });
const LONG = 'The lower door hinge is corroded and the latch no longer engages; water staining is visible inside the lower left corner, the earth strap is loose and the cable entry is unsealed. Replace the whole door assembly and re-seal the entry.';
const readWb = async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64')); return wb; };
// a synthetic PNG whose HEADER says w x h (enough for the size reader; the embed does not decode it)
const pngHeader = (w, h) => { const b = Buffer.alloc(24); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]).copy(b); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return 'data:image/png;base64,' + b.toString('base64'); };
// the most OPTIMISTIC line count (Calibri at its narrowest): if even this needs N lines, a row shorter than N lines' height is certainly clipped
const optimisticPt = (text, width, sz = 10) => Math.ceil(String(text).length / (width * 1.5 * (10 / sz))) * sz * 1.1;

describe('xjWrapLines / xjFitRows', () => {
  it('counts wrapped lines: short = 1, long grows with length, newlines count, a single overlong word still breaks', () => {
    expect(xjWrapLines('short', 20)).toBe(1); expect(xjWrapLines('a b c d e f g h i j k l m n o p q r s t u v w x y z', 20)).toBe(3);
    expect(xjWrapLines('one\ntwo\nthree', 50)).toBe(3); expect(xjWrapLines('x'.repeat(95), 30)).toBe(4); expect(xjWrapLines('', 10)).toBe(1);
  });
  it('sets an explicit height from the wrapped text, uses the MERGED width for merged cells, honours bold, never shrinks an existing height, ignores non-wrapped cells', () => {
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('S'); ws.getColumn(1).width = 20; ws.getColumn(2).width = 20; ws.getColumn(3).width = 20;
    const wrap = { wrapText: true, vertical: 'top' };
    ws.getCell('A1').value = LONG; ws.getCell('A1').alignment = wrap; ws.getCell('A1').font = { size: 10 };                                   // narrow: many lines
    ws.getCell('A2').value = LONG; ws.getCell('A2').alignment = wrap; ws.getCell('A2').font = { size: 10 }; ws.mergeCells('A2:C2');             // merged 3 cols: fewer lines
    ws.getCell('A3').value = LONG; ws.getCell('A3').alignment = wrap; ws.getCell('A3').font = { size: 10 }; ws.getRow(3).height = 400;          // already tall: kept
    ws.getCell('A4').value = LONG;                                                                                                              // NOT wrapped: ignored
    ws.getCell('A5').value = 'short'; ws.getCell('A5').alignment = wrap;
    xjFitRows(wb);
    const h1 = ws.getRow(1).height, h2 = ws.getRow(2).height;
    expect(h1).toBeGreaterThan(60); expect(h2).toBeGreaterThan(20); expect(h2).toBeLessThan(h1);                                                 // merged width -> fewer lines
    expect(ws.getRow(3).height).toBe(400); expect(ws.getRow(4).height).toBeUndefined();
    expect(ws.getRow(5).height).toBeUndefined();                                                                                                // one line: the default is enough
  });
});

describe('photo geometry', () => {
  it('reads the size from JPEG and PNG headers; the box keeps the NATURAL aspect (4:3 -> 140x105, portrait -> 105x140, square -> 140x140, unknown -> 4:3), never stretched', () => {
    expect(xjImageSize(JPEG_A)).toEqual({ w: 200, h: 150 }); expect(xjImageSize(pngHeader(60, 120))).toEqual({ w: 60, h: 120 }); expect(xjImageSize('nonsense')).toBeNull();
    expect(xjPhotoBox(JPEG_A)).toEqual({ w: 140, h: 105 }); expect(xjPhotoBox(pngHeader(300, 400))).toEqual({ w: 105, h: 140 }); expect(xjPhotoBox(pngHeader(500, 500))).toEqual({ w: 140, h: 140 }); expect(xjPhotoBox(null)).toEqual({ w: 140, h: 105 });
  });
  it('the row is the embedded height plus a margin (so the image always fits)', () => { expect(xjPhotoRowPt(105)).toBeGreaterThanOrEqual(105 * 0.75 + 12); expect(xjPhotoRowPt(140)).toBeGreaterThan(xjPhotoRowPt(105)); });
});

describe('real exports: long wrapped text is not clipped', () => {
  it('SWB: every board-sheet row with long text (checklist criteria + comments, the merged header rows) has an explicit height at least as tall as even the most optimistic wrap needs', async () => {
    const project = { id: 's1', name: 'Hearse Road - Firestone Quarry Extension Stage Two', company: 'Dixon Quarry Group Pty Ltd', abn: '12 345 678 901', licence: 'EW123456', areas: [{ id: 'ar', name: 'Wash Plant North Side Conveyor Gallery', boards: [{ id: 'b', name: 'MSB 1 — Main Switchboard' }] }] };
    const results = { s1: { ar: { b: Object.fromEntries(SWB_CHECKLIST.map((c, i) => [c.key, { status: i % 2 ? 'fail' : 'pass', comment: LONG, defectId: '12', risk: 'H', rectified: 'Scheduled for Repair', responsibility: 'Site Electrician' }])) } } };
    await exportSWBExcel(project, results, { auditor: 'Jane Auditor', testDate: '2026-09-21', nextTestDate: '2027-09-21' }); const ws = (await readWb()).worksheets[1];
    let checked = 0;
    ws.eachRow(row => row.eachCell(cell => {
      const v = cell.value; if (typeof v !== 'string' || v.length < 60 || !(cell.alignment && cell.alignment.wrapText)) return;
      const w = ws.getColumn(cell.col).width; if (cell.isMerged && cell.master !== cell) return;
      expect(row.height, `row ${row.number}: "${v.slice(0, 30)}…" has no explicit height`).toBeDefined(); expect(row.height, `row ${row.number}`).toBeGreaterThanOrEqual(optimisticPt(v, w)); checked++;
    }));
    expect(checked).toBeGreaterThan(15);                                                                                                        // criteria (11) + comments (11) were really examined
  });
  it('Welder: the long Auditor Comments (a merged row that used to be a fixed 48 pt) grows to fit; per-welder criteria rows are explicit', async () => {
    const project = { id: 'w', name: 'Site W', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Site W', assets: [{ id: 'a1', assetId: 'W001', brand: 'Kemppi', model: 'Minarc Evo', serial: '1' }] }] };
    await exportWelderExcel(project, { w: { a1: { items: {}, notes: (LONG + ' ').repeat(4) } } }, { auditor: 'J', testDate: '2026-09-21' }); const ws = (await readWb()).getWorksheet('W001');
    let notesRow = null; ws.eachRow(r => { if (r.getCell(1).value === 'Auditor Comments / Overall Notes') notesRow = r; });
    expect(notesRow.height).toBeGreaterThan(48); expect(notesRow.height).toBeGreaterThanOrEqual(optimisticPt((LONG + ' ').repeat(4).trim(), 46 + 12 + 30 + 40));
  });
  it('ELT: long notes in the register get an explicit height', async () => {
    const project = migrateProjectToAreas({ id: 'p1', name: 'Site E', company: '', abn: '', licence: '', assets: [{ id: 'a1', location: 'Site E', assetLocation: 'SE Door', assetId: 'EL-1', type: 'Exit Signs', maintained: 'Maintained', fitting: 'X' }] });
    await exportELTExcel(project, { p1: { a1: { visual: 'fail', discharge: 'pass', switching: 'pass', charging: 'pass', notes: LONG, defectId: '4', priority: 'H' } } }, { auditor: 'J', testDate: '2026-09-21' });
    const wb = await readWb(); let found = 0;
    wb.worksheets.forEach(ws => ws.eachRow((row, n) => { if (n < 6) return; row.eachCell(cell => { if (typeof cell.value === 'string' && cell.value.length > 80 && cell.alignment && cell.alignment.wrapText) { expect(row.height, ws.name + ' row ' + n).toBeGreaterThanOrEqual(optimisticPt(cell.value, ws.getColumn(cell.col).width)); found++; } }); }));
    expect(found).toBeGreaterThan(0);
  });
  it('GSD: a long description in the Register (xjSheet) is explicit too', async () => {
    await exportGSDExcel({ id: 's1', name: 'Site G', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant' }] }, [{ id: 'i', areaId: 'a1', assetLocation: 'Pump', category: 'Cabling / Cable Management', commonDefect: '', description: LONG + LONG, descAuto: '', photos: [], priority: 'H', responsibility: 'Site Manager', dueDate: '' }], { auditor: 'J', testDate: '2026-09-21' });
    const ws = (await readWb()).getWorksheet('Register'); let row = null; ws.eachRow((r, n) => { if (n >= 6 && String(r.getCell(5).value).startsWith('The lower door')) row = r; });
    expect(row.height).toBeGreaterThanOrEqual(optimisticPt(LONG + LONG, 46));
  });
});

describe('real exports: photos fit their row at their natural aspect', () => {
  const geometry = async () => {
    const zip = await JSZip.loadAsync(Buffer.from(payload.base64, 'base64')); const out = [];
    for (const dn of Object.keys(zip.files).filter(n => /^xl\/drawings\/drawing\d+\.xml$/.test(n))) {
      const drawing = await zip.file(dn).async('string'); const idx = dn.match(/(\d+)\.xml$/)[1];
      const sheetFile = Object.keys(zip.files).find(n => /^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/.test(n) && true);   // located below by scanning every sheet for the drawing rel
      let sheetXml = null; for (const s of Object.keys(zip.files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))) { const rel = zip.file(s.replace('worksheets/', 'worksheets/_rels/') + '.rels'); if (rel && (await rel.async('string')).includes(`drawing${idx}.xml`)) sheetXml = await zip.file(s).async('string'); }
      for (const m of drawing.matchAll(/<xdr:from><xdr:col>(\d+)<\/xdr:col><xdr:colOff>\d+<\/xdr:colOff><xdr:row>(\d+)<\/xdr:row><xdr:rowOff>(\d+)<\/xdr:rowOff><\/xdr:from><xdr:ext cx="(\d+)" cy="(\d+)"\/>/g)) {
        const row = +m[2] + 1; const ht = +new RegExp(`<row r="${row}"[^>]* ht="([0-9.]+)"`).exec(sheetXml)[1];
        out.push({ wPx: +m[4] / 9525, hPx: +m[5] / 9525, offPx: +m[3] / 9525, rowPx: ht * 96 / 72, ratio: (+m[4]) / (+m[5]) });
      }
    }
    return out;
  };
  const PORTRAIT = pngHeader(300, 400), LANDSCAPE = JPEG_A, SQUARE = pngHeader(500, 500);
  it('SWB board photos: portrait / landscape / square keep their aspect and each row is taller than its image + offset', async () => {
    const project = { id: 's1', name: 'S', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'A', boards: [{ id: 'b', name: 'MSB' }] }] };
    await exportSWBExcel(project, { s1: { a: { b: { enclosure: { status: 'pass' }, _photos: [{ id: '1', dataUrl: PORTRAIT }, { id: '2', dataUrl: LANDSCAPE }, { id: '3', dataUrl: SQUARE }] } } } }, { auditor: 'J', testDate: '2026-09-21' });
    const g = await geometry(); expect(g).toHaveLength(3);
    expect(g.map(x => x.ratio)).toEqual([expect.closeTo(300 / 400, 1), expect.closeTo(4 / 3, 2), expect.closeTo(1, 2)]);           // NOT stretched to one fixed box
    expect(g.map(x => [Math.round(x.wPx), Math.round(x.hPx)])).toEqual([[105, 140], [140, 105], [140, 140]]);
    g.forEach((x, i) => expect(x.rowPx, 'photo ' + i).toBeGreaterThan(x.offPx + x.hPx + 8));                                     // a clear margin: nothing can be cut off
    expect(g[0].rowPx).toBeGreaterThan(g[1].rowPx);                                                                               // the taller portrait photo gets the taller row
  });
  it('Welder photos likewise', async () => {
    // Photos live in sitePhotoStore now (Stage 2, 2026-09-29): the results object carries {id,w,h} pointers, and export
    // resolves each id to an export-sized copy via sitePhotoIO.exportCopy. Stubbed here the same way GSD's own tests stub
    // gsdPhotoIO.exportCopy — jsdom has no real canvas, and exportCopy's real implementation needs one once a photo's actual
    // bytes exceed its 320px maxSide (PORTRAIT's real PNG header is 300x400, over that threshold).
    const project = { id: 'w', name: 'Site W', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Site W', assets: [{ id: 'a1', assetId: 'W1', brand: 'K', model: 'E', serial: '1' }] }] };
    await sitePhotoStore.put('1', { buf: new Uint8Array([1]).buffer, type: 'image/png' });
    await sitePhotoStore.put('2', { buf: new Uint8Array([2]).buffer, type: 'image/jpeg' });
    const origExportCopy = sitePhotoIO.exportCopy;
    sitePhotoIO.exportCopy = async rec => ({ dataUrl: rec.type === 'image/png' ? PORTRAIT : LANDSCAPE });
    try {
      await exportWelderExcel(project, { w: { a1: { items: {}, photos: [{ id: '1', w: 300, h: 400 }, { id: '2', w: 200, h: 150 }] } } }, { auditor: 'J', testDate: '2026-09-21' });
      const g = await geometry(); expect(g).toHaveLength(2); g.forEach(x => expect(x.rowPx).toBeGreaterThan(x.offPx + x.hPx + 8)); expect(Math.round(g[0].hPx)).toBe(140);
    } finally { sitePhotoIO.exportCopy = origExportCopy; }
  });
  it('ELT Photos sheet likewise', async () => {
    // Photos live in sitePhotoStore now (Stage 3, 2026-09-29) — see the Welder test above for why exportCopy is stubbed.
    const project = migrateProjectToAreas({ id: 'p1', name: 'Site E', company: '', abn: '', licence: '', assets: [{ id: 'a1', location: 'Site E', assetLocation: 'SE Door', assetId: 'EL-1', type: 'Exit Signs', maintained: 'Maintained', fitting: 'X' }] });
    await sitePhotoStore.put('1', { buf: new Uint8Array([1]).buffer, type: 'image/png' });
    await sitePhotoStore.put('2', { buf: new Uint8Array([2]).buffer, type: 'image/jpeg' });
    const origExportCopy = sitePhotoIO.exportCopy;
    sitePhotoIO.exportCopy = async rec => ({ dataUrl: rec.type === 'image/png' ? PORTRAIT : LANDSCAPE });
    try {
      await exportELTExcel(project, { p1: { a1: { visual: 'pass', discharge: 'pass', switching: 'pass', charging: 'pass', photos: [{ id: '1', w: 300, h: 400 }, { id: '2', w: 200, h: 150 }] } } }, { auditor: 'J', testDate: '2026-09-21' });
      const g = await geometry(); expect(g).toHaveLength(2); g.forEach(x => expect(x.rowPx).toBeGreaterThan(x.offPx + x.hPx + 8)); expect(Math.round(g[0].wPx)).toBe(105);
    } finally { sitePhotoIO.exportCopy = origExportCopy; }
  });
});

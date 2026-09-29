// Byte-level checks that photos survive the SWB and ELT exports intact and are sized/placed correctly.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import JSZip from 'jszip';
import crypto from 'crypto';
import { exportSWBExcel, exportELTExcel, migrateProjectToAreas as toAreas, sitePhotoStore, sitePhotoIO } from './App.jsx';
import { JPEG_A, JPEG_B } from './test/jpeg-fixtures.js';
import 'fake-indexeddb/auto'; // ELT's photos now live in IndexedDB (Stage 3, 2026-09-29)

const EMU = 9525; // EMU per pixel
const bytes = url => Buffer.from(url.split(',')[1], 'base64');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
let payload;
beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { delete window.webkit; });

async function unzipExport(exportFn, ...args) {
  await exportFn(...args);
  return JSZip.loadAsync(Buffer.from(payload.base64, 'base64'));
}
async function inspect(zip, sheetFile) {
  const media = {};
  for (const name of Object.keys(zip.files).filter(n => n.startsWith('xl/media/') && !zip.files[n].dir)) media[name] = await zip.file(name).async('nodebuffer');
  const drawing = await zip.file('xl/drawings/drawing1.xml').async('string');
  const rels = await zip.file('xl/drawings/_rels/drawing1.xml.rels').async('string');
  const sheet = await zip.file(sheetFile).async('string');
  const anchors = [...drawing.matchAll(/<xdr:from><xdr:col>(\d+)<\/xdr:col><xdr:colOff>(\d+)<\/xdr:colOff><xdr:row>(\d+)<\/xdr:row><xdr:rowOff>(\d+)<\/xdr:rowOff><\/xdr:from><xdr:ext cx="(\d+)" cy="(\d+)"\/>.*?r:embed="(rId\d+)"/gs)]
    .map(m => ({ col:+m[1], row:+m[3], rowOff:+m[4], cx:+m[5], cy:+m[6], rid:m[7] }));
  const target = rid => 'xl/media/' + new RegExp(`Id="${rid}"[^>]*Target="\.\./media/([^"]+)"`).exec(rels)[1];
  const rowHeightPt = r => +new RegExp(`<row r="${r}"[^>]* ht="([0-9.]+)"`).exec(sheet)[1];
  return { media, anchors, target, rowHeightPt };
}
function checkPhotos({ media, anchors, target, rowHeightPt }, sources) {
  expect(anchors).toHaveLength(sources.length);
  anchors.forEach((a, i) => {
    // pixel-identical to the source photo (no re-encode, no corruption), and mapped to the right position
    expect(sha(media[target(a.rid)]), 'photo ' + i).toBe(sha(bytes(sources[i])));
    // exact 4:3 box, so a 4:3 photo is not stretched
    expect(a.cx / a.cy).toBeCloseTo(4 / 3, 5);
    expect(a.cx).toBe(140 * EMU); expect(a.cy).toBe(105 * EMU);
    // image (top offset + height) fits inside its row
    const rowPx = rowHeightPt(a.row + 1) * 96 / 72;
    expect((a.rowOff + a.cy) / EMU, 'row ' + (a.row + 1)).toBeLessThan(rowPx);
  });
}

describe('photos in exports', () => {
  it('SWB: bytes identical, 4:3, fits its row, one photo per row on the board sheet', async () => {
    const project = { id:'s1', name:'S', company:'C', areas:[{ id:'a', name:'A', boards:[{ id:'b', name:'MSB' }] }] };
    const zip = await unzipExport(exportSWBExcel, project, { s1:{ a:{ b:{ enclosure:{status:'pass'}, _photos:[{id:'1',dataUrl:JPEG_A},{id:'2',dataUrl:JPEG_B}] } } } }, { auditor:'J', testDate:'2026-09-21' });
    const info = await inspect(zip, 'xl/worksheets/sheet2.xml');   // sheet1 = Register, sheet2 = the MSB board sheet
    checkPhotos(info, [JPEG_A, JPEG_B]);
    expect(info.anchors.every(a => a.col === 1)).toBe(true);     // column B, like Welder's per-welder sheets
    expect(info.anchors[1].row).toBe(info.anchors[0].row + 1);   // one photo per row
  });

  it('ELT: bytes identical, 4:3, fits its row, each photo on its own labelled row', async () => {
    // Photos live in sitePhotoStore now (Stage 3, 2026-09-29): the results object carries {id,w,h} pointers, and export
    // resolves each id via sitePhotoIO.exportCopy — stubbed here to hand back the ORIGINAL bytes unchanged (both source
    // photos are already <= 320px, so the real exportCopy would do the same, but jsdom has no real canvas to prove it with).
    const pass4 = { visual:'pass', discharge:'pass', switching:'pass', charging:'pass' };
    const project = toAreas({ id:'e1', name:'E', company:'C', assets:[
      { id:'a1', location:'E', assetLocation:'SE Door', assetId:'EL-1', type:'Emergency Exit Sign', maintained:'Maintained', fitting:'X' },
      { id:'a2', location:'E', assetLocation:'SW Roof', assetId:'EL-2', type:'Emergency Exit Sign', maintained:'Maintained', fitting:'Y' },
    ]});
    await sitePhotoStore.put('1', { buf: new Uint8Array([1]).buffer, type: 'image/jpeg' });
    await sitePhotoStore.put('2', { buf: new Uint8Array([2]).buffer, type: 'image/jpeg' });
    const origExportCopy = sitePhotoIO.exportCopy;
    sitePhotoIO.exportCopy = async rec => ({ dataUrl: new Uint8Array(rec.buf)[0] === 1 ? JPEG_A : JPEG_B });
    try {
      const zip = await unzipExport(exportELTExcel, project, { e1:{ a1:{ ...pass4, photos:[{id:'1',w:200,h:150}] }, a2:{ ...pass4, photos:[{id:'2',w:200,h:150}] } } }, { auditor:'J', testDate:'2026-09-21', nextTestDate:'2027-03-21' });
      const info = await inspect(zip, 'xl/worksheets/sheet3.xml'); // sheet1 = register, sheet2 = Defects, sheet3 = Photos
      checkPhotos(info, [JPEG_A, JPEG_B]);
      expect(info.anchors.map(a => a.row)).toEqual([1, 2]); // rows 2 and 3, one photo per row
      expect(info.anchors.every(a => a.col === 3)).toBe(true);
    } finally { sitePhotoIO.exportCopy = origExportCopy; }
  });
});

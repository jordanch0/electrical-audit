// Byte-level checks that photos survive the SWB and ELT exports intact and are sized/placed correctly.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import JSZip from 'jszip';
import crypto from 'crypto';
import { exportSWBExcel, exportELTExcel } from './App.jsx';
import { JPEG_A, JPEG_B } from './test/jpeg-fixtures.js';

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
  it('SWB: bytes identical, 4:3, fits its row', async () => {
    const project = { id:'s1', name:'S', company:'C', areas:[{ id:'a', name:'A', boards:[{ id:'b', name:'MSB' }] }] };
    const zip = await unzipExport(exportSWBExcel, project, { s1:{ a:{ b:{ enclosure:{status:'pass'}, _photos:[{id:'1',dataUrl:JPEG_A},{id:'2',dataUrl:JPEG_B}] } } } }, { auditor:'J', testDate:'2026-09-21' });
    const info = await inspect(zip, 'xl/worksheets/sheet1.xml');
    checkPhotos(info, [JPEG_A, JPEG_B]);
    expect(info.anchors[0].col).toBe(0); expect(info.anchors[1].col).toBe(2); // side by side, same row
    expect(info.anchors[0].row).toBe(info.anchors[1].row);
  });

  it('ELT: bytes identical, 4:3, fits its row, each photo on its own labelled row', async () => {
    const pass4 = { visual:'pass', discharge:'pass', switching:'pass', charging:'pass' };
    const project = { id:'e1', name:'E', company:'C', assets:[
      { id:'a1', location:'E', assetLocation:'SE Door', assetId:'EL-1', type:'Emergency Exit Sign', maintained:'Maintained', fitting:'X' },
      { id:'a2', location:'E', assetLocation:'SW Roof', assetId:'EL-2', type:'Emergency Exit Sign', maintained:'Maintained', fitting:'Y' },
    ]};
    const zip = await unzipExport(exportELTExcel, project, { e1:{ a1:{ ...pass4, photos:[{id:'1',dataUrl:JPEG_A}] }, a2:{ ...pass4, photos:[{id:'2',dataUrl:JPEG_B}] } } }, { auditor:'J', testDate:'2026-09-21', nextTestDate:'2027-03-21' });
    const info = await inspect(zip, 'xl/worksheets/sheet2.xml'); // sheet2 = Photos
    checkPhotos(info, [JPEG_A, JPEG_B]);
    expect(info.anchors.map(a => a.row)).toEqual([1, 2]); // rows 2 and 3, one photo per row
    expect(info.anchors.every(a => a.col === 3)).toBe(true);
  });
});

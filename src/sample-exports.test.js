// OPT-IN sample generator (skipped unless GEN_OUT is set). Writes realistic 60-row exports of every print-optimised module to disk so the
// page fit / layout can be checked by eye in Excel or Google Sheets:
//   GEN_OUT=./sample-exports npx vitest run src/sample-exports.test.js
import { it as _it, beforeEach, afterEach } from 'vitest';
const it = process.env.GEN_OUT ? _it : _it.skip;
import fs from 'fs';
import { exportExcel, exportIELExcel, exportTATExcel, exportThermoExcel, exportIRTExcel, exportELTExcel, migrateProjectToAreas } from './App.jsx';

const OUT = process.env.GEN_OUT;
let payload;
beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { delete window.webkit; });
const save = name => { if (!payload) throw new Error('no payload ' + name); fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(`${OUT}/${name}.xlsx`, Buffer.from(payload.base64, 'base64')); payload = null; };
const meta = { machine: 'Rigel 288 (S/N 4471), cal. due 03/2027', auditor: 'Jane Auditor', testDate: '2026-09-21', nextTestDate: '2027-09-21', pushDate: '2026-09-21', injectDate: '2026-09-21' };
const N = 60;
const range = n => Array.from({ length: n }, (_, i) => i);
const isFail = i => i % 9 === 4;
const fd = i => ({ defectId: String(100 + i), rectified: 'Scheduled for Repair', rectifiedDate: '2026-10-05', scheduledDate: '2026-10-05', responsibility: 'Site Electrician', priority: 'H' });

it('RCD push + injection', async () => {
  const circuits = range(N).map(i => 'C' + (i + 1));
  const project = { id: 'p', name: 'Hearse Road Firestone', company: 'Dixon Quarry Group', abn: '12 345 678 901', licence: 'EW123456', areas: [
    { id: 'a1', name: 'Wash Plant', panels: [{ id: 'pn1', name: 'MSB 1', circuits: circuits.slice(0, 30), circuitMeta: {} }] },
    { id: 'a2', name: 'Crusher', panels: [{ id: 'pn2', name: 'MCC 2', circuits: circuits.slice(30), circuitMeta: {} }] }] };
  const res = { p: { a1: { pn1: {} }, a2: { pn2: {} } } };
  circuits.forEach((c, i) => { const pn = i < 30 ? ['a1', 'pn1'] : ['a2', 'pn2']; res.p[pn[0]][pn[1]][c] = {
    push: isFail(i) ? { status: 'fail', comment: 'Tripped late', ...fd(i) } : i % 13 === 7 ? { status: 'na' } : i % 17 === 3 ? { status: 'untested' } : { status: 'pass', comment: i % 5 === 0 ? 'ok' : '' },
    inject: isFail(i) ? { status: 'fail', resultPos: '>300', resultNeg: '25', comment: 'Slow', ...fd(i) } : i % 13 === 7 ? { status: 'na' } : i % 17 === 3 ? { status: 'untested' } : { status: 'pass', resultPos: '12', resultNeg: '14', comment: '' } }; });
  await exportExcel(res, project, meta, 'push', null); save('rcd-push');
  await exportExcel(res, project, meta, 'inject', null); save('rcd-inject');
});

it('IEL', async () => {
  const ids = range(N).map(i => 'm' + i);
  const project = { id: 'p', name: 'Hearse Road Firestone', company: 'Dixon Quarry Group', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Wash Plant', panels: [{ id: 'p1', name: 'estops', circuits: ids, machineNames: Object.fromEntries(ids.map((x, i) => [x, 'Conveyor ' + (i + 1)])) }] }] };
  const results = { a: { estops: Object.fromEntries(ids.map((x, i) => [x, isFail(i) ? { lastTested: '2026-09-21', status: 'fail', notes: 'Lanyard frayed', ...fd(i) } : i % 13 === 7 ? { lastTested: '2026-09-21', status: 'na' } : i % 17 === 3 ? { lastTested: '2026-09-21', status: 'untested' } : { lastTested: '2026-09-21', status: 'pass', notes: i % 5 === 0 ? 'ok' : '' }])) } };
  await exportIELExcel(project, results, meta); save('iel');
});

it('TAT', async () => {
  const ids = range(N).map(i => 'x' + i);
  const project = { id: 'p', name: 'Hearse Road Firestone', company: 'Dixon Quarry Group', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Workshop', defaultFreq: '3', items: ids, itemNames: Object.fromEntries(ids.map((x, i) => [x, 'Angle grinder ' + (i + 1)])), itemTags: Object.fromEntries(ids.map((x, i) => [x, 'TAG' + (1000 + i)])), itemEquipTypes: {}, itemFreqs: Object.fromEntries(ids.map((x, i) => [x, ['3', '1', '6', '12', '2'][i % 5]])) }] };
  const results = { a: Object.fromEntries(ids.map((x, i) => [x, isFail(i) ? { lastTested: '2026-09-21', status: 'fail', visualCheck: i % 2 === 0, electricalCheck: 'fail', notes: 'Damaged lead', ...fd(i) } : i % 13 === 7 ? { lastTested: '2026-09-21', status: 'na' } : i % 17 === 3 ? { lastTested: '2026-09-21', status: 'untested' } : { lastTested: '2026-09-21', status: 'pass', visualCheck: true, electricalCheck: i % 7 === 0 ? '' : 'pass', notes: i % 5 === 0 ? 'ok' : '' }])) };
  await exportTATExcel(project, results, meta); save('tat');
});

it('Thermo', async () => {
  const ids = range(N).map(i => 'c' + i);
  const project = { id: 'p', name: 'Hearse Road Firestone', company: 'Dixon Quarry Group', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Wash Plant', boards: [{ id: 'b', name: 'MSB 1', circuits: ids, circuitNames: Object.fromEntries(ids.map((x, i) => [x, 'Circuit ' + (i + 1)])) }] }] };
  const results = { a: { b: Object.fromEntries(ids.map((x, i) => [x, [{ id: 'ph' + i, flirFile: String(1000 + i), temp: '45', result: isFail(i) ? 'FAIL' : i % 11 === 6 ? 'MONITOR' : 'PASS', notes: i % 5 === 0 ? 'ok' : '', rectifiedDate: '', ...(isFail(i) || i % 11 === 6 ? fd(i) : {}) }]])) } };
  await exportThermoExcel(project, results, meta); save('thermo');
});

it('IRT', async () => {
  const ids = range(N).map(i => 'x' + i);
  const project = { id: 'p', name: 'Hearse Road Firestone', company: 'Dixon Quarry Group', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Plant Room', panels: [{ id: 'pn', name: 'MCC1', items: ids, itemNames: Object.fromEntries(ids.map((x, i) => [x, 'Motor ' + (i + 1)])) }] }] };
  const results = { p: { a: { pn: Object.fromEntries(ids.map((x, i) => [x, isFail(i)
    ? { status: 'untested', testVoltage: '500V', readings: { L1E: '0.4', L2E: '250', L3E: '250', NE: '300' }, notes: 'Wet', ...fd(i) }
    : i % 17 === 3 ? { status: 'untested', testVoltage: '500V', readings: {}, notes: '' } : { status: 'untested', testVoltage: '500V', readings: { L1E: '>200', L2E: '>200', L3E: '>200', NE: '>200', L1L2: '>200', L1L3: '>200', L2L3: '>200', L1N: '>200', L2N: '>200', L3N: '>200' }, notes: i % 5 === 0 ? 'ok' : '' }])) } } };
  await exportIRTExcel(project, results, meta); save('irt');
});

it('ELT', async () => {
  const assets = range(N).map(i => ({ id: 'a' + i, location: i < 30 ? 'Wash Plant' : 'Crusher', assetLocation: 'Door ' + (i + 1), assetId: 'EL-' + (100 + i), type: 'Exit Signs', maintained: 'Maintained', fitting: 'Clevertronics 24m' }));
  const project = migrateProjectToAreas({ id: 'p1', name: 'Hearse Road Firestone', company: 'Dixon Quarry Group', abn: '1', licence: 'L', assets });
  const pass4 = { visual: 'pass', discharge: 'pass', switching: 'pass', charging: 'pass' };
  const results = { p1: Object.fromEntries(assets.map((a, i) => [a.id, isFail(i) ? { ...pass4, discharge: 'fail', notes: 'Battery flat', ...fd(i) } : { ...pass4, notes: i % 5 === 0 ? 'ok' : '' }])) };
  await exportELTExcel(project, results, meta); save('elt');
});

// ── General Site Defects: a realistic visit (real PNG "photos" of the right sizes, so the layout can be judged by eye) ──
import 'fake-indexeddb/auto';
import zlib from 'zlib';
import { exportGSDExcel, gsdPhotoIO, gsdPhotoStore } from './App.jsx';
const crc = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const png = (w, h, seed) => {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = Math.min(255, 70 + (seed * 37) % 100 + x * 80 / w); raw[o + 1] = Math.min(255, 90 + (seed * 21) % 90 + y * 70 / h); raw[o + 2] = 60 + (seed * 53) % 120; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
};
it('General Site Defects (photo report + Register)', async () => {
  const dims = [[300, 400], [400, 300], [300, 400], [500, 500]];
  const area = (id, name) => ({ id, name });
  const project = { id: 'g', name: 'Hearse Road Firestone', company: 'Dixon Quarry Group', abn: '12 345 678 901', licence: 'EW123456', areas: [area('a1', 'Concrete Plant'), area('a2', 'Workshop'), area('a3', 'Trig Plant'), area('a4', 'Pit 4 CDE Plant')] };
  const text = [['Fix cabling from isolator on pit pump control board', 'Cabling / Conduit (general)', 'H'], ['Junction box to be remounted on concrete tank', 'Mechanical / Equipment', 'M'], ['Replace light fitting above chute', 'General Lighting (non-emergency)', 'L'],
    ['Reinstall cable protection for cable going to compressor. The existing protection was removed during the last shutdown and never refitted, and the cable is now rubbing on the steel frame where it passes the walkway.', 'Cabling / Conduit (general)', 'U'], ['Weatherproof door missing on outlet', 'Housekeeping', 'M'],
    ['Cables dangling beside hopper', 'Cabling / Conduit (general)', 'H'], ['Hopper ramp - fix cabling leading to pole', 'Structural / Building', 'M'], ['Guard missing on tail pulley', 'Guarding', 'H'], ['Install rain hat to avoid mechanical damage', 'Mechanical / Equipment', 'L'], ['Enclosure at top of radial stack should be replaced', 'Structural / Building', ''], ['Blocked walkway at screen deck', 'Access / Egress', 'M'], ['Oil spill under pump', 'Housekeeping', 'L']];
  const items = text.map(([d, cat, pri], i) => ({ id: 'd' + i, areaId: ['a1', 'a1', 'a1', 'a1', 'a2', 'a3', 'a3', 'a3', 'a4', 'a4', 'a4', 'a4'][i], assetLocation: ['Pit pump', 'Concrete tank', 'Chute', 'Compressor', 'Bay 2', 'Hopper', 'Ramp', 'Tail pulley', 'Isolator AC feed', 'Radial stack', 'Screen deck', 'Pump 2'][i], category: cat, commonDefect: '', description: d, descAuto: '', priority: pri, responsibility: 'Site Manager', dueDate: i % 3 === 0 ? '2026-11-30' : '',
    photos: Array.from({ length: [1, 2, 1, 7, 1, 2, 1, 1, 2, 1, 3, 1][i] }, (_, k) => ({ id: `d${i}p${k}`, w: dims[(i + k) % 4][0], h: dims[(i + k) % 4][1] })) }));
  let seed = 0;
  for (const it of items) for (const p of it.photos) await gsdPhotoStore.put(p.id, { buf: new Uint8Array([p.w >> 8, p.w & 255, p.h >> 8, p.h & 255]).buffer, type: 'image/png' });
  const orig = gsdPhotoIO.exportCopy;
  gsdPhotoIO.exportCopy = async rec => { const u = new Uint8Array(rec.buf); return { dataUrl: png((u[0] << 8 | u[1]) / 2, (u[2] << 8 | u[3]) / 2, seed++) }; };
  try { await exportGSDExcel(project, items, meta); save('gsd-site-defects'); } finally { gsdPhotoIO.exportCopy = orig; }
});

// EXPORT FILE NAMES (release p). FICTIONAL names. Every export file name goes through ONE helper (exportSafeName + exportFileName, next to deliverExportFile), so the order and the date part are the same in all nine
// modules and a typed site name can never put a slash, a colon, a quote, a hidden-file dot, an empty name or a very long name into a file name. The five letter-s slips (replace of /s+/ instead of /\s+/) are gone with it.
// 1) the helper table, 2) every module's DELIVERED name (the real export, read from the delivered payload) for two realistic names, 3) the "s" guard, 4) a source scan so a future tenth module cannot bring the slip back.
import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import { exportExcel, exportIELExcel, exportTATExcel, exportThermoExcel, exportSWBExcel, exportIRTExcel, exportELTExcel, exportWelderExcel, exportGSDExcel, migrateProjectToAreas,
  sitePhotoIO, gsdPhotoIO, exportSafeName, exportFileName } from './App.jsx';

vi.setConfig({ testTimeout: 30000 });

describe('exportSafeName: the part of a file name that comes from a typed name', () => {
  const LONG = 'Westfield Distribution Centre Building 4 Mezzanine Plant Room A (backup 12 Oct 2026)';
  it.each([
    ['Plant Rooms', 'Plant_Rooms'],
    ['Ross & Sons (East)', 'Ross_&_Sons_(East)'],                       // & ( ) are kept
    ['A/B Switchboard', 'A-B_Switchboard'],
    ["Smith's Yard: Bay 3?", "Smith's_Yard-_Bay_3"],                    // the apostrophe is kept; a trailing "?" becomes "-" and is stripped
    ['Boat Shed "North" <2>', 'Boat_Shed_-North-_-2'],
    ['a\\b', 'a-b'], ['a|b', 'a-b'], ['a*b', 'a-b'], ['a:b', 'a-b'],    // each Windows-reserved character
    ['a/\\:*?"<>|b', 'a-b'],                                            // a whole run of them is ONE hyphen
    ['  .hidden site  ', 'hidden_site'],                                // no leading dot (a hidden file), no edge spaces
    ['...', 'Site'], ['. . .', 'Site'], ['---', 'Site'], ['___', 'Site'], // only dots / hyphens / underscores: nothing left, the fallback
    ['', 'Site'], ['   ', 'Site'], [null, 'Site'], [undefined, 'Site'],
    ['Plant\u0000Room\u001f1\u007f', 'Plant_Room_1'],                    // control characters become spaces, then one underscore
    ['Plant   Room\t\tA', 'Plant_Room_A'],                               // whitespace runs
    ['Plant__Room', 'Plant_Room'], ['Plant___Room', 'Plant_Room'],       // names that already hold underscores: repeats collapse
    ['Plant-Room', 'Plant-Room'], ['Plant--Room', 'Plant--Room'],        // names that already hold hyphens are left alone
    ['Plant_-_Room', 'Plant_-_Room'],
    ['Room 4.', 'Room_4'],                                              // no trailing dot (Windows refuses it)
    ['Café Depot', 'Café_Depot'], ['Café Depot', 'Café_Depot'],   // NFC: the two spellings of e-acute give the same name
  ])('%j gives %j', (name, expected) => { expect(exportSafeName(name)).toBe(expected); });

  it('a 200-character name is cut at 50 characters and does not end in a separator', () => {
    const name = ('Plant Room ' + 'A'.repeat(20) + ' ').repeat(8); const out = exportSafeName(name);
    expect(Array.from(out).length).toBeLessThanOrEqual(50); expect(out.length).toBeGreaterThan(40); expect(out).not.toMatch(/[\s._-]$/);
    expect(Array.from(exportSafeName('x'.repeat(200))).length).toBe(50);
    expect(Array.from(exportSafeName(LONG)).length).toBeLessThanOrEqual(50);
  });
  it('the cut is by code point: an emoji at the cut is whole or gone, never half', () => {
    const rocket = '🚀'; const name = 'x'.repeat(49) + rocket + 'tail'; const out = exportSafeName(name);
    expect(out).toBe('x'.repeat(49) + rocket); expect(Array.from(out).length).toBe(50); expect(out).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);   // no lone high surrogate
    const name2 = 'x'.repeat(50) + rocket; expect(exportSafeName(name2)).toBe('x'.repeat(50));
    expect(exportSafeName('Café ' + rocket + ' Depot')).toBe('Café_' + rocket + '_Depot');
  });
  it('the fallback and the cap are parameters', () => { expect(exportSafeName('', 'export')).toBe('export'); expect(exportSafeName('abcdef', 'Site', 3)).toBe('abc'); expect(exportSafeName('ab cd', 'Site', 3)).toBe('ab'); });
  it('numbers and other non-strings do not throw', () => { expect(exportSafeName(1234)).toBe('1234'); expect(exportSafeName({})).toBe('[object_Object]'); });
});

describe('exportFileName: ONE builder for the whole name', () => {
  it('the order is head, site, tail, date, then .xlsx; an empty part is left out', () => {
    expect(exportFileName('IEL', 'Plant Rooms', '', '2026-10-20')).toBe('IEL_Plant_Rooms_2026-10-20.xlsx');
    expect(exportFileName('IEL', 'Ross & Sons (East)', '', '2026-10-20')).toBe('IEL_Ross_&_Sons_(East)_2026-10-20.xlsx');
    expect(exportFileName('IEL', 'A/B Switchboard', '', '2026-10-20')).toBe('IEL_A-B_Switchboard_2026-10-20.xlsx');
    expect(exportFileName('', 'Plant Rooms', 'RCD_Push', '2026-10-20')).toBe('Plant_Rooms_RCD_Push_2026-10-20.xlsx');       // RCD: the site name comes first
    expect(exportFileName('', '', 'RCD_Push', '2026-10-20')).toBe('Site_RCD_Push_2026-10-20.xlsx');                          // RCD gets the fallback too
    expect(exportFileName('IR_Test', 'Plant Rooms', '', '2026-10-20')).toBe('IR_Test_Plant_Rooms_2026-10-20.xlsx');
    expect(exportFileName('Site_Defects', 'Plant Rooms', '', '2026-10-20')).toBe('Site_Defects_Plant_Rooms_2026-10-20.xlsx');
  });
  it('no date gives "export"; a date is cleaned like a name', () => {
    expect(exportFileName('IEL', 'Plant Rooms', '', '')).toBe('IEL_Plant_Rooms_export.xlsx'); expect(exportFileName('IEL', 'Plant Rooms', '', undefined)).toBe('IEL_Plant_Rooms_export.xlsx');
    expect(exportFileName('IEL', 'Plant Rooms', '', '20/10/2026')).toBe('IEL_Plant_Rooms_20-10-2026.xlsx');                 // a slash can never come in through the date either
  });
  it('the letter s of "Plant Rooms" survives (the old slip replaced every run of the letter s)', () => {
    const n = exportFileName('IEL', 'Plant Rooms', '', '2026-10-20'); expect(n).toContain('Plant_Rooms'); expect(n).not.toContain('Plant Room_'); expect(n).not.toMatch(/Room_\./);
    expect(exportSafeName('Mississippi Sites')).toBe('Mississippi_Sites');
  });
});

// ---- the real exports, read from the delivered payload ----
let payload;
beforeAll(() => { sitePhotoIO.imageSize = async () => ({ w: 4, h: 3 }); sitePhotoIO.thumbFromDataUrl = async u => u; sitePhotoIO.exportCopy = async () => ({ dataUrl: 'data:image/png;base64,AAAA' }); gsdPhotoIO.exportCopy = sitePhotoIO.exportCopy; });
beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { delete window.webkit; });
const co = { company: 'Example Electrical Pty Ltd', abn: '98 765 432 109', licence: 'EW123456' };
const meta = { auditor: 'Jane Auditor', testDate: '2026-09-30', nextTestDate: '2027-09-30', pushDate: '2026-09-30', injectDate: '2026-09-30', nextPushDate: '2026-10-30', nextInjectDate: '2027-09-30' };
const D = '2026-09-30';
// one case per export: how to run it for a given site name, and the name it must deliver (name already cleaned by the helper)
const CASES = [
  { id: 'rcd-push',   head: '', tail: 'RCD_Push', run: (pid, name) => exportExcel({ [pid]: { a: { pn: { C1: { push: { status: 'pass' } } } } } }, { id: pid, name, ...co, areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'pn', name: 'MSB', circuits: ['C1'], circuitMeta: {} }] }] }, meta, 'push', null) },
  { id: 'rcd-inject', head: '', tail: 'RCD_Injection', run: (pid, name) => exportExcel({ [pid]: { a: { pn: { C1: { inject: { status: 'pass', resultPos: '10', resultNeg: '11' } } } } } }, { id: pid, name, ...co, areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'pn', name: 'MSB', circuits: ['C1'], circuitMeta: {} }] }] }, meta, 'inject', null) },
  { id: 'iel', head: 'IEL', tail: '', run: (pid, name) => exportIELExcel({ id: pid, name, ...co, areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'p1', name: 'estops', circuits: ['x'], machineNames: { x: 'Conv 1' } }] }] }, { a: { estops: { x: { status: 'pass', lastTested: D } } } }, meta) },
  { id: 'tat', head: 'TAT', tail: '', run: (pid, name) => exportTATExcel({ id: pid, name, ...co, areas: [{ id: 'a', name: 'Workshop', defaultFreq: '3', items: ['x'], itemNames: { x: 'Grinder' }, itemTags: { x: 'T1' }, itemEquipTypes: {}, itemFreqs: { x: '3' } }] }, { a: { x: { status: 'pass', lastTested: D } } }, meta) },
  { id: 'thermo', head: 'Thermo', tail: '', run: (pid, name) => exportThermoExcel({ id: pid, name, ...co, areas: [{ id: 'a', name: 'Plant', boards: [{ id: 'b', name: 'MSB', circuits: ['c1'], circuitNames: { c1: 'One' } }] }] }, {}, meta) },
  { id: 'swb', head: 'SWB', tail: '', run: (pid, name) => exportSWBExcel({ id: pid, name, ...co, areas: [{ id: 'ar', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] }, {}, meta) },
  { id: 'irt', head: 'IR_Test', tail: '', run: (pid, name) => exportIRTExcel({ id: pid, name, ...co, areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'pn', name: 'MCC1', items: ['x'], itemNames: { x: 'Motor 1' } }] }] }, {}, meta) },
  { id: 'elt', head: 'ELT', tail: '', run: (pid, name) => exportELTExcel(migrateProjectToAreas({ id: pid, name, ...co, assets: [{ id: 'a1', location: 'Example Site', assetLocation: 'North Door', assetId: 'EL-1', type: 'Emergency Exit Sign', maintained: 'Maintained', fitting: 'X' }] }), {}, meta) },
  { id: 'welder', head: 'Welder', tail: '', run: (pid, name) => exportWelderExcel(migrateProjectToAreas({ id: pid, name, ...co, assets: [{ id: 'a1', location: 'Example Workshop', assetId: 'W001', brand: 'Acme', model: 'WeldMaster 200', serial: 'SN-1001' }] }), {}, meta) },
  { id: 'gsd', head: 'Site_Defects', tail: '', run: (pid, name) => exportGSDExcel({ id: pid, name, ...co, areas: [{ id: 'a1', name: 'Area 1' }] }, [], meta) },
];
const EXPECT = {
  'Ross & Sons (East)': 'Ross_&_Sons_(East)', 'A/B Switchboard': 'A-B_Switchboard', 'Plant Rooms': 'Plant_Rooms', '': 'Site',
};
describe.each(CASES)('$id: the delivered file name', c => {
  it.each(Object.keys(EXPECT))('site name %j', async name => {
    await c.run('p-' + c.id, name); expect(payload, 'the export was delivered').toBeTruthy();
    const want = [c.head, EXPECT[name], c.tail, D].filter(Boolean).join('_') + '.xlsx';
    expect(payload.filename).toBe(want); expect(payload.filename).toBe(exportFileName(c.head, name, c.tail, D));
    expect(payload.filename).not.toMatch(/[\\/:*?"<>|]/); expect(payload.filename).not.toMatch(/^[._-]/); expect(payload.filename).toMatch(/\.xlsx$/);
  });
});
describe('the three names from the plan, as a customer sees them', () => {
  it('IEL: Plant Rooms, Ross & Sons (East), A/B Switchboard; RCD: Plant Rooms; RCD with no name', async () => {
    const iel = CASES.find(c => c.id === 'iel'), rcd = CASES.find(c => c.id === 'rcd-push');
    await iel.run('p1', 'Plant Rooms'); expect(payload.filename).toBe('IEL_Plant_Rooms_2026-09-30.xlsx');
    await iel.run('p2', 'Ross & Sons (East)'); expect(payload.filename).toBe('IEL_Ross_&_Sons_(East)_2026-09-30.xlsx');
    await iel.run('p3', 'A/B Switchboard'); expect(payload.filename).toBe('IEL_A-B_Switchboard_2026-09-30.xlsx');
    await rcd.run('p4', 'Plant Rooms'); expect(payload.filename).toBe('Plant_Rooms_RCD_Push_2026-09-30.xlsx');
    await rcd.run('p5', ''); expect(payload.filename).toBe('Site_RCD_Push_2026-09-30.xlsx');
  });
});

// ---- the source scan: a tenth module (or an edit) cannot bring the slip or an unguarded name back ----
describe('source scan: every export file name is built by the helper', () => {
  const dir = path.resolve(__dirname);
  const files = fs.readdirSync(dir).filter(f => /\.(jsx?|mjs|cjs)$/.test(f) && !/\.test\./.test(f)).map(f => [f, fs.readFileSync(path.join(dir, f), 'utf8')]);
  it('there is at least App.jsx to scan', () => { expect(files.map(f => f[0])).toContain('App.jsx'); });
  it('no source file replaces a bare s+ (the missing-backslash slip: it replaces the LETTER s, not spaces)', () => {
    for (const [f, t] of files) { const hits = t.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /\.replace\(\s*\/s\+\//.test(l)); expect(hits.map(h => f + ':' + h[0]), f).toEqual([]); }
  });
  it('no template or string builds an .xlsx name from a site name without the helper', () => {
    for (const [f, t] of files) {
      const hits = t.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /`[^`]*\$\{[^}]*(sName|\.name|siteName|projectName)[^}]*\}[^`]*\.xlsx`/.test(l) || /(sName|\.name)\s*\+\s*["'][^"']*\.xlsx["']/.test(l));
      expect(hits.map(h => f + ':' + h[0]), f).toEqual([]);
    }
  });
  it('every deliverExportFile call gets a helper-built name, a fixed template name or a variable made from one', () => {
    for (const [f, t] of files) {
      const lines = t.split('\n'); const named = new Set();
      lines.forEach(l => { const m = /\bconst\s+(fname|filename)\s*=\s*(.+?);?\s*$/.exec(l); if (m && !/file\.name/.test(m[2])) { const v = m[2]; expect(/^exportFileName\(/.test(v) || /^["'`][A-Za-z_]+_Import_Template\.xlsx["'`]$/.test(v), f + ': ' + l.trim()).toBe(true); named.add(m[1]); } });
      lines.forEach((l, i) => { const m = /deliverExportFile\(\s*(.+)\)\s*;?\s*$/.exec(l); if (!m || /^function deliverExportFile/.test(l.trim())) return;
        const args = m[1]; const last = args.slice(args.lastIndexOf(',') + 1).trim(); const second = /,\s*(exportFileName\(.*|["'][A-Za-z_]+_Import_Template\.xlsx["']|fname|filename)\s*$/.exec(args);
        expect(!!second, f + ':' + (i + 1) + ' ' + l.trim() + ' (last argument: ' + last + ')').toBe(true); });
    }
  });
  it('the scan itself is not blind: the helper is used in nine export functions and the templates stay fixed names', () => {
    const app = files.find(f => f[0] === 'App.jsx')[1]; expect((app.match(/exportFileName\(/g) || []).length).toBeGreaterThanOrEqual(10);       // the definition + nine exports + the RCD builder uses it once for both modes
    expect((app.match(/_Import_Template\.xlsx/g) || []).length).toBeGreaterThanOrEqual(8);
  });
});

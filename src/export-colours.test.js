// EXPORT COLOUR STANDARD (2026-10-02): one palette (XJ_COLOURS), two helpers (xjStatusStyle / xjPriorityStyle), the same rules in every module.
//   status + priority colour ONLY their own cell, the word / letter is always written, Untested is always plain, every font on its fill >= 4.5:1.
// Real export functions + ExcelJS read-back, incl. the states the earlier verification files did not cover (priority L on Defects, an SWB L risk row,
// SWB UNTESTED Overall, Welder UNTESTED).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';
import 'fake-indexeddb/auto';
import { XJ_COLOURS, xjStatusStyle, xjPriorityStyle, exportSWBExcel, exportWelderExcel, exportELTExcel, exportTATExcel, exportIELExcel, SWB_CHECKLIST, WELDER_CHECKLIST, migrateProjectToAreas as toAreas } from './App.jsx';

// ── contrast helpers ───────────────────────────────────────────────────────────────────────────────────────
const lum = h => { const c = [0, 2, 4].map(i => parseInt(String(h).slice(-6).substr(i, 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const fillOf = c => (c.fill && c.fill.fgColor && c.fill.fgColor.argb) || null;
const fontOf = c => (c.font && c.font.color && c.font.color.argb) || null;
const bold = c => !!(c.font && c.font.bold);
const txt = c => (c.value == null ? '' : typeof c.value === 'object' && c.value.richText ? c.value.richText.map(t => t.text).join('') : String(c.value));
const WHITE = 'FFFFFFFF', ZEBRA = 'FFF5F5F5', TEXT = 'FF2D2D2D';
const S = XJ_COLOURS.status, P = XJ_COLOURS.priority;
// every non-empty cell, every sheet: its font on its fill must be readable (cells with no fill are white; no font colour is black)
function unreadable(wb) {
  const bad = [];
  wb.eachSheet(ws => ws.eachRow(row => row.eachCell(c => {
    if (!txt(c).trim()) return; const bg = fillOf(c) || WHITE; const fg = fontOf(c) || 'FF000000';
    const r = ratio(fg, bg); if (r < 4.5) bad.push(`${ws.name}!${c.address} "${txt(c).slice(0, 20)}" ${String(fg).slice(-6)} on ${String(bg).slice(-6)} = ${r.toFixed(2)}`);
  })));
  return bad;
}
let payload;
beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { delete window.webkit; });
const load = async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64')); return wb; };
const meta = { auditor: 'Jane Auditor', testDate: '2026-09-30', nextTestDate: '2027-09-30', instruments: 'Test Meter 1000' };
const rowWhere = (ws, col, pred) => { let hit = null; ws.eachRow((row, r) => { if (!hit && pred(txt(row.getCell(col)))) hit = r; }); return hit; };
const headCol = (ws, re, row = 6) => { let c = 0; ws.getRow(row).eachCell((cell, i) => { if (!c && re.test(txt(cell))) c = i; }); return c; };
const expectStatus = (cell, key) => { expect(fillOf(cell), txt(cell)).toBe(S[key].bg); expect(fontOf(cell)).toBe(S[key].font); expect(bold(cell)).toBe(true); };
const expectPriority = (cell, L) => { expect(fillOf(cell), txt(cell)).toBe(P[L].bg); expect(fontOf(cell)).toBe(P[L].font); expect(bold(cell)).toBe(L === 'U'); };
const expectPlain = cell => { expect([WHITE, ZEBRA], txt(cell)).toContain(fillOf(cell)); expect(fontOf(cell)).toBe(TEXT); expect(bold(cell)).toBe(false); };

describe('the palette and the two helpers', () => {
  it('every font / fill pair in the table is >= 4.5:1 (incl. MONITOR / M and the muted grey), so nothing is unreadable', () => {
    [...Object.values(S), ...Object.values(P)].forEach(c => expect(ratio(c.font, c.bg)).toBeGreaterThanOrEqual(4.5));
    [XJ_COLOURS.white, XJ_COLOURS.lightGrey, XJ_COLOURS.midGrey].forEach(bg => expect(ratio(XJ_COLOURS.darkGrey, bg)).toBeGreaterThanOrEqual(4.5));
    expect(ratio(XJ_COLOURS.mutedGrey, XJ_COLOURS.white)).toBeGreaterThanOrEqual(4.5);     // GSD detail line
  });
  it('xjStatusStyle: Pass / Fail / MONITOR / N/A coloured + bold, any casing; Untested / blank / unknown -> null (plain)', () => {
    const k = { PASS: 'pass', Pass: 'pass', fail: 'fail', MONITOR: 'monitor', 'N/A': 'na', NA: 'na' };
    for (const [w, key] of Object.entries(k)) { const st = xjStatusStyle(w); expect(st.fill.fgColor.rgb).toBe(S[key].bg); expect(st.font.color.rgb).toBe(S[key].font); expect(st.font.bold).toBe(true); }
    ['UNTESTED', 'Untested', '', null, undefined, 'maybe'].forEach(w => expect(xjStatusStyle(w)).toBeNull());
  });
  it('xjPriorityStyle: L M H U (or the words); U is bold white on solid maroon, the rest are not bold; blank / unknown -> null', () => {
    ['L', 'M', 'H', 'U'].forEach(L => { const st = xjPriorityStyle(L); expect(st.fill.fgColor.rgb).toBe(P[L].bg); expect(st.font.color.rgb).toBe(P[L].font); expect(!!st.font.bold).toBe(L === 'U'); });
    expect(xjPriorityStyle('Urgent').fill.fgColor.rgb).toBe(P.U.bg); expect(xjPriorityStyle('High').fill.fgColor.rgb).toBe(P.H.bg); expect(xjPriorityStyle('low').fill.fgColor.rgb).toBe(P.L.bg);
    ['', null, undefined, 'X'].forEach(v => expect(xjPriorityStyle(v)).toBeNull());
  });
  it('priority H / M / L deliberately share the Fail / MONITOR / Pass colours; U is the one solid dark fill', () => {
    expect(P.H).toEqual(S.fail); expect(P.M).toEqual(S.monitor); expect(P.L).toEqual(S.pass); expect(P.U.bg).toBe('FF9B0000');
  });
});

describe('SWB: priority colour on the Risk Rating cell ONLY; every other text cell on a board row stays plain and readable', () => {
  const keys = SWB_CHECKLIST.map(c => c.key);
  const project = { id: 's1', name: 'Example Quarry', company: 'Example Electrical Pty Ltd', abn: '98 765 432 109', licence: 'EW123456', areas: [{ id: 'a', name: 'Plant', boards: [{ id: 'b1', name: 'MSB 1' }, { id: 'b2', name: 'MSB 2' }, { id: 'b3', name: 'MSB 3' }] }] };
  const ans = (pat, extra) => Object.fromEntries(keys.map((k, i) => [k, { status: { P: 'pass', F: 'fail', N: 'na', '.': 'untested' }[pat[i]], ...(extra[k] || {}) }]));
  // b1: pass, then four fails carrying risk U / H / M / L, then N/A, then pass (all answered, so Overall = FAIL).   b2: every item passed (Overall PASS).   b3: not tested at all.
  const results = { s1: { a: {
    b1: ans('PFFFFN'.padEnd(keys.length, 'P'), { [keys[1]]: { risk: 'U', defectId: 'D1' }, [keys[2]]: { risk: 'H', defectId: 'D2' }, [keys[3]]: { risk: 'M', defectId: 'D3' }, [keys[4]]: { risk: 'L', defectId: 'D4' } }),
    b2: ans('P'.repeat(keys.length), {}),
  } } };
  let wb;
  beforeEach(async () => { await exportSWBExcel(project, results, meta); wb = await load(); });

  it('Register: Highest Risk and Priority cells carry the priority colour; the Pass/Fail cell its status colour', () => {
    const ws = wb.getWorksheet('Register'); const hr = headCol(ws, /^Highest Risk/), pr = headCol(ws, /^Priority/), pf = headCol(ws, /^Pass\/Fail$/);
    const r1 = rowWhere(ws, 2, t => t === 'MSB 1');
    expectPriority(ws.getRow(r1).getCell(hr), 'U'); expect(txt(ws.getRow(r1).getCell(pr))).toBe('U; H; M; L'); expectPriority(ws.getRow(r1).getCell(pr), 'U');   // several priorities: coloured by the most severe (first)
    expectStatus(ws.getRow(r1).getCell(pf), 'fail'); expectStatus(ws.getRow(rowWhere(ws, 2, t => t === 'MSB 2')).getCell(pf), 'pass');
  });
  it('per-board checklist: the Risk Rating cell is U / H / M / L coloured; EVERY other cell in those rows is plain zebra with dark text (the "Pass criteria" cell is no longer tinted)', () => {
    const ws = wb.getWorksheet('MSB 1'); const head = rowWhere(ws, 1, t => t === 'Item');
    const risk = ['U', 'H', 'M', 'L'];
    keys.forEach((k, i) => {
      const row = ws.getRow(head + 1 + i); const zebra = i % 2 === 0 ? WHITE : ZEBRA;
      [1, 2, 4, 5, 7].forEach(c => { const cell = row.getCell(c); if (c === 3) return; expect(fillOf(cell), `${k} col ${c}`).toBe(zebra); expect(fontOf(cell)).toBe(TEXT); expect(bold(cell)).toBe(false); });
      const rc = row.getCell(6);
      if (i >= 1 && i <= 4) { expectPriority(rc, risk[i - 1]); expect(txt(rc)).toBe(risk[i - 1]); } else { expect(fillOf(rc)).toBe(zebra); expect(fontOf(rc)).toBe(TEXT); }
      const res = row.getCell(3);
      if (i === 0) expectStatus(res, 'pass'); else if (i <= 4) expectStatus(res, 'fail'); else if (i === 5) expectStatus(res, 'na'); else expectStatus(res, 'pass');
    });
  });
  it('Audit Summary: Pass / Fail counts coloured only when > 0; Overall FAIL red, PASS green, UNTESTED plain (not N/A grey); a board with nothing tested is UNTESTED', () => {
    const sum = ws => { const o = {}; ws.eachRow((row, r) => { const l = txt(row.getCell(1)); if (['Pass', 'Fail', 'N/A', 'Untested', 'Overall'].includes(l)) o[l] = row.getCell(2); }); return o; };
    const s1 = sum(wb.getWorksheet('MSB 1')); expectStatus(s1.Pass, 'pass'); expectStatus(s1.Fail, 'fail'); expectPlain(s1['N/A']); expectPlain(s1.Untested); expectStatus(s1.Overall, 'fail');
    const s2 = sum(wb.getWorksheet('MSB 2')); expect(txt(s2.Fail)).toBe('0'); expectPlain(s2.Fail); expectStatus(s2.Overall, 'pass');
    const s3 = sum(wb.getWorksheet('MSB 3')); expect(txt(s3.Overall)).toBe('UNTESTED'); expectPlain(s3.Overall); expect(fillOf(s3.Overall)).not.toBe(S.na.bg);
  });
  it('no unreadable font / fill pair anywhere in the workbook', () => { expect(unreadable(wb)).toEqual([]); });
});

describe('Welder: Register priority, per-welder Priority value, Overall UNTESTED plain', () => {
  const keys = WELDER_CHECKLIST.map(c => c.key);
  const rec = (pat, extra = {}) => ({ items: Object.fromEntries(keys.map((k, i) => [k, { result: { P: 'pass', F: 'fail', N: 'na', '.': '' }[pat[i]] || '', value: '', action: '' }])), ...extra });
  const project = toAreas({ id: 'p1', name: 'Example Quarry', company: 'Example Electrical Pty Ltd', abn: '98 765 432 109', licence: 'EW123456', assets: [
    { id: 'a1', location: 'Example Workshop', assetId: 'W001', brand: 'Acme', model: 'WeldMaster', serial: 'SN-1' },
    { id: 'a2', location: 'Example Workshop', assetId: 'W002', brand: 'Beta', model: 'Arc', serial: 'SN-2' },
    { id: 'a3', location: 'Example Workshop', assetId: 'W003', brand: 'Gamma', model: 'Stick', serial: 'SN-3' },
  ] });
  const results = { a1: rec('P'.repeat(keys.length)), a2: rec('F' + 'P'.repeat(keys.length - 1), { priority: 'L', defectId: 'D-1', rectified: 'Scheduled for Repair', responsibility: 'Client' }), a3: rec('.'.repeat(keys.length)) };
  let wb;
  beforeEach(async () => { await exportWelderExcel(project, { p1: results }, meta); wb = await load(); });
  it('Register: the Priority (L,M,H,U) cell is coloured (L = green, as Pass) and Pass / Fail keep their status colours', () => {
    const ws = wb.getWorksheet('Register'); const pr = headCol(ws, /^Priority/), pf = headCol(ws, /^Pass \/ Fail$/);
    const r2 = rowWhere(ws, 2, t => t === 'W002');
    expectPriority(ws.getRow(r2).getCell(pr), 'L'); expectStatus(ws.getRow(r2).getCell(pf), 'fail'); expectStatus(ws.getRow(rowWhere(ws, 2, t => t === 'W001')).getCell(pf), 'pass');
  });
  it('per-welder sheet: the defect block Priority value carries the priority colour; Overall FAIL red / PASS green / UNTESTED plain', () => {
    const w2 = wb.getWorksheet('W002'); const pri = rowWhere(w2, 1, t => t === 'Priority'); expectPriority(w2.getRow(pri).getCell(2), 'L');
    const ov = ws => ws.getRow(rowWhere(ws, 1, t => t === 'Overall')).getCell(2);
    expectStatus(ov(w2), 'fail'); expectStatus(ov(wb.getWorksheet('W001')), 'pass');
    const u = ov(wb.getWorksheet('W003')); expect(txt(u)).toBe('UNTESTED'); expectPlain(u);
  });
  it('no unreadable font / fill pair anywhere in the workbook', () => { expect(unreadable(wb)).toEqual([]); });
});

describe('ELT: the Defects sheet colours its Priority cells', () => {
  const project = toAreas({ id: 'p1', name: 'Example Quarry', company: 'Example Electrical Pty Ltd', abn: '98 765 432 109', licence: 'EW123456', assets: [
    { id: 'a1', location: 'Example Quarry', assetLocation: 'North Door', assetId: 'EL-001', type: 'Emergency Exit Sign', maintained: 'Maintained', fitting: 'Generic' },
    { id: 'a2', location: 'Example Quarry', assetLocation: 'South Roof', assetId: 'EL-002', type: 'Emergency Exit Sign', maintained: 'Maintained', fitting: 'Generic' },
    { id: 'a3', location: 'Example Quarry', assetLocation: 'Workshop', assetId: 'EL-003', type: 'Emergency Exit Sign', maintained: 'Maintained', fitting: 'Generic' },
  ] });
  const ok = { visual: 'pass', discharge: 'pass', switching: 'pass', charging: 'pass' };
  const results = { p1: { a1: { ...ok, visual: 'fail', priority: 'L', defectId: '1' }, a2: { ...ok, discharge: 'fail', priority: 'U', defectId: '2' }, a3: { ...ok, charging: 'fail', priority: 'M', defectId: '3' } } };
  it('L / U / M on the Defects sheet carry their colours; no unreadable pair', async () => {
    await exportELTExcel(project, results, meta); const wb = await load(); const ws = wb.getWorksheet('Defects'); const pr = headCol(ws, /^Priority/);
    expectPriority(ws.getRow(7).getCell(pr), 'L'); expectPriority(ws.getRow(8).getCell(pr), 'U'); expectPriority(ws.getRow(9).getCell(pr), 'M');
    expect(unreadable(wb)).toEqual([]);
  });
});

describe('TAT + IEL (shared xjSheet): Visual FAIL red like Electrical FAIL (Pass stays plain); every priority incl. L on Defects', () => {
  it('TAT', async () => {
    const project = { id: 'p1', name: 'Example Quarry', company: 'Example Electrical Pty Ltd', abn: '98 765 432 109', licence: 'EW123456', areas: [{ id: 'a', name: 'Workshop', defaultFreq: '3', items: ['v', 'w', 'x', 'y', 'z'], itemNames: { v: 'Pass item', w: 'Grinder', x: 'Drill', y: 'Lead', z: 'Saw' }, itemTags: { v: 'T0', w: 'T1', x: 'T2', y: 'T3', z: 'T4' }, itemEquipTypes: {}, itemFreqs: {} }] };
    const f = (P, vis, el) => ({ status: 'fail', visualCheck: vis, electricalCheck: el, lastTested: '2026-09-30', priority: P, defectId: 'D' + P });
    await exportTATExcel(project, { a: { v: { status: 'pass', visualCheck: 'pass', electricalCheck: 'pass', lastTested: '2026-09-30' }, w: f('L', 'fail', 'pass'), x: f('M', 'pass', 'fail'), y: f('H', 'fail', 'fail'), z: f('U', 'pass', 'pass') } }, meta);
    const wb = await load(); const ws = wb.getWorksheet('Test & Tag'); const vi = headCol(ws, /^Visual Inspection$/), el = headCol(ws, /^Electrical Test$/);
    const row = n => ws.getRow(rowWhere(ws, 4, t => t === n));
    expectStatus(row('Grinder').getCell(vi), 'fail'); expectPlain(row('Grinder').getCell(el));       // visual fail red, electrical pass plain
    expectPlain(row('Drill').getCell(vi)); expectStatus(row('Drill').getCell(el), 'fail');
    expectStatus(row('Lead').getCell(vi), 'fail'); expectStatus(row('Lead').getCell(el), 'fail');
    expectPlain(row('Pass item').getCell(vi)); expectPlain(row('Pass item').getCell(el));             // a PASS check is never coloured
    const d = wb.getWorksheet('Defects'); const pr = headCol(d, /^Priority/); ['L', 'M', 'H', 'U'].forEach((L, i) => expectPriority(d.getRow(7 + i).getCell(pr), L));
    expect(unreadable(wb)).toEqual([]);
  });
  it('IEL: priority L and M on the Defects sheet', async () => {
    const project = { id: 'p1', name: 'Example Quarry', company: 'Example Electrical Pty Ltd', abn: '98 765 432 109', licence: 'EW123456', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'e1', name: 'estops', circuits: ['x', 'y'], machineNames: { x: 'Conv 1', y: 'Conv 2' } }] }] };
    await exportIELExcel(project, { a: { estops: { x: { status: 'fail', lastTested: '2026-09-30', priority: 'L', defectId: '1' }, y: { status: 'fail', lastTested: '2026-09-30', priority: 'M', defectId: '2' } } } }, meta);
    const wb = await load(); const d = wb.getWorksheet('Defects'); const pr = headCol(d, /^Priority/);
    expectPriority(d.getRow(7).getCell(pr), 'L'); expectPriority(d.getRow(8).getCell(pr), 'M'); expect(unreadable(wb)).toEqual([]);
  });
});

describe('source: nothing outside XJ_COLOURS hard-codes a status / priority colour', () => {
  it('no leftover SWB_XC / swbXPC / swbXRS / xjResultStyle, and the old priorityX_bg keys are gone', () => {
    const src = require('fs').readFileSync(require('path').resolve(__dirname, 'App.jsx'), 'utf8').replace(/\/\/[^\n]*/g, '');
    expect(src).not.toMatch(/SWB_XC|swbXPC|swbXRS|xjResultStyle|priority[ULMH]_(bg|font)/);
  });
});

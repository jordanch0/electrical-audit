// Welder Excel import (parseWelderExcel): header rule, placeholders, site-name suffixes, Brand/Model recovery from a REAL export.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import * as XLSX from 'xlsx';
import { parseWelderExcel, exportWelderExcel, WELDER_COLUMNS, WELDER_CHECKLIST, migrateProjectToAreas as toAreas } from './App.jsx';

const wbFrom = (rows, sheet = 'S') => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheet); return wb; };
const HEAD = ['Location', 'Asset ID', 'Welder (Machine)', 'Serial Number'];

describe('parseWelderExcel — header rule and validation', () => {
  it('reads a plain register: location, asset id, machine, serial; results columns ignored', () => {
    const r = parseWelderExcel(wbFrom([WELDER_COLUMNS, ['Shed', 'W1', 'Kemppi Evo', 'S1', '13/07/2026', 'Pass', '', '', '', '', 'note', 'H', '13/10/2026']]));
    expect(r.ok).toBe(true);
    expect(r.assets).toHaveLength(1);
    expect(r.assets[0]).toMatchObject({ location: 'Shed', assetId: 'W1', brand: 'Kemppi Evo', model: '', serial: 'S1' });
    expect(JSON.stringify(r.assets[0])).not.toMatch(/Pass|note|13\/07/); // structure only
  });

  it('requires 3 exact headings — a fuzzy "contains" title row is never the header (SWB bug class)', () => {
    const r = parseWelderExcel(wbFrom([['Welder register: Location, Asset ID, Welder (Machine), Serial Number'], ['Location', 'Asset ID'], ['x', 'y']]));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Couldn't find the Welder column headings/);
  });

  it('rejects when Welder (Machine) is missing, naming the column', () => {
    const r = parseWelderExcel(wbFrom([['Location', 'Asset ID', 'Serial Number'], ['a', 'b', 'c']]));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/"Welder \(Machine\)" column is missing/);
  });

  it('gives a friendly message for an ELT file, and creates nothing', () => {
    const r = parseWelderExcel(wbFrom([['Location', 'Asset Location', 'Asset ID', 'Type', 'Maintained/Non-Maintained', 'Fitting Type/Manufacturer'], ['s', 'SE Door', '', 'Emergency Exit Sign', 'Maintained', '']]));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Emergency Lighting \(ELT\)/);
  });

  it('skips rows with no Asset ID and no machine, ignores blank rows, collapses exact duplicates — and counts them', () => {
    const r = parseWelderExcel(wbFrom([HEAD, ['Shed', '', '', 'S9'], [], ['Shed', 'W1', 'A B', 'S1'], ['shed', 'w1', 'a b', 's1'], ['Shed', 'W1', 'A B', 'S2'], ['Shed', 'W3', '', '']]));
    expect(r.ok).toBe(true);
    expect(r.assets.map(a => a.assetId)).toEqual(['W1', 'W1', 'W3']); // same ID but different serial is a different welder
    expect(r.skipped).toBe(1);
    expect(r.duplicates).toBe(1);
  });

  it('a row with an Asset ID and a blank machine is allowed', () => {
    const r = parseWelderExcel(wbFrom([HEAD, ['', 'W7', '', '']]));
    expect(r.assets).toEqual([expect.objectContaining({ assetId: 'W7', brand: '', model: '' })]);
    expect(r.combined).toBe(0);
  });

  it('errors clearly when every row is unusable', () => {
    const r = parseWelderExcel(wbFrom([HEAD, ['Shed', '', '', 'S1'], []]));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/No welders found/);
  });

  it('ignores template / export placeholders and accepts both title suffixes without splitting on hyphens', () => {
    const tpl = parseWelderExcel(wbFrom([['Site Name — enter your site name here'], ['Company Name  |  ABN: 12 345 678 901  |  Electrical Licence: 123456C'], [''], ['INSTRUCTIONS: '.padEnd(90, 'x')], WELDER_COLUMNS, ['Shed', 'W1', 'A B', '1']]));
    expect(tpl).toMatchObject({ ok: true, siteName: '', company: '', abn: '', licence: '' });
    const mk = title => parseWelderExcel(wbFrom([[title], ['SparkCheck'], ['Auditor: '], [''], WELDER_COLUMNS, ['Shed', 'W1', 'A B', '1']]));
    expect(mk('Hearse Road - Firestone — Welder Test')).toMatchObject({ siteName: 'Hearse Road - Firestone', company: '' });
    expect(mk('Hearse Road - Firestone — Welder (VRD) Test').siteName).toBe('Hearse Road - Firestone'); // pre-rename exports
    const real = parseWelderExcel(wbFrom([['Site — Welder Test'], ['Acme Pty Ltd  |  ABN: 99 999  |  Electrical Licence: EW1'], [''], [''], WELDER_COLUMNS, ['a', 'W1', 'A B', '1']]));
    expect(real).toMatchObject({ siteName: 'Site', company: 'Acme Pty Ltd', abn: '99 999', licence: 'EW1' });
  });

  it('without per-welder sheets the whole machine text goes in Brand and is counted for the preview note', () => {
    const r = parseWelderExcel(wbFrom([HEAD, ['a', 'W1', 'Lincoln Electric Invertec 300', '1'], ['a', 'W2', '', '2']]));
    expect(r.assets[0]).toMatchObject({ brand: 'Lincoln Electric Invertec 300', model: '' });
    expect(r.combined).toBe(1);
    expect(r.exact).toBe(0);
  });
});

describe('parseWelderExcel — per-welder sheet must verifiably belong to its Register row', () => {
  // Same machine text, split differently: "Lincoln Electric" + "Invertec" vs "Lincoln" + "Electric Invertec". Brand + Model rejoin
  // to the Register text either way, so only the Asset ID / Serial agreement stops a mis-ordered sheet donating the wrong split.
  const detail = (assetId, serial, brand, model) => [['t'], ['c'], ['Location: L', '', 'Asset ID: ' + assetId], ['Brand: ' + brand, '', 'Model: ' + model], ['Serial Number: ' + serial]];
  const build = detailOrder => {
    const wb = wbFrom([['Site — Welder Test'], ['SparkCheck'], [''], [''], WELDER_COLUMNS,
      ['L', 'W1', 'Lincoln Electric Invertec', 'S1'], ['L', 'W2', 'Lincoln Electric Invertec', 'S2']], 'Register');
    const d = { W1: detail('W1', 'S1', 'Lincoln Electric', 'Invertec'), W2: detail('W2', 'S2', 'Lincoln', 'Electric Invertec') };
    detailOrder.forEach(id => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(d[id]), id));
    return wb;
  };
  it('in order: each welder gets its own exact split', () => {
    const r = parseWelderExcel(build(['W1', 'W2']));
    expect(r.assets.map(a => [a.brand, a.model])).toEqual([['Lincoln Electric', 'Invertec'], ['Lincoln', 'Electric Invertec']]);
    expect(r.exact).toBe(2);
  });
  it('mis-ordered sheets whose Brand + Model still rejoin are NOT trusted (Asset ID / Serial disagree)', () => {
    const r = parseWelderExcel(build(['W2', 'W1']));
    expect(r.assets.map(a => [a.brand, a.model])).toEqual([['Lincoln Electric Invertec', ''], ['Lincoln Electric Invertec', '']]);
    expect(r.exact).toBe(0);
    expect(r.combined).toBe(2);
  });
});

describe('parseWelderExcel — round trip from a REAL exportWelderExcel file', () => {
  let payload;
  beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
  afterEach(() => { delete window.webkit; vi.unstubAllGlobals(); });
  const keys = WELDER_CHECKLIST.map(c => c.key);
  const project = toAreas({ id: 'p1', name: 'Hearse Road - Firestone', company: 'Acme Pty Ltd', abn: '99 999', licence: 'EW1', assets: [
    { id: 'a1', location: 'ONR Workshop', assetId: 'W001', brand: 'Lincoln Electric', model: 'Invertec 300', serial: '2699294' },
    { id: 'a2', location: 'ONR Workshop', assetId: 'W002', brand: 'Unimig', model: 'Razor', serial: 'N/A' },
    { id: 'a3', location: 'ONR Workshop', assetId: 'W/003', brand: '', model: '', serial: '' },            // untested, no machine, slash in ID
    { id: 'a4', location: 'ONR Workshop', assetId: '', brand: 'Kemppi', model: '', serial: 'K-4' },          // no Asset ID, brand only
    { id: 'a5', location: 'ONR Workshop', assetId: 'W002', brand: 'Unimig', model: 'Razor', serial: 'N/A' }, // same identity as a2 (sheet name de-duped)
  ] });
  const results = { a1: { items: Object.fromEntries(keys.map(k => [k, { result: 'pass', value: '9 MΩ', action: '' }])), date: '2026-07-13', notes: 'secret note' } };
  const meta = { auditor: 'Jane', testDate: '2026-07-13', nextTestDate: '2026-10-13', instruments: 'Fluke' };

  async function exported() {
    await exportWelderExcel(project, { p1: results }, meta);
    await waitFor(() => expect(payload).toBeTruthy());
    return XLSX.read(Buffer.from(payload.base64, 'base64'), { type: 'buffer' });
  }

  it('brings back every welder (tested or not) with exact Brand / Model, site and company — and no results', async () => {
    const r = parseWelderExcel(await exported());
    expect(r.ok).toBe(true);
    expect(r.siteName).toBe('Hearse Road - Firestone');
    expect([r.company, r.abn, r.licence]).toEqual(['Acme Pty Ltd', '99 999', 'EW1']);
    expect(r.assets.map(({ id, ...a }) => a)).toEqual([
      { location: 'ONR Workshop', assetId: 'W001', brand: 'Lincoln Electric', model: 'Invertec 300', serial: '2699294' }, // multi-word brand survives
      { location: 'ONR Workshop', assetId: 'W002', brand: 'Unimig', model: 'Razor', serial: 'N/A' },
      { location: 'ONR Workshop', assetId: 'W/003', brand: '', model: '', serial: '' },
      { location: 'ONR Workshop', assetId: '', brand: 'Kemppi', model: '', serial: 'K-4' },
    ]);
    expect(r.duplicates).toBe(1);   // a5 is an exact duplicate of a2 on the Register
    expect(r.exact).toBe(4);
    expect(r.combined).toBe(0);
    expect(JSON.stringify(r)).not.toMatch(/secret note|9 MΩ|Pass/);
  });

  it('a per-welder sheet that does not belong to its Register row is never trusted (falls back to combined text)', async () => {
    const wb = await exported();
    const [reg, first, second, ...rest] = wb.SheetNames;
    wb.SheetNames = [reg, second, first, ...rest]; // swap the order: sheet 1 now describes W002 but the row is W001
    const r = parseWelderExcel(wb);
    expect(r.assets[0]).toMatchObject({ assetId: 'W001', brand: 'Lincoln Electric Invertec 300', model: '' });
    expect(r.assets[1]).toMatchObject({ assetId: 'W002', brand: 'Unimig Razor', model: '' });
    expect(r.combined).toBeGreaterThanOrEqual(2);
  });
});

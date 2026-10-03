// export -> import round trip for the NEW shared-header layout (2026-10-02), every importing module, with and without a per-site logo. Same data as the OLD-format fixtures in
// export-old-format-import.test.js, so the two files together prove old AND new exports import to the same structure. Uses the real export functions + real parsers.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as XLSX from 'xlsx';
import 'fake-indexeddb/auto';
import { exportExcel, exportIELExcel, exportTATExcel, exportThermoExcel, exportSWBExcel, exportIRTExcel, exportELTExcel, exportWelderExcel, migrateProjectToAreas, siteLogoStore,
  parseExcelToProject, parseIELExcel, parseTATExcel, parseThermoExcel, parseSWBExcel, parseIRTExcel, parseELTExcel, parseWelderExcel, ELT_DEFAULT_TYPES } from './App.jsx';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
let payload;
beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { delete window.webkit; });
const wbOut = () => XLSX.read(payload.base64, { type: 'base64' });
const co = { company: 'Example Electrical Pty Ltd', abn: '98 765 432 109', licence: 'EW123456' };
const meta = { auditor: 'Jane Auditor', testDate: '2026-09-30', nextTestDate: '2027-09-30', pushDate: '2026-09-30', injectDate: '2026-09-30', machine: 'Test Machine 1', instruments: 'Test Meter 1000' };
const fail = { status: 'fail', defectId: 'D1', rectified: 'Scheduled for Repair', responsibility: 'Client', priority: 'H', notes: 'bad' };
const names = (list, f) => list.map(f);

const JOBS = {
  rcd: { run: async pid => { const p = { id: pid, name: 'Example Quarry', ...co, areas: [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'pn1', name: 'MSB 1', circuits: ['CB 1', 'CB 2'], circuitMeta: { 'CB 1': { cbType: 'MCB Type B', ampRating: '16A' } } }] }, { id: 'a2', name: 'Crusher', panels: [{ id: 'pn2', name: 'MCC 2', circuits: ['CB 1'], circuitMeta: {} }] }] };
      await exportExcel({ [pid]: { a1: { pn1: { 'CB 1': { push: fail } } } } }, p, meta, 'push', null); },
    parse: d => parseExcelToProject(d, 'Example Quarry', '', '', ''), site: 'Example Quarry',
    struct: p => { expect(names(p.areas, a => a.name)).toEqual(['Wash Plant', 'Crusher']); expect(p.areas[0].panels[0].circuits).toEqual(['CB1', 'CB2']); expect(p.areas[0].panels[0].circuitMeta.CB1).toMatchObject({ cbType: 'MCB Type B', ampRating: '16A' }); } },
  iel: { run: async pid => { const p = { id: pid, name: 'Example Quarry', ...co, areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'p1', name: 'estops', circuits: ['x', 'y'], machineNames: { x: 'Conv 1', y: 'Conv 2' } }] }] };
      await exportIELExcel(p, { a: { estops: { x: { ...fail, lastTested: '2026-09-30' } } } }, meta); },
    parse: parseIELExcel, site: 'Example Quarry',
    struct: p => { expect(names(p.areas, a => a.name)).toEqual(['Plant']); expect(Object.values(p.areas[0].panels[0].machineNames)).toEqual(['Conv 1', 'Conv 2']); } },
  tat: { run: async pid => { const p = { id: pid, name: 'Example Quarry', ...co, areas: [{ id: 'a', name: 'Workshop', defaultFreq: '3', items: ['x', 'y'], itemNames: { x: 'Grinder', y: 'Drill' }, itemTags: { x: 'T1', y: 'T2' }, itemEquipTypes: {}, itemFreqs: {} }] };
      await exportTATExcel(p, { a: { x: { ...fail, lastTested: '2026-09-30' } } }, meta); },
    parse: parseTATExcel, site: 'Example Quarry',
    struct: p => { expect(Object.values(p.areas[0].itemNames)).toEqual(['Grinder', 'Drill']); expect(Object.values(p.areas[0].itemTags)).toEqual(['T1', 'T2']); } },
  thermo: { run: async pid => { const p = { id: pid, name: 'Example Quarry', ...co, areas: [{ id: 'a', name: 'Plant', boards: [{ id: 'b', name: 'MSB', circuits: ['c1', 'c2'], circuitNames: { c1: 'One', c2: 'Two' } }] }] };
      await exportThermoExcel(p, {}, meta); },
    parse: d => parseThermoExcel(d, '', XLSX), site: 'Example Quarry',
    struct: p => { expect(p.areas[0].boards[0].name).toBe('MSB'); expect(Object.values(p.areas[0].boards[0].circuitNames)).toEqual(['One', 'Two']); } },
  irt: { run: async pid => { const p = { id: pid, name: 'Example Quarry', ...co, areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'pn', name: 'MCC1', items: ['x', 'y'], itemNames: { x: 'Motor 1', y: 'Motor 2' } }] }] };
      await exportIRTExcel(p, {}, meta); },
    parse: parseIRTExcel, site: 'Example Quarry',
    struct: p => { expect(p.areas[0].panels[0].name).toBe('MCC1'); expect(Object.values(p.areas[0].panels[0].itemNames)).toEqual(['Motor 1', 'Motor 2']); } },
  swb: { run: async pid => { const p = { id: pid, name: 'Example Quarry - North', ...co, areas: [{ id: 'ar1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }, { id: 'b2', name: 'DB1' }] }] };
      await exportSWBExcel(p, {}, meta); },
    parse: parseSWBExcel, site: 'Example Quarry - North',
    struct: p => { expect(names(p.areas[0].boards, b => b.name)).toEqual(['MSB', 'DB1']); } },
  elt: { run: async pid => { const p = migrateProjectToAreas({ id: pid, name: 'Example Quarry - North', ...co, assets: [
        { id: 'a1', location: 'Example Quarry - North', assetLocation: 'North Door', assetId: 'EL-001', type: 'Emergency Exit Sign', maintained: 'Maintained', fitting: 'Acme Exit 24m' },
        { id: 'a2', location: 'Example Quarry - North', assetLocation: 'South Roof', assetId: 'EL-002', type: 'Emergency Exit Sign', maintained: 'Non-Maintained', fitting: 'Acme Twin Spots' }] });
      await exportELTExcel(p, { [pid]: { a1: { visual: 'pass', discharge: 'pass', switching: 'pass', charging: 'pass' } } }, meta); },
    parse: d => parseELTExcel(d, ELT_DEFAULT_TYPES), site: 'Example Quarry - North',
    struct: p => { expect(p.ok).toBe(true); expect(p.assets).toHaveLength(1); expect(p.assets[0]).toMatchObject({ assetId: 'EL-001', assetLocation: 'North Door', fitting: 'Acme Exit 24m' }); } },
  welder: { run: async pid => { const p = migrateProjectToAreas({ id: pid, name: 'Example Quarry - North', ...co, assets: [
        { id: 'a1', location: 'Example Workshop', assetId: 'W001', brand: 'Acme', model: 'WeldMaster 200', serial: 'SN-1001' },
        { id: 'a2', location: 'Example Workshop', assetId: 'W002', brand: 'Beta', model: 'Arc 200', serial: 'N/A' }] });
      await exportWelderExcel(p, {}, meta); },
    parse: parseWelderExcel, site: 'Example Quarry - North',
    struct: p => { expect(p.assets).toHaveLength(2);
      // the NEW per-welder sheets carry Brand / Model / Serial in the "Asset Details" block (label cell + value cell): exact recovery must still work
      expect(p.assets[0]).toMatchObject({ location: 'Example Workshop', assetId: 'W001', brand: 'Acme', model: 'WeldMaster 200', serial: 'SN-1001' });
      expect(p.assets[1]).toMatchObject({ location: 'Example Workshop', assetId: 'W002', brand: 'Beta', model: 'Arc 200', serial: 'N/A' });
      expect(p.exact).toBe(2); expect(p.combined).toBe(0); } },
};

describe.each(Object.keys(JOBS))('NEW-format %s export -> import round trip', mod => {
  it.each(['nologo', 'logo'])('%s: site (clean, no title residue), company / ABN / licence and the full structure survive', async variant => {
    const pid = `p-${mod}-${variant}`;
    if (variant === 'logo') await siteLogoStore.put(mod, pid, { buf: Buffer.from(PNG, 'base64'), type: 'image/png' });
    try {
      await JOBS[mod].run(pid);
      const parsed = JOBS[mod].parse(wbOut());
      expect(parsed.ok === undefined || parsed.ok === true, JSON.stringify(parsed).slice(0, 200)).toBe(true);
      expect(parsed.siteName !== undefined ? parsed.siteName : parsed.name).toBe(JOBS[mod].site);   // the new "  –  Module  (Test type)" title tails strip cleanly in every parser
      expect({ company: parsed.company, abn: parsed.abn, licence: parsed.licence }).toEqual(co);
      JOBS[mod].struct(parsed);
    } finally { if (variant === 'logo') await siteLogoStore.del(mod, pid); }
  });
});

// A hyphenated site name must survive export -> import for the four parsers that used to split the title at the first dash (IEL / TAT / Thermo / IRT).
describe.each([['Port-Kembla'], ['Hearse Rd - North']])('hyphenated site "%s": export -> import returns the site exactly (IEL / TAT / Thermo / IRT)', site => {
  const proj = (pid, areas) => ({ id: pid, name: site, ...co, areas });
  const CASES = {
    iel: { run: pid => exportIELExcel(proj(pid, [{ id: 'a', name: 'Plant', panels: [{ id: 'p1', name: 'estops', circuits: ['x'], machineNames: { x: 'Conv 1' } }] }]), {}, meta), parse: parseIELExcel },
    tat: { run: pid => exportTATExcel(proj(pid, [{ id: 'a', name: 'Workshop', defaultFreq: '3', items: ['x'], itemNames: { x: 'Grinder' }, itemTags: { x: 'T1' }, itemEquipTypes: {}, itemFreqs: {} }]), {}, meta), parse: parseTATExcel },
    thermo: { run: pid => exportThermoExcel(proj(pid, [{ id: 'a', name: 'Plant', boards: [{ id: 'b', name: 'MSB', circuits: ['c1'], circuitNames: { c1: 'One' } }] }]), {}, meta), parse: d => parseThermoExcel(d, '', XLSX) },
    irt: { run: pid => exportIRTExcel(proj(pid, [{ id: 'a', name: 'Plant', panels: [{ id: 'pn', name: 'MCC1', items: ['x'], itemNames: { x: 'Motor 1' } }] }]), {}, meta), parse: parseIRTExcel },
  };
  it.each(Object.keys(CASES))('%s', async mod => {
    await CASES[mod].run('p-hy-' + mod); const parsed = CASES[mod].parse(wbOut());
    expect(parsed.siteName).toBe(site); expect({ company: parsed.company, abn: parsed.abn, licence: parsed.licence }).toEqual(co);
  });
});

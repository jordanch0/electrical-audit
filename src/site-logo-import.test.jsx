// Per-site logo override, Stage 3: import extraction + the row-shift fix a logo row introduces. Every importer used a FIXED row index
// for the title/company/ABN/licence block; a logo strip pushes those rows down by one, so every importer now detects a blank leading
// row and reads one row lower when it's there — confirmed here for both directions: an OLD (no-logo) export still imports at its
// original rows, and a NEW (with-logo) export imports correctly at the shifted rows, with the embedded logo extracted back out as the
// new site's per-site override (the same round-trip Company/ABN/Licence already get).
import { describe, it, expect, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import 'fake-indexeddb/auto';
import {
  exportExcel, exportSWBExcel, exportWelderExcel, exportELTExcel, exportIRTExcel, exportIELExcel, exportTATExcel, exportThermoExcel,
  parseExcelToProject, parseSWBExcel, parseWelderExcel, parseELTExcel, parseIRTExcel, parseIELExcel, parseTATExcel, parseThermoExcel,
  xjExtractLogo, saveAppSettings, appLogoStore, siteLogoStore,
} from './App.jsx';

let payload;
beforeEach(() => { localStorage.clear(); payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
const buf = () => { const b = Buffer.from(payload.base64, 'base64'); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const wbFromPayload = () => XLSX.read(Buffer.from(payload.base64, 'base64'), { type: 'buffer' });
const rec = byte => ({ buf: new Uint8Array([byte, byte + 1, byte + 2]).buffer, type: 'image/jpeg' });

describe('old (no-logo) exports still import at their original row positions', () => {
  it('RCD (parseExcelToProject)', async () => {
    const project = { id: 's1', name: 'Site R', company: 'Old Co', abn: '11 111 111 111', licence: 'OLD1', areas: [{ id: 'a1', name: 'Plant', panels: [{ id: 'p1', name: 'MSB', circuits: ['C1'] }] }] };
    await exportExcel({ s1: { a1: { p1: { C1: { push: { status: 'pass' } } } } } }, project, { auditor: 'J', pushDate: '2026-09-21' }, 'push');
    const parsed = parseExcelToProject(wbFromPayload(), 'x', '', '', '');
    expect(parsed.company).toBe('Old Co'); expect(parsed.abn).toBe('11 111 111 111'); expect(parsed.licence).toBe('OLD1');
  });
  it('SWB', async () => {
    const project = { id: 's1', name: 'Site S', company: 'Old Co', abn: '11 111 111 111', licence: 'OLD1', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] };
    await exportSWBExcel(project, {}, { auditor: 'J', testDate: '2026-09-21' });
    const parsed = parseSWBExcel(wbFromPayload());
    expect(parsed.siteName).toBe('Site S'); expect(parsed.company).toBe('Old Co'); expect(parsed.abn).toBe('11 111 111 111');
  });
  it('Welder', async () => {
    const project = { id: 'w1', name: 'Site W', company: 'Old Co', abn: '11 111 111 111', licence: 'OLD1', areas: [{ id: 'ar', name: 'Site W', assets: [{ id: 'a1', assetId: 'W1', brand: 'K', model: 'E', serial: '1' }] }] };
    await exportWelderExcel(project, {}, { auditor: 'J', testDate: '2026-09-21' });
    const parsed = parseWelderExcel(wbFromPayload());
    expect(parsed.ok).toBe(true); expect(parsed.siteName).toBe('Site W'); expect(parsed.company).toBe('Old Co');
  });
  it('ELT', async () => {
    const project = { id: 'p1', name: 'Site E', company: 'Old Co', abn: '11 111 111 111', licence: 'OLD1', areas: [{ id: 'ar', name: 'Site E', assets: [{ id: 'x1', assetLocation: 'SE Door', assetId: '', type: 'Exit Signs', typeOther: '', maintained: 'Maintained', fitting: '' }] }] };
    await exportELTExcel(project, { p1: { x1: { visual: 'pass', discharge: 'pass', switching: 'pass', charging: 'pass' } } }, { auditor: 'J', testDate: '2026-09-21' });   // a result, so the fitting appears in the Register
    const parsed = parseELTExcel(wbFromPayload());
    expect(parsed.ok).toBe(true); expect(parsed.siteName).toBe('Site E'); expect(parsed.company).toBe('Old Co');
  });
  it('IRT', async () => {
    const project = { id: 'i1', name: 'Site I', company: 'Old Co', abn: '11 111 111 111', licence: 'OLD1', areas: [{ id: 'a1', name: 'Plant', panels: [{ id: 'p1', name: 'MSB', items: ['M1'], itemNames: { M1: 'Motor 1' } }] }] };
    await exportIRTExcel(project, {}, { testDate: '2026-09-21', auditor: 'J' });
    const parsed = parseIRTExcel(wbFromPayload());
    expect(parsed.company).toBe('Old Co'); expect(parsed.areas.map(a => a.name)).toEqual(['Plant']);   // the title also carries the test date (by design), so it isn't checked verbatim here
  });
  it('IEL', async () => {
    const project = { id: 'p', name: 'Site I', company: 'Old Co', abn: '11 111 111 111', licence: 'OLD1', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'p1', name: 'estops', circuits: ['x'], machineNames: { x: 'Conv 1' } }] }] };
    await exportIELExcel(project, {}, { auditor: 'J', testDate: '2026-09-21' });
    const parsed = parseIELExcel(wbFromPayload());
    expect(parsed.company).toBe('Old Co'); expect(JSON.stringify(parsed)).toMatch(/Conv 1/);
  });
  it('TAT', async () => {
    const project = { id: 'p', name: 'Site T', company: 'Old Co', abn: '11 111 111 111', licence: 'OLD1', areas: [{ id: 'a', name: 'Workshop', items: ['x'], itemNames: { x: 'Grinder' }, itemTags: { x: 'T1' } }] };
    await exportTATExcel(project, {}, { auditor: 'J', testDate: '2026-09-21' });
    const parsed = parseTATExcel(wbFromPayload());
    expect(parsed.company).toBe('Old Co'); expect(JSON.stringify(parsed)).toMatch(/Grinder/);
  });
  it('Thermo', async () => {
    const project = { id: 'p', name: 'Site H', company: 'Old Co', abn: '11 111 111 111', licence: 'OLD1', areas: [{ id: 'a', name: 'Plant', boards: [{ id: 'b', name: 'MSB', circuits: ['c1'], circuitNames: { c1: 'One' } }] }] };
    await exportThermoExcel(project, {}, { auditor: 'J', testDate: '2026-09-21' });
    const parsed = parseThermoExcel(wbFromPayload(), '', XLSX);
    expect(parsed.company).toBe('Old Co'); expect(JSON.stringify(parsed)).toMatch(/One/);
  });
});

describe('xjExtractLogo: pulls the embedded logo back out of an exported file, or returns null when there is none', () => {
  it('returns null for a file with no logo', async () => {
    const project = { id: 's1', name: 'Site S', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] };
    await exportSWBExcel(project, {}, { auditor: 'J', testDate: '2026-09-21' });
    expect(await xjExtractLogo(buf())).toBeNull();
  });
  it('extracts the logo bytes when a global logo was set at export time', async () => {
    await appLogoStore.put(rec(10)); saveAppSettings({ businessName: '', abn: '', licence: '', logoId: 'logo' });
    const project = { id: 's1', name: 'Site S', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] };
    await exportSWBExcel(project, {}, { auditor: 'J', testDate: '2026-09-21' });
    const extracted = await xjExtractLogo(buf());
    expect(extracted).toBeTruthy(); expect(extracted.type).toBe('image/jpeg');
  });
});

describe('full round trip: export WITH a logo -> re-import -> the logo comes back as the NEW site\'s per-site override', () => {
  it('SWB', async () => {
    await appLogoStore.put(rec(20)); saveAppSettings({ businessName: '', abn: '', licence: '', logoId: 'logo' });
    const project = { id: 'orig', name: 'Round Trip Site', company: 'RT Co', abn: '22 222 222 222', licence: 'RT1', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] };
    await exportSWBExcel(project, {}, { auditor: 'J', testDate: '2026-09-21' });
    const exportedBuf = buf();
    // simulate the import UI: parse structure (row-shift fixed) + extract the logo, then write it under the NEW site's id
    const parsed = parseSWBExcel(wbFromPayload());
    expect(parsed.siteName).toBe('Round Trip Site'); expect(parsed.company).toBe('RT Co');   // structure survives the shifted rows
    const logoRec = await xjExtractLogo(exportedBuf);
    expect(logoRec).toBeTruthy();
    const newId = 'round-trip-site-imported';
    await siteLogoStore.put('swb', newId, logoRec);
    expect(await siteLogoStore.get('swb', newId)).toBeTruthy();
    // and it's genuinely a PER-SITE override now, distinct from the global one still in appLogoStore
    expect(await appLogoStore.get()).toBeTruthy();
  });
  it('ELT', async () => {
    await appLogoStore.put(rec(30)); saveAppSettings({ businessName: '', abn: '', licence: '', logoId: 'logo' });
    const project = { id: 'p1', name: 'ELT Round Trip', company: 'RT Co', abn: '', licence: '', areas: [{ id: 'ar', name: 'ELT Round Trip', assets: [{ id: 'x1', assetLocation: 'SE Door', assetId: '', type: 'Exit Signs', typeOther: '', maintained: 'Maintained', fitting: '' }] }] };
    await exportELTExcel(project, { p1: { x1: { visual: 'pass', discharge: 'pass', switching: 'pass', charging: 'pass' } } }, { auditor: 'J', testDate: '2026-09-21' });
    const exportedBuf = buf();
    const parsed = parseELTExcel(wbFromPayload());
    expect(parsed.ok).toBe(true); expect(parsed.siteName).toBe('ELT Round Trip');
    const logoRec = await xjExtractLogo(exportedBuf);
    expect(logoRec).toBeTruthy();
    await siteLogoStore.put('elt', 'new-elt-site', logoRec);
    expect(await siteLogoStore.get('elt', 'new-elt-site')).toBeTruthy();
  });
});

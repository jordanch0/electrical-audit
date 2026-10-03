// Global Settings: one app-wide business identity + logo (2026-09-27). Pre-fills every module's "Add Site" form (never touches an
// already-saved site); the logo is drawn as a centred strip above the header on every export sheet — ONLY when one is set, so an
// export with no logo is unchanged. Accessed from a Home-only gear pill (Calendar's own pill is Home-only too, not "every screen").
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExcelJS from 'exceljs';
import 'fake-indexeddb/auto';
import AppRoot, { loadAppSettings, saveAppSettings, appLogoStore, xjGetLogoDataUrl, xjSheet, xjHdr, exportSWBExcel, exportWelderExcel, exportELTExcel, exportGSDExcel, exportIELExcel } from './App.jsx';
import { JPEG_A } from './test/jpeg-fixtures.js';

afterEach(() => cleanup()); beforeEach(() => localStorage.clear());
beforeAll(() => { URL.createObjectURL = () => 'blob:gs-test'; URL.revokeObjectURL = () => {}; });
let payload;
beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { delete window.webkit; });
const readWb = async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64')); return wb; };
const jpegRec = () => { const m = /^data:([^;]+);base64,(.+)$/.exec(JPEG_A); const bin = atob(m[2]); const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); return { buf: buf.buffer, type: m[1] }; };

describe('loadAppSettings / saveAppSettings', () => {
  it('defaults to blank/no logo, round-trips a save, and survives corrupt JSON', () => {
    expect(loadAppSettings()).toEqual({ businessName: '', abn: '', licence: '', logoId: null });
    saveAppSettings({ businessName: 'Vorick Group', abn: '44 601 045 872', licence: '319114c', logoId: 'logo' });
    expect(loadAppSettings()).toEqual({ businessName: 'Vorick Group', abn: '44 601 045 872', licence: '319114c', logoId: 'logo' });
    localStorage.setItem('app-settings-v1', '{not json');
    expect(loadAppSettings()).toEqual({ businessName: '', abn: '', licence: '', logoId: null });
  });
});

describe('appLogoStore + xjGetLogoDataUrl', () => {
  it('put/get/del round-trip; xjGetLogoDataUrl returns null with no logoId or a missing record, else the data URL', async () => {
    expect(await xjGetLogoDataUrl()).toBeNull();
    saveAppSettings({ businessName: '', abn: '', licence: '', logoId: 'logo' });
    expect(await xjGetLogoDataUrl()).toBeNull();                       // logoId set but nothing stored yet
    await appLogoStore.put(jpegRec());
    const url = await xjGetLogoDataUrl();
    expect(url).toMatch(/^data:image\/jpeg;base64,/);
    await appLogoStore.del();
    expect(await xjGetLogoDataUrl()).toBeNull();
  });
});

describe('exports: row 1 is ALWAYS reserved by the shared header (2026-10-02); a logo only adds the image', () => {
  const project = { id: 's1', name: 'Site S', company: 'Vorick Group', abn: '44 601 045 872', licence: '319114c', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] };
  it('xjSheet (RCD/IEL/TAT/Thermo/IRT/GSD-Register): row 1 is ALWAYS reserved for the logo (2026-10-02 shared header) — the title is on row 2 with or without one; only the image differs', async () => {
    const headers = ['A', 'B', 'C', 'D', 'E'], widths = [10, 10, 10, 10, 10];
    const hdr = logo => xjHdr('gsd', { site: 'T', company: 'C', auditor: 'J', testDate: '21/09/2026', nextDue: '21/09/2027', logo });
    const wb1 = new ExcelJS.Workbook(); xjSheet(wb1, 'S', { hdr: hdr(null), headers, widths, rows: [] });
    const ws1 = wb1.getWorksheet('S');
    expect(ws1.getCell('A1').value).toBeNull(); expect(ws1.getCell('A2').value).toBe('T  –  General Site Defects  (Punch-List Report)'); expect(ws1.getImages()).toHaveLength(0);
    const wb2 = new ExcelJS.Workbook(); xjSheet(wb2, 'S', { hdr: hdr(JPEG_A), headers, widths, rows: [] });
    const ws2 = wb2.getWorksheet('S');
    expect(ws2.getCell('A1').value).toBeNull(); expect(ws2.getCell('A2').value).toBe(ws1.getCell('A2').value); expect(ws2.getImages()).toHaveLength(1);
    expect(ws2.getCell('A6').value).toBe('A'); expect(ws1.getCell('A6').value).toBe('A');                 // the table headings are on row 6 either way
  });
  it('SWB: Register + per-board sheet carry the SAME layout with or without a logo (row 1 reserved, title on row 2) — the logo only adds an image', async () => {
    await exportSWBExcel(project, {}, { auditor: 'Jane', testDate: '2026-09-21' });
    const noLogoBuf = payload.base64;
    const noLogoWb = await readWb();
    expect(noLogoWb.getWorksheet('Register').getCell('A1').value).toBeNull(); expect(noLogoWb.getWorksheet('Register').getCell('A2').value).toContain('Switchboard');
    expect(noLogoWb.worksheets[1].getCell('A1').value).toBeNull(); expect(noLogoWb.worksheets[1].getCell('A2').value).toContain('Switchboard / Enclosure Audit');
    expect(noLogoWb.getWorksheet('Register').getImages()).toHaveLength(0);

    await appLogoStore.put(jpegRec()); saveAppSettings({ businessName: '', abn: '', licence: '', logoId: 'logo' });
    await exportSWBExcel(project, {}, { auditor: 'Jane', testDate: '2026-09-21' });
    expect(payload.base64).not.toBe(noLogoBuf);                        // a logo is present: the file is different
    const wb = await readWb();
    const reg = wb.getWorksheet('Register'); expect(reg.getCell('A1').value).toBeNull(); expect(reg.getCell('A2').value).toContain('Switchboard'); expect(reg.getImages().length).toBeGreaterThan(0);
    const board = wb.worksheets[1]; expect(board.getCell('A1').value).toBeNull(); expect(board.getCell('A2').value).toContain('Switchboard / Enclosure Audit'); expect(board.getImages().length).toBeGreaterThan(0);
    expect(reg.getCell('A2').value).toBe(noLogoWb.getWorksheet('Register').getCell('A2').value);          // the text is identical either way
  });
  it('Welder: Register + per-welder sheet reserve row 1 the same way', async () => {
    const wproj = { id: 'w1', name: 'Site W', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Site W', assets: [{ id: 'a1', assetId: 'W1', brand: 'K', model: 'E', serial: '1' }] }] };
    await appLogoStore.put(jpegRec()); saveAppSettings({ businessName: '', abn: '', licence: '', logoId: 'logo' });
    await exportWelderExcel(wproj, {}, { auditor: 'J', testDate: '2026-09-21' });
    const wb = await readWb();
    const reg = wb.getWorksheet('Register'); expect(reg.getCell('A1').value).toBeNull(); expect(reg.getCell('A2').value).toContain('Welder'); expect(reg.getImages().length).toBeGreaterThan(0);
    const per = wb.getWorksheet('W1'); expect(per.getCell('A1').value).toBeNull(); expect(per.getCell('A2').value).toBe(reg.getCell('A2').value); expect(per.getCell('A2').value).toContain('Welder Test'); expect(per.getImages().length).toBeGreaterThan(0);
  });
  it('ELT: Register, Defects AND Photos all carry the shared header (the Photos sheet had none before); the logo is drawn on each', async () => {
    const eproj = { id: 'p1', name: 'Site E', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Site E', assets: [{ id: 'x1', assetLocation: 'SE Door', assetId: '', type: 'Exit Signs', typeOther: '', maintained: 'Maintained', fitting: '' }] }] };
    await appLogoStore.put(jpegRec()); saveAppSettings({ businessName: '', abn: '', licence: '', logoId: 'logo' });
    await exportELTExcel(eproj, { p1: { x1: { visual: 'fail', notes: 'x', defectId: '1', priority: 'H', photos: [{ dataUrl: JPEG_A }] } } }, { auditor: 'J', testDate: '2026-09-21' });
    const wb = await readWb();
    const main = wb.getWorksheet('Emergency Lighting'); expect(main.getCell('A1').value).toBeNull(); expect(main.getCell('A2').value).toContain('Emergency Lighting'); expect(main.getImages().length).toBeGreaterThan(0);
    const def = wb.getWorksheet('Defects'); expect(def.getCell('A1').value).toBeNull(); expect(def.getCell('A2').value).toBe(main.getCell('A2').value); expect(def.getImages().length).toBeGreaterThan(0);
    const ph = wb.getWorksheet('Photos'); expect(ph.getCell('A1').value).toBeNull(); expect(ph.getCell('A2').value).toBe(main.getCell('A2').value); expect(ph.getCell('A6').value).toBe('Location'); expect(ph.getImages().length).toBeGreaterThan(0);   // at least the logo (this fixture's photo is a legacy inline one, which is not embedded)
  });
  it('GSD: the photo report sheet reserves row 1 (and the pagination budget grows to compensate), the Register too', async () => {
    await appLogoStore.put(jpegRec()); saveAppSettings({ businessName: '', abn: '', licence: '', logoId: 'logo' });
    await exportGSDExcel({ id: 's1', name: 'Site G', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant' }] }, [{ id: 'i', areaId: 'a1', assetLocation: '', category: '', commonDefect: '', description: 'x', descAuto: '', photos: [], priority: '', responsibility: '', dueDate: '' }], { auditor: 'J', testDate: '2026-09-21' });
    const wb = await readWb();
    const rep = wb.getWorksheet('Defects Report'); expect(rep.getCell('A1').value).toBeNull(); expect(rep.getCell('A2').value).toContain('General Site Defects'); expect(rep.getImages().length).toBeGreaterThan(0);
    const reg = wb.getWorksheet('Register'); expect(reg.getCell('A1').value).toBeNull(); expect(reg.getCell('A2').value).toContain('General Site Defects'); expect(reg.getImages().length).toBeGreaterThan(0);
  });
  it('a module using xjSplit (IEL) draws the logo on both the main sheet and the Defects sheet', async () => {
    await appLogoStore.put(jpegRec()); saveAppSettings({ businessName: '', abn: '', licence: '', logoId: 'logo' });
    await exportIELExcel({ id: 'p1', name: 'Site I', company: '', abn: '', licence: '', areas: [] }, {}, { auditor: 'J', testDate: '2026-09-21' });
    const wb = await readWb();
    wb.worksheets.forEach(ws => expect(ws.getImages().length, ws.name).toBeGreaterThan(0));
  });
});

describe('pre-fill: Global Settings values default a NEW site\'s Add Site form in every module, stay editable, never touch an existing site', () => {
  beforeEach(() => { saveAppSettings({ businessName: 'Vorick Group', abn: '44 601 045 872', licence: '319114c', logoId: null }); });

  it('RCD: the Add Site form is pre-filled and editable', async () => {
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('RCD TESTING'));
    await user.click(await screen.findByText(/\+ Add/));
    expect(await screen.findByDisplayValue('Vorick Group')).toBeTruthy();
    expect(screen.getByDisplayValue('44 601 045 872')).toBeTruthy();
    expect(screen.getByDisplayValue('319114c')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('Vorick Group'), { target: { value: 'Different Co' } });
    expect(screen.getByDisplayValue('Different Co')).toBeTruthy();
  });

  it('GSD: the Add Site form (object-shaped vals) is pre-filled too', async () => {
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('GENERAL SITE DEFECTS'));
    await user.click(await screen.findByText(/\+ Add/));
    expect(await screen.findByDisplayValue('Vorick Group')).toBeTruthy();
    expect(screen.getByDisplayValue('44 601 045 872')).toBeTruthy();
  });

  it('an existing site already saved with its own company/ABN/licence is never touched by Global Settings', async () => {
    localStorage.setItem('rcd-projects-v6', JSON.stringify([{ id: 's1', name: 'Old Site', company: 'Legacy Co', abn: '11 111 111 111', licence: 'OLD1', areas: [] }]));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('RCD TESTING'));
    await user.click(await screen.findByText('Old Site', { selector: 'div' }));
    // no UI here re-shows the stored fields directly to compare visually, so assert on storage after a no-op navigation
    expect(JSON.parse(localStorage.getItem('rcd-projects-v6'))[0].company).toBe('Legacy Co');
  });
});

describe('Global Settings screen: Home-only gear pill, save, and logo remove', () => {
  it('the gear pill opens Global Settings from Home, and Back returns to Home; Calendar\'s pill sits in the opposite corner', async () => {
    const user = userEvent.setup(); render(<AppRoot />);
    expect(screen.getByTestId('calendar-pill')).toBeTruthy();
    await user.click(screen.getByTestId('settings-pill'));
    expect(await screen.findByText('Global Settings')).toBeTruthy();
    await user.click(screen.getByText('Back'));
    expect(await screen.findByTestId('settings-pill')).toBeTruthy();
  });

  it('editing and saving business identity persists to app-settings-v1', async () => {
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByTestId('settings-pill'));
    const nameInput = (await screen.findByPlaceholderText('Company name'));
    fireEvent.change(nameInput, { target: { value: 'Vorick Group' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. 12 345 678 901'), { target: { value: '44 601 045 872' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. 123456C'), { target: { value: '319114c' } });
    await user.click(screen.getByText('Save'));
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect(loadAppSettings()).toEqual({ businessName: 'Vorick Group', abn: '44 601 045 872', licence: '319114c', logoId: null });
  });

  it('a logo already in IndexedDB shows as a preview on load, and Remove (via the shared DeleteButton confirm) clears it on Save', async () => {
    await appLogoStore.put(jpegRec()); saveAppSettings({ businessName: '', abn: '', licence: '', logoId: 'logo' });
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByTestId('settings-pill'));
    expect(await screen.findByAltText('Logo')).toBeTruthy();
    const bin = screen.getAllByRole('button').find(b => b.textContent === '' && b.querySelector('svg') && !b.getAttribute('aria-label'));
    await user.click(bin);                                              // DeleteButton idle state
    await user.click(await screen.findByRole('button', { name: /Delete$/ }));
    expect(await screen.findByText('No logo set')).toBeTruthy();
    await user.click(screen.getByText('Save'));
    await screen.findByText('Saved');
    expect(loadAppSettings().logoId).toBeNull();
    expect(await appLogoStore.get()).toBeUndefined();
  });
});

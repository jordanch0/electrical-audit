// Per-site logo override (2026-09-27), Stage 1: storage + export resolution. A site's own logo overrides the global one, exactly like a
// site's own Company/ABN/Licence already override the global pre-fill — resolution order is site -> global -> none. Keyed by
// `${module}:${siteId}` because every module makes site ids from a plain slugify(name) with no random suffix, so two different modules'
// sites can share an id (same-named sites in RCD and SWB, say) and must not share a logo.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExcelJS from 'exceljs';
import 'fake-indexeddb/auto';
import AppRoot, { saveAppSettings, appLogoStore, siteLogoStore, xjGetLogoDataUrl, exportSWBExcel } from './App.jsx';

let payload;
beforeEach(() => { localStorage.clear(); payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { delete window.webkit; cleanup(); });
const readWb = async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64')); return wb; };
const rec = byte => ({ buf: new Uint8Array([byte]).buffer, type: 'image/jpeg' });

describe('siteLogoStore + xjGetLogoDataUrl resolution order', () => {
  it('no site logo, no global logo -> null', async () => {
    expect(await xjGetLogoDataUrl('rcd', 's1')).toBeNull();
  });
  it('no site logo, a global logo -> the global one', async () => {
    await appLogoStore.put(rec(1)); saveAppSettings({ businessName: '', abn: '', licence: '', logoId: 'logo' });
    const url = await xjGetLogoDataUrl('rcd', 's1');
    expect(url).toMatch(/^data:image\/jpeg;base64,/);
  });
  it('a site logo AND a global logo -> the site one wins', async () => {
    await appLogoStore.put(rec(1)); saveAppSettings({ businessName: '', abn: '', licence: '', logoId: 'logo' });
    await siteLogoStore.put('rcd', 's1', rec(2));
    const siteUrl = await xjGetLogoDataUrl('rcd', 's1'); const globalUrl = await xjGetLogoDataUrl('rcd', 's2');
    expect(siteUrl).not.toBe(globalUrl);                                  // different bytes -> different data URLs
    expect(globalUrl).not.toBeNull();                                     // a DIFFERENT site with no override still gets the global one
  });
  it('a site logo, no global logo -> the site one', async () => {
    await siteLogoStore.put('swb', 's1', rec(3));
    expect(await xjGetLogoDataUrl('swb', 's1')).toMatch(/^data:image\/jpeg;base64,/);
    expect(await xjGetLogoDataUrl('swb', 's2')).toBeNull();               // a different site: no override, no global -> none
  });
  it('module + siteId are both part of the key: the SAME site id in two different modules never share a logo', async () => {
    await siteLogoStore.put('rcd', 'shared-id', rec(4));
    expect(await xjGetLogoDataUrl('rcd', 'shared-id')).not.toBeNull();
    expect(await xjGetLogoDataUrl('swb', 'shared-id')).toBeNull();        // same id, different module: no bleed-through
  });
  it('put/get/del round-trip', async () => {
    await siteLogoStore.put('gsd', 'g1', rec(5));
    expect(await siteLogoStore.get('gsd', 'g1')).toBeTruthy();
    await siteLogoStore.del('gsd', 'g1');
    expect(await siteLogoStore.get('gsd', 'g1')).toBeUndefined();
  });
});

describe('export resolution really reaches the workbook (SWB, a direct-write sheet)', () => {
  const project = { id: 's1', name: 'Site S', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] };
  it('a per-site logo is drawn even with no global logo set', async () => {
    await siteLogoStore.put('swb', 's1', rec(6));
    await exportSWBExcel(project, {}, { auditor: 'J', testDate: '2026-09-21' });
    const wb = await readWb();
    expect(wb.getWorksheet('Register').getImages().length).toBeGreaterThan(0);
  });
  it('the SITE logo (not the global one) is what gets embedded when both exist', async () => {
    await appLogoStore.put(rec(1)); saveAppSettings({ businessName: '', abn: '', licence: '', logoId: 'logo' });
    await exportSWBExcel(project, {}, { auditor: 'J', testDate: '2026-09-21' });
    const globalOnlyBuf = payload.base64;
    await siteLogoStore.put('swb', 's1', rec(9));
    await exportSWBExcel(project, {}, { auditor: 'J', testDate: '2026-09-21' });
    expect(payload.base64).not.toBe(globalOnlyBuf);                       // different embedded bytes -> different file
  });
  it('a DIFFERENT site with no override still falls back to the global logo', async () => {
    await appLogoStore.put(rec(1)); saveAppSettings({ businessName: '', abn: '', licence: '', logoId: 'logo' });
    await siteLogoStore.put('swb', 's1', rec(9));                         // s1 has its own override
    const other = { ...project, id: 's2', name: 'Site T' };
    await exportSWBExcel(other, {}, { auditor: 'J', testDate: '2026-09-21' });
    const wb = await readWb();
    expect(wb.getWorksheet('Register').getImages().length).toBeGreaterThan(0);   // still gets a logo — the global one
  });
});

describe('deleting a site also deletes its per-site logo (mirrors GSD photo cleanup on delete)', () => {
  it('RCD', async () => {
    localStorage.setItem('rcd-projects-v6', JSON.stringify([{ id: 'old-site', name: 'Old Site', company: '', abn: '', licence: '', areas: [] }]));
    await siteLogoStore.put('rcd', 'old-site', rec(1));
    expect(await siteLogoStore.get('rcd', 'old-site')).toBeTruthy();
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('RCD TESTING'));
    const bin = (await screen.findAllByRole('button')).find(b => b.textContent === '' && b.querySelector('svg') && !b.getAttribute('aria-label'));
    await user.click(bin); await user.click(await screen.findByRole('button', { name: /Delete$/ }));
    expect(await siteLogoStore.get('rcd', 'old-site')).toBeUndefined();
  });
});

// THE SHARE HAND-OVER THROUGH THE REAL SCREENS (release t), all nine modules. FICTIONAL seeded data (src/test/pill-seed.cjs), real clicks. The window is made a phone (touch points, a coarse pointer, navigator.share / canShare mocks,
// downloads counted, no native bridge). History list (9 modules) and snapshot page header (8, not RCD): Export builds the real workbook and HOLDS it (ready card, Share file 44 px); a new Export replaces the file; Discard drops it;
// a closed sheet keeps it; a double tap opens the sheet once; a refused sheet downloads once; leaving the screen drops the card. Blank templates (8, not GSD): one step, shared in the tap, with the closed and refused notes.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, configure, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import AppRoot from './App.jsx';
import seed from './test/pill-seed.cjs';
import { phoneOn, phoneOff, downloadsOn, abortError, named } from './test/share-env.js';

vi.setConfig({ testTimeout: 60000 });
configure({ asyncUtilTimeout: 10000 });
const { build } = seed;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MODS = [
  ['rcd-push', 'Complete Push Test', 'View Results', false, 'rcd'], ['iel', 'Complete IEL Audit', 'View Results', true, 'iel'], ['tat', 'Complete Test & Tag Audit', 'View Results', true, 'tat'], ['thermo', 'Complete Thermographic Audit', 'View', true, 'thermo'],
  ['swb', 'Complete Switchboard Audit', 'View Results', true, 'swb'], ['irt', 'Complete IR Testing Audit', 'View Results', true, 'irt'], ['elt', 'Complete Emergency Lighting Audit', 'View Results', true, 'elt'], ['welder', 'Complete Welder Audit', 'View Results', true, 'welder'],
  ['gsd', 'Complete Site Defects Audit', 'View Results', true, 'gsd'],
];
let share, d, warn;
beforeEach(() => { cleanup(); localStorage.clear(); warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); share = phoneOn({ share: vi.fn(async () => {}) }); d = downloadsOn(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); phoneOff(); });
const pause = ms => new Promise(r => setTimeout(r, ms));
async function toHistory(mod, complete) {
  const x = build(mod, 'nologo'); Object.entries(x.ls).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  const user = userEvent.setup(); render(<AppRoot />); await user.click(await screen.findByText(x.flow.card));
  await user.click((await screen.findAllByText('Example Quarry', { selector: 'div' }))[0]); await pause(80);
  await user.click((await screen.findAllByRole('button', { name: new RegExp(complete) }))[0]); await user.click((await screen.findAllByRole('button', { name: /Yes, Complete/ }))[0]); await pause(150);
  await user.click((await screen.findAllByRole('button', { name: 'History' }))[0]); await pause(60);
  return user;
}
const exportBtn = async () => (await screen.findAllByRole('button', { name: /^Export$/ }))[0];
const exportLogs = () => warn.mock.calls.filter(a => a[0] === '[SparkCheck export]').map(a => a.slice(1));
const ready = () => screen.findByTestId('export-ready');
const FOLLOWS = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe.each(MODS)('%s', (mod, complete, viewName, hasDetail, key) => {
  it('History list: ready card after the Export button, a new Export replaces the file, Discard drops it, a closed sheet keeps it, a double tap opens the sheet once, a refused sheet downloads once, leaving drops the card', async () => {
    const user = await toHistory(mod, complete); await user.click((await screen.findAllByText(/^Archived /))[0]); await pause(30);
    let b = await exportBtn(); await user.click(b); let card = await ready();
    expect(FOLLOWS(b, card), 'the ready card follows the Export button').toBe(true); expect(card.textContent).toMatch(/^Excel file ready.+\.xlsx.*Not saved yet\. Tap Share file\.Share fileDiscard this file$/);
    expect(share).not.toHaveBeenCalled(); expect(d.created).toEqual([]); expect(screen.queryByTestId('export-failed')).toBeNull(); expect((await exportBtn()).getAttribute('aria-busy')).toBeNull();
    expect(screen.getByTestId('export-share').style.minHeight).toBe('44px'); expect(screen.getByTestId('export-discard').style.minHeight).toBe('44px'); expect(b.style.minHeight).toBe('44px');
    // a new Export replaces the held file (still exactly one ready card)
    await user.click(await exportBtn()); await ready(); expect(screen.getAllByTestId('export-ready')).toHaveLength(1);
    // Discard drops it
    await user.click(screen.getByTestId('export-discard')); expect(screen.queryByTestId('export-ready')).toBeNull(); expect(share).not.toHaveBeenCalled();
    // a closed sheet keeps the file
    share.mockRejectedValueOnce(abortError()); await user.click(await exportBtn()); await ready(); await user.click(screen.getByTestId('export-share')); await act(async () => {});
    expect(screen.getByTestId('export-ready').textContent).toMatch(/^The share sheet was closed, so the file was not saved\./); expect(screen.queryByTestId('export-failed')).toBeNull(); expect(exportLogs()).toEqual([]); expect(d.created).toEqual([]);
    // a double tap opens the sheet once, with the file only
    const s = screen.getByTestId('export-share'); fireEvent.click(s); fireEvent.click(s); expect(share).toHaveBeenCalledTimes(2);                  // the closed one + this one
    const shared = await screen.findByTestId('export-shared'); expect(shared.textContent).toMatch(/^Excel file shared/);
    const arg = share.mock.calls[1][0]; expect(Object.keys(arg)).toEqual(['files']); expect(arg.files[0].name).toMatch(/^[A-Za-z0-9_&()'.-]+\.xlsx$/); expect(arg.files[0].name).toContain('Example_Quarry'); expect(arg.files[0].type).toBe(XLSX_MIME); expect(arg.files[0].size).toBeGreaterThan(1000);
    // a refused sheet downloads once and says so
    share.mockRejectedValueOnce(named('NotAllowedError')); await user.click(await exportBtn()); await ready(); await user.click(screen.getByTestId('export-share'));
    const dl = await screen.findByTestId('export-downloaded'); expect(dl.textContent).toMatch(/^Excel file download startedThis phone could not open the share sheet/); expect(d.clicks).toHaveLength(1); expect(d.clicks[0]).toBe(arg.files[0].name);
    expect(exportLogs()).toEqual([['share-refused', key, 'NotAllowedError']]); expect(JSON.stringify(warn.mock.calls)).not.toContain('Example Quarry');
    // leaving the screen drops the card
    await user.click((await screen.findAllByRole('button', { name: 'Home' }))[0]); await pause(40); await user.click((await screen.findAllByRole('button', { name: 'History' }))[0]); await pause(40);
    await user.click((await screen.findAllByText(/^Archived /))[0]); await pause(30);
    expect(screen.queryByTestId('export-downloaded')).toBeNull(); expect(screen.queryByTestId('export-shared')).toBeNull(); expect(screen.queryByTestId('export-ready')).toBeNull();
  });
  if (hasDetail) it('snapshot page: the ready card sits under the header Export button (44 px), a double tap on Share file opens the sheet once, then "Excel file shared"', async () => {
    const user = await toHistory(mod, complete); await user.click((await screen.findAllByText(/^Archived /))[0]); await pause(30);
    await user.click((await screen.findAllByRole('button', { name: new RegExp('^' + viewName) }))[0]); await pause(80);
    const b = await exportBtn(); expect(b.style.minHeight).toBe('44px'); await user.click(b); const card = await ready(); expect(FOLLOWS(b, card), 'the card follows the header Export button').toBe(true);
    const s = screen.getByTestId('export-share'); fireEvent.click(s); fireEvent.click(s); expect(share).toHaveBeenCalledTimes(1); await screen.findByTestId('export-shared'); expect(share.mock.calls[0][0].files[0].name).toContain('Example_Quarry'); expect(d.created).toEqual([]);
  });
});

describe('blank templates, in one step, through the real site lists', () => {
  const TEMPLATE_MODS = MODS.filter(m => m[0] !== 'gsd');
  async function toTemplate(mod) {
    const x = build(mod, 'nologo'); Object.entries(x.ls).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
    const user = userEvent.setup(); render(<AppRoot />); await user.click(await screen.findByText(x.flow.card)); await pause(100);
    await user.click((await screen.findAllByRole('button', { name: /Add \/ Import Site/ }))[0]); await pause(60);
    await user.click((await screen.findAllByRole('button', { name: /^Import( from)? Excel$/ }))[0]); await pause(60);
    return user;
  }
  it.each(TEMPLATE_MODS)('%s: Download Import Template opens the share sheet in the tap itself, once, with the fixed template name; nothing is shown; no ready card', async (mod, _c, _v, _h, key) => {
    await toTemplate(mod); const b = (await screen.findAllByRole('button', { name: /Download Import Template/ }))[0];
    fireEvent.click(b); expect(share).toHaveBeenCalledTimes(1); fireEvent.click(b); expect(share).toHaveBeenCalledTimes(1);
    const arg = share.mock.calls[0][0]; expect(Object.keys(arg)).toEqual(['files']); expect(arg.files[0].name).toMatch(/_Import_Template\.xlsx$/); expect(arg.files[0].type).toBe(XLSX_MIME); expect(arg.files[0].size).toBeGreaterThan(500);
    await act(async () => {}); ['export-ready', 'export-shared', 'export-closed', 'export-downloaded', 'export-failed'].forEach(t => expect(screen.queryByTestId(t), t).toBeNull()); expect(d.created).toEqual([]); expect(exportLogs()).toEqual([]);
  });
  it.each(TEMPLATE_MODS)('%s: a closed sheet leaves the template note, a refused sheet downloads once ("Template download started")', async (mod, _c, _v, _h, key) => {
    share.mockRejectedValueOnce(abortError()); const user = await toTemplate(mod); let b = (await screen.findAllByRole('button', { name: /Download Import Template/ }))[0];
    await user.click(b); const closed = await screen.findByTestId('export-closed'); expect(closed.textContent).toBe('The share sheet was closed, so the template was not saved.Tap Download Import Template to try again.'); expect(screen.queryByTestId('export-failed')).toBeNull(); expect(exportLogs()).toEqual([]);
    share.mockRejectedValueOnce(named('NotAllowedError')); b = (await screen.findAllByRole('button', { name: /Download Import Template/ }))[0]; await user.click(b);
    const dl = await screen.findByTestId('export-downloaded'); expect(dl.textContent).toMatch(/^Template download started/); expect(d.clicks).toHaveLength(1); expect(d.clicks[0]).toMatch(/_Import_Template\.xlsx$/); expect(exportLogs()).toEqual([['share-refused', key, 'NotAllowedError']]);
  });
});

describe('failures through a real screen on a phone', () => {
  it('IEL: the workbook cannot be built -> "could not be made" and no ready card; the next good export is held again', async () => {
    const ExcelJS = (await import('exceljs')).default; const spy = vi.spyOn(ExcelJS.Workbook.prototype, 'addWorksheet').mockImplementation(() => { throw new RangeError('ZQ boom'); });
    const user = await toHistory('iel', 'Complete IEL Audit'); await user.click((await screen.findAllByText(/^Archived /))[0]); await user.click(await exportBtn());
    const c = await screen.findByTestId('export-failed'); expect(c.textContent).toMatch(/^The Excel file could not be made/); expect(screen.queryByTestId('export-ready')).toBeNull(); expect(exportLogs()).toEqual([['build-failed', 'iel', 'RangeError']]);
    spy.mockRestore(); await user.click(await exportBtn()); await ready(); expect(screen.queryByTestId('export-failed')).toBeNull(); expect(share).not.toHaveBeenCalled();
  });
  it('IEL: a refused sheet and a download that also fails -> "could not be saved"', async () => {
    cleanup(); vi.restoreAllMocks(); warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); d = downloadsOn({ failClick: true }); share.mockRejectedValue(named('NotAllowedError'));
    const user = await toHistory('iel', 'Complete IEL Audit'); await user.click((await screen.findAllByText(/^Archived /))[0]); await user.click(await exportBtn()); await ready(); await user.click(screen.getByTestId('export-share'));
    const c = await screen.findByTestId('export-failed'); expect(c.textContent).toMatch(/^The Excel file could not be saved/); expect(exportLogs()).toEqual([['share-refused', 'iel', 'NotAllowedError'], ['deliver-failed', 'iel', 'ExportDeliveryError']]);
  });
});

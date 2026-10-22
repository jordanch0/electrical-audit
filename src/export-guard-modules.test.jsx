// EXPORT GUARD THROUGH THE REAL SCREENS (release r), all nine modules. FICTIONAL seeded data (src/test/pill-seed.cjs), real clicks: complete an audit, open History, open the snapshot, press Export.
// The hand-over is made to fail (the native bridge throws), so the workbook is really built first. In every module: the card appears AFTER the Export button that was pressed (under the snapshot in the list, under
// the header on the snapshot page), says what failed, and clears on the next good export; a good export is delivered to the bridge as before. No browser dialog is ever used.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import AppRoot from './App.jsx';
import seed from './test/pill-seed.cjs';

vi.setConfig({ testTimeout: 60000 });
configure({ asyncUtilTimeout: 10000 });
const { build } = seed;
const MODS = [
  ['rcd-push', 'Complete Push Test', 'View Results', false], ['iel', 'Complete IEL Audit', 'View Results', true], ['tat', 'Complete Test & Tag Audit', 'View Results', true], ['thermo', 'Complete Thermographic Audit', 'View', true],
  ['swb', 'Complete Switchboard Audit', 'View Results', true], ['irt', 'Complete IR Testing Audit', 'View Results', true], ['elt', 'Complete Emergency Lighting Audit', 'View Results', true], ['welder', 'Complete Welder Audit', 'View Results', true],
  ['gsd', 'Complete Site Defects Audit', 'View Results', true],
];
let posts, failNext, warn, alertSpy;
beforeEach(() => {
  cleanup(); localStorage.clear(); posts = []; failNext = true; warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); alertSpy = vi.fn(); vi.stubGlobal('alert', alertSpy);
  window.webkit = { messageHandlers: { shareFile: { postMessage: p => { if (failNext) throw new Error('forced'); posts.push(p); } } } };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); delete window.webkit; });
const pause = ms => new Promise(r => setTimeout(r, ms));
async function toHistory(mod, complete) {
  const d = build(mod, 'nologo'); Object.entries(d.ls).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  const user = userEvent.setup(); render(<AppRoot />); await user.click(await screen.findByText(d.flow.card));
  await user.click((await screen.findAllByText('Example Quarry', { selector: 'div' }))[0]); await pause(80);
  await user.click((await screen.findAllByRole('button', { name: new RegExp(complete) }))[0]); await user.click((await screen.findAllByRole('button', { name: /Yes, Complete/ }))[0]); await pause(150);
  await user.click((await screen.findAllByRole('button', { name: 'History' }))[0]); await pause(60);
  return user;
}
const exportBtn = async () => (await screen.findAllByRole('button', { name: /Export/ }))[0];
const FOLLOWS = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe.each(MODS)('%s', (mod, complete, viewName, hasDetail) => {
  it('History list: a failed export shows the card after the pressed Export button; the next good export clears it and delivers', async () => {
    const user = await toHistory(mod, complete);
    await user.click((await screen.findAllByText(/^Archived /))[0]); await pause(30);
    let b = await exportBtn(); await user.click(b);
    const c = await screen.findByTestId('export-failed'); expect(c.textContent).toBe('The Excel file could not be savedNothing on this phone was changed. Please try again.');
    expect(c.getAttribute('role')).toBe('alert'); expect(FOLLOWS(b, c), 'the card follows the Export button').toBe(true);
    expect(screen.getAllByTestId('export-failed')).toHaveLength(1); expect(alertSpy).not.toHaveBeenCalled();
    failNext = false; b = await exportBtn(); await user.click(b); await pause(400);
    expect(screen.queryByTestId('export-failed')).toBeNull(); expect(posts).toHaveLength(1); expect(posts[0].base64.length).toBeGreaterThan(100); expect(posts[0].filename).toMatch(/\.xlsx$/);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('Example Quarry');
  });
  if (hasDetail) it('snapshot page: the card sits under the header Export button, and clears on the next good export', async () => {
    const user = await toHistory(mod, complete);
    await user.click((await screen.findAllByText(/^Archived /))[0]); await pause(30);
    await user.click((await screen.findAllByRole('button', { name: new RegExp('^' + viewName) }))[0]); await pause(80);
    let b = await exportBtn(); await user.click(b);
    const c = await screen.findByTestId('export-failed'); expect(FOLLOWS(b, c), 'the card follows the header Export button').toBe(true); expect(c.textContent).toMatch(/^The Excel file could not be saved/);
    failNext = false; await user.click(await exportBtn()); await pause(400);
    expect(screen.queryByTestId('export-failed')).toBeNull(); expect(posts).toHaveLength(1);
  });
});

describe('a build failure (not the hand-over) through a real screen', () => {
  it('IEL: the workbook cannot be built -> "could not be made", the log holds the code, the module and the error name only', async () => {
    const ExcelJS = (await import('exceljs')).default; const spy = vi.spyOn(ExcelJS.Workbook.prototype, 'addWorksheet').mockImplementation(() => { throw new RangeError('ZQ boom'); });
    failNext = false; const user = await toHistory('iel', 'Complete IEL Audit'); await user.click((await screen.findAllByText(/^Archived /))[0]); await user.click(await exportBtn());
    const c = await screen.findByTestId('export-failed'); expect(c.textContent).toMatch(/^The Excel file could not be made/);
    expect(warn.mock.calls.filter(a => a[0] === '[SparkCheck export]')).toEqual([['[SparkCheck export]', 'build-failed', 'iel', 'RangeError']]); expect(posts).toEqual([]);
    spy.mockRestore(); await user.click(await exportBtn()); await pause(400); expect(screen.queryByTestId('export-failed')).toBeNull(); expect(posts).toHaveLength(1);
  });
});

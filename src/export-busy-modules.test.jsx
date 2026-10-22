// THE EXPORT BUTTON SHOWS THAT IT IS WORKING, THROUGH THE REAL SCREENS (release s), all nine modules. FICTIONAL seeded data (src/test/pill-seed.cjs), real clicks: complete an audit, open History, press Export. The workbook
// build is HELD at its last step (the ExcelJS writeBuffer call) so the busy state can be looked at: in every module the pressed button says Making… (aria-busy, still focusable, a live region speaks), its neighbours
// do not, a second tap starts nothing, and once the build is let go the file is delivered and the label is back. The History list button and the snapshot page header button (not RCD: it has none) are both covered.
// The blank template buttons are covered by the source scan in export-guard-scan.test.jsx (their build finishes in the same tick, so there is no state to look at).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, configure, act } from '@testing-library/react';
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
let posts, writes, hold, openGate, spy;
beforeEach(async () => {
  cleanup(); localStorage.clear(); posts = []; writes = 0; vi.spyOn(console, 'warn').mockImplementation(() => {});
  window.webkit = { messageHandlers: { shareFile: { postMessage: p => { posts.push(p); } } } };
  const ExcelJS = (await import('exceljs')).default; const real = Object.getOwnPropertyDescriptor(ExcelJS.Workbook.prototype, 'xlsx');
  if (!real || !real.get) throw new Error('ExcelJS Workbook.xlsx is no longer a getter: the hold in this test needs updating');
  hold = null; openGate = () => {};
  spy = vi.spyOn(ExcelJS.Workbook.prototype, 'xlsx', 'get').mockImplementation(function () {
    const x = real.get.call(this);
    return { writeBuffer: async (...a) => { writes++; if (hold) await hold; return x.writeBuffer(...a); }, write: (...a) => x.write(...a) };
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); delete window.webkit; });
const pause = ms => new Promise(r => setTimeout(r, ms));
const holdBuild = () => { hold = new Promise(r => { openGate = r; }); };
async function toHistory(mod, complete) {
  const d = build(mod, 'nologo'); Object.entries(d.ls).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  const user = userEvent.setup(); render(<AppRoot />); await user.click(await screen.findByText(d.flow.card));
  await user.click((await screen.findAllByText('Example Quarry', { selector: 'div' }))[0]); await pause(80);
  await user.click((await screen.findAllByRole('button', { name: new RegExp(complete) }))[0]); await user.click((await screen.findAllByRole('button', { name: /Yes, Complete/ }))[0]); await pause(150);
  await user.click((await screen.findAllByRole('button', { name: 'History' }))[0]); await pause(60);
  return user;
}
const exportBtn = async () => (await screen.findAllByRole('button', { name: /^Export$/ }))[0];
const busyBtn = () => screen.getByRole('button', { name: 'Making…' });
const livesNow = () => screen.getAllByTestId('export-live').map(e => e.textContent).filter(Boolean);

async function busyCycle(user) {
  holdBuild(); const b = await exportBtn(); await user.click(b); await pause(40);
  const bb = busyBtn(); expect(bb).toBe(b); expect(bb.getAttribute('aria-busy')).toBe('true'); expect(bb.getAttribute('aria-disabled')).toBe('true'); expect(bb.disabled).toBe(false);
  act(() => bb.focus()); expect(document.activeElement).toBe(bb);
  expect(livesNow()).toEqual(['Making the Excel file. Please wait.']);
  const others = screen.getAllByRole('button').filter(x => x !== bb && x.getAttribute('aria-busy')); expect(others).toEqual([]);
  await user.click(bb); await pause(20); expect(writes, 'a second tap starts no second build').toBe(1);
  openGate(); await pause(500);
  expect(screen.queryByRole('button', { name: 'Making…' })).toBeNull(); expect((await exportBtn()).getAttribute('aria-busy')).toBeNull(); expect(livesNow()).toEqual([]);
  expect(posts).toHaveLength(1); expect(posts[0].filename).toMatch(/\.xlsx$/); expect(screen.queryByTestId('export-failed')).toBeNull();
}

describe.each(MODS)('%s', (mod, complete, viewName, hasDetail) => {
  it('History list: Export says Making… while the build is held, then the file is delivered and the label is back', async () => {
    const user = await toHistory(mod, complete); await user.click((await screen.findAllByText(/^Archived /))[0]); await pause(30);
    await busyCycle(user);
  });
  if (hasDetail) it('snapshot page: the header Export says Making… while the build is held, then the file is delivered and the label is back', async () => {
    const user = await toHistory(mod, complete); await user.click((await screen.findAllByText(/^Archived /))[0]); await pause(30);
    await user.click((await screen.findAllByRole('button', { name: new RegExp('^' + viewName) }))[0]); await pause(80);
    await busyCycle(user);
  });
});

describe('a failed build through a real screen', () => {
  it('IEL: the label comes back and the card shows', async () => {
    const user = await toHistory('iel', 'Complete IEL Audit'); await user.click((await screen.findAllByText(/^Archived /))[0]);
    const ExcelJS = (await import('exceljs')).default; spy.mockRestore(); const sp = vi.spyOn(ExcelJS.Workbook.prototype, 'addWorksheet').mockImplementation(() => { throw new RangeError('boom'); });
    await user.click(await exportBtn()); const c = await screen.findByTestId('export-failed'); expect(c.textContent).toMatch(/^The Excel file could not be made/);
    expect(screen.queryByRole('button', { name: 'Making…' })).toBeNull(); expect((await exportBtn()).getAttribute('aria-busy')).toBeNull(); expect(livesNow()).toEqual([]); sp.mockRestore();
  });
});

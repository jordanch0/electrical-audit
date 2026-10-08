// SWB BOARD-LEVEL DATE (FICTIONAL data). The board page (Board Photos, then the list of tests) has its own DATE TESTED and read-only NEXT TEST DUE directly under Add Photo, stored as the scalar
// `_lastTested` on the board record. Stamped with the Home date at the first result in the board; a changed result keeps it; clearing every result clears it; Reset (board / site) and Complete clear it;
// a hand-edited date holds and clearing it by hand re-stamps the Home date; shown only once a test on the board has a result; NEXT TEST DUE (+1 year, the Home chosen date wins) for PASS / FAIL only.
// It is INDEPENDENT of the per-test dates (neither rewrites the other). Migration: a board with results and no board date gets the EARLIEST per-test date on it (never the live Home date; blank stays
// blank; not gated on dateDay); Export: the Register and the header use the board date. Every reader of a board record tolerates the scalar key.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExcelJS from 'exceljs';
import AppRoot, { exportSWBExcel, swbRegisterRows, swbBoardSummary, swbGetBoardPhotos, swbExtractPhotos, swbPhotoList, swbBoardHasResult, swbBoardTested, swbBoardDateApply, itemDatesMigrate, SWB_CHECKLIST } from './App.jsx';
import { ls, day, HOME, TODAY, at, site, setDate, homeTab, completeAudit, resetAudit } from './test/item-dates-ui.js';

const K = SWB_CHECKLIST.map(c => c.key);
const areas = [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }, { id: 'b2', name: 'DB1' }] }];
const META = { auditor: 'Jane', testDate: HOME, nextTestDate: '2027-10-05', dateDay: TODAY };
const board = (b = 'b1') => (ls('swb-results-v1').s1 || { a1: {} }).a1[b] || {};
beforeEach(() => { localStorage.clear(); localStorage.setItem('swb-projects-v1', JSON.stringify([site(areas)])); localStorage.setItem('swb-meta-v1', JSON.stringify({ s1: META })); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openBoard(user, name = 'MSB') {
  render(<AppRoot />); await user.click(screen.getByText('SWITCHBOARD', { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' }));
  await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ })); await user.click(await screen.findByText('Plant')); await user.click(await screen.findByText(name, { exact: true }));
  await screen.findByText('BOARD PHOTOS');
}
const back = user => user.click(screen.getAllByText('Back')[0]);
const onBoardPage = () => screen.queryByText('BOARD PHOTOS') !== null;
async function setResult(user, test, status) { await user.click(await screen.findByText(test)); await user.click(screen.getByRole('button', { name: status })); await back(user); await screen.findByText('BOARD PHOTOS'); }

describe('pure rules', () => {
  it('swbBoardHasResult / swbBoardTested: any result vs PASS / FAIL only (N/A is not a test)', () => {
    expect(swbBoardHasResult({})).toBe(false); expect(swbBoardHasResult({ [K[0]]: { status: 'untested' } })).toBe(false); expect(swbBoardHasResult({ [K[0]]: { status: 'na' } })).toBe(true);
    expect(swbBoardTested({ [K[0]]: { status: 'na' } })).toBe(false); expect(swbBoardTested({ [K[0]]: { status: 'pass' } })).toBe(true); expect(swbBoardTested({ [K[0]]: { status: 'fail' } })).toBe(true);
  });
  it('swbBoardDateApply: first result stamps the Home date; a changed result keeps it; no result clears it; nothing is stamped on a board with no results', () => {
    const none = { _photos: [{ id: 'p', w: 1, h: 1 }], [K[0]]: { status: 'untested' } };
    expect(swbBoardDateApply(none, HOME)).toEqual(none);                                                       // no results: nothing added (and _photos untouched)
    const first = swbBoardDateApply({ ...none, [K[0]]: { status: 'pass' } }, HOME); expect(first._lastTested).toBe(HOME); expect(first._photos).toEqual(none._photos);
    expect(swbBoardDateApply({ ...first, [K[0]]: { status: 'fail' } }, '2030-01-01')._lastTested).toBe(HOME);   // changed result: kept
    expect(swbBoardDateApply({ ...first, [K[0]]: { status: 'untested' } }, HOME)).not.toHaveProperty('_lastTested');   // cleared
    expect(swbBoardDateApply({ [K[0]]: { status: 'na' } }, HOME)._lastTested).toBe(HOME);                       // N/A is a result for the date
  });
});

describe('board page', () => {
  it('no date field until a test on the board has a result; the first result stamps the HOME date (not today) on the board AND on the test; the page shows it under Add Photo with NEXT TEST DUE +1 year', async () => {
    at(7); const user = userEvent.setup(); await openBoard(user);
    expect(screen.queryByLabelText('Date tested')).toBeNull(); expect(screen.queryByText('NEXT TEST DUE:')).toBeNull();
    await setResult(user, 'Enclosure Condition', 'PASS');
    expect(board()._lastTested).toBe(HOME); expect(board().enclosure.lastTested).toBe(HOME);
    expect(screen.getByLabelText('Date tested')).toBeInTheDocument(); expect(screen.getByTestId('date-box').textContent).toBe('05/10/2026'); expect(screen.getByText('NEXT TEST DUE:')).toBeInTheDocument(); expect(screen.getByText('05/10/2027')).toBeInTheDocument();
    const photos = screen.getByText('BOARD PHOTOS'), date = screen.getByText('DATE TESTED'), first = screen.getByText('Enclosure Condition');
    expect(photos.compareDocumentPosition(date) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); expect(date.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();   // photos, then the date, then the tests
  });
  it('a changed result keeps the board date (even days later); a second board is unaffected', async () => {
    at(7); const user = userEvent.setup(); await openBoard(user); await setResult(user, 'Enclosure Condition', 'PASS');
    at(9); await setResult(user, 'Enclosure Condition', 'FAIL'); expect(board()._lastTested).toBe(HOME);
    await setResult(user, 'Ventilation', 'PASS'); expect(board()._lastTested).toBe(HOME);                     // a second result: still the first stamp
    expect(board('b2')._lastTested).toBeUndefined();
  });
  it('clearing every result in the board clears the board date and hides the field; one remaining result keeps it', async () => {
    at(7); const user = userEvent.setup(); await openBoard(user); await setResult(user, 'Enclosure Condition', 'PASS'); await setResult(user, 'Ventilation', 'FAIL');
    await setResult(user, 'Enclosure Condition', '—'); expect(board()._lastTested).toBe(HOME); expect(screen.getByLabelText('Date tested')).toBeInTheDocument();
    await setResult(user, 'Ventilation', '—'); expect(board()).not.toHaveProperty('_lastTested'); expect(screen.queryByLabelText('Date tested')).toBeNull();
    await setResult(user, 'Enclosure Condition', 'PASS'); expect(board()._lastTested).toBe(HOME);                // a new first result stamps again
  });
  it('N/A only: the date shows, but NEXT TEST DUE does not (N/A is not a test); a PASS then brings it', async () => {
    at(7); const user = userEvent.setup(); await openBoard(user); await setResult(user, 'Enclosure Condition', 'N/A');
    expect(screen.getByLabelText('Date tested')).toBeInTheDocument(); expect(screen.queryByText('NEXT TEST DUE:')).toBeNull();
    await setResult(user, 'Ventilation', 'PASS'); expect(screen.getByText('NEXT TEST DUE:')).toBeInTheDocument();
  });
  // INTENTIONAL (accepted): the board date is stamped at the first result of ANY kind. A board whose first result was an N/A on an earlier day keeps that earlier day as its board date,
  // even when the first PASS or FAIL comes on a later day. (N/A still never counts for NEXT TEST DUE or for the export header on its own.)
  it('an N/A answered on an earlier day than the first PASS / FAIL gives the board that EARLIER day, and a later PASS does not move it (intentional)', async () => {
    at(2); localStorage.setItem('swb-meta-v1', JSON.stringify({ s1: { ...META, testDate: '2026-10-01', dateDay: '2026-10-02' } }));
    let user = userEvent.setup(); await openBoard(user); await setResult(user, 'Enclosure Condition', 'N/A'); expect(board()._lastTested).toBe('2026-10-01'); expect(screen.queryByText('NEXT TEST DUE:')).toBeNull();
    cleanup(); at(7); localStorage.setItem('swb-meta-v1', JSON.stringify({ s1: { ...META, testDate: '2026-10-05', dateDay: TODAY } }));
    user = userEvent.setup(); await openBoard(user); await setResult(user, 'Ventilation', 'PASS');
    expect(board()._lastTested).toBe('2026-10-01'); expect(board().ventilation.lastTested).toBe('2026-10-05'); expect(screen.getByText('NEXT TEST DUE:')).toBeInTheDocument(); expect(screen.getByText('01/10/2027')).toBeInTheDocument();
  });
  it('a hand-edited board date holds across a changed result and days; NEXT TEST DUE follows it; clearing it by hand re-stamps the Home date', async () => {
    at(7); const user = userEvent.setup(); await openBoard(user); await setResult(user, 'Enclosure Condition', 'PASS');
    setDate('Date tested', '2026-03-01'); await waitFor(() => expect(board()._lastTested).toBe('2026-03-01')); expect(await screen.findByText('01/03/2027')).toBeInTheDocument();
    at(9); await setResult(user, 'Enclosure Condition', 'FAIL'); await setResult(user, 'Ventilation', 'PASS'); expect(board()._lastTested).toBe('2026-03-01');
    setDate('Date tested', ''); await waitFor(() => expect(board()._lastTested).toBe(HOME));
  });
  it('INDEPENDENT of the per-test dates: editing the board date does not rewrite the tests; editing a test date does not rewrite the board', async () => {
    at(7); const user = userEvent.setup(); await openBoard(user); await setResult(user, 'Enclosure Condition', 'PASS'); await setResult(user, 'Ventilation', 'PASS');
    setDate('Date tested', '2026-03-01'); await waitFor(() => expect(board()._lastTested).toBe('2026-03-01')); expect(board().enclosure.lastTested).toBe(HOME); expect(board().ventilation.lastTested).toBe(HOME);
    await user.click(screen.getByText('Enclosure Condition')); setDate('Date tested', '2026-02-02'); await waitFor(() => expect(board().enclosure.lastTested).toBe('2026-02-02'));
    expect(board()._lastTested).toBe('2026-03-01'); expect(board().ventilation.lastTested).toBe(HOME);
  });
  it('Reset board clears the board date (and only that board\'s)', async () => {
    at(7); const user = userEvent.setup(); await openBoard(user); await setResult(user, 'Enclosure Condition', 'PASS'); expect(board()._lastTested).toBe(HOME);
    await user.click(screen.getByRole('button', { name: /Reset board results/ })); await user.click(await screen.findByRole('button', { name: /^(Reset|Yes)$/ }));
    await waitFor(() => expect(board()).not.toHaveProperty('_lastTested')); expect(screen.queryByLabelText('Date tested')).toBeNull();
  });
  it.each(['Complete', 'Reset'])('site %s clears the board date (Complete: the History snapshot keeps it)', async how => {
    at(7); const user = userEvent.setup(); await openBoard(user); await setResult(user, 'Enclosure Condition', 'PASS');
    await homeTab(user); await (how === 'Complete' ? completeAudit(user) : resetAudit(user));
    await waitFor(() => expect(JSON.stringify(ls('swb-results-v1').s1 || {})).not.toContain('_lastTested'));
    if (how === 'Complete') expect(JSON.stringify(ls('swb-history-v1'))).toContain(`"_lastTested":"${HOME}"`);
  });
});

describe('migration: a board with results and no board date gets the EARLIEST per-test date on it', () => {
  const TODAY2 = '2026-10-05', STORED = '2026-09-21', SNAP = '2026-08-10';
  const run = (res, meta, hist = []) => itemDatesMigrate('swb', { s1: res }, { s1: meta }, hist, TODAY2);
  it('OLD-format board (no dateDay, undated tests): the tests get the site\'s STORED Home date and the board gets that — never today', () => {
    const out = run({ a1: { b1: { enclosure: { status: 'pass' }, ventilation: { status: 'fail' } } } }, { testDate: STORED });
    expect(out.results.s1.a1.b1).toMatchObject({ _lastTested: STORED }); expect(out.results.s1.a1.b1.enclosure.lastTested).toBe(STORED); expect(JSON.stringify(out.results)).not.toContain(TODAY2);
  });
  it('the EARLIEST per-test date wins (any answered test, N/A included); untested tests are ignored', () => {
    const out = run({ a1: { b1: { enclosure: { status: 'pass', lastTested: '2026-08-20' }, ventilation: { status: 'na', lastTested: '2026-07-01' }, moisture: { status: 'untested', lastTested: '2026-01-01' } } } }, { testDate: STORED, dateDay: '2026-10-01' });
    expect(out.results.s1.a1.b1._lastTested).toBe('2026-07-01');
  });
  it('NOT gated on dateDay: a board stamped by an earlier release (meta has dateDay, tests dated, no board date) is backfilled; the tests are left alone', () => {
    const live = { a1: { b1: { enclosure: { status: 'pass', lastTested: '2026-08-20' }, ventilation: { status: 'fail', lastTested: '2026-09-02' } } } };
    const out = run(live, { testDate: STORED, dateDay: '2026-10-01' }); expect(out.results.s1.a1.b1._lastTested).toBe('2026-08-20'); expect(out.changed).toBe(1);
    expect(out.results.s1.a1.b1.enclosure).toEqual(live.a1.b1.enclosure);
  });
  it('blank stays blank: results with no per-test dates (already-migrated site) get nothing; boards with no results get nothing; a board that already has a date is left exactly as it is', () => {
    const live = { a1: { b1: { enclosure: { status: 'pass' } }, b2: { enclosure: { status: 'untested', lastTested: '2026-08-20' } }, b3: { enclosure: { status: 'pass', lastTested: '2026-08-20' }, _lastTested: '2026-05-05' } } };
    const out = run(live, { testDate: STORED, dateDay: '2026-10-01' });
    expect(out.results.s1.a1.b1).not.toHaveProperty('_lastTested'); expect(out.results.s1.a1.b2).not.toHaveProperty('_lastTested'); expect(out.results.s1.a1.b3._lastTested).toBe('2026-05-05'); expect(out.changed).toBe(0);
  });
  it('idempotent, pure (the input is not mutated) and a History snapshot\'s boards are backfilled from the snapshot\'s own tests', () => {
    const live = { a1: { b1: { enclosure: { status: 'pass', lastTested: '2026-08-20' } } } }; const hist = [{ id: 'h', results: { a1: { b1: { enclosure: { status: 'fail', lastTested: SNAP } } } }, meta: { testDate: SNAP, dateDay: '2026-08-10' } }];
    const before = JSON.stringify([live, hist]); const once = run(live, { testDate: STORED, dateDay: '2026-10-01' }, hist); expect(JSON.stringify([live, hist])).toBe(before);
    expect(once.history[0].results.a1.b1._lastTested).toBe(SNAP);
    const twice = itemDatesMigrate('swb', once.results, { s1: { testDate: STORED, dateDay: '2026-10-01' } }, once.history, '2031-01-01'); expect(twice.changed).toBe(0); expect(twice.results).toEqual(once.results);
  });
  it('in the real app: stored results are backfilled at load and saved (no Home date used), and a second load changes nothing', async () => {
    at(12); localStorage.setItem('swb-results-v1', JSON.stringify({ s1: { a1: { b1: { enclosure: { status: 'pass', lastTested: '2026-08-20' } } } } }));
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText('SWITCHBOARD', { exact: true })); await screen.findByText('Site One', { selector: 'div' });
    await waitFor(() => expect(board()._lastTested).toBe('2026-08-20')); const stored = localStorage.getItem('swb-results-v1');
    cleanup(); const u2 = userEvent.setup(); render(<AppRoot />); await u2.click(screen.getByText('SWITCHBOARD', { exact: true })); await screen.findByText('Site One', { selector: 'div' }); expect(localStorage.getItem('swb-results-v1')).toBe(stored);
  });
});

describe('the scalar `_lastTested` key is safe for every reader of a board record', () => {
  const withKey = { s1: { a1: { b1: { enclosure: { status: 'pass', lastTested: '2026-08-20' }, ventilation: { status: 'fail', lastTested: '2026-08-21' }, _photos: [{ id: 'p1', w: 10, h: 10 }], _lastTested: '2026-08-20' } } } };
  const without = JSON.parse(JSON.stringify(withKey)); delete without.s1.a1.b1._lastTested;
  const proj = { id: 's1', name: 'Site One', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] };
  it('swbGetBoardPhotos, swbBoardSummary, swbExtractPhotos / swbPhotoList (photo cleanup + migration) read exactly what they read without the key', () => {
    expect(swbGetBoardPhotos(withKey, 's1', 'a1', 'b1')).toEqual(swbGetBoardPhotos(without, 's1', 'a1', 'b1'));
    expect(swbBoardSummary(withKey, 's1', 'a1', 'b1')).toEqual(swbBoardSummary(without, 's1', 'a1', 'b1'));
    expect(swbExtractPhotos(withKey.s1)).toEqual(swbExtractPhotos(without.s1)); expect(swbPhotoList(withKey.s1)).toEqual([{ id: 'p1', w: 10, h: 10 }]);
  });
  it('swbRegisterRows reads the key (board date) and nothing else changes; a History snapshot with the key opens in History', async () => {
    const a = swbRegisterRows(proj, withKey, { testDate: '2026-09-30' })[0].cells, b = swbRegisterRows(proj, without, { testDate: '2026-09-30' })[0].cells;
    expect(a[2]).toBe('20/08/2026'); expect(b[2]).toBe(''); expect(a.filter((_, i) => i !== 2 && i !== 15)).toEqual(b.filter((_, i) => i !== 2 && i !== 15));
    localStorage.setItem('swb-history-v1', JSON.stringify([{ id: 'h1', projectId: 's1', projectName: 'Site One', testDate: '2026-08-20', auditor: 'Jane', archivedAt: '2026-08-20T01:00:00Z', results: withKey.s1, areas, meta: { testDate: '2026-08-20' } }]));
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText('SWITCHBOARD', { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' })); await user.click(screen.getByRole('button', { name: 'History' }));
    expect(await screen.findByText(/Site One|MSB|Plant/)).toBeInTheDocument();
  });
});

describe('export: the Register and the header use the BOARD date (the board sheets keep their per-test Date Tested column)', () => {
  let payload; beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; }); afterEach(() => { delete window.webkit; });
  const proj = { id: 's1', name: 'Site One', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }, { id: 'b2', name: 'DB1' }, { id: 'b3', name: 'DB2' }] }] };
  const meta = { auditor: 'J', testDate: '2026-09-30', nextTestDate: '2027-09-30' };
  const load = async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64')); return wb; };
  const results = { s1: { a1: {
    b1: { [K[0]]: { status: 'pass', lastTested: '2026-08-20' }, [K[1]]: { status: 'fail', lastTested: '2026-07-13' }, _lastTested: '2026-06-01' },                        // board date earlier than its tests
    b2: { [K[0]]: { status: 'na', lastTested: '2026-01-05' }, _lastTested: '2026-01-05' },                                                                         // N/A only
    b3: { [K[0]]: { status: 'pass' } },                                                                                                                          // results but NO board date: blank stays blank
  } } };
  it('Register: each row\'s Date Tested = its board date and Next Audit Due = board date + 1 year (PASS / FAIL only); blank stays blank; the header is the earliest board date among TESTED boards, Home fallback', async () => {
    await exportSWBExcel(proj, results, meta); const wb = await load(); const reg = wb.getWorksheet('Register');
    expect(String(reg.getCell('A4').value)).toBe('Auditor: J  |  Date Tested: 01/06/2026  |  Next Audit Due: 01/06/2027');                    // N/A-only board 05/01 does not count for the header
    const row = r => [reg.getCell(r, 2).value, reg.getCell(r, 3).value ?? '', reg.getCell(r, 16).value ?? ''].map(String);
    expect(row(7)).toEqual(['MSB', '01/06/2026', '01/06/2027']); expect(row(8)).toEqual(['DB1', '05/01/2026', '30/09/2027']); expect(row(9)).toEqual(['DB2', '', '30/09/2027']);   // N/A-only: its date, no own due -> the Home value; no board date: blank
  });
  it('the per-test Date Tested column on the board sheet is unchanged (each test\'s own date)', async () => {
    await exportSWBExcel(proj, results, meta); const sh = (await load()).getWorksheet('MSB'); let hr = 0; sh.eachRow((r, n) => { if (String(r.getCell(1).value) === 'Item') hr = n; });
    expect(String(sh.getCell('H' + hr).value)).toBe('Date Tested'); expect([1, 2, 3].map(i => String(sh.getCell('H' + (hr + i)).value ?? ''))).toEqual(['20/08/2026', '13/07/2026', '']);
  });
  it('no board date anywhere -> the Home date and the Home next-due; a Home next-due the auditor CHOSE wins for every board', async () => {
    await exportSWBExcel(proj, { s1: { a1: { b1: { [K[0]]: { status: 'pass', lastTested: '2026-08-20' } } } } }, meta); expect(String((await load()).getWorksheet('Register').getCell('A4').value)).toBe('Auditor: J  |  Date Tested: 30/09/2026  |  Next Audit Due: 30/09/2027');
    await exportSWBExcel(proj, { s1: { a1: { b1: { [K[0]]: { status: 'pass' }, _lastTested: '2026-08-20' } } } }, { ...meta, nextTestDate: '2028-03-01' }); expect(String((await load()).getWorksheet('Register').getCell('A4').value)).toBe('Auditor: J  |  Date Tested: 20/08/2026  |  Next Audit Due: 01/03/2028');
  });
});

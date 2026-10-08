// ITEM DATES for IEL and TAT (FICTIONAL data). An item's date (lastTested) is stamped with the Home date when it FIRST gets a result; a changed result keeps it; "—" clears it; the auditor can
// edit it (that item only); the item page shows DATE TESTED only once the item has a result; Next Test Due is read-only (IEL: the Home chosen date wins, else date + 3 months; TAT: date +
// the item's own frequency). The export header's Date Tested = the earliest date among the PASS / FAIL items (N/A is not a test, so it never counts) and Next Test Due = the earliest item next-due (TAT: PASSED items only); Home values when no item qualifies. Only Date is faked.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import AppRoot, { itemDateApply, itemHasStatus, earliestIso, exportIELExcel, exportTATExcel, ielItemDue } from './App.jsx';

const ls = k => JSON.parse(localStorage.getItem(k));
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.useRealTimers(); });
const at = (d, h = 12) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, d, h, 0, 0)); };
const day = d => `2026-10-${String(d).padStart(2, '0')}`;

describe('itemDateApply (pure): the rules', () => {
  const home = '2026-10-05', has = itemHasStatus;
  it('first result: stamped with the Home date', () => { expect(itemDateApply({ status: 'pass' }, has, home).lastTested).toBe(home); expect(itemDateApply({ status: 'na', lastTested: '' }, has, home).lastTested).toBe(home); });
  it('a changed result keeps the date; an edited date is kept', () => {
    expect(itemDateApply({ status: 'fail', lastTested: '2026-09-01' }, has, home).lastTested).toBe('2026-09-01');
    expect(itemDateApply({ status: 'pass', lastTested: '2026-10-02' }, has, home).lastTested).toBe('2026-10-02');
  });
  it('back to untested ("—") clears it, whatever it was', () => { expect(itemDateApply({ status: 'untested', lastTested: '2026-09-01' }, has, home).lastTested).toBe(''); expect(itemDateApply({}, has, home).lastTested).toBe(''); });
  it('earliestIso ignores blanks', () => { expect(earliestIso(['2026-10-03', '', '2026-09-01', undefined])).toBe('2026-09-01'); expect(earliestIso([])).toBe(''); });
});

const IEL = { p: 'iel-projects-v2', m: 'iel-meta-v2', r: 'iel-results-v2', project: [{ id: 's1', name: 'Site One', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'e1', name: 'estops', circuits: ['x1', 'x2'], machineNames: { x1: 'Feed Conveyor 1', x2: 'Feed Conveyor 2' } }] }] }] };
const TAT = { p: 'tat-projects-v1', m: 'tat-meta-v1', r: 'tat-results-v1', project: [{ id: 's1', name: 'Site One', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Workshop', defaultFreq: '3', items: ['i1', 'i2'], itemNames: { i1: 'Grinder', i2: 'Drill' }, itemTags: {}, itemEquipTypes: {}, itemFreqs: { i1: '1', i2: '12' } }] }] };
const seedHome = (K, over = {}) => { localStorage.setItem(K.p, JSON.stringify(K.project)); localStorage.setItem(K.m, JSON.stringify({ s1: { auditor: 'Jane', testDate: day(5), dateDay: day(5), nextTestDate: '', ...over } })); };
async function openIel(user) { render(<AppRoot />); await user.click(screen.getByText('IEL TESTING', { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' })); await user.click(screen.getByRole('button', { name: /E-Stops/ })); await user.click(await screen.findByText('Wash Plant')); await user.click(await screen.findByRole('button', { name: /E-Stops/ })); }
async function openTat(user) { render(<AppRoot />); await user.click(screen.getByText('TEST & TAG', { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' })); await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ })); await user.click(await screen.findByText('Workshop')); }
const status = (user, name) => user.click(screen.getByRole('button', { name }));
const box = () => screen.queryByLabelText('Date tested');

describe('IEL item page', () => {
  const open = async (user, name) => { await user.click(await screen.findByText(name)); };
  it('no DATE TESTED until the item has a result; the first result stamps the Home date; a changed result keeps it; "—" clears it and hides the field', async () => {
    at(5); seedHome(IEL); const user = userEvent.setup(); await openIel(user); await open(user, 'Feed Conveyor 1');
    expect(box()).toBeNull();
    await status(user, 'FAIL'); await waitFor(() => expect(ls(IEL.r).s1.a1.estops.x1.lastTested).toBe(day(5))); expect(box()).not.toBeNull(); expect(screen.getByLabelText('Date tested').style.opacity).toBe('0');   // the overlay DateBox
    expect(screen.getByTestId('date-box').textContent).toBe('05/10/2026');
    at(9); await status(user, 'N/A'); await waitFor(() => expect(ls(IEL.r).s1.a1.estops.x1.status).toBe('na')); expect(ls(IEL.r).s1.a1.estops.x1.lastTested).toBe(day(5));   // a later day, a changed result: the date stays
    await status(user, '—'); await waitFor(() => expect(ls(IEL.r).s1.a1.estops.x1.lastTested).toBe('')); expect(box()).toBeNull();
    await status(user, 'FAIL'); await waitFor(() => expect(ls(IEL.r).s1.a1.estops.x1.lastTested).not.toBe(''));                                 // a new first result: stamped again
  });
  it('editing the date changes only that item and stays until it is edited again / set to "—" / Reset', async () => {
    at(5); seedHome(IEL); const user = userEvent.setup(); await openIel(user); await open(user, 'Feed Conveyor 1'); await status(user, 'FAIL');
    fireEvent.change(await screen.findByLabelText('Date tested'), { target: { value: '2026-09-28' } });
    await waitFor(() => expect(ls(IEL.r).s1.a1.estops.x1.lastTested).toBe('2026-09-28')); expect((ls(IEL.r).s1.a1.estops.x2 || {}).lastTested).toBeUndefined();
    await status(user, 'N/A'); expect(ls(IEL.r).s1.a1.estops.x1.lastTested).toBe('2026-09-28');                                                  // the edit survives a changed result
  });
  it('the Home date affects only items tested afterwards', async () => {
    at(5); seedHome(IEL); let user = userEvent.setup(); await openIel(user); await open(user, 'Feed Conveyor 1'); await status(user, 'FAIL');
    await waitFor(() => expect(ls(IEL.r).s1.a1.estops.x1.lastTested).toBe(day(5)));
    cleanup(); at(7); const m = ls(IEL.m); m.s1.testDate = day(7); m.s1.dateDay = day(7); localStorage.setItem(IEL.m, JSON.stringify(m));               // the Home date is now 7 Oct
    user = userEvent.setup(); await openIel(user); await open(user, 'Feed Conveyor 2'); await status(user, 'FAIL');
    await waitFor(() => expect(ls(IEL.r).s1.a1.estops.x2.lastTested).toBe(day(7))); expect(ls(IEL.r).s1.a1.estops.x1.lastTested).toBe(day(5));
  });
  it('Next Test Due is read-only: the item date + 3 months, or the Home chosen date when there is one', async () => {
    at(5); seedHome(IEL); let user = userEvent.setup(); await openIel(user); await open(user, 'Feed Conveyor 1'); await status(user, 'FAIL');
    expect(await screen.findByText('05/01/2027')).toBeInTheDocument();                                                                           // 05/10/2026 + 3 months
    expect(screen.queryByLabelText(/next test due/i)).toBeNull();
    cleanup(); localStorage.setItem(IEL.m, JSON.stringify({ s1: { ...ls(IEL.m).s1, nextTestDate: '2027-03-01' } }));                              // the auditor chose a next due on Home
    user = userEvent.setup(); await openIel(user); await open(user, 'Feed Conveyor 1'); expect(await screen.findByText('01/03/2027')).toBeInTheDocument();
  });
});

describe('TAT item page', () => {
  const open = async (user, name) => { await user.click(await screen.findByText(name)); };
  it('no DATE TESTED until a result; stamped once; a changed result keeps it; "—" clears it', async () => {
    at(5); seedHome(TAT); const user = userEvent.setup(); await openTat(user); await open(user, 'Grinder'); expect(box()).toBeNull();
    await status(user, 'FAIL'); await waitFor(() => expect(ls(TAT.r).s1.a1.i1.lastTested).toBe(day(5))); expect(box()).not.toBeNull();
    at(9); await status(user, 'N/A'); await waitFor(() => expect(ls(TAT.r).s1.a1.i1.status).toBe('na')); expect(ls(TAT.r).s1.a1.i1.lastTested).toBe(day(5));
    await status(user, '—'); await waitFor(() => expect(ls(TAT.r).s1.a1.i1.lastTested).toBe('')); expect(box()).toBeNull();
  });
  it('Next Test Due = the item date + the item\'s OWN frequency (1 month vs 12 months), read-only, and it follows an edited date', async () => {
    at(5); seedHome(TAT); let user = userEvent.setup(); await openTat(user); await open(user, 'Grinder'); await status(user, 'FAIL');
    expect(await screen.findByText('05/11/2026')).toBeInTheDocument();                                                                           // 1 month
    fireEvent.change(screen.getByLabelText('Date tested'), { target: { value: '2026-09-01' } }); expect(await screen.findByText('01/10/2026')).toBeInTheDocument();
    await user.click(screen.getByText('Back')); await open(user, 'Drill'); await status(user, 'FAIL'); expect(await screen.findByText('05/10/2027')).toBeInTheDocument();   // 12 months
  });
  it('a result set by a check (Visual / Electrical) is stamped once too, and keeps its date when a check is changed', async () => {
    at(5); seedHome(TAT); const user = userEvent.setup(); await openTat(user); await open(user, 'Grinder');
    await user.click(screen.getByTestId('tat-electrical-fail')); await waitFor(() => expect(ls(TAT.r).s1.a1.i1.lastTested).toBe(day(5)));
    at(9); await user.click(screen.getByTestId('tat-visual-fail')); await waitFor(() => expect(ls(TAT.r).s1.a1.i1.visualCheck).toBe('fail')); expect(ls(TAT.r).s1.a1.i1.lastTested).toBe(day(5));
  });
});

describe('export headers: Date Tested = the earliest PASS / FAIL item date, Next Test Due = the earliest item next-due; the Home values when none qualifies (N/A never counts)', () => {
  let payload;
  beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
  afterEach(() => { delete window.webkit; });
  const rowsOf = () => XLSX.utils.sheet_to_json(XLSX.read(payload.base64, { type: 'base64' }).Sheets[XLSX.read(payload.base64, { type: 'base64' }).SheetNames[0]], { header: 1, defval: '' });
  const ielProject = IEL.project[0]; ielProject.areas[0].panels[0].circuits = ['x1', 'x2', 'x3'];
  it('IEL: earliest date and earliest due among the PASS / FAIL items; an earlier N/A item is ignored', async () => {
    const res = { a1: { estops: { x1: { status: 'pass', lastTested: '2026-08-20' }, x2: { status: 'fail', lastTested: '2026-07-13' }, x3: { status: 'untested', lastTested: '' } } } };
    await exportIELExcel(ielProject, res, { auditor: 'J', testDate: '2026-09-30', nextTestDate: '2026-12-30' });
    expect(String(rowsOf()[3][0])).toBe('Auditor: J  |  Date Tested: 13/07/2026  |  Next Test Due: 13/10/2026');
    const withNa = { a1: { estops: { ...res.a1.estops, x3: { status: 'na', lastTested: '2026-01-05' } } } };      // N/A, dated EARLIER: not a test
    await exportIELExcel(ielProject, withNa, { auditor: 'J', testDate: '2026-09-30', nextTestDate: '2026-12-30' });
    expect(String(rowsOf()[3][0])).toBe('Auditor: J  |  Date Tested: 13/07/2026  |  Next Test Due: 13/10/2026');
    const onlyNa = { a1: { estops: { x1: { status: 'na', lastTested: '2026-01-05' } } } };                          // only N/A: the Home values
    await exportIELExcel(ielProject, onlyNa, { auditor: 'J', testDate: '2026-09-30', nextTestDate: '2026-12-30' });
    expect(String(rowsOf()[3][0])).toBe('Auditor: J  |  Date Tested: 30/09/2026  |  Next Test Due: 30/12/2026');
  });
  it('IEL: nothing tested -> the Home date and the Home next-due; a chosen Home next-due is every item\'s due and so the header\'s', async () => {
    await exportIELExcel(ielProject, {}, { auditor: 'J', testDate: '2026-09-30', nextTestDate: '2026-12-30' });
    expect(String(rowsOf()[3][0])).toBe('Auditor: J  |  Date Tested: 30/09/2026  |  Next Test Due: 30/12/2026');
    const res = { a1: { estops: { x1: { status: 'pass', lastTested: '2026-08-20' } } } };
    await exportIELExcel(ielProject, res, { auditor: 'J', testDate: '2026-09-30', nextTestDate: '2027-03-01' });
    expect(String(rowsOf()[3][0])).toBe('Auditor: J  |  Date Tested: 20/08/2026  |  Next Test Due: 01/03/2027');
  });
  it('TAT: earliest date among PASS / FAIL items (a FAILED item counts, an earlier N/A one does not), earliest due among PASSED items; Home date when none qualifies', async () => {
    const proj = JSON.parse(JSON.stringify(TAT.project[0])); proj.areas[0].items = ['i1', 'i2', 'i3']; proj.areas[0].itemNames = { i1: 'A', i2: 'B', i3: 'C' }; proj.areas[0].itemFreqs = { i1: '3', i2: '1', i3: '1' };
    const res = { a1: { i1: { status: 'pass', lastTested: '2026-09-21', freq: '3' }, i2: { status: 'pass', lastTested: '2026-08-01', freq: '1' }, i3: { status: 'fail', lastTested: '2026-01-01', freq: '1' } } };
    await exportTATExcel(proj, res, { auditor: 'Jane', testDate: '2026-09-21' });
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64'));
    expect(String(wb.getWorksheet('Test & Tag').getCell('A4').value)).toBe('Auditor: Jane  |  Date Tested: 01/01/2026  |  Next Test Due (earliest): 01/09/2026');
    const withNa = { a1: { ...res.a1, i3: { status: 'na', lastTested: '2025-12-01', freq: '1' } } };                  // N/A, dated EARLIER than everything: ignored
    await exportTATExcel(proj, withNa, { auditor: 'Jane', testDate: '2026-09-21' });
    const wbn = new ExcelJS.Workbook(); await wbn.xlsx.load(Buffer.from(payload.base64, 'base64'));
    expect(String(wbn.getWorksheet('Test & Tag').getCell('A4').value)).toBe('Auditor: Jane  |  Date Tested: 01/08/2026  |  Next Test Due (earliest): 01/09/2026');
    await exportTATExcel(proj, { a1: { i1: { status: 'untested' } } }, { auditor: 'Jane', testDate: '2026-09-21' });
    const wb2 = new ExcelJS.Workbook(); await wb2.xlsx.load(Buffer.from(payload.base64, 'base64'));
    expect(String(wb2.getWorksheet('Test & Tag').getCell('A4').value)).toBe('Auditor: Jane  |  Date Tested: 21/09/2026  |  Next Test Due (earliest): ');
  });
});

describe('an N/A item is not a test: no next-due anywhere', () => {
  it('IEL: ielItemDue is empty for N/A, present for PASS / FAIL', () => {
    const meta = { testDate: '2026-10-05', nextTestDate: '2027-01-05' };
    expect(ielItemDue({ status: 'na', lastTested: '2026-10-05' }, meta)).toEqual({ iso: null, label: '' });
    expect(ielItemDue({ status: 'pass', lastTested: '2026-10-05' }, meta).iso).toBe('2027-01-05');
    expect(ielItemDue({ status: 'fail', lastTested: '2026-10-05' }, meta).iso).toBe('2027-01-05');
  });
  it('IEL item page: an N/A item shows its date but no NEXT TEST DUE', async () => {
    at(5); seedHome(IEL); const user = userEvent.setup(); await openIel(user); await user.click(await screen.findByText('Feed Conveyor 1'));
    await status(user, 'N/A'); await waitFor(() => expect(ls(IEL.r).s1.a1.estops.x1.lastTested).toBe(day(5)));
    expect(box()).not.toBeNull(); expect(screen.queryByText('NEXT TEST DUE:')).toBeNull();
    await status(user, 'FAIL'); expect(await screen.findByText('NEXT TEST DUE:')).toBeInTheDocument();
  });
  it('TAT item page and export row: an N/A item has no next-due', async () => {
    at(5); seedHome(TAT); const user = userEvent.setup(); await openTat(user); await user.click(await screen.findByText('Grinder'));
    await status(user, 'N/A'); await waitFor(() => expect(ls(TAT.r).s1.a1.i1.lastTested).toBe(day(5)));
    expect(screen.queryByText('NEXT TEST DUE:')).toBeNull();
  });
});

describe('IEL: an item with NO result shows no date field and no NEXT TEST DUE; setting a result makes them appear', () => {
  it('open the untested item page -> absent; set FAIL -> DATE TESTED and NEXT TEST DUE appear', async () => {
    at(5); seedHome(IEL); const user = userEvent.setup(); await openIel(user); await user.click(await screen.findByText('Feed Conveyor 2'));
    await screen.findByRole('button', { name: 'N/A' });
    expect(box()).toBeNull(); expect(screen.queryByText('NEXT TEST DUE:')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'FAIL' }));
    expect(await screen.findByLabelText('Date tested')).toBeInTheDocument(); expect(screen.getByText('NEXT TEST DUE:')).toBeInTheDocument();
  });
});

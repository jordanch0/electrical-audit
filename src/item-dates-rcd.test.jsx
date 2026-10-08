// RCD ITEM DATES (FICTIONAL data): push and inject records each carry their own date. First result stamps the Home date for that test type (push date / injection date); a changed
// result keeps it; "—" clears it; a hand-edited date holds; Reset and Complete clear it; NEXT TEST DUE = PASS / FAIL only (push +1 month, inject +1 year, the Home chosen date wins);
// the Report export: Date Tested = the earliest PASS / FAIL date, Next Test Due = the earliest item next-due, Home values when none qualifies.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';
import AppRoot, { exportExcel } from './App.jsx';
import { ls, day, HOME, TODAY, at, site, setDate, homeTab, completeAudit, resetAudit } from './test/item-dates-ui.js';

const areas = [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'p1', name: 'MSB 1', circuits: ['CB 1', 'CB 2'] }] }];
const META = { auditor: 'Jane', pushDate: HOME, injectDate: day(3), nextPushDate: '2026-11-05', nextInjectDate: '2027-10-03', dateDay: TODAY, notes: '' };
const rec = (cb, mode) => ls('rcd-results-v6').s1.a1.p1[cb][mode];
beforeEach(() => { localStorage.clear(); localStorage.setItem('rcd-projects-v6', JSON.stringify([site(areas)])); localStorage.setItem('rcd-meta-v6', JSON.stringify({ s1: META })); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openGrid(user, mode) {
  render(<AppRoot />); await user.click(screen.getByText('RCD TESTING', { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' }));
  await user.click(screen.getByRole('button', { name: mode === 'push' ? /^Push Test/ : /^Injection Test/ })); await user.click(await screen.findByText('Wash Plant')); await user.click(await screen.findByText('MSB 1'));
}

describe('push: tap = cycle the status', () => {
  it('first result stamps the push date (not today); a changed result keeps it; N/A keeps it; back to untested clears it', async () => {
    at(7); const user = userEvent.setup(); await openGrid(user, 'push');
    await user.click(await screen.findByRole('button', { name: /CB 1/ }));                        // untested -> PASS
    await waitFor(() => expect(rec('CB 1', 'push')).toMatchObject({ status: 'pass', lastTested: HOME }));
    at(9); await user.click(screen.getByRole('button', { name: /CB 1/ }));                       // PASS -> FAIL (opens the item page)
    await waitFor(() => expect(rec('CB 1', 'push')).toMatchObject({ status: 'fail', lastTested: HOME }));
    await user.click(screen.getByRole('button', { name: 'N/A' })); await waitFor(() => expect(rec('CB 1', 'push')).toMatchObject({ status: 'na', lastTested: HOME }));
    await user.click(screen.getByRole('button', { name: '—' })); await waitFor(() => expect(rec('CB 1', 'push')).toMatchObject({ status: 'untested', lastTested: '' }));
    expect(screen.queryByLabelText('Date tested')).toBeNull();                                  // no result, no date field
  });
  it('the item page: DATE TESTED once there is a result; NEXT TEST DUE for PASS / FAIL only (+1 month); a hand-edited date holds', async () => {
    at(7); const user = userEvent.setup(); await openGrid(user, 'push');
    await user.click(await screen.findByRole('button', { name: /CB 1/ })); await user.click(screen.getByRole('button', { name: /CB 1/ }));   // PASS, then FAIL -> the item page
    expect(await screen.findByLabelText('Date tested')).toBeInTheDocument(); expect(screen.getByText('NEXT TEST DUE:')).toBeInTheDocument();
    expect(screen.getByText('05/11/2026')).toBeInTheDocument();                                  // 05/10/2026 + 1 month
    setDate('Date tested', '2026-09-01'); await waitFor(() => expect(rec('CB 1', 'push').lastTested).toBe('2026-09-01'));
    expect(await screen.findByText('01/10/2026')).toBeInTheDocument();                           // the due follows the edited date: 01/09 + 1 month
    await user.click(screen.getByRole('button', { name: 'PASS' })); expect(rec('CB 1', 'push').lastTested).toBe('2026-09-01');   // the edit holds across a changed result
    await user.click(screen.getByRole('button', { name: 'N/A' })); await waitFor(() => expect(rec('CB 1', 'push').status).toBe('na'));
    expect(screen.queryByText('NEXT TEST DUE:')).toBeNull(); expect(screen.getByLabelText('Date tested')).toBeInTheDocument();      // N/A: the date, no next-due
  });
  it('the panel "all" buttons stamp and clear like a single tap', async () => {
    at(7); const user = userEvent.setup(); await openGrid(user, 'push');
    const all = (await screen.findAllByRole('button')).filter(b => !/CB/.test(b.textContent));
    await user.click(all.find(b => /^\s*✓?\s*(All )?Pass/i.test(b.textContent) || /pass/i.test(b.textContent)));
    await waitFor(() => expect(rec('CB 2', 'push')).toMatchObject({ status: 'pass', lastTested: HOME }));
    await user.click(screen.getByRole('button', { name: 'Reset' })); await waitFor(() => expect(rec('CB 2', 'push')).toMatchObject({ status: 'untested', lastTested: '' }));
  });
});

describe('inject: tap opens the item page', () => {
  it('first result stamps the injection date; a changed result keeps it; "—" clears it; NEXT TEST DUE +1 year', async () => {
    at(7); const user = userEvent.setup(); await openGrid(user, 'inject');
    await user.click(await screen.findByRole('button', { name: /CB 1/ }));
    expect(screen.queryByLabelText('Date tested')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'PASS' })); await waitFor(() => expect(rec('CB 1', 'inject')).toMatchObject({ status: 'pass', lastTested: day(3) }));
    expect(await screen.findByText('03/10/2027')).toBeInTheDocument();                           // 03/10/2026 + 1 year
    await user.click(screen.getByRole('button', { name: 'FAIL' })); expect(rec('CB 1', 'inject').lastTested).toBe(day(3));
    await user.click(screen.getByRole('button', { name: '—' })); await waitFor(() => expect(rec('CB 1', 'inject').lastTested).toBe(''));
  });
});

describe('Reset and Complete clear the dates', () => {
  it.each(['Complete', 'Reset'])('%s: the live results (and so their dates) are cleared', async how => {
    at(7); const user = userEvent.setup(); await openGrid(user, 'push');
    await user.click(await screen.findByRole('button', { name: /CB 1/ })); await waitFor(() => expect(rec('CB 1', 'push').lastTested).toBe(HOME));
    await homeTab(user); await (how === 'Complete' ? completeAudit(user) : resetAudit(user));
    await waitFor(() => expect(JSON.stringify(ls('rcd-results-v6').s1 || {})).not.toContain('lastTested'));
    if (how === 'Complete') expect(JSON.stringify(ls('rcd-history-v6'))).toContain(HOME);                               // the archived snapshot keeps its dates
  });
});

describe('Report export header', () => {
  let payload; beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; }); afterEach(() => { delete window.webkit; });
  const proj = { id: 's1', name: 'Site One', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'p1', name: 'MSB 1', circuits: ['CB 1', 'CB 2', 'CB 3'] }] }] };
  const rows = () => { const wb = XLSX.read(payload.base64, { type: 'base64' }); return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }); };
  const meta = { auditor: 'J', pushDate: '2026-09-30', nextPushDate: '2026-10-30', injectDate: '2026-09-30', nextInjectDate: '2027-09-30' };
  it('push: earliest PASS / FAIL date and earliest due; an earlier N/A item is ignored; per-row Date and Next Test Required come from the item', async () => {
    const res = { s1: { a1: { p1: { 'CB 1': { push: { status: 'pass', lastTested: '2026-08-20' }, inject: {} }, 'CB 2': { push: { status: 'fail', lastTested: '2026-07-13' }, inject: {} }, 'CB 3': { push: { status: 'na', lastTested: '2026-01-05' }, inject: {} } } } } };
    await exportExcel(res, proj, meta, 'push');
    const r = rows(); expect(String(r[3][0])).toBe('Auditor: J  |  Date Tested: 13/07/2026  |  Next Push Test Due: 13/08/2026');
    expect([r[6][5], r[6][8]]).toEqual(['20/08/2026', '20/09/2026']); expect([r[8][5], r[8][8]]).toEqual(['05/01/2026', '']);   // N/A: its date, no due
  });
  it('inject (+1 year) and the Home fallback when no PASS / FAIL item qualifies', async () => {
    const res = { s1: { a1: { p1: { 'CB 1': { inject: { status: 'pass', lastTested: '2026-08-20' }, push: {} } } } } };
    await exportExcel(res, proj, meta, 'inject'); expect(String(rows()[3][0])).toBe('Auditor: J  |  Date Tested: 20/08/2026  |  Next Injection Test Due: 20/08/2027');
    await exportExcel({ s1: { a1: { p1: { 'CB 1': { push: { status: 'na', lastTested: '2026-01-05' }, inject: {} } } } } }, proj, meta, 'push');
    expect(String(rows()[3][0])).toBe('Auditor: J  |  Date Tested: 30/09/2026  |  Next Push Test Due: 30/10/2026');
  });
});

describe('an item with NO result shows no date field and no NEXT TEST DUE; setting a result makes them appear', () => {
  it.each([['push', 'CB 2', 'PASS'], ['inject', 'CB 2', 'PASS']])('%s: open the untested item page -> absent; set %s -> DATE TESTED and NEXT TEST DUE appear', async (mode, cb, result) => {
    at(7); const user = userEvent.setup(); await openGrid(user, mode);
    if (mode === 'push') await user.click((await screen.findAllByText('note'))[1]); else await user.click(await screen.findByRole('button', { name: /CB 2/ }));
    await screen.findByRole('button', { name: 'N/A' });
    expect(screen.queryByLabelText('Date tested')).toBeNull(); expect(screen.queryByText('NEXT TEST DUE:')).toBeNull();
    await user.click(screen.getByRole('button', { name: result }));
    expect(await screen.findByLabelText('Date tested')).toBeInTheDocument(); expect(screen.getByText('NEXT TEST DUE:')).toBeInTheDocument();
  });
});

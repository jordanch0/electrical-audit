// IRT ITEM DATES (FICTIONAL data): an item's result is its status, or — while the status is "untested" (= auto-detect) — its readings. First result stamps the Home date; a changed result
// keeps it; "—" with no readings clears it; a hand-edited date holds (the page sends its whole form, which holds no date of its own, so the stored one must survive every other edit);
// Reset and Complete clear it; NEXT TEST DUE (+1 year, the Home chosen date wins) for PASS / FAIL only; Report export header rule.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';
import AppRoot, { exportIRTExcel, irtHasResult } from './App.jsx';
import { ls, day, HOME, TODAY, at, site, setDate, homeTab, completeAudit, resetAudit } from './test/item-dates-ui.js';

const areas = [{ id: 'a1', name: 'Plant Room', panels: [{ id: 'p1', name: 'DB1', items: ['m1', 'm2'], itemNames: { m1: 'Motor 1', m2: 'Motor 2' } }] }];
const META = { auditor: 'Jane', testDate: HOME, nextTestDate: '2027-10-05', dateDay: TODAY };
const rec = (k = 'm1') => ls('irt-results-v1').s1.a1.p1[k];
beforeEach(() => { localStorage.clear(); localStorage.setItem('irt-projects-v1', JSON.stringify([site(areas)])); localStorage.setItem('irt-meta-v1', JSON.stringify({ s1: META })); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openItem(user, name = 'Motor 1') {
  render(<AppRoot />); await user.click(screen.getByText('INSULATION RESISTANCE TESTING', { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' }));
  await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ })); await user.click(await screen.findByText('Plant Room')); await user.click(await screen.findByText('DB1')); await user.click(await screen.findByText(name));
  const ok = screen.queryByRole('button', { name: /Understood/ }) || await screen.findByRole('button', { name: /Understood/ }); await user.click(ok);
}

describe('item page', () => {
  it('the first status stamps the Home date (not today); a changed status keeps it; N/A keeps it; "—" with no readings clears it', async () => {
    at(7); const user = userEvent.setup(); await openItem(user);
    expect(screen.queryByLabelText('Date tested')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'FAIL' })); await waitFor(() => expect(rec()).toMatchObject({ status: 'fail', lastTested: HOME }));
    expect(screen.getByLabelText('Date tested')).toBeInTheDocument();
    at(9); await user.click(screen.getByRole('button', { name: 'PASS' })); await waitFor(() => expect(rec()).toMatchObject({ status: 'pass', lastTested: HOME }));
    await user.click(screen.getByRole('button', { name: 'N/A' })); await waitFor(() => expect(rec()).toMatchObject({ status: 'na', lastTested: HOME }));
    await user.click(screen.getByRole('button', { name: '—' })); await waitFor(() => expect(rec()).toMatchObject({ status: 'untested', lastTested: '' }));
    expect(screen.queryByLabelText('Date tested')).toBeNull();
  });
  it('a reading alone is a result (auto status): it stamps the Home date; editing the reading again keeps the date; "—" with readings stays auto-detected, so the date stays', async () => {
    at(7); const user = userEvent.setup(); await openItem(user);
    const first = () => screen.getAllByText('MΩ')[0].previousElementSibling;
    await user.type(first(), '0.5'); await waitFor(() => expect(rec()).toMatchObject({ status: 'untested', lastTested: HOME }));
    expect(await screen.findByText(/FAIL — DEFECT DETAILS/)).toBeInTheDocument();
    at(9); await user.clear(first()); await user.type(first(), '500'); await waitFor(() => expect(rec().readings.L1E).toBe('500')); expect(rec().lastTested).toBe(HOME);   // the page's whole-form save did not re-stamp
    await user.click(screen.getByRole('button', { name: '—' })); expect(rec().lastTested).toBe(HOME);
  });
  it('NEXT TEST DUE under the date: PASS / FAIL only, +1 year; a hand-edited date holds across other edits and the due follows it', async () => {
    at(7); const user = userEvent.setup(); await openItem(user);
    await user.click(screen.getByRole('button', { name: 'PASS' })); expect(await screen.findByText('NEXT TEST DUE:')).toBeInTheDocument(); expect(screen.getByText('05/10/2027')).toBeInTheDocument();
    setDate('Date tested', '2026-03-01'); await waitFor(() => expect(rec().lastTested).toBe('2026-03-01')); expect(await screen.findByText('01/03/2027')).toBeInTheDocument();
    const first = () => screen.getAllByText('MΩ')[0].previousElementSibling; await user.type(first(), '300'); await waitFor(() => expect(rec().readings.L1E).toBe('300')); expect(rec().lastTested).toBe('2026-03-01');   // another edit: the date holds
    await user.click(screen.getByRole('button', { name: 'N/A' })); await waitFor(() => expect(rec().status).toBe('na'));
    expect(screen.queryByText('NEXT TEST DUE:')).toBeNull(); expect(screen.getByLabelText('Date tested')).toBeInTheDocument();
  });
});

describe.each(['Complete', 'Reset'])('%s clears the dates', how => {
  it('the live results (and so their dates) are cleared', async () => {
    at(7); const user = userEvent.setup(); await openItem(user);
    await user.click(screen.getByRole('button', { name: 'PASS' })); await waitFor(() => expect(rec().lastTested).toBe(HOME));
    await homeTab(user); await (how === 'Complete' ? completeAudit(user) : resetAudit(user));
    await waitFor(() => expect(JSON.stringify(ls('irt-results-v1').s1 || {})).not.toContain('lastTested'));
    if (how === 'Complete') expect(JSON.stringify(ls('irt-history-v1'))).toContain(HOME);
  });
});

describe('irtHasResult + Report export header', () => {
  it('a status other than untested, or any reading, is a result', () => {
    expect(irtHasResult({ status: 'untested', readings: {} })).toBe(false); expect(irtHasResult({ status: 'na' })).toBe(true); expect(irtHasResult({ status: 'untested', readings: { L1E: '300' } })).toBe(true);
  });
  let payload; beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; }); afterEach(() => { delete window.webkit; });
  const proj = { id: 's1', name: 'Site One', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a1', name: 'Plant Room', panels: [{ id: 'p1', name: 'DB1', items: ['m1', 'm2', 'm3'], itemNames: { m1: 'A', m2: 'B', m3: 'C' } }] }] };
  const meta = { auditor: 'J', testDate: '2026-09-30', nextTestDate: '2027-09-30' };
  const rows = () => { const wb = XLSX.read(payload.base64, { type: 'base64' }); return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }); };
  it('earliest PASS / FAIL date and earliest due; an earlier N/A is ignored; the Register Test Date is each item\'s own (blank when untested)', async () => {
    const res = { s1: { a1: { p1: { m1: { status: 'pass', lastTested: '2026-08-20', readings: {} }, m2: { status: 'fail', lastTested: '2026-07-13', readings: {} }, m3: { status: 'na', lastTested: '2026-01-05', readings: {} } } } } };
    await exportIRTExcel(proj, res, meta); const r = rows();
    expect(String(r[3][0])).toBe('Auditor: J  |  Date Tested: 13/07/2026  |  Next Test Due: 13/07/2027');
    expect([r[6][4], r[7][4], r[8][4]]).toEqual(['20/08/2026', '13/07/2026', '05/01/2026']);
  });
  it('a reading-only (auto) result counts; nothing qualifying -> the Home values', async () => {
    await exportIRTExcel(proj, { s1: { a1: { p1: { m1: { status: 'untested', lastTested: '2026-08-20', readings: { L1E: '300' } } } } } }, meta);
    expect(String(rows()[3][0])).toBe('Auditor: J  |  Date Tested: 20/08/2026  |  Next Test Due: 20/08/2027');
    await exportIRTExcel(proj, { s1: { a1: { p1: { m1: { status: 'na', lastTested: '2026-01-05', readings: {} } } } } }, meta);
    expect(String(rows()[3][0])).toBe('Auditor: J  |  Date Tested: 30/09/2026  |  Next Test Due: 30/09/2027');
  });
});

describe('an item with NO result shows no date field and no NEXT TEST DUE; setting a result makes them appear', () => {
  it('open the untested item page -> absent; set PASS -> DATE TESTED and NEXT TEST DUE appear', async () => {
    at(7); const user = userEvent.setup(); await openItem(user, 'Motor 2');
    expect(screen.queryByLabelText('Date tested')).toBeNull(); expect(screen.queryByText('NEXT TEST DUE:')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'PASS' }));
    expect(await screen.findByLabelText('Date tested')).toBeInTheDocument(); expect(screen.getByText('NEXT TEST DUE:')).toBeInTheDocument();
  });
});

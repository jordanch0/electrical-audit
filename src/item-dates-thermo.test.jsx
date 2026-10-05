// THERMO ITEM DATES (FICTIONAL data): the item is each logged test ENTRY (a photo). The entry form shows DATE TESTED prefilled with the Home date (editable before saving) and a read-only
// NEXT TEST DUE under it (+1 year, the Home chosen date wins; every logged result - PASS / FAIL / MONITOR - is a test). A saved entry keeps its date when its result is changed (Edit);
// a hand-edited date holds; there is no "—" here (an entry is removed with its Delete, taking its date with it); Reset and Complete clear them.
// Report export: Date Tested = the earliest entry date, Next Test Due = the earliest entry next-due, Home values when there is none.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';
import AppRoot, { exportThermoExcel } from './App.jsx';
import { ls, day, HOME, TODAY, at, site, setDate, homeTab, completeAudit, resetAudit } from './test/item-dates-ui.js';

const areas = [{ id: 'a1', name: 'Wash Plant', boards: [{ id: 'b1', name: 'MSB 1', circuits: ['c1', 'c2'], circuitNames: { c1: 'Main incomer', c2: 'Feed Conveyor 1' } }] }];
const META = { auditor: 'Jane', testDate: HOME, nextTestDate: '2027-10-05', dateDay: TODAY };
const entries = (c = 'c1') => (((ls('thermo-results-v1').s1 || {}).a1 || {}).b1 || {})[c] || [];
beforeEach(() => { localStorage.clear(); localStorage.setItem('thermo-projects-v1', JSON.stringify([site(areas)])); localStorage.setItem('thermo-meta-v1', JSON.stringify({ s1: META })); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openCircuit(user, name = 'Main incomer') {
  render(<AppRoot />); await user.click(screen.getByText('THERMOGRAPHIC', { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' }));
  await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ })); await user.click(await screen.findByText('Wash Plant')); await user.click(await screen.findByText('MSB 1')); await user.click(await screen.findByText(name));
}
const save = user => user.click(screen.getByRole('button', { name: /Save|Add|Log/ }));

describe('entry form', () => {
  it('shows DATE TESTED prefilled with the HOME date (not today) and NEXT TEST DUE (+1 year); a new entry is stored with that date', async () => {
    at(7); const user = userEvent.setup(); await openCircuit(user);
    expect(await screen.findByLabelText('Date tested')).toBeInTheDocument(); expect(screen.getByTestId('date-box').textContent).toBe('05/10/2026'); expect(screen.getByText('05/10/2027')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('e.g. 0171'), '1001'); await save(user);
    await waitFor(() => expect(entries()).toHaveLength(1)); expect(entries()[0]).toMatchObject({ flirFile: '1001', result: 'PASS', lastTested: HOME });
  });
  it('a hand-edited date is stored with the entry and its next due follows it; the next blank entry is back to the Home date', async () => {
    at(7); const user = userEvent.setup(); await openCircuit(user);
    setDate('Date tested', '2026-03-01'); expect(await screen.findByText('01/03/2027')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('e.g. 0171'), '1001'); await save(user);
    await waitFor(() => expect(entries()[0].lastTested).toBe('2026-03-01'));
    expect(screen.getByTestId('date-box').textContent).toBe('05/10/2026');                           // the form for the NEXT entry
  });
  it('editing a saved entry and changing its result keeps its date (even days later); it is shown on the entry', async () => {
    at(7); const user = userEvent.setup(); await openCircuit(user);
    setDate('Date tested', '2026-03-01'); await user.type(screen.getByPlaceholderText('e.g. 0171'), '1001'); await save(user); await waitFor(() => expect(entries()).toHaveLength(1));
    expect(screen.getByText('01/03/2026')).toBeInTheDocument();
    at(9); await user.click(screen.getByRole('button', { name: /Edit/ })); await user.click(screen.getByRole('button', { name: 'MONITOR' })); await save(user);
    await waitFor(() => expect(entries()[0]).toMatchObject({ result: 'MONITOR', lastTested: '2026-03-01' }));
  });
});

describe.each(['Complete', 'Reset'])('%s clears the dates', how => {
  it('the live results (and so their dates) are cleared', async () => {
    at(7); const user = userEvent.setup(); await openCircuit(user);
    await user.type(screen.getByPlaceholderText('e.g. 0171'), '1001'); await save(user); await waitFor(() => expect(entries()[0].lastTested).toBe(HOME));
    await homeTab(user); await (how === 'Complete' ? completeAudit(user) : resetAudit(user));
    await waitFor(() => expect(JSON.stringify(ls('thermo-results-v1').s1 || {})).not.toContain('lastTested'));
    if (how === 'Complete') expect(JSON.stringify(ls('thermo-history-v1'))).toContain(HOME);
  });
});

describe('Report export header', () => {
  let payload; beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; }); afterEach(() => { delete window.webkit; });
  const proj = { id: 's1', name: 'Site One', company: 'Co', abn: '1', licence: 'L', areas };
  const meta = { auditor: 'J', testDate: '2026-09-30', nextTestDate: '2027-09-30' };
  const rows = () => { const wb = XLSX.read(payload.base64, { type: 'base64' }); return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }); };
  it('the earliest entry date and earliest due (MONITOR counts); each row carries its own date; an untested circuit is blank (not the Home date)', async () => {
    const res = { a1: { b1: { c1: [{ id: '1', flirFile: '1001', temp: '34', result: 'PASS', lastTested: '2026-08-20' }, { id: '2', flirFile: '1002', temp: '70', result: 'MONITOR', lastTested: '2026-07-13' }], c2: [] } } };
    await exportThermoExcel(proj, res, meta); const r = rows();
    expect(String(r[3][0])).toBe('Auditor: J  |  Date Tested: 13/07/2026  |  Next Test Due: 13/07/2027');
    expect([r[6][4], r[7][4], r[8][4]]).toEqual(['20/08/2026', '13/07/2026', '']);
  });
  it('no entries -> the Home values; a Home next-due the auditor CHOSE is every entry\'s due', async () => {
    await exportThermoExcel(proj, {}, meta); expect(String(rows()[3][0])).toBe('Auditor: J  |  Date Tested: 30/09/2026  |  Next Test Due: 30/09/2027');
    const res = { a1: { b1: { c1: [{ id: '1', flirFile: '1001', result: 'PASS', lastTested: '2026-08-20' }] } } };
    await exportThermoExcel(proj, res, { ...meta, nextTestDate: '2027-03-01' }); expect(String(rows()[3][0])).toBe('Auditor: J  |  Date Tested: 20/08/2026  |  Next Test Due: 01/03/2027');
  });
});

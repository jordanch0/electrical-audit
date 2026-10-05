// WELDER ITEM DATES (FICTIONAL data): the item is the welder; its result is any of the 12 checklist answers. First answer stamps the Home date; changing an answer keeps it; clearing every
// answer (a tap on the active button clears it) clears it; a hand-edited date holds; Reset and Complete clear it; NEXT TEST DUE (+3 months, the Home chosen date wins) only once the welder is
// PASS / FAIL (all 12 answered); Report export: Date Tested = the earliest tested welder's date, Next Test Due = the earliest due, Home values when none.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';
import AppRoot, { exportWelderExcel, welderHasResult, WELDER_CHECKLIST } from './App.jsx';
import { ls, day, HOME, TODAY, at, site, setDate, homeTab, completeAudit, resetAudit } from './test/item-dates-ui.js';

const areas = [{ id: 'ar', name: 'Workshop', assets: [{ id: 'a1', assetId: 'WLD-1', brand: 'Kemppi', model: 'Mig 300', serial: '1234' }, { id: 'a2', assetId: 'WLD-2', brand: 'Lincoln', model: 'Pro', serial: '5678' }] }];
const META = { auditor: 'Jane', testDate: HOME, nextTestDate: '2027-01-05', dateDay: TODAY };
const rec = (id = 'a1') => (ls('welder-results-v1').s1 || {})[id] || {};
const answered = () => Object.values(rec().items || {}).filter(v => v && v.result).length;
beforeEach(() => {
  localStorage.clear(); localStorage.setItem('welder-projects-v2', JSON.stringify([site(areas)])); localStorage.setItem('welder-meta-v1', JSON.stringify({ s1: META }));
  localStorage.setItem('welder-audit-active-v1', JSON.stringify({ v: 1, sites: { s1: {} } }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openWelder(user, name = 'WLD-1') {
  render(<AppRoot />); await user.click(screen.getByText('WELDER TESTING', { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' }));
  await user.click(screen.getByRole('button', { name: /^Audit$/ })); await user.click((await screen.findAllByText(new RegExp(name)))[0]);
}
const btn = (name, i) => screen.getAllByRole('button', { name })[i];

describe('welder page', () => {
  it('no date until an item is answered; the first answer stamps the Home date (not today); changing it keeps the date; clearing every answer clears it', async () => {
    at(7); const user = userEvent.setup(); await openWelder(user);
    expect(screen.queryByLabelText('Date tested')).toBeNull();
    await user.click(btn('PASS', 0)); await waitFor(() => expect(rec().lastTested).toBe(HOME)); expect(screen.getByLabelText('Date tested')).toBeInTheDocument();
    at(9); await user.click(btn('FAIL', 0)); await waitFor(() => expect(rec().items.visual.result).toBe('fail')); expect(rec().lastTested).toBe(HOME);
    await user.click(btn('FAIL', 0)); await waitFor(() => expect(answered()).toBe(0));                                                  // re-tap the active answer clears it
    await waitFor(() => expect(rec().lastTested).toBe('')); expect(screen.queryByLabelText('Date tested')).toBeNull();
  });
  it('NEXT TEST DUE under the date only once all 12 are answered (+3 months); a hand-edited date holds across a changed answer and the due follows it', async () => {
    at(7); const user = userEvent.setup(); await openWelder(user);
    await user.click(btn('PASS', 0)); expect(screen.queryByText('NEXT TEST DUE:')).toBeNull();                                          // 1 of 12: a date, no due yet
    for (let i = 1; i < 12; i++) await user.click(btn('PASS', i));
    expect(await screen.findByText('NEXT TEST DUE:')).toBeInTheDocument(); expect(screen.getByText('05/01/2027')).toBeInTheDocument();  // 05/10 + 3 months (the Home default)
    setDate('Date tested', '2026-03-01'); await waitFor(() => expect(rec().lastTested).toBe('2026-03-01')); expect(await screen.findByText('01/06/2026')).toBeInTheDocument();
    await user.click(btn('FAIL', 11)); await waitFor(() => expect(Object.values(rec().items).some(v => v.result === 'fail')).toBe(true)); expect(rec().lastTested).toBe('2026-03-01');
  });
});

describe.each(['Complete', 'Reset'])('%s clears the dates', how => {
  it('the live results (and so their dates) are cleared', async () => {
    at(7); const user = userEvent.setup(); await openWelder(user);
    await user.click(btn('PASS', 0)); await waitFor(() => expect(rec().lastTested).toBe(HOME));
    await homeTab(user); await (how === 'Complete' ? completeAudit(user) : resetAudit(user));
    await waitFor(() => expect(JSON.stringify(ls('welder-results-v1').s1 || {})).not.toContain('lastTested'));
    if (how === 'Complete') expect(JSON.stringify(ls('welder-history-v2') || ls('welder-history-v1'))).toContain(HOME);
  });
});

describe('welderHasResult + Report export header', () => {
  it('any answered item is a result', () => { expect(welderHasResult({ items: {} })).toBe(false); expect(welderHasResult({ items: { visual: { result: 'na' } } })).toBe(true); });
  let payload; beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; }); afterEach(() => { delete window.webkit; });
  const proj = { id: 'p1', name: 'Site One', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'ar', name: 'Workshop', assets: [{ id: 'a1', assetId: 'W1', brand: 'K', model: 'M', serial: '1' }, { id: 'a2', assetId: 'W2', brand: 'K', model: 'M', serial: '2' }, { id: 'a3', assetId: 'W3', brand: 'K', model: 'M', serial: '3' }] }] };
  const meta = { auditor: 'J', testDate: '2026-09-30', nextTestDate: '2026-12-30' };
  const KEYS = WELDER_CHECKLIST.map(c => c.key);
  const full = (res, d) => ({ items: Object.fromEntries(KEYS.map(k => [k, { result: res, value: '', action: '' }])), lastTested: d });
  const rows = () => { const wb = XLSX.read(payload.base64, { type: 'base64' }); return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }); };
  it('the earliest tested welder date and earliest due; each Register row carries its own date and due (+3 months); an untested welder is blank', async () => {
    await exportWelderExcel(proj, { p1: { a1: full('pass', '2026-08-20'), a2: full('fail', '2026-07-13') } }, meta); const r = rows();
    expect(String(r[3][0])).toBe('Auditor: J  |  Date Tested: 13/07/2026  |  Next Test Due: 13/10/2026');
    expect([r[6][4], r[6][12], r[7][4], r[7][12], r[8][4], r[8][12]]).toEqual(['20/08/2026', '20/11/2026', '13/07/2026', '13/10/2026', '', '']);
  });
  it('nothing tested -> the Home values; a Home next-due the auditor CHOSE is every welder\'s due', async () => {
    await exportWelderExcel(proj, { p1: {} }, meta); expect(String(rows()[3][0])).toBe('Auditor: J  |  Date Tested: 30/09/2026  |  Next Test Due: 30/12/2026');
    await exportWelderExcel(proj, { p1: { a1: full('pass', '2026-08-20') } }, { ...meta, nextTestDate: '2027-06-01' }); expect(String(rows()[3][0])).toBe('Auditor: J  |  Date Tested: 20/08/2026  |  Next Test Due: 01/06/2027');
  });
});

// ELT ITEM DATES (FICTIONAL data): the item is the fitting. Its result is any of the 4 checks. First check stamps the Home date; changing a check keeps it; clearing every check ("—": there is
// no N/A here, a tap on the active button clears it) clears it; a hand-edited date holds; Reset and Complete clear it; NEXT TEST DUE (+6 months, the Home chosen date wins) only once the
// fitting is PASS / FAIL (all 4 answered); Report export: Date Tested = the earliest tested fitting's date, Next Test Due = the earliest due, Home values when none.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';
import AppRoot, { exportELTExcel } from './App.jsx';
import { ls, day, HOME, TODAY, at, site, setDate, homeTab, completeAudit, resetAudit } from './test/item-dates-ui.js';

const areas = [{ id: 'ar', name: 'Plant Room', assets: [{ id: 'a1', assetLocation: 'Door 1', assetId: '', type: 'Emergency Exit Sign', typeOther: '', maintained: '', fitting: '' }, { id: 'a2', assetLocation: 'Door 2', assetId: '', type: 'Emergency Exit Sign', typeOther: '', maintained: '', fitting: '' }] }];
const META = { auditor: 'Jane', testDate: HOME, nextTestDate: '2027-04-05', dateDay: TODAY };
const rec = (id = 'a1') => (ls('elt-results-v1').s1 || {})[id] || {};
beforeEach(() => {
  localStorage.clear(); localStorage.setItem('elt-projects-v2', JSON.stringify([site(areas)])); localStorage.setItem('elt-meta-v1', JSON.stringify({ s1: META }));
  localStorage.setItem('elt-audit-active-v1', JSON.stringify({ v: 1, sites: { s1: {} } }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openAsset(user, name = 'Door 1') {
  render(<AppRoot />); await user.click(screen.getByText('EMERGENCY LIGHTING', { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' }));
  await user.click(screen.getByRole('button', { name: /^Audit$/ })); await user.click(await screen.findByText(name));
}
const pass = (i) => screen.getAllByRole('button', { name: 'PASS' })[i], fail = (i) => screen.getAllByRole('button', { name: 'FAIL' })[i];

describe('fitting page', () => {
  it('no date until a check is recorded; the first check stamps the Home date (not today); changing a check keeps it; clearing every check clears it', async () => {
    at(7); const user = userEvent.setup(); await openAsset(user);
    expect(screen.queryByLabelText('Date tested')).toBeNull();
    await user.click(pass(0)); await waitFor(() => expect(rec()).toMatchObject({ visual: 'pass', lastTested: HOME })); expect(screen.getByLabelText('Date tested')).toBeInTheDocument();
    at(9); await user.click(fail(1)); await waitFor(() => expect(rec().discharge).toBe('fail')); expect(rec().lastTested).toBe(HOME);
    await user.click(fail(0)); await waitFor(() => expect(rec().visual).toBe('fail')); expect(rec().lastTested).toBe(HOME);       // visual: PASS -> FAIL
    await user.click(fail(0)); await user.click(fail(1)); await waitFor(() => expect(rec().discharge).toBeFalsy());              // re-tap clears each check
    await waitFor(() => expect(rec().lastTested).toBe(''));
    expect(screen.queryByLabelText('Date tested')).toBeNull();
  });
  it('NEXT TEST DUE under the date only once all 4 checks are answered (+6 months); a hand-edited date holds across a changed check and the due follows it', async () => {
    at(7); const user = userEvent.setup(); await openAsset(user);
    await user.click(pass(0)); expect(screen.queryByText('NEXT TEST DUE:')).toBeNull();                                                  // 1 of 4: a date, no due yet
    for (const i of [1, 2, 3]) await user.click(pass(i));
    expect(await screen.findByText('NEXT TEST DUE:')).toBeInTheDocument(); expect(screen.getByText('05/04/2027')).toBeInTheDocument();   // the Home next-due is 05/04 = 05/10 + 6 months (the default): item date + 6 months
    setDate('Date tested', '2026-03-01'); await waitFor(() => expect(rec().lastTested).toBe('2026-03-01')); expect(await screen.findByText('01/09/2026')).toBeInTheDocument();
    await user.click(fail(3)); await waitFor(() => expect(rec().charging).toBe('fail')); expect(rec().lastTested).toBe('2026-03-01');
  });
});

describe.each(['Complete', 'Reset'])('%s clears the dates', how => {
  it('the live results (and so their dates) are cleared', async () => {
    at(7); const user = userEvent.setup(); await openAsset(user);
    await user.click(pass(0)); await waitFor(() => expect(rec().lastTested).toBe(HOME));
    await homeTab(user); await (how === 'Complete' ? completeAudit(user) : resetAudit(user));
    await waitFor(() => expect(JSON.stringify(ls('elt-results-v1').s1 || {})).not.toContain('lastTested'));
    if (how === 'Complete') expect(JSON.stringify(ls('elt-history-v2') || ls('elt-history-v1'))).toContain(HOME);
  });
});

describe('Report export header', () => {
  let payload; beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; }); afterEach(() => { delete window.webkit; });
  const proj = { id: 'p1', name: 'Site One', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'ar', name: 'Plant Room', assets: [{ id: 'a1', assetLocation: 'Door 1', type: 'Emergency Exit Sign' }, { id: 'a2', assetLocation: 'Door 2', type: 'Emergency Exit Sign' }, { id: 'a3', assetLocation: 'Door 3', type: 'Emergency Exit Sign' }] }] };
  const meta = { auditor: 'J', testDate: '2026-09-30', nextTestDate: '2027-03-30' };
  const all = d => ({ visual: 'pass', discharge: 'pass', switching: 'pass', charging: 'pass', lastTested: d });
  const rows = () => { const wb = XLSX.read(payload.base64, { type: 'base64' }); return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }); };
  it('the earliest fitting date and earliest due; each Register row carries its own date and due (+6 months)', async () => {
    await exportELTExcel(proj, { p1: { a1: all('2026-08-20'), a2: { ...all('2026-07-13'), discharge: 'fail' } } }, meta); const r = rows();
    expect(String(r[3][0])).toBe('Auditor: J  |  Date Tested: 13/07/2026  |  Next Test Due: 13/01/2027');
    expect([r[6][7], r[6][15], r[7][7], r[7][15]]).toEqual(['20/08/2026', '20/02/2027', '13/07/2026', '13/01/2027']);
  });
  it('nothing tested -> the Home values; a Home next-due the auditor CHOSE is every fitting\'s due', async () => {
    await exportELTExcel(proj, { p1: {} }, meta); expect(String(rows()[3][0])).toBe('Auditor: J  |  Date Tested: 30/09/2026  |  Next Test Due: 30/03/2027');
    await exportELTExcel(proj, { p1: { a1: all('2026-08-20') } }, { ...meta, nextTestDate: '2027-06-01' }); expect(String(rows()[3][0])).toBe('Auditor: J  |  Date Tested: 20/08/2026  |  Next Test Due: 01/06/2027');
  });
});

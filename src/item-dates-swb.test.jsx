// SWB ITEM DATES (FICTIONAL data): each checklist point carries its own date. First result stamps the Home date; a changed result keeps it; "—" clears it; a hand-edited date holds;
// Reset and Complete clear it; NEXT TEST DUE (+1 year, the Home chosen date wins) for PASS / FAIL only; Report export: a board's Date Tested = the earliest PASS / FAIL item date,
// Next Audit Due = the earliest item next-due, header = the earliest of the boards, Home values when none qualifies; the board sheets gain a "Date Tested" column.
// IMPORT: the SWB importer is structure-only (Area / Board from the Register), so the extra board-sheet column changes nothing: OLD exports still import, NEW exports round-trip.
import React from 'react';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import AppRoot, { exportSWBExcel, parseSWBExcel, SWB_CHECKLIST } from './App.jsx';
import { ls, day, HOME, TODAY, at, site, setDate, homeTab, completeAudit, resetAudit } from './test/item-dates-ui.js';

const areas = [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }];
const META = { auditor: 'Jane', testDate: HOME, nextTestDate: '2027-10-05', dateDay: TODAY };
const item = k => ls('swb-results-v1').s1.a1.b1[k];
beforeEach(() => { localStorage.clear(); localStorage.setItem('swb-projects-v1', JSON.stringify([site(areas)])); localStorage.setItem('swb-meta-v1', JSON.stringify({ s1: META })); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openItem(user, label = 'Enclosure Condition') {
  render(<AppRoot />); await user.click(screen.getByText('SWITCHBOARD', { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' }));
  await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ })); await user.click(await screen.findByText('Plant')); await user.click(await screen.findByText('MSB')); await user.click(await screen.findByText(label));
}

describe('item page', () => {
  it('no date field until there is a result; the first result stamps the Home date (not today); a changed result keeps it; "—" clears it', async () => {
    at(7); const user = userEvent.setup(); await openItem(user);
    expect(screen.queryByLabelText('Date tested')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'FAIL' })); await waitFor(() => expect(item('enclosure')).toMatchObject({ status: 'fail', lastTested: HOME }));
    expect(screen.getByLabelText('Date tested')).toBeInTheDocument();
    at(9); await user.click(screen.getByRole('button', { name: 'N/A' })); await waitFor(() => expect(item('enclosure')).toMatchObject({ status: 'na', lastTested: HOME }));
    await user.click(screen.getByRole('button', { name: '—' })); await waitFor(() => expect(item('enclosure').lastTested).toBe(''));
    expect(screen.queryByLabelText('Date tested')).toBeNull();
  });
  it('NEXT TEST DUE under the date: PASS / FAIL only, +1 year; a hand-edited date holds across a changed result and the due follows it', async () => {
    at(7); const user = userEvent.setup(); await openItem(user);
    await user.click(screen.getByRole('button', { name: 'PASS' })); expect(await screen.findByText('NEXT TEST DUE:')).toBeInTheDocument(); expect(screen.getByText('05/10/2027')).toBeInTheDocument();
    setDate('Date tested', '2026-09-01'); await waitFor(() => expect(item('enclosure').lastTested).toBe('2026-09-01'));
    await user.click(screen.getByRole('button', { name: 'FAIL' })); expect(item('enclosure').lastTested).toBe('2026-09-01');
    await user.click(screen.getByRole('button', { name: 'N/A' })); await waitFor(() => expect(item('enclosure').status).toBe('na'));
    expect(screen.queryByText('NEXT TEST DUE:')).toBeNull(); expect(screen.getByLabelText('Date tested')).toBeInTheDocument();
  });
  it('without a chosen Home next-due (the default) the due is the item date + 1 year', async () => {
    localStorage.setItem('swb-meta-v1', JSON.stringify({ s1: { ...META, nextTestDate: '2027-10-05' } }));
    at(7); const user = userEvent.setup(); await openItem(user);
    await user.click(screen.getByRole('button', { name: 'PASS' })); await waitFor(() => expect(item('enclosure').lastTested).toBe(HOME));
    setDate('Date tested', '2026-03-01'); expect(await screen.findByText('01/03/2027')).toBeInTheDocument();
  });
});

describe.each(['Complete', 'Reset'])('%s clears the dates', how => {
  it('the live results (and so their dates) are cleared', async () => {
    at(7); const user = userEvent.setup(); await openItem(user);
    await user.click(screen.getByRole('button', { name: 'PASS' })); await waitFor(() => expect(item('enclosure').lastTested).toBe(HOME));
    await homeTab(user); await (how === 'Complete' ? completeAudit(user) : resetAudit(user));
    await waitFor(() => expect(JSON.stringify(ls('swb-results-v1').s1 || {})).not.toContain('lastTested'));
    if (how === 'Complete') expect(JSON.stringify(ls('swb-history-v1'))).toContain(HOME);
  });
});

describe('Report export + import', () => {
  let payload; beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; }); afterEach(() => { delete window.webkit; });
  const proj = { id: 's1', name: 'Site One', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }, { id: 'b2', name: 'DB1' }] }] };
  const meta = { auditor: 'J', testDate: '2026-09-30', nextTestDate: '2027-09-30' };
  const K = SWB_CHECKLIST.map(c => c.key);
  // MSB: pass 20/08, fail 13/07, N/A 05/01 (earlier, ignored), the rest untested; DB1: nothing
  const results = { s1: { a1: { b1: { [K[0]]: { status: 'pass', lastTested: '2026-08-20' }, [K[1]]: { status: 'fail', lastTested: '2026-07-13' }, [K[2]]: { status: 'na', lastTested: '2026-01-05' } } } } };
  const load = async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64')); return wb; };
  it('Register: the board Date Tested / Next Audit Due come from its PASS / FAIL items; the header is the earliest of the boards; N/A is ignored; an untested board is blank / Home', async () => {
    await exportSWBExcel(proj, results, meta); const wb = await load(); const reg = wb.getWorksheet('Register');
    expect(String(reg.getCell('A4').value)).toBe('Auditor: J  |  Date Tested: 13/07/2026  |  Next Audit Due: 13/07/2027');
    const row = r => [1, 2, 3, 16].map(c => String(reg.getCell(r, c).value ?? '')); expect(row(7)[0]).toBe('Plant'); expect(row(8)[1]).toBe('DB1'); expect(row(8)[2]).toBe('');
    // MSB has untested items, so (as before) its Register Date Tested stays blank until every point is answered; its Next Audit Due is the earliest item due
    expect(row(7)[3]).toBe('13/07/2027');
  });
  it('board sheet: a "Date Tested" column (H) with each answered item\'s own date; untested items blank; the header merge covers 8 columns', async () => {
    await exportSWBExcel(proj, results, meta); const wb = await load(); const sh = wb.getWorksheet('MSB');
    let hr = 0; sh.eachRow((row, n) => { if (String(row.getCell(1).value) === 'Item') hr = n; });
    expect(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(c => String(sh.getCell(c + hr).value))).toEqual(['Item', 'Test / Pass Criteria', 'Result', 'Defect ID', 'Comments', 'Risk Rating', 'Responsibility / Action', 'Date Tested']);
    expect([1, 2, 3, 4].map(i => String(sh.getCell('H' + (hr + i)).value ?? ''))).toEqual(['20/08/2026', '13/07/2026', '05/01/2026', '']);
    expect(Object.values(sh._merges).map(m => m.range)).toContain('A1:H1');
  });
  it('nothing qualifying -> the Home date and the Home next-due', async () => {
    await exportSWBExcel(proj, { s1: { a1: { b1: { [K[0]]: { status: 'na', lastTested: '2026-01-05' } } } } }, meta); const wb = await load();
    expect(String(wb.getWorksheet('Register').getCell('A4').value)).toBe('Auditor: J  |  Date Tested: 30/09/2026  |  Next Audit Due: 30/09/2027');
  });
  it('IMPORT (a): OLD exports (7-column board sheets, no Date Tested) still import — areas, boards, site, company', () => {
    for (const f of ['swb-nologo', 'swb-logo']) {
      const buf = fs.readFileSync(path.join(__dirname, '__fixtures__', 'old-exports', f + '.xlsx')); const data = XLSX.read(buf, { type: 'buffer' });
      const board = data.Sheets[data.SheetNames.find(n => n !== 'Register')]; const range = XLSX.utils.decode_range(board['!ref']);
      expect(range.e.c + 1).toBeLessThanOrEqual(7);                                                       // the OLD board sheet really has no 8th column
      const p = parseSWBExcel(data); expect(p.ok === undefined || p.ok === true).toBe(true);
      expect(p.siteName).toBe('Example Quarry - North'); expect(p.areas.map(a => a.name)).toEqual(['Plant']); expect(p.areas[0].boards.map(b => b.name)).toEqual(['MSB', 'DB1']);
    }
  });
  it('IMPORT (b): a NEW export round-trips — export, then import: the same site, company / ABN / licence, areas and boards; the dates are exported (Register + board sheets) but never imported (structure only)', async () => {
    await exportSWBExcel(proj, results, meta);
    const data = XLSX.read(payload.base64, { type: 'base64' }); const p = parseSWBExcel(data);
    expect(p.ok === undefined || p.ok === true).toBe(true);
    expect(p.siteName).toBe('Site One'); expect({ company: p.company, abn: p.abn, licence: p.licence }).toEqual({ company: 'Co', abn: '1', licence: 'L' });
    expect(p.areas.map(a => a.name)).toEqual(['Plant']); expect(p.areas[0].boards.map(b => b.name)).toEqual(['MSB', 'DB1']);
    expect(JSON.stringify(p)).not.toMatch(/2026-07-13|13\/07\/2026/);                                      // no result data crosses the import
    const board = XLSX.utils.sheet_to_json(data.Sheets['MSB'], { header: 1, defval: '' }).find(r => r[0] === 'Item'); expect(board[7]).toBe('Date Tested');
  });
});

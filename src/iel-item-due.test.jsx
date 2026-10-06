// IEL per-item due date (2026-10-02): the auditor-chosen next-due date wins when one is set, else last tested + 3 months. meta.nextTestDate is always populated (default = testDate + 3
// months, follows the test date until edited), so "chosen" = "differs from that default". Unit + export + real-UI tests, incl. the "save meta, change ONLY the test date" sequence.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';
import AppRoot, { exportIELExcel, ielItemDue, ielChosenNextDue } from './App.jsx';

describe('ielChosenNextDue / ielItemDue (pure)', () => {
  const item = { status: 'pass', lastTested: '2026-07-13' };
  it('no stored next-due, or one equal to testDate + 3 months => NOT chosen, per-item default (lastTested + 3 months)', () => {
    expect(ielChosenNextDue({ testDate: '2026-07-13' })).toBeNull();
    expect(ielChosenNextDue({ testDate: '2026-07-13', nextTestDate: '2026-10-13' })).toBeNull();
    expect(ielItemDue(item, { testDate: '2026-07-13', nextTestDate: '2026-10-13' })).toEqual({ iso: '2026-10-13', label: '13/10/2026' });
    expect(ielItemDue(item, undefined)).toEqual({ iso: '2026-10-13', label: '13/10/2026' });
  });
  it('a next-due that differs from the default IS the auditor-chosen date, for every tested item', () => {
    const meta = { testDate: '2026-07-13', nextTestDate: '2026-11-15' };
    expect(ielChosenNextDue(meta)).toBe('2026-11-15');
    expect(ielItemDue(item, meta)).toEqual({ iso: '2026-11-15', label: '15/11/2026' });
    expect(ielItemDue({ status: 'pass', lastTested: '2026-05-01' }, meta)).toEqual({ iso: '2026-11-15', label: '15/11/2026' });
  });
  it('an item that was never tested has no due date either way', () => {
    expect(ielItemDue({ status: 'untested' }, { testDate: '2026-07-13', nextTestDate: '2026-11-15' })).toEqual({ iso: null, label: '' });
    expect(ielItemDue({ status: 'untested' }, { testDate: '2026-07-13' })).toEqual({ iso: null, label: '' });
  });
});

describe('export: the "Next Test Due" column matches header row 4 once a date is chosen, else lastTested + 3 months', () => {
  let payload;
  beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
  afterEach(() => { delete window.webkit; });
  const project = { id: 'p1', name: 'Example Quarry', company: 'Example Electrical Pty Ltd', abn: '98 765 432 109', licence: 'EW123456', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'e1', name: 'estops', circuits: ['x', 'y', 'z'], machineNames: { x: 'Conv 1', y: 'Conv 2', z: 'Conv 3' } }] }] };
  const results = { a: { estops: { x: { status: 'pass', lastTested: '2026-07-13' }, y: { status: 'pass', lastTested: '2026-08-20' } } } };
  async function dueColumn(meta) {
    await exportIELExcel(project, results, meta);
    const wb = XLSX.read(payload.base64, { type: 'base64' }); const sh = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' });
    const head = rows[5]; const col = head.findIndex(h => /next test due/i.test(String(h)));
    expect(col, 'Next Test Due heading on row 6').toBeGreaterThan(-1);
    return { due: rows.slice(6, 9).map(r => String(r[col])), row4: String(rows[3][0]) };
  }
  it('default (no override): each tested item is its OWN last tested + 3 months; untested is blank', async () => {
    const { due, row4 } = await dueColumn({ auditor: 'J', testDate: '2026-09-30', nextTestDate: '2026-12-30' });
    expect(due).toEqual(['13/10/2026', '20/11/2026', '']);
    expect(row4).toContain('Next Test Due: 13/10/2026');   // header row 4 = the EARLIEST item next-due (x: 13/07 + 3 months), no longer the Home date + 3 months (30/12/2026)
  });
  it('override: every tested item shows the chosen date, the same date as header row 4; untested stays blank', async () => {
    const { due, row4 } = await dueColumn({ auditor: 'J', testDate: '2026-09-30', nextTestDate: '2027-03-01' });
    expect(due).toEqual(['01/03/2027', '01/03/2027', '']);
    expect(row4).toContain('Next Test Due: 01/03/2027');
  });
});

describe('real UI: save meta, change ONLY the test date -> items keep lastTested + 3 months; a chosen date shows per item', () => {
  const project = { id: 'p1', name: 'Example Quarry', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'e1', name: 'estops', circuits: ['x'], machineNames: { x: 'Conv 1' } }] }] };
  const results = { p1: { a: { estops: { x: { status: 'pass', lastTested: '2026-07-13' } } } } };
  const ls = k => JSON.parse(localStorage.getItem(k));
  async function open(meta) {
    cleanup(); localStorage.clear();
    localStorage.setItem('iel-projects-v2', JSON.stringify([project])); localStorage.setItem('iel-results-v2', JSON.stringify(results)); localStorage.setItem('iel-meta-v2', JSON.stringify({ p1: meta }));
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText('IEL TESTING')); await user.click(await screen.findByText('Example Quarry', { selector: 'div' }));
    await screen.findByText('NEXT TEST DUE'); return user;
  }
  const dates = () => document.querySelectorAll('input[type=date]');
  async function openItemList(user) {
    await user.click(screen.getAllByText('E-Stops')[0]);
    await user.click(await screen.findByText('Plant'));
    await user.click(await screen.findByText('E-Stops'));
    await screen.findByText('Conv 1');
  }
  it('saved default next-due, then ONLY the test date is edited: the stored next-due follows it, so items still use lastTested + 3 months', async () => {
    const user = await open({ auditor: 'J', testDate: '2026-07-13', nextTestDate: '2026-10-13', notes: '' });
    fireEvent.change(dates()[0], { target: { value: '2026-09-30' } });
    await waitFor(() => expect(ls('iel-meta-v2').p1.testDate).toBe('2026-09-30'));
    expect(ls('iel-meta-v2').p1.nextTestDate).toBe('2026-12-30');                 // followed the new test date (default again)
    await openItemList(user);
    expect(await screen.findByText('Due: 13/10/2026')).toBeTruthy();                     // the item's own lastTested (13/07) + 3 months, NOT 30/12/2026
    expect(screen.queryByText('Due: 30/12/2026')).toBeNull();
  });
  it('a chosen next-due (set through the picker) survives a later test-date change and shows on the item', async () => {
    const user = await open({ auditor: 'J', testDate: '2026-07-13', notes: '' });
    fireEvent.change(dates()[1], { target: { value: '2027-02-01' } });
    await waitFor(() => expect(ls('iel-meta-v2').p1.nextTestDate).toBe('2027-02-01'));
    fireEvent.change(dates()[0], { target: { value: '2026-09-30' } });
    await waitFor(() => expect(ls('iel-meta-v2').p1.testDate).toBe('2026-09-30'));
    expect(ls('iel-meta-v2').p1.nextTestDate).toBe('2027-02-01');
    await openItemList(user);
    expect(await screen.findByText('Due: 01/02/2027')).toBeTruthy();
    expect(screen.queryByText('Due: 13/10/2026')).toBeNull();
  });
  it('a chosen date in the past is shown as the plain due date: no OVERDUE / DUE SOON flag, in the list or on the item page', async () => {
    const user = await open({ auditor: 'J', testDate: '2026-07-13', nextTestDate: '2020-01-01', notes: '' });
    await openItemList(user);
    expect(await screen.findByText('Due: 01/01/2020')).toBeTruthy();
    expect(screen.queryByText(/OVERDUE|DUE SOON/)).toBeNull();
    await user.click(screen.getByText('Conv 1'));
    expect(await screen.findByText('NEXT TEST DUE:')).toBeTruthy(); expect(screen.getByText('01/01/2020')).toBeTruthy(); expect(screen.queryByText(/OVERDUE|DUE SOON/)).toBeNull();
  });
});

// No interval wording in the IEL screens: the auditor can pick any next-due date, so "3-month cycle" could contradict it. Only the real "Due:" date says when.
describe('IEL screens carry no hard-coded interval wording', () => {
  const INTERVAL = /\b(3|three)[- ]?month(ly|s)?\b|quarterly|every 3 months|\bcycle\b/i;
  const project = { id: 'p1', name: 'Example Quarry', company: 'Example Electrical Pty Ltd', abn: '', licence: '', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'e1', name: 'estops', circuits: ['x'], machineNames: { x: 'Conv 1' } }] }] };
  it('site list, site Home, area list, panel list and item list show no interval text', async () => {
    cleanup(); localStorage.clear();
    localStorage.setItem('iel-projects-v2', JSON.stringify([project])); localStorage.setItem('iel-results-v2', JSON.stringify({ p1: { a: { estops: { x: { status: 'pass', lastTested: '2026-07-13' } } } } }));
    localStorage.setItem('iel-meta-v2', JSON.stringify({ p1: { auditor: 'J', testDate: '2026-07-13', nextTestDate: '2026-11-15', notes: '' } }));
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText('IEL TESTING'));
    const text = () => document.body.textContent;
    await screen.findByText('Example Quarry', { selector: 'div' }); expect(text()).not.toMatch(INTERVAL);          // site list (the site card's sub-line)
    await user.click(screen.getByText('Example Quarry', { selector: 'div' })); await screen.findByText('NEXT TEST DUE'); expect(text()).not.toMatch(INTERVAL);
    await user.click(screen.getAllByText('E-Stops')[0]); await user.click(await screen.findByText('Plant')); expect(text()).not.toMatch(INTERVAL);
    await user.click(await screen.findByText('E-Stops')); await screen.findByText('Conv 1'); expect(text()).not.toMatch(INTERVAL);
    expect(screen.getByText('Due: 15/11/2026')).toBeTruthy();                                                           // the date is still there
  });
  it('the source has no "3-month cycle" text either', () => {
    const src = require('fs').readFileSync(require('path').resolve(__dirname, 'App.jsx'), 'utf8');
    expect(src).not.toMatch(/3-month cycle/i);
  });
});

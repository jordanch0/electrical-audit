// GSD ITEM DATES (FICTIONAL data): a defect's DATE LOGGED. A defect exists only once logged, so the field is always shown (and there is no NEXT TEST DUE: a defect is not tested, its Fix By
// date is informational). Logging stamps the Home date; a hand-edited date holds (clearing it by hand restamps the Home date); a Duplicate is a NEW defect, logged now; Move keeps the date;
// Reset and Complete clear it; Report export: the Register gains a Date Logged column, the header Date Tested = the earliest DATE LOGGED, Next Audit Due unchanged, Home date when none.
// There is NO GSD importer (a GSD site is built in the app), so there is no import path to keep or round-trip.
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExcelJS from 'exceljs';
import AppRoot, { exportGSDExcel, gsdPhotoIO, gsdPhotoStore } from './App.jsx';
import { JPEG_A } from './test/jpeg-fixtures.js';
import { ls, day, HOME, TODAY, at, setDate, homeTab, completeAudit, resetAudit } from './test/item-dates-ui.js';

const ab = n => new Uint8Array(n).buffer;
beforeAll(() => {
  URL.createObjectURL = () => 'blob:gsd-test'; URL.revokeObjectURL = () => {};
  gsdPhotoIO.resize = async f => { const m = /_(\d+)x(\d+)/.exec(f.name) || [0, 300, 400]; return { full: { buf: ab(20), type: 'image/jpeg' }, thumb: { buf: ab(5), type: 'image/jpeg' }, w: +m[1], h: +m[2] }; };
  gsdPhotoIO.exportCopy = async () => ({ dataUrl: JPEG_A });
});
const img = (w = 300, h = 400, n = 'p') => new File(['x'], `${n}_${w}x${h}.jpg`, { type: 'image/jpeg' });
const clearIdb = () => new Promise(res => { const rq = indexedDB.open('sparkcheck-gsd-photos', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('photos'); rq.onsuccess = () => { const db = rq.result; const t = db.transaction('photos', 'readwrite'); t.objectStore('photos').clear(); t.oncomplete = () => { db.close(); res(); }; }; });
beforeEach(async () => {
  cleanup(); localStorage.clear(); await clearIdb();
  localStorage.setItem('gsd-projects-v1', JSON.stringify([{ id: 's1', name: 'Site G', company: 'Co', abn: '', licence: '', areas: [{ id: 'a1', name: 'Concrete Plant' }, { id: 'a2', name: 'Workshop' }] }]));
  localStorage.setItem('gsd-meta-v1', JSON.stringify({ s1: { auditor: 'Jane', testDate: HOME, nextTestDate: '2027-10-05', dateDay: TODAY } }));
  localStorage.setItem('gsd-audit-active-v1', JSON.stringify({ v: 1, sites: { s1: {} } }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
const items = () => ls('gsd-items-v1').s1 || [];

async function openAudit(user) { render(<AppRoot />); await user.click(screen.getByText('GENERAL SITE DEFECTS')); await user.click(await screen.findByText('Site G', { selector: 'div' })); await user.click(screen.getByRole('button', { name: 'Audit' })); }
async function addDefect(user, area) { await user.click(screen.getByRole('button', { name: `Add defect to ${area}` })); await user.upload(screen.getByTestId('gsd-add-photos'), [img()]); await screen.findByText(/^#\d+ · /); }

describe('defect page', () => {
  it('a new defect is logged with the HOME date (not today); the DATE LOGGED field is always shown; there is no NEXT TEST DUE', async () => {
    at(7); const user = userEvent.setup(); await openAudit(user); await addDefect(user, 'Concrete Plant');
    await waitFor(() => expect(items()[0].lastTested).toBe(HOME)); expect(screen.getByText('DATE LOGGED')).toBeInTheDocument(); expect(screen.getByLabelText('Date logged')).toBeInTheDocument();
    expect(screen.queryByText('NEXT TEST DUE:')).toBeNull(); expect(screen.queryByLabelText('Date tested')).toBeNull();
  });
  it('a hand-edited date holds across other edits and days; clearing it by hand restamps the Home date', async () => {
    at(7); const user = userEvent.setup(); await openAudit(user); await addDefect(user, 'Concrete Plant');
    setDate('Date logged', '2026-03-01'); await waitFor(() => expect(items()[0].lastTested).toBe('2026-03-01'));
    at(9); await user.type(screen.getByLabelText('Description'), 'Guard missing'); await user.click(screen.getByRole('button', { name: 'M — Medium' }));
    await waitFor(() => expect(items()[0]).toMatchObject({ description: 'Guard missing', priority: 'M', lastTested: '2026-03-01' }));
    setDate('Date logged', ''); await waitFor(() => expect(items()[0].lastTested).toBe(HOME));
  });
  it('Duplicate is a NEW defect logged with the Home date; the original keeps its own', async () => {
    at(7); const user = userEvent.setup(); await openAudit(user); await addDefect(user, 'Concrete Plant');
    setDate('Date logged', '2026-03-01'); await waitFor(() => expect(items()[0].lastTested).toBe('2026-03-01'));
    await user.click(screen.getByRole('button', { name: 'Duplicate' })); await user.click(within(await screen.findByTestId('gsd-area-picker')).getByRole('button', { name: 'Workshop' }));
    await waitFor(() => expect(items()).toHaveLength(2)); expect(items().map(i => i.lastTested)).toEqual(['2026-03-01', HOME]);
  });
  it('Move keeps the date', async () => {
    at(7); const user = userEvent.setup(); await openAudit(user); await addDefect(user, 'Concrete Plant');
    setDate('Date logged', '2026-03-01'); await waitFor(() => expect(items()[0].lastTested).toBe('2026-03-01'));
    await user.click(screen.getByRole('button', { name: 'Move' })); await user.click(within(await screen.findByTestId('gsd-area-picker')).getByRole('button', { name: 'Workshop' }));
    await waitFor(() => expect(items()[0].areaId).toBe('a2')); expect(items()[0].lastTested).toBe('2026-03-01');
  });
});

describe.each(['Complete', 'Reset'])('%s clears the dates', how => {
  it('the live defects (and so their dates) are cleared', async () => {
    at(7); const user = userEvent.setup(); await openAudit(user); await addDefect(user, 'Concrete Plant'); await waitFor(() => expect(items()[0].lastTested).toBe(HOME));
    await homeTab(user); await (how === 'Complete' ? completeAudit(user) : resetAudit(user));
    await waitFor(() => expect(JSON.stringify(ls('gsd-items-v1').s1 || [])).not.toContain('lastTested'));
    if (how === 'Complete') expect(JSON.stringify(ls('gsd-history-v1'))).toContain(HOME);
  });
});

describe('Report export', () => {
  let payload; beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; }); afterEach(() => { delete window.webkit; });
  const project = { id: 's1', name: 'Site G', company: 'Co', abn: '', licence: '', areas: [{ id: 'a1', name: 'Concrete Plant' }, { id: 'a2', name: 'Workshop' }] };
  const mk = (id, areaId, d) => ({ id, areaId, assetLocation: 'Loc ' + id, category: 'Guarding', commonDefect: '', description: 'Defect ' + id, descAuto: '', photos: [], priority: 'H', responsibility: '', dueDate: '', ...(d ? { lastTested: d } : {}) });
  const load = async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64')); return wb; };
  const meta = { auditor: 'J', testDate: '2026-09-30', nextTestDate: '2027-09-30' };
  it('the Register has a Date Logged column (each defect\'s own date, blank when it has none - never the Home date); the header Date Tested = the earliest DATE LOGGED; Next Audit Due is the Home value', async () => {
    await exportGSDExcel(project, [mk('i1', 'a1', '2026-08-20'), mk('i2', 'a2', '2026-07-13'), mk('i3', 'a2', '')], meta); const wb = await load(); const reg = wb.getWorksheet('Register');
    expect(reg.getRow(6).values.slice(1)).toEqual(['#', 'Area', 'Asset Location', 'Category', 'Description', 'Priority', 'Responsibility', 'Date Logged', 'Fix By Date', 'Photos']);
    expect([7, 8, 9].map(r => String(reg.getCell(r, 8).value ?? ''))).toEqual(['20/08/2026', '13/07/2026', '']);
    expect(String(reg.getCell('A4').value)).toBe('Auditor: J  |  Date Tested: 13/07/2026  |  Next Audit Due: 30/09/2027');
  });
  it('no dated defect -> the Home date', async () => {
    await exportGSDExcel(project, [mk('i1', 'a1', '')], meta); expect(String((await load()).getWorksheet('Register').getCell('A4').value)).toBe('Auditor: J  |  Date Tested: 30/09/2026  |  Next Audit Due: 30/09/2027');
  });
});

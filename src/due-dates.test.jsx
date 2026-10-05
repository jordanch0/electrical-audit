// isOverdue / isDueSoon compare LOCAL calendar dates: an item due today is not overdue and is due soon; it is overdue from the next local day, in any zone at any time of day.
// The old versions compared the date's UTC midnight with the current instant, so "due today" flagged overdue from late morning in the zones ahead of UTC (and the day before was
// still "today" in the zones behind it, in the evening).
// Zone cases run the REAL source (cut from src/App.jsx between its markers) in child node processes with TZ=<zone> and a fixed "now" (only Date is replaced, inside the child) — the
// same method as local-date.test.jsx, which also explains why: vitest workers can't change the zone, and a child process can't leak into the rest of the run.
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

const APP = fs.readFileSync(path.resolve(process.cwd(), 'src/App.jsx'), 'utf8');
const block = name => { const a = `// <${name}>\n`; const i = APP.indexOf(a); if (i < 0) throw new Error('marker ' + name); return APP.slice(i + a.length, APP.indexOf(`\n// </${name}>`, i)); };
const HELPERS = ['localISODate', 'isoFromDateText', 'dueDates'].map(block).join('\n');
// -> [[overdue, dueSoon], ...] for each due date, with "now" = the UTC instant, in the zone
function flags(zone, nowUtc, dues) {
  const now = Date.parse(nowUtc);
  const code = `const NOW = ${now}; const RD = Date; globalThis.Date = class extends RD { constructor(...a) { if (a.length === 0) super(NOW); else super(...a); } static now() { return NOW; } };\n${HELPERS}\nconsole.log(JSON.stringify(${JSON.stringify(dues)}.map(d => [isOverdue(d), isDueSoon(d)])));`;
  return JSON.parse(execFileSync(process.execPath, ['-e', code], { env: { ...process.env, TZ: zone }, encoding: 'utf8' }).trim());
}
const T = true, F = false;
// [zone, now (UTC), local description, [[due, overdue, dueSoon], ...]]
const CASES = [
  ['Australia/Sydney', '2026-10-04T13:30:00Z', 'Mon 5 Oct 00:30 (the UTC date is still the 4th)', [['2026-10-04', T, F], ['2026-10-05', F, T], ['2026-10-19', F, T], ['2026-10-20', F, F], ['', F, F]]],
  ['Australia/Sydney', '2026-10-05T12:30:00Z', 'Mon 5 Oct 23:30', [['2026-10-04', T, F], ['2026-10-05', F, T], ['2026-10-06', F, T]]],
  ['Australia/Sydney', '2026-03-25T01:00:00Z', 'Wed 25 Mar 12:00 — the 14 days cross the 5 Apr clock change', [['2026-04-08', F, T], ['2026-04-09', F, F]]],
  ['America/Los_Angeles', '2026-10-05T06:30:00Z', 'Sun 4 Oct 23:30 (the UTC date is already the 5th)', [['2026-10-03', T, F], ['2026-10-04', F, T], ['2026-10-18', F, T], ['2026-10-19', F, F]]],
  ['America/Los_Angeles', '2026-10-05T07:30:00Z', 'Mon 5 Oct 00:30', [['2026-10-04', T, F], ['2026-10-05', F, T]]],
  ['America/Los_Angeles', '2026-10-20T19:00:00Z', 'Tue 20 Oct 12:00 — the 14 days cross the 1 Nov clock change', [['2026-11-03', F, T], ['2026-11-04', F, F]]],
  ['Pacific/Auckland', '2026-10-05T11:30:00Z', 'Tue 6 Oct 00:30 (the UTC date is still the 5th)', [['2026-10-05', T, F], ['2026-10-06', F, T]]],
  ['Asia/Kolkata', '2026-10-05T18:45:00Z', 'Tue 6 Oct 00:15 (UTC+5:30)', [['2026-10-05', T, F], ['2026-10-06', F, T]]],
  ['Asia/Kolkata', '2026-10-05T18:29:00Z', 'Mon 5 Oct 23:59', [['2026-10-05', F, T], ['2026-10-04', T, F]]],
  ['UTC', '2026-10-05T00:00:00Z', 'Mon 5 Oct 00:00', [['2026-10-04', T, F], ['2026-10-05', F, T]]],
];
describe.each(CASES)('due flags under %s, now = %s (%s)', (zone, now, _desc, rows) => {
  it('overdue / due-soon follow the LOCAL calendar day', () => {
    const got = flags(zone, now, rows.map(r => r[0]));
    rows.forEach((r, i) => expect(got[i], `${zone} ${now} due ${JSON.stringify(r[0])}`).toEqual([r[1], r[2]]));
  });
});
describe('the old rule was wrong in exactly the windows the cases above probe (so they prove something)', () => {
  it('Los Angeles 23:30 on the 4th: the old rule called an item due that day OVERDUE (UTC was already the 5th); the new rule does not', () => {
    const old = (zone, now, due) => JSON.parse(execFileSync(process.execPath, ['-e', `const NOW=${Date.parse(now)};const RD=Date;globalThis.Date=class extends RD{constructor(...a){if(a.length===0)super(NOW);else super(...a);}static now(){return NOW;}};console.log(JSON.stringify(new Date("${due}")<new Date()));`], { env: { ...process.env, TZ: zone }, encoding: 'utf8' }).trim());
    expect(old('America/Los_Angeles', '2026-10-05T06:30:00Z', '2026-10-04')).toBe(true);        // due "today" locally, but the old rule said overdue
    expect(flags('America/Los_Angeles', '2026-10-05T06:30:00Z', ['2026-10-04'])[0][0]).toBe(false);
  });
});

describe('IEL screens: an item due today is not OVERDUE; from the next local day it is (only Date is faked; built from LOCAL components, so any zone)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  const open = async () => {
    localStorage.setItem('iel-projects-v2', JSON.stringify([{ id: 's1', name: 'Site One', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'e1', name: 'estops', circuits: ['x1'], machineNames: { x1: 'Feed Conveyor 1' } }] }] }]));
    localStorage.setItem('iel-meta-v2', JSON.stringify({ s1: { auditor: 'Jane', testDate: '2026-07-13', nextTestDate: '2026-10-05', notes: '' } }));     // a CHOSEN next due: 5 Oct
    localStorage.setItem('iel-results-v2', JSON.stringify({ s1: { a1: { estops: { x1: { status: 'pass', lastTested: '2026-07-13', mechCheck: true, circuitIso: true, lanyardCond: false, notes: '', priority: '', rectified: '' } } } } }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('IEL TESTING', { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /E-Stops/ }));
    await user.click(await screen.findByText('Wash Plant')); await user.click(await screen.findByRole('button', { name: /E-Stops/ }));
    expect(await screen.findByText('Due: 05/10/2026')).toBeInTheDocument();
  };
  it('00:30 local on the due day: DUE SOON, not OVERDUE', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 5, 0, 30, 0));
    await open();
    expect(screen.queryByText('OVERDUE')).toBeNull(); expect(screen.getByText('DUE SOON')).toBeInTheDocument();
  });
  it('23:30 local on the due day: still not OVERDUE', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 5, 23, 30, 0));
    await open();
    expect(screen.queryByText('OVERDUE')).toBeNull();
  });
  it('00:30 local the next day: OVERDUE', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 6, 0, 30, 0));
    await open();
    expect(screen.getByText('OVERDUE')).toBeInTheDocument(); expect(screen.queryByText('DUE SOON')).toBeNull();
  });
});

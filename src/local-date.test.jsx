// localISODate(): the app's one "today" = the DEVICE's own local calendar date (2026-10-05). No time zone is named or assumed in src.
// The old UTC "today" (toISOString of the current instant) was the previous day for the first hours after local midnight in any zone ahead of UTC.
//
// HOW THE ZONE IS SET PER TEST (and why it can't leak): vitest runs test files in worker threads, where assigning process.env.TZ does NOT change the real V8 zone
// (src/date-helpers-dst.test.js notes the same). So the zone cases run the REAL helper source — cut out of src/App.jsx between its <localISODate> markers — in a CHILD node
// process started with TZ=<zone>. The child is a separate OS process: nothing it does can reach this test run, and each case names its own zone. The in-process cases below
// never read a zone: they build their instants from LOCAL components, so they hold in whatever zone the suite runs in (CI and the default are Australia/Sydney).
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { localISODate } from './App.jsx';

const APP = fs.readFileSync(path.resolve(process.cwd(), 'src/App.jsx'), 'utf8');
const HELPER = /\/\/ <localISODate>\n([\s\S]*?)\n\/\/ <\/localISODate>/.exec(APP)[1];            // the real source of the helper

// Runs the helper in a fresh process whose clock is in `zone`; returns [{local, utc, offsetMin}] for the given UTC instants.
function inZone(zone, instants) {
  const code = `${HELPER}\nconst inst = ${JSON.stringify(instants)};\nconsole.log(JSON.stringify(inst.map(t => ({ local: localISODate(new Date(t)), utc: new Date(t).toISOString().slice(0, 10), off: new Date(t).getTimezoneOffset() }))));`;
  const out = execFileSync(process.execPath, ['-e', code], { env: { ...process.env, TZ: zone }, encoding: 'utf8' });
  return JSON.parse(out.trim());
}
const CASES = [
  // [zone, [[utc instant, expected LOCAL date, note]]]
  ['UTC', [['2026-10-05T00:00:00Z', '2026-10-05', 'midnight'], ['2026-10-04T23:59:59Z', '2026-10-04', 'last second']]],
  ['Australia/Sydney', [
    ['2026-10-04T13:30:00Z', '2026-10-05', '00:30 local: the UTC date is still the 4th'],
    ['2026-10-03T15:59:00Z', '2026-10-04', 'DST starts 4 Oct: 01:59 before the clocks jump'],
    ['2026-10-03T16:00:00Z', '2026-10-04', 'DST starts 4 Oct: 03:00 after the jump'],
    ['2026-04-04T15:30:00Z', '2026-04-05', 'DST ends 5 Apr: 02:30 (first time)'],
    ['2026-04-04T16:30:00Z', '2026-04-05', 'DST ends 5 Apr: 02:30 again (an hour later)'],
    ['2026-04-05T13:59:00Z', '2026-04-05', 'DST day: 23:59'],
    ['2026-04-05T14:00:00Z', '2026-04-06', 'DST day: midnight, the next local day (a 25-hour day)'],
  ]],
  ['America/Los_Angeles', [
    ['2026-10-05T06:30:00Z', '2026-10-04', '23:30 local: the UTC date is already the 5th'],
    ['2026-11-01T08:30:00Z', '2026-11-01', 'DST ends 1 Nov: 01:30 PDT'],
    ['2026-11-01T09:30:00Z', '2026-11-01', 'DST ends 1 Nov: 01:30 PST (repeated hour)'],
    ['2026-11-02T07:59:00Z', '2026-11-01', 'DST day: 23:59'],
    ['2026-11-02T08:00:00Z', '2026-11-02', 'DST day: midnight (a 25-hour day)'],
  ]],
  ['Pacific/Auckland', [['2026-10-05T11:30:00Z', '2026-10-06', '00:30 local (UTC+13): the UTC date is still the 5th']]],
  ['Asia/Kolkata', [
    ['2026-10-05T18:45:00Z', '2026-10-06', '00:15 local (UTC+5:30): the UTC date is still the 5th'],
    ['2026-10-05T18:29:00Z', '2026-10-05', '23:59 local'],
  ]],
];
describe.each(CASES)('localISODate under %s (a child process with TZ set)', (zone, rows) => {
  it('returns the LOCAL date of each instant, including just after local midnight and across a clock change', () => {
    const got = inZone(zone, rows.map(r => r[0]));
    rows.forEach((r, i) => expect(got[i].local, `${zone} ${r[0]} ${r[2]}`).toBe(r[1]));
  });
});
describe('the zone really is applied, and the UTC date really differs (so the cases above prove something)', () => {
  it('offsets: Sydney 660 / Auckland 780 (summer) are ahead, Los Angeles 420 behind, Kolkata 330 ahead (non-whole hour)', () => {
    expect(inZone('Australia/Sydney', ['2026-10-05T00:00:00Z'])[0].off).toBe(-660);
    expect(inZone('Pacific/Auckland', ['2026-10-05T00:00:00Z'])[0].off).toBe(-780);
    expect(inZone('America/Los_Angeles', ['2026-10-05T00:00:00Z'])[0].off).toBe(420);
    expect(inZone('Asia/Kolkata', ['2026-10-05T00:00:00Z'])[0].off).toBe(-330);
  });
  it('the old UTC "today" was wrong in exactly those windows (Sydney morning, Auckland morning, Kolkata after midnight, Los Angeles evening)', () => {
    expect(inZone('Australia/Sydney', ['2026-10-04T13:30:00Z'])[0]).toMatchObject({ local: '2026-10-05', utc: '2026-10-04' });
    expect(inZone('Pacific/Auckland', ['2026-10-05T11:30:00Z'])[0]).toMatchObject({ local: '2026-10-06', utc: '2026-10-05' });
    expect(inZone('Asia/Kolkata', ['2026-10-05T18:45:00Z'])[0]).toMatchObject({ local: '2026-10-06', utc: '2026-10-05' });
    expect(inZone('America/Los_Angeles', ['2026-10-05T06:30:00Z'])[0]).toMatchObject({ local: '2026-10-04', utc: '2026-10-05' });
  });
});

describe('localISODate in the zone the suite itself runs in (no zone read: instants are built from local components)', () => {
  it('00:30 and 23:30 local are the same local day, whatever the zone; the next minute after 23:59 is the next day', () => {
    expect(localISODate(new Date(2026, 9, 5, 0, 30))).toBe('2026-10-05');
    expect(localISODate(new Date(2026, 9, 5, 23, 30))).toBe('2026-10-05');
    expect(localISODate(new Date(2026, 9, 5, 23, 59, 59))).toBe('2026-10-05');
    expect(localISODate(new Date(2026, 9, 6, 0, 0, 0))).toBe('2026-10-06');
  });
  it('pads month and day; handles month / year ends and a leap day', () => {
    expect(localISODate(new Date(2026, 0, 3))).toBe('2026-01-03');
    expect(localISODate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
    expect(localISODate(new Date(2027, 0, 1, 0, 0))).toBe('2027-01-01');
    expect(localISODate(new Date(2028, 1, 29, 12))).toBe('2028-02-29');
  });
  it('no argument = the current local date', () => { expect(localISODate()).toBe(localISODate(new Date())); });
});

describe('source rules: one "today", and no zone named in the app code', () => {
  const SRC = [APP, fs.readFileSync(path.resolve(process.cwd(), 'src/main.jsx'), 'utf8')];
  it('no `new Date().toISOString()...slice` "today" is left in the app (the date-only maths on ISO strings is separate and stays)', () => {
    SRC.forEach(s => expect(/new Date\(\)\s*\.toISOString\(\)\s*\.slice\(/.test(s)).toBe(false));
  });
  it('no time zone, UTC offset or named zone is hard-coded in src (the test environment sets TZ; the app never does)', () => {
    SRC.forEach(s => expect(/Australia\/|Sydney|Brisbane|Melbourne|Perth|Adelaide|Pacific\/|America\/|Asia\/|Europe\/|timeZone|AEST|AEDT|UTC[+-]\d|GMT[+-]\d/.test(s)).toBe(false));
  });
});

describe('the app uses it: a fresh site\'s Home date is the LOCAL date, just after local midnight', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { cleanup(); vi.useRealTimers(); });                                              // the fake clock never outlives its test
  it('IEL Home TEST DATE at 00:30 local on 5 Oct shows 05/10/2026 (the old UTC "today" showed 04/10/2026 in Sydney)', async () => {
    localStorage.setItem('iel-projects-v2', JSON.stringify([{ id: 's1', name: 'Site One', company: '', abn: '', licence: '', areas: [] }]));
    vi.useFakeTimers({ toFake: ['Date'] });                                                          // Date only: timers, promises and user-event keep running for real
    vi.setSystemTime(new Date(2026, 9, 5, 0, 30, 0));                                                // built from LOCAL components, so it is 00:30 on the 5th in any zone
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('IEL TESTING', { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' }));
    expect(await screen.findByText('05/10/2026')).toBeInTheDocument();
  });
});

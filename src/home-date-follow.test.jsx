// THE HOME-DATE FOLLOW (all nine modules): a site's Home date follows the device's local date. meta.dateDay = the local day the Home date was last set AUTOMATICALLY.
// On a check (open / return to the foreground / the local-midnight timer) a site whose dateDay is not today gets today's date; a MANUAL edit changes only the date, so it holds
// until the next day change; a stored next-due that is only the DEFAULT for the old date moves with it, a chosen one stays; Reset and Complete no longer set the Home date.
// The follow never creates a meta record, never touches results / History / the active flag / the gate, and leaves orphan records alone. (FICTIONAL data.)
// Only Date is faked (built from LOCAL components, so any zone); the zone cases of the midnight maths run in CHILD processes with TZ set (see local-date.test.jsx for why).
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { ITEM_DATES_READY, homeDateFollow, homeDateFollowAll, HOME_DATE_SPECS, msToLocalMidnight, addMonthsISO, addYearsISO } from './App.jsx';
import { MODULES, liveStore, histStore, clone } from './test/item-dates-fixtures.js';

const APP = fs.readFileSync(path.resolve(process.cwd(), 'src/App.jsx'), 'utf8');
const ls = k => JSON.parse(localStorage.getItem(k));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const at = (y, m, d, h = 12, mi = 0, s = 0) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(y, m - 1, d, h, mi, s)); };

describe('homeDateFollow (pure)', () => {
  const IEL = HOME_DATE_SPECS.iel;
  it('only an EXISTING record is followed; one already followed today is left exactly as it is (a manual edit holds)', () => {
    expect(homeDateFollow(undefined, '2026-10-05', IEL)).toBeNull(); expect(homeDateFollow(null, '2026-10-05', IEL)).toBeNull();
    const edited = { auditor: 'J', testDate: '2026-09-01', nextTestDate: '2026-12-01', dateDay: '2026-10-05' };            // the auditor chose 1 Sep today
    expect(homeDateFollow(edited, '2026-10-05', IEL)).toBeNull();
  });
  it('a record last set on an earlier day (or with no dateDay: legacy) gets today and dateDay = today; other fields are kept', () => {
    expect(homeDateFollow({ auditor: 'J', testDate: '2026-10-01', dateDay: '2026-10-01', notes: 'n' }, '2026-10-05', IEL)).toMatchObject({ auditor: 'J', notes: 'n', testDate: '2026-10-05', dateDay: '2026-10-05' });
    expect(homeDateFollow({ auditor: 'J', testDate: '2026-10-01' }, '2026-10-05', IEL)).toMatchObject({ testDate: '2026-10-05', dateDay: '2026-10-05' });
    expect(homeDateFollow({ auditor: 'J' }, '2026-10-05', IEL)).toMatchObject({ testDate: '2026-10-05', dateDay: '2026-10-05' });         // a record with no date yet
  });
  it('a manual edit holds until the NEXT day change, then the date follows again (and the edit is gone)', () => {
    let m = { testDate: '2026-10-01', dateDay: '2026-10-01', nextTestDate: '2027-01-01' };
    m = homeDateFollow(m, '2026-10-05', IEL);                                                                              // day change: follows
    m = { ...m, testDate: '2026-09-20', nextTestDate: '2026-12-20' };                                                       // manual edit (dateDay untouched)
    expect(homeDateFollow(m, '2026-10-05', IEL)).toBeNull();                                                                // same day: holds
    expect(homeDateFollow(m, '2026-10-06', IEL)).toMatchObject({ testDate: '2026-10-06', dateDay: '2026-10-06' });          // next day: follows again
  });
  it('the next-due moves with it when it is only the DEFAULT for the old date (or empty); a CHOSEN next-due stays', () => {
    const base = { testDate: '2026-10-01', dateDay: '2026-10-01' };
    expect(homeDateFollow({ ...base, nextTestDate: addMonthsISO('2026-10-01', 3) }, '2026-10-05', IEL).nextTestDate).toBe('2027-01-05');   // the default moved
    expect(homeDateFollow({ ...base, nextTestDate: '' }, '2026-10-05', IEL).nextTestDate).toBe('2027-01-05');                              // empty: the default for the new date
    expect(homeDateFollow({ ...base, nextTestDate: '2026-12-25' }, '2026-10-05', IEL).nextTestDate).toBe('2026-12-25');                    // chosen: kept
  });
  it('RCD follows push AND inject, each with its own next-due and interval; TAT has no next-due', () => {
    const r = homeDateFollow({ pushDate: '2026-10-01', injectDate: '2026-09-20', nextPushDate: addMonthsISO('2026-10-01', 1), nextInjectDate: '2027-03-03', dateDay: '2026-10-01' }, '2026-10-05', HOME_DATE_SPECS.rcd);
    expect(r).toMatchObject({ pushDate: '2026-10-05', injectDate: '2026-10-05', nextPushDate: '2026-11-05', nextInjectDate: '2027-03-03', dateDay: '2026-10-05' });   // push default moved, chosen inject next kept
    const t = homeDateFollow({ testDate: '2026-10-01', dateDay: '2026-10-01' }, '2026-10-05', HOME_DATE_SPECS.tat); expect(t).toEqual({ testDate: '2026-10-05', dateDay: '2026-10-05' });
  });
  it('the module intervals are the ones each Home screen already uses', () => {
    const d = '2026-10-05', n = k => HOME_DATE_SPECS[k][0].nextOf(d);
    expect(n('iel')).toBe(addMonthsISO(d, 3)); expect(n('welder')).toBe(addMonthsISO(d, 3)); expect(n('elt')).toBe(addMonthsISO(d, 6));
    ['thermo', 'swb', 'irt', 'gsd'].forEach(k => expect(n(k)).toBe(addYearsISO(d, 1)));
    expect(HOME_DATE_SPECS.rcd[0].nextOf(d)).toBe(addMonthsISO(d, 1)); expect(HOME_DATE_SPECS.rcd[1].nextOf(d)).toBe(addYearsISO(d, 1)); expect(HOME_DATE_SPECS.tat[0].next).toBeUndefined();
  });
  it('homeDateFollowAll: only sites that exist; orphans are left alone; no record is created; the SAME object comes back when nothing changes', () => {
    const all = { s1: { testDate: '2026-10-01', dateDay: '2026-10-01' }, s2: { testDate: '2026-10-05', dateDay: '2026-10-05' }, GONE: { auditor: 'Old orphan' } };
    const out = homeDateFollowAll(all, '2026-10-05', IEL, new Set(['s1', 's2', 's3']));
    expect(out.s1).toMatchObject({ testDate: '2026-10-05', dateDay: '2026-10-05' }); expect(out.s2).toBe(all.s2); expect(out.GONE).toBe(all.GONE); expect(Object.keys(out).sort()).toEqual(['GONE', 's1', 's2']);   // s3 has no record: none created
    const same = homeDateFollowAll(out, '2026-10-05', IEL, new Set(['s1', 's2'])); expect(same).toBe(out);
    expect(homeDateFollowAll({}, '2026-10-05', IEL, new Set())).toEqual({});
  });
});

describe('msToLocalMidnight under several zones (child processes with TZ set): the next local midnight + 1 s, DST-safe', () => {
  const LINE = /const msToLocalMidnight = [^\n]*/.exec(APP)[0];
  const ms = (zone, nowUtc) => Number(execFileSync(process.execPath, ['-e', `${LINE}\nconsole.log(msToLocalMidnight(new Date(${Date.parse(nowUtc)})));`], { env: { ...process.env, TZ: zone }, encoding: 'utf8' }).trim());
  const H = 3600 * 1000;
  it.each([
    ['Australia/Sydney', '2026-10-03T13:00:00Z', 1 * H + 1000, 'Sat 3 Oct 23:00 -> 00:00:01'],
    ['Australia/Sydney', '2026-10-03T14:00:00Z', 23 * H + 1000, 'Sun 4 Oct 00:00: a 23-hour day (clocks go forward)'],
    ['Australia/Sydney', '2026-04-04T13:00:00Z', 25 * H + 1000, 'Sun 5 Apr 00:00: a 25-hour day (clocks go back)'],
    ['America/Los_Angeles', '2026-11-01T07:00:00Z', 25 * H + 1000, 'Sun 1 Nov 00:00: a 25-hour day'],
    ['America/Los_Angeles', '2026-03-08T08:00:00Z', 23 * H + 1000, 'Sun 8 Mar 00:00: a 23-hour day'],
    ['Pacific/Auckland', '2026-09-26T12:00:00Z', 23 * H + 1000, 'Sun 27 Sep 00:00: a 23-hour day'],
    ['Asia/Kolkata', '2026-10-05T18:30:00Z', 24 * H + 1000, 'Tue 6 Oct 00:00 (UTC+5:30)'],
    ['UTC', '2026-10-05T00:00:30Z', 24 * H - 30 * 1000 + 1000, 'Mon 5 Oct 00:00:30'],
    ['UTC', '2026-10-05T23:59:59Z', 2000, 'one second before midnight'],
  ])('%s %s -> %i ms (%s)', (zone, now, expected) => { expect(ms(zone, now)).toBe(expected); });
  it('in the suite zone: the delay always lands on a local 00:00:01', () => {
    [[2026, 10, 5, 0, 0, 30], [2026, 10, 5, 23, 59, 59], [2026, 4, 5, 1, 30, 0], [2026, 10, 4, 1, 0, 0]].forEach(([y, mo, d, h, mi, s]) => {
      const now = new Date(y, mo - 1, d, h, mi, s), t = new Date(now.getTime() + msToLocalMidnight(now));
      expect([t.getHours(), t.getMinutes(), t.getSeconds()]).toEqual([0, 0, 1]); expect(t.getDate()).toBe(new Date(y, mo - 1, d + 1).getDate());
    });
  });
});

describe.each(MODULES)('$mod: the follow in the real app', f => {
  beforeEach(() => { localStorage.clear(); });
  const spec = HOME_DATE_SPECS[f.mod], first = spec[0];
  const seedMeta = (over = {}) => {
    const m = { auditor: 'Jane', dateDay: '2026-10-01', notes: '' }; spec.forEach(x => { m[x.test] = '2026-10-01'; if (x.next) m[x.next] = x.nextOf('2026-10-01'); }); return { ...m, ...over };
  };
  const seed = (meta = seedMeta(), extra = {}) => {
    rawSetItem(f.keys.p, JSON.stringify(f.project)); rawSetItem(f.keys.r, JSON.stringify({ s1: clone(f.live) })); rawSetItem(f.keys.m, JSON.stringify({ s1: meta, ...extra })); rawSetItem(f.keys.h, JSON.stringify(histStore(f).map(h => ({ ...h, meta: { ...h.meta, dateDay: '2026-08-10' } }))));       // snapshots already through the backfill
    if (f.mod === 'gsd') rawSetItem(f.keys.r, JSON.stringify({ s1: clone(f.live) }));
  };
  const open = async () => { const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText(f.tile, { exact: true })); await screen.findByText('Site One', { selector: 'div' }); return user; };
  it('opened days after the Home date was set: it is today\'s local date, dateDay = today, the default next-due moved with it', async () => {
    at(2026, 10, 5); seed(); await open();
    const m = ls(f.keys.m).s1; spec.forEach(x => { expect(m[x.test]).toBe('2026-10-05'); if (x.next) expect(m[x.next]).toBe(x.nextOf('2026-10-05')); }); expect(m.dateDay).toBe('2026-10-05'); expect(m.auditor).toBe('Jane');
  });
  it('a CHOSEN next-due stays when the Home date follows', async () => {
    if (!first.next) return;
    at(2026, 10, 5); seed(seedMeta({ [first.next]: '2027-12-25' })); await open(); expect(ls(f.keys.m).s1[first.next]).toBe('2027-12-25');
  });
  it('already followed today: a manually edited Home date is left exactly as it is, on open and on every later check the same day', async () => {
    at(2026, 10, 5); seed(seedMeta({ dateDay: '2026-10-05', [first.test]: '2026-09-01' })); await open();
    expect(ls(f.keys.m).s1[first.test]).toBe('2026-09-01');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('pageshow')); });
    expect(ls(f.keys.m).s1[first.test]).toBe('2026-09-01');
  });
  it('returning to the foreground the NEXT day follows again (the manual edit ends); a hidden page does nothing', async () => {
    at(2026, 10, 5); seed(seedMeta({ dateDay: '2026-10-05', [first.test]: '2026-09-01' })); await open();
    vi.setSystemTime(new Date(2026, 9, 6, 8, 0, 0));
    const vis = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden'); act(() => { document.dispatchEvent(new Event('visibilitychange')); }); expect(ls(f.keys.m).s1[first.test]).toBe('2026-09-01');
    vis.mockReturnValue('visible'); act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(() => expect(ls(f.keys.m).s1[first.test]).toBe('2026-10-06')); expect(ls(f.keys.m).s1.dateDay).toBe('2026-10-06');
  });
  it('the local-midnight timer is armed from the device clock and, when it fires after midnight, follows (and re-arms)', async () => {
    const spy = vi.spyOn(globalThis, 'setTimeout'); at(2026, 10, 5, 23, 59, 30); seed(seedMeta({ dateDay: '2026-10-05', [first.test]: '2026-10-05' })); await open();
    const armed = spy.mock.calls.filter(c => c[1] === msToLocalMidnight(new Date(2026, 9, 5, 23, 59, 30)));
    expect(armed.length).toBeGreaterThan(0); expect(msToLocalMidnight(new Date(2026, 9, 5, 23, 59, 30))).toBe(31000);          // 30 s to midnight + 1 s
    vi.setSystemTime(new Date(2026, 9, 6, 0, 0, 2)); const before = spy.mock.calls.length; act(() => { armed[armed.length - 1][0](); });
    await waitFor(() => expect(ls(f.keys.m).s1[first.test]).toBe('2026-10-06'));
    expect(spy.mock.calls.slice(before).some(c => c[1] === msToLocalMidnight(new Date(2026, 9, 6, 0, 0, 2)))).toBe(true);    // armed again for the next midnight
  });
  it('touches nothing else: results, History, the active flag and the gate are as seeded; a site with no meta gets none; an orphan stays as it is', async () => {
    at(2026, 10, 5); seed(seedMeta(), { GONE: { auditor: 'Old orphan' } });
    rawSetItem(f.keys.m.replace('-meta-', '-audit-active-'), JSON.stringify({ v: 1, sites: {} }));
    const before = [localStorage.getItem(f.keys.r), localStorage.getItem(f.keys.h), localStorage.getItem(f.keys.m.replace('-meta-', '-audit-active-'))];
    await open();
    expect([localStorage.getItem(f.keys.r), localStorage.getItem(f.keys.h), localStorage.getItem(f.keys.m.replace('-meta-', '-audit-active-'))]).toEqual(before);
    expect(ls(f.keys.m).GONE).toEqual({ auditor: 'Old orphan' }); expect(Object.keys(ls(f.keys.m)).sort()).toEqual(['GONE', 's1']);
  });
});

describe('the follow with no meta record: none is created, and the Home screen still shows today', () => {
  beforeEach(() => localStorage.clear());
  it('IEL: a site with no stored meta keeps none after the follow; its Home date shows the local date', async () => {
    const f = MODULES.find(m => m.mod === 'iel'); at(2026, 10, 5, 0, 30, 0);
    rawSetItem(f.keys.p, JSON.stringify(f.project));
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText(f.tile, { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' }));
    expect(await screen.findByText('05/10/2026')).toBeInTheDocument(); expect(ls(f.keys.m)).toEqual({});
  });
});

describe('Reset and Complete no longer set the Home date (the six Home screens with a Reset), and the follow waits for the backfill', () => {
  const HOMES = [['rcd', 'Reset all test results'], ['iel', 'Reset all test results'], ['tat', 'Reset all test results'], ['thermo', 'Reset all photo logs'], ['swb', 'Reset all test results'], ['irt', 'Reset all test results']];
  it.each(HOMES)('%s: after Reset the Home date is what the auditor set it to (it used to jump to today)', async (mod, idle) => {
    const f = MODULES.find(m => m.mod === mod); const spec = HOME_DATE_SPECS[mod]; localStorage.clear();
    at(2026, 10, 5); const meta = { auditor: 'Jane', dateDay: '2026-10-05', notes: '' }; spec.forEach(x => { meta[x.test] = '2026-09-01'; });                       // edited to 1 Sep today
    rawSetItem(f.keys.p, JSON.stringify(f.project)); rawSetItem(f.keys.m, JSON.stringify({ s1: meta })); rawSetItem(f.keys.r, JSON.stringify({ s1: clone(f.live) }));
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText(f.tile, { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: idle })); await user.click(within((await screen.findByText(/^Reset all (results|photo logs)\?$/)).parentElement).getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(ls(f.keys.r).s1).toEqual({})); spec.forEach(x => expect(ls(f.keys.m).s1[x.test]).toBe('2026-09-01'));
  });
  it('source: no Reset / Complete handler writes a Home date any more', () => {
    expect(/\.\.\.prev\[activeProject\],[^}\n]*\b(testDate|pushDate|injectDate)\s*:\s*(localISODate\(\)|today\(\))/.test(APP)).toBe(false);
    expect(/\.\.\.meta,\s*testDate:\s*localISODate\(\)/.test(APP)).toBe(false);
  });
  it('the follow waits for the backfill: while a module is not marked ready (the backfill did not succeed) its Home date is NOT moved, and it moves as soon as it is ready', async () => {
    const f = MODULES.find(m => m.mod === 'iel'); at(2026, 10, 5);
    rawSetItem(f.keys.p, JSON.stringify(f.project)); rawSetItem(f.keys.m, JSON.stringify({ s1: { auditor: 'Jane', testDate: '2026-10-05', dateDay: '2026-10-05', nextTestDate: '2027-01-05' } }));
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText(f.tile, { exact: true })); await screen.findByText('Site One', { selector: 'div' });
    delete ITEM_DATES_READY.iel; vi.setSystemTime(new Date(2026, 9, 7, 9, 0, 0));
    act(() => { document.dispatchEvent(new Event('visibilitychange')); }); expect(ls(f.keys.m).s1.testDate).toBe('2026-10-05');                 // not ready: nothing moves
    ITEM_DATES_READY.iel = true; act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(() => expect(ls(f.keys.m).s1.testDate).toBe('2026-10-07'));
  });
});

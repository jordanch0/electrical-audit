// RESET and COMPLETE AUDIT start a NEW audit, so they set the Home date back to today's LOCAL date and dateDay to today, in all nine modules (RCD: both the push and the injection date). A hand-edited
// (backdated) date is released; an unedited one stays today; a default next-due moves with it, a chosen one is still cleared by Reset (as before); a day change afterwards works as before.
// Only Date is faked; the device day is 5 Oct, the edited Home date 1 Sep.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { HOME_DATE_SPECS } from './App.jsx';
import { GATE_MODS } from './test/gate-seeds.js';

const TODAY = '2026-10-05', EDITED = '2026-09-01';
const ls = k => JSON.parse(localStorage.getItem(k));
const at = (d, h = 12) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, d, h, 0, 0)); };
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.useRealTimers(); });
const modOf = m => m.short.toLowerCase();

// a site with marked results and a started audit, Home dates as given (dateDay = the device day: the follow has already run today)
function seed(m, dates, extra = {}) {
  localStorage.setItem(m.p, JSON.stringify([{ id: 's1', name: 'Site One', company: '', abn: '', licence: '', areas: m.areas }]));
  const meta = { auditor: 'Jane', notes: '', dateDay: TODAY, ...extra }; HOME_DATE_SPECS[modOf(m)].forEach(f => { meta[f.test] = dates; });
  localStorage.setItem(m.m, JSON.stringify({ s1: meta }));
  localStorage.setItem(m.r, JSON.stringify({ s1: m.marked }));
  localStorage.setItem(m.a, JSON.stringify({ v: 1, sites: { s1: m.entry || {} } }));
}
async function openHome(user, m) { render(<AppRoot />); await user.click(screen.getByText(m.tile, { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' })); }
async function run(user, how) {
  if (how === 'Complete') { await user.click(screen.getByRole('button', { name: /^Complete/ })); await user.click(await screen.findByRole('button', { name: /^Yes/ })); }
  else { await user.click(screen.getByRole('button', { name: /^Reset/ })); await user.click(await screen.findByRole('button', { name: /^(Reset|Yes)$/ })); }
}
const homeDates = m => { const x = ls(m.m).s1; return HOME_DATE_SPECS[modOf(m)].map(f => x[f.test]); };

describe.each(GATE_MODS)('$short', m => {
  describe.each(['Reset', 'Complete'])('%s', how => {
    it('a hand-edited (backdated) Home date goes back to today, and dateDay is today', async () => {
      at(5); seed(m, EDITED); const user = userEvent.setup(); await openHome(user, m);
      expect(homeDates(m).every(d => d === EDITED)).toBe(true);
      await run(user, how);
      await waitFor(() => expect(homeDates(m).every(d => d === TODAY)).toBe(true)); expect(ls(m.m).s1.dateDay).toBe(TODAY);
    });
    it('an unedited Home date stays today', async () => {
      at(5); seed(m, TODAY); const user = userEvent.setup(); await openHome(user, m); await run(user, how);
      await waitFor(() => expect(ls(m.m).s1.dateDay).toBe(TODAY)); expect(homeDates(m).every(d => d === TODAY)).toBe(true);
    });
  });
});

describe('RCD: the push date and the injection date are released separately', () => {
  const m = GATE_MODS.find(x => x.short === 'RCD');
  it.each(['Reset', 'Complete'])('%s: pushDate and injectDate (edited to different past dates) both go back to today', async how => {
    at(5); seed(m, EDITED); const meta = ls(m.m); meta.s1.pushDate = '2026-09-01'; meta.s1.injectDate = '2026-08-15'; localStorage.setItem(m.m, JSON.stringify(meta));
    const user = userEvent.setup(); await openHome(user, m); await run(user, how);
    await waitFor(() => expect(ls(m.m).s1.pushDate).toBe(TODAY)); expect(ls(m.m).s1.injectDate).toBe(TODAY); expect(ls(m.m).s1.dateDay).toBe(TODAY);
  });
});

describe('next-due and the day change (IEL)', () => {
  const m = GATE_MODS.find(x => x.short === 'IEL');
  it('Complete: a DEFAULT next-due (old date + 3 months) moves with the date; a CHOSEN one stays', async () => {
    at(5); seed(m, EDITED, { nextTestDate: '2026-12-01' }); let user = userEvent.setup(); await openHome(user, m); await run(user, 'Complete');
    await waitFor(() => expect(ls(m.m).s1.testDate).toBe(TODAY)); expect(ls(m.m).s1.nextTestDate).toBe('2027-01-05');
    cleanup(); localStorage.clear(); seed(m, EDITED, { nextTestDate: '2030-01-01' }); user = userEvent.setup(); await openHome(user, m); await run(user, 'Complete');
    await waitFor(() => expect(ls(m.m).s1.testDate).toBe(TODAY)); expect(ls(m.m).s1.nextTestDate).toBe('2030-01-01');
  });
  it('Reset still clears a chosen next-due', async () => {
    at(5); seed(m, EDITED, { nextTestDate: '2030-01-01' }); const user = userEvent.setup(); await openHome(user, m); await run(user, 'Reset');
    await waitFor(() => expect(ls(m.m).s1.testDate).toBe(TODAY)); expect(ls(m.m).s1.nextTestDate).toBe('');
  });
  it('after the release a day change works as before (the next day the Home date follows to that day), and a manual edit still holds until then', async () => {
    at(5); seed(m, EDITED); const user = userEvent.setup(); await openHome(user, m); await run(user, 'Reset'); await waitFor(() => expect(ls(m.m).s1.testDate).toBe(TODAY));
    vi.setSystemTime(new Date(2026, 9, 6, 9, 0, 0)); act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(() => expect(ls(m.m).s1.testDate).toBe('2026-10-06')); expect(ls(m.m).s1.dateDay).toBe('2026-10-06');
  });
});

// THE ITEM-DATE BACKFILL (all nine modules, OLD-format fixtures in src/test/item-dates-fixtures.js, FICTIONAL data).
// Results saved before item dates existed get a FIXED date: a live audit's items get that site's STORED Home date; a History snapshot's items get the snapshot's OWN date (never the live
// Home date, which now changes daily). Additive (only items with a result and no date), idempotent, in memory at load (the app's normal save effects persist it), and run BEFORE the
// Home-date follow. Old data is recognised by the data itself — a meta (or a snapshot's meta) with no dateDay — so a backup restored after the app has already been migrated is covered too.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { itemDatesMigrate, itemDatesLoadStep, ITEM_DATES_READY } from './App.jsx';
import { MODULES, liveStore, metaStore, histStore, expHistStore, clone } from './test/item-dates-fixtures.js';

afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => localStorage.clear());
const ls = k => JSON.parse(localStorage.getItem(k));

describe.each(MODULES)('$mod: itemDatesMigrate (pure)', f => {
  const run = (results = liveStore(f), meta = metaStore(f), history = histStore(f), today = '2026-10-05') => itemDatesMigrate(f.mod, results, meta, history, today);
  it('live items with a result and no date get the site\'s stored Home date; a snapshot\'s items get the snapshot\'s own date; untested items and existing dates are untouched', () => {
    const out = run();
    expect(out.results).toEqual({ s1: f.expLive }); expect(out.history).toEqual(expHistStore(f)); expect(out.changed).toBe(f.stamped);
  });
  it('is pure (the input is not mutated) and idempotent (a second run changes nothing)', () => {
    const live = liveStore(f), hist = histStore(f), before = JSON.stringify([live, hist]);
    const once = run(live, metaStore(f), hist); expect(JSON.stringify([live, hist])).toBe(before);
    const twice = itemDatesMigrate(f.mod, once.results, metaStore(f), once.history, '2030-01-01');                  // even with a different "today"
    expect(twice.changed).toBe(0); expect(twice.results).toEqual(once.results); expect(twice.history).toEqual(once.history);
    const moved = itemDatesMigrate(f.mod, once.results, { s1: { ...f.meta, testDate: '2031-01-01', pushDate: '2031-01-01', injectDate: '2031-01-01' } }, once.history, '2031-01-01');
    expect(moved.changed).toBe(0); expect(moved.results).toEqual(once.results);                                    // a changed Home date never reaches a dated item
  });
  it('only OLD-format data is touched: a site whose meta has dateDay, and a snapshot whose meta has dateDay, are left exactly as they are', () => {
    const followed = { s1: { ...f.meta, dateDay: '2026-10-01' } }, snaps = histStore(f).map(s => ({ ...s, meta: { ...s.meta, dateDay: '2026-08-10' } }));
    const out = itemDatesMigrate(f.mod, liveStore(f), followed, snaps, '2026-10-05'); expect(out.changed).toBe(0); expect(out.results).toEqual(liveStore(f)); expect(out.history).toEqual(snaps);
  });
  it('a site with NO stored meta gets the migration-day local date; a snapshot with no date of its own uses its meta, then the local day it was archived', () => {
    const a = run(liveStore(f), {}, histStore(f), '2026-10-05'); const first = JSON.stringify(a.results);
    expect(first).toContain('2026-10-05'); expect(first).not.toContain('2026-09-21');
    const noDate = histStore(f).map(s => { const c = clone(s); delete c.testDate; c.meta = {}; return c; });
    const b = run(liveStore(f), metaStore(f), noDate); expect(JSON.stringify(b.history)).toContain('2026-08-12');       // archivedAt 2026-08-12T01:00Z, the local day it was archived
    expect(JSON.stringify(b.history)).not.toContain('2026-10-05');
  });
  it('empty / odd input is safe', () => {
    expect(itemDatesMigrate(f.mod, {}, {}, [], '2026-10-05')).toEqual({ results: {}, history: [], changed: 0 });
    expect(itemDatesMigrate(f.mod, undefined, undefined, undefined, '2026-10-05')).toEqual({ results: {}, history: [], changed: 0 });
    expect(() => itemDatesMigrate(f.mod, { s1: null, s2: 5, s3: 'x' }, {}, [null, 7, {}], '2026-10-05')).not.toThrow();
  });
});

describe('itemDatesLoadStep: in memory only, and the follow waits for it', () => {
  it('returns the migrated data, writes NOTHING to storage itself, and marks the module ready; on an error it returns the data untouched and the module is NOT ready', () => {
    const f = MODULES.find(m => m.mod === 'iel'); delete ITEM_DATES_READY.iel;
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const out = itemDatesLoadStep('iel', liveStore(f), metaStore(f), histStore(f)); expect(out.results).toEqual({ s1: f.expLive }); expect(ITEM_DATES_READY.iel).toBe(true);
    expect(setItem).not.toHaveBeenCalled(); setItem.mockRestore();
    delete ITEM_DATES_READY.iel; const bad = { s1: { get a() { throw new Error('boom'); } } };
    const same = itemDatesLoadStep('iel', bad, {}, []); expect(same.results).toBe(bad); expect(ITEM_DATES_READY.iel).toBeUndefined(); ITEM_DATES_READY.iel = true;
  });
});

describe.each(MODULES)('$mod: the load in the real app (old-format data in storage)', f => {
  const seed = (extra = {}) => {                                                       // OLD format: no dateDay anywhere
    rawSetItem(f.keys.p, JSON.stringify(f.project)); rawSetItem(f.keys.r, JSON.stringify({ s1: clone(f.live) })); rawSetItem(f.keys.m, JSON.stringify({ s1: { ...f.meta, ...extra } }));
    rawSetItem(f.keys.h, JSON.stringify(histStore(f)));
  };
  const open = async () => { const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText(f.tile, { exact: true })); await screen.findByText('Site One', { selector: 'div' }); return user; };
  it('backfills live items with the stored Home date and the snapshot with its own date, saves through the app, and a second load changes nothing', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 5, 12, 0, 0));                         // opened on 5 Oct; the audit's Home date is 21 Sep
    seed(); await open();
    expect(ls(f.keys.r)).toEqual({ s1: f.expLive }); expect(ls(f.keys.h)).toEqual(expHistStore(f));
    const after = [localStorage.getItem(f.keys.r), localStorage.getItem(f.keys.h)];
    cleanup(); vi.setSystemTime(new Date(2026, 9, 9, 12, 0, 0)); await open();                                      // opened again days later: nothing changes
    expect([localStorage.getItem(f.keys.r), localStorage.getItem(f.keys.h)]).toEqual(after);
  });
  it('never uses the live Home date for the old items: opened days after the audit, they carry the audit\'s own date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 20, 9, 0, 0)); seed(); await open();
    expect(JSON.stringify(ls(f.keys.r))).not.toContain('2026-10-20'); expect(JSON.stringify(ls(f.keys.h))).not.toContain('2026-10-20');
  });
  it('RESTORE after the app was already migrated: an old-format backup put back into storage is dated on the next load, with the BACKUP\'s own dates (not today\'s)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 5, 12, 0, 0));
    rawSetItem(f.keys.p, JSON.stringify(f.project)); rawSetItem(f.keys.r, JSON.stringify({ s1: {} })); rawSetItem(f.keys.m, JSON.stringify({ s1: { ...f.meta, dateDay: '2026-10-05' } })); rawSetItem(f.keys.h, JSON.stringify([]));
    await open();                                                                                                    // the app is up to date and in use...
    cleanup(); vi.setSystemTime(new Date(2026, 9, 12, 9, 0, 0));
    seed();                                                                                                          // ...then a backup made BEFORE this release is restored over it
    await open();
    expect(ls(f.keys.r)).toEqual({ s1: f.expLive }); expect(ls(f.keys.h)).toEqual(expHistStore(f));                // the restored items carry 21 Sep (and the snapshot its 10 Aug) — never 12 Oct
    expect(JSON.stringify(ls(f.keys.r))).not.toContain('2026-10-12');
  });
  it('a site that already went through the follow (its meta has dateDay) is left alone', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 5, 12, 0, 0)); seed({ dateDay: '2026-10-05' }); await open();
    expect(ls(f.keys.r)).toEqual({ s1: f.live });
  });
  it('a site with no stored meta is not given one, and gets today as its items\' date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 5, 12, 0, 0));
    rawSetItem(f.keys.p, JSON.stringify(f.project)); rawSetItem(f.keys.r, JSON.stringify({ s1: clone(f.live) })); rawSetItem(f.keys.h, JSON.stringify([]));
    await open();
    expect(ls(f.keys.m)).toEqual({}); expect(JSON.stringify(ls(f.keys.r))).toContain('2026-10-05');                 // no meta record was created (the module only re-saves the empty map)
  });
});

describe('with the existing audit-active migration (old global keys): both run, nothing lost', () => {
  it('RCD: old rcd-mode-v6 + old results: the site becomes active (as before) AND its items are dated', async () => {
    const f = MODULES.find(m => m.mod === 'rcd');
    rawSetItem(f.keys.p, JSON.stringify(f.project)); rawSetItem(f.keys.r, JSON.stringify({ s1: clone(f.live) })); rawSetItem(f.keys.m, JSON.stringify({ s1: { ...f.meta } })); rawSetItem('rcd-mode-v6', JSON.stringify('push'));
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText(f.tile, { exact: true })); await screen.findByText('Site One', { selector: 'div' });
    expect(Object.keys(ls('rcd-audit-active-v1').sites)).toEqual(['s1']); expect(ls('rcd-mode-v6')).toBe('push');            // the old key is only read, never written
    expect(ls(f.keys.r)).toEqual({ s1: f.expLive });
  });
});

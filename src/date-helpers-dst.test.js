// Date helpers must not lose a day when the addition crosses a daylight-saving boundary. The old local-time setMonth + toISOString pattern returned 12/10 for 13/07 + 3 months in Sydney.
//
// HOW THE ZONE IS SET (release s): vitest runs test files in worker threads, where assigning process.env.TZ does NOT change the real V8 zone, so this file used to pass only when the machine was already on Sydney time
// (CI set TZ for it; on a UTC machine its sanity check failed and the other three tests proved nothing about daylight saving). Now the REAL helper source, cut out of src/App.jsx, runs in a CHILD node process started
// with TZ=<zone> (the way src/local-date.test.jsx does it), so every case names its own zone and the file holds on any machine. No marker comments are needed in App.jsx: each helper is cut by its declaration, and the
// cut is asserted to be found exactly once, so a reformatted or renamed helper fails loudly instead of testing nothing.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

const APP = fs.readFileSync(path.resolve(__dirname, 'App.jsx'), 'utf8');
const cut = (re, name) => { const all = APP.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || []; expect(all.length, 'the source of ' + name + ' is found exactly once').toBe(1); return all[0]; };
const SOURCES = {
  addMonthsISO: cut(/^const addMonthsISO = .*$/m, 'addMonthsISO'),
  addYearsISO: cut(/^const addYearsISO\s*= .*$/m, 'addYearsISO'),
  addTATMonths: cut(/^function addTATMonths\([\s\S]*?\n}\n/m, 'addTATMonths'),
  swbAddYear: cut(/^function swbAddYear\(d\)\{.*\}$/m, 'swbAddYear'),
  irtAddYear: cut(/^function irtAddYear\(d\)\{.*\}$/m, 'irtAddYear'),
};
const PRELUDE = Object.values(SOURCES).join('\n');
const CASES = {
  addTATMonths: [['2026-07-13', 3, '2026-10-13'], ['2026-09-24', 3, '2026-12-24'], ['2026-04-05', 6, '2026-10-05']],
  addMonthsISO: [['2026-07-13', 3, '2026-10-13']],
  addYearsISO: [['2026-10-05', 1, '2027-10-05']],
  swbAddYear: [['2026-10-05', '05/10/2027'], ['2026-04-05', '05/04/2027']],
  irtAddYear: [['2026-10-05', '05/10/2027'], ['2026-04-05', '05/04/2027']],
};
// Runs the real helpers in a fresh process whose clock is in `zone`; returns what they gave plus the zone's own January / July offsets.
function inZone(zone) {
  const code = `${PRELUDE}
const out = { off: [new Date('2026-01-15T00:00:00Z').getTimezoneOffset(), new Date('2026-07-15T00:00:00Z').getTimezoneOffset()], r: {} };
const C = ${JSON.stringify(CASES)};
for (const [k, rows] of Object.entries(C)) out.r[k] = rows.map(row => k === 'swbAddYear' || k === 'irtAddYear' ? eval(k)(row[0]) : eval(k)(row[0], row[1]));
console.log(JSON.stringify(out));`;
  return JSON.parse(execFileSync(process.execPath, ['-e', code], { env: { ...process.env, TZ: zone }, encoding: 'utf8' }).trim());
}
const EXPECTED = Object.fromEntries(Object.entries(CASES).map(([k, rows]) => [k, rows.map(r => r[r.length - 1])]));
// [zone, [January offset, July offset] in minutes as getTimezoneOffset reports them]
const ZONES = [['Australia/Sydney', [-660, -600]], ['UTC', [0, 0]], ['America/Los_Angeles', [480, 420]], ['Pacific/Auckland', [-780, -720]]];

describe('DST-safe date maths, in each zone (the real helper source in a child process)', () => {
  it.each(ZONES)('sanity: the child process really is on %s (its own January and July offsets)', (zone, offsets) => { expect(inZone(zone).off).toEqual(offsets); });
  it.each(ZONES)('%s: addTATMonths crosses daylight saving without losing a day', zone => { expect(inZone(zone).r.addTATMonths).toEqual(EXPECTED.addTATMonths); });
  it.each(ZONES)('%s: addMonthsISO / addYearsISO cross daylight saving without losing a day', zone => { const r = inZone(zone).r; expect(r.addMonthsISO).toEqual(EXPECTED.addMonthsISO); expect(r.addYearsISO).toEqual(EXPECTED.addYearsISO); });
  // swbAddYear / irtAddYear read the ISO date as UTC midnight and format it in LOCAL time, so they are right in a zone at or ahead of UTC (Australia, New Zealand, UTC itself) and a day early west of UTC:
  // CLAUDE.md says they are "correct in Australian timezones", and this file keeps to that claim (found while writing this test: Los Angeles gives 04/10/2027 for 2026-10-05; the app's users are in Australia).
  it.each(ZONES.filter(([, [jan]]) => jan <= 0))('%s: swbAddYear / irtAddYear (display strings) keep the same calendar day across daylight saving', zone => { const r = inZone(zone).r; expect(r.swbAddYear).toEqual(EXPECTED.swbAddYear); expect(r.irtAddYear).toEqual(EXPECTED.irtAddYear); });
});

describe('the old bug is what this file would catch', () => {
  it('local setMonth + toISOString (the pre-fix pattern) loses a day in Sydney, so the Sydney cases above are real tests', () => {
    const code = `const x = new Date('2026-07-13'); x.setMonth(x.getMonth() + 3); console.log(x.toISOString().slice(0, 10));`;
    const sydney = execFileSync(process.execPath, ['-e', code], { env: { ...process.env, TZ: 'Australia/Sydney' }, encoding: 'utf8' }).trim();
    expect(sydney).toBe('2026-10-12');
  });
});

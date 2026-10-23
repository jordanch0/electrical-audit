// Date helpers must not lose a day when the addition crosses a daylight-saving boundary. The old local-time setMonth + toISOString pattern returned 12/10 for 13/07 + 3 months in Sydney.
//
// HOW THE ZONE IS SET (release s): vitest runs test files in worker threads, where assigning process.env.TZ does NOT change the real V8 zone, so this file used to pass only when the machine was already on Sydney time
// (CI set TZ for it; on a UTC machine its sanity check failed and the other three tests proved nothing about daylight saving). Now the REAL helper source, cut out of src/App.jsx, runs in a CHILD node process started
// with TZ=<zone> (the way src/local-date.test.jsx does it), so every case names its own zone and the file holds on any machine. No marker comments are needed in App.jsx: each helper is cut by its declaration, and the
// cut is asserted to be found exactly once, so a reformatted or renamed helper fails loudly instead of testing nothing.
//
// RELEASE t: swbAddYear / irtAddYear are now backupDmy(addYearsISO(d, 1)): UTC date maths and a STRING formatter, so they give the same day in EVERY zone (they used to give a day early west of UTC: Los Angeles gave
// 04/10/2027 for 2026-10-05). The two helpers they use are cut in too, and the cases run in all four zones. fmtDate(addYearsISO(...)) would NOT be right in Los Angeles (fmtDate formats in local time): the "trap" test
// below proves that, so nobody "simplifies" the helpers back to fmtDate.
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
  backupDmy: cut(/^const backupDmy = .*$/m, 'backupDmy'),
  fmtDate: cut(/^const fmtDate = .*$/m, 'fmtDate'),
  swbAddYear: cut(/^function swbAddYear\(d\)\{.*\}(?:\s*\/\/.*)?$/m, 'swbAddYear'),
  irtAddYear: cut(/^function irtAddYear\(d\)\{.*\}(?:\s*\/\/.*)?$/m, 'irtAddYear'),
};
const PRELUDE = Object.values(SOURCES).join('\n');
const CASES = {
  addTATMonths: [['2026-07-13', 3, '2026-10-13'], ['2026-09-24', 3, '2026-12-24'], ['2026-04-05', 6, '2026-10-05']],
  addMonthsISO: [['2026-07-13', 3, '2026-10-13']],
  addYearsISO: [['2026-10-05', 1, '2027-10-05']],
  swbAddYear: [['2026-10-05', '05/10/2027'], ['2026-04-05', '05/04/2027'], ['2028-02-29', '01/03/2029'], ['2026-12-31', '31/12/2027']],
  irtAddYear: [['2026-10-05', '05/10/2027'], ['2026-04-05', '05/04/2027'], ['2028-02-29', '01/03/2029'], ['2026-12-31', '31/12/2027']],
  // the trap: fmtDate(addYearsISO(...)) formats in LOCAL time, so it is only right at or ahead of UTC
  fmtTrap: [['2026-10-05', '05/10/2027']],
};
const DISPLAY = new Set(['swbAddYear', 'irtAddYear']);
// Runs the real helpers in a fresh process whose clock is in `zone`; returns what they gave plus the zone's own January / July offsets.
function inZone(zone) {
  const code = `${PRELUDE}
const out = { off: [new Date('2026-01-15T00:00:00Z').getTimezoneOffset(), new Date('2026-07-15T00:00:00Z').getTimezoneOffset()], r: {} };
const C = ${JSON.stringify(CASES)};
for (const [k, rows] of Object.entries(C)) out.r[k] = rows.map(row => k === 'fmtTrap' ? fmtDate(addYearsISO(row[0], 1)) : (k === 'swbAddYear' || k === 'irtAddYear') ? eval(k)(row[0]) : eval(k)(row[0], row[1]));
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
  // Release t: ALL four zones, Los Angeles included (the zone where the old helpers were a day early): the same calendar day everywhere, 29 February and the year end included.
  it.each(ZONES)('%s: swbAddYear / irtAddYear (display strings) keep the same calendar day in every zone', zone => { const r = inZone(zone).r; expect(r.swbAddYear).toEqual(EXPECTED.swbAddYear); expect(r.irtAddYear).toEqual(EXPECTED.irtAddYear); });
});

describe('why the helpers use a string formatter and not fmtDate', () => {
  it('fmtDate(addYearsISO(...)) is right at or ahead of UTC but a day early in Los Angeles, so it must not be used for these helpers', () => {
    for (const [zone, , ahead] of [['Australia/Sydney', 0, true], ['UTC', 0, true], ['Pacific/Auckland', 0, true], ['America/Los_Angeles', 0, false]]) {
      const got = inZone(zone).r.fmtTrap[0]; if (ahead) expect(got, zone).toBe('05/10/2027'); else expect(got, zone).toBe('04/10/2027');
    }
  });
  it('the helpers in App.jsx use addYearsISO and backupDmy, not fmtDate or local-time formatting', () => {
    for (const k of ['swbAddYear', 'irtAddYear']) { const code = SOURCES[k].replace(/\s\/\/.*$/, ''); expect(code, k).toContain('backupDmy(addYearsISO(d,1))'); expect(code, k).not.toMatch(/fmtDate|toLocaleDateString|setFullYear\(x\.getFullYear/); }
  });
});

describe('the old bug is what this file would catch', () => {
  it('local setMonth + toISOString (the pre-fix pattern) loses a day in Sydney, so the Sydney cases above are real tests', () => {
    const code = `const x = new Date('2026-07-13'); x.setMonth(x.getMonth() + 3); console.log(x.toISOString().slice(0, 10));`;
    const sydney = execFileSync(process.execPath, ['-e', code], { env: { ...process.env, TZ: 'Australia/Sydney' }, encoding: 'utf8' }).trim();
    expect(sydney).toBe('2026-10-12');
  });
  it('the pre-release-t swbAddYear (local setFullYear + local formatting) is a day early in Los Angeles, so the Los Angeles cases above are real tests', () => {
    const code = `function old(d){const x=new Date(d);x.setFullYear(x.getFullYear()+1);return x.toLocaleDateString("en-AU",{day:"2-digit",month:"2-digit",year:"numeric"});} console.log(old('2026-10-05'));`;
    const la = execFileSync(process.execPath, ['-e', code], { env: { ...process.env, TZ: 'America/Los_Angeles' }, encoding: 'utf8' }).trim();
    expect(la).toBe('04/10/2027');
  });
});

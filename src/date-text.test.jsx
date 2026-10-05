// isoFromDateText(): a date typed or exported as TEXT -> "YYYY-MM-DD", the SAME calendar day in every zone (imports, due-date flags).
// The zone cases run the REAL helper source — cut out of src/App.jsx between its markers — in CHILD node processes started with TZ=<zone>: vitest runs test files in worker threads,
// where assigning process.env.TZ would not change the real zone, and a child process cannot leak anything into the rest of the run (same method as local-date.test.jsx).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseThermoExcel, isoFromDateText } from './App.jsx';

const APP = fs.readFileSync(path.resolve(process.cwd(), 'src/App.jsx'), 'utf8');
const block = name => { const a = `// <${name}>\n`; const i = APP.indexOf(a); if (i < 0) throw new Error('marker ' + name); return APP.slice(i + a.length, APP.indexOf(`\n// </${name}>`, i)); };
const HELPERS = block('localISODate') + '\n' + block('isoFromDateText');
const run = (zone, inputs) => JSON.parse(execFileSync(process.execPath, ['-e', `${HELPERS}\nconsole.log(JSON.stringify(${JSON.stringify(inputs)}.map(isoFromDateText)));`], { env: { ...process.env, TZ: zone }, encoding: 'utf8' }).trim());

const ZONES = ['UTC', 'Australia/Sydney', 'America/Los_Angeles', 'Pacific/Auckland', 'Asia/Kolkata'];
const serial = (y, m, d) => String(Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5));
// [input, expected]
const CASES = [
  // text the engine parses as LOCAL time: the day written, whatever the zone (the old toISOString path gave the day BEFORE in the zones ahead of UTC)
  ['21 Sep 2026', '2026-09-21'], ['Sep 21, 2026', '2026-09-21'], ['2026/09/21', '2026-09-21'], ['21 Sep 2026 00:30', '2026-09-21'], ['21 Sep 2026 23:30', '2026-09-21'],
  ['5 Apr 2026', '2026-04-05'], ['4 Oct 2026', '2026-10-04'], ['1 Nov 2026', '2026-11-01'],                       // clock-change days (Sydney 5 Apr / 4 Oct, Los Angeles 1 Nov)
  // the app's own format, and ISO (the day AS WRITTEN, even with a time or an offset)
  ['21/09/2026', '2026-09-21'], ['1/2/2026', '2026-02-01'], ['2026-09-21', '2026-09-21'], ['2026-09-21T23:30:00Z', '2026-09-21'], ['2026-09-21T00:30:00+10:00', '2026-09-21'],
  // two-digit years: 00-69 -> 20xx, 70-99 -> 19xx
  ['21/9/26', '2026-09-21'], ['1/1/00', '2000-01-01'], ['31/12/69', '2069-12-31'], ['1/1/70', '1970-01-01'], ['31/12/99', '1999-12-31'],
  // a year below 1900 is rejected, never a 0026-style date
  ['21/09/0026', ''], ['1/1/1899', ''], ['1/1/1900', '1900-01-01'], ['0026-09-21', ''], ['21 Sep 1850', ''],
  // Excel serials: only 1990-2100 (32874 .. 73415); whole days, the time of day ignored
  [serial(2026, 9, 21), '2026-09-21'], [serial(2026, 9, 21) + '.75', '2026-09-21'], [serial(2026, 4, 5), '2026-04-05'], [serial(2026, 10, 4), '2026-10-04'],
  ['32873', ''], ['32874', '1990-01-01'], ['73415', '2100-12-31'], ['73416', ''], ['0', ''], ['2026', ''], ['20260921', ''],
  // nothing usable
  ['garbage', ''], ['', ''], ['   ', ''], [null, ''], [undefined, ''],
];

describe.each(ZONES)('isoFromDateText under %s (a child process with TZ set)', zone => {
  it('gives the same calendar day for every kind of input, two-digit years, the 1900 floor and the 1990-2100 serial window', () => {
    const got = run(zone, CASES.map(c => c[0]));
    CASES.forEach((c, i) => expect(got[i], `${zone}: ${JSON.stringify(c[0])}`).toBe(c[1]));
  });
});

describe('the cases above prove something: the old text -> toISOString path was a day out in the zones ahead of UTC', () => {
  it('Sydney / Auckland / Kolkata: new Date("21 Sep 2026").toISOString() is the 20th (the zone really is applied in the child)', () => {
    const old = zone => JSON.parse(execFileSync(process.execPath, ['-e', 'console.log(JSON.stringify(new Date("21 Sep 2026").toISOString().slice(0, 10)))'], { env: { ...process.env, TZ: zone }, encoding: 'utf8' }).trim());
    expect(old('Australia/Sydney')).toBe('2026-09-20'); expect(old('Pacific/Auckland')).toBe('2026-09-20'); expect(old('Asia/Kolkata')).toBe('2026-09-20');
    expect(old('UTC')).toBe('2026-09-21'); expect(old('America/Los_Angeles')).toBe('2026-09-21');
  });
});

describe('in the zone the suite runs in', () => {
  it('the exported helper agrees with the child-process source', () => { CASES.forEach(c => expect(isoFromDateText(c[0]), JSON.stringify(c[0])).toBe(c[1])); });
});

describe('Thermo import: Date and Date Rectified come out as the day written (the real importer, the suite zone)', () => {
  const sheet = rows => ({ SheetNames: ['S'], Sheets: { S: XLSX.utils.aoa_to_sheet(rows) } });
  const HEAD = ['Location', 'Board', 'Circuit', 'Date', 'Pass / Fail', 'Rectified / Scheduled', 'Date Rectified / Scheduled'];
  it('earliest Date across mixed formats; serials and two-digit years work; an unreadable date is ignored', () => {
    const p = parseThermoExcel(sheet([HEAD,
      ['Plant', 'MSB', 'C1', '23 Sep 2026', 'PASS', '', ''],
      ['Plant', 'MSB', 'C2', '21 Sep 2026', 'FAIL', 'Replace lug', '25 Sep 2026'],
      ['Plant', 'MSB', 'C3', 'garbage', 'PASS', '', ''],
    ]), 'Site', XLSX);
    expect(p.testDate).toBe('2026-09-21');                                                                    // the old path gave 2026-09-20 in any zone ahead of UTC
  });
  it('an Excel serial in the Date column is a real date (it used to read as the year 46286)', () => {
    expect(parseThermoExcel(sheet([HEAD, ['Plant', 'MSB', 'C1', serial(2026, 9, 21), 'PASS', '', '']]), 'Site', XLSX).testDate).toBe('2026-09-21');
    expect(parseThermoExcel(sheet([HEAD, ['Plant', 'MSB', 'C1', '21/9/26', 'PASS', '', '']]), 'Site', XLSX).testDate).toBe('2026-09-21');
    expect(parseThermoExcel(sheet([HEAD, ['Plant', 'MSB', 'C1', '21/09/0026', 'PASS', '', '']]), 'Site', XLSX).testDate).toBe('');
  });
});

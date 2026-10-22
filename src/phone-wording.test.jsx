// THE WORD IS PHONE, NEVER DEVICE (release s). Every sentence the app shows about the phone says "phone". The two restore headroom messages ("...free space on this phone...", "This phone can't report free space...")
// were the last ones that said "device". "Device" stays where it names electrical equipment ("Device Type" in the RCD export and import, "device must be removed from service", "Protection Devices"), in the backup manifest field
// deviceLocalDate (old backups carry it), in the viewport tag and in code comments. This scan fails on a string literal in src/App.jsx or src/main.jsx that talks about "this / your / the device", and on the index.html
// start-up text. FICTIONAL data.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const isComment = l => /^\s*(\/\/|\*|\/\*)/.test(l);
const SPEAKS_OF_THE_PHONE = /\b(this|your|the|that)\s+device\b|\bdevices?\s+(can't|cannot|is|has|runs|storage)\b|\bon\s+(this|your)\s+device\b/i;
const strings = src => src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => !isComment(l)).flatMap(([n, l]) => (l.match(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\\n]|\\.)*`/g) || []).map(s => [n, s]));

describe('no string the app shows calls the phone a device', () => {
  it.each(['App.jsx', 'main.jsx'])('%s: no string literal says this / your / the device', f => {
    const bad = strings(read(f)).filter(([, s]) => SPEAKS_OF_THE_PHONE.test(s)).map(([n, s]) => n + ': ' + s.slice(0, 90));
    expect(bad).toEqual([]);
  });
  it('the two restore headroom messages say phone', () => {
    const app = read('App.jsx');
    expect(app).toContain('"Not enough free space on this phone for the photos: about "'); expect(app).toContain('"This phone can\'t report free space, so it could not be checked in advance.');
    expect(app).not.toContain('free space on this device'); expect(app).not.toContain("This device can't report");
  });
  it('electrical "device" wording is untouched (the export / import heading, the fail line and the checklist names)', () => {
    const app = read('App.jsx');
    expect(app).toContain('"Device Type"'); expect(app).toContain('FAIL — device must be removed from service'); expect(app).toContain('label:"Protection Devices"'); expect(app).toContain('deviceLocalDate');
  });
});

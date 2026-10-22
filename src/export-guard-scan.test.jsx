// EXPORT GUARD: THE SOURCE SCAN (release r). The rule in CLAUDE.md and NEW_MODULE_GUIDE.md: every export and every blank-template download runs through runExport(scope, fn) and has an ExportFailureCard with the same
// scope under the control; there is no alert( anywhere; deliverExportFile is called only from an export / template function. A new export that skips the guard fails here.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8');
const LINES = SRC.split('\n');
const MODS = ['rcd', 'iel', 'tat', 'thermo', 'swb', 'elt', 'irt', 'welder', 'gsd'];
const TEMPLATE_MODS = ['rcd', 'iel', 'tat', 'thermo', 'swb', 'elt', 'irt', 'welder'];      // GSD has no import, so no template
const isComment = l => /^\s*(\/\/|\*|\/\*)/.test(l);
const count = (re) => (SRC.match(re) || []).length;

describe('no browser dialog and no unwrapped export', () => {
  it('App.jsx contains no alert( call outside a comment', () => {
    const hits = LINES.map((l, i) => [i + 1, l]).filter(([, l]) => !isComment(l) && /\balert\(/.test(l.replace(/\/\/.*$/, ''))).map(([n, l]) => n + ': ' + l.trim().slice(0, 80));
    expect(hits).toEqual([]);
  });
  it('every call of an exportXExcel function (not its definition, not the export list) is inside runExport(', () => {
    const bad = LINES.map((l, i) => [i + 1, l]).filter(([, l]) => !isComment(l) && /\bexport\w*Excel\(/.test(l) && !/^\s*(async\s+)?function\s/.test(l)).filter(([, l]) => !/runExport\(/.test(l)).map(([n, l]) => n + ': ' + l.trim().slice(0, 100));
    expect(bad).toEqual([]);
  });
  it('there are calls to scan: 9 modules, snapshot handlers and the dead Home handlers', () => {
    expect(count(/runExport\(exportSnapScope\(/g)).toBe(9);
    expect(count(/runExport\("[a-z]+:home/g)).toBeGreaterThanOrEqual(8);
  });
  it('a download...Template function is only ever used inside runExport( (never as a bare onClick or a direct call)', () => {
    const uses = LINES.map((l, i) => [i + 1, l]).filter(([, l]) => !isComment(l) && /\bdownload[A-Za-z]*Template\b/.test(l) && !/^\s*(async\s+)?function\s/.test(l) && !/^export\s*\{|^\s*(parseSWBExcel|exportSWBExcel|parse)/.test(l) && !/^\s+[A-Za-z, ]*download[A-Za-z]*Template,/.test(l));
    const bad = uses.filter(([, l]) => !/runExport\(/.test(l)).map(([n, l]) => n + ': ' + l.trim().slice(0, 100));
    expect(bad).toEqual([]);
    expect(uses.length).toBeGreaterThanOrEqual(8);
  });
  it('deliverExportFile( is called only from inside an export... or download... function', () => {
    const bad = [];
    LINES.forEach((l, i) => {
      if (isComment(l) || !/\bdeliverExportFile\(/.test(l) || /^\s*function\s+deliverExportFile/.test(l)) return;
      let j = i; while (j >= 0 && !/^(async\s+)?function\s+\w+/.test(LINES[j])) j--;
      const name = j >= 0 ? /^(?:async\s+)?function\s+(\w+)/.exec(LINES[j])[1] : '(top level)';
      if (!/^(export\w*Excel|download\w*Template)$/.test(name)) bad.push((i + 1) + ': inside ' + name);
    });
    expect(bad).toEqual([]);
  });
});

describe('every control has its card', () => {
  it.each(MODS)('%s: the snapshot handler, the History list card and (but RCD) the snapshot page card all use the same module key', mod => {
    const handler = count(new RegExp('runExport\\(exportSnapScope\\(\\s*"' + mod + '"\\s*,\\s*snap\\s*\\)', 'g'));
    const cards = count(new RegExp('ExportFailureCard\\s*,\\s*\\{\\s*scope:\\s*exportSnapScope\\(\\s*"' + mod + '"\\s*,\\s*snap\\s*\\)', 'g'));
    expect(handler, mod + ' handler').toBe(1);
    expect(cards, mod + ' cards (list' + (mod === 'rcd' ? '' : ' + snapshot page') + ')').toBe(mod === 'rcd' ? 1 : 2);
  });
  it.each(TEMPLATE_MODS)('%s: the template button runs through the guard and has a card with the same scope', mod => {
    expect(count(new RegExp('runExport\\(\\s*"' + mod + ':template"', 'g')), mod + ' template button').toBe(1);
    expect(count(new RegExp('ExportFailureCard\\s*,\\s*\\{\\s*scope:\\s*"' + mod + ':template"', 'g')), mod + ' template card').toBe(1);
  });
  it('the card opens in place, so it reveals itself clear of the pill (release q rule)', () => {
    const fn = /function ExportFailureCard\([\s\S]*?\n}\n/.exec(SRC)[0];
    expect(fn).toMatch(/useRevealOnOpen\(boxRef, !!failure\)/); expect(fn).toMatch(/GS_MSG_MARGIN/); expect(fn.indexOf('useRevealOnOpen')).toBeLessThan(fn.indexOf('if (!failure) return null'));
  });
  it('runExport never rethrows and logs only a code, the module key and the error name', () => {
    const fn = /async function runExport\([\s\S]*?\n}\n/.exec(SRC)[0];
    expect(fn).toMatch(/catch \(e\)/); expect(fn).not.toMatch(/\bthrow\b/);
    const log = /function exportLog\([^\n]*\n/.exec(SRC)[0]; expect(log).toMatch(/console\.warn\("\[SparkCheck export\]", code, String\(scope\)\.split\(":"\)\[0\], exportErrName\(e\)\)/); expect(log).not.toMatch(/\.message|\.stack/);
  });
});

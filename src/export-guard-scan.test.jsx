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
  it('there are calls to scan: one snapshot handler in each of the 9 modules', () => {
    expect(count(/runExport\(exportSnapScope\(/g)).toBe(9);
  });
  it('no Home export call remains (release s removed the dead ones): no runExport scope with :home, no onExport / onExportPush / onExportInject prop anywhere', () => {
    expect(count(/runExport\(\s*"[a-z]+:home/g)).toBe(0);
    const bad = LINES.map((l, i) => [i + 1, l]).filter(([, l]) => !isComment(l) && /\bonExport(Push|Inject)?\b/.test(l)).map(([n, l]) => n + ': ' + l.trim().slice(0, 100));
    expect(bad).toEqual([]);
  });
  it('a download...Template function is only ever used inside runExport( (never as a bare onClick or a direct call)', () => {
    const uses = LINES.map((l, i) => [i + 1, l]).filter(([, l]) => !isComment(l) && /\bdownload[A-Za-z]*Template\b/.test(l) && !/^\s*(async\s+)?function\s/.test(l) && !/^export\s*\{|^\s*(parseSWBExcel|exportSWBExcel|parse)/.test(l) && !/^\s+[A-Za-z, ]*download[A-Za-z]*Template,/.test(l));
    const bad = uses.filter(([, l]) => !/runExport\(/.test(l)).map(([n, l]) => n + ': ' + l.trim().slice(0, 100));
    expect(bad).toEqual([]);
    expect(uses.length).toBeGreaterThanOrEqual(8);
  });
  // Release t (F2): the only callers of deliverExportFile are the export / template functions (their sinks) AND exportHandOver, the one hand-over that runExport's per-scope handler reaches: it calls deliverExportFile for the
  // native bridge, a desktop, jsdom and any computer without a share sheet (the one-tap download). A call from a button, a screen or any other function still fails; the synthetic cases below prove it.
  const ALLOWED_CALLER = /^(export\w*Excel|download\w*Template|exportHandOver)$/;
  const badCallers = lines => {
    const bad = [];
    lines.forEach((l, i) => {
      if (isComment(l) || !/\bdeliverExportFile\(/.test(l) || /^\s*function\s+deliverExportFile/.test(l)) return;
      let j = i; while (j >= 0 && !/^(async\s+)?function\s+\w+/.test(lines[j])) j--;
      const name = j >= 0 ? /^(?:async\s+)?function\s+(\w+)/.exec(lines[j])[1] : '(top level)';
      if (!ALLOWED_CALLER.test(name)) bad.push((i + 1) + ': inside ' + name);
    });
    return bad;
  };
  it('deliverExportFile( is called only from inside an export... or download... function, or from the hand-over (exportHandOver)', () => {
    expect(badCallers(LINES)).toEqual([]);
  });
  it('the scan is not blind: a call from a button, a screen, a hook or another function is reported', () => {
    expect(badCallers(['function SettingsScreen() {', '  return <button onClick={() => deliverExportFile(b, "x.xlsx")} />;', '}'])).toEqual(['2: inside SettingsScreen']);
    expect(badCallers(['async function exportIELExcel(a) {', '  deliverExportFile(b, "x.xlsx");', '}', 'function helper() {', '  deliverExportFile(b, "y.xlsx");', '}'])).toEqual(['5: inside helper']);
    expect(badCallers(['const x = () => deliverExportFile(b, "x.xlsx");'])).toEqual(['1: inside (top level)']);
    expect(badCallers(['function exportHandOverLater() {', '  deliverExportFile(b, "x.xlsx");', '}'])).toEqual(['2: inside exportHandOverLater']);
    expect(badCallers(['function exportHandOver(scope, file, done) {', '  deliverExportFile(file.base64, file.filename, file.mimeType);', '}'])).toEqual([]);
  });
});

// Release s: EVERY live export control (History list, snapshot page header, blank template) is an ExportBtn, which says "Making…" while its scope runs. Each one calls runExport (a template directly, a snapshot button through
// the module's onExportSnap, which is wired to runExport(exportSnapScope(...))) and has an ExportFailureCard with the SAME scope. 17 snapshot buttons (RCD has no header button) + 8 template buttons = 25.
describe('every live export control is an ExportBtn that reaches runExport and has its card', () => {
  const BTN = /(?:React\.createElement|eltEl|gsdEl)\(ExportBtn,/g;
  it('there are exactly 25 ExportBtn controls: 17 snapshot (History list and snapshot page) and 8 template', () => {
    expect(count(BTN)).toBe(25); expect(count(/ExportBtn,\s*\{\s*scope:\s*exportSnapScope\(/g)).toBe(17); expect(count(/ExportBtn,\s*\{\s*scope:\s*"[a-z]+:template",\s*template:\s*true,/g)).toBe(8);
  });
  it('no export button is built bare: no onClick that calls onExportSnap( or runExport( directly (it must go through ExportBtn run:)', () => {
    expect(count(/onClick:\s*\(\)\s*=>\s*(onExportSnap|runExport)\b/g)).toBe(0); expect(count(/run:\s*\(\)\s*=>\s*onExportSnap\(snap\)/g)).toBe(17); expect(count(/run:\s*\(\)\s*=>\s*runExport\("[a-z]+:template"/g)).toBe(8);
  });
  it.each(MODS)('%s: every snapshot ExportBtn has an ExportFailureCard with the same module key (list' + ' + snapshot page, but RCD has no page button)', mod => {
    const btns = count(new RegExp('ExportBtn,\\s*\\{\\s*scope:\\s*exportSnapScope\\(\\s*"' + mod + '"\\s*,\\s*snap\\s*\\)', 'g'));
    const cards = count(new RegExp('ExportFailureCard\\s*,\\s*\\{\\s*scope:\\s*exportSnapScope\\(\\s*"' + mod + '"\\s*,\\s*snap\\s*\\)', 'g'));
    expect(btns, mod + ' buttons').toBe(mod === 'rcd' ? 1 : 2); expect(cards, mod + ' cards').toBe(btns);
  });
  it.each(TEMPLATE_MODS)('%s: the template ExportBtn calls runExport with its own scope and has a card with that scope', mod => {
    const re = new RegExp('ExportBtn,\\s*\\{\\s*scope:\\s*"' + mod + ':template",\\s*template:\\s*true,\\s*style:\\s*\\{[^{}]*\\},\\s*run:\\s*\\(\\)\\s*=>\\s*runExport\\("' + mod + ':template"', 'g');
    expect(count(re), mod + ' template button').toBe(1); expect(count(new RegExp('ExportFailureCard\\s*,\\s*\\{\\s*scope:\\s*"' + mod + ':template"', 'g')), mod + ' template card').toBe(1);
  });
  it('the busy state is wired to the run: runExport tells the buttons when a run starts, ends and is released after 60 s', () => {
    const fn = /async function runExport\([\s\S]*?\n}\n/.exec(SRC)[0];
    expect((fn.match(/exportEmit\(\)/g) || []).length).toBeGreaterThanOrEqual(4);              // start, the release timer, finish, failure
    expect(fn).toMatch(/exportRunning\.delete\(scope\); exportEmit\(\); \} \}, EXPORT_RUN_RELEASE_MS/); expect(fn).toMatch(/finally \{ clearTimeout\(timer\); if \(exportRunning\.get\(scope\) === timer\) \{ exportRunning\.delete\(scope\); exportEmit\(\); \} \}/);
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

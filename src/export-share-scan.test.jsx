// THE SHARE HAND-OVER: THE SOURCE SCAN (release t). The rules, pinned in src/App.jsx: (1) every export / template function takes an optional trailing handOver and ends with the handler when given, then deliverExportFile;
// (2) runExport makes the handler for its OWN scope, nothing is shared between scopes; (3) the native bridge lines are verbatim and run first; (4) navigator.share gets { files } and nothing else, in the tap, with no wait;
// (5) the done step (the photo-migration proof) runs only after a real hand-over; (6) the History and snapshot-page Export buttons are 44 px high and the Share file button / Discard link too; (7) the export blob URL is revoked
// after 120 s; (8) the held file is never stored. A new export that bypasses the hand-over, or a change that weakens one of these, fails here.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8');
const bodyOf = (re, label) => { const i = SRC.search(re); expect(i, label + ' is found').toBeGreaterThanOrEqual(0); const end = SRC.indexOf('\n}\n', i); return SRC.slice(i, end + 2); };
const EXPORT_FNS = ['exportExcel', 'downloadTemplate', 'exportIELExcel', 'downloadIELTemplate', 'exportTATExcel', 'downloadTATTemplate', 'exportThermoExcel', 'downloadThermoTemplate', 'exportSWBExcel', 'downloadSWBTemplate', 'exportELTExcel', 'downloadELTTemplate', 'exportIRTExcel', 'downloadIRTTemplate', 'exportWelderExcel', 'downloadWelderTemplate', 'exportGSDExcel'];
const fnBody = n => bodyOf(new RegExp('^(async )?function ' + n + '\\(', 'm'), n);
const HANDLER = 'if (typeof handOver === "function") return handOver(';

describe('(1) every export and template function ends with the handler, then deliverExportFile', () => {
  it('there are 17 of them', () => { expect(EXPORT_FNS).toHaveLength(17); });
  it.each(EXPORT_FNS)('%s: the last parameter is handOver; the sink hands the file to it when given, otherwise deliverExportFile with the SAME arguments', n => {
    const head = new RegExp('^(async )?function ' + n + '\\(([^)]*)\\)', 'm').exec(SRC); expect(head, n + ' declaration').not.toBeNull(); const params = head[2].split(',').map(s => s.trim()); expect(params[params.length - 1]).toBe('handOver');
    const body = fnBody(n); expect((body.match(/typeof handOver === "function"/g) || []).length, 'one handler line').toBe(1);
    const lines = body.split('\n'); const hi = lines.findIndex(l => l.includes(HANDLER)); const di = lines.findIndex(l => /^\s*deliverExportFile\(/.test(l)); expect(hi, 'handler line').toBeGreaterThan(-1); expect(di, 'deliverExportFile line').toBe(hi + 1);
    const hArgs = /handOver\((.*?)(, verified)?\);\s*$/.exec(lines[hi])[1], dArgs = /deliverExportFile\((.*)\);\s*$/.exec(lines[di])[1]; expect(hArgs).toBe(dArgs);
    expect((body.match(/deliverExportFile\(/g) || []).length, 'one deliverExportFile call').toBe(1);
  });
  it('deliverExportFile( is called from the 17 sinks and from exportHandOver (the bridge, desktop and jsdom branch) and from nowhere else', () => {
    const callers = []; const L = SRC.split('\n');
    L.forEach((l, i) => { if (/^\s*(\/\/|\*)/.test(l) || !/\bdeliverExportFile\(/.test(l) || /^function deliverExportFile/.test(l)) return; let j = i; while (j >= 0 && !/^(async\s+)?function\s+\w+/.test(L[j])) j--; callers.push(/^(?:async\s+)?function\s+(\w+)/.exec(L[j])[1]); });
    expect(callers.filter(c => c !== 'exportHandOver').sort()).toEqual([...EXPORT_FNS].sort()); expect(callers.filter(c => c === 'exportHandOver')).toHaveLength(1);
  });
});

describe('(2) runExport makes the handler for its own scope; nothing is shared between scopes', () => {
  const run = () => bodyOf(/^async function runExport\(/m, 'runExport');
  it('fn gets a handler built from THIS call\'s scope, and that handler is the only way into exportHandOver', () => {
    expect(run()).toMatch(/await fn\(\(base64, filename, done\) => exportHandOver\(scope, \{ base64, filename, mimeType: XLSX_MIME \}, done\)\)/);
    expect((SRC.match(/exportHandOver\(/g) || []).length, 'the definition and the one call in runExport').toBe(2);
  });
  it('there is no module-level current-run / current-scope / shared handler variable', () => {
    expect(SRC).not.toMatch(/^(let|var|const)\s+(handOver|currentScope|currentRun|activeScope|activeRun|activeExport|currentExport)\b/m);
    expect(SRC).not.toMatch(/^\s*(handOver|currentScope|currentRun|activeScope|activeExport)\s*=[^=>]/m);
  });
  it('the per-scope state is in maps and sets keyed by the scope', () => { expect(SRC).toMatch(/const exportFailures = new Map\(\), exportRunning = new Map\(\), exportListeners = new Set\(\);/); expect(SRC).toMatch(/const exportSharing = new Set\(\);/); expect(SRC).toMatch(/const exportVisit = new Map\(\);/); });
  it('the existing guard lines are untouched: the 60 s release and the finally line', () => {
    expect(run()).toMatch(/exportRunning\.delete\(scope\); exportEmit\(\); \} \}, EXPORT_RUN_RELEASE_MS/); expect(run()).toMatch(/finally \{ clearTimeout\(timer\); if \(exportRunning\.get\(scope\) === timer\) \{ exportRunning\.delete\(scope\); exportEmit\(\); \} \}/);
  });
});

describe('(3) the native bridge lines are verbatim and run first', () => {
  const del = () => bodyOf(/^function deliverExportFile\(/m, 'deliverExportFile');
  it('deliverExportFile starts with the three bridge lines, exactly as in release s, before anything is built', () => {
    const b = del(); const bridge = '    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.shareFile) {\n      window.webkit.messageHandlers.shareFile.postMessage({ base64, filename, mimeType });\n      return;\n    }\n';
    expect(b).toContain(bridge); expect(b.indexOf(bridge)).toBeLessThan(b.indexOf('base64ToBlob(')); expect(b.indexOf(bridge)).toBeLessThan(b.indexOf('exportDownloadBlob('));
  });
  it('exportHandOver\'s first statement checks the bridge; exportShareWanted returns false for the bridge before anything else', () => {
    expect(bodyOf(/^function exportHandOver\(/m, 'exportHandOver')).toMatch(/^function exportHandOver\(scope, file, done\) \{\n  if \(exportBridgePresent\(\) \|\| !exportShareWanted\(\)\) \{ deliverExportFile\(/);
    expect(bodyOf(/^function exportShareWanted\(/m, 'exportShareWanted')).toMatch(/try \{\n    if \(bridge\) return false;/);
  });
});

describe('(4) navigator.share gets the file only, inside the tap, with no wait', () => {
  const st = () => bodyOf(/^function exportShareStart\(/m, 'exportShareStart');
  it('every share call in the app passes { files: [...] } and nothing else; exportShareStart has exactly one and no title, text or url', () => {
    const calls = SRC.match(/\b(navigator|nav)\.share\([^\n]*/g) || []; expect(calls.length).toBeGreaterThanOrEqual(2); calls.forEach(c => expect(c, c).toMatch(/\.share\(\{ files: \[/));
    expect((st().match(/navigator\.share\(/g) || []).length).toBe(1); expect(st()).toContain('navigator.share({ files: [new File([entry.blob], entry.filename, { type: entry.mimeType })] })'); expect(st()).not.toMatch(/\b(title|text|url)\s*:/);
  });
  it('exportShareStart and exportHandOver are plain functions with no await and no .then before the share call', () => {
    expect(SRC).not.toMatch(/async function (exportShareStart|exportHandOver|exportShareWanted)\(/);
    const s = st(); expect(s.slice(0, s.indexOf('navigator.share(')).match(/\bawait\b|\.then\(/)).toBeNull();
    const h = bodyOf(/^function exportHandOver\(/m, 'exportHandOver'); expect(h.split('\n').map(l => l.replace(/\s\/\/.*$/, '')).join('\n')).not.toMatch(/\bawait\b|\.then\(/); expect(h.indexOf('exportShareStart(scope, entry)')).toBeGreaterThan(-1);
  });
  it('the share call comes BEFORE the state is touched (the tap\'s first action), and the second tap is ignored by the sharing guard', () => {
    const s = st(); expect(s.indexOf('navigator.share(')).toBeLessThan(s.indexOf('exportSharing.add(scope)')); expect(s.indexOf('navigator.share(')).toBeLessThan(s.indexOf('exportFailures.set(scope, shown)')); expect(s.startsWith('function exportShareStart(scope, entry) {\n  if (exportSharing.has(scope)) return;')).toBe(true);
    expect(SRC).toMatch(/const exportShareReady = scope => \{ const e = exportFailures\.get\(scope\); if \(e && e\.kind === "ready" && !e\.sharing\) exportShareStart\(scope, e\); \};/);
  });
  it('the runExport handler for a template reaches the share call in the same tick: no await sits between the tap and the handler', () => {
    const r = bodyOf(/^async function runExport\(/m, 'runExport'); expect(r.slice(r.indexOf('try {'), r.indexOf('exportHandOver(scope')).match(/\bawait\s+(?!fn\()/)).toBeNull();
  });
});

describe('(5) the done step runs only after a real hand-over', () => {
  it('exportHandOver: done runs right after deliverExportFile returned (the bridge posted or the download started), never on the share branch itself', () => {
    const h = bodyOf(/^function exportHandOver\(/m, 'exportHandOver'); expect(h).toContain('deliverExportFile(file.base64, file.filename, file.mimeType); if (done) done(); return;'); expect((h.replace(/\s\/\/.*$/gm, '').match(/\bdone\b/g) || []).length).toBe(4);      // the parameter, the test, the call, the entry
    expect(h).toMatch(/template: \/:template\$\/\.test\(scope\), done \}/);
  });
  it('exportShareStart: finish() (the done step) is called when the share resolved and after the fallback download started, and NOT on a closed sheet or a failed download', () => {
    const s = bodyOf(/^function exportShareStart\(/m, 'exportShareStart'); expect((s.match(/\bfinish\(\)/g) || []).length).toBe(2);
    expect(s).toMatch(/Promise\.resolve\(p\)\.then\(\(\) => \{\n    exportSharing\.delete\(scope\); finish\(\);/); expect(s).toMatch(/try \{ exportDownloadBlob\(entry\.blob, entry\.filename\); finish\(\);/);
    const abort = s.slice(s.indexOf('err.name === "AbortError"'), s.indexOf('exportLog(err &&')); expect(abort).not.toMatch(/finish|done/);
    const failed = s.slice(s.indexOf('catch (e2)'), s.indexOf('catch (e2)') + 160); expect(failed).not.toMatch(/finish|done/);
    expect(s).toMatch(/const finish = \(\) => \{ if \(entry\.done\) \{ try \{ entry\.done\(\); \} catch \(_\) \{\} \} \};/);
  });
  it('confirmPhotoMigrationVerified is called only inside the three exports\' own verified step, never by the hand-over, the card or runExport', () => {
    for (const [n, m] of [['exportSWBExcel', 'swb'], ['exportELTExcel', 'elt'], ['exportWelderExcel', 'welder']]) {
      const b = fnBody(n); expect(b, n).toContain('const verified = () => { if (anyPhotoEmbedded) confirmPhotoMigrationVerified("' + m + '"); };'); expect((b.match(/confirmPhotoMigrationVerified\(/g) || []).length, n).toBe(1);
      expect(b, n).toMatch(/return handOver\(.*, verified\);\n\s*deliverExportFile\(.*\);\n\s*verified\(\);\n\}/);
    }
    ['exportHandOver', 'exportShareStart', 'exportShareReady'].forEach(f => { const i = SRC.search(new RegExp('(function|const) ' + f + '\\b')); expect(SRC.slice(i, i + 3000).split('\nfunction ')[0]).not.toMatch(/confirmPhotoMigrationVerified/); });
    expect(bodyOf(/^async function runExport\(/m, 'runExport')).not.toMatch(/confirmPhotoMigrationVerified/); expect(bodyOf(/^function ExportReadyCard\(/m, 'ExportReadyCard')).not.toMatch(/confirmPhotoMigrationVerified/);
  });
});

describe('(6) the buttons are 44 px', () => {
  it('ExportBtn gives every non-template button a minimum height of 44 and leaves the 8 template buttons as they are', () => {
    const b = bodyOf(/^function ExportBtn\(/m, 'ExportBtn'); expect(b).toContain('style: template ? style : { ...style, minHeight: 44 }');
  });
  it('no snapshot ExportBtn sets a smaller minimum or a fixed height of its own', () => {
    const re = /ExportBtn,\s*\{\s*scope:\s*exportSnapScope\([^)]*\),\s*style:\s*\{[^}]*\}/g; const all = SRC.match(re) || []; expect(all).toHaveLength(17);
    all.forEach(s => { expect(s).not.toMatch(/\bheight\s*:/); (s.match(/minHeight\s*:\s*(\d+)/g) || []).forEach(m => expect(+/\d+/.exec(m)[0]).toBeGreaterThanOrEqual(44)); });
  });
  it('Share file is the shared bsBtn and Discard this file the shared bsLink (both minHeight 44)', () => {
    expect(SRC).toMatch(/const bsBtn = [^\n]*\n\s*const base = \{ minHeight: 44,/); expect(SRC).toMatch(/const bsLink = [^\n]*minHeight: 44,/);
    const c = bodyOf(/^function ExportReadyCard\(/m, 'ExportReadyCard'); expect(c).toContain('bsBtn("Share file", () => exportShareReady(scope), { id: "export-share", icon: "share", flex: true })'); expect(c).toContain('bsLink("Discard this file", () => exportDiscard(scope), "export-discard", false, { width: "auto", flex: "0 0 auto", padding: "0 10px" })');
  });
});

describe('(9) the compact card, the lean copy and the marker leave the hand-over alone', () => {
  it('the ready card shortens the name through one helper, shows the title, name, line and buttons in one box, and has no second card for the cancelled state', () => {
    const c = bodyOf(/^function ExportReadyCard\(/m, 'ExportReadyCard'); expect(c).toContain('exportShortName(entry.filename)'); expect(c).toContain('"data-testid": "export-ready"'); expect((c.match(/"data-testid": "export-ready"/g) || []).length).toBe(1); expect(c).not.toContain('React.Fragment');
  });
  it('runExport keeps its original lines inside the marker\'s outer try, and the hand-over block still comes after it and holds no storage call', () => {
    const r = SRC.slice(SRC.indexOf('async function runExport(scope, fn) {'), SRC.indexOf('// ── EXPORT HAND-OVER (release t)')); expect(r).toContain('exportHandOver(scope, { base64, filename, mimeType: XLSX_MIME }, done)'); expect(r).toContain('} finally { markEnd(); }');
    const a = SRC.indexOf('// ── EXPORT HAND-OVER (release t)'), z = SRC.indexOf('// The export button (release s)'); expect(SRC.slice(a, z)).not.toMatch(/exportMark|photoCopy/);
  });
});

describe('(7) the export download and (8) the held file', () => {
  it('the blob URL is revoked after 120 s (EXPORT_URL_REVOKE_MS), not 30 s', () => {
    expect(SRC).toMatch(/^const EXPORT_URL_REVOKE_MS = 120000;/m); const b = bodyOf(/^function exportDownloadBlob\(/m, 'exportDownloadBlob'); expect(b).toContain('}, EXPORT_URL_REVOKE_MS);'); expect(b).not.toMatch(/30000/);
  });
  it('the hand-over code never touches a storage (the held file is memory only)', () => {
    const a = SRC.indexOf('// ── EXPORT HAND-OVER (release t)'), z = SRC.indexOf('// The export button (release s)'); expect(a).toBeGreaterThan(-1); expect(z).toBeGreaterThan(a);
    const block = SRC.slice(a, z); expect(block).not.toMatch(/localStorage|sessionStorage|indexedDB|\.setItem\(|save\(/);
    const card = bodyOf(/^function ExportFailureCard\(/m, 'ExportFailureCard'); expect(card).not.toMatch(/localStorage|sessionStorage|indexedDB|setItem/);
  });
  it('the ready file and the notes render inside ExportFailureCard\'s box: the reveal hook comes before the early return, and leaving the screen bumps the visit counter and drops the entry', () => {
    const f = bodyOf(/^function ExportFailureCard\(/m, 'ExportFailureCard'); expect(f.indexOf('useRevealOnOpen(boxRef, !!failure)')).toBeLessThan(f.indexOf('if (!failure) return null')); expect(f).toContain('exportVisit.set(scope, (exportVisit.get(scope) || 0) + 1); if (exportFailures.delete(scope)) exportEmit();'); expect(f).toContain('React.createElement(ExportReadyCard, { scope, entry: failure })'); expect(f).toContain('GS_MSG_MARGIN');
  });
  it('the wording of the cards is the design\'s', () => {
    const c = bodyOf(/^function ExportReadyCard\(/m, 'ExportReadyCard');
    ['"Excel file shared"', '"If you chose Save to Files, it is in the folder you picked."', '"Template download started"', '"Excel file download started"', 'This phone could not open the share sheet, so the ', ' was downloaded. Find it in the Files app.', '"The share sheet was closed, so the template was not saved."', '"Tap Download Import Template to try again."',
      '"The share sheet was closed, so the file was not saved."', '"Still ready. Tap Share file to try again."', '"Excel file ready"', '"Not saved yet."', '" Tap Share file."'].forEach(w => expect(c, w).toContain(w));
    ['Your file is still ready', 'then choose', 'or another location'].forEach(w => expect(c, 'the old long wording is gone: ' + w).not.toContain(w));       // release t, design D2: the compact card has one short line
    expect(c).not.toMatch(/\bdevice\b/i);
  });
});

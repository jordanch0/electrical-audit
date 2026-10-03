// APP colours that must agree with the export colour standard (2026-10-02): TAT's Pass is green like every other module (it was a one-off blue), and Priority
// URGENT is visibly distinct from HIGH (solid dark maroon + white text, as in the exports) instead of sharing H's pale red.
import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { PRIORITY_BG, PRIORITY_FG, PRIORITY_COLORS, SWB_RISK_COLORS, TAT_SM, SM, XJ_COLOURS, RESULT_COLORS, RESULT_BG } from './App.jsx';
import fs from 'fs';
import path from 'path';

const lum = h => { const c = [0, 2, 4].map(i => parseInt(h.replace('#', '').substr(i, 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

describe('TAT Pass is green like every other module', () => {
  it('TAT_SM.pass equals the shared SM pass (no blue)', () => {
    expect(TAT_SM.pass).toEqual({ ...SM.pass, label: 'PASS' });
    expect(JSON.stringify(TAT_SM.pass)).not.toMatch(/1d4ed8|dbeafe/i);
  });
});

describe('Priority URGENT is visibly distinct from HIGH in the app', () => {
  it('U has its own solid fill (the same maroon as the exports) with white text; H keeps the pale red', () => {
    expect(PRIORITY_BG.U.toLowerCase()).toBe('#9b0000'); expect(PRIORITY_BG.U.toLowerCase()).not.toBe(PRIORITY_BG.H.toLowerCase());
    expect(PRIORITY_FG.U.toLowerCase()).toBe('#ffffff'); expect('FF' + PRIORITY_BG.U.slice(1).toUpperCase()).toBe(XJ_COLOURS.priority.U.bg);
    ['L', 'M', 'H', 'U'].forEach(L => expect(ratio(PRIORITY_FG[L], PRIORITY_BG[L]), L).toBeGreaterThanOrEqual(4.5));
    expect(ratio(PRIORITY_FG.U, PRIORITY_BG.U)).toBeGreaterThanOrEqual(7);
  });
  it('the SWB risk letter uses the same U colour as PRIORITY_COLORS (it was a one-off #c0392b)', () => {
    expect(SWB_RISK_COLORS.U).toBe(PRIORITY_COLORS.U); expect(SWB_RISK_COLORS).toEqual(PRIORITY_COLORS);
  });
  it('real UI: in the IEL item page, the selected Urgent button is the solid maroon with white text and the selected High button is the pale red', async () => {
    cleanup(); localStorage.clear();
    const project = { id: 'p1', name: 'Example Quarry', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'e1', name: 'estops', circuits: ['x'], machineNames: { x: 'Conv 1' } }] }] };
    localStorage.setItem('iel-projects-v2', JSON.stringify([project])); localStorage.setItem('iel-results-v2', JSON.stringify({ p1: { a: { estops: { x: { status: 'fail', lastTested: '2026-07-13' } } } } }));
    localStorage.setItem('iel-meta-v2', JSON.stringify({ p1: { auditor: 'Jane Auditor', testDate: '2026-07-13', notes: '' } }));
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText('IEL TESTING'));
    await user.click(await screen.findByText('Example Quarry', { selector: 'div' })); await screen.findByText('NEXT TEST DUE'); await user.click(screen.getAllByText('E-Stops')[0]);
    await user.click(await screen.findByText('Plant')); await user.click(await screen.findByText('E-Stops')); await user.click(await screen.findByText('Conv 1'));
    const pri = txt => screen.getAllByRole('button').find(b => b.textContent.trim().startsWith(txt));
    await user.click(pri('U')); const u = pri('U'); expect(u).toHaveStyle({ background: 'rgb(155, 0, 0)', color: 'rgb(255, 255, 255)' });
    await user.click(pri('H')); const h = pri('H'); expect(h).toHaveStyle({ background: 'rgb(254, 226, 226)', color: 'rgb(185, 28, 28)' });
  });
});

// Every status / priority text in the APP is >= 4.5:1 (2026-10-02): same hues as before, darker green / red text (#166534 / #b91c1c), a slightly darker "untested" grey.
describe('app status colours are all readable (>= 4.5:1), and the old low-contrast text colours are gone', () => {
  const src = fs.readFileSync(path.resolve(__dirname, 'App.jsx'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const PAGE = '#e8e6e2', SURFACE = '#f7f6f3', WHITE = '#ffffff';
  it('every { bg, fg } status pair in App.jsx (SM, IEL_SM, TAT_SM, SWB_SM, IRT_SM, ...) is >= 4.5:1', () => {
    const pairs = [...src.matchAll(/bg: ?"(#[0-9a-fA-F]{6})", ?fg: ?"(#[0-9a-fA-F]{6})"/g)].map(m => [m[2], m[1]]);
    expect(pairs.length).toBeGreaterThan(15); pairs.forEach(([fg, bg]) => expect(ratio(fg, bg), fg + ' on ' + bg).toBeGreaterThanOrEqual(4.5));
  });
  it('result (Thermo) and priority colours are >= 4.5:1 on their tint AND on white / the surface / the page background', () => {
    ['PASS', 'FAIL', 'MONITOR'].forEach(k => expect(ratio(RESULT_COLORS[k], RESULT_BG[k]), k).toBeGreaterThanOrEqual(4.5));
    [WHITE, SURFACE, PAGE].forEach(bg => { [...Object.values(RESULT_COLORS).slice(0, 3), PRIORITY_COLORS.L, PRIORITY_COLORS.M, PRIORITY_COLORS.H, PRIORITY_COLORS.U, SWB_RISK_COLORS.L, SWB_RISK_COLORS.H].forEach(fg => expect(ratio(fg, bg), fg + ' on ' + bg).toBeGreaterThanOrEqual(4.5)); });
  });
  // The old guard here had a stray backspace character in its regex (a mangled \b), so it matched nothing and 80 stray uses got through (2026-10-03). The scanner below is
  // exercised on known-bad samples first, so the guard itself can't silently stop working again.
  const textUses = (code, hexes) => [...code.matchAll(new RegExp('(\\b(?:color|fg)\\s*:\\s*[^,}\\n]*?)["\'`]#(' + hexes.join('|') + ')["\'`]', 'gi'))].map(m => m[0]);
  it('the guard scanner itself works: it flags text-colour uses (plain and ternary) and ignores borders / backgrounds', () => {
    const OLD = ['16a34a', 'dc2626'];
    expect(textUses('{color:"#16a34a"}', OLD)).toHaveLength(1);
    expect(textUses("{ fontSize: 11, color: '#DC2626' }", OLD)).toHaveLength(1);
    expect(textUses('{color: pri==="H"?"#dc2626":"#52525b"}', OLD)).toHaveLength(1);
    expect(textUses('{fg:"#16a34a"}', OLD)).toHaveLength(1);
    expect(textUses('{borderColor:"#16a34a",background:"#dc2626",border:"1px solid #dc2626"}', OLD)).toHaveLength(0);
  });
  it('no text colour uses the old #16a34a / #dc2626 (they were ~3-4:1); a fill / border / icon may still use them', () => {
    expect(textUses(src, ['16a34a', 'dc2626'])).toEqual([]);
    // text colours chosen through a variable / function (priority, due-date urgency) must not use them either (nor priority L's old yellow)
    const vars = [...src.matchAll(/(const priColor\s*=[^;\n]*|const PC\s*=\s*\{[^}]*\}|function urgencyColor\([^)]*\)\s*\{[^}]*\})/g)].map(m => m[0]);
    expect(vars.length).toBe(4); vars.forEach(v => expect(v).not.toMatch(/#(16a34a|dc2626|eab308)/i));
  });
  it('the other low-contrast text colours fixed on 2026-10-03 are not used as text any more', () => {
    expect(textUses(src, ['6e6a66', 'a1a1aa', 'e2856a', '93c5fd'])).toEqual([]);
    expect(src).not.toMatch(/#(6e6a66|a1a1aa|e2856a)/i);
    expect(fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8')).not.toMatch(/#6e6a66/i);
  });
  it('every replacement text colour is >= 4.5:1 on every background it can sit on', () => {
    const BG = { page: '#e8e6e2', surface: '#f7f6f3', white: '#ffffff', grey: '#e4e4e7', redTint: '#fee2e2', blueTint: '#dbeafe', greenTint: '#dcfce7', orangeTint: '#fdecdc' };
    const must = (fg, bgs) => bgs.forEach(b => expect(ratio(fg, BG[b]), fg + ' on ' + b).toBeGreaterThanOrEqual(4.5));
    must('#5f5b57', Object.keys(BG));                    // muted text (was #6e6a66: 4.3 on the page)
    must('#66625e', Object.keys(BG));                    // disabled / done / placeholder text (was #a1a1aa: 2.1)
    must('#991b1b', ['redTint', 'surface', 'page']);     // IRT DANGER bullets (was #e2856a: 2.2)
    must('#1d4ed8', ['surface', 'white', 'page']);       // IRT unit label (was #93c5fd: 1.7)
    must('#166534', Object.keys(BG)); must('#b91c1c', Object.keys(BG)); // standard green / red text, incl. the pale chip fills
  });
  it('Failed Items chips (priority badge + tag): H / U-red text is #991b1b on its 13% tint over the pale-red card, >= 4.5:1 (the standard #b91c1c was 4.29 there)', () => {
    const over = (fg, bg, a) => '#' + [0, 2, 4].map(i => Math.round(parseInt(fg.slice(1).substr(i, 2), 16) * a + parseInt(bg.slice(1).substr(i, 2), 16) * (1 - a)).toString(16).padStart(2, '0')).join('');
    const tint = over('#b91c1c', '#fee2e2', 0x22 / 255);
    expect(ratio('#b91c1c', tint), 'old chip text').toBeLessThan(4.5);                 // documents why the chip needs its own darker text colour
    expect(ratio('#991b1b', tint), 'new chip text').toBeGreaterThanOrEqual(4.5);
    // the other priority colours already pass on their own tint over that card, and must keep doing so
    ['#166534', '#92400e', '#9B0000'].forEach(c => expect(ratio(c, over(c, '#fee2e2', 0x22 / 255)), c).toBeGreaterThanOrEqual(4.5));
    expect(src).toMatch(/color: reportChipText\(f\.badge\.color\)/); expect(src).toMatch(/color: reportChipText\(f\.tag\.color\)/);
    expect(src).toMatch(/reportChipText = c => \(String\(c\)\.toLowerCase\(\) === '#b91c1c' \? '#991b1b' : c\)/);
  });
  it('index.html styles ::placeholder with a >= 4.5:1 colour and full opacity (the browser default #757575 was 3.7:1 on the page)', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    const m = /::placeholder\s*\{\s*color:\s*(#[0-9a-fA-F]{6})\s*;\s*opacity:\s*1\s*;?\s*\}/.exec(html);
    expect(m, 'a ::placeholder { color; opacity: 1 } rule').toBeTruthy();
    [PAGE, SURFACE, WHITE, '#e4e4e7'].forEach(bg => expect(ratio(m[1], bg), m[1] + ' on ' + bg).toBeGreaterThanOrEqual(4.5));
  });
});

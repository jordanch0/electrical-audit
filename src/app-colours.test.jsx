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
  it('no text colour uses the old #16a34a / #dc2626 (they were ~3-4:1); a fill / border / icon may still use them', () => {
    expect(src).not.toMatch(/colors*:s*["']#(16a34a|dc2626)["']/i);
  });
});

// STATUS PILLS (2026-10-02): the ONE shared status / count indicator (StatusPill / StatusPills), based on the SWB board-page pill, with the contrast-checked colours.
import { describe, it, expect } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'fs';
import path from 'path';
import AppRoot, { StatusPill, StatusPills } from './App.jsx';

const lum = h => { const c = [0, 2, 4].map(i => parseInt(h.replace('#', '').substr(i, 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

describe('StatusPill', () => {
  it('"N WORD" in ONE string, default words PASS / FAIL / N/A / UNTESTED / SCORE (there is NO TOTAL kind), label overridable ("—"), count-less and count-only forms', () => {
    render(<div><StatusPill kind="pass" count={3} /><StatusPill kind="fail" count={0} /><StatusPill kind="na" count={1} /><StatusPill kind="untested" count={11} /><StatusPill kind="untested" count={11} label="—" />
      <StatusPill kind="score" count="80.0%" /><StatusPill kind="info" count="90%" /><StatusPill kind="pass" label="CLEAR" /></div>);
    ['3 PASS', '0 FAIL', '1 N/A', '11 UNTESTED', '11 —', '80.0% SCORE', '90%', 'CLEAR'].forEach(t => expect(screen.getByText(t)).toBeInTheDocument());
    cleanup();
  });
  it('the reference shape: #f7f6f3 fill, 1px border (colour + 20% alpha), radius 6, 12px bold, 4x10 padding; compact is 11px, 2x6', () => {
    const { rerender } = render(<StatusPill kind="pass" count={2} />); let el = screen.getByText('2 PASS');
    expect(el).toHaveStyle({ background: 'rgb(247, 246, 243)', borderRadius: '6px', fontSize: '12px', fontWeight: '700', padding: '4px 10px', color: 'rgb(22, 101, 52)' });
    expect(el.style.border).toMatch(/^1px solid/);
    rerender(<StatusPill kind="pass" count={2} compact />); el = screen.getByText('2 PASS'); expect(el).toHaveStyle({ fontSize: '11px', padding: '2px 6px' });
    cleanup();
  });
  it('colours: green #166534 / red #b91c1c (NOT the old #16a34a / #dc2626), and every kind is >= 4.5:1 on the pill background', () => {
    const want = { pass: 'rgb(22, 101, 52)', fail: 'rgb(185, 28, 28)', na: 'rgb(51, 65, 85)', untested: 'rgb(146, 64, 14)' };
    for (const [k, rgb] of Object.entries(want)) { render(<StatusPill kind={k} count={1} label="X" />); expect(screen.getByText('1 X')).toHaveStyle({ color: rgb }); cleanup(); }
    ['#166534', '#b91c1c', '#334155', '#92400e'].forEach(c => expect(ratio(c, '#f7f6f3')).toBeGreaterThanOrEqual(4.5));
  });
  it('alert (OVERDUE / FAIL badge): the same shape, red text on a light red fill, still >= 4.5:1; warn is amber', () => {
    render(<div><StatusPill kind="fail" count={2} label="FAIL" alert /><StatusPill kind="warn" label="DUE SOON" alert /></div>);
    expect(screen.getByText('2 FAIL')).toHaveStyle({ color: 'rgb(185, 28, 28)', background: 'rgb(254, 226, 226)', borderRadius: '6px' });
    expect(screen.getByText('DUE SOON')).toHaveStyle({ color: 'rgb(146, 64, 14)', background: 'rgb(254, 243, 199)' });
    expect(ratio('#b91c1c', '#fee2e2')).toBeGreaterThanOrEqual(4.5); expect(ratio('#92400e', '#fef3c7')).toBeGreaterThanOrEqual(4.5);
    cleanup();
  });
});

describe('StatusPills', () => {
  it('skips falsy entries, keeps the order, wraps (never overflows)', () => {
    render(<StatusPills pills={[['pass', 2], false, ['fail', 0], null, ['na', 1]]} />);
    const row = document.querySelector('[data-statuspills]'); expect([...row.children].map(c => c.textContent)).toEqual(['2 PASS', '0 FAIL', '1 N/A']);
    expect(row).toHaveStyle({ display: 'flex', flexWrap: 'wrap' }); cleanup();
  });
  it('a 3-digit count switches the default UNTESTED to "—" (so the row still fits at 390px); an explicit label always wins', () => {
    render(<StatusPills pills={[['pass', 150], ['untested', 4]]} />); expect(screen.getByText('4 —')).toBeInTheDocument(); cleanup();
    render(<StatusPills pills={[['pass', 15], ['untested', 4]]} />); expect(screen.getByText('4 UNTESTED')).toBeInTheDocument(); cleanup();
    render(<StatusPills pills={[['pass', 150], ['untested', 4, 'UNTESTED']]} />); expect(screen.getByText('4 UNTESTED')).toBeInTheDocument(); cleanup();
  });
});

describe('source: no hand-written count text and no dead pill components', () => {
  const src = fs.readFileSync(path.resolve(__dirname, 'App.jsx'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  it('no bare "N Pass" / "N Fail" / "N untested" / "N total" / "N P" / "N F" counter spans are left', () => {
    ['" Pass")', '" Fail")', '" FAIL")\n', '" untested")', '" Untested")', '" total")', '" Monitor")', '"P")', '"F")', '" P")', '" F")'].forEach(t => {
      const n = src.split(t).length - 1; const allowed = t === '" FAIL")\n' ? Infinity : 0; expect(n, t).toBeLessThanOrEqual(allowed);
    });
  });
  it('StatPill and IELStatPill (never used) are gone', () => { expect(src).not.toMatch(/function (IEL)?StatPill\b/); });
  it('the pill uses the contrast-checked text colours; the reference array no longer carries #16a34a / #dc2626', () => {
    expect(src).not.toMatch(/\["(PASS|FAIL)",\s*bs\.(pass|fail),\s*"#(16a34a|dc2626)"\]/);
  });
});

describe('real UI: the item-grid header is a full-width STATUS pill row WITH N/A (no TOTAL pill; the count is the plain subtitle)', () => {
  it('IEL item list: 2 PASS, 1 FAIL, 1 N/A, 1 UNTESTED for 5 items', async () => {
    cleanup(); localStorage.clear();
    const project = { id: 'p1', name: 'Example Quarry', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'e1', name: 'estops', circuits: ['a', 'b', 'c', 'd', 'e'], machineNames: { a: 'M1', b: 'M2', c: 'M3', d: 'M4', e: 'M5' } }] }] };
    localStorage.setItem('iel-projects-v2', JSON.stringify([project]));
    localStorage.setItem('iel-results-v2', JSON.stringify({ p1: { a: { estops: { a: { status: 'pass', lastTested: '2026-07-13' }, b: { status: 'pass', lastTested: '2026-07-13' }, c: { status: 'fail', lastTested: '2026-07-13' }, d: { status: 'na' } } } } }));
    localStorage.setItem('iel-meta-v2', JSON.stringify({ p1: { auditor: 'Jane Auditor', testDate: '2026-07-13', notes: '' } }));
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText('IEL TESTING'));
    await user.click(await screen.findByText('Example Quarry', { selector: 'div' })); await screen.findByText('NEXT TEST DUE'); await user.click(screen.getAllByText('E-Stops')[0]);
    await user.click(await screen.findByText('Plant')); await user.click(await screen.findByText('E-Stops')); await screen.findByText('M1');
    const row = document.querySelector('[data-statuspills]'); expect([...row.children].map(c => c.textContent)).toEqual(['2 PASS', '1 FAIL', '1 N/A', '1 UNTESTED']);
    expect(row).toHaveStyle({ marginBottom: '10px' });
  });
});

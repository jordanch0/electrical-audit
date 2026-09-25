// One score rule for every checklist module: Pass / (Total − N/A) × 100 (blank and FAIL stay in the denominator).
// ELT: per fitting over its 4 checks (no N/A). SWB: per board over its 11 items. Welder unchanged (see welder.test.js).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { checklistScore, scoreLabel, eltFittingSummary, eltRegisterRows, swbBoardSummary, welderSummary, WELDER_CHECKLIST, migrateProjectToAreas as toAreas } from './App.jsx';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('checklistScore', () => {
  it('is Pass / (Total − N/A) × 100 to one decimal; Fail and blank never leave the denominator; N/A does', () => {
    expect(checklistScore(0, 12)).toBe(0);
    expect(checklistScore(1, 12)).toBe(8.3);
    expect(checklistScore(1, 12, 1)).toBe(9.1);          // N/A raises the weight of every Pass
    expect(checklistScore(7, 12, 5)).toBe(100);
    expect(checklistScore(0, 4)).toBe(0);
    expect(checklistScore(3, 4)).toBe(75);
  });
  it('is null ("—") only when every item is N/A', () => {
    expect(checklistScore(0, 11, 11)).toBeNull();
    expect(scoreLabel(checklistScore(0, 11, 11))).toBe('—');
    expect(checklistScore(0, 11, 10)).toBe(0);
    expect(scoreLabel(0)).toBe('0.0%'); expect(scoreLabel(9.0909)).toBe('9.1%');
  });
  it('Welder still uses the same rule (behaviour unchanged)', () => {
    const it0 = r => ({ items: Object.fromEntries(WELDER_CHECKLIST.map((c, i) => [c.key, { result: r[i] === 'P' ? 'pass' : r[i] === 'F' ? 'fail' : r[i] === 'N' ? 'na' : '' }])) });
    expect(welderSummary(it0('PFN.........')).score).toBe(9.1);
    expect(welderSummary(it0('NNNNNNNNNNNN')).score).toBeNull();
  });
});

describe('ELT fitting score (its 4 checks, no N/A)', () => {
  const checks = (v, d, s, c) => ({ visual: v, discharge: d, switching: s, charging: c });
  it.each([
    [checks('pass', 'pass', 'pass', 'pass'), 4, 0, 0, 100],
    [checks('pass', 'fail', 'pass', 'pass'), 3, 1, 0, 75],
    [checks('fail', '', '', ''), 0, 1, 3, 0],           // one Fail and three blanks: 0 / 4
    [checks('pass', '', '', ''), 1, 0, 3, 25],          // blanks count against the score
    [checks('', '', '', ''), 0, 0, 4, 0],               // brand-new fitting is 0 / 4, not "—"
  ])('%o -> pass %i, fail %i, untested %i, score %i', (r, pass, fail, untested, score) => {
    expect(eltFittingSummary(r)).toEqual({ total: 4, pass, fail, untested, score });
  });
  it('the register row carries the Score right after Pass/Fail', () => {
    const proj = toAreas({ id: 'p1', name: 'S', assets: [{ id: 'a1', location: 'S', assetLocation: 'Door', assetId: '', type: 'Emergency Exit Sign', maintained: '', fitting: '' }] });
    const [row] = eltRegisterRows(proj, { p1: { a1: checks('pass', 'fail', 'pass', 'pass') } }, {});
    expect(row.cells[12]).toBe('Fail'); expect(row.cells[13]).toBe('75.0%');
  });
});

describe('SWB board score (11 items, N/A removes an item)', () => {
  it('swbBoardSummary carries the score', () => {
    const res = { s1: { a1: { b1: { enclosure: { status: 'pass' }, ventilation: { status: 'fail' }, moisture: { status: 'na' } } } } };
    const s = swbBoardSummary(res, 's1', 'a1', 'b1');
    expect(s).toMatchObject({ pass: 1, fail: 1, na: 1, untested: 8, total: 11 });
    expect(s.score).toBe(10);                             // 1 / (11 − 1)
    expect(swbBoardSummary({}, 's1', 'a1', 'b1').score).toBe(0);
  });
});

describe('live UI', () => {
  const score = () => screen.getByText('SCORE').parentElement.textContent.match(/(\d+\.\d%|—)/)[0];

  it('ELT fitting page: AUDIT SUMMARY with SCORE that moves as the checks are tapped (live-saved)', async () => {
    localStorage.setItem('elt-projects-v2', JSON.stringify([{ id: 'p1', name: 'Site E', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Site E', assets: [
      { id: 'a1', assetLocation: 'Door 1', assetId: '', type: 'Emergency Exit Sign', typeOther: '', maintained: '', fitting: '' }] }] }]));
    localStorage.setItem('elt-meta-v1', JSON.stringify({ p1: { auditor: 'Jane', testDate: '2026-07-13' } }));
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('EMERGENCY LIGHTING'));
    await user.click(await screen.findByText('Site E', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    await user.click(await screen.findByText('Door 1'));
    expect(screen.getByText('AUDIT SUMMARY')).toBeInTheDocument();
    expect(score()).toBe('0.0%');
    await user.click(screen.getAllByRole('button', { name: 'PASS' })[0]); expect(score()).toBe('25.0%');
    await user.click(screen.getAllByRole('button', { name: 'PASS' })[1]); expect(score()).toBe('50.0%');
    await user.click(screen.getAllByRole('button', { name: 'FAIL' })[2]); expect(score()).toBe('50.0%');   // a Fail never moves it
    await user.click(screen.getAllByRole('button', { name: 'PASS' })[3]); expect(score()).toBe('75.0%');
  });

  it('SWB board view shows a SCORE chip and the Report tab a per-board score', async () => {
    localStorage.setItem('swb-projects-v1', JSON.stringify([{ id: 's1', name: 'Site S', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] }]));
    localStorage.setItem('swb-meta-v1', JSON.stringify({ s1: { auditor: 'Jane', testDate: '2026-09-21' } }));
    localStorage.setItem('swb-results-v1', JSON.stringify({ s1: { a1: { b1: { enclosure: { status: 'pass' }, ventilation: { status: 'fail' }, moisture: { status: 'na' } } } } }));
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD'));
    await user.click(await screen.findByText('Site S', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ }));
    await user.click(await screen.findByText('Plant'));
    await user.click(await screen.findByText('MSB'));
    expect(screen.getByText(/10\.0% SCORE/)).toBeInTheDocument();     // chip in the board's counter row
    await user.click(screen.getByRole('button', { name: /^Report$/ }));
    await waitFor(() => expect(screen.getByText('BOARD SUMMARY')).toBeInTheDocument());
    expect(screen.getAllByText('10.0%').length).toBeGreaterThan(0);
  });
});

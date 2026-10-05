// DateBox: the app's one date field on a form page — a styled box showing DD/MM/YYYY over a transparent native date input (so it cannot overflow on iOS Safari),
// with a visible focus outline while the hidden input has focus. Used by ELT and Welder "DATE RECTIFIED / SCHEDULED" and GSD "FIX BY DATE" (FICTIONAL data).
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { DateBox, WELDER_CHECKLIST } from './App.jsx';

const ls = k => JSON.parse(localStorage.getItem(k));
beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('DateBox (the component)', () => {
  const mount = (props = {}) => { const calls = []; const utils = render(<DateBox value="2026-09-21" ariaLabel="Test date" boxStyle={{ width: '100%', padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} onChange={v => calls.push(v)} {...props} />); return { calls, ...utils }; };
  it('shows the date as DD/MM/YYYY in an ordinary box, over a transparent input that keeps the aria-label', () => {
    mount();
    const box = screen.getByTestId('date-box'); const input = screen.getByLabelText('Test date');
    expect(box.textContent).toBe('21/09/2026'); expect(box.style.textAlign).toBe('center');                       // centred, like the Home dates
    expect(input.type).toBe('date'); expect(input.value).toBe('2026-09-21');
    expect(input.style.position).toBe('absolute'); expect(input.style.opacity).toBe('0'); expect(input.style.width).toBe('100%'); expect(input.style.height).toBe('100%');   // an overlay: the box is what you see
    expect(input.parentElement.style.position).toBe('relative'); expect(input.parentElement.contains(box)).toBe(true);
  });
  it('empty: the placeholder (default "Select date…"), in the readable placeholder grey', () => {
    mount({ value: '' }); expect(screen.getByTestId('date-box').textContent).toBe('Select date…'); expect(screen.getByTestId('date-box')).toHaveStyle({ color: '#66625e' });
    cleanup(); mount({ value: '', placeholder: 'Pick a day' }); expect(screen.getByTestId('date-box').textContent).toBe('Pick a day');
  });
  it('a change gives the ISO value to onChange', () => {
    const { calls } = mount(); fireEvent.change(screen.getByLabelText('Test date'), { target: { value: '2026-10-12' } }); expect(calls).toEqual(['2026-10-12']);
  });
  it('FOCUS: a visible outline on the box while the hidden input has focus (>= 3:1 blue on the page), gone on blur; the onBlur prop still fires', () => {
    let blurred = 0; mount({ onBlur: () => { blurred++; } });
    const box = screen.getByTestId('date-box'); const input = screen.getByLabelText('Test date');
    expect(box.style.outline).toBe('none');
    act(() => { input.focus(); });
    expect(box.style.outline).toBe('2px solid #1d4ed8'); expect(box.style.outlineOffset).toBe('1px');
    act(() => { input.blur(); });
    expect(box.style.outline).toBe('none'); expect(blurred).toBe(1);
  });
});

describe('the three fields use it', () => {
  const boxOf = label => screen.getByLabelText(label).parentElement.querySelector('[data-testid="date-box"]');
  it('ELT: DATE RECTIFIED / SCHEDULED is a DateBox; a date is stored and shown; focus outlines it', async () => {
    localStorage.setItem('elt-projects-v2', JSON.stringify([{ id: 'p1', name: 'Site E', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Site E', assets: [{ id: 'a1', assetLocation: 'SE Door', assetId: '', type: 'Exit Signs', typeOther: '', maintained: 'Maintained', fitting: 'X' }] }] }]));
    localStorage.setItem('elt-meta-v1', JSON.stringify({ p1: { auditor: 'Jane', testDate: '2026-09-21', nextTestDate: '2027-03-21' } }));
    localStorage.setItem('elt-audit-active-v1', JSON.stringify({ v: 1, sites: { p1: {} } }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('EMERGENCY LIGHTING')); await user.click(await screen.findByText('Site E', { selector: 'div' })); await user.click(screen.getByRole('button', { name: /^Audit$/ })); await user.click(await screen.findByText('SE Door'));
    await user.click(screen.getAllByRole('button', { name: 'FAIL' })[0]);
    const input = await screen.findByLabelText('Date rectified or scheduled'); expect(boxOf('Date rectified or scheduled').textContent).toBe('Select date…');
    expect(input.style.opacity).toBe('0');
    act(() => { input.focus(); }); expect(boxOf('Date rectified or scheduled').style.outline).toContain('2px solid');
    fireEvent.change(input, { target: { value: '2026-10-12' } });
    await waitFor(() => expect(ls('elt-results-v1').p1.a1.rectifiedDate).toBe('2026-10-12')); expect(boxOf('Date rectified or scheduled').textContent).toBe('12/10/2026');
  });
  it('Welder: DATE RECTIFIED / SCHEDULED is a DateBox; a date is stored and shown', async () => {
    localStorage.setItem('welder-projects-v2', JSON.stringify([{ id: 'w', name: 'Site W', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Site W', assets: [{ id: 'a1', assetId: 'W001', brand: 'K', model: 'M', serial: '1' }] }] }]));
    localStorage.setItem('welder-meta-v1', JSON.stringify({ w: { auditor: 'Jane', testDate: '2026-09-21' } }));
    localStorage.setItem('welder-results-v1', JSON.stringify({ w: { a1: { items: Object.fromEntries(WELDER_CHECKLIST.map((c, i) => [c.key, { result: i === 0 ? 'fail' : 'pass' }])) } } }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('WELDER TESTING')); await user.click(await screen.findByText('Site W', { selector: 'div' })); await user.click(screen.getByRole('button', { name: /^Audit$/ })); await user.click(await screen.findByText('W001'));
    const input = await screen.findByLabelText('Date rectified or scheduled'); expect(input.style.opacity).toBe('0');
    act(() => { input.focus(); }); expect(boxOf('Date rectified or scheduled').style.outline).toContain('2px solid');
    fireEvent.change(input, { target: { value: '2026-11-03' } });
    await waitFor(() => expect(ls('welder-results-v1').w.a1.rectifiedDate).toBe('2026-11-03')); expect(boxOf('Date rectified or scheduled').textContent).toBe('03/11/2026');
  });
  it('GSD: FIX BY DATE is a DateBox (aria-label "Fix by date" kept); a date is stored and shown', async () => {
    localStorage.setItem('gsd-projects-v1', JSON.stringify([{ id: 's1', name: 'Site G', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'One' }] }]));
    localStorage.setItem('gsd-meta-v1', JSON.stringify({ s1: { auditor: 'J', testDate: '2026-09-21' } }));
    localStorage.setItem('gsd-items-v1', JSON.stringify({ s1: [{ id: 'i1', areaId: 'a1', assetLocation: '', category: '', commonDefect: '', description: 'x', descAuto: '', photos: [], priority: '', responsibility: '', dueDate: '' }] }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('GENERAL SITE DEFECTS')); await user.click(await screen.findByText('Site G', { selector: 'div' })); await user.click(screen.getByRole('button', { name: 'Audit' })); await user.click(await screen.findByTestId('gsd-card'));
    const input = screen.getByLabelText('Fix by date'); expect(input.style.opacity).toBe('0'); expect(boxOf('Fix by date').textContent).toBe('Select date…');
    act(() => { input.focus(); }); expect(boxOf('Fix by date').style.outline).toContain('2px solid');
    fireEvent.change(input, { target: { value: '2026-11-30' } });
    await waitFor(() => expect(ls('gsd-items-v1').s1[0].dueDate).toBe('2026-11-30')); expect(boxOf('Fix by date').textContent).toBe('30/11/2026');
  });
});

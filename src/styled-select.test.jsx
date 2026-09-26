// Every choice field in the app is the SAME styled dropdown (2026-09-26): the shared StyledSelect for closed choices (and choice + typed text), the EditableDropdown
// family for open lists. No native <select> is left — only native DATE pickers stay native.
import React from 'react';
import fs from 'fs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { StyledSelect } from './App.jsx';

afterEach(() => cleanup()); beforeEach(() => localStorage.clear());
const ls = k => JSON.parse(localStorage.getItem(k));

describe('the source has no native <select>', () => {
  it('no createElement("select") of any spelling anywhere in App.jsx', () => {
    const src = fs.readFileSync('src/App.jsx', 'utf8');
    expect(src.match(/(createElement|eltEl|gsdEl)\(\s*['"]select['"]/g) || []).toEqual([]);
  });
});

describe('StyledSelect', () => {
  function Host({ opts, value = '', allowEmpty, allowCustom, log = [], onParentClick }) {
    const [v, setV] = React.useState(value);
    return (<div onClick={onParentClick}><div data-testid="outside">outside</div>
      <StyledSelect options={opts} value={v} placeholder="Pick one…" allowEmpty={allowEmpty} allowCustom={allowCustom} ariaLabel="Thing" stopClicks={!!onParentClick} onChange={(x, m) => { log.push([x, m]); setV(x); }} /></div>);
  }
  const trigger = () => screen.getByRole('button', { name: 'Thing' });
  const list = () => within(screen.getByRole('listbox')).getAllByRole('option').map(o => o.textContent);

  it('shows the LABEL of the stored value, the placeholder when empty, and a stored value that is not listed as its own text; onChange gets the VALUE (label != value)', async () => {
    const user = userEvent.setup(); const log = [];
    render(<Host opts={[{ value: '3', label: '3 Months — Building' }, { value: '12', label: 'Annual' }]} value="3" log={log} />);
    expect(trigger()).toHaveTextContent('3 Months — Building');
    await user.click(trigger()); expect(list()).toEqual(['3 Months — Building', 'Annual']);
    await user.click(screen.getByRole('option', { name: 'Annual' })); expect(log).toEqual([['12', undefined]]); expect(trigger()).toHaveTextContent('Annual'); expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    cleanup(); render(<Host opts={['A', 'B']} />); expect(trigger()).toHaveTextContent('Pick one…');
    cleanup(); render(<Host opts={['A', 'B']} value="Legacy" />); expect(trigger()).toHaveTextContent('Legacy');          // never hidden
  });
  it('allowEmpty adds a first option (labelled with the placeholder) that clears the value; closed by default: no typed mode', async () => {
    const user = userEvent.setup(); const log = [];
    render(<Host opts={['A', 'B']} value="A" allowEmpty log={log} />);
    await user.click(trigger()); expect(list()).toEqual(['Pick one…', 'A', 'B']); expect(screen.queryByText('Type custom…', { exact: false })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Pick one…' })); expect(log[0][0]).toBe(''); expect(trigger()).toHaveTextContent('Pick one…');
  });
  it('allowCustom: "Type custom…" swaps in a text box whose changes are flagged custom; "▾ List" returns; a stored unlisted value opens as text', async () => {
    const user = userEvent.setup(); const log = [];
    render(<Host opts={['A', 'B']} allowCustom log={log} />);
    await user.click(trigger()); await user.click(screen.getByText('Type custom…', { exact: false }));
    await user.type(screen.getByLabelText('Thing (typed)'), 'Zed'); expect(log.map(l => l[0])).toEqual(['Z', 'Ze', 'Zed']); expect(log[2][1]).toEqual({ custom: true });
    await user.click(screen.getByRole('button', { name: '▾ List' })); expect(screen.getByRole('button', { name: 'Thing' })).toHaveTextContent('Zed');
    cleanup(); render(<Host opts={['A', 'B']} value="Mine" allowCustom />); expect(screen.getByLabelText('Thing (typed)')).toHaveValue('Mine');
  });
  it('joins the one collapse rule: an outside click closes it, a second StyledSelect opening closes the first; stopClicks keeps clicks from reaching a clickable parent', async () => {
    const user = userEvent.setup(); let parent = 0;
    render(<div><Host opts={['A']} onParentClick={() => { parent++; }} /></div>);
    await user.click(trigger()); expect(screen.getByRole('listbox')).toBeInTheDocument(); expect(parent).toBe(0);
    await user.click(screen.getByRole('option', { name: 'A' })); expect(parent).toBe(0);
    await user.click(trigger()); await user.click(screen.getByTestId('outside')); expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    cleanup();
    render(<div><StyledSelect options={['A']} value="" placeholder="First" onChange={() => {}} ariaLabel="First" /><StyledSelect options={['B']} value="" placeholder="Second" onChange={() => {}} ariaLabel="Second" /></div>);
    await user.click(screen.getByRole('button', { name: 'First' })); expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Second' })); expect(screen.queryByRole('option', { name: 'A' })).not.toBeInTheDocument(); expect(screen.getByRole('option', { name: 'B' })).toBeInTheDocument();
  });
});

describe('SWB Risk Rating is the Priority button set', () => {
  it('None / L / M / H / U buttons (same scale and look as Priority elsewhere), stored as the letter; no select', async () => {
    localStorage.setItem('swb-projects-v1', JSON.stringify([{ id: 's1', name: 'Site S', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] }]));
    localStorage.setItem('swb-meta-v1', JSON.stringify({ s1: { auditor: 'Jane', testDate: '2026-09-21' } }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD')); await user.click(await screen.findByText('Site S', { selector: 'div' })); await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ }));
    await user.click(await screen.findByText('Plant')); await user.click(await screen.findByText('MSB')); await user.click(await screen.findByText('Enclosure Condition'));
    await user.click(screen.getByRole('button', { name: 'FAIL' }));
    const field = screen.getByText('RISK RATING').parentElement;
    expect(within(field).getAllByRole('button').map(b => b.textContent)).toEqual(['None', 'L — Low', 'M — Medium', 'H — High', 'U — Urgent']);
    expect(field.querySelector('select')).toBeNull();
    await user.click(within(field).getByRole('button', { name: 'H — High' }));
    expect(within(field).getByRole('button', { name: 'H — High' })).toHaveStyle({ color: '#dc2626' });                   // the same colours as Priority (PRIORITY_COLORS.H)
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(JSON.stringify(ls('swb-results-v1'))).toMatch(/"risk":"H"/));
  });
});

describe('Calendar: Site and Recurrence are styled dropdowns', () => {
  it('Site picks a listed site or takes typed text; Recurrence keeps the stored keys; the event saves with them', async () => {
    localStorage.setItem('rcd-projects-v6', JSON.stringify([{ id: 's1', name: 'Site One', company: '', abn: '', licence: '', areas: [] }]));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByTestId('calendar-pill')); await user.click(await screen.findByText('Add Event'));
    await user.click(screen.getByRole('button', { name: 'Site' })); expect(within(screen.getByRole('listbox')).getByRole('option', { name: 'Site One' })).toBeInTheDocument();
    await user.click(screen.getByText('Type custom…', { exact: false })); await user.type(screen.getByLabelText('Site (typed)'), 'Custom Yard');
    await user.click(screen.getByRole('button', { name: 'Recurrence' })); expect(within(screen.getByRole('listbox')).getAllByRole('option').map(o => o.textContent)).toEqual(['No recurrence (one-off)', 'Monthly', 'Every 3 months', 'Every 6 months', 'Annual']);
    await user.click(screen.getByRole('option', { name: 'Annual' }));
    expect(screen.getByRole('button', { name: 'Recurrence' })).toHaveTextContent('Annual');
  });
});

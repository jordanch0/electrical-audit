// The converted fields inside their real modules: RCD Manage (narrow CB Type / Amp Rating rows), TAT Manage (frequency, area default, appliance-name box).
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

afterEach(() => cleanup()); beforeEach(() => localStorage.clear());
const ls = k => JSON.parse(localStorage.getItem(k));
const opts = () => within(screen.getByRole('listbox')).getAllByRole('option').map(o => o.textContent);

describe('TAT Manage', () => {
  const project = { id: 't1', name: 'Site T', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Workshop', defaultFreq: '3', items: ['i1'], itemNames: { i1: 'Drill' }, itemTags: { i1: '1' }, itemEquipTypes: { i1: 'Power Tool' }, itemFreqs: { i1: '3' } }] };
  async function open(user) {
    localStorage.setItem('tat-projects-v1', JSON.stringify([project])); localStorage.setItem('tat-meta-v1', JSON.stringify({ t1: { auditor: 'Jane', testDate: '2026-09-21' } }));
    render(<AppRoot />); await user.click(screen.getByText('TEST & TAG')); await user.click(await screen.findByText('Site T', { selector: 'div' })); await user.click(screen.getByRole('button', { name: 'Manage' }));
  }
  it('Test Frequency (add item) is the styled dropdown, showing the LABEL of the stored value, and listing every frequency', async () => {
    const user = userEvent.setup(); await open(user); await user.click(await screen.findByText('Workshop'));
    const trigger = await screen.findByRole('button', { name: 'New item test frequency' }); expect(trigger).toHaveTextContent('3 Months');
    await user.click(trigger); expect(opts().length).toBeGreaterThanOrEqual(4); expect(opts().some(o => /^3 Months/.test(o))).toBe(true);
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: opts().find(o => /^6 Months/.test(o)) })); expect(trigger).toHaveTextContent('6 Months');
  });
  it('the area header "Default:" frequency is a compact styled dropdown that does NOT toggle the area (stopClicks), and stores the chosen frequency', async () => {
    const user = userEvent.setup(); await open(user); await user.click(await screen.findByText('Workshop'));
    expect(screen.getByText('Drill', { selector: 'span' })).toBeInTheDocument();                       // expanded
    await user.click(screen.getByRole('button', { name: 'Area default frequency' })); await user.click(screen.getByRole('option', { name: 'Annual' }));
    expect(screen.getByText('Drill', { selector: 'span' })).toBeInTheDocument();                       // still expanded: the click did not reach the header
    await waitFor(() => expect(ls('tat-projects-v1')[0].areas[0].defaultFreq).toBe('12'));
  });
  it('the appliance-name box: focus / ▾ opens the list, typing filters it, picking fills the box, and an outside click or Escape closes it (shared collapse rule, no blur timeout)', async () => {
    const user = userEvent.setup(); await open(user); await user.click(await screen.findByText('Workshop'));
    const input = await screen.findByPlaceholderText('Type or pick ▾');
    await user.click(input); expect(screen.getByText('Angle Grinder')).toBeInTheDocument();
    await user.type(input, 'kett'); expect(screen.getByText('Kettle')).toBeInTheDocument(); expect(screen.queryByText('Angle Grinder')).not.toBeInTheDocument();
    await user.click(screen.getByText('Kettle')); expect(input).toHaveValue('Kettle'); expect(screen.queryByText('Angle Grinder')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show appliance names' })); expect(screen.getByRole('button', { name: 'Kettle' })).toBeInTheDocument();       // the ▾ list (filtered by what is typed)
    await user.click(screen.getByText('Manage: Site T', { exact: false })); expect(screen.queryByRole('button', { name: 'Kettle' })).not.toBeInTheDocument();          // outside click closes it
    await user.clear(input); expect(screen.getByText('Angle Grinder')).toBeInTheDocument();          // focusing / clearing the box opens the full list
    await user.click(input); await user.keyboard('{Escape}'); expect(screen.queryByText('Angle Grinder')).not.toBeInTheDocument();                                            // Escape closes it
  });
});

describe('RCD Manage: the narrow CB Type / Amp Rating rows', () => {
  it('the add-circuit and bulk rows are styled dropdowns that fit their rows and list the customisable options; choosing changes the shown value', async () => {
    localStorage.setItem('rcd-projects-v6', JSON.stringify([{ id: 's1', name: 'Site R', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', panels: [{ id: 'p1', name: 'MSB', circuits: ['C1'], circuitMeta: {} }] }] }]));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('RCD TESTING')); await user.click(await screen.findByText('Site R', { selector: 'div' })); await user.click(screen.getByRole('button', { name: 'Manage' }));
    await user.click(await screen.findByText('Plant')); const p = await screen.findByText('MSB'); await user.click(p);
    const cb = await screen.findByRole('button', { name: 'New circuit CB type' }); const amp = screen.getByRole('button', { name: 'New circuit amp rating' });
    expect(cb.parentElement.style.minWidth).toBe('0px'); expect(amp.parentElement.style.minWidth).toBe('0px');            // they shrink inside the row instead of overflowing
    expect(getComputedStyle(cb.parentElement.parentElement).overflow).not.toBe('hidden');                                    // the row must not clip the popover
    await user.click(cb); const list = opts(); expect(list.length).toBeGreaterThan(2);
    await user.click(screen.getByRole('option', { name: list[1] })); expect(cb).toHaveTextContent(list[1]);
    expect(screen.getByRole('button', { name: 'Bulk CB type' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Bulk amp rating' })).toBeInTheDocument();
  });
});

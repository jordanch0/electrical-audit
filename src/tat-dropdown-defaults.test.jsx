// TAT Dropdowns tab: the stored ★ default test frequency must never point at an option that was reset away or deleted, and every "default for a NEW item"
// read goes through tatDefaultFreq (which also survives already-stale stored data). Equipment Type's ★ is the FIRST list item, so it cannot go stale.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { tatDefaultFreq } from './App.jsx';

const ls = k => JSON.parse(localStorage.getItem(k));
const F = (v, label) => ({ value: v, label: label || (v === '1' ? '1 Month' : v + ' Months') });
afterEach(() => cleanup());

describe('tatDefaultFreq — the effective default is always a real option', () => {
  const opts = [F('1'), F('2'), F('3'), F('6')];
  it('area default wins when it is still an option, then the site default, then the first option, then "3"', () => {
    expect(tatDefaultFreq(opts, { freq: '2' }, { defaultFreq: '6' })).toBe('6');
    expect(tatDefaultFreq(opts, { freq: '2' }, { defaultFreq: '12' })).toBe('2');     // the area default was removed -> site default
    expect(tatDefaultFreq(opts, { freq: '2' })).toBe('2');
    expect(tatDefaultFreq(opts, { freq: '12' })).toBe('3');                            // stale site default -> the factory default if still listed
    expect(tatDefaultFreq([F('1'), F('6')], { freq: '12' })).toBe('1');                // ...else the first remaining option
    expect(tatDefaultFreq(opts, {})).toBe('3');
    expect(tatDefaultFreq([], { freq: '2' })).toBe('3');                               // empty list: the factory default
    expect(tatDefaultFreq(undefined, undefined)).toBe('3');                            // nothing loaded yet: the built-in list has "3"
  });
});

async function openDropdowns(user) {
  render(<AppRoot />);
  await user.click(screen.getByText('TEST & TAG'));
  await user.click(await screen.findByText('Site T', { selector: 'div' }));
  await user.click(screen.getByRole('button', { name: 'Dropdowns' }));
  await screen.findByText('TEST FREQUENCY');
}
const row = label => screen.getByText(label, { selector: 'span' }).parentElement;
const trash = r => { const b = within(r).getAllByRole('button'); return b[b.length - 1]; };
// compact DeleteButton confirm state: [★?, icon-only Delete, Keep] — the Delete button has no accessible name, so take the one before Keep
const confirmDelete = r => { const b = within(r).getAllByRole('button'); return b[b.length - 2]; };
const starRows = () => screen.getAllByText('★ DEFAULT').filter(el => /Month/.test(el.parentElement.textContent)).map(el => el.parentElement);

beforeEach(() => {
  cleanup(); localStorage.clear();
  localStorage.setItem('tat-projects-v1', JSON.stringify([{ id: 't1', name: 'Site T', company: '', abn: '', licence: '', areas: [] }]));
  localStorage.setItem('tat-freqs-v1', JSON.stringify([F('1'), F('2'), F('3'), F('6')]));
});

describe('Dropdowns tab: TEST FREQUENCY ★', () => {
  it('deleting the ★ option hands the ★ to a remaining option (factory default if listed) and stores it; deleting any other option leaves the ★ alone', async () => {
    localStorage.setItem('tat-defaults-v1', JSON.stringify({ equipType: 'Power Tool', freq: '2' }));
    const user = userEvent.setup(); await openDropdowns(user);
    expect(starRows()).toHaveLength(1); expect(starRows()[0]).toHaveTextContent('2 Months');
    await user.click(trash(row('6 Months'))); await user.click(confirmDelete(row('6 Months')));   // not the default
    await waitFor(() => expect(screen.queryByText('6 Months', { selector: 'span' })).not.toBeInTheDocument());
    expect(ls('tat-defaults-v1').freq).toBe('2'); expect(starRows()[0]).toHaveTextContent('2 Months');
    await user.click(trash(row('2 Months'))); await user.click(confirmDelete(row('2 Months')));   // the ★ option
    await waitFor(() => expect(screen.queryByText('2 Months', { selector: 'span' })).not.toBeInTheDocument());
    await waitFor(() => expect(ls('tat-defaults-v1').freq).toBe('3'));                  // handed to a remaining option (the factory default is still listed), stored
    expect(starRows()).toHaveLength(1); expect(starRows()[0]).toHaveTextContent('3 Months');
  });

  it('deleting the ★ option when it was the LAST one falls back to the factory default and shows no dangling ★', async () => {
    localStorage.setItem('tat-freqs-v1', JSON.stringify([F('2')]));
    localStorage.setItem('tat-defaults-v1', JSON.stringify({ equipType: 'Power Tool', freq: '2' }));
    const user = userEvent.setup(); await openDropdowns(user);
    await user.click(trash(row('2 Months'))); await user.click(confirmDelete(row('2 Months')));
    await waitFor(() => expect(ls('tat-defaults-v1').freq).toBe('3'));
    expect(screen.queryAllByText('★ DEFAULT').filter(el => /Month/.test(el.parentElement.textContent))).toHaveLength(0);
  });

  it('Reset restores the list AND its ★ (a custom default that the reset removes must not survive)', async () => {
    localStorage.setItem('tat-defaults-v1', JSON.stringify({ equipType: 'Power Tool', freq: '2' }));
    const user = userEvent.setup(); await openDropdowns(user);
    // one "Reset to defaults" per list, in on-screen order: Appliance names, Equipment Type, Test Frequency, then the two defect lists
    await user.click(screen.getAllByRole('button', { name: 'Reset to defaults' })[2]);
    const prompt = await screen.findByText('Reset list to defaults?'); await user.click(within(prompt.parentElement).getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(ls('tat-defaults-v1').freq).toBe('3'));
    expect(ls('tat-freqs-v1').map(f => f.value)).toEqual(['1', '3', '6', '12']);        // the standard four
    expect(starRows()).toHaveLength(1); expect(starRows()[0]).toHaveTextContent('3 Months');
  });

  it('ALREADY-stale stored data (default points at an option that is not in the list) shows exactly one ★, on a real option', async () => {
    localStorage.setItem('tat-defaults-v1', JSON.stringify({ equipType: 'Power Tool', freq: '12' }));   // "12" is not in the seeded list
    const user = userEvent.setup(); await openDropdowns(user);
    expect(starRows()).toHaveLength(1); expect(starRows()[0]).toHaveTextContent('3 Months');   // the factory default is listed
    expect(ls('tat-defaults-v1').freq).toBe('12');                                      // reading never rewrites storage
  });

  it('tapping ★ on another option still sets the default', async () => {
    localStorage.setItem('tat-defaults-v1', JSON.stringify({ equipType: 'Power Tool', freq: '1' }));
    const user = userEvent.setup(); await openDropdowns(user);
    await user.click(within(row('3 Months')).getByTitle('Set as default'));
    await waitFor(() => expect(ls('tat-defaults-v1').freq).toBe('3'));
    expect(starRows()[0]).toHaveTextContent('3 Months');
  });
});

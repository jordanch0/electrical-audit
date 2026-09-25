// ELT Dropdowns tab: user-editable option lists behind the plain select + literal "Other" (+ text box).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

const project = { id:'p1', name:'Site A', company:'', abn:'', licence:'', assets:[
  { id:'a1', location:'Site A', assetLocation:'SE Door', assetId:'', type:'Emergency Exit Sign', maintained:'Maintained', fitting:'X' },
] };
const ls = k => JSON.parse(localStorage.getItem(k));
// the DeleteButton's idle state is an icon-only button; it is the last button in an option row
const trashIn = row => { const b = within(row).getAllByRole('button'); return b[b.length - 1]; };
const optionsOf = select => within(select).getAllByRole('option').map(o => o.textContent);

async function openElt(user) {
  render(<AppRoot />);
  await user.click(screen.getByText('EMERGENCY LIGHTING'));
  await user.click(await screen.findByText('Site A', { selector: 'div' }));
}
async function addOption(user, placeholder, text) {
  const input = screen.getByPlaceholderText(placeholder);
  await user.type(input, text);
  await user.click(within(input.parentElement).getByRole('button', { name: '+ Add' }));
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('elt-projects-v1', JSON.stringify([project]));
  localStorage.setItem('elt-meta-v1', JSON.stringify({ p1:{ auditor:'Jane', testDate:'2026-09-21', nextTestDate:'2027-03-21' } }));
});
afterEach(() => cleanup());

describe('ELT Dropdowns tab', () => {
  it('is the last nav item, after Manage (same order as SWB/RCD)', async () => {
    const user = userEvent.setup();
    await openElt(user);
    const nav = ['Home', 'Audit', 'Report', 'History', 'Manage', 'Dropdowns'].map(n => screen.getByRole('button', { name: n }));
    const order = nav.map(b => [...b.parentElement.children].indexOf(b));
    expect(order).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('shows the defaults, keeps "Other" out of the editable lists, and refuses to add it', async () => {
    const user = userEvent.setup();
    await openElt(user);
    await user.click(screen.getByRole('button', { name: 'Dropdowns' }));
    for (const t of ['Spitfire', 'Batten Lights', 'Exit Signs', 'Floodlights / Spotlights', 'Site Electrician', 'Client', 'Removed from Service', 'No Action Required']) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
    expect(screen.getAllByText(/★ DEFAULT/)).toHaveLength(2);        // the two FAIL-panel lists pre-fill their top option; the Type list has no default (selects start blank)
    expect(within(screen.getByText('Spitfire').parentElement).queryByText(/★ DEFAULT/)).not.toBeInTheDocument();
    await addOption(user, 'Add new type option…', 'other');
    expect(screen.queryByText('other')).not.toBeInTheDocument();
    expect(screen.getByText('Other is already built in')).toBeInTheDocument(); // explained, not silent
    expect(ls('elt-dropdowns-v1') == null || !ls('elt-dropdowns-v1').types.some(x => x.toLowerCase() === 'other')).toBe(true);
    await user.type(screen.getByPlaceholderText('Add new type option…'), 'x'); // typing again clears the message
    expect(screen.queryByText('Other is already built in')).not.toBeInTheDocument();
  });

  it('custom options appear in the Type select (with "Other" last) and in the FAIL panel Responsibility / Rectified lists, and persist across a reload', async () => {
    const user = userEvent.setup();
    await openElt(user);
    await user.click(screen.getByRole('button', { name: 'Dropdowns' }));
    await addOption(user, 'Add new type option…', 'Bulkhead Light');
    await addOption(user, 'Add new responsibility option…', 'Electrical Contractor');
    await addOption(user, 'Add new rectified / scheduled action option…', 'Replaced Unit');
    expect(screen.getByText('Bulkhead Light')).toBeInTheDocument();
    await waitFor(() => expect(ls('elt-dropdowns-v1')).toMatchObject({
      types: ['Spitfire', 'Batten Lights', 'Exit Signs', 'Floodlights / Spotlights', 'Bulkhead Light'],
      responsibility: expect.arrayContaining(['Electrical Contractor']),
      rectified: expect.arrayContaining(['Replaced Unit']),
    }));
    expect(ls('elt-dropdowns-v1').types).not.toContain('Other');

    // "reload": throw the whole app away and mount it again from localStorage
    cleanup();
    await openElt(user);

    // Type select on the Manage > Add Fitting form
    await user.click(screen.getByRole('button', { name: 'Manage' }));
    await user.click(screen.getByRole('button', { name: '+ Add Fitting' }));
    const typeOpts = optionsOf(screen.getByRole('combobox'));
    expect(typeOpts).toEqual(['— Select', 'Spitfire', 'Batten Lights', 'Exit Signs', 'Floodlights / Spotlights', 'Bulkhead Light', 'Other']);
    await user.selectOptions(screen.getByRole('combobox'), 'Other'); // literal Other still reveals the text box
    expect(screen.getByPlaceholderText('Specify…')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // the standard FAIL panel on a failed fitting: ★ defaults stored on becoming FAIL, custom options selectable
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    await user.click(await screen.findByText('SE Door'));
    await user.click(screen.getAllByRole('button', { name: 'FAIL' })[0]);
    await user.click(screen.getByRole('button', { name: /Site Electrician/ }));
    await user.click(screen.getByText('Electrical Contractor'));
    await user.click(screen.getByRole('button', { name: /Removed from Service/ }));
    await user.click(screen.getByText('Replaced Unit'));
    await waitFor(() => expect(ls('elt-results-v1').p1.a1).toMatchObject({ responsibility: 'Electrical Contractor', rectified: 'Replaced Unit' }));
  });

  it('★ moves an option to the top, Reset restores the defaults', async () => {
    const user = userEvent.setup();
    await openElt(user);
    await user.click(screen.getByRole('button', { name: 'Dropdowns' }));
    const row = screen.getByText('Client').parentElement;
    await user.click(within(row).getByTitle('Set as default'));
    await waitFor(() => expect(ls('elt-dropdowns-v1').responsibility[0]).toBe('Client'));
    // one Reset button per list, in on-screen order: Type, Responsibility, Rectified / Scheduled
    await user.click(screen.getAllByRole('button', { name: 'Reset' })[1]);
    // Reset now asks first: nothing is discarded until the prompt is confirmed, and Keep cancels it
    const prompt = await screen.findByText('Reset list to defaults?');
    expect(ls('elt-dropdowns-v1').responsibility[0]).toBe('Client');
    await user.click(within(prompt.parentElement).getByRole('button', { name: 'Keep' }));
    expect(screen.queryByText('Reset list to defaults?')).not.toBeInTheDocument();
    expect(ls('elt-dropdowns-v1').responsibility[0]).toBe('Client');
    await user.click(screen.getAllByRole('button', { name: 'Reset' })[1]);
    const prompt2 = await screen.findByText('Reset list to defaults?');
    await user.click(within(prompt2.parentElement).getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(ls('elt-dropdowns-v1').responsibility).toEqual(['Site Electrician', 'Site Manager', 'Contractor', 'Client']));
  });

  it('removing an option that is already used by a fitting keeps its value visible and selected', async () => {
    const user = userEvent.setup();
    localStorage.setItem('elt-results-v1', JSON.stringify({ p1:{ a1:{ visual:'fail', discharge:'pass', switching:'pass', charging:'pass', rectified:'Under Investigation' } } }));
    await openElt(user);
    await user.click(screen.getByRole('button', { name: 'Dropdowns' }));
    const row = screen.getByText('Under Investigation').parentElement;
    await user.click(trashIn(row));
    await user.click(within(row).getByRole('button', { name: 'Delete' })); // confirm step
    await waitFor(() => expect(ls('elt-dropdowns-v1').rectified).not.toContain('Under Investigation'));

    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    await user.click(await screen.findByText('SE Door'));
    expect(screen.getByDisplayValue('Under Investigation')).toBeInTheDocument();   // removed from the list but still shown on the fitting that used it
  });

  it("SWB's own Dropdowns tab is unchanged by the shared-view options (still shows ★ DEFAULT and its own lists)", async () => {
    const user = userEvent.setup();
    localStorage.setItem('swb-projects-v1', JSON.stringify([{ id:'s1', name:'Site S', company:'', abn:'', licence:'', areas:[] }]));
    render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD'));
    await user.click(await screen.findByText('Site S', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: 'Dropdowns' }));
    expect(screen.getByText('RECTIFIED / SCHEDULED ACTION')).toBeInTheDocument();
    expect(screen.getByText('RESPONSIBILITY')).toBeInTheDocument();
    expect(screen.getAllByText(/★ DEFAULT/).length).toBe(2);
    expect(screen.getByText(/Tap ★ on any item to make it the default/)).toBeInTheDocument();
    expect(screen.queryByText('FAILURE REASON')).not.toBeInTheDocument();
  });

  it('deleting an option needs the shared confirm step; Keep cancels', async () => {
    const user = userEvent.setup();
    await openElt(user);
    await user.click(screen.getByRole('button', { name: 'Dropdowns' }));
    const row = screen.getByText('Circuit Isolated').parentElement;
    await user.click(trashIn(row));
    expect(screen.getByText('Circuit Isolated')).toBeInTheDocument();  // first tap only asks
    await user.click(within(row).getByRole('button', { name: 'Keep' }));
    expect(screen.getByText('Circuit Isolated')).toBeInTheDocument();
    expect(ls('elt-dropdowns-v1') == null || ls('elt-dropdowns-v1').rectified.includes('Circuit Isolated')).toBe(true);
    await user.click(trashIn(row));
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Circuit Isolated')).not.toBeInTheDocument());
  });

  it("SWB's Dropdowns tab also confirms before deleting an option", async () => {
    const user = userEvent.setup();
    localStorage.setItem('swb-projects-v1', JSON.stringify([{ id:'s1', name:'Site S', company:'', abn:'', licence:'', areas:[] }]));
    render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD'));
    await user.click(await screen.findByText('Site S', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: 'Dropdowns' }));
    const row = screen.getByText('Removed from Service').parentElement;
    await user.click(trashIn(row));
    expect(screen.getByText('Removed from Service')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Keep' }));
    expect(screen.getByText('Removed from Service')).toBeInTheDocument();
    await user.click(trashIn(row));
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Removed from Service')).not.toBeInTheDocument());
    await waitFor(() => expect(JSON.parse(localStorage.getItem('swb-dropdowns-v1')).rectified).not.toContain('Removed from Service'));
  });
});

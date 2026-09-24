// Fail-only panels: retention, stored ★ defaults, field label / placeholder / order, TAT editable dropdowns, Thermo MONITOR.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

const FAIL_HEADING = '⚠ FAIL — DEFECT DETAILS';
const ls = k => JSON.parse(localStorage.getItem(k));
const before = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); // a comes before b in the page

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

async function openSwbFail(user) {
  localStorage.setItem('swb-projects-v1', JSON.stringify([{ id: 's1', name: 'Site S', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] }]));
  localStorage.setItem('swb-meta-v1', JSON.stringify({ s1: { auditor: 'Jane', testDate: '2026-09-21' } }));
  render(<AppRoot />);
  await user.click(screen.getByText('SWITCHBOARD'));
  await user.click(await screen.findByText('Site S', { selector: 'div' }));
  await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ }));
  await user.click(await screen.findByText('Plant'));
  await user.click(await screen.findByText('MSB'));
  await user.click(await screen.findByText('Enclosure Condition'));
  await user.click(screen.getByRole('button', { name: 'FAIL' }));
}

describe('SWB fail panel', () => {
  it('retains defect data when the item is saved as PASS (same as every other module)', async () => {
    const user = userEvent.setup();
    await openSwbFail(user);
    await user.type(screen.getByPlaceholderText('e.g. 74'), '74');
    await user.click(screen.getByRole('button', { name: 'PASS' }));
    expect(screen.queryByText(FAIL_HEADING)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const saved = ls('swb-results-v1').s1.a1.b1.enclosure;
    expect(saved.status).toBe('pass');
    expect(saved.defectId).toBe('74'); // previously cleared to ""
    expect(saved.rectified).toBe('Removed from Service'); // ★ default stored, not just displayed
    expect(saved.responsibility).toBe('Site Electrician');
  });

  it('shows the standard label and placeholder, and the panel sits before the comments box', async () => {
    const user = userEvent.setup();
    await openSwbFail(user);
    expect(screen.getByText('RECTIFIED / SCHEDULED ACTION')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 74')).toBeInTheDocument();
    expect(before(screen.getByText(FAIL_HEADING), screen.getByText('COMMENTS'))).toBe(true);
  });
});

describe('IEL fail panel', () => {
  it('stores the ★ defaults on FAIL and puts the panel before the notes', async () => {
    const user = userEvent.setup();
    localStorage.setItem('iel-projects-v2', JSON.stringify([{ id: 'i1', name: 'Site I', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant Room', panels: [
      { id: 'p1', name: 'estops', circuits: ['x1'], machineNames: { x1: 'Screen 1' } },
      { id: 'p2', name: 'lanyards', circuits: [], machineNames: {} },
      { id: 'p3', name: 'isolators', circuits: [], machineNames: {} }] }] }]));
    localStorage.setItem('iel-meta-v2', JSON.stringify({ i1: { auditor: 'Jane', testDate: '2026-09-21', nextTestDate: '2026-12-21' } }));
    render(<AppRoot />);
    await user.click(screen.getByText('IEL TESTING'));
    await user.click(await screen.findByText('Site I', { selector: 'div' }));
    await user.click(screen.getAllByText('E-Stops')[0]);
    await user.click(await screen.findByText('Plant Room'));
    await user.click(await screen.findByText('E-Stops'));
    await user.click(await screen.findByText('Screen 1'));
    await user.click(screen.getByRole('button', { name: 'FAIL' }));
    expect(await screen.findByText(FAIL_HEADING)).toBeInTheDocument();
    expect(screen.getByText('RECTIFIED / SCHEDULED ACTION')).toBeInTheDocument();
    expect(before(screen.getByText(FAIL_HEADING), screen.getByText('NOTES / COMMENTS'))).toBe(true);
    await waitFor(() => {
      const it = ls('iel-results-v2').i1.a1.estops.x1;
      expect(it.status).toBe('fail');
      expect(it.rectified).toBe('Removed from Service');
      expect(it.responsibility).toBe('Site Electrician');
    });
  });
});

describe('TAT fail panel', () => {
  async function openTatFail(user) {
    localStorage.setItem('tat-projects-v1', JSON.stringify([{ id: 't1', name: 'Site T', company: '', abn: '', licence: '', areas: [
      { id: 'a1', name: 'Workshop', defaultFreq: '3', items: ['i1'], itemNames: { i1: 'Drill' }, itemTags: { i1: '1' }, itemEquipTypes: { i1: 'Power Tool' }, itemFreqs: { i1: '3' } }] }]));
    localStorage.setItem('tat-meta-v1', JSON.stringify({ t1: { auditor: 'Jane', testDate: '2026-09-21' } }));
    render(<AppRoot />);
    await user.click(screen.getByText('TEST & TAG'));
    await user.click(await screen.findByText('Site T', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ }));
    await user.click(await screen.findByText('Workshop'));
    await user.click(await screen.findByText('Drill'));
    await user.click(screen.getByRole('button', { name: 'FAIL' }));
    return await screen.findByText(FAIL_HEADING);
  }

  it('uses editable dropdowns (no native selects) fed by the customisable lists, and stores the defaults', async () => {
    const user = userEvent.setup();
    const heading = await openTatFail(user);
    const panel = heading.parentElement;
    expect(within(panel).queryAllByRole('combobox')).toHaveLength(0); // was two native <select>s
    expect(await within(panel).findByText('Removed from Service')).toBeInTheDocument(); // the default is pre-selected in the editable dropdown
    expect(within(panel).getByText('Site Electrician')).toBeInTheDocument();
    expect(screen.getByText('RECTIFIED / SCHEDULED ACTION')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 74')).toBeInTheDocument();
    expect(before(heading, screen.getByText('NOTES / COMMENTS'))).toBe(true);
    await waitFor(() => {
      const it = ls('tat-results-v1').t1.a1.i1;
      expect(it.status).toBe('fail');
      expect(it.rectified).toBe('Removed from Service');
      expect(it.responsibility).toBe('Site Electrician');
    });
  });

  it('uses a customised list: the first option is the stored default', async () => {
    const user = userEvent.setup();
    localStorage.setItem('tat-dropdowns-v1', JSON.stringify({ responsibility: ['Our Own Team', 'Client'], rectified: ['Bench Repair'] }));
    await openTatFail(user);
    await waitFor(() => {
      const it = ls('tat-results-v1').t1.a1.i1;
      expect(it.responsibility).toBe('Our Own Team');
      expect(it.rectified).toBe('Bench Repair');
    });
  });

  it('has the two lists on the Dropdowns tab', async () => {
    const user = userEvent.setup();
    localStorage.setItem('tat-projects-v1', JSON.stringify([{ id: 't1', name: 'Site T', company: '', abn: '', licence: '', areas: [] }]));
    render(<AppRoot />);
    await user.click(screen.getByText('TEST & TAG'));
    await user.click(await screen.findByText('Site T', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: 'Dropdowns' }));
    expect(await screen.findByText('RESPONSIBILITY')).toBeInTheDocument();
    expect(screen.getByText('RECTIFIED / SCHEDULED')).toBeInTheDocument();
  });
});

describe('Thermo MONITOR', () => {
  it('has its own amber "MONITOR — DETAILS" panel, distinct from FAIL', async () => {
    const user = userEvent.setup();
    localStorage.setItem('thermo-projects-v1', JSON.stringify([{ id: 'h1', name: 'Site H', company: '', abn: '', licence: '', areas: [
      { id: 'a1', name: 'Switchroom', boards: [{ id: 'b1', name: 'MSB1', circuits: ['c1'], circuitNames: { c1: 'CB1' } }] }] }]));
    localStorage.setItem('thermo-meta-v1', JSON.stringify({ h1: { auditor: 'Jane', testDate: '2026-09-21' } }));
    render(<AppRoot />);
    await user.click(screen.getByText('THERMOGRAPHIC'));
    await user.click(await screen.findByText('Site H', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: 'Audit' }));
    await user.click(await screen.findByRole('button', { name: /Continue Audit/ }));
    await user.click(await screen.findByText('Switchroom'));
    await user.click(await screen.findByText('MSB1'));
    await user.click(await screen.findByText('CB1'));

    await user.click(screen.getByRole('button', { name: 'MONITOR' }));
    const mon = await screen.findByText('⚠ MONITOR — DETAILS');
    expect(screen.queryByText(FAIL_HEADING)).not.toBeInTheDocument();
    expect(mon.parentElement.style.background).toBe('rgb(254, 243, 199)'); // amber, not the FAIL red
    expect(mon.style.color).toBe('rgb(146, 64, 14)');

    await user.click(screen.getByRole('button', { name: 'FAIL' }));
    const fail = await screen.findByText(FAIL_HEADING);
    expect(screen.queryByText('⚠ MONITOR — DETAILS')).not.toBeInTheDocument();
    expect(fail.parentElement.style.background).toBe('rgb(254, 226, 226)');
    expect(screen.getByText('RECTIFIED / SCHEDULED ACTION')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 74')).toBeInTheDocument();
    expect(before(fail, screen.getByText(/NOTES \/ RECOMMENDATIONS/))).toBe(true);
  });
});

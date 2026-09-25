// ONE save model for every module: live auto-save. ELT, SWB and IRT item pages have no Save button and no draft — every change is
// written to storage immediately, Back just leaves (no prompt, nothing lost). IRT's status stays "untested" (= auto-detect from the
// readings) until the user overrides it, so it is never frozen by a save.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

const ls = k => JSON.parse(localStorage.getItem(k));
beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
const noSave = () => expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument();
const noPrompt = () => expect(screen.queryByText(/unsaved|discard|are you sure/i)).not.toBeInTheDocument();
const back = user => user.click(screen.getAllByText('Back')[0]); // the header Back (a button in ELT/SWB, a clickable div in IRT)

describe('ELT item page: live auto-save', () => {
  it('no Save button; every tap is stored at once; Back leaves cleanly with nothing lost', async () => {
    localStorage.setItem('elt-projects-v2', JSON.stringify([{ id: 'p1', name: 'Site E', company: '', abn: '', licence: '', areas: [{ id: 'area-e', name: 'Site E', assets: [
      { id: 'a1', assetLocation: 'Door 1', assetId: '', type: 'Emergency Exit Sign', typeOther: '', maintained: '', fitting: '' }] }] }]));
    localStorage.setItem('elt-meta-v1', JSON.stringify({ p1: { auditor: 'Jane', testDate: '2026-07-13' } }));
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('EMERGENCY LIGHTING'));
    await user.click(await screen.findByText('Site E', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    await user.click(await screen.findByText('Door 1'));
    noSave();
    await user.click(screen.getAllByRole('button', { name: 'PASS' })[0]);
    await waitFor(() => expect(ls('elt-results-v1').p1.a1.visual).toBe('pass'));          // stored the moment it is tapped
    await user.click(screen.getAllByRole('button', { name: 'FAIL' })[1]);
    await waitFor(() => expect(ls('elt-results-v1').p1.a1.discharge).toBe('fail'));
    await back(user);                                                                      // straight out — no prompt
    noPrompt();
    expect(await screen.findByText('Door 1')).toBeInTheDocument();                         // back on the Audit list
    expect(ls('elt-results-v1').p1.a1).toMatchObject({ visual: 'pass', discharge: 'fail' });
  });
});

describe('SWB item page: live auto-save (★ defaults included)', () => {
  it('no Save button; status, ★ defaults and defect ID are stored as they change; Back keeps them', async () => {
    localStorage.setItem('swb-projects-v1', JSON.stringify([{ id: 's1', name: 'Site S', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] }]));
    localStorage.setItem('swb-meta-v1', JSON.stringify({ s1: { auditor: 'Jane', testDate: '2026-09-21' } }));
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD'));
    await user.click(await screen.findByText('Site S', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ }));
    await user.click(await screen.findByText('Plant'));
    await user.click(await screen.findByText('MSB'));
    await user.click(await screen.findByText('Enclosure Condition'));
    noSave();
    const item = () => ls('swb-results-v1').s1.a1.b1.enclosure;
    await user.click(screen.getByRole('button', { name: 'FAIL' }));
    await waitFor(() => expect(item().status).toBe('fail'));                               // stored immediately
    await waitFor(() => expect(item()).toMatchObject({ rectified: 'Removed from Service', responsibility: 'Site Electrician' })); // ★ defaults stored live
    await user.type(screen.getByPlaceholderText('e.g. 74'), '74');
    await waitFor(() => expect(item().defectId).toBe('74'));
    await back(user);
    noPrompt();
    await user.click(await screen.findByText('Enclosure Condition'));                      // reopen: everything is still there
    expect(screen.getByDisplayValue('74')).toBeInTheDocument();
    expect(item()).toMatchObject({ status: 'fail', defectId: '74' });
  });
});

describe('IRT item page: live auto-save with auto status that is never frozen', () => {
  const seed = () => localStorage.setItem('irt-projects-v1', JSON.stringify([{ id: 'p1', name: 'IRT Site', company: '', abn: '', licence: '', areas: [{ id: 'area-1', name: 'Plant Room', panels: [{ id: 'panel-1', name: 'DB1', items: ['item-1'], itemNames: { 'item-1': 'Motor 1' } }] }] }]));
  const rec = () => ls('irt-results-v1').p1['area-1']['panel-1']['item-1'];
  const firstReading = () => screen.getAllByText('MΩ')[0].previousElementSibling;
  async function open(user) {
    seed();
    render(<AppRoot />);
    await user.click(await screen.findByText('INSULATION RESISTANCE TESTING'));
    await user.click(await screen.findByText('IRT Site'));
    await user.type(await screen.findByPlaceholderText('Enter name to begin audit…'), 'Jordan');
    await user.click(await screen.findByText(/Start \/ Continue Audit/));
    await user.click(await screen.findByText('Plant Room'));
    await user.click(await screen.findByText('DB1'));
    await user.click(await screen.findByText('Motor 1'));
    await user.click(await screen.findByRole('button', { name: /Understood/ }));
  }

  it('0.5 reads FAIL, then 500 reads PASS — the stored status stays "untested" (auto), never frozen; a manual override sticks', async () => {
    const user = userEvent.setup();
    await open(user);
    noSave();
    await user.type(firstReading(), '0.5');
    await waitFor(() => expect(rec().readings.L1E).toBe('0.5'));                            // stored on every keystroke
    expect(rec().status).toBe('untested');                                                  // NOT frozen to "fail" by saving
    expect(await screen.findByText(/FAIL — DEFECT DETAILS/)).toBeInTheDocument();          // ...but the page (and every reader) sees FAIL
    await waitFor(() => expect(rec()).toMatchObject({ rectified: 'Removed from Service', responsibility: 'Site Electrician' })); // ★ defaults stored live

    await user.clear(firstReading()); await user.type(firstReading(), '500');
    await user.tab();                                                                       // blur formats 500 -> ">200"
    await waitFor(() => expect(rec().readings.L1E).toBe('>200'));
    expect(rec().status).toBe('untested');                                                  // still auto
    await waitFor(() => expect(screen.queryByText(/FAIL — DEFECT DETAILS/)).not.toBeInTheDocument()); // flipped to PASS — the old frozen-FAIL bug is gone

    await back(user);                                                                       // leave: no prompt
    noPrompt();
    await user.click(await screen.findByText('Motor 1'));                                   // reopen, edit again: auto-detect still live
    await user.click(screen.queryByRole('button', { name: /Understood/ }) || document.body);
    await user.clear(firstReading()); await user.type(firstReading(), '0.2');
    expect(await screen.findByText(/FAIL — DEFECT DETAILS/)).toBeInTheDocument();
    // a manual override is stored exactly as set and then wins over the readings
    await user.click(screen.getByRole('button', { name: 'PASS' }));
    await waitFor(() => expect(rec().status).toBe('pass'));
    expect(screen.queryByText(/FAIL — DEFECT DETAILS/)).not.toBeInTheDocument();
  });
});

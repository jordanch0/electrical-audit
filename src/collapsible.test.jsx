// ONE expand / collapse rule for everything that expands (2026-09-26): only one thing expanded at a time, and a click OUTSIDE the expanded element collapses it.
// Covers: DeleteButton, ConfirmReset, CompleteAuditBtn, the Calendar card's delete, the five editable dropdowns' popovers, GSD's area picker, and the six modules'
// Home "Reset" confirms (which used to be home-made and outside the rule).
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { useCollapsible, DeleteButton, ConfirmReset, CompleteAuditBtn, EditableDropdown, IELEditableDropdown, SWBEditableDropdown, ThermoEditableDropdown, IRTEditableDropdown } from './App.jsx';

afterEach(() => cleanup());
beforeEach(() => localStorage.clear());
const bins = () => screen.getAllByRole('button').filter(b => b.textContent === '' && b.querySelector('svg') && !b.getAttribute('aria-label'));

function Harness({ onDelete = () => {}, onReset = () => {}, onComplete = () => {} }) {
  return (
    <div>
      <div data-testid="outside">nothing here</div>
      <DeleteButton onDelete={onDelete} label="Delete A?" />
      <DeleteButton onDelete={() => {}} label="Delete B?" />
      <ConfirmReset onConfirm={onReset} prompt="Reset it?" renderIdle={open => <button onClick={open}>Reset thing</button>} />
      <CompleteAuditBtn color="#0f766e" label="Complete it" onComplete={onComplete} />
    </div>
  );
}

describe('DeleteButton', () => {
  it('a click OUTSIDE collapses it; a click INSIDE it (its own label) does not; nothing is deleted by collapsing', async () => {
    const user = userEvent.setup(); let deleted = 0; render(<Harness onDelete={() => { deleted++; }} />);
    await user.click(bins()[0]); expect(screen.getByText('Delete A?')).toBeInTheDocument();
    await user.click(screen.getByText('Delete A?')); expect(screen.getByText('Delete A?')).toBeInTheDocument();          // inside: stays open
    await user.click(screen.getByTestId('outside')); expect(screen.queryByText('Delete A?')).not.toBeInTheDocument();    // outside: collapsed
    expect(deleted).toBe(0); expect(bins()).toHaveLength(2);                                                            // back to two idle bins
  });
  it('Delete inside still deletes; Keep still collapses', async () => {
    const user = userEvent.setup(); let deleted = 0; render(<Harness onDelete={() => { deleted++; }} />);
    await user.click(bins()[0]); await user.click(screen.getByRole('button', { name: 'Keep' })); expect(screen.queryByText('Delete A?')).not.toBeInTheDocument();
    await user.click(bins()[0]); await user.click(screen.getByRole('button', { name: /Delete$/ })); expect(deleted).toBe(1); expect(screen.queryByText('Delete A?')).not.toBeInTheDocument();
  });
  it('opening a SECOND one collapses the first, and that same click still opens the second (the tap is not lost)', async () => {
    const user = userEvent.setup(); render(<Harness />);
    await user.click(bins()[0]); expect(screen.getByText('Delete A?')).toBeInTheDocument();
    await user.click(bins()[bins().length - 1]);                                                                       // the idle bin of B
    expect(screen.queryByText('Delete A?')).not.toBeInTheDocument(); expect(screen.getByText('Delete B?')).toBeInTheDocument();
  });
});

describe('useCollapsible: one-at-a-time also holds for an open that is NOT a click (state-driven)', () => {
  it('opening B programmatically collapses A even though nothing was clicked', () => {
    const ctl = {};
    function Box({ id }) {
      const [open, setOpen] = React.useState(false); const ref = React.useRef(null); ctl[id] = setOpen;
      useCollapsible(open, () => setOpen(false), ref);
      return <div ref={ref}>{open ? 'open-' + id : 'idle-' + id}</div>;
    }
    render(<div><Box id="A" /><Box id="B" /></div>);
    act(() => ctl.A(true)); expect(screen.getByText('open-A')).toBeInTheDocument();
    act(() => ctl.B(true)); expect(screen.getByText('idle-A')).toBeInTheDocument(); expect(screen.getByText('open-B')).toBeInTheDocument();
  });
});

describe('every kind of confirm shares the one rule', () => {
  it('ConfirmReset and CompleteAuditBtn collapse on an outside click', async () => {
    const user = userEvent.setup(); render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Reset thing' })); expect(screen.getByText('Reset it?')).toBeInTheDocument();
    await user.click(screen.getByText('Reset it?')); expect(screen.getByText('Reset it?')).toBeInTheDocument();          // inside
    await user.click(screen.getByTestId('outside')); expect(screen.queryByText('Reset it?')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Complete it' })); expect(screen.getByText('Archive this audit and reset for next run?')).toBeInTheDocument();
    await user.click(screen.getByTestId('outside')); expect(screen.queryByText('Archive this audit and reset for next run?')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete it' })).toBeInTheDocument();                                    // idle again
  });
  it('opening any one collapses whichever other is open — Delete, Reset and Complete are one family', async () => {
    const user = userEvent.setup(); render(<Harness />);
    await user.click(bins()[0]); await user.click(screen.getByRole('button', { name: 'Reset thing' }));
    expect(screen.queryByText('Delete A?')).not.toBeInTheDocument(); expect(screen.getByText('Reset it?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Complete it' }));
    expect(screen.queryByText('Reset it?')).not.toBeInTheDocument(); expect(screen.getByText('Archive this audit and reset for next run?')).toBeInTheDocument();
    await user.click(bins()[0]);
    expect(screen.queryByText('Archive this audit and reset for next run?')).not.toBeInTheDocument(); expect(screen.getByText('Delete A?')).toBeInTheDocument();
  });
  it('the action buttons inside a confirm still work (Reset runs onReset; Yes, Complete runs onComplete)', async () => {
    const user = userEvent.setup(); let r = 0, k = 0; render(<Harness onReset={() => { r++; }} onComplete={() => { k++; }} />);
    await user.click(screen.getByRole('button', { name: 'Reset thing' })); await user.click(screen.getByRole('button', { name: 'Reset' })); expect(r).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Complete it' })); await user.click(screen.getByRole('button', { name: /Yes, Complete/ })); expect(k).toBe(1);
  });
});

const DROPDOWNS = [['EditableDropdown', EditableDropdown], ['IELEditableDropdown', IELEditableDropdown], ['SWBEditableDropdown', SWBEditableDropdown], ['ThermoEditableDropdown', ThermoEditableDropdown], ['IRTEditableDropdown', IRTEditableDropdown]];
describe.each(DROPDOWNS)('%s popover', (name, Comp) => {
  function Two() {
    const [a, setA] = React.useState(''); const [b, setB] = React.useState('');
    return (<div><div data-testid="outside">outside</div>
      <div data-testid="A"><Comp options={['Alpha', 'Beta']} value={a} onChange={setA} placeholder="Pick A…" /></div>
      <div data-testid="B"><Comp options={['Gamma', 'Delta']} value={b} onChange={setB} placeholder="Pick B…" /></div></div>);
  }
  const trigger = id => within(screen.getByTestId(id)).getAllByRole('button')[0];
  it('opens; a click inside the list does not close it; an outside click does', async () => {
    const user = userEvent.setup(); render(<Two />);
    await user.click(trigger('A')); expect(screen.getByText('Alpha')).toBeInTheDocument();
    await user.click(screen.getByText('Beta'));                                            // choosing an option selects it and closes (existing behaviour)
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    await user.click(trigger('A')); expect(screen.getByText('Alpha')).toBeInTheDocument();
    await user.click(screen.getByTestId('outside')); expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
  });
  it('opening the second closes the first (one popover at a time)', async () => {
    const user = userEvent.setup(); render(<Two />);
    await user.click(trigger('A')); expect(screen.getByText('Alpha')).toBeInTheDocument();
    await user.click(trigger('B')); expect(screen.queryByText('Alpha')).not.toBeInTheDocument(); expect(screen.getByText('Gamma')).toBeInTheDocument();
  });
  it('a popover and a delete confirm are one family: opening either collapses the other', async () => {
    const user = userEvent.setup();
    render(<div><DeleteButton onDelete={() => {}} label="Delete X?" /><Comp options={['Alpha']} value="" onChange={() => {}} placeholder="Pick…" /></div>);
    await user.click(screen.getByText('Pick…')); expect(screen.getByText('Alpha')).toBeInTheDocument();
    await user.click(bins()[0]); expect(screen.queryByText('Alpha')).not.toBeInTheDocument(); expect(screen.getByText('Delete X?')).toBeInTheDocument();
    await user.click(screen.getByText('Pick…')); expect(screen.queryByText('Delete X?')).not.toBeInTheDocument(); expect(screen.getByText('Alpha')).toBeInTheDocument();
  });
});

describe('Calendar card delete', () => {
  it('an outside click collapses it', async () => {
    const iso = d => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
    localStorage.setItem('cal-events-v1', JSON.stringify([{ id: 'e1', type: 'rcd_push', site: 'Site A', dueDate: iso(3), notes: '', seriesId: null }]));
    const user = userEvent.setup(); const { container } = render(<AppRoot />);
    await user.click(screen.getByRole('button', { name: 'Open Test Calendar' }));
    const trash = () => [...container.querySelectorAll('button')].filter(b => b.querySelector('polyline[points="3 6 5 6 21 6"]'));
    await waitFor(() => expect(trash().length).toBe(1)); await user.click(trash()[0]);
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
    await user.click(screen.getByText('Upcoming')); expect(screen.queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument();
  });
});

describe('GSD area picker', () => {
  it('collapses on an outside click; a click inside it does not; the pills still toggle', async () => {
    localStorage.setItem('gsd-projects-v1', JSON.stringify([{ id: 's1', name: 'Site G', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'One' }, { id: 'a2', name: 'Two' }] }]));
    localStorage.setItem('gsd-meta-v1', JSON.stringify({ s1: { auditor: 'J', testDate: '2026-09-21' } }));
    localStorage.setItem('gsd-items-v1', JSON.stringify({ s1: [{ id: 'i1', areaId: 'a1', assetLocation: '', category: '', commonDefect: '', description: 'x', descAuto: '', photos: [], priority: '', responsibility: '', dueDate: '' }] }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('GENERAL SITE DEFECTS')); await user.click(await screen.findByText('Site G', { selector: 'div' })); await user.click(screen.getByRole('button', { name: 'Audit' })); await user.click(await screen.findByTestId('gsd-card'));
    await user.click(screen.getByRole('button', { name: 'Duplicate' })); expect(screen.getByTestId('gsd-area-picker')).toBeInTheDocument();
    await user.click(screen.getByText('Duplicate into which area?')); expect(screen.getByTestId('gsd-area-picker')).toBeInTheDocument();      // inside
    await user.click(screen.getByLabelText('Description')); expect(screen.queryByTestId('gsd-area-picker')).not.toBeInTheDocument();          // outside
    await user.click(screen.getByRole('button', { name: 'Duplicate' })); await user.click(screen.getByRole('button', { name: 'Move' }));      // second thing replaces the first
    expect(screen.getAllByTestId('gsd-area-picker')).toHaveLength(1); expect(screen.getByText('Move to which area?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Move' })); expect(screen.queryByTestId('gsd-area-picker')).not.toBeInTheDocument();  // the pill toggles it shut
  });
});

// ── the six modules' Home "Reset" confirms are now the shared ConfirmReset ──
const site = (id, name) => ({ id, name, company: '', abn: '', licence: '', areas: [] });
const HOMES = [
  { name: 'RCD', card: 'RCD TESTING', key: 'rcd-projects-v6', idle: 'Reset all test results' }, { name: 'IEL', card: 'IEL TESTING', key: 'iel-projects-v2', idle: 'Reset all test results' },
  { name: 'TAT', card: 'TEST & TAG', key: 'tat-projects-v1', idle: 'Reset all test results' }, { name: 'Thermo', card: 'THERMOGRAPHIC', key: 'thermo-projects-v1', idle: 'Reset all photo logs' },
  { name: 'SWB', card: 'SWITCHBOARD', key: 'swb-projects-v1', idle: 'Reset all test results' }, { name: 'IRT', card: 'INSULATION RESISTANCE TESTING', key: 'irt-projects-v1', idle: 'Reset all test results' },
];
describe.each(HOMES)('$name Home reset', ({ card, key, idle }) => {
  it('asks first with the shared Reset / Keep pills; Keep and an outside click both collapse it; Reset runs it', async () => {
    localStorage.setItem(key, JSON.stringify([site('s1', 'Site X')]));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText(card)); await user.click(await screen.findByText('Site X', { selector: 'div' }));
    await user.click(await screen.findByRole('button', { name: idle }));
    const prompt = await screen.findByText(/^Reset all (results|photo logs)\?$/); expect(prompt).toBeInTheDocument();
    expect(within(prompt.parentElement).getByRole('button', { name: 'Reset' })).toBeInTheDocument(); expect(within(prompt.parentElement).getByRole('button', { name: 'Keep' })).toBeInTheDocument();
    await user.click(within(prompt.parentElement).getByRole('button', { name: 'Keep' })); expect(screen.queryByText(/^Reset all (results|photo logs)\?$/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: idle })); expect(await screen.findByText(/^Reset all (results|photo logs)\?$/)).toBeInTheDocument();
    await user.click(document.body.querySelector('nav') || document.body);                       // an outside click
    await waitFor(() => expect(screen.queryByText(/^Reset all (results|photo logs)\?$/)).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: idle })); await user.click(within((await screen.findByText(/^Reset all (results|photo logs)\?$/)).parentElement).getByRole('button', { name: 'Reset' }));
    expect(screen.queryByText(/^Reset all (results|photo logs)\?$/)).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: idle })).toBeInTheDocument();
  });
});

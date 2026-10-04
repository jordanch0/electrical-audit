// BLANK AUDITOR on a module's Home page (RCD, IEL, TAT, Thermo, SWB, IRT): wherever it blocks an action there is a visible message right under the blocked control —
// "Please enter the auditor name to continue or complete the audit." — the blocked controls are visibly disabled AND exposed as disabled, and the moment a name is typed
// the message goes and the controls re-enable (same render). The Complete Audit button (a started site whose auditor was cleared) is disabled too (Jordan's spec D).
// The gate keeps its own line ("Enter the auditor name on Home to continue.") because the name field is on Home, not on the gate. ELT / Welder / GSD are untouched.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { AUDITOR_REQUIRED_MSG } from './App.jsx';
import { GATE_MODS, GATE_SITE_NAMES, seedGateData } from './test/gate-seeds.js';

vi.setConfig({ testTimeout: 30000 });
afterEach(() => cleanup()); beforeEach(() => localStorage.clear());

const MSG = 'Please enter the auditor name to continue or complete the audit.';
const OLD_HINT = /Enter auditor name to (enable testing|begin)/;   // the retired field-level hints
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// every Start / mode / category control on Home, per module
const CONTROLS = { RCD: [/^Push Test/, /^Injection Test/], IEL: [/E-Stops/, /Lanyards/, /Isolators/] };
const controlsOf = m => (CONTROLS[m.short] || [m.start]).map(re => screen.getByRole('button', { name: re }));
const open = async (user, m, id) => { await user.click(screen.getByText(m.tile, { exact: true })); await user.click(await screen.findByText(GATE_SITE_NAMES[id], { selector: 'div' })); };
const notes = () => screen.queryAllByTestId('auditor-required-note');
const nameBox = () => screen.getAllByRole('textbox')[0];

describe('the message itself', () => {
  it('uses the agreed wording and meets the contrast rules; colour is not the only cue', () => {
    expect(AUDITOR_REQUIRED_MSG).toBe(MSG);
    expect(MSG).not.toMatch(/monthly|weekly|annual|yearly|quarterly|interval/i);
    expect(ratio('#b91c1c', '#e8e6e2')).toBeGreaterThanOrEqual(4.5);      // page background
    expect(ratio('#b91c1c', '#f0eeea')).toBeGreaterThanOrEqual(4.5);      // the Complete card
    expect(ratio('#b91c1c', '#f7f6f3')).toBeGreaterThanOrEqual(4.5);      // other cards
  });
});

describe.each(GATE_MODS)('$short — Home with a blank auditor', m => {
  it('never-touched site: the message under the Start / mode / category controls, which are disabled; typing a name removes it and re-enables them', async () => {
    seedGateData(m, 'new'); const user = userEvent.setup(); render(<AppRoot />);
    await open(user, m, 'sc');
    expect(notes()).toHaveLength(1); expect(screen.getByText(MSG)).toBeInTheDocument();            // one blocked group of controls, one message
    expect(document.body.textContent).not.toMatch(OLD_HINT);                                       // the old field-level hint is gone in every module
    expect(screen.getByRole('status')).toHaveTextContent(MSG);                                     // announced to assistive tech
    controlsOf(m).forEach(b => { expect(b).toBeDisabled(); expect(b).toHaveAttribute('aria-disabled', 'true'); });
    expect(screen.queryByText(/Complete (Push|Injection|RCD|IEL|IR|Test|Switchboard|Thermographic)/)).toBeNull();     // no active audit: no Complete card yet
    // the message sits AFTER the controls it explains (right under them), not up at the field
    const last = controlsOf(m).slice(-1)[0];
    expect(last.compareDocumentPosition(notes()[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.type(nameBox(), 'J');                                                               // the FIRST character: both change in the same render
    expect(notes()).toHaveLength(0); expect(screen.queryByText(MSG)).toBeNull();
    controlsOf(m).forEach(b => { expect(b).toBeEnabled(); expect(b).toHaveAttribute('aria-disabled', 'false'); });
    await user.clear(nameBox());                                                                   // clearing brings it straight back
    expect(notes()).toHaveLength(1); controlsOf(m).forEach(b => expect(b).toBeDisabled());
  });

  it('started site whose auditor was cleared: the Complete Audit button is disabled with the message under it, and it comes back when a name is typed', async () => {
    seedGateData(m, 'new'); const user = userEvent.setup(); render(<AppRoot />);
    await open(user, m, 'sa');
    const complete = () => screen.getByRole('button', { name: /^Complete/ });
    expect(complete()).toBeEnabled(); expect(notes()).toHaveLength(0);                             // auditor set: nothing blocked
    await user.clear(nameBox());
    expect(complete()).toBeDisabled(); expect(complete()).toHaveAttribute('aria-disabled', 'true');
    expect(notes()).toHaveLength(2);                                                               // under the Start controls AND under the Complete button
    expect(document.body.textContent).not.toMatch(OLD_HINT);
    const card = screen.getByText('COMPLETE ACTIVE AUDIT').parentElement;
    expect(within(card).getByTestId('auditor-required-note')).toHaveTextContent(MSG);              // the second one is inside the Complete card, right under its button
    await user.click(complete());                                                                  // a disabled button does nothing: no confirm box
    expect(screen.queryByText('Archive this audit and reset for next run?')).toBeNull();
    controlsOf(m).forEach(b => expect(b).toBeDisabled());
    await user.type(nameBox(), 'Jane');
    expect(notes()).toHaveLength(0); expect(complete()).toBeEnabled(); expect(complete()).not.toHaveAttribute('aria-disabled', 'true');
    controlsOf(m).forEach(b => expect(b).toBeEnabled());
    await user.click(complete()); expect(await screen.findByText('Archive this audit and reset for next run?')).toBeInTheDocument();   // and it works again
  });

  it('the gate keeps its own line (the name field is on Home)', async () => {
    seedGateData(m, 'new'); const user = userEvent.setup(); render(<AppRoot />);
    await open(user, m, 'sa'); await user.clear(nameBox()); await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    expect(await screen.findByText('Enter the auditor name on Home to continue.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue Audit/ })).toBeDisabled();
    expect(screen.queryByText(MSG)).toBeNull();                                                    // the Home wording is not on the gate
  });
});

describe('ELT keeps its old hint (the new message is for the six audit modules only)', () => {
  it('shows "⚠ Enter auditor name to enable testing" and no new note', async () => {
    localStorage.setItem('elt-projects-v2', JSON.stringify([{ id: 'p1', name: 'Site E', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Site E', assets: [{ id: 'x1', assetLocation: 'SE Door', assetId: '', type: 'Exit Signs', typeOther: '', maintained: 'Maintained', fitting: '' }] }] }]));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('EMERGENCY LIGHTING')); await user.click(await screen.findByText('Site E', { selector: 'div' }));
    expect(screen.getByText(/Enter auditor name to enable testing/)).toBeInTheDocument(); expect(notes()).toHaveLength(0);
  });
});

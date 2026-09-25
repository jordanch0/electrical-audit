// ELT's fail-only panel is the app-wide standard (RECTIFIED / SCHEDULED ACTION, DEFECT ID, RESPONSIBILITY, PRIORITY, DATE) — the same
// panel Welder has — and the pre-standard data (failReason / action + the retired dropdown lists) is reconciled at READ time.
// Also: IRT's reading boxes look editable (not the page colour), and every module's export keeps its defect headings with zero fails.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { WELDER_CHECKLIST } from './App.jsx';

const ls = k => JSON.parse(localStorage.getItem(k));
const HEADING = '⚠ FAIL — DEFECT DETAILS';
afterEach(() => cleanup());

const eltSite = { id: 'p1', name: 'Site E', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Site E', assets: [
  { id: 'a1', assetLocation: 'SE Door', assetId: '', type: 'Exit Signs', typeOther: '', maintained: 'Maintained', fitting: 'X' }] }] };
const seedElt = (results, dropdowns) => {
  localStorage.clear();
  localStorage.setItem('elt-projects-v2', JSON.stringify([eltSite]));
  localStorage.setItem('elt-meta-v1', JSON.stringify({ p1: { auditor: 'Jane', testDate: '2026-09-21', nextTestDate: '2027-03-21' } }));
  if (results) localStorage.setItem('elt-results-v1', JSON.stringify({ p1: results }));
  if (dropdowns) localStorage.setItem('elt-dropdowns-v1', JSON.stringify(dropdowns));
};
async function openEltFitting(user) {
  render(<AppRoot />);
  await user.click(screen.getByText('EMERGENCY LIGHTING'));
  await user.click(await screen.findByText('Site E', { selector: 'div' }));
  await user.click(screen.getByRole('button', { name: /^Audit$/ }));
  await user.click(await screen.findByText('SE Door'));
}

// Structural description of the panel: styles, then per field its label, control kinds, placeholders and visible text
const describePanel = () => {
  const heading = screen.getByText(HEADING); const panel = heading.parentElement;
  const P = (el, props) => Object.fromEntries(props.map(p => [p, el.style[p]]));
  return {
    panel: P(panel, ['background', 'border', 'borderRadius', 'padding', 'marginBottom']),
    heading: P(heading, ['fontSize', 'fontWeight', 'color', 'letterSpacing', 'marginBottom']),
    fields: [...panel.children].slice(1).map(f => ({
      label: f.querySelector('label').textContent,
      labelStyle: P(f.querySelector('label'), ['fontSize', 'color', 'letterSpacing', 'fontWeight', 'marginBottom']),
      margin: f.style.marginBottom,
      controls: [...f.querySelectorAll('button,input,textarea,select')].map(c => [c.tagName, c.getAttribute('type') || '', c.getAttribute('placeholder') || '', c.tagName === 'BUTTON' ? c.textContent : ''].join('|')),
    })),
    nextIsNotes: !!panel.nextElementSibling.querySelector('textarea'),   // the panel sits BEFORE the notes box
  };
};

describe('ELT fail panel = the Welder / app-wide standard', () => {
  it('identical fields, order, labels, placeholders, priority buttons, styling and position as Welder', async () => {
    const user = userEvent.setup();
    // Welder in FAIL (all 12 answered, one Fail)
    localStorage.clear();
    localStorage.setItem('welder-projects-v2', JSON.stringify([{ id: 'w', name: 'Site W', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Site W', assets: [{ id: 'a1', assetId: 'W001', brand: 'K', model: 'E', serial: '1' }] }] }]));
    localStorage.setItem('welder-meta-v1', JSON.stringify({ w: { auditor: 'Jane', testDate: '2026-09-21' } }));
    const items = Object.fromEntries(WELDER_CHECKLIST.map((c, i) => [c.key, { result: i === 0 ? 'fail' : 'pass' }]));
    localStorage.setItem('welder-results-v1', JSON.stringify({ w: { a1: { items } } }));
    render(<AppRoot />);
    await user.click(screen.getByText('WELDER TESTING'));
    await user.click(await screen.findByText('Site W', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    await user.click(await screen.findByText('W001'));
    const welder = describePanel();
    cleanup();

    seedElt();
    await openEltFitting(user);
    expect(screen.queryByText(HEADING)).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'FAIL' })[0]);
    const elt = describePanel();

    expect(elt.fields.map(f => f.label)).toEqual(['RECTIFIED / SCHEDULED ACTION', 'DEFECT ID', 'RESPONSIBILITY', 'PRIORITY', 'DATE RECTIFIED / SCHEDULED']);
    expect(elt).toEqual(welder);
    expect(elt.fields[1].controls).toEqual(['INPUT|text|e.g. 74|']);
    expect(screen.queryByText('FAILURE REASON')).not.toBeInTheDocument();
    expect(screen.queryByText('ACTION TAKEN')).not.toBeInTheDocument();
  });

  it('★ defaults are STORED when the fitting becomes FAIL, defect fields save live, and the data is retained when it leaves FAIL', async () => {
    const user = userEvent.setup();
    seedElt();
    await openEltFitting(user);
    await user.click(screen.getAllByRole('button', { name: 'FAIL' })[0]);
    await waitFor(() => expect(ls('elt-results-v1').p1.a1).toMatchObject({ rectified: 'Removed from Service', responsibility: 'Site Electrician' }));
    await user.type(screen.getByPlaceholderText('e.g. 74'), '74');
    await user.click(screen.getByRole('button', { name: /^H — / }));
    await waitFor(() => expect(ls('elt-results-v1').p1.a1).toMatchObject({ defectId: '74', priority: 'H' }));
    await user.click(screen.getAllByRole('button', { name: 'PASS' })[0]);
    expect(screen.queryByText(HEADING)).not.toBeInTheDocument();
    await waitFor(() => expect(ls('elt-results-v1').p1.a1.visual).toBe('pass'));
    expect(ls('elt-results-v1').p1.a1).toMatchObject({ defectId: '74', priority: 'H', rectified: 'Removed from Service' });   // retained, hidden
  });
});

describe('ELT pre-standard data is reconciled at read time (nothing lost, nothing folded twice)', () => {
  const legacy = { visual: 'fail', discharge: 'pass', switching: 'pass', charging: 'pass', failReason: 'Lamp Failure', failReasonOther: '', action: 'Given to Site Contact', actionOther: '', notes: 'Behind sign' };
  it('an old FAIL record opens with Rectified = the old Action Taken and the old Failure Reason at the front of Notes; the first write (here the ★ Responsibility default that a FAIL fitting stores on opening) persists the standard shape once', async () => {
    const user = userEvent.setup();
    seedElt({ a1: legacy });
    await openEltFitting(user);
    expect(screen.getByDisplayValue('Given to Site Contact')).toBeInTheDocument();   // not in the standard list, so the editable dropdown shows it as typed text
    const notes = screen.getByPlaceholderText('Observations, comments…');
    expect(notes).toHaveValue('Failure reason: Lamp Failure. Behind sign');
    await user.type(screen.getByPlaceholderText('e.g. 74'), '5');
    await waitFor(() => expect(ls('elt-results-v1').p1.a1.defectId).toBe('5'));
    const saved = ls('elt-results-v1').p1.a1;
    ['failReason', 'failReasonOther', 'action', 'actionOther'].forEach(k => expect(saved).not.toHaveProperty(k));
    expect(saved).toMatchObject({ rectified: 'Given to Site Contact' });
    expect(saved.notes).toBe('Failure reason: Lamp Failure. Behind sign');              // folded once, into storage
    // reopen: not folded a second time
    cleanup(); await openEltFitting(user);
    expect(screen.getByPlaceholderText('Observations, comments…')).toHaveValue('Failure reason: Lamp Failure. Behind sign');
  });

  it('the retired Failure Reason / Action Taken lists are replaced by Responsibility / Rectified on the Dropdowns tab; a customised Action Taken list carries over', async () => {
    const user = userEvent.setup();
    seedElt(null, { types: ['Spitfire', 'Exit Signs'], failReasons: ['Lamp Failure'], actions: ['Given to Site Contact', 'Replaced Unit'] });
    render(<AppRoot />);
    await user.click(screen.getByText('EMERGENCY LIGHTING'));
    await user.click(await screen.findByText('Site E', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: 'Dropdowns' }));
    expect(screen.getByText('RESPONSIBILITY')).toBeInTheDocument();
    expect(screen.getByText('RECTIFIED / SCHEDULED ACTION')).toBeInTheDocument();
    expect(screen.queryByText('FAILURE REASON')).not.toBeInTheDocument();
    expect(screen.queryByText('ACTION TAKEN')).not.toBeInTheDocument();
    expect(screen.getByText('Replaced Unit')).toBeInTheDocument();                       // carried over
    expect(screen.getByText('Site Manager')).toBeInTheDocument();                        // standard responsibility default
    await waitFor(() => expect(ls('elt-dropdowns-v1')).toMatchObject({ rectified: ['Given to Site Contact', 'Replaced Unit'] }));
    expect(ls('elt-dropdowns-v1')).not.toHaveProperty('failReasons');
    expect(ls('elt-dropdowns-v1')).not.toHaveProperty('actions');
  });
});

describe('IRT reading boxes look editable', () => {
  it('a reading input is a raised surface with a visible border — not the page colour — and gets a focus ring', async () => {
    const user = userEvent.setup();
    localStorage.clear();
    localStorage.setItem('irt-projects-v1', JSON.stringify([{ id: 'p1', name: 'IRT Site', company: '', abn: '', licence: '', areas: [{ id: 'area-1', name: 'Plant Room', panels: [{ id: 'panel-1', name: 'DB1', items: ['item-1'], itemNames: { 'item-1': 'Motor 1' } }] }] }]));
    render(<AppRoot />);
    await user.click(await screen.findByText('INSULATION RESISTANCE TESTING'));
    await user.click(await screen.findByText('IRT Site'));
    await user.type(await screen.findByPlaceholderText('Enter name to begin audit…'), 'Jordan');
    await user.click(await screen.findByText(/Start \/ Continue Audit/));
    await user.click(await screen.findByText('Plant Room'));
    await user.click(await screen.findByText('DB1'));
    await user.click(await screen.findByText('Motor 1'));
    await user.click(await screen.findByRole('button', { name: /Understood/ }));
    const input = screen.getAllByText('MΩ')[0].previousElementSibling;
    expect(input.style.background).not.toBe('rgb(232, 230, 226)');                       // the page background (#e8e6e2) — that made it look read-only
    expect(input.style.background).toBe('rgb(247, 246, 243)');                           // the raised surface used by every other editable input
    expect(input.style.border).toContain('rgb(212, 212, 216)');                          // #d4d4d8, the standard input border (visible on both)
    await user.click(input);
    expect(input.style.boxShadow).not.toBe('none');                                     // focus ring
    expect(input.style.boxShadow).not.toBe('');
    await user.type(input, '12'); await user.tab();
    expect(input.style.boxShadow).toBe('none');
    expect(input.style.border).toContain('rgb(147, 197, 253)');                          // filled: blue border as before
  });
});

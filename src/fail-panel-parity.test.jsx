// The fail-only "DEFECT DETAILS" panel must look/behave like the one in SWB (and RCD). This renders the real
// SWB item page and the real ELT fitting page in the FAIL state and compares the panel + heading styling.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

const HEADING = '⚠ FAIL — DEFECT DETAILS';
const pick = (el, props) => Object.fromEntries(props.map(p => [p, el.style[p]]));
const PANEL_PROPS = ['background', 'border', 'borderRadius', 'padding', 'marginBottom'];
const HEADING_PROPS = ['fontSize', 'fontWeight', 'color', 'letterSpacing', 'marginBottom'];
const LABEL_PROPS = ['display', 'fontSize', 'color', 'letterSpacing', 'fontWeight', 'marginBottom'];

function describePanel() {
  const heading = screen.getByText(HEADING);
  const panel = heading.parentElement;
  const label = panel.querySelector('label');
  const fields = [...panel.children].slice(1);
  return {
    panel: pick(panel, PANEL_PROPS),
    heading: pick(heading, HEADING_PROPS),
    label: pick(label, LABEL_PROPS),
    lastFieldMargin: fields[fields.length - 1].style.marginBottom,
  };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('swb-projects-v1', JSON.stringify([{ id:'s1', name:'Site S', company:'', abn:'', licence:'', areas:[{ id:'a1', name:'Plant', boards:[{ id:'b1', name:'MSB' }] }] }]));
  localStorage.setItem('swb-meta-v1', JSON.stringify({ s1:{ auditor:'Jane', testDate:'2026-09-21' } }));
  localStorage.setItem('elt-projects-v1', JSON.stringify([{ id:'p1', name:'Site E', company:'', abn:'', licence:'', assets:[{ id:'a1', location:'Site E', assetLocation:'SE Door', type:'Emergency Exit Sign', maintained:'Maintained', fitting:'X' }] }]));
  localStorage.setItem('elt-meta-v1', JSON.stringify({ p1:{ auditor:'Jane', testDate:'2026-09-21', nextTestDate:'2027-03-21' } }));
});
afterEach(() => cleanup());

describe('fail-only panel matches the SWB reference', () => {
  it('same panel, heading, label and spacing styles as SWB; appears only on FAIL', async () => {
    const user = userEvent.setup();

    render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD'));
    await user.click(await screen.findByText('Site S', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ }));
    await user.click(await screen.findByText('Plant'));
    await user.click(await screen.findByText('MSB'));
    await user.click(await screen.findByText('Enclosure Condition'));
    expect(screen.queryByText(HEADING)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'FAIL' }));
    const swb = describePanel();
    cleanup();

    render(<AppRoot />);
    await user.click(screen.getByText('EMERGENCY LIGHTING'));
    await user.click(await screen.findByText('Site E', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    await user.click(await screen.findByText('SE Door'));
    expect(screen.queryByText(HEADING)).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'FAIL' })[0]);
    const elt = describePanel();

    expect(elt.panel).toEqual(swb.panel);
    expect(elt.heading).toEqual(swb.heading);
    expect(elt.label).toEqual(swb.label);
    expect(elt.lastFieldMargin).toBe(swb.lastFieldMargin); // last field keeps normal field spacing, no override
    expect(elt.panel.marginBottom).toBe('4px');
  });
});

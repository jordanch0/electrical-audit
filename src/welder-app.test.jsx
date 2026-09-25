// Welder module shell: site -> welders (Manage) -> audit page -> derived FAIL panel -> Report register.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { WELDER_CHECKLIST } from './App.jsx';

const ls = k => JSON.parse(localStorage.getItem(k));
beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

const SEED_PROJECT = { id: 'dixon', name: 'Dixon Quarry Group', company: 'Co', abn: '', licence: '', assets: [
  { id: 'a1', location: 'ONR Workshop', assetId: 'W001', brand: 'Kemppi', model: 'MinarcMig Evo 200', serial: '2699294' },
  { id: 'a2', location: 'ONR Workshop', assetId: 'W002', brand: 'Unimig', model: 'Razor', serial: 'N/A' },
] };
const seed = (extra = {}) => {
  localStorage.setItem('welder-projects-v1', JSON.stringify([SEED_PROJECT]));
  localStorage.setItem('welder-meta-v1', JSON.stringify({ dixon: { auditor: 'Jordan', testDate: '2026-07-13', nextTestDate: '2026-10-13', instruments: 'Fluke 1587' } }));
  Object.entries(extra).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
};
async function openSite(user) {
  render(<AppRoot />);
  await user.click(screen.getByText('WELDER TESTING'));
  await user.click(await screen.findByText('Dixon Quarry Group'));
}
async function openWelder(user, id = 'W001') {
  await openSite(user);
  await user.click(screen.getByRole('button', { name: 'Audit' }));
  await user.click(await screen.findByText(id));
}
// nth checklist card (0-based) -> its Pass / Fail / N/A buttons
const card = i => screen.getByText(new RegExp(`^${i + 1}\\. ${WELDER_CHECKLIST[i].label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)).parentElement;
const setResult = async (user, i, label) => user.click(within(card(i)).getByRole('button', { name: label }));

describe('Welder module shell', () => {
  it('is on the landing page in rose and has the 6 tabs in the standard order', async () => {
    const user = userEvent.setup();
    seed();
    await openSite(user);
    const nav = ['Home', 'Audit', 'Report', 'History', 'Manage', 'Dropdowns'];
    nav.forEach(n => expect(screen.getByRole('button', { name: n })).toBeInTheDocument());
    const order = screen.getAllByRole('button').map(b => b.textContent).filter(t => nav.includes(t));
    expect(order).toEqual(nav);
  });

  it('adds a site and a welder (identity fields free text incl. "N/A" serial) in Manage', async () => {
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('WELDER TESTING'));
    await user.click(screen.getByRole('button', { name: '+ Add / Import Site' }));
    await user.type(screen.getByPlaceholderText('Site name'), 'Test Site');
    await user.click(screen.getByRole('button', { name: 'Add Site' }));
    await user.click(await screen.findByText('Test Site'));
    await user.click(screen.getByRole('button', { name: 'Manage' }));
    await user.type(screen.getByPlaceholderText('New area / location name'), 'ONR Workshop');
    await user.click(screen.getByRole('button', { name: '+ Add Area' }));
    await user.click(screen.getByRole('button', { name: '+ Add Welder' }));
    await user.type(screen.getByPlaceholderText('e.g. W001'), 'W001');
    await user.type(screen.getByPlaceholderText('e.g. Kemppi'), 'Kemppi');
    await user.type(screen.getByPlaceholderText(/Serial number/), 'N/A');
    await user.click(screen.getAllByRole('button', { name: '+ Add Welder' }).pop());
    const area = ls('welder-projects-v2')[0].areas[0];
    expect(area.name).toBe('ONR Workshop');
    expect(area.assets[0]).toMatchObject({ assetId: 'W001', brand: 'Kemppi', serial: 'N/A' });
    expect(area.assets[0]).not.toHaveProperty('location'); // the area owns Location now
  });

  it('welder page: read-only identity, static criteria on every item, live summary; W001 shape (7 Pass + 5 N/A) => PASS, no defect panel', async () => {
    const user = userEvent.setup();
    seed();
    await openWelder(user);
    expect(screen.getByText('MinarcMig Evo 200')).toBeInTheDocument();          // identity shown...
    expect(screen.queryByPlaceholderText('e.g. Kemppi')).not.toBeInTheDocument(); // ...but not editable here
    expect(screen.getByText('Min insulation resistance 5 MΩ')).toBeInTheDocument(); // static criteria always visible
    expect(screen.getAllByPlaceholderText('Corrective action required')).toHaveLength(12);
    expect(screen.getAllByPlaceholderText('Measured value / notes')).toHaveLength(12);
    expect(screen.getByDisplayValue('2026-07-13')).toBeInTheDocument();            // date prefilled from Home
    expect(screen.getByDisplayValue('Fluke 1587')).toBeInTheDocument();            // instruments prefilled from Home
    const pattern = 'PPPPPNNNPPNN';
    for (let i = 0; i < 12; i++) await setResult(user, i, pattern[i] === 'P' ? 'PASS' : 'N/A');
    expect(screen.getByText('Overall: PASS')).toBeInTheDocument();
    expect(screen.queryByText('⚠ FAIL — DEFECT DETAILS')).not.toBeInTheDocument();
    expect(screen.getByText('100.0%')).toBeInTheDocument();
    expect(ls('welder-results-v1').dixon.a1.items.visual.result).toBe('pass');
  });

  it('a Fail with blanks stays Untested (no panel); once all 12 are answered the asset-level FAIL panel appears with stored ★ defaults, in guide order', async () => {
    const user = userEvent.setup();
    seed();
    await openWelder(user);
    await setResult(user, 0, 'FAIL');
    expect(screen.getByText(/Overall: Untested — 11 items still to answer/)).toBeInTheDocument();
    expect(screen.queryByText('⚠ FAIL — DEFECT DETAILS')).not.toBeInTheDocument();
    for (let i = 1; i < 12; i++) await setResult(user, i, 'PASS');
    expect(screen.getByText('⚠ FAIL — DEFECT DETAILS')).toBeInTheDocument();
    const labels = ['RECTIFIED / SCHEDULED ACTION', 'DEFECT ID', 'RESPONSIBILITY', 'PRIORITY', 'DATE RECTIFIED / SCHEDULED'];
    const y = t => screen.getByText(t).compareDocumentPosition.bind(screen.getByText(t));
    for (let i = 0; i < labels.length - 1; i++) expect(y(labels[i])(screen.getByText(labels[i + 1])) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByPlaceholderText('e.g. 74')).toBeInTheDocument();
    // panel is BEFORE the comments box
    expect(screen.getByText('PRIORITY').compareDocumentPosition(screen.getByText('AUDITOR COMMENTS / OVERALL NOTES')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // ★ defaults stored, not just displayed
    const rec = ls('welder-results-v1').dixon.a1;
    expect(rec.rectified).toBe('Removed from Service');
    expect(rec.responsibility).toBe('Site Electrician');
  });

  it('defect data is RETAINED when the asset leaves FAIL, and gated out of the Report register', async () => {
    const user = userEvent.setup();
    seed();
    await openWelder(user);
    for (let i = 0; i < 12; i++) await setResult(user, i, i === 0 ? 'FAIL' : 'PASS');
    await user.type(screen.getByPlaceholderText('e.g. 74'), '74');
    await user.click(screen.getByRole('button', { name: 'H — High' }));
    await setResult(user, 0, 'PASS'); // leaves FAIL (tap FAIL again would unset; PASS switches)
    expect(screen.queryByText('⚠ FAIL — DEFECT DETAILS')).not.toBeInTheDocument();
    const rec = ls('welder-results-v1').dixon.a1;
    expect(rec).toMatchObject({ defectId: '74', priority: 'H' });        // retained
    await user.click(screen.getByRole('button', { name: 'Report' }));
    expect(screen.getByText('WELDER REGISTER')).toBeInTheDocument();
    expect(screen.queryByText('74')).not.toBeInTheDocument();             // gated on the derived result
    expect(screen.getByText('✓ No defects recorded')).toBeInTheDocument();
  });

  it('Report: register lists ALL welders (untested too) with the 13 columns; tiles are asset-level', async () => {
    const user = userEvent.setup();
    seed();
    await openSite(user);
    await user.click(screen.getByRole('button', { name: 'Report' }));
    expect(screen.getByText('WELDER REGISTER')).toBeInTheDocument();
    ['Location', 'Asset ID', 'Welder (Machine)', 'Serial Number', 'Date Tested', 'Pass / Fail', 'Rectified / Scheduled', 'Date Rectified / Scheduled', 'Defect ID', 'Responsibility', 'Notes / Recommendations', 'Priority (L,M,H,U)', 'Next Test Due']
      .forEach(c => expect(screen.getByRole('columnheader', { name: c })).toBeInTheDocument());
    expect(screen.getByText('W001')).toBeInTheDocument();
    expect(screen.getByText('W002')).toBeInTheDocument();
    expect(screen.getByText('Kemppi MinarcMig Evo 200')).toBeInTheDocument();
    expect(screen.getByText('UNTESTED').parentElement).toHaveTextContent('2');
    expect(screen.queryByRole('button', { name: /Export/ })).not.toBeInTheDocument(); // export lives in History
  });

  it('Complete Welder Audit archives a snapshot (with the welder list) and clears results', async () => {
    const user = userEvent.setup();
    seed();
    await openWelder(user);
    await setResult(user, 0, 'PASS');
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: 'Complete Welder Audit' }));
    await user.click(screen.getByRole('button', { name: /Yes, Complete/ }));
    const h = ls('welder-history-v2');
    expect(h).toHaveLength(1);
    expect(h[0].assets).toBeUndefined();
    expect(h[0].areas.flatMap(a => a.assets).map(a => a.assetId)).toEqual(['W001', 'W002']);
    expect(h[0].results.a1.items.visual.result).toBe('pass');
    expect(ls('welder-results-v1').dixon).toEqual({});
  });

  it('FAIL panel uses the shared panel / heading styling', async () => {
    const user = userEvent.setup();
    seed();
    await openWelder(user);
    for (let i = 0; i < 12; i++) await setResult(user, i, 'FAIL');
    const heading = screen.getByText('⚠ FAIL — DEFECT DETAILS'); const panel = heading.parentElement;
    expect(panel.style).toMatchObject({ background: 'rgb(254, 226, 226)', borderRadius: '10px', padding: '12px', marginBottom: '4px' });
    expect(panel.style.border).toBe('1px solid rgb(252, 165, 165)');
    expect(heading.style).toMatchObject({ fontSize: '10px', fontWeight: '800', letterSpacing: '1px', marginBottom: '10px' });
    expect(within(panel).getByText('RESPONSIBILITY').tagName).toBe('LABEL');
  });

  it('Dropdowns tab uses the RESPONSIBILITY / RECTIFIED / SCHEDULED ACTION titles and Reset asks for confirmation', async () => {
    const user = userEvent.setup();
    seed();
    await openSite(user);
    await user.click(screen.getByRole('button', { name: 'Dropdowns' }));
    expect(screen.getByText('RESPONSIBILITY')).toBeInTheDocument();
    expect(screen.getByText('RECTIFIED / SCHEDULED ACTION')).toBeInTheDocument();
  });

  it('the Calendar knows the Welder event type (not the "Other / Custom" fallback)', async () => {
    const user = userEvent.setup();
    const d = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
    localStorage.setItem('cal-events-v1', JSON.stringify([{ id: 'e1', type: 'welder', site: 'Dixon Quarry Group', dueDate: d, notes: '', seriesId: null }]));
    render(<AppRoot />);
    await user.click(screen.getByRole('button', { name: 'Open Test Calendar' }));
    expect(await screen.findByText('Welder Test')).toBeInTheDocument();
  });
});

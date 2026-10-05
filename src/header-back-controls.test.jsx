// HEADER BACK CONTROLS (2026-10-05): the ONLY back control on a screen is the standard Back pill at the top left of the header, in line with the Modules pill at the top right.
// No duplicate body Back buttons, no hidden back controls (tap-outside), and a screen reached directly from the Modules screen (Test Calendar, Global Settings) has no Back at all
// — only the Modules pill. Modelled on gsd.test.jsx ("the item page has ONE Back"). FICTIONAL data.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

vi.setConfig({ testTimeout: 30000 });
afterEach(() => cleanup()); beforeEach(() => localStorage.clear());

const DATE = '2026-10-01';
const site = (areas) => [{ id: 's1', name: 'Site One', company: '', abn: '', licence: '', areas }];
const openSite = async (user, tile) => { await user.click(screen.getByText(tile, { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' })); };
const seedRcd = () => {
  localStorage.setItem('rcd-projects-v6', JSON.stringify(site([{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'p1', name: 'MSB 1', circuits: ['CB 1', 'CB 2'] }] }])));
  localStorage.setItem('rcd-meta-v6', JSON.stringify({ s1: { auditor: 'Jane', pushDate: DATE, injectDate: DATE, notes: '' } }));
};
const openRcdItem = async user => {
  seedRcd(); render(<AppRoot />); await openSite(user, 'RCD TESTING');
  await user.click(screen.getByRole('button', { name: /^Injection Test/ }));                       // an active audit, so Audit opens the folders
  await user.click(await screen.findByText('Wash Plant')); await user.click(await screen.findByText('MSB 1')); await user.click(await screen.findByText('CB 1'));
  return await screen.findByText(/MSB 1\s*·\s*CB 1/);                                                // the item page's title
};

describe('RCD item page: no hidden back control (tap-outside is gone)', () => {
  it('clicking the empty area around an open item does NOT close it; the header Back closes it in one tap', async () => {
    const user = userEvent.setup(); const title = await openRcdItem(user);
    let wrapper = title; while (wrapper && !(wrapper.style && wrapper.style.overflowY === 'auto' && wrapper.style.padding === '16px')) wrapper = wrapper.parentElement;
    expect(wrapper).toBeTruthy();                                                                    // the item page's own full-page wrapper = the empty area around the card
    await user.click(wrapper);
    expect(screen.getByText(/MSB 1\s*·\s*CB 1/)).toBeInTheDocument();                                // still open
    await user.click(screen.getAllByText('Back')[0]);                                                // the header Back, one tap
    expect(screen.queryByText(/MSB 1\s*·\s*CB 1/)).toBeNull();
    expect(await screen.findByText('CB 2')).toBeInTheDocument();                                     // back on the circuit list
  });
});

// ── every changed screen: exactly ONE back control (the header pill) and exactly ONE Modules pill ─────────────────────────────────────────────────────
const BACKS = () => screen.queryAllByText(/^\s*(←\s*)?Back\s*$/);                                    // the pill's label, or any body "Back" / "← Back" button
const START = /Start \/ Continue Audit/;
const put = (p, m, areas) => { localStorage.setItem(p, JSON.stringify(site(areas))); localStorage.setItem(m, JSON.stringify({ s1: { auditor: 'Jane', testDate: DATE, pushDate: DATE, injectDate: DATE, notes: '' } })); };
const drill = async (u, names) => { for (const t of names) await u.click(await screen.findByText(t)); };
// (IRT shows its danger notice first; the item page proper is behind "Understood — Proceed to Test Entry")
const SCREENS = [
  { name: 'RCD item page', badge: true, go: async u => { put('rcd-projects-v6', 'rcd-meta-v6', [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'p1', name: 'MSB 1', circuits: ['CB 1', 'CB 2'] }] }]); render(<AppRoot />); await openSite(u, 'RCD TESTING'); await u.click(screen.getByRole('button', { name: /^Injection Test/ })); await drill(u, ['Wash Plant', 'MSB 1', 'CB 1']); await screen.findByText(/MSB 1\s*·\s*CB 1/); } },
  { name: 'IEL item page', badge: true, go: async u => { put('iel-projects-v2', 'iel-meta-v2', [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'e1', name: 'estops', circuits: ['x1', 'x2'], machineNames: { x1: 'Feed Conveyor 1', x2: 'Feed Conveyor 2' } }] }]); render(<AppRoot />); await openSite(u, 'IEL TESTING'); await u.click(screen.getByRole('button', { name: /E-Stops/ })); await drill(u, ['Wash Plant', 'E-Stops', 'Feed Conveyor 1']); await screen.findByText(/E-Stops\s*·\s*Wash Plant/); } },
  { name: 'TAT item page', badge: true, go: async u => { put('tat-projects-v1', 'tat-meta-v1', [{ id: 'a1', name: 'Workshop', defaultFreq: '3', items: ['i1', 'i2'], itemNames: { i1: 'Angle Grinder 9"', i2: 'Drill' }, itemTags: {}, itemEquipTypes: {}, itemFreqs: {} }]); render(<AppRoot />); await openSite(u, 'TEST & TAG'); await u.click(screen.getByRole('button', { name: START })); await drill(u, ['Workshop', 'Angle Grinder 9"']); await screen.findByText(/Workshop\s*·\s*Test & Tag/); } },
  { name: 'SWB board checklist', go: async u => { put('swb-projects-v1', 'swb-meta-v1', [{ id: 'a1', name: 'Wash Plant', boards: [{ id: 'b1', name: 'MSB 1' }] }]); render(<AppRoot />); await openSite(u, 'SWITCHBOARD'); await u.click(screen.getByRole('button', { name: START })); await drill(u, ['Wash Plant', 'MSB 1']); await screen.findByText('Enclosure Condition'); } },
  { name: 'SWB item page', badge: true, go: async u => { put('swb-projects-v1', 'swb-meta-v1', [{ id: 'a1', name: 'Wash Plant', boards: [{ id: 'b1', name: 'MSB 1' }] }]); render(<AppRoot />); await openSite(u, 'SWITCHBOARD'); await u.click(screen.getByRole('button', { name: START })); await drill(u, ['Wash Plant', 'MSB 1', 'Enclosure Condition']); await screen.findByText('RESULT'); } },
  { name: 'IRT item page', badge: true, go: async u => { put('irt-projects-v1', 'irt-meta-v1', [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'p1', name: 'MSB 1', items: ['m1', 'm2'] }] }]); render(<AppRoot />); await openSite(u, 'INSULATION RESISTANCE TESTING'); await u.click(screen.getByRole('button', { name: START })); await drill(u, ['Wash Plant', 'MSB 1', 'm1', 'Understood — Proceed to Test Entry']); await screen.findByText('COMMENTS'); } },
  { name: 'ELT asset page', badge: true, go: async u => { put('elt-projects-v2', 'elt-meta-v1', [{ id: 'ar', name: 'Plant Room', assets: [{ id: 'x1', assetLocation: 'Plant Room Door', assetId: 'E1', type: 'Exit Signs', typeOther: '', maintained: 'Maintained', fitting: '' }] }]); render(<AppRoot />); await openSite(u, 'EMERGENCY LIGHTING'); await u.click(screen.getByRole('button', { name: /Start \/ Continue Testing/ })); await drill(u, ['Plant Room Door']); await screen.findByText('Plant Room Door', { selector: 'div' }); } },
  { name: 'Welder asset page', badge: true, go: async u => { put('welder-projects-v2', 'welder-meta-v1', [{ id: 'ar', name: 'Workshop', assets: [{ id: 'a1', assetId: 'W1', brand: 'Kemppi', model: 'Mig 300', serial: '1234' }] }]); render(<AppRoot />); await openSite(u, 'WELDER TESTING'); await u.click(screen.getByRole('button', { name: START })); await drill(u, ['W1']); await screen.findByText('Welder Inspection & Audit Checklist'); } },
];
describe.each(SCREENS)('$name: header only', s => {
  it('exactly one back control (the header pill) and exactly one Modules pill; Modules goes to the Modules screen', async () => {
    const user = userEvent.setup(); await s.go(user);
    expect(BACKS()).toHaveLength(1); expect(screen.getAllByText('Modules')).toHaveLength(1);
    await user.click(screen.getByText('Modules'));
    expect(await screen.findByTestId('settings-pill')).toBeInTheDocument();
  });
  if (s.badge) it('no bare "—" badge: the item-header badge spells UNTESTED (a "—" left on the page is only the RESULT row reset button)', async () => {
    const user = userEvent.setup(); await s.go(user);
    const badges = screen.getAllByText('UNTESTED'); expect(badges.length).toBeGreaterThanOrEqual(1);
    expect(badges.some(b => !b.closest('button'))).toBe(true);                                       // a read-only badge (not a control) says UNTESTED
    screen.queryAllByText('—').forEach(e => expect(!e.closest('button') && e.style.fontWeight === '800').toBe(false));   // no bold badge-style dash that is not a control (a plain read-only "—" value is fine)
  });
});

describe('site lists: no Back, one Modules pill (reached directly from the Modules screen)', () => {
  it.each(['RCD TESTING', 'IEL TESTING', 'TEST & TAG', 'THERMOGRAPHIC', 'SWITCHBOARD', 'INSULATION RESISTANCE TESTING', 'EMERGENCY LIGHTING', 'WELDER TESTING', 'GENERAL SITE DEFECTS'])('%s', async tile => {
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText(tile, { exact: true }));
    expect(await screen.findByText('Modules')).toBeInTheDocument();                                   // the site list is up (its header has the pill)
    expect(BACKS()).toHaveLength(0); expect(screen.getAllByText('Modules')).toHaveLength(1);
  });
});

// ── the two screens reached only from the Modules screen: Modules pill, NO Back ─────────────────────────────────────────────────────────────────────────
describe('Test Calendar and Global Settings: only the Modules pill', () => {
  it('Test Calendar (Upcoming, Calendar, Add Event): no top-left Modules link, no Back, exactly one Modules pill; it returns to the Modules screen', async () => {
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByTestId('calendar-pill'));
    expect(await screen.findByText('Upcoming')).toBeInTheDocument();
    for (const tab of [null, /^Calendar$/, /^Add Event$/]) {
      if (tab) await user.click(screen.getByRole('button', { name: tab }));
      expect(screen.getAllByText('Modules')).toHaveLength(1); expect(BACKS()).toHaveLength(0);
      expect(screen.getByText('Modules').tagName).toBe('SPAN');                                      // the pill's label span, not the old chevron + text link
      expect(screen.getByText('Modules').parentElement.style.borderRadius).toBe('10px');
    }
    await user.click(screen.getByText('Modules'));
    expect(await screen.findByTestId('settings-pill')).toBeInTheDocument();
  });
  it('Global Settings: the Modules pill and no Back; the pill returns to the Modules screen', async () => {
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByTestId('settings-pill'));
    expect(await screen.findByText('Global Settings')).toBeInTheDocument();
    expect(BACKS()).toHaveLength(0); expect(screen.getAllByText('Modules')).toHaveLength(1);
    expect(screen.getByText('Modules').parentElement.style.borderRadius).toBe('10px');
    await user.click(screen.getByText('Modules'));
    expect(await screen.findByTestId('calendar-pill')).toBeInTheDocument();
  });
});

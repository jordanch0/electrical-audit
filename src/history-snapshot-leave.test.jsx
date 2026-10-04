// A viewed History snapshot must not outlive History (2026-10-05). ELT / Welder / GSD already cleared it whenever you left History; RCD / IEL / TAT / SWB 
// kept it, so after View Results -> Audit tab -> an open item, the header Back first cleared the invisible snapshot and the item stayed open until a SECOND tap.
// Two guarantees, every module in MODULES (FICTIONAL data):
//   1. View Results in History, then the Audit tab, open an area / folder, open an item: ONE header Back closes the item.
//   2. View Results, leave History (Report tab), come back: the History LIST shows, not the snapshot.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

vi.setConfig({ testTimeout: 30000 });
afterEach(() => cleanup()); beforeEach(() => localStorage.clear());

const DATE = '2026-10-01';
const SNAP = { id: 'h1', projectId: 's1', projectName: 'Site One', testDate: '2026-09-01', auditor: 'Jane', archivedAt: '2026-09-01T00:00:00Z', results: {}, meta: { auditor: 'Jane', testDate: '2026-09-01' } };
// drill = the taps from the top of Audit down to the item; item = the last tap; gridText = something only the list level shows; isItem = true while the item page is up
export const MODULES = [
  { tile: 'RCD TESTING', p: 'rcd-projects-v6', m: 'rcd-meta-v6', h: 'rcd-history-v6', start: /^Injection Test/, snap: { mode: 'inject', label: 'Injection Test' },
    areas: [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'p1', name: 'MSB 1', circuits: ['CB 1', 'CB 2'] }] }], drill: ['Wash Plant', 'MSB 1'], item: 'CB 1', gridText: 'CB 2', isItem: () => !!screen.queryByText(/MSB 1\s*·\s*CB 1/) },
  { tile: 'IEL TESTING', p: 'iel-projects-v2', m: 'iel-meta-v2', h: 'iel-history-v2', start: /E-Stops/, snap: { cat: 'estops' },
    areas: [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'e1', name: 'estops', circuits: ['x1', 'x2'], machineNames: { x1: 'Feed Conveyor 1', x2: 'Feed Conveyor 2' } }] }], drill: ['Wash Plant', 'E-Stops'], item: 'Feed Conveyor 1', gridText: 'Feed Conveyor 2', isItem: () => !screen.queryByText('Feed Conveyor 2') },
  { tile: 'TEST & TAG', p: 'tat-projects-v1', m: 'tat-meta-v1', h: 'tat-history-v1', start: /Start \/ Continue Audit/, snap: {},
    areas: [{ id: 'a1', name: 'Workshop', defaultFreq: '3', items: ['i1', 'i2'], itemNames: { i1: 'Angle grinder', i2: 'Drill' }, itemTags: {}, itemEquipTypes: {}, itemFreqs: {} }], drill: ['Workshop'], item: 'Angle grinder', gridText: 'Drill', isItem: () => !screen.queryByText('Drill') },
  { tile: 'SWITCHBOARD', p: 'swb-projects-v1', m: 'swb-meta-v1', h: 'swb-history-v1', start: /Start \/ Continue Audit/, snap: {},
    areas: [{ id: 'a1', name: 'Wash Plant', boards: [{ id: 'b1', name: 'MSB 1' }] }], drill: ['Wash Plant', 'MSB 1'], item: 'Enclosure Condition', gridText: 'Ventilation', isItem: () => !!screen.queryByText('RESULT') },
  { tile: 'THERMOGRAPHIC', p: 'thermo-projects-v1', m: 'thermo-meta-v1', h: 'thermo-history-v1', start: /Start \/ Continue Audit/, snap: {},
    areas: [{ id: 'a1', name: 'Wash Plant', boards: [{ id: 'b1', name: 'MSB 1', circuits: ['c1', 'c2'], circuitNames: { c1: 'Main incomer', c2: 'Feed Conveyor 1' } }] }], drill: ['Wash Plant', 'MSB 1'], item: 'Main incomer', gridText: 'Feed Conveyor 1', isItem: () => !screen.queryByText('Feed Conveyor 1') },
  { tile: 'INSULATION RESISTANCE TESTING', p: 'irt-projects-v1', m: 'irt-meta-v1', h: 'irt-history-v1', start: /Start \/ Continue Audit/, snap: {},
    areas: [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'p1', name: 'MSB 1', items: ['m1', 'm2'] }] }], drill: ['Wash Plant', 'MSB 1'], item: 'm1', gridText: 'm2', isItem: () => !screen.queryByText('m2') },
];

async function toItem(user, m) {
  localStorage.setItem(m.p, JSON.stringify([{ id: 's1', name: 'Site One', company: '', abn: '', licence: '', areas: m.areas }]));
  localStorage.setItem(m.m, JSON.stringify({ s1: { auditor: 'Jane', testDate: DATE } }));
  localStorage.setItem(m.h, JSON.stringify([{ ...SNAP, ...m.snap }]));
  render(<AppRoot />);
  await user.click(screen.getByText(m.tile, { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' }));
  await user.click(screen.getByRole('button', { name: m.start }));                                   // an active audit, so the Audit tab opens the folders, not the gate
}
const tab = (user, name) => user.click(screen.getByRole('button', { name: new RegExp(`^${name}$`) }));
const viewSnapshot = async user => { await tab(user, 'History'); await user.click(await screen.findByText(/Jane/)); await user.click(await screen.findByRole('button', { name: /^\s*View( Results)?\s*$/ })); };

describe.each(MODULES)('$tile — a viewed History snapshot is dropped when you leave History', m => {
  it('View Results, Audit tab, open an item: ONE header Back closes the item', async () => {
    const user = userEvent.setup(); await toItem(user, m); await viewSnapshot(user);
    await tab(user, 'Audit');
    for (const t of m.drill) await user.click(await screen.findByText(t));
    expect(await screen.findByText(m.gridText)).toBeInTheDocument();
    await user.click(screen.getByText(m.item));
    expect(m.isItem()).toBe(true);
    await user.click(screen.getAllByText('Back')[0]);                                               // the header Back (one tap)
    expect(await screen.findByText(m.gridText)).toBeInTheDocument();
    expect(m.isItem()).toBe(false);
  });
  it('View Results, leave History, come back: the History list shows (not the snapshot)', async () => {
    const user = userEvent.setup(); await toItem(user, m); await viewSnapshot(user);
    expect(screen.queryByRole('button', { name: /^\s*View( Results)?\s*$/ })).toBeNull();                      // the snapshot is open
    await tab(user, 'Report'); await tab(user, 'History');
    await user.click(screen.getByText(/Jane/));
    expect(await screen.findByRole('button', { name: /^\s*View( Results)?\s*$/ })).toBeInTheDocument();         // the card list, ready to open again
  });
});

// Report tab standardisation: every module uses the shared stat tiles + "Failed Items" list (SWB/IRT design),
// the same "✓ No defects recorded" empty state, and no Export button on the Report tab (export lives in History).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

const S = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const base = (id, name) => ({ id, name, company: '', abn: '', licence: '' });
const meta = id => ({ [id]: { auditor: 'Jane', testDate: '2026-09-21', nextTestDate: '2027-09-21' } });
const DEFECT = { defectId: '74', rectified: 'Removed from Service', responsibility: 'Site Electrician', priority: 'H' };

async function openReport(user, card, site) {
  render(<AppRoot />);
  await user.click(screen.getByText(card));
  await user.click(await screen.findByText(site, { selector: 'div' }));
  await user.click(screen.getByRole('button', { name: 'Report' }));
}
const failedHeadings = () => screen.getAllByText('Failed Items');

const SEEDS = {
  RCD: { card: 'RCD TESTING', site: 'Site R', seed: () => {
    S('rcd-projects-v6', [{ ...base('r', 'Site R'), areas: [{ id: 'a', name: 'Area', panels: [{ id: 'p', name: 'MSB1', circuits: ['CB1'], circuitMeta: {} }] }] }]);
    S('rcd-meta-v6', { r: { auditor: 'Jane', pushDate: '2026-09-21', injectDate: '2026-09-21', notes: '', nextPushDate: '', nextInjectDate: '' } });
    S('rcd-results-v6', { r: { a: { p: { CB1: { push: { status: 'pass' }, inject: { status: 'fail', resultPos: '>300', ...DEFECT } } } } } });
  } },
  IEL: { card: 'IEL TESTING', site: 'Site I', seed: () => {
    S('iel-projects-v2', [{ ...base('i', 'Site I'), areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'p1', name: 'estops', circuits: ['x'], machineNames: { x: 'Screen 1' } }, { id: 'p2', name: 'lanyards', circuits: [], machineNames: {} }, { id: 'p3', name: 'isolators', circuits: [], machineNames: {} }] }] }]);
    S('iel-meta-v2', meta('i'));
    S('iel-results-v2', { i: { a: { estops: { x: { status: 'fail', ...DEFECT, notes: 'Sticks' } } } } });
  } },
  TAT: { card: 'TEST & TAG', site: 'Site T', seed: () => {
    S('tat-projects-v1', [{ ...base('t', 'Site T'), areas: [{ id: 'a', name: 'Workshop', defaultFreq: '3', items: ['x'], itemNames: { x: 'Grinder' }, itemTags: { x: '2' }, itemEquipTypes: { x: 'Power Tool' }, itemFreqs: { x: '3' } }] }]);
    S('tat-meta-v1', meta('t'));
    S('tat-results-v1', { t: { a: { x: { status: 'fail', ...DEFECT, notes: 'Frayed lead' } } } });
  } },
  SWB: { card: 'SWITCHBOARD', site: 'Site S', seed: () => {
    S('swb-projects-v1', [{ ...base('s', 'Site S'), areas: [{ id: 'a', name: 'Plant', boards: [{ id: 'b', name: 'MSB' }] }] }]);
    S('swb-meta-v1', meta('s'));
    S('swb-results-v1', { s: { a: { b: { ventilation: { status: 'fail', ...DEFECT, risk: 'H', comment: 'Blocked' } } } } });
  } },
  IRT: { card: 'INSULATION RESISTANCE TESTING', site: 'Site N', seed: () => {
    S('irt-projects-v1', [{ ...base('n', 'Site N'), areas: [{ id: 'a', name: 'Pump House', panels: [{ id: 'p', name: 'MCC1', items: ['x'], itemNames: { x: 'Motor 2' } }] }] }]);
    S('irt-meta-v1', meta('n'));
    S('irt-results-v1', { n: { a: { p: { x: { status: 'fail', testVoltage: '500V', readings: { L1E: '<1' }, notes: 'Low IR', ...DEFECT } } } } });
  } },
  Thermo: { card: 'THERMOGRAPHIC', site: 'Site H', seed: () => {
    S('thermo-projects-v1', [{ ...base('h', 'Site H'), areas: [{ id: 'a', name: 'Switchroom', boards: [{ id: 'b', name: 'MSB1', circuits: ['c'], circuitNames: { c: 'CB1' } }] }] }]);
    S('thermo-meta-v1', meta('h'));
    S('thermo-results-v1', { h: { a: { b: { c: [
      { id: 'p1', flirFile: '0172', temp: '88', result: 'FAIL', notes: 'Hot lug', ...DEFECT },
      { id: 'p2', flirFile: '0173', temp: '60', result: 'MONITOR', priority: '', notes: '', rectified: '', defectId: '', responsibility: '' }] } } } });
  } },
  ELT: { card: 'EMERGENCY LIGHTING', site: 'Site E', seed: () => {
    S('elt-projects-v1', [{ ...base('e', 'Site E'), assets: [
      { id: 'a1', location: 'Site E', assetLocation: 'se', type: 'Emergency Exit Sign', maintained: 'Maintained', fitting: 'X' },
      { id: 'a2', location: 'Site E', assetLocation: 'sw', type: 'Emergency Exit Sign', maintained: 'Maintained', fitting: 'Y' }] }]);
    S('elt-meta-v1', meta('e'));
    S('elt-results-v1', { e: {
      a1: { visual: 'pass', discharge: 'pass', switching: 'pass', charging: 'pass' },
      a2: { visual: 'pass', discharge: 'fail', switching: 'pass', charging: 'pass', failReason: 'Lamp Failure', action: 'Given to Site Contact', notes: 'Lamp dead' } } });
  } },
};

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe.each(Object.entries(SEEDS))('%s Report tab', (name, { card, site, seed }) => {
  it('has the standard title, date pill, five stat tiles and a "Failed Items" list', async () => {
    const user = userEvent.setup();
    seed();
    await openReport(user, card, site);
    await screen.findAllByText('Failed Items');
    // the site name also appears in the page header; the report title is the 22px / 900 one
    const bigTitle = screen.getAllByText(site).find(el => el.style.fontSize === '22px');
    expect(bigTitle).toBeTruthy();
    expect(bigTitle.style.fontWeight).toBe('900');
    expect(bigTitle.style.letterSpacing).toBe('1.5px');
    // date pill: "Tested: … → next due: …" (RCD has one per test: "Push: … → next …")
    expect(screen.getAllByText(name === 'RCD' ? /Push:/ : /Tested:/).length).toBeGreaterThan(0);
    for (const l of ['TOTAL', 'PASS', 'FAIL']) expect(screen.getAllByText(l).length).toBeGreaterThan(0);
    expect(failedHeadings()).toHaveLength(1);
    expect(screen.queryByText(/Failed Circuits|Issues Requiring Attention/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Export xlsx/)).not.toBeInTheDocument();
  });
});

describe('Failed Items shows Defect ID / Responsibility / Rectified consistently', () => {
  it.each(['RCD', 'IEL', 'TAT', 'SWB', 'IRT', 'Thermo'])('%s', async name => {
    const user = userEvent.setup();
    const { card, site, seed } = SEEDS[name];
    seed();
    await openReport(user, card, site);
    expect(await screen.findByText('Failed Items')).toBeInTheDocument();
    expect(screen.getByText('74', { exact: false })).toBeInTheDocument(); // "Defect ID: 74" (RCD: injection defect id)
    expect(screen.getByText(/Site Electrician/)).toBeInTheDocument();
    expect(screen.getByText('Removed from Service')).toBeInTheDocument();
  });
});

describe('empty states and module-specific report details', () => {
  it('RCD and ELT show "✓ No defects recorded" when nothing failed (RCD used to show nothing)', async () => {
    const user = userEvent.setup();
    SEEDS.RCD.seed(); S('rcd-results-v6', {});
    await openReport(user, SEEDS.RCD.card, SEEDS.RCD.site);
    expect(await screen.findByText('✓ No defects recorded')).toBeInTheDocument();
    cleanup(); localStorage.clear();
    SEEDS.ELT.seed(); S('elt-results-v1', {});
    await openReport(user, SEEDS.ELT.card, SEEDS.ELT.site);
    expect(await screen.findByText('✓ No defects recorded')).toBeInTheDocument();
    expect(screen.queryByText('No fittings tested yet.')).not.toBeInTheDocument();
  });

  it('RCD push rows show their Defect ID / Responsibility / Rectified action, like injection rows', async () => {
    const user = userEvent.setup();
    SEEDS.RCD.seed();
    S('rcd-results-v6', { r: { a: { p: { CB1: { push: { status: 'fail', comment: 'Trips late', ...DEFECT }, inject: {} } } } } });
    await openReport(user, SEEDS.RCD.card, SEEDS.RCD.site);
    expect(await screen.findByText('Push')).toBeInTheDocument();
    expect(screen.getByText('Defect ID: 74')).toBeInTheDocument();
    expect(screen.getByText(/Site Electrician/)).toBeInTheDocument();
    expect(screen.getByText('Removed from Service')).toBeInTheDocument();
  });

  it('TAT PASS tile is green like every other module', async () => {
    const user = userEvent.setup();
    SEEDS.TAT.seed();
    await openReport(user, SEEDS.TAT.card, SEEDS.TAT.site);
    const tile = (await screen.findByText('PASS')).previousSibling;
    expect(tile.style.color).toBe('rgb(22, 163, 74)');
  });

  it('ELT keeps its register table below the summary, with an ELT subtitle and standard tiles', async () => {
    const user = userEvent.setup();
    SEEDS.ELT.seed();
    await openReport(user, SEEDS.ELT.card, SEEDS.ELT.site);
    expect(await screen.findByText(/EMERGENCY LIGHTING REPORT/)).toBeInTheDocument();
    expect(screen.getByText('FITTING REGISTER')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    for (const l of ['TOTAL', 'PASS', 'FAIL', 'UNTESTED']) expect(screen.getAllByText(l).length).toBeGreaterThan(0);
    expect(screen.queryByText('N/A')).not.toBeInTheDocument(); // ELT has no N/A result, so no always-zero tile
    expect(screen.getByText(/Failed: 90-Minute Discharge Test/)).toBeInTheDocument();
  });

  it('Thermo: MONITOR is listed separately (amber), not as a failure, and there is no Export button', async () => {
    const user = userEvent.setup();
    SEEDS.Thermo.seed();
    await openReport(user, SEEDS.Thermo.card, SEEDS.Thermo.site);
    expect(await screen.findByText('Items to Monitor')).toBeInTheDocument();
    const failed = screen.getByText('Failed Items').parentElement;
    expect(within(failed).getByText('0172')).toBeInTheDocument();
    expect(within(failed).queryByText('0173')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Export/ })).not.toBeInTheDocument();
  });

  it('IRT: a PASS item that still carries a retained priority is not listed as failed', async () => {
    const user = userEvent.setup();
    SEEDS.IRT.seed();
    S('irt-results-v1', { n: { a: { p: { x: { status: 'pass', testVoltage: '500V', readings: { L1E: '500' }, notes: '', ...DEFECT } } } } });
    await openReport(user, SEEDS.IRT.card, SEEDS.IRT.site);
    await screen.findByText('IRT TEST', { exact: false }).catch(() => {});
    expect(screen.queryByText('Failed Items')).not.toBeInTheDocument();
    expect(screen.getByText('✓ No defects recorded')).toBeInTheDocument();
  });
});

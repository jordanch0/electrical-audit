// Drives the real ELT module through AppRoot (pre-seeding localStorage to skip site/fitting entry).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { eltOverall } from './App.jsx';

const pass4 = { visual:'pass', discharge:'pass', switching:'pass', charging:'pass' };
const project = {
  id:'p1', name:'Site A', company:'Co', abn:'1', licence:'L1',
  assets:[
    { id:'a1', location:'Site A', assetLocation:'SE Door', assetId:'', type:'Emergency Exit Sign', maintained:'Maintained', fitting:'X' },
    { id:'a2', location:'Site A', assetLocation:'SW Roof', assetId:'', type:'Emergency Exit Sign', maintained:'Maintained', fitting:'Y' },
  ],
};
const results = { a1:{ ...pass4, notes:'fine' }, a2:{ ...pass4, visual:'fail', rectified:'Repaired On-Site', defectId:'74', responsibility:'Client', priority:'H', notes:'Water ingress' } };
const meta = { auditor:'Jane', testDate:'2026-09-21', nextTestDate:'2027-01-01' };
const ls = k => JSON.parse(localStorage.getItem(k));

async function openElt(user) {
  render(<AppRoot />);
  await user.click(screen.getByText('EMERGENCY LIGHTING'));
  await user.click(await screen.findByText('Site A', { selector: 'div' }));
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('elt-projects-v1', JSON.stringify([project]));
  localStorage.setItem('elt-results-v1', JSON.stringify({ p1: results }));
  localStorage.setItem('elt-meta-v1', JSON.stringify({ p1: meta }));
});
afterEach(() => cleanup());

describe('ELT complete-audit / history round trip', () => {
  it('archives, clears next-due override, and Continue restores without mutating the snapshot', async () => {
    const user = userEvent.setup();
    await openElt(user);

    await user.click(await screen.findByRole('button', { name: /Complete Emergency Lighting Audit/ }));
    await user.click(screen.getByRole('button', { name: /Yes, Complete/ }));

    await waitFor(() => expect(ls('elt-history-v2')).toHaveLength(1));
    const snap = ls('elt-history-v2')[0];
    expect(snap.results).toEqual(results);
    expect(snap.assets).toBeUndefined();
    expect(snap.areas.flatMap(a => a.assets)).toEqual(project.assets.map(({ location, ...rest }) => rest)); // v1 flat seed migrated, then archived as areas
    expect(snap.auditor).toBe('Jane');
    expect(snap.meta.nextTestDate).toBe('2027-01-01');
    await waitFor(() => expect(ls('elt-results-v1').p1).toEqual({}));
    await waitFor(() => expect(ls('elt-meta-v1').p1.nextTestDate).toBe(''));
    expect(ls('elt-meta-v1').p1.auditor).toBe('Jane');
    const snapshotBefore = JSON.stringify(ls('elt-history-v2'));

    // History → expand → Continue
    await user.click(screen.getByRole('button', { name: /History/ }));
    await user.click(await screen.findByText('Emergency Lighting Audit'));
    await user.click(screen.getByRole('button', { name: /^▶ Continue$/ }));
    await user.click(screen.getByRole('button', { name: /Yes, Continue/ }));

    await waitFor(() => expect(ls('elt-results-v1').p1).toEqual(results));
    await waitFor(() => expect(ls('elt-meta-v1').p1.nextTestDate).toBe('2027-01-01'));
    expect(JSON.stringify(ls('elt-history-v2'))).toBe(snapshotBefore);

    // Edit the restored audit; the archived snapshot must be unaffected
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    await user.click(await screen.findByText('SE Door'));
    await user.click(screen.getAllByRole('button', { name: 'FAIL' })[0]);
    await waitFor(() => expect(ls('elt-results-v1').p1.a1.visual).toBe('fail'));
    expect(JSON.stringify(ls('elt-history-v2'))).toBe(snapshotBefore);
    expect(ls('elt-history-v2')[0].results.a1.visual).toBe('pass');
  });
});

describe('ELT fail→pass flip keeps hidden fail fields', () => {
  it('hides the defect panel, flips overall to PASS, and retains the defect fields in storage', async () => {
    const user = userEvent.setup();
    await openElt(user);
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    await user.click(await screen.findByText('SW Roof'));

    expect(screen.getByText(/FAIL — DEFECT DETAILS/)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'PASS' })[0]); // Visual Inspection back to pass
    expect(screen.queryByText(/FAIL — DEFECT DETAILS/)).not.toBeInTheDocument();

    await waitFor(() => expect(ls('elt-results-v1').p1.a2.visual).toBe('pass'));
    const saved = ls('elt-results-v1').p1.a2;
    expect(eltOverall(saved)).toBe('pass');
    expect(saved).toMatchObject({ rectified:'Repaired On-Site', defectId:'74', responsibility:'Client', priority:'H' });
  });

  it('reveals the panel only when overall is FAIL (not on partial passes)', async () => {
    const user = userEvent.setup();
    localStorage.setItem('elt-results-v1', JSON.stringify({ p1: {} }));
    await openElt(user);
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    await user.click(await screen.findByText('SE Door'));
    expect(screen.queryByText(/FAIL — DEFECT DETAILS/)).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'PASS' })[0]);
    expect(screen.queryByText(/FAIL — DEFECT DETAILS/)).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'FAIL' })[1]);
    expect(screen.getByText(/FAIL — DEFECT DETAILS/)).toBeInTheDocument();
  });
});

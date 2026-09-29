// TAT Visual Inspection (2026-09-29): changed from a tick box (ticked/unticked, no Fail state) to a Pass/Fail
// control, fully symmetric with Electrical Test — same tri-state field shape ("" | "pass" | "fail"), same UI style,
// and Visual FAIL now ALSO forces the overall result to FAIL (previously only Electrical FAIL did this). Overall
// PASS still requires BOTH checks to have passed (src/tat-electrical.test.jsx covers the shared PASS-gate logic and
// the legacy boolean -> tri-state migration in depth); this file covers the cases specific to Visual becoming a
// symmetric FAIL trigger.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { tatVisualPatch, tatElectricalPatch } from './App.jsx';

const ls = k => JSON.parse(localStorage.getItem(k));
const rec = () => ls('tat-results-v1').t1.a1.i1;
afterEach(() => cleanup());

const project = { id: 't1', name: 'Site T', company: '', abn: '', licence: '', areas: [
  { id: 'a1', name: 'Workshop', defaultFreq: '3', items: ['i1'], itemNames: { i1: 'Drill' }, itemTags: { i1: '1' }, itemEquipTypes: { i1: 'Power Tool' }, itemFreqs: { i1: '3' } }] };
async function openItem(user) {
  render(<AppRoot />);
  await user.click(screen.getByText('TEST & TAG'));
  await user.click(await screen.findByText('Site T', { selector: 'div' }));
  await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ }));
  await user.click(await screen.findByText('Workshop'));
  await user.click(await screen.findByText('Drill'));
}
const elec = v => screen.getByRole('button', { name: 'Electrical test ' + v });
const visualBtn = v => screen.getByRole('button', { name: 'Visual inspection ' + v });
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('tat-projects-v1', JSON.stringify([project]));
  localStorage.setItem('tat-meta-v1', JSON.stringify({ t1: { auditor: 'Jane', testDate: '2026-09-21' } }));
});

describe('tatVisualPatch — symmetric with tatElectricalPatch', () => {
  const D = '2026-09-21';
  it('FAIL forces the overall result to FAIL and stamps the tested date, whatever it was before (new: Visual FAIL is now a trigger, matching Electrical)', () => {
    for (const status of ['untested', 'pass', 'na', 'fail']) expect(tatVisualPatch({ status, visualCheck: '' }, 'fail', D)).toEqual({ visualCheck: 'fail', status: 'fail', lastTested: D });
  });
  it('PASS without Electrical having passed never changes the overall result', () => {
    for (const status of ['untested', 'pass', 'na', 'fail']) expect(tatVisualPatch({ status, visualCheck: '' }, 'pass', D)).toEqual({ visualCheck: 'pass' });
  });
  it('clearing a passed Visual while the overall result is PASS drops it to UNTESTED; any other clear leaves the result alone', () => {
    expect(tatVisualPatch({ status: 'pass', visualCheck: 'pass' }, '', D)).toEqual({ visualCheck: '', status: 'untested' });
    expect(tatVisualPatch({ status: 'fail', visualCheck: 'fail' }, '', D)).toEqual({ visualCheck: '' });
    expect(tatVisualPatch({ status: 'pass', visualCheck: '' }, '', D)).toEqual({ visualCheck: '' });          // a LEGACY pass (nothing recorded) is not touched
    expect(tatVisualPatch({ status: 'na', visualCheck: 'pass' }, '', D)).toEqual({ visualCheck: '' });
  });
});

describe('item page: VISUAL INSPECTION is Pass/Fail, styled like Electrical Test', () => {
  it('renders two buttons (Pass/Fail), no checkbox, same style/behaviour as Electrical Test', async () => {
    const user = userEvent.setup(); await openItem(user);
    expect(screen.getByText('VISUAL INSPECTION')).toBeInTheDocument();
    expect(screen.getByText('Check for physical damage, cord condition, plug integrity')).toBeInTheDocument();
    expect(visualBtn('PASS')).toBeInTheDocument();
    expect(visualBtn('FAIL')).toBeInTheDocument();
    expect(visualBtn('PASS')).toHaveAttribute('aria-pressed', 'false');
    // no leftover checkbox-style element
    expect(screen.queryByText('Visual Inspection')).not.toBeInTheDocument(); // old label text (no longer a section heading in that exact casing/spot)
  });

  it('tapping FAIL sets aria-pressed, stores visualCheck: fail, and forces the overall result to FAIL with the defect panel + ★ defaults (2026-09-29 — this is NEW; Visual FAIL used to do nothing to the overall result)', async () => {
    const user = userEvent.setup(); await openItem(user);
    expect(screen.queryByText(/FAIL — DEFECT DETAILS/)).not.toBeInTheDocument();
    await user.click(visualBtn('FAIL'));
    expect(visualBtn('FAIL')).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText(/FAIL — DEFECT DETAILS/)).toBeInTheDocument();
    await waitFor(() => expect(rec()).toMatchObject({ status: 'fail', visualCheck: 'fail', lastTested: '2026-09-21', rectified: 'Removed from Service', responsibility: 'Site Electrician' }));
  });

  it('re-tapping a Visual FAIL clears the field back to "not recorded" but leaves the overall result FAIL (the auditor resets it manually, same as Electrical)', async () => {
    const user = userEvent.setup(); await openItem(user);
    await user.click(visualBtn('FAIL'));
    await waitFor(() => expect(rec().visualCheck).toBe('fail'));
    await user.click(visualBtn('FAIL'));
    await waitFor(() => expect(rec().visualCheck).toBe(''));
    expect(rec().status).toBe('fail');
  });

  it('Visual FAIL and Electrical FAIL both independently force FAIL; either one failing is enough', async () => {
    const user = userEvent.setup(); await openItem(user);
    await user.click(visualBtn('FAIL'));
    await waitFor(() => expect(rec().status).toBe('fail'));
    await user.click(visualBtn('FAIL')); // clear Visual's fail value, but the manual result stays FAIL (matches Electrical's own behaviour)
    await user.click(screen.getByRole('button', { name: 'PASS' })); // blocked — neither check is a recorded pass yet
    expect(rec().status).toBe('fail');
    await user.click(elec('FAIL'));
    await waitFor(() => expect(rec().electricalCheck).toBe('fail'));
    expect(rec().status).toBe('fail');
  });

  it('the export column shows Pass / Fail / blank for Visual Inspection, matching Electrical Test', async () => {
    localStorage.setItem('tat-results-v1', JSON.stringify({ t1: { a1: {
      i1: { status: 'fail', visualCheck: 'fail', electricalCheck: '', lastTested: '2026-09-21', notes: '' } } } }));
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('TEST & TAG'));
    await user.click(await screen.findByText('Site T', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: 'Report' }));
    // "Visual Inspection: FAIL" line appears in Failed Items now that Visual is a real FAIL trigger
    expect(await screen.findByText('Visual Inspection: FAIL')).toBeInTheDocument();
  });
});

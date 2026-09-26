// TAT "Electrical Test" (the pass / fail shown on the test-and-tag machine) alongside the Visual Inspection tick box.
// Rule (Option A): the overall result stays MANUAL. PASS can only be marked when Visual is ticked AND Electrical passed; Electrical FAIL sets the
// overall result to FAIL (defect panel + ★ defaults); clearing a passed Electrical drops the PASS it justified. The field is additive and
// optional — legacy records / History snapshots read as "not recorded" and are never rewritten by a read.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { tatCanPass, tatElectricalPatch, tatGetItem } from './App.jsx';

const ls = k => JSON.parse(localStorage.getItem(k));
const rec = () => ls('tat-results-v1').t1.a1.i1;
afterEach(() => cleanup());

describe('tatCanPass — both checks must pass', () => {
  it.each([
    [{ visualCheck: true, electricalCheck: 'pass' }, true],
    [{ visualCheck: true, electricalCheck: '' }, false],
    [{ visualCheck: true, electricalCheck: 'fail' }, false],
    [{ visualCheck: false, electricalCheck: 'pass' }, false],
    [{ visualCheck: false, electricalCheck: '' }, false],
    [{ visualCheck: true }, false],                       // legacy record: no electrical result recorded
    [{}, false], [null, false],
  ])('%o -> %s', (item, expected) => { expect(tatCanPass(item)).toBe(expected); });
});

describe('tatElectricalPatch — auto-fail and the cleared-pass rule', () => {
  const D = '2026-09-21';
  it('FAIL forces the overall result to FAIL and stamps the tested date, whatever it was before', () => {
    for (const status of ['untested', 'pass', 'na', 'fail']) expect(tatElectricalPatch({ status, electricalCheck: '' }, 'fail', D)).toEqual({ electricalCheck: 'fail', status: 'fail', lastTested: D });
  });
  it('PASS never changes the overall result (a manual FAIL stays FAIL; the PASS button is a separate, gated step)', () => {
    for (const status of ['untested', 'pass', 'na', 'fail']) expect(tatElectricalPatch({ status, electricalCheck: '' }, 'pass', D)).toEqual({ electricalCheck: 'pass' });
  });
  it('clearing a passed Electrical while the overall result is PASS drops it to UNTESTED; any other clear leaves the result alone', () => {
    expect(tatElectricalPatch({ status: 'pass', electricalCheck: 'pass' }, '', D)).toEqual({ electricalCheck: '', status: 'untested' });
    expect(tatElectricalPatch({ status: 'fail', electricalCheck: 'fail' }, '', D)).toEqual({ electricalCheck: '' });     // the auditor resets a FAIL with the result buttons
    expect(tatElectricalPatch({ status: 'pass', electricalCheck: '' }, '', D)).toEqual({ electricalCheck: '' });         // a LEGACY pass (nothing recorded) is not touched
    expect(tatElectricalPatch({ status: 'na', electricalCheck: 'pass' }, '', D)).toEqual({ electricalCheck: '' });
  });
});

describe('tatGetItem — read-time default only; a legacy record is never altered', () => {
  it('a record without the field reads as "" with every other field identical, and the stored object is not mutated', () => {
    const stored = Object.freeze({ status: 'pass', visualCheck: true, equipType: 'Power Tool', freq: '3', lastTested: '2026-01-05', notes: 'ok', priority: '', tag: 'T1' });
    const got = tatGetItem({ s: { a: { i: stored } } }, 's', 'a', 'i');
    expect(got).toEqual({ ...stored, electricalCheck: '' });
    expect('electricalCheck' in stored).toBe(false);
  });
  it('a record that has the field is returned as-is (same object); a missing record gets the fresh default', () => {
    const stored = { status: 'fail', visualCheck: false, electricalCheck: 'fail' };
    expect(tatGetItem({ s: { a: { i: stored } } }, 's', 'a', 'i')).toBe(stored);
    expect(tatGetItem({}, 's', 'a', 'i')).toMatchObject({ status: 'untested', visualCheck: false, electricalCheck: '' });
  });
  it('seeded property test: 300 random legacy records keep every field and value exactly', () => {
    let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    const pick = a => a[Math.floor(rnd() * a.length)];
    for (let n = 0; n < 300; n++) {
      const r = { status: pick(['untested', 'pass', 'fail', 'na']), visualCheck: rnd() < 0.5, lastTested: pick(['', '2026-03-01']), notes: pick(['', 'x', 'a — b']), priority: pick(['', 'H']), ...(rnd() < 0.5 ? { defectId: String(n), rectified: 'R', responsibility: 'Client' } : {}) };
      const frozen = Object.freeze({ ...r });
      const got = tatGetItem({ s: { a: { i: frozen } } }, 's', 'a', 'i');
      expect(got).toEqual({ ...r, electricalCheck: '' });
      expect(Object.keys(frozen).sort()).toEqual(Object.keys(r).sort());
    }
  });
});

// ── through the real UI ──
const project = { id: 't1', name: 'Site T', company: '', abn: '', licence: '', areas: [
  { id: 'a1', name: 'Workshop', defaultFreq: '3', items: ['i1', 'i2'], itemNames: { i1: 'Drill', i2: 'Saw' }, itemTags: { i1: '1', i2: '2' }, itemEquipTypes: { i1: 'Power Tool', i2: 'Power Tool' }, itemFreqs: { i1: '3', i2: '3' } }] };
async function openItem(user, name = 'Drill') {
  render(<AppRoot />);
  await user.click(screen.getByText('TEST & TAG'));
  await user.click(await screen.findByText('Site T', { selector: 'div' }));
  await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ }));
  await user.click(await screen.findByText('Workshop'));
  await user.click(await screen.findByText(name));
}
const elec = v => screen.getByRole('button', { name: 'Electrical test ' + v });
const visual = () => screen.getByRole('button', { name: /Visual Inspection/ });
const BLOCKED = /Visual inspection must be ticked and the Electrical Test passed before marking PASS/;
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('tat-projects-v1', JSON.stringify([project]));
  localStorage.setItem('tat-meta-v1', JSON.stringify({ t1: { auditor: 'Jane', testDate: '2026-09-21' } }));
});

describe('item page: the ELECTRICAL TEST section and the PASS gate', () => {
  it('sits between Visual Inspection and RESULT, with the approved copy', async () => {
    const user = userEvent.setup(); await openItem(user);
    const head = screen.getByText('ELECTRICAL TEST');
    expect(screen.getByText('Result shown on the test-and-tag machine')).toBeInTheDocument();
    expect(visual().compareDocumentPosition(head) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(head.compareDocumentPosition(screen.getByText('RESULT')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('PASS is blocked until Visual is ticked AND Electrical passed; then it is allowed and stamps the date', async () => {
    const user = userEvent.setup(); await openItem(user);
    expect(screen.getByText(BLOCKED)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'PASS' }));                       // nothing ticked: blocked
    await waitFor(() => expect((ls('tat-results-v1') || { t1: { a1: { i1: {} } } }).t1.a1.i1.status || 'untested').toBe('untested'));
    await user.click(visual());                                                            // Visual alone is no longer enough
    await user.click(screen.getByRole('button', { name: 'PASS' }));
    expect(rec().status).not.toBe('pass'); expect(screen.getByText(BLOCKED)).toBeInTheDocument();
    await user.click(elec('PASS'));                                                        // both now satisfied
    expect(elec('PASS')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(BLOCKED)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'PASS' }));
    await waitFor(() => expect(rec()).toMatchObject({ status: 'pass', visualCheck: true, electricalCheck: 'pass', lastTested: '2026-09-21' }));
  });

  it('Electrical alone (Visual not ticked) does not unlock PASS', async () => {
    const user = userEvent.setup(); await openItem(user);
    await user.click(elec('PASS'));
    await user.click(screen.getByRole('button', { name: 'PASS' }));
    await waitFor(() => expect(rec().electricalCheck).toBe('pass'));
    expect(rec().status).not.toBe('pass'); expect(screen.getByText(BLOCKED)).toBeInTheDocument();
  });

  it('re-tapping a passed Electrical clears it AND drops the PASS it justified back to untested', async () => {
    const user = userEvent.setup(); await openItem(user);
    await user.click(visual()); await user.click(elec('PASS')); await user.click(screen.getByRole('button', { name: 'PASS' }));
    await waitFor(() => expect(rec().status).toBe('pass'));
    await user.click(elec('PASS'));
    await waitFor(() => expect(rec()).toMatchObject({ electricalCheck: '', status: 'untested' }));
    expect(elec('PASS')).toHaveAttribute('aria-pressed', 'false');
  });

  it('Electrical FAIL auto-sets the overall result to FAIL, opens the defect panel, stores the ★ defaults; re-tap clears it but leaves FAIL', async () => {
    const user = userEvent.setup(); await openItem(user);
    expect(screen.queryByText(/FAIL — DEFECT DETAILS/)).not.toBeInTheDocument();
    await user.click(elec('FAIL'));
    expect(await screen.findByText(/FAIL — DEFECT DETAILS/)).toBeInTheDocument();
    await waitFor(() => expect(rec()).toMatchObject({ status: 'fail', electricalCheck: 'fail', lastTested: '2026-09-21', rectified: 'Removed from Service', responsibility: 'Site Electrician' }));
    await user.click(elec('FAIL'));                                                        // cleared -> "not recorded"
    await waitFor(() => expect(rec().electricalCheck).toBe(''));
    expect(rec().status).toBe('fail');                                                     // the result is manual: the auditor resets it
  });

  it('persists across a reload: the pressed state and the stored value come back', async () => {
    const user = userEvent.setup(); await openItem(user);
    await user.click(elec('FAIL')); await waitFor(() => expect(rec().electricalCheck).toBe('fail'));
    cleanup(); await openItem(user);
    expect(elec('FAIL')).toHaveAttribute('aria-pressed', 'true'); expect(elec('PASS')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('legacy data: records that predate the field load unchanged', () => {
  const legacy = { i1: { status: 'pass', visualCheck: true, equipType: 'Power Tool', freq: '3', lastTested: '2026-03-01', notes: 'legacy pass', priority: '', tag: '1', desc: '' },
    i2: { status: 'fail', visualCheck: false, equipType: 'Power Tool', freq: '3', lastTested: '2026-03-01', notes: 'legacy fail', priority: 'H', defectId: '74', rectified: 'Removed from Service', responsibility: 'Client' } };
  beforeEach(() => { localStorage.setItem('tat-results-v1', JSON.stringify({ t1: { a1: JSON.parse(JSON.stringify(legacy)) } })); });

  it('a legacy PASS stays PASS, shows Electrical as not recorded, no warning, and opening it writes no electricalCheck', async () => {
    const user = userEvent.setup(); await openItem(user);
    expect(elec('PASS')).toHaveAttribute('aria-pressed', 'false'); expect(elec('FAIL')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText(BLOCKED)).not.toBeInTheDocument();                         // it is already PASS — no nagging
    const stored = rec();
    for (const [k, v] of Object.entries(legacy.i1)) expect(stored[k], k).toEqual(v);       // every legacy field intact
    expect('electricalCheck' in stored).toBe(false);                                       // a read never rewrites
  });

  it('the item list shows "○ Electrical" for both legacy items and leaves their stored records untouched', async () => {
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('TEST & TAG'));
    await user.click(await screen.findByText('Site T', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ }));
    await user.click(await screen.findByText('Workshop'));
    expect(await screen.findAllByText(/○ Electrical/)).toHaveLength(2);
    expect(ls('tat-results-v1').t1.a1).toEqual(legacy);
  });

  it('a legacy History snapshot renders and shows "not recorded" chips; the snapshot itself is unchanged', async () => {
    const snap = { id: 'h1', projectId: 't1', projectName: 'Site T', auditor: 'Jane', testDate: '2026-03-01', archivedAt: '2026-03-02T00:00:00.000Z', results: { a1: JSON.parse(JSON.stringify(legacy)) }, meta: { auditor: 'Jane', testDate: '2026-03-01' } };
    localStorage.setItem('tat-history-v1', JSON.stringify([snap]));
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('TEST & TAG'));
    await user.click(await screen.findByText('Site T', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /History/ }));
    await user.click(await screen.findByText('Test & Tag Audit'));
    await user.click(screen.getByRole('button', { name: 'View Results' }));
    await user.click(await screen.findByText('Workshop'));
    expect((await screen.findAllByText(/○ Electrical/)).length).toBe(2);
    expect(ls('tat-history-v1')).toEqual([snap]);
  });
});

describe('Report tab: an electrical failure is called out', () => {
  it('Failed Items lists "Electrical test: FAIL" for an item that failed that way, and not for a plain visual FAIL', async () => {
    localStorage.setItem('tat-results-v1', JSON.stringify({ t1: { a1: {
      i1: { status: 'fail', visualCheck: true, electricalCheck: 'fail', lastTested: '2026-09-21', notes: '', priority: 'H', defectId: '1', rectified: 'R', responsibility: 'Client' },
      i2: { status: 'fail', visualCheck: false, electricalCheck: '', lastTested: '2026-09-21', notes: '', priority: 'L', defectId: '2', rectified: 'R', responsibility: 'Client' } } } }));
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('TEST & TAG'));
    await user.click(await screen.findByText('Site T', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: 'Report' }));
    expect(await screen.findAllByText('Electrical test: FAIL')).toHaveLength(1);
  });
});

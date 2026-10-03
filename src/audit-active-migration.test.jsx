// MIGRATION to the per-site active-audit flag. The old app kept ONE global `rcd-mode-v6` / `iel-cat-v2` and guessed the rest from the auditor name /
// marked items. This loads OLD-format data (including a started-but-empty audit and an audit whose auditor was cleared), mounts the app twice, and checks:
// nothing is lost or changed, the old keys are left exactly as they were (never written, never deleted), an audit started before the change still shows
// the in-progress gate, and a never-touched site does not.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { migrateAuditActive } from './App.jsx';

vi.setConfig({ testTimeout: 30000 });                       // multi-screen flows run several renders; keep them stable under a loaded CI / parallel run
afterEach(() => cleanup()); beforeEach(() => localStorage.clear());
const back = user => user.click(screen.getAllByText('Back')[0]);
const auditTab = user => user.click(screen.getByRole('button', { name: /^Audit$/ }));
const snapshot = keys => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)]));
const toList = async user => { for (let i = 0; i < 3 && screen.queryAllByText('Back').length; i++) await back(user); };

describe('migrateAuditActive (pure)', () => {
  const projects = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const entryFor = p => (p.id === 'a' ? { mode: 'push' } : p.id === 'c' ? {} : null);
  it('builds the map from the entries, never mutates its inputs, and gives the same answer every time', () => {
    const copy = JSON.stringify(projects);
    const one = migrateAuditActive(projects, entryFor), two = migrateAuditActive(projects, entryFor);
    expect(one).toEqual({ a: { mode: 'push' }, c: {} }); expect(two).toEqual(one); expect(JSON.stringify(projects)).toBe(copy);
    expect(migrateAuditActive([], entryFor)).toEqual({}); expect(migrateAuditActive(undefined, entryFor)).toEqual({});
  });
});

describe('RCD: old-format data (global rcd-mode-v6 = "push")', () => {
  const areas = [{ id: 'a1', name: 'Plant', panels: [{ id: 'p1', name: 'P1', circuits: ['1', '2'] }] }];
  const OLD = () => {
    localStorage.setItem('rcd-projects-v6', JSON.stringify([
      { id: 's1', name: 'Started Empty', company: '', abn: '', licence: '', areas },
      { id: 's2', name: 'Blank Auditor', company: '', abn: '', licence: '', areas },
      { id: 's3', name: 'With Progress', company: '', abn: '', licence: '', areas },
      { id: 's4', name: 'Untouched', company: '', abn: '', licence: '', areas }]));
    localStorage.setItem('rcd-meta-v6', JSON.stringify({ s1: { auditor: 'Jane' }, s2: { auditor: '' }, s3: { auditor: 'Jane' } }));
    localStorage.setItem('rcd-results-v6', JSON.stringify({ s3: { a1: { p1: { '1': { push: { status: 'pass' }, inject: {} } } } } }));
    localStorage.setItem('rcd-mode-v6', JSON.stringify('push'));
  };
  const OLD_KEYS = ['rcd-projects-v6', 'rcd-meta-v6', 'rcd-results-v6', 'rcd-mode-v6'];
  const gateOf = async (user, name) => {
    await user.click(await screen.findByText(name, { selector: 'div' })); await auditTab(user); await back(user); await auditTab(user);   // Audit, Back (arms the gate), Audit
    const inProg = screen.queryByText('AUDIT IN PROGRESS'), none = screen.queryByText('NO ACTIVE AUDIT');
    const out = inProg ? 'IN-PROGRESS' : none ? 'NO-ACTIVE' : 'FOLDERS';
    const cont = inProg ? screen.getByRole('button', { name: /Continue Audit/ }).disabled : null;
    await toList(user);
    return { out, continueDisabled: cont };
  };

  it('loads, migrates, runs again: nothing lost, old keys untouched, the pre-change audit still shows the in-progress gate', async () => {
    OLD(); const before = snapshot(OLD_KEYS);
    const user = userEvent.setup(); const first = render(<AppRoot />);
    await user.click(screen.getByText('RCD TESTING', { exact: true }));
    const r1 = {}; for (const n of ['Started Empty', 'Blank Auditor', 'With Progress', 'Untouched']) r1[n] = await gateOf(user, n);
    expect(r1['Started Empty']).toMatchObject({ out: 'IN-PROGRESS', continueDisabled: false });         // started before the change: still in progress
    expect(r1['Blank Auditor']).toMatchObject({ out: 'IN-PROGRESS', continueDisabled: true });          // auditor cleared: in progress, Continue disabled
    expect(r1['With Progress'].out).toBe('IN-PROGRESS');                                                // marked items: active — Back then Audit shows the in-progress gate
    expect(r1['Untouched']).toMatchObject({ out: 'NO-ACTIVE' });                                        // never touched: not active
    const key1 = localStorage.getItem('rcd-audit-active-v1');
    expect(JSON.parse(key1).v).toBe(1); expect(Object.keys(JSON.parse(key1).sites).sort()).toEqual(['s1', 's2', 's3']);
    expect(JSON.parse(key1).sites.s1).toEqual({ mode: 'push' }); expect(JSON.parse(key1).sites.s3).toEqual({ mode: 'push' });
    // the old keys: the mode key is byte-for-byte as left; nothing the user had was changed or lost
    expect(localStorage.getItem('rcd-mode-v6')).toBe(before['rcd-mode-v6']);
    OLD_KEYS.forEach(k => expect(JSON.parse(localStorage.getItem(k))).toEqual(JSON.parse(before[k])));
    // SECOND run: a fresh mount over the migrated storage
    first.unmount(); cleanup();
    const user2 = userEvent.setup(); render(<AppRoot />);
    await user2.click(screen.getByText('RCD TESTING', { exact: true }));
    const r2 = {}; for (const n of ['Started Empty', 'Blank Auditor', 'With Progress', 'Untouched']) r2[n] = await gateOf(user2, n);
    expect(r2).toEqual(r1);
    expect(localStorage.getItem('rcd-audit-active-v1')).toBe(key1);                                    // the migration did not run again / did not change anything
    expect(localStorage.getItem('rcd-mode-v6')).toBe(before['rcd-mode-v6']);
    OLD_KEYS.forEach(k => expect(JSON.parse(localStorage.getItem(k))).toEqual(JSON.parse(before[k])));
  });

  it('a site created AFTER the migration is not made active by the (still present) old key', async () => {
    OLD(); const user = userEvent.setup(); const first = render(<AppRoot />);
    await user.click(screen.getByText('RCD TESTING', { exact: true })); await screen.findByText('Untouched', { selector: 'div' });
    first.unmount(); cleanup();
    const list = JSON.parse(localStorage.getItem('rcd-projects-v6')); list.push({ id: 's5', name: 'Newcomer', company: '', abn: '', licence: '', areas });
    localStorage.setItem('rcd-projects-v6', JSON.stringify(list)); localStorage.setItem('rcd-meta-v6', JSON.stringify({ ...JSON.parse(localStorage.getItem('rcd-meta-v6')), s5: { auditor: 'Jane' } }));
    const user2 = userEvent.setup(); render(<AppRoot />); await user2.click(screen.getByText('RCD TESTING', { exact: true }));
    expect((await gateOf(user2, 'Newcomer')).out).toBe('NO-ACTIVE');
    expect(localStorage.getItem('rcd-mode-v6')).toBe(JSON.stringify('push'));
  });

  it('an audit with progress in INJECTION only keeps the injection mode when the old key is empty', async () => {
    OLD(); localStorage.removeItem('rcd-mode-v6');
    localStorage.setItem('rcd-results-v6', JSON.stringify({ s3: { a1: { p1: { '1': { push: { status: 'untested' }, inject: { status: 'pass' } } } } } }));
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText('RCD TESTING', { exact: true }));
    await screen.findByText('With Progress', { selector: 'div' });
    expect(JSON.parse(localStorage.getItem('rcd-audit-active-v1')).sites).toEqual({ s3: { mode: 'inject' } });
    expect(localStorage.getItem('rcd-mode-v6')).toBeNull();                                            // and the missing old key was not created
  });
});

describe('IEL: old-format data (global iel-cat-v2 = "estops")', () => {
  const OLD_KEYS = ['iel-projects-v2', 'iel-meta-v2', 'iel-cat-v2'];
  it('a started-but-empty audit and an audit with a blank auditor stay in progress; a never-touched site does not; old keys untouched; second run identical', async () => {
    localStorage.setItem('iel-projects-v2', JSON.stringify([{ id: 's1', name: 'Started Empty', areas: [] }, { id: 's2', name: 'Blank Auditor', areas: [] }, { id: 's3', name: 'Untouched', areas: [] }]));
    localStorage.setItem('iel-meta-v2', JSON.stringify({ s1: { auditor: 'Jane' }, s2: { auditor: '' } })); localStorage.setItem('iel-cat-v2', JSON.stringify('estops'));
    const before = snapshot(OLD_KEYS);
    const gate = async (user, name) => { await user.click(await screen.findByText(name, { selector: 'div' })); await auditTab(user); await back(user); await auditTab(user); const g = screen.queryByText('AUDIT IN PROGRESS') ? 'IN-PROGRESS' : screen.queryByText('NO ACTIVE AUDIT') ? 'NO-ACTIVE' : 'OTHER'; const dis = g === 'IN-PROGRESS' ? screen.getByRole('button', { name: /Continue Audit/ }).disabled : null; await toList(user); return [g, dis]; };
    const run = async () => { const user = userEvent.setup(); const r = render(<AppRoot />); await user.click(screen.getByText('IEL TESTING', { exact: true })); const out = []; for (const n of ['Started Empty', 'Blank Auditor', 'Untouched']) out.push(await gate(user, n)); r.unmount(); cleanup(); return out; };
    const one = await run(); expect(one).toEqual([['IN-PROGRESS', false], ['IN-PROGRESS', true], ['NO-ACTIVE', null]]);
    const key1 = localStorage.getItem('iel-audit-active-v1'); expect(JSON.parse(key1).sites).toEqual({ s1: { cat: 'estops' }, s2: { cat: 'estops' } });
    const two = await run(); expect(two).toEqual(one); expect(localStorage.getItem('iel-audit-active-v1')).toBe(key1);
    expect(localStorage.getItem('iel-cat-v2')).toBe(before['iel-cat-v2']); OLD_KEYS.forEach(k => expect(JSON.parse(localStorage.getItem(k))).toEqual(JSON.parse(before[k])));
  });
});

describe('TAT / SWB / IRT: old data with marked items becomes active (no loss); an auditor name alone is not an audit', () => {
  const CASES = [
    ['TEST & TAG', 'tat-projects-v1', 'tat-meta-v1', 'tat-results-v1', 'tat-audit-active-v1',
      [{ id: 'a1', name: 'Area1', defaultFreq: '6', items: ['i1'], itemNames: {}, itemTags: {}, itemEquipTypes: {}, itemFreqs: {} }], { a1: { i1: { status: 'pass' } } }],
    ['SWITCHBOARD', 'swb-projects-v1', 'swb-meta-v1', 'swb-results-v1', 'swb-audit-active-v1', [{ id: 'a1', name: 'Area1', boards: [{ id: 'b1', name: 'B1' }] }], { a1: { b1: { enclosure: { status: 'pass' } } } }],
    ['INSULATION RESISTANCE TESTING', 'irt-projects-v1', 'irt-meta-v1', 'irt-results-v1', 'irt-audit-active-v1', [{ id: 'a1', name: 'Area1', panels: [{ id: 'p1', name: 'P1', items: ['m1'] }] }], { a1: { p1: { m1: { status: 'pass', readings: {}, testVoltage: '500V' } } } }],
  ];
  it.each(CASES)('%s', async (tile, pk, mk, rk, ak, areas, siteResults) => {
    localStorage.setItem(pk, JSON.stringify([{ id: 'w', name: 'Worked', areas }, { id: 'o', name: 'Name Only', areas }, { id: 'u', name: 'Untouched', areas }]));
    localStorage.setItem(mk, JSON.stringify({ w: { auditor: 'Jane' }, o: { auditor: 'Jane' } })); localStorage.setItem(rk, JSON.stringify({ w: siteResults }));
    const before = snapshot([pk, mk, rk]);
    const run = async () => { const user = userEvent.setup(); const r = render(<AppRoot />); await user.click(screen.getByText(tile, { exact: true })); await screen.findByText('Worked', { selector: 'div' }); r.unmount(); cleanup(); };
    await run(); const key1 = localStorage.getItem(ak);
    expect(JSON.parse(key1).sites).toEqual({ w: {} });
    await run(); expect(localStorage.getItem(ak)).toBe(key1);
    [pk, mk, rk].forEach(k => expect(JSON.parse(localStorage.getItem(k))).toEqual(JSON.parse(before[k])));
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText(tile, { exact: true }));
    await user.click(await screen.findByText('Worked', { selector: 'div' })); await auditTab(user); await back(user); await auditTab(user);
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();                      // marked items: active, so Back then Audit shows the in-progress gate
    await toList(user);
    await user.click(await screen.findByText('Name Only', { selector: 'div' })); await auditTab(user);
    expect(await screen.findByText('NO ACTIVE AUDIT')).toBeInTheDocument();
  });
});

// ── IEL and Thermo with MARKED items (the shared fictional seed, src/test/pill-seed.cjs): in the old format there is no active-flag key at all, so the
// migration must make these sites active from their marked items. Includes a COMPLETED-but-unarchived audit (every item marked) — it counts as in
// progress (no third state) until it is archived. The in-progress GATE then shows after Back (Back arms it).
import seed from './test/pill-seed.cjs';
describe.each([
  ['iel', 'IEL TESTING', 'iel-audit-active-v1', { cat: 'estops' }, /Complete IEL Audit/],
  ['thermo', 'THERMOGRAPHIC', 'thermo-audit-active-v1', {}, /Complete Thermographic Audit/],
])('%s: old-format site with marked items', (mod, tile, ak, entry, completeRe) => {
  const load = completed => {
    const d = seed.build(mod, 'nologo'); const ls = JSON.parse(JSON.stringify(d.ls));
    if (completed && mod === 'iel') Object.values(ls['iel-results-v2']).forEach(site => Object.values(site).forEach(area => Object.values(area).forEach(cat => Object.values(cat).forEach(it => { if (it.status === 'untested') it.status = 'pass'; }))));
    Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
    return { pid: ls[Object.keys(ls).find(k => k.endsWith('-meta-v2') || k.endsWith('-meta-v1'))] && Object.keys(ls[Object.keys(ls).find(k => k.endsWith('-meta-v2') || k.endsWith('-meta-v1'))])[0], keys: Object.keys(ls) };
  };
  it.each([['in progress (some items marked)', false], ['completed but not archived (every item marked)', true]])('%s: active after migration, nothing lost, identical on a second run; archiving it then clears it', async (_n, completed) => {
    const { pid, keys } = load(completed); const before = snapshot(keys);
    const run = async () => { const user = userEvent.setup(); const r = render(<AppRoot />); await user.click(screen.getByText(tile, { exact: true })); await user.click(await screen.findByText(seed.SITE, { selector: 'div' })); return { user, r }; };
    const { user, r } = await run();
    expect(JSON.parse(localStorage.getItem(ak)).sites).toEqual({ [pid]: entry });
    expect(screen.getByText('COMPLETE ACTIVE AUDIT')).toBeInTheDocument();                       // the Home card for an active audit
    expect(screen.getByRole('button', { name: completeRe })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Audit$/ })); await user.click(screen.getAllByText('Back')[0]); await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();                      // the migrated audit (completed or not) shows the in-progress gate after Back
    await user.click(screen.getByRole('button', { name: /Back to Home/ }));
    const key1 = localStorage.getItem(ak); r.unmount(); cleanup();
    const second = await run();
    expect(localStorage.getItem(ak)).toBe(key1); expect(screen.getByText('COMPLETE ACTIVE AUDIT')).toBeInTheDocument();
    keys.forEach(k => expect(JSON.parse(localStorage.getItem(k))).toEqual(JSON.parse(before[k])));   // nothing the user had was changed or lost
    // archive it (Complete): the flag is cleared and the gate is NO ACTIVE AUDIT
    await second.user.click(screen.getByRole('button', { name: completeRe })); await second.user.click(await screen.findByRole('button', { name: /^Yes/ }));
    expect(JSON.parse(localStorage.getItem(ak)).sites).toEqual({});
    await second.user.click(screen.getByRole('button', { name: /^Audit$/ }));
    expect(await screen.findByText('NO ACTIVE AUDIT')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(mod === 'iel' ? 'iel-history-v2' : 'thermo-history-v1') || '[]').length).toBeGreaterThan(0);   // the archived snapshot is in History
  });
});

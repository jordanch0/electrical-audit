// DATA THAT REFERS TO SETTINGS THIS PHONE DOES NOT HAVE (all nine modules). FICTIONAL data. A restore fills a list only where the phone has none of its own (and never rcd-mode or iel-cat), so a restored site can hold values that are in none of this phone's lists.
// (The tests below seed no setting at all.) Every screen that shows such a value must show the STORED value, never a blank, a crash or an error,
// and every Excel export (the app's only export: there is no PDF export) must still write it. Nothing below seeds ANY setting.
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, configure, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExcelJS from 'exceljs';
import AppRoot, { exportExcel, exportIELExcel, exportTATExcel, exportThermoExcel, exportIRTExcel, exportSWBExcel, exportELTExcel, exportWelderExcel, exportGSDExcel, migrateProjectToAreas as toAreas, WELDER_CHECKLIST } from './App.jsx';

vi.setConfig({ testTimeout: 30000 });                       // multi-screen flows run several renders; keep them stable under a loaded / parallel run
configure({ asyncUtilTimeout: 10000 });                  // the first render of the whole app can take over RTL's 1 s default when the full suite runs in parallel

const site = a => [{ id: 's1', name: 'Site One', company: '', abn: '', licence: '', areas: a }];
const META = { s1: { auditor: 'Jane', testDate: '2026-10-05', pushDate: '2026-10-05', injectDate: '2026-10-05', dateDay: '2026-10-05', nextTestDate: '2027-01-05', notes: '' } };
const S = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const FAIL = { rectified: 'Custom Fix R', responsibility: 'Custom Person P', defectId: '9', priority: 'H', notes: 'n' };
// Every console.error is collected and must be empty at the end of a screen test, EXCEPT React's "update not wrapped in act(...)" warning. The app loads its data asynchronously; on a busy machine that state update can land while a test is
// waiting outside the testing library's act scope, and React then logs the warning. That is the test harness's scheduling, not an error in the app (found by reproducing the intermittent failure under CPU load: the logged text was exactly
// that warning, every time). The waits below are wrapped in act() so it normally never appears; if it does, it is counted apart and the test still fails on any OTHER error.
const ACT_NOISE = /not wrapped in act/;
let errs, actNoise;
const sleep = ms => act(async () => { await new Promise(r => setTimeout(r, ms)); });
beforeEach(() => { localStorage.clear(); errs = []; actNoise = 0; vi.spyOn(console, 'error').mockImplementation((...a) => { const m = a.map(String).join(' ').slice(0, 200); if (ACT_NOISE.test(m)) actNoise++; else errs.push(m); }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const open = async (user, tile) => { render(<AppRoot />); await user.click(screen.getByText(tile, { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' })); };
const start = async user => { const b = await screen.findAllByRole('button', { name: /Start \/ Continue Audit|^Audit$/ }); await user.click(b[0]); };
const seen = async () => { await sleep(400); const t = document.body.textContent + ' ' + [...document.querySelectorAll('input,textarea,select')].map(e => e.value).join(' '); expect(t).toMatch(/Custom Fix R/); expect(t).toMatch(/Custom Person P/); expect(errs.join(' | ')).toBe(''); };

describe('screens show the stored value when the phone has none of the settings', () => {
  it('RCD (push FAIL, via the circuit note page)', async () => {
    S('rcd-projects-v6', site([{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'p1', name: 'MSB 1', circuits: ['CB 1'] }] }])); S('rcd-meta-v6', META); S('rcd-results-v6', { s1: { a1: { p1: { 'CB 1': { push: { status: 'fail', comment: '', lastTested: '2026-10-05', ...FAIL }, inject: {} } } } } });
    const user = userEvent.setup(); await open(user, 'RCD TESTING'); await user.click(screen.getByRole('button', { name: /^Push Test/ })); await user.click(await screen.findByText('Wash Plant')); await user.click(await screen.findByText('MSB 1')); await user.click(await screen.findByText('note')); await seen();
  });
  it('IEL', async () => {
    S('iel-projects-v2', site([{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'e1', name: 'estops', circuits: ['x1'], machineNames: { x1: 'Feed Conveyor 1' } }] }])); S('iel-meta-v2', META); S('iel-results-v2', { s1: { a1: { estops: { x1: { status: 'fail', mechCheck: true, circuitIso: true, lastTested: '2026-10-05', ...FAIL } } } } });
    const user = userEvent.setup(); await open(user, 'IEL TESTING'); await user.click(screen.getByRole('button', { name: /E-Stops/ })); await user.click(await screen.findByText('Wash Plant')); await user.click(await screen.findByRole('button', { name: /E-Stops/ })); await user.click(await screen.findByText('Feed Conveyor 1')); await seen();
  });
  it('TAT: a frequency, equipment type and appliance name that are in none of this phone\'s lists', async () => {
    S('tat-projects-v1', site([{ id: 'a1', name: 'Workshop', defaultFreq: '5', items: ['i1'], itemNames: { i1: 'Weird Appliance' }, itemTags: {}, itemEquipTypes: { i1: 'Strange Type' }, itemFreqs: { i1: '5' } }])); S('tat-meta-v1', META); S('tat-results-v1', { s1: { a1: { i1: { status: 'fail', visualCheck: 'pass', electricalCheck: 'fail', equipType: 'Strange Type', freq: '5', lastTested: '2026-10-05', ...FAIL } } } });
    const user = userEvent.setup(); await open(user, 'TEST & TAG'); await start(user); await user.click(await screen.findByText('Workshop')); await user.click(await screen.findByText('Weird Appliance')); await seen();
    expect(screen.getAllByText(/Strange Type/).length).toBeGreaterThan(0);
  });
  it('Thermographic: the Edit form of a failed photo shows the stored rectified action AND the stored responsibility', async () => {
    S('thermo-projects-v1', site([{ id: 'a1', name: 'Wash Plant', boards: [{ id: 'b1', name: 'MSB 1', circuits: ['c1'], circuitNames: { c1: 'Main incomer' } }] }])); S('thermo-meta-v1', META); S('thermo-results-v1', { s1: { a1: { b1: { c1: [{ id: '1', flirFile: '1001', temp: '90', result: 'FAIL', lastTested: '2026-10-05', ...FAIL }] } } } });
    const user = userEvent.setup(); await open(user, 'THERMOGRAPHIC'); await start(user); await user.click(await screen.findByText('Wash Plant')); await user.click(await screen.findByText('MSB 1')); await user.click(await screen.findByText('Main incomer'));
    expect(await screen.findAllByText(/Custom Fix R/)).not.toHaveLength(0);                                                  // the logged-photo row shows the rectified action
    await user.click(screen.getByRole('button', { name: /^Edit$/ })); await sleep(300);
    const vals = [...document.querySelectorAll('input,textarea,select')].map(e => e.value); expect(vals).toContain('Custom Person P'); expect(vals).toContain('Custom Fix R'); expect(errs.join(' | ')).toBe('');
  });
  it('SWB', async () => {
    S('swb-projects-v1', site([{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }])); S('swb-meta-v1', META); S('swb-results-v1', { s1: { a1: { b1: { enclosure: { status: 'fail', lastTested: '2026-10-05', ...FAIL } } } } });
    const user = userEvent.setup(); await open(user, 'SWITCHBOARD'); await start(user); await user.click(await screen.findByText('Plant')); await user.click(await screen.findByText('MSB')); await user.click(await screen.findByText('Enclosure Condition')); await seen();
  });
  it('IRT', async () => {
    S('irt-projects-v1', site([{ id: 'a1', name: 'Plant Room', panels: [{ id: 'p1', name: 'DB1', items: ['m1'], itemNames: { m1: 'Motor 1' } }] }])); S('irt-meta-v1', META); S('irt-results-v1', { s1: { a1: { p1: { m1: { status: 'fail', testVoltage: '500V', readings: {}, lastTested: '2026-10-05', ...FAIL } } } } });
    const user = userEvent.setup(); await open(user, 'INSULATION RESISTANCE TESTING'); await start(user); await user.click(await screen.findByText('Plant Room')); await user.click(await screen.findByText('DB1')); await user.click(await screen.findByText('Motor 1')); await user.click(await screen.findByRole('button', { name: /Understood/ })); await seen();
  });
  it('ELT', async () => {
    S('elt-projects-v2', site([{ id: 'ar', name: 'Plant Room', assets: [{ id: 'a1', assetLocation: 'Door 1', assetId: '', type: 'Odd Fitting Type', typeOther: '', maintained: '', fitting: '' }] }])); S('elt-meta-v1', META); S('elt-audit-active-v1', { v: 1, sites: { s1: {} } }); S('elt-results-v1', { s1: { a1: { visual: 'pass', discharge: 'fail', switching: 'pass', charging: 'pass', lastTested: '2026-10-05', ...FAIL } } });
    const user = userEvent.setup(); await open(user, 'EMERGENCY LIGHTING'); await user.click(screen.getByRole('button', { name: /^Audit$/ })); await user.click(await screen.findByText('Door 1')); await seen();
  });
  it('Welder', async () => {
    S('welder-projects-v2', site([{ id: 'ar', name: 'Workshop', assets: [{ id: 'a1', assetId: 'WLD-1', brand: 'Kemppi', model: 'Mig', serial: '1' }] }])); S('welder-meta-v1', META); S('welder-audit-active-v1', { v: 1, sites: { s1: {} } }); S('welder-results-v1', { s1: { a1: { items: { visual: { result: 'fail', value: '', action: '' } }, lastTested: '2026-10-05', ...FAIL } } });
    const user = userEvent.setup(); await open(user, 'WELDER TESTING'); await user.click(screen.getByRole('button', { name: /^Audit$/ })); await user.click((await screen.findAllByText(/WLD-1/))[0]); await seen();
  });
  it('GSD: a category, common defect and responsibility that are in none of the lists', async () => {
    S('gsd-projects-v1', site([{ id: 'a1', name: 'Yard' }])); S('gsd-meta-v1', META); S('gsd-audit-active-v1', { v: 1, sites: { s1: {} } });
    S('gsd-items-v1', { s1: [{ id: 'i1', areaId: 'a1', assetLocation: 'Gate', category: 'Odd Category', commonDefect: 'Odd Defect', description: 'Loose guard', descAuto: '', photos: [], priority: 'H', responsibility: 'Custom Person P', dueDate: '', lastTested: '2026-10-05' }] });
    const user = userEvent.setup(); await open(user, 'GENERAL SITE DEFECTS'); await user.click(screen.getByRole('button', { name: /^Audit$/ })); await user.click((await screen.findAllByTestId('gsd-card'))[0]);
    await screen.findByText('Loose guard'); const vals = [...document.querySelectorAll('input,textarea,select')].map(e => e.value); expect(vals).toEqual(expect.arrayContaining(['Odd Category', 'Odd Defect', 'Custom Person P'])); expect(errs.join(' | ')).toBe('');
  });
});

describe('Excel exports write the stored values with no settings on the phone (no PDF export exists)', () => {
  let payload;
  beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
  afterEach(() => { delete window.webkit; });
  const meta = { auditor: 'Jane', testDate: '2026-09-21', nextTestDate: '2027-09-21', pushDate: '2026-09-21', injectDate: '2026-09-21' };
  const textOf = async () => { expect(payload, 'the export produced a file').not.toBeNull(); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64')); const cells = []; wb.eachSheet(ws => ws.eachRow(r => r.eachCell(c => cells.push(String(c.value?.result ?? c.value ?? ''))))); return cells.join('\n'); };
  const expectStored = async (...words) => { const t = await textOf(); for (const w of words) expect(t, w).toContain(w); };
  const F = { defectId: 'D-9', rectified: 'Custom Fix R', responsibility: 'Custom Person P', priority: 'H' };
  it('RCD', async () => {
    const project = { id: 'p', name: 'Site R', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'A', panels: [{ id: 'pn', name: 'MSB', circuits: ['C1'], circuitMeta: {} }] }] };
    await exportExcel({ p: { a: { pn: { C1: { push: { status: 'fail', ...F }, inject: {} } } } } }, project, meta, 'push', null); await expectStored('Custom Fix R', 'Custom Person P');
  });
  it('IEL', async () => {
    const project = { id: 'p', name: 'Site I', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'A', panels: [{ id: 'p1', name: 'estops', circuits: ['x'], machineNames: { x: 'X' } }] }] };
    await exportIELExcel(project, { a: { estops: { x: { status: 'fail', ...F, notes: 'n' } } } }, meta); await expectStored('Custom Fix R', 'Custom Person P');
  });
  it('TAT (a frequency and equipment type that are in no list)', async () => {
    const project = { id: 'p', name: 'Site T', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'A', defaultFreq: '5', items: ['x'], itemNames: { x: 'Weird Appliance' }, itemTags: {}, itemEquipTypes: { x: 'Strange Type' }, itemFreqs: { x: '5' } }] };
    await exportTATExcel(project, { a: { x: { status: 'fail', visualCheck: 'pass', electricalCheck: 'fail', equipType: 'Strange Type', freq: '5', ...F } } }, meta); await expectStored('Custom Fix R', 'Custom Person P', 'Weird Appliance');
  });
  it('Thermographic', async () => {
    const project = { id: 'p', name: 'Site H', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'A', boards: [{ id: 'b', name: 'MSB', circuits: ['c1'], circuitNames: { c1: 'C1' } }] }] };
    await exportThermoExcel(project, { a: { b: { c1: [{ id: '1', flirFile: '0001', temp: '', result: 'FAIL', notes: '', rectifiedDate: '', ...F }] } } }, meta); await expectStored('Custom Fix R', 'Custom Person P');
  });
  it('IRT', async () => {
    const project = { id: 'p', name: 'Site N', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'A', panels: [{ id: 'pn', name: 'MCC1', items: ['x'], itemNames: { x: 'X' } }] }] };
    await exportIRTExcel(project, { p: { a: { pn: { x: { status: 'untested', testVoltage: '500V', readings: { L1E: '<1' }, ...F } } } } }, meta); await expectStored('Custom Fix R', 'Custom Person P');
  });
  it('SWB', async () => {
    const project = { id: 's1', name: 'Site S', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Area', boards: [{ id: 'b', name: 'MSB' }] }] };
    await exportSWBExcel(project, { s1: { ar: { b: { ventilation: { status: 'fail', comment: 'x', risk: 'H', ...F } } } } }, meta); await expectStored('Custom Fix R', 'Custom Person P');
  });
  it('ELT (a fitting type that is in no list)', async () => {
    const project = toAreas({ id: 'p1', name: 'Example Quarry', company: '', abn: '', licence: '', assets: [{ id: 'a1', location: 'Example Quarry', assetLocation: 'North Door', assetId: 'EL-001', type: 'Odd Fitting Type', maintained: 'Maintained', fitting: 'Generic' }] });
    await exportELTExcel(project, { p1: { a1: { visual: 'fail', discharge: 'pass', switching: 'pass', charging: 'pass', ...F } } }, meta); await expectStored('Odd Fitting Type', 'D-9');
  });
  it('Welder', async () => {
    const keys = WELDER_CHECKLIST.map(c => c.key); const project = toAreas({ id: 'p1', name: 'Example Quarry', company: '', abn: '', licence: '', assets: [{ id: 'a1', location: 'Example Workshop', assetId: 'W001', brand: 'Acme', model: 'WeldMaster', serial: 'SN-1' }] });
    const items = Object.fromEntries(keys.map((k, i) => [k, { result: i === 0 ? 'fail' : 'pass', value: '', action: '' }]));
    await exportWelderExcel(project, { p1: { a1: { items, ...F } } }, meta); await expectStored('Custom Fix R', 'Custom Person P');
  });
  it('GSD', async () => {
    await exportGSDExcel({ id: 's1', name: 'Site G', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant' }] }, [{ id: 'i', areaId: 'a1', assetLocation: 'Pump', category: 'Odd Category', commonDefect: 'Odd Defect', description: 'Loose guard', descAuto: '', photos: [], priority: 'H', responsibility: 'Custom Person P', dueDate: '' }], meta);
    await expectStored('Odd Category', 'Loose guard', 'Custom Person P');                                   // (the export never writes the commonDefect field itself: picking one copies its label into the description)
  });
});

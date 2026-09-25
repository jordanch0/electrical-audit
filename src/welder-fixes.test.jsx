// Welder: (1) corrected score, live in the UI; (2) Date Tested / Prepared By / Test Instruments are SITE-level only;
// (3) Home "Reset all results" (ELT + Welder) is the shared ConfirmReset with the older modules' labelled underline button.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExcelJS from 'exceljs';
import AppRoot, { WELDER_CHECKLIST, exportWelderExcel, welderRegisterRows, welderGetRes, migrateProjectToAreas } from './App.jsx';

const ls = k => JSON.parse(localStorage.getItem(k));
const keys = WELDER_CHECKLIST.map(c => c.key);
let payload;
beforeEach(() => { localStorage.clear(); payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { cleanup(); delete window.webkit; });

const site = { id: 'dixon', name: 'Dixon Quarry Group', company: 'Co', abn: '', licence: '', areas: [
  { id: 'area-onr', name: 'ONR Workshop', assets: [{ id: 'a1', assetId: 'W001', brand: 'Kemppi', model: 'Evo', serial: '1' }, { id: 'a2', assetId: 'W002', brand: 'Unimig', model: 'Razor', serial: '2' }] } ] };
const meta = { auditor: 'Jordan', testDate: '2026-07-13', nextTestDate: '2026-10-13', instruments: 'Fluke 1587' };
const seed = extra => {
  localStorage.setItem('welder-projects-v2', JSON.stringify([site]));
  localStorage.setItem('welder-meta-v1', JSON.stringify({ dixon: meta }));
  Object.entries(extra || {}).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
};
const card = i => screen.getByText(new RegExp(`^${i + 1}\\. ${WELDER_CHECKLIST[i].label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)).parentElement;
const setResult = (user, i, label) => user.click(within(card(i)).getByRole('button', { name: label }));
const score = () => screen.getByText('SCORE').parentElement.textContent.match(/(\d+\.\d%|—)/)[0];
async function openWelder(user, tab) {
  render(<AppRoot />);
  await user.click(screen.getByText('WELDER TESTING'));
  await user.click(await screen.findByText('Dixon Quarry Group', { selector: 'div' }));
  if (tab) await user.click(screen.getByRole('button', { name: tab }));
}

describe('Welder score, live in the UI', () => {
  it('0.0% -> PASS 8.3% -> FAIL leaves 8.3% -> N/A raises it to 9.1%; all N/A shows "—"', async () => {
    const user = userEvent.setup();
    seed();
    await openWelder(user, 'Audit');
    await user.click(await screen.findByText('W001'));
    expect(score()).toBe('0.0%');                       // nothing answered: 0 / 12
    await setResult(user, 0, 'PASS');  expect(score()).toBe('8.3%');   // 1 / 12
    await setResult(user, 1, 'FAIL');  expect(score()).toBe('8.3%');   // unchanged: a Fail is neither in the numerator nor out of the denominator
    await setResult(user, 2, 'N/A');   expect(score()).toBe('9.1%');   // 1 / 11
    for (let i = 3; i < 12; i++) await setResult(user, i, 'N/A');
    await setResult(user, 0, 'N/A');   await setResult(user, 1, 'N/A');
    expect(score()).toBe('—');                          // every item N/A: nothing left to score
  });

  it('the exported per-welder sheet carries the corrected (partial) score; the Report tab shows none', async () => {
    seed({ 'welder-results-v1': { dixon: { a1: { items: { visual: { result: 'pass' }, clamp: { result: 'fail' } } } } } }); // 1 Pass, 1 Fail, 10 blank
    await exportWelderExcel(migrateProjectToAreas(site), { dixon: ls('welder-results-v1').dixon }, meta);
    await waitFor(() => expect(payload).toBeTruthy());
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64'));
    const cells = []; wb.getWorksheet('W001').eachRow(r => r.eachCell(c => cells.push(String(c.value))));
    expect(cells).toContain('8.3%');                    // 1 / 12 for an incomplete welder (the old formula printed 50.0%)
    expect(cells).not.toContain('50.0%');
    const user = userEvent.setup();
    cleanup();
    await openWelder(user, 'Report');
    expect(screen.queryByText('SCORE')).not.toBeInTheDocument();
  });
});

describe('Date Tested / Prepared By / Test Instruments are site-level only', () => {
  it('the welder page has no such fields; Home has them with plain labels', async () => {
    const user = userEvent.setup();
    seed();
    await openWelder(user);                              // Home
    ['DATE TESTED', 'NEXT TEST DUE', 'TEST INSTRUMENTS', 'AUDITOR'].forEach(l => expect(screen.getByText(l)).toBeInTheDocument());
    expect(screen.queryByText(/default for all welders/)).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Fluke 1587')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Audit' }));
    await user.click(await screen.findByText('W001'));
    ['DATE TESTED', 'PREPARED BY', 'TEST INSTRUMENTS'].forEach(l => expect(screen.queryByText(l)).not.toBeInTheDocument());
    expect(screen.queryByDisplayValue('Fluke 1587')).not.toBeInTheDocument();
  });

  it('stored per-welder overrides from older data are ignored everywhere and dropped on the next save', async () => {
    const stale = { date: '2000-01-01', preparedBy: 'Someone Else', instruments: 'Old Meter', items: Object.fromEntries(keys.map(k => [k, { result: 'pass', value: '', action: '' }])) };
    expect(welderGetRes({ dixon: { a1: stale } }, 'dixon', 'a1')).not.toHaveProperty('date');
    expect(welderGetRes({ dixon: { a1: stale } }, 'dixon', 'a1')).not.toHaveProperty('preparedBy');
    const proj = migrateProjectToAreas(site);
    expect(welderRegisterRows(proj, { dixon: { a1: stale } }, meta)[0].cells[4]).toBe('13/07/2026');   // Register: site Date Tested, not 01/01/2000
    await exportWelderExcel(proj, { dixon: { a1: stale } }, meta);
    await waitFor(() => expect(payload).toBeTruthy());
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64'));
    const sh = wb.getWorksheet('W001');
    expect([sh.getCell('A6').value, sh.getCell('C6').value, sh.getCell('C5').value]).toEqual(['Prepared By: Jordan', 'Test Instruments: Fluke 1587', 'Date Tested: 13/07/2026']);
    // the app opens such a record without trouble and the override is gone from storage once the welder is edited
    seed({ 'welder-results-v1': { dixon: { a1: stale } } });
    const user = userEvent.setup();
    cleanup();
    await openWelder(user, 'Audit');
    await user.click(await screen.findByText('W001'));
    await setResult(user, 0, 'FAIL');
    await waitFor(() => expect(ls('welder-results-v1').dixon.a1.items.visual.result).toBe('fail'));
    const saved = ls('welder-results-v1').dixon.a1;
    ['date', 'preparedBy', 'instruments'].forEach(k => expect(saved).not.toHaveProperty(k));
  });
});

describe('Home reset: shared ConfirmReset with the older modules\' labelled underline button', () => {
  const swbResetStyle = async () => {
    localStorage.setItem('swb-projects-v1', JSON.stringify([{ id: 's1', name: 'Site S', company: '', abn: '', licence: '', areas: [] }]));
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD'));
    await user.click(await screen.findByText('Site S', { selector: 'div' }));
    const css = (await screen.findByRole('button', { name: 'Reset all test results' })).style.cssText;
    cleanup(); localStorage.clear();
    return css;
  };
  const MODS = [
    { name: 'ELT', pfx: 'elt', card: 'EMERGENCY LIGHTING', site: 'Site E', seed: () => {
        localStorage.setItem('elt-projects-v2', JSON.stringify([{ id: 'p1', name: 'Site E', company: '', abn: '', licence: '', areas: [{ id: 'area-e', name: 'Site E', assets: [{ id: 'a1', assetLocation: 'Door', assetId: '', type: 'Emergency Exit Sign', typeOther: '', maintained: '', fitting: '' }] }] }]));
        localStorage.setItem('elt-results-v1', JSON.stringify({ p1: { a1: { visual: 'pass', discharge: 'pass', switching: 'pass', charging: 'pass' } } })); }, pid: 'p1' },
    { name: 'Welder', pfx: 'welder', card: 'WELDER TESTING', site: 'Dixon Quarry Group', seed: () => seed({ 'welder-results-v1': { dixon: { a1: { items: { visual: { result: 'pass' } } } } } }), pid: 'dixon' },
  ];
  it.each(MODS)('$name: labelled underline button (same style as SWB), prompt + Reset / Keep, results cleared only on Reset', async m => {
    const swbCss = await swbResetStyle();
    m.seed();
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText(m.card));
    await user.click(await screen.findByText(m.site, { selector: 'div' }));
    const idle = await screen.findByRole('button', { name: 'Reset all test results' });
    expect(idle.style.cssText).toBe(swbCss);                                   // identical look to the older modules' button
    expect(idle.style.textDecoration).toBe('underline');
    expect(screen.queryByText('Reset all results?')).not.toBeInTheDocument();   // no bare bin icon / no prompt until asked
    await user.click(idle);
    const prompt = await screen.findByText('Reset all results?');
    await user.click(within(prompt.parentElement).getByRole('button', { name: 'Keep' }));
    expect(screen.queryByText('Reset all results?')).not.toBeInTheDocument();
    expect(Object.keys(ls(`${m.pfx}-results-v1`)[m.pid])).toEqual(['a1']);      // Keep changes nothing
    await user.click(await screen.findByRole('button', { name: 'Reset all test results' }));
    await user.click(within((await screen.findByText('Reset all results?')).parentElement).getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(ls(`${m.pfx}-results-v1`)[m.pid]).toEqual({}));
  });
});

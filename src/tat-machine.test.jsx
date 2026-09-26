// TAT "Machine Used": a site / audit-level free-text field (meta.machine in tat-meta-v1), entered once on Home, shown on the Report and in the export
// header (E3, printed even when blank), carried by History snapshots and by Complete Audit. Additive + optional: legacy meta reads as "".
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExcelJS from 'exceljs';
import AppRoot, { exportTATExcel } from './App.jsx';

const ls = k => JSON.parse(localStorage.getItem(k));
const project = { id: 't1', name: 'Site T', company: 'Co', abn: '', licence: '', areas: [
  { id: 'a1', name: 'Workshop', defaultFreq: '3', items: ['i1', 'i2'], itemNames: { i1: 'Drill', i2: 'Saw' }, itemTags: { i1: '1', i2: '2' }, itemEquipTypes: { i1: 'Power Tool', i2: 'Power Tool' }, itemFreqs: { i1: '3', i2: '3' } }] };
const tested = { i1: { status: 'pass', visualCheck: true, electricalCheck: 'pass', lastTested: '2026-09-21', notes: '', equipType: 'Power Tool', freq: '3' }, i2: { status: 'fail', visualCheck: true, electricalCheck: 'fail', lastTested: '2026-09-21', notes: '', priority: 'H', defectId: '5', rectified: 'R', responsibility: 'Client', equipType: 'Power Tool', freq: '3' } };
let payload;
beforeEach(() => {
  cleanup(); localStorage.clear(); payload = null;
  window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } };
  localStorage.setItem('tat-projects-v1', JSON.stringify([project]));
  localStorage.setItem('tat-results-v1', JSON.stringify({ t1: { a1: tested } }));
});
afterEach(() => { cleanup(); delete window.webkit; });
const seedMeta = m => localStorage.setItem('tat-meta-v1', JSON.stringify({ t1: { auditor: 'Jane', testDate: '2026-09-21', ...m } }));
async function openHome(user) {
  render(<AppRoot />);
  await user.click(screen.getByText('TEST & TAG'));
  await user.click(await screen.findByText('Site T', { selector: 'div' }));
}
const field = () => screen.getByRole('textbox', { name: 'Machine used' });
const loadWb = async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64')); return wb; };

describe('Home: the MACHINE USED input', () => {
  it('sits directly below TEST DATE in the meta card, with the approved label and placeholder', async () => {
    seedMeta({}); const user = userEvent.setup(); await openHome(user);
    const label = screen.getByText('MACHINE USED');
    expect(screen.getByText('TEST DATE').compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(label.compareDocumentPosition(screen.getByText('Overall Progress')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(field()).toHaveAttribute('placeholder', 'e.g. Rigel 288 (S/N …), cal. due …');
    expect(field()).toHaveValue('');
  });

  it('saves live as you type, persists across a reload, and is NOT required to start an audit', async () => {
    seedMeta({}); const user = userEvent.setup(); await openHome(user);
    await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ }));    // no machine entered: the audit still starts
    expect(await screen.findByText('Workshop')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Home$/ }));
    await user.type(field(), 'Rigel 288');
    await waitFor(() => expect(ls('tat-meta-v1').t1.machine).toBe('Rigel 288'));
    cleanup(); await openHome(user);
    expect(field()).toHaveValue('Rigel 288');
    expect(ls('tat-meta-v1').t1).toMatchObject({ auditor: 'Jane', testDate: '2026-09-21', machine: 'Rigel 288' });   // other meta untouched
  });

  it('legacy meta (no field) reads as empty and opening Home never writes a machine key', async () => {
    seedMeta({}); const before = JSON.stringify(ls('tat-meta-v1'));
    const user = userEvent.setup(); await openHome(user);
    expect(field()).toHaveValue('');
    expect(JSON.stringify(ls('tat-meta-v1'))).toBe(before);
    expect('machine' in ls('tat-meta-v1').t1).toBe(false);
  });
});

describe('Complete Audit and History carry the machine', () => {
  it('Complete Audit keeps the machine for the next audit and the snapshot records the one used', async () => {
    seedMeta({ machine: 'Rigel 288 (S/N 4471)' }); const user = userEvent.setup(); await openHome(user);
    await user.click(await screen.findByRole('button', { name: /Complete Test & Tag Audit/ }));
    await user.click(screen.getByRole('button', { name: /Yes, Complete/ }));
    await waitFor(() => expect(ls('tat-history-v1')).toHaveLength(1));
    expect(ls('tat-history-v1')[0].meta.machine).toBe('Rigel 288 (S/N 4471)');        // the audit's record
    expect(ls('tat-meta-v1').t1.machine).toBe('Rigel 288 (S/N 4471)');                 // carried forward (same machine next time)
    expect(field()).toHaveValue('Rigel 288 (S/N 4471)');
  });

  it('exporting a History snapshot through the real UI writes the snapshot\'s machine in the header', async () => {
    seedMeta({ machine: 'Rigel 288 (S/N 4471)' }); const user = userEvent.setup(); await openHome(user);
    await user.click(await screen.findByRole('button', { name: /Complete Test & Tag Audit/ }));
    await user.click(screen.getByRole('button', { name: /Yes, Complete/ }));
    await waitFor(() => expect(ls('tat-history-v1')).toHaveLength(1));
    // the machine changes for the NEXT audit — the old snapshot must still export the one it was done with
    await user.clear(field()); await user.type(field(), 'Other machine');
    await user.click(screen.getByRole('button', { name: /History/ }));
    await user.click(await screen.findByText('Test & Tag Audit'));
    await user.click(screen.getByRole('button', { name: 'View Results' }));
    await user.click(await screen.findByRole('button', { name: /Export/ }));
    await waitFor(() => expect(payload).toBeTruthy());
    expect(String((await loadWb()).getWorksheet('Test & Tag').getCell('E3').value)).toBe('Machine Used: Rigel 288 (S/N 4471)');
  });
});

describe('Report tab: "Machine: …" under the auditor / date line', () => {
  async function openReport(user) { await openHome(user); await user.click(screen.getByRole('button', { name: 'Report' })); }
  it('shows the machine when set, after the auditor and date lines and before the stat tiles', async () => {
    seedMeta({ machine: '  Rigel 288  ' }); const user = userEvent.setup(); await openReport(user);
    const line = await screen.findByTestId('tat-report-machine');
    expect(line).toHaveTextContent('Machine: Rigel 288');
    expect(screen.getByText(/TEST & TAG REPORT/).compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/Tested:/).compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(line.compareDocumentPosition(screen.getByText('AREA SUMMARY')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('shows nothing when the machine is blank, whitespace or legacy (missing)', async () => {
    for (const m of [{}, { machine: '' }, { machine: '   ' }]) {
      cleanup(); seedMeta(m); const user = userEvent.setup(); await openReport(user);
      await screen.findByText('AREA SUMMARY');
      expect(screen.queryByTestId('tat-report-machine')).not.toBeInTheDocument();
    }
  });
});

describe('export header: "Machine Used: …" at E3', () => {
  const run = m => exportTATExcel(project, { a1: tested }, { auditor: 'Jane', testDate: '2026-09-21', ...m });
  it('carries the value next to Auditor and Date Tested; merged across the rest of row 3', async () => {
    await run({ machine: 'Rigel 288 (S/N 4471)' }); const ws = (await loadWb()).getWorksheet('Test & Tag');
    expect(String(ws.getCell('A3').value)).toBe('Auditor: Jane'); expect(String(ws.getCell('C3').value)).toBe('Date Tested: 21/09/2026');
    expect(String(ws.getCell('E3').value)).toBe('Machine Used: Rigel 288 (S/N 4471)');
    expect(Object.keys(ws._merges).map(k => ws._merges[k].range)).toContain('E3:L3');
  });
  it('is printed even when blank, whitespace-free legacy or missing (label only)', async () => {
    for (const m of [{}, { machine: '' }]) { payload = null; await run(m); expect(String((await loadWb()).getWorksheet('Test & Tag').getCell('E3').value)).toBe('Machine Used: '); }
  });
  it('the Defects sheet is unchanged (its row 3 still carries the priority legend)', async () => {
    await run({ machine: 'X' }); const ws = (await loadWb()).getWorksheet('Defects');
    expect(String(ws.getCell('E3').value)).toMatch(/^Priority: L Low/);
  });
});

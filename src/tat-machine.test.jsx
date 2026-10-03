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
// The main sheet's column-A text lines, in order: the footer line starting with `prefix` and the line right after it.
const footerLine = (wb, prefix) => { const lines = []; wb.getWorksheet('Test & Tag').eachRow(row => lines.push(String(row.getCell(1).value == null ? '' : row.getCell(1).value))); const i = lines.findIndex(l => l.startsWith(prefix)); return { text: lines[i], next: lines[i + 1] }; };

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

  it('exporting a History snapshot through the real UI writes the snapshot\'s machine in the footer ("Test Machine:" above Notes)', async () => {
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
    // the machine is report-level and left the header (2026-10-02 shared header): it is the footer line directly above "Notes:"
    expect(footerLine(await loadWb(), 'Test Machine:')).toEqual({ text: 'Test Machine: Rigel 288 (S/N 4471)', next: 'Notes: ' });
    // an ARCHIVED report carries the same shared header as a live one: logo row, title, company, auditor / dates (earliest next-due of the items passed), table on row 6
    const arch = (await loadWb()).getWorksheet('Test & Tag');
    expect([1, 2, 3, 4, 5].map(r => String(arch.getCell(r, 1).value == null ? '' : arch.getCell(r, 1).value))).toEqual(['', 'Site T  –  Test & Tag  (In-Service Electrical Equipment)', 'Co', 'Auditor: Jane  |  Date Tested: 21/09/2026  |  Next Test Due (earliest): 21/12/2026', '']);
    expect(String(arch.getCell(6, 1).value)).toBe('#');
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

describe('export: "Test Machine:" footer line + "Next Test Due (earliest)" in header row 4', () => {
  // 2026-10-02 (shared header): the machine is a report-level value that used to ride in the header; it is now the footer line directly above "Notes:". Header row 4 is the
  // standard "Auditor | Date Tested | next-due" line; TAT has no single report-level due date (each item has its own frequency), so it shows the EARLIEST due date among the
  // items PASSED in this report (failed / N/A / untested / undated items are excluded; blank when none qualify).
  const run = (m, results = { a1: tested }, proj = project) => exportTATExcel(proj, results, { auditor: 'Jane', testDate: '2026-09-21', ...m });
  it('the machine is the footer line directly above Notes (and no longer in the header); row 4 is Auditor | Date Tested | Next Test Due (earliest) in one full-width merged cell', async () => {
    await run({ machine: 'Rigel 288 (S/N 4471)' }); const wb = await loadWb(); const ws = wb.getWorksheet('Test & Tag');
    expect(footerLine(wb, 'Test Machine:')).toEqual({ text: 'Test Machine: Rigel 288 (S/N 4471)', next: 'Notes: ' });
    expect(JSON.stringify([1, 2, 3, 4, 5].map(r => ws.getCell(r, 1).value))).not.toMatch(/Machine/);
    expect(String(ws.getCell('A4').value)).toBe('Auditor: Jane  |  Date Tested: 21/09/2026  |  Next Test Due (earliest): 21/12/2026');   // i1 passed 21/09/2026 + 3 months; i2 FAILED and is ignored
    expect(Object.keys(ws._merges).map(k => ws._merges[k].range).some(r => /^A4:[A-Z]+4$/.test(r))).toBe(true);
  });
  it('the footer line is printed even when the machine is blank or missing (label only)', async () => {
    for (const m of [{}, { machine: '' }]) { payload = null; await run(m); expect(footerLine(await loadWb(), 'Test Machine:')).toEqual({ text: 'Test Machine: ', next: 'Notes: ' }); }
  });
  it('the Defects sheet carries the SAME header (row 4 identical) and the always-present footer with the priority legend', async () => {
    await run({ machine: 'X' }); const wb = await loadWb(); const ws = wb.getWorksheet('Defects'); const main = wb.getWorksheet('Test & Tag');
    expect(String(ws.getCell('A4').value)).toBe(String(main.getCell('A4').value)); expect(String(ws.getCell('A2').value)).toBe(String(main.getCell('A2').value));
    const lines = []; ws.eachRow(row => lines.push(String(row.getCell(1).value == null ? '' : row.getCell(1).value)));
    expect(lines).toContain('Priority: L Low · M Medium · H High · U Urgent'); expect(lines).toContain('Defects recorded: 1');
  });
  it('earliest next-due: only PASSED items with a due date count, and the earliest wins (a failed item with an earlier date, an N/A one and an untested one are ignored)', async () => {
    const proj = JSON.parse(JSON.stringify(project)); proj.areas[0].items = ['i1', 'i2', 'i3', 'i4']; proj.areas[0].itemNames = { i1: 'A', i2: 'B', i3: 'C', i4: 'D' }; proj.areas[0].itemTags = { i1: '1', i2: '2', i3: '3', i4: '4' };
    proj.areas[0].itemEquipTypes = { i1: 'x', i2: 'x', i3: 'x', i4: 'x' }; proj.areas[0].itemFreqs = { i1: '3', i2: '1', i3: '1', i4: '1' };
    const res = { a1: {
      i1: { status: 'pass', lastTested: '2026-09-21', freq: '3' },                 // due 21/12/2026
      i2: { status: 'pass', lastTested: '2026-08-01', freq: '1' },                 // due 01/09/2026  <- the earliest PASSED
      i3: { status: 'fail', lastTested: '2026-01-01', freq: '1', defectId: 'D1' }, // due 01/02/2026 but FAILED -> excluded
      i4: { status: 'na', lastTested: '2026-01-01', freq: '1' } } };               // N/A -> excluded
    await run({}, res, proj); expect(String((await loadWb()).getWorksheet('Test & Tag').getCell('A4').value)).toBe('Auditor: Jane  |  Date Tested: 21/09/2026  |  Next Test Due (earliest): 01/09/2026');
  });
  it('blank when no item qualifies (everything failed / N/A / untested / undated) — the label stays', async () => {
    const res = { a1: { i1: { status: 'fail', lastTested: '2026-09-21', freq: '3' }, i2: { status: 'pass', lastTested: '', freq: '3' } } };
    await run({}, res); expect(String((await loadWb()).getWorksheet('Test & Tag').getCell('A4').value)).toBe('Auditor: Jane  |  Date Tested: 21/09/2026  |  Next Test Due (earliest): ');
  });
});

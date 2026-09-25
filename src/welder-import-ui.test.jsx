// Welder Manual / Import toggle on the site list: upload -> preview (with warnings) -> import creates the site.
// Includes the full real pipeline: seeded site -> Complete Audit -> History -> Export -> that .xlsx -> import into a fresh app.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';
import AppRoot, { WELDER_CHECKLIST } from './App.jsx';

const HEAD = ['Location', 'Asset ID', 'Welder (Machine)', 'Serial Number'];
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const fileFrom = (rows, name = 'welders.xlsx') => {
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'S');
  return new File([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], name, { type: XLSX_MIME });
};
const ls = k => JSON.parse(localStorage.getItem(k));
// The app persists an empty {} / [] on mount, so "nothing was created" means empty, not absent.
const isEmpty = k => { const v = localStorage.getItem(k); return v === null || v === '{}' || v === '[]'; };
let payload;
beforeEach(() => { localStorage.clear(); payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { cleanup(); delete window.webkit; });

async function openImport(user) {
  render(<AppRoot />);
  await user.click(screen.getByText('WELDER TESTING'));
  await user.click(await screen.findByRole('button', { name: '+ Add / Import Site' }));
  await user.click(screen.getByRole('button', { name: /Import Excel/ }));
}

describe('Welder site list: Manual / Import toggle', () => {
  it('shows the new wording and the rose-accented toggle with icons', async () => {
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('WELDER TESTING'));
    expect(screen.getByText('No sites yet — add one or import from Excel below.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Add / Import Site' }));
    const manual = screen.getByRole('button', { name: /Manual Entry/ });
    const imp = screen.getByRole('button', { name: /Import Excel/ });
    expect(manual.querySelector('svg')).toBeTruthy(); expect(imp.querySelector('svg')).toBeTruthy();
    expect(manual.style.color).toBe('rgb(190, 24, 93)');        // active tab: Welder rose text
    expect(manual.style.background).toBe('rgb(252, 231, 243)'); // on the #fce7f3 tint
    expect(imp.style.color).not.toBe('rgb(190, 24, 93)');
    await user.click(imp);
    expect(imp.style.color).toBe('rgb(190, 24, 93)');
    expect(screen.getByText(/Only the welder register is imported/)).toBeInTheDocument();
  });

  it('manual add still works', async () => {
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('WELDER TESTING'));
    await user.click(screen.getByRole('button', { name: '+ Add / Import Site' }));
    await user.type(screen.getByPlaceholderText('Site name'), 'Manual Site');
    await user.click(screen.getByRole('button', { name: 'Add Site' }));
    expect(await screen.findByText('Manual Site')).toBeInTheDocument();
    expect(ls('welder-projects-v1')[0]).toMatchObject({ name: 'Manual Site', assets: [] });
  });

  it('upload -> preview with warnings -> editable site -> Import Site saves welders (location defaults to the site name)', async () => {
    const user = userEvent.setup();
    await openImport(user);
    await user.upload(screen.getByTestId('welder-import-file'), fileFrom([
      ['Hearse Road - Firestone — Welder Test'], ['SparkCheck'], [''], [''], HEAD,
      ['', 'W1', 'Kemppi Evo', 'S1'], ['', 'W1', 'Kemppi Evo', 'S1'], ['', '', '', 'S9'], ['Shed', 'W2', '', 'N/A'],
    ]));
    expect(await screen.findByText('✓ Preview')).toBeInTheDocument();
    expect(screen.getByText('2 welders found')).toBeInTheDocument();
    expect(screen.getByText(/1 row skipped \(no Asset ID or Welder \(Machine\)\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 duplicate row ignored/)).toBeInTheDocument();
    expect(screen.getByText(/1 welder: brand and model couldn't be separated/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hearse Road - Firestone')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '✓ Import Site' }));
    await waitFor(() => expect(ls('welder-projects-v1')).toHaveLength(1));
    const p = ls('welder-projects-v1')[0];
    expect(p).toMatchObject({ name: 'Hearse Road - Firestone', company: '' });
    expect(p.assets.map(({ id, ...a }) => a)).toEqual([
      { location: 'Hearse Road - Firestone', assetId: 'W1', brand: 'Kemppi Evo', model: '', serial: 'S1' },
      { location: 'Shed', assetId: 'W2', brand: '', model: '', serial: 'N/A' },
    ]);
    expect(p.assets.every(a => a.id)).toBe(true);
    expect(isEmpty('welder-results-v1')).toBe(true); // structure only
  });

  it('rejects the wrong file type — creating nothing', async () => {
    const user = userEvent.setup();
    await openImport(user);
    fireEvent.change(screen.getByTestId('welder-import-file'), { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText(/Please upload an Excel/)).toBeInTheDocument();
    expect(isEmpty('welder-projects-v1')).toBe(true);
  });

  it('rejects an ELT export and a headerless sheet — creating nothing', async () => {
    const user = userEvent.setup();
    await openImport(user);
    const input = screen.getByTestId('welder-import-file');
    await user.upload(input, fileFrom([['Location', 'Asset Location', 'Asset ID', 'Type'], ['s', 'SE Door', '', 'Exit']]));
    expect(await screen.findByText(/looks like an Emergency Lighting \(ELT\) file/)).toBeInTheDocument();
    await user.upload(input, fileFrom([['just', 'some', 'cells']]));
    expect(await screen.findByText(/Couldn't find the Welder column headings/)).toBeInTheDocument();
    expect(isEmpty('welder-projects-v1')).toBe(true);
  });

  it('Re-upload returns to the chooser; Cancel closes without creating a site', async () => {
    const user = userEvent.setup();
    await openImport(user);
    await user.upload(screen.getByTestId('welder-import-file'), fileFrom([HEAD, ['a', 'W1', 'A B', '1']]));
    await screen.findByText('✓ Preview');
    await user.click(screen.getByRole('button', { name: 'Re-upload' }));
    expect(screen.getByTestId('welder-import-file')).toBeInTheDocument();
    await user.upload(screen.getByTestId('welder-import-file'), fileFrom([HEAD, ['a', 'W1', 'A B', '1']]));
    await screen.findByText('✓ Preview');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: '+ Add / Import Site' })).toBeInTheDocument();
    expect(isEmpty('welder-projects-v1')).toBe(true);
  });

  it('the template download goes through the share bridge and re-imports cleanly', async () => {
    const user = userEvent.setup();
    await openImport(user);
    await user.click(screen.getByRole('button', { name: /Download Import Template/ }));
    await waitFor(() => expect(payload).toBeTruthy());
    expect(payload.filename || payload.name || '').toMatch(/Welder_Import_Template\.xlsx/);
    const buf = Buffer.from(payload.base64, 'base64');
    await user.upload(screen.getByTestId('welder-import-file'), new File([buf], 'Welder_Import_Template.xlsx', { type: XLSX_MIME }));
    expect(await screen.findByText('2 welders found')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Welder Import Template')).toBeInTheDocument(); // placeholder title ignored -> file name used
  });
});

describe('Welder import — full real pipeline (UI export -> import into a fresh app)', () => {
  it('a real History export re-imports every welder with exact Brand / Model and no results', async () => {
    const keys = WELDER_CHECKLIST.map(c => c.key);
    const project = { id: 'p1', name: 'Site A - North', company: 'Co', abn: '1', licence: 'L1', assets: [
      { id: 'a1', location: 'ONR Workshop', assetId: 'W001', brand: 'Lincoln Electric', model: 'Invertec 300', serial: '2699294' },
      { id: 'a2', location: 'ONR Workshop', assetId: 'W002', brand: 'Unimig', model: 'Razor', serial: 'N/A' },
    ] };
    localStorage.setItem('welder-projects-v1', JSON.stringify([project]));
    localStorage.setItem('welder-meta-v1', JSON.stringify({ p1: { auditor: 'Jane', testDate: '2026-07-13', nextTestDate: '2026-10-13', instruments: '' } }));
    localStorage.setItem('welder-results-v1', JSON.stringify({ p1: { a1: { date: '2026-07-13', notes: 'private', items: Object.fromEntries(keys.map(k => [k, { result: 'pass', value: '7 MΩ', action: '' }])) } } }));
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('WELDER TESTING'));
    await user.click(await screen.findByText('Site A - North', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /^Home$/ }));
    await user.click(await screen.findByRole('button', { name: 'Complete Welder Audit' }));
    await user.click(screen.getByRole('button', { name: /Yes, Complete/ }));
    await user.click(screen.getByRole('button', { name: /History/ }));
    await user.click(await screen.findByText('Welder Audit'));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(payload).toBeTruthy());
    const exportedBytes = Buffer.from(payload.base64, 'base64');

    cleanup(); localStorage.clear(); payload = null;                     // brand-new install
    const user2 = userEvent.setup();
    await openImport(user2);
    await user2.upload(screen.getByTestId('welder-import-file'), new File([exportedBytes], 'Welder_Site_A.xlsx', { type: XLSX_MIME }));
    expect(await screen.findByText('2 welders found')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Site A - North')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Co')).toBeInTheDocument();
    expect(screen.queryByText(/couldn't be separated/)).toBeNull();      // exact Brand / Model recovered, no fallback note
    await user2.click(screen.getByRole('button', { name: '✓ Import Site' }));
    await waitFor(() => expect(ls('welder-projects-v1')).toHaveLength(1));
    const p = ls('welder-projects-v1')[0];
    expect(p.assets.map(({ id, ...a }) => a)).toEqual([
      { location: 'ONR Workshop', assetId: 'W001', brand: 'Lincoln Electric', model: 'Invertec 300', serial: '2699294' },
      { location: 'ONR Workshop', assetId: 'W002', brand: 'Unimig', model: 'Razor', serial: 'N/A' },
    ]);
    expect(isEmpty('welder-results-v1')).toBe(true);
    expect(JSON.stringify(p)).not.toMatch(/private|7 MΩ/);
  }, 30000);
});

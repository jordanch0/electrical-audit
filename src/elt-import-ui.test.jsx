// ELT Manual / Import toggle on the site list: upload -> preview (with warnings) -> import creates the site.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';
import AppRoot from './App.jsx';

const HEAD = ['Location', 'Asset Location', 'Asset ID', 'Type', 'Maintained/Non-Maintained', 'Fitting Type/Manufacturer'];
const fileFrom = (rows, name = 'register.xlsx') => {
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'S');
  const arr = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new File([arr], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};
const ls = k => JSON.parse(localStorage.getItem(k));

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

async function openImport(user) {
  render(<AppRoot />);
  await user.click(screen.getByText('EMERGENCY LIGHTING'));
  await user.click(await screen.findByRole('button', { name: '+ Add / Import Site' }));
  await user.click(screen.getByRole('button', { name: /Import Excel/ }));
}

describe('ELT site list: Manual / Import toggle', () => {
  it('shows the new wording and the teal-accented toggle with icons', async () => {
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('EMERGENCY LIGHTING'));
    expect(screen.getByText('No sites yet — add one or import from Excel below.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Add / Import Site' }));
    const manual = screen.getByRole('button', { name: /Manual Entry/ });
    const imp = screen.getByRole('button', { name: /Import Excel/ });
    expect(manual.querySelector('svg')).toBeTruthy(); expect(imp.querySelector('svg')).toBeTruthy();
    expect(manual.style.color).toBe('rgb(15, 118, 110)');       // active tab: ELT teal text
    expect(manual.style.background).toBe('rgb(204, 251, 241)'); // on the #ccfbf1 tint
    expect(imp.style.color).not.toBe('rgb(15, 118, 110)');
    await user.click(imp);
    expect(imp.style.color).toBe('rgb(15, 118, 110)');
  });

  it('uploads a register, previews it with warnings, and imports the site with its fittings', async () => {
    const user = userEvent.setup();
    await openImport(user);
    const rows = [
      ['Hearse Road - Firestone — Emergency Lighting Test'], ['Co Pty Ltd  |  ABN: 98 765 432 109'], [], [],
      HEAD,
      ['', 'SE Door', '007', 'Emergency Exit Sign', 'Maintained', 'Clevertronics'],
      ['', 'SW Roof', '', 'Bulkhead Light', 'Non-Maintained', ''],
      ['', '', '5', 'Emergency Exit Sign', '', ''],
    ];
    await user.upload(screen.getByTestId('elt-import-file'), fileFrom(rows));
    expect(await screen.findByText('✓ Preview')).toBeInTheDocument();
    expect(screen.getByText('2 fittings found')).toBeInTheDocument();
    expect(screen.getByText(/1 row skipped \(no Asset Location\)/)).toBeInTheDocument();
    expect(screen.getByText(/Not in your Type list \(imported as Other\): Bulkhead Light/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hearse Road - Firestone')).toBeInTheDocument(); // editable site name, hyphen intact
    expect(screen.getByDisplayValue('Co Pty Ltd')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Import Site/ }));
    expect(await screen.findByText('Hearse Road - Firestone')).toBeInTheDocument();
    expect(screen.getByText(/2 fittings · 0 tested/)).toBeInTheDocument();
    const proj = ls('elt-projects-v1')[0];
    expect(proj).toMatchObject({ name: 'Hearse Road - Firestone', company: 'Co Pty Ltd', abn: '98 765 432 109' });
    expect(proj.assets.map(a => [a.assetLocation, a.assetId, a.type, a.typeOther, a.maintained, a.location])).toEqual([
      ['SE Door', '007', 'Emergency Exit Sign', '', 'Maintained', 'Hearse Road - Firestone'], // blank Location defaults to the site name
      ['SW Roof', '', 'Other', 'Bulkhead Light', 'Non-Maintained', 'Hearse Road - Firestone'],
    ]);
    expect(ls('elt-results-v1') || {}).toEqual({}); // structure only: no results imported
  });

  it('shows a clear error for a wrong file type or a sheet without the ELT headings, and creates nothing', async () => {
    const user = userEvent.setup({ applyAccept: false }); // let the .txt through the file input so the app's own check runs
    await openImport(user);
    await user.upload(screen.getByTestId('elt-import-file'), fileFrom([['Area', 'Board'], ['A', 'B']]));
    expect(await screen.findByText(/Couldn't find the ELT column headings/)).toBeInTheDocument();
    expect(screen.queryByText('✓ Preview')).not.toBeInTheDocument();
    await user.upload(screen.getByTestId('elt-import-file'), new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(await screen.findByText(/Please upload an Excel/)).toBeInTheDocument();
    expect(ls('elt-projects-v1') || []).toEqual([]); // nothing created
  });

  it('Re-upload returns to the file chooser without creating a site', async () => {
    const user = userEvent.setup();
    await openImport(user);
    await user.upload(screen.getByTestId('elt-import-file'), fileFrom([HEAD, ['', 'SE Door', '', '', '', '']]));
    await screen.findByText('✓ Preview');
    await user.click(screen.getByRole('button', { name: 'Re-upload' }));
    expect(screen.getByRole('button', { name: /Download Import Template/ })).toBeInTheDocument();
    expect(ls('elt-projects-v1') || []).toEqual([]); // nothing created
    void waitFor; void within;
  });
});

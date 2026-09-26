// TAT Equipment Type: "Other" is the built-in, reserved, always-last option with a free-text box (ELT's Type pattern) — NOT an ordinary list entry that can be
// deleted / duplicated. Stored as one string as before (a listed type, or the typed text; "Other" when left blank), so nothing existing changes shape.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { tatCleanEquipTypes, TAT_DEFAULT_EQUIP_TYPES } from './App.jsx';

const ls = k => JSON.parse(localStorage.getItem(k));
afterEach(() => cleanup());

describe('the list and its cleaning', () => {
  it('the default list has no literal "Other"', () => { expect(TAT_DEFAULT_EQUIP_TYPES).toEqual(['Power Tool', 'Extension Lead', 'RCD Portable', 'Appliance', 'Double Adaptor', 'Power Board', 'Transformer']); });
  it('a stored list is cleaned of "Other" in any case; everything else, and order, is kept; non-arrays fall back to the defaults; input is not mutated', () => {
    const stored = Object.freeze(['Power Tool', 'Other', 'Heat Lamp', 'OTHER', ' other ']);
    expect(tatCleanEquipTypes(stored)).toEqual(['Power Tool', 'Heat Lamp']);
    expect(tatCleanEquipTypes(null)).toEqual(TAT_DEFAULT_EQUIP_TYPES); expect(tatCleanEquipTypes(undefined)).toEqual(TAT_DEFAULT_EQUIP_TYPES);
    expect(tatCleanEquipTypes([])).toEqual([]);
  });
});

const project = { id: 't1', name: 'Site T', company: '', abn: '', licence: '', areas: [
  { id: 'a1', name: 'Workshop', defaultFreq: '3', items: ['i1', 'i2', 'i3'], itemNames: { i1: 'Drill', i2: 'Toaster', i3: 'Old thing' }, itemTags: { i1: '1', i2: '2', i3: '3' },
    itemEquipTypes: { i1: 'Power Tool', i2: 'Toaster', i3: 'Other' }, itemFreqs: { i1: '3', i2: '3', i3: '3' } }] };
beforeEach(() => {
  cleanup(); localStorage.clear();
  localStorage.setItem('tat-projects-v1', JSON.stringify([project]));
  localStorage.setItem('tat-meta-v1', JSON.stringify({ t1: { auditor: 'Jane', testDate: '2026-09-21' } }));
});
async function openTab(user, tab) {
  render(<AppRoot />);
  await user.click(screen.getByText('TEST & TAG'));
  await user.click(await screen.findByText('Site T', { selector: 'div' }));
  await user.click(screen.getByRole('button', { name: tab }));
}
const options = sel => within(sel).getAllByRole('option').map(o => o.textContent);

describe('Dropdowns tab', () => {
  it('"Other" is reserved: it cannot be added (any case), the hint says it is built in, and Reset restores a list without it', async () => {
    const user = userEvent.setup(); await openTab(user, 'Dropdowns');
    expect(screen.getByText(/"Other" \(with a free-text box\) is always available and is not listed here/)).toBeInTheDocument();
    expect(screen.queryByText('Other', { selector: 'span' })).not.toBeInTheDocument();
    const box = screen.getByPlaceholderText('Add equipment type…'); const add = () => within(box.parentElement).getByRole('button', { name: '+ Add' });
    await user.type(box, 'OTHER'); await user.click(add());
    expect(screen.getByText('Other is already built in')).toBeInTheDocument();
    expect(ls('tat-settings-v1')).not.toContain('Other');
    // customise, then Reset: the default list has no "Other"
    await user.clear(box); await user.type(box, 'Heat Lamp'); await user.click(add());
    await screen.findByText('Heat Lamp', { selector: 'span' });
    await user.click(screen.getAllByRole('button', { name: 'Reset to defaults' })[1]);
    await user.click(within((await screen.findByText('Reset list to defaults?')).parentElement).getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(ls('tat-settings-v1')).toEqual(TAT_DEFAULT_EQUIP_TYPES));
  });

  it('an install whose stored list still has a literal "Other" is cleaned at load — and items typed "Other" keep displaying "Other"', async () => {
    localStorage.setItem('tat-settings-v1', JSON.stringify(['Power Tool', 'Heat Lamp', 'Other']));
    const user = userEvent.setup(); await openTab(user, 'Dropdowns');
    await screen.findByText('Heat Lamp', { selector: 'span' });
    expect(screen.queryByText('Other', { selector: 'span' })).not.toBeInTheDocument();
    await waitFor(() => expect(ls('tat-settings-v1')).toEqual(['Power Tool', 'Heat Lamp']));
    expect(ls('tat-projects-v1')[0].areas[0].itemEquipTypes.i3).toBe('Other');                   // the item's own value is untouched
  });
});

describe('Manage: the item edit form', () => {
  // the edit pencil is the first of the two buttons in an item row; the FIRST 'Equipment type' select is then the edit form's (the add-item form has the second)
  async function edit(user, name) {
    let row = await screen.findByText(name, { selector: 'span' }); while (row && within(row).queryAllByRole('button').length < 2) row = row.parentElement;
    await user.click(within(row).getAllByRole('button')[0]);
    return (await screen.findAllByRole('combobox', { name: 'Equipment type' }))[0];
  }
  async function openEdit(user, name) {
    await openTab(user, 'Manage');
    await user.click(await screen.findByText('Workshop'));
    return edit(user, name);
  }

  it('the select lists the types then "Other" LAST (never twice); a listed value has no text box', async () => {
    const user = userEvent.setup(); const sel = await openEdit(user, 'Drill');
    expect(options(sel)).toEqual(['— Optional', 'Power Tool', 'Extension Lead', 'RCD Portable', 'Appliance', 'Double Adaptor', 'Power Board', 'Transformer', 'Other']);
    expect(sel).toHaveValue('Power Tool');
    expect(screen.queryByPlaceholderText('Specify…')).not.toBeInTheDocument();
  });

  it('a stored value that is not in the list (an import / typed text) shows as Other + that text, with no extra option', async () => {
    const user = userEvent.setup(); const sel = await openEdit(user, 'Toaster');
    expect(sel).toHaveValue('Other'); expect(screen.getByPlaceholderText('Specify…')).toHaveValue('Toaster');
    expect(options(sel).filter(o => o === 'Toaster')).toHaveLength(0);
  });

  it('choosing Other reveals the text box; the typed text is saved as the type; blank saves "Other"', async () => {
    const user = userEvent.setup(); const sel = await openEdit(user, 'Drill');
    await user.selectOptions(sel, 'Other');
    const box = await screen.findByPlaceholderText('Specify…'); expect(box).toHaveValue('');
    await user.type(box, 'Hedge Trimmer');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(ls('tat-projects-v1')[0].areas[0].itemEquipTypes.i1).toBe('Hedge Trimmer'));

    // re-open it, clear the text: blank means the literal "Other"
    const sel2 = await openEdit2(user, 'Drill');
    expect(sel2).toHaveValue('Other'); expect(screen.getByPlaceholderText('Specify…')).toHaveValue('Hedge Trimmer');
    await user.clear(screen.getByPlaceholderText('Specify…'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(ls('tat-projects-v1')[0].areas[0].itemEquipTypes.i1).toBe('Other'));
  });

  const openEdit2 = (user, name) => edit(user, name);

  it('an item stored as the literal "Other" shows NO empty Specify box; choosing Other again shows it; saving is unchanged', async () => {
    const user = userEvent.setup(); const sel = await openEdit(user, 'Old thing');
    expect(sel).toHaveValue('Other'); expect(screen.queryByPlaceholderText('Specify…')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(ls('tat-projects-v1')[0].areas[0].itemEquipTypes.i3).toBe('Other'));
    const sel2 = await openEdit2(user, 'Old thing');
    await user.selectOptions(sel2, 'Appliance'); await user.selectOptions(sel2, 'Other');
    expect(await screen.findByPlaceholderText('Specify…')).toHaveValue('');
  });

  it('switching back to a listed type drops the text and stores the listed type', async () => {
    const user = userEvent.setup(); const sel = await openEdit(user, 'Toaster');
    await user.selectOptions(sel, 'Appliance');
    expect(screen.queryByPlaceholderText('Specify…')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(ls('tat-projects-v1')[0].areas[0].itemEquipTypes.i2).toBe('Appliance'));
  });
});

describe('the export carries the typed text', () => {
  it('an item with a typed type exports that text in the Equipment Type column', async () => {
    const { exportTATExcel } = await import('./App.jsx');
    const ExcelJS = (await import('exceljs')).default; let payload;
    window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } };
    await exportTATExcel(project, {}, { auditor: 'J', testDate: '2026-09-21' });
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64')); const ws = wb.getWorksheet('Test & Tag');
    const col = ws.getRow(5).values.indexOf('Equipment Type');
    expect([6, 7, 8].map(r => String(ws.getCell(r, col).value))).toEqual(['Power Tool', 'Toaster', 'Other']);
    delete window.webkit;
  });
});

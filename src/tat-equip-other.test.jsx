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

describe('Manage: the item edit form (the styled dropdown: listed types + Other + typed text)', () => {
  // the edit pencil is the first of the two buttons in an item row; the FIRST 'Equipment type' control is then the edit form's (the add-item form has the second)
  async function edit(user, name) {
    let row = await screen.findByText(name, { selector: 'span' }); while (row && within(row).queryAllByRole('button').length < 2) row = row.parentElement;
    await user.click(within(row).getAllByRole('button')[0]);
    return (await screen.findAllByRole('button', { name: 'Equipment type' }))[0];
  }
  async function openEdit(user, name) { await openTab(user, 'Manage'); await user.click(await screen.findByText('Workshop')); return edit(user, name); }
  const listed = () => within(screen.getByRole('listbox')).getAllByRole('option').map(o => o.textContent);
  const typed = () => screen.getByLabelText('Equipment type (typed)');
  const save = user => user.click(screen.getByRole('button', { name: 'Save' }));

  it('the list shows "— Optional", the types, then "Other" LAST (never twice); a listed value shows as the button text with no text box', async () => {
    const user = userEvent.setup(); const trigger = await openEdit(user, 'Drill');
    expect(trigger).toHaveTextContent('Power Tool'); expect(screen.queryByLabelText('Equipment type (typed)')).not.toBeInTheDocument();
    await user.click(trigger);
    expect(listed().slice(0, 9)).toEqual(['— Optional', 'Power Tool', 'Extension Lead', 'RCD Portable', 'Appliance', 'Double Adaptor', 'Power Board', 'Transformer', 'Other']);
    expect(listed().filter(o => o === 'Other')).toHaveLength(1);
  });

  it('a stored value that is not in the list (an import / typed text) opens as that TEXT in the typed box, with no extra option', async () => {
    const user = userEvent.setup(); await openEdit(user, 'Toaster');
    expect(typed()).toHaveValue('Toaster');
    await user.click(screen.getAllByRole('button', { name: '▾ List' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Equipment type' })[0]); expect(listed()).not.toContain('Toaster');
  });

  it('"Type custom…" reveals the text box; the typed text is saved as the type; blank typed text saves "Other"', async () => {
    const user = userEvent.setup(); const trigger = await openEdit(user, 'Drill');
    await user.click(trigger); await user.click(screen.getByText('Type custom…', { exact: false }));
    expect(typed()).toHaveValue(''); await user.type(typed(), 'Hedge Trimmer'); await save(user);
    await waitFor(() => expect(ls('tat-projects-v1')[0].areas[0].itemEquipTypes.i1).toBe('Hedge Trimmer'));
    await openEdit2(user, 'Drill');
    expect(typed()).toHaveValue('Hedge Trimmer'); await user.clear(typed()); await save(user);
    await waitFor(() => expect(ls('tat-projects-v1')[0].areas[0].itemEquipTypes.i1).toBe('Other'));
  });
  const openEdit2 = (user, name) => edit(user, name);

  it('an item stored as the literal "Other" shows "Other" and NO empty text box; saving leaves it unchanged; "Type custom…" is how to add text', async () => {
    const user = userEvent.setup(); const trigger = await openEdit(user, 'Old thing');
    expect(trigger).toHaveTextContent('Other'); expect(screen.queryByLabelText('Equipment type (typed)')).not.toBeInTheDocument();
    await save(user); await waitFor(() => expect(ls('tat-projects-v1')[0].areas[0].itemEquipTypes.i3).toBe('Other'));
    const t2 = await openEdit2(user, 'Old thing'); await user.click(t2); await user.click(screen.getByText('Type custom…', { exact: false })); expect(typed()).toHaveValue('');
  });

  it('switching from a custom text back to a listed type stores the listed type; "— Optional" stores blank', async () => {
    const user = userEvent.setup(); await openEdit(user, 'Toaster');
    await user.click(screen.getAllByRole('button', { name: '▾ List' })[0]); await user.click(screen.getAllByRole('button', { name: 'Equipment type' })[0]);
    await user.click(within(screen.getByRole('listbox')).getByText('Appliance')); await save(user);
    await waitFor(() => expect(ls('tat-projects-v1')[0].areas[0].itemEquipTypes.i2).toBe('Appliance'));
    const t2 = await openEdit2(user, 'Toaster'); await user.click(t2); await user.click(within(screen.getByRole('listbox')).getByText('— Optional')); await save(user);
    await waitFor(() => expect(ls('tat-projects-v1')[0].areas[0].itemEquipTypes.i2).toBe(''));
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

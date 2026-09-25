// ELT default Type list: Spitfire / Batten Lights / Exit Signs / Floodlights / Spotlights (+ the built-in literal "Other").
// A stored list that is EXACTLY the old defaults is upgraded once; any customised list is never touched; stored fittings keep
// whatever type they already have (display + export unchanged).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';
import AppRoot, { upgradeEltDropdowns, ELT_DEFAULT_TYPES, ELT_LEGACY_DEFAULT_TYPES, eltRegisterRows, parseELTExcel, migrateProjectToAreas } from './App.jsx';

const NEW_TYPES = ['Spitfire', 'Batten Lights', 'Exit Signs', 'Floodlights / Spotlights'];
const OLD_TYPES = ['Emergency Exit Sign', 'Combination Unit (Sign + 2 Side Lights)'];
const FAIL_REASONS = ['Lamp Failure', 'Battery Failure', 'No Power', 'Damaged/Broken', 'Switch Failure'];
const ACTIONS = ['Given to Site Contact', 'Repaired On-Site', 'Scheduled for Repair'];
const ls = k => JSON.parse(localStorage.getItem(k));
const optionsOf = sel => within(sel).getAllByRole('option').map(o => o.textContent);
let payload;
beforeEach(() => { localStorage.clear(); payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { cleanup(); delete window.webkit; });

const seedSite = (type = 'Exit Signs') => {
  localStorage.setItem('elt-projects-v2', JSON.stringify([{ id: 'p1', name: 'Site A', company: '', abn: '', licence: '', areas: [{ id: 'area-a', name: 'Site A', assets: [
    { id: 'a1', assetLocation: 'SE Door', assetId: '', type, typeOther: '', maintained: 'Maintained', fitting: '' }] }] }]));
  localStorage.setItem('elt-meta-v1', JSON.stringify({ p1: { auditor: 'Jane', testDate: '2026-07-13' } }));
};
async function openElt(user, tab) {
  render(<AppRoot />);
  await user.click(screen.getByText('EMERGENCY LIGHTING'));
  await user.click(await screen.findByText('Site A', { selector: 'div' }));
  if (tab) await user.click(screen.getByRole('button', { name: tab }));
}

describe('default Type list', () => {
  it('is exactly the four new names; the legacy list is kept only as the upgrade trigger', () => {
    expect(ELT_DEFAULT_TYPES).toEqual(NEW_TYPES);
    expect(ELT_LEGACY_DEFAULT_TYPES).toEqual(OLD_TYPES);
  });

  it('a fresh install shows the four on the Dropdowns tab and in the Type select, with the literal "Other" still last and working', async () => {
    seedSite();
    const user = userEvent.setup();
    await openElt(user, 'Dropdowns');
    NEW_TYPES.forEach(t => expect(screen.getByText(t)).toBeInTheDocument());
    OLD_TYPES.forEach(t => expect(screen.queryByText(t)).not.toBeInTheDocument());
    expect(screen.queryByText('Other')).not.toBeInTheDocument();                       // "Other" is never an editable list item
    await user.click(screen.getByRole('button', { name: 'Manage' }));
    await user.click(screen.getByRole('button', { name: '+ Add Fitting' }));
    expect(optionsOf(screen.getByRole('combobox'))).toEqual(['— Select', ...NEW_TYPES, 'Other']);
    await user.selectOptions(screen.getByRole('combobox'), 'Other');
    expect(screen.getByPlaceholderText('Specify…')).toBeInTheDocument();
  });
});

describe('upgradeEltDropdowns — only an EXACT legacy default list is replaced', () => {
  const stored = types => ({ types });
  const storedLegacy = types => ({ types, failReasons: FAIL_REASONS, actions: ACTIONS });
  it('exact old defaults -> the new four', () => {
    expect(upgradeEltDropdowns(stored([...OLD_TYPES])).types).toEqual(NEW_TYPES);
  });
  it('the retired Failure Reason / Action Taken lists are dropped; an UNTOUCHED Action Taken list is replaced by the standard Rectified defaults (no rectified key stored)', () => {
    const out = upgradeEltDropdowns(storedLegacy([...NEW_TYPES]));
    expect(out).toEqual({ types: NEW_TYPES });
  });
  it('a CUSTOMISED Action Taken list carries over as the Rectified list; a customised Failure Reason list is simply retired', () => {
    const out = upgradeEltDropdowns({ types: NEW_TYPES, failReasons: ['Only One'], actions: [...ACTIONS, 'Replaced Unit'] });
    expect(out).toEqual({ types: NEW_TYPES, rectified: [...ACTIONS, 'Replaced Unit'] });
    expect(upgradeEltDropdowns({ ...out, actions: ['x'] }).rectified).toEqual(out.rectified);   // an existing rectified list is never overwritten
  });
  it.each([
    ['an added option', [...OLD_TYPES, 'Bulkhead Light']],
    ['a removed option', [OLD_TYPES[0]]],
    ['re-ordered (★ used)', [OLD_TYPES[1], OLD_TYPES[0]]],
    ['a fully custom list', ['Foo', 'Bar']],
    ['an empty list', []],
    ['already the new defaults', NEW_TYPES],
  ])('leaves a customised list alone: %s', (_, types) => {
    const dd = stored(types);
    expect(upgradeEltDropdowns(dd)).toBe(dd);                                            // same object — untouched
  });
  it('is idempotent, does not mutate its input, and passes non-objects through', () => {
    const dd = Object.freeze(stored(Object.freeze([...OLD_TYPES])));
    const once = upgradeEltDropdowns(dd);
    expect(upgradeEltDropdowns(once)).toBe(once);
    expect(dd.types).toEqual(OLD_TYPES);
    expect(upgradeEltDropdowns(null)).toBeNull(); expect(upgradeEltDropdowns(undefined)).toBeUndefined();
  });
  it('through the real app: an untouched stored list is upgraded and re-saved; a customised one is left exactly as it was', async () => {
    seedSite();
    localStorage.setItem('elt-dropdowns-v1', JSON.stringify(storedLegacy([...OLD_TYPES])));
    const user = userEvent.setup();
    await openElt(user, 'Dropdowns');
    NEW_TYPES.forEach(t => expect(screen.getByText(t)).toBeInTheDocument());
    await waitFor(() => expect(ls('elt-dropdowns-v1').types).toEqual(NEW_TYPES));
    cleanup(); localStorage.clear();

    seedSite();
    localStorage.setItem('elt-dropdowns-v1', JSON.stringify(stored([...OLD_TYPES, 'Bulkhead Light'])));
    await openElt(userEvent.setup(), 'Dropdowns');
    expect(screen.getByText('Bulkhead Light')).toBeInTheDocument();
    await waitFor(() => expect(ls('elt-dropdowns-v1').types).toEqual([...OLD_TYPES, 'Bulkhead Light']));   // never touched
  });
});

describe('Reset restores the four new names', () => {
  it('a customised Type list resets to the new defaults (not the old ones)', async () => {
    seedSite();
    localStorage.setItem('elt-dropdowns-v1', JSON.stringify({ types: ['Foo', 'Bar'] }));
    const user = userEvent.setup();
    await openElt(user, 'Dropdowns');
    await user.click(screen.getAllByRole('button', { name: 'Reset' })[0]);              // the Type list is first
    const prompt = await screen.findByText('Reset list to defaults?');
    await user.click(within(prompt.parentElement).getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(ls('elt-dropdowns-v1').types).toEqual(NEW_TYPES));
    OLD_TYPES.forEach(t => expect(screen.queryByText(t)).not.toBeInTheDocument());
  });
});

describe('existing fittings keep their stored type', () => {
  it('a fitting typed with the retired "Emergency Exit Sign" shows ONE exit-sign option (Exit Signs, selected), while its stored type and export stay exactly as stored', async () => {
    seedSite('Emergency Exit Sign');
    const user = userEvent.setup();
    await openElt(user, 'Audit');
    expect(await screen.findByText(/Emergency Exit Sign/)).toBeInTheDocument();          // Audit row still shows the stored text
    await user.click(screen.getByRole('button', { name: 'Manage' }));
    await user.click(await screen.findByRole('button', { name: /Edit SE Door/ }));
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('Exit Signs');                                             // display only
    expect(optionsOf(select)).toEqual(['— Select', ...NEW_TYPES, 'Other']);
    expect(optionsOf(select).filter(o => /exit sign/i.test(o))).toHaveLength(1);          // the regression: never two exit-sign options
    cleanup();
    const proj = migrateProjectToAreas({ id: 'p1', name: 'Site A', assets: [{ id: 'a1', location: 'Site A', assetLocation: 'SE Door', assetId: '', type: 'Emergency Exit Sign', typeOther: '', maintained: 'Maintained', fitting: '' }] });
    const rows = eltRegisterRows(proj, { p1: { a1: { visual: 'pass', discharge: 'pass', switching: 'pass', charging: 'pass' } } }, {});
    expect(rows[0].cells[4]).toBe('Emergency Exit Sign');                                 // export cell unchanged
    expect(ls('elt-projects-v2')[0].areas[0].assets[0].type).toBe('Emergency Exit Sign'); // and nothing rewrote the stored value
  });
});

describe('import template', () => {
  it('its sample rows use the new names and parse with no "Other" fallback', async () => {
    seedSite();
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('EMERGENCY LIGHTING'));
    await user.click(await screen.findByRole('button', { name: '+ Add / Import Site' }));
    await user.click(screen.getByRole('button', { name: /Import Excel/ }));
    await user.click(screen.getByRole('button', { name: /Download Import Template/ }));
    await waitFor(() => expect(payload).toBeTruthy());
    const parsed = parseELTExcel(XLSX.read(Buffer.from(payload.base64, 'base64'), { type: 'buffer' }));
    expect(parsed.ok).toBe(true);
    expect(parsed.assets.map(a => [a.type, a.typeOther])).toEqual([['Exit Signs', ''], ['Batten Lights', '']]);
    expect(parsed.unknownTypes).toEqual([]);
  });
});

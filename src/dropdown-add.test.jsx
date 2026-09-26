// ONE rule for adding an option on every Dropdowns tab (RCD, IEL, TAT, Thermo, SWB, IRT, ELT, Welder): trimmed, and an option that already exists — in any
// letter case — is REFUSED with a notice. It must never be silently moved to the end (which used to change the ★ default when the moved option was first),
// and the typed text stays so it can be edited. A genuinely new option is appended and never touches the ★.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { dropdownAdd } from './App.jsx';

afterEach(() => cleanup());

describe('dropdownAdd', () => {
  const items = ['Site Electrician', 'Site Manager', 'Client'];
  it('empty / whitespace is ignored', () => { expect(dropdownAdd(items, '   ')).toEqual({ empty: true }); expect(dropdownAdd(items, null)).toEqual({ empty: true }); });
  it('a new option is trimmed and APPENDED (existing order untouched)', () => { expect(dropdownAdd(items, '  Apprentice ')).toEqual({ items: [...items, 'Apprentice'] }); });
  it('a duplicate in ANY case is refused, naming the existing spelling; nothing is returned to write', () => {
    for (const v of ['Site Electrician', 'site electrician', 'SITE ELECTRICIAN', '  Site Electrician  ']) expect(dropdownAdd(items, v)).toEqual({ notice: '"Site Electrician" is already in the list' });
  });
  it('a reserved word is refused as "already built in" (checked before duplicates); input is never mutated', () => {
    expect(dropdownAdd(['Spitfire'], 'other', ['Other'])).toEqual({ notice: 'Other is already built in' });
    const frozen = Object.freeze([...items]); expect(() => dropdownAdd(frozen, 'New')).not.toThrow();
  });
});

const site = (id, name) => ({ id, name, company: '', abn: '', licence: '', areas: [] });
const MODULES = [
  { name: 'RCD', card: 'RCD TESTING', key: 'rcd-projects-v6' }, { name: 'IEL', card: 'IEL TESTING', key: 'iel-projects-v2' }, { name: 'TAT', card: 'TEST & TAG', key: 'tat-projects-v1' },
  { name: 'Thermo', card: 'THERMOGRAPHIC', key: 'thermo-projects-v1' }, { name: 'SWB', card: 'SWITCHBOARD', key: 'swb-projects-v1' },
  { name: 'IRT', card: 'INSULATION RESISTANCE TESTING', key: 'irt-projects-v1' }, { name: 'ELT', card: 'EMERGENCY LIGHTING', key: 'elt-projects-v2' }, { name: 'Welder', card: 'WELDER TESTING', key: 'welder-projects-v1' },
];
async function openDropdowns(user, { card, key }) {
  localStorage.setItem(key, JSON.stringify([site('s1', 'Site X')]));
  render(<AppRoot />);
  await user.click(screen.getByText(card));
  await user.click(await screen.findByText('Site X', { selector: 'div' }));
  await user.click(screen.getByRole('button', { name: 'Dropdowns' }));
  await screen.findByText('Site Electrician');
}
// the Responsibility list: rows are the children of the row-list that holds "Site Electrician"
const respList = () => screen.getByText('Site Electrician', { selector: 'span' }).parentElement.parentElement;
const rowNames = list => [...list.children].map(r => r.textContent.replace('★ DEFAULT', '').trim()).filter(Boolean);
const starred = list => [...list.children].filter(r => r.textContent.includes('★ DEFAULT')).map(r => r.textContent.replace('★ DEFAULT', '').trim());
const addBox = () => screen.getByPlaceholderText('Add new responsibility option…');
const addBtn = () => within(addBox().parentElement).getByRole('button', { name: '+ Add' });

beforeEach(() => { cleanup(); localStorage.clear(); });

describe.each(MODULES)('$name Dropdowns: adding a duplicate never reorders the list or moves the ★', mod => {
  it('a duplicate (any case) is refused with a notice, the text stays, order and ★ are untouched; a new option is appended; typing clears the notice', async () => {
    const user = userEvent.setup(); await openDropdowns(user, mod);
    const before = rowNames(respList()); expect(before.slice(0, 4)).toEqual(['Site Electrician', 'Site Manager', 'Contractor', 'Client']);
    expect(starred(respList())).toEqual(['Site Electrician']);

    await user.type(addBox(), 'site electrician'); await user.click(addBtn());                 // different case, and it is the ★ default
    expect(screen.getByText('"Site Electrician" is already in the list')).toBeInTheDocument();
    expect(addBox()).toHaveValue('site electrician');                                            // kept for editing
    expect(rowNames(respList())).toEqual(before); expect(starred(respList())).toEqual(['Site Electrician']);   // NOT moved to the end, ★ unchanged

    await user.clear(addBox()); await user.type(addBox(), 'Client'); await user.click(addBtn());   // exact-case duplicate of a non-default
    expect(screen.getByText('"Client" is already in the list')).toBeInTheDocument();
    expect(rowNames(respList())).toEqual(before);                                                // not relocated either

    await user.type(addBox(), 'x');                                                              // typing clears the notice
    expect(screen.queryByText(/is already in the list/)).not.toBeInTheDocument();

    await user.clear(addBox()); await user.type(addBox(), '  Apprentice '); await user.click(addBtn());
    await waitFor(() => expect(rowNames(respList())).toEqual([...before, 'Apprentice']));       // appended at the end, trimmed
    expect(starred(respList())).toEqual(['Site Electrician']);                                   // ★ untouched
    expect(addBox()).toHaveValue('');
  });
});

describe('ELT keeps its reserved word; the rule composes with it', () => {
  it('"other" on the Type list is "already built in", not "already in the list"', async () => {
    const user = userEvent.setup(); await openDropdowns(user, MODULES.find(m => m.name === 'ELT'));
    await user.type(screen.getByPlaceholderText('Add new type option…'), 'other'); await user.click(within(screen.getByPlaceholderText('Add new type option…').parentElement).getByRole('button', { name: '+ Add' }));
    expect(screen.getByText('Other is already built in')).toBeInTheDocument();
  });
});

describe('TAT: the three non-defect lists follow the same rule', () => {
  it('appliance names, equipment types and frequencies refuse a duplicate with a notice (any case) and leave their lists alone', async () => {
    const user = userEvent.setup(); await openDropdowns(user, MODULES.find(m => m.name === 'TAT'));
    const addFor = ph => within(screen.getByPlaceholderText(ph).parentElement).getByRole('button', { name: '+ Add' });
    await user.type(screen.getByPlaceholderText('Add appliance name…'), 'drill'); await user.click(addFor('Add appliance name…'));
    expect(screen.getByText('"Drill" is already in the list')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Add equipment type…'), 'power tool'); await user.click(addFor('Add equipment type…'));
    expect(screen.getByText('"Power Tool" is already in the list')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Number of months e.g. 2'), '3'); await user.click(addFor('Number of months e.g. 2'));
    expect(screen.getByText(/"3 Months.*" is already in the list/)).toBeInTheDocument();
    expect(screen.getAllByText('Drill', { selector: 'span' })).toHaveLength(1);                  // still one of each
    expect(screen.getAllByText('Power Tool', { selector: 'span' })).toHaveLength(1);
    // and a NEW frequency still works
    await user.clear(screen.getByPlaceholderText('Number of months e.g. 2')); await user.type(screen.getByPlaceholderText('Number of months e.g. 2'), '2'); await user.click(addFor('Number of months e.g. 2'));
    expect(await screen.findByText('2 Months', { selector: 'span' })).toBeInTheDocument();
  });
});

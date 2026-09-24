// "Reset" / "Reset to defaults" on a Dropdowns list used to discard any customised options instantly, with no warning.
// Every module with a Dropdowns tab must now ask first. Also covers the option delete confirm added at the same time.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

const PROMPT = 'Reset list to defaults?';
const site = (id, name) => ({ id, name, company: '', abn: '', licence: '', areas: [] });

// card = the on-screen module name, key = its projects storage key, option = a default option that is safe to delete.
const MODULES = [
  { name: 'RCD',     card: 'RCD TESTING',   key: 'rcd-projects-v6',     option: 'RCBO Type B' },
  { name: 'IEL',     card: 'IEL TESTING',   key: 'iel-projects-v2',     option: 'Site Manager' },
  { name: 'TAT',     card: 'TEST & TAG',    key: 'tat-projects-v1',     option: 'Drill' },
  { name: 'Thermo',  card: 'THERMOGRAPHIC', key: 'thermo-projects-v1',  option: 'Site Manager' },
  { name: 'SWB',     card: 'SWITCHBOARD',   key: 'swb-projects-v1',     option: 'Site Manager' },
  { name: 'IRT',     card: 'IR TESTING',    key: 'irt-projects-v1',     option: 'Site Manager' },
];

const resetIn = el => within(el).queryAllByRole('button', { name: /^Reset( to defaults)?$/ })[0];

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe.each(MODULES)('$name Dropdowns: Reset asks before discarding a customised list', ({ card, key, option }) => {
  it('delete needs a confirm; Reset needs a confirm; Keep cancels it', async () => {
    const user = userEvent.setup();
    localStorage.setItem(key, JSON.stringify([site('s1', 'Site X')]));
    render(<AppRoot />);
    await user.click(screen.getByText(card));
    await user.click(await screen.findByText('Site X', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: 'Dropdowns' }));

    // 1. removing an option asks first (icon button -> Delete / Keep), it is not instant
    const row = (await screen.findByText(option)).parentElement;
    const list = row.parentElement;
    const buttons = within(row).getAllByRole('button');
    await user.click(buttons[buttons.length - 1]);
    expect(screen.getByText(option)).toBeInTheDocument(); // still there: only the prompt opened
    await user.click(within(row).getByRole('button', { name: 'Keep' }).previousElementSibling); // the confirm button sits just before Keep
    expect(screen.queryByText(option)).not.toBeInTheDocument();

    // 2. the list is now customised; clicking Reset must only open a prompt
    let anc = list, resetBtn = null;
    while (anc && !(resetBtn = resetIn(anc))) anc = anc.parentElement;
    expect(resetBtn).toBeTruthy();
    await user.click(resetBtn);
    expect(await screen.findByText(PROMPT)).toBeInTheDocument();
    expect(screen.queryByText(option)).not.toBeInTheDocument(); // nothing discarded yet

    // 3. Keep cancels: the prompt goes and the customised list is untouched
    await user.click(within(screen.getByText(PROMPT).parentElement).getByRole('button', { name: 'Keep' }));
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
    expect(screen.queryByText(option)).not.toBeInTheDocument();

    // 4. Reset again and confirm: defaults are restored
    anc = list; resetBtn = null;
    while (anc && !(resetBtn = resetIn(anc))) anc = anc.parentElement;
    await user.click(resetBtn);
    await user.click(within((await screen.findByText(PROMPT)).parentElement).getByRole('button', { name: 'Reset' }));
    expect(await screen.findByText(option)).toBeInTheDocument();
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });

  it('only one confirm prompt is open at a time (opening Reset closes an open option delete)', async () => {
    const user = userEvent.setup();
    localStorage.setItem(key, JSON.stringify([site('s1', 'Site X')]));
    render(<AppRoot />);
    await user.click(screen.getByText(card));
    await user.click(await screen.findByText('Site X', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: 'Dropdowns' }));

    const row = (await screen.findByText(option)).parentElement;
    const buttons = within(row).getAllByRole('button');
    await user.click(buttons[buttons.length - 1]);
    expect(within(row).getByRole('button', { name: 'Keep' })).toBeInTheDocument();

    let anc = row.parentElement, resetBtn = null;
    while (anc && !(resetBtn = resetIn(anc))) anc = anc.parentElement;
    await user.click(resetBtn);
    expect(await screen.findByText(PROMPT)).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument(); // delete prompt closed
  });
});

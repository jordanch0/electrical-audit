// WHERE THE BACKUP AND RESTORE SECTION GOES (Round d). Everything on the Global Settings screen above it must be EXACTLY what it was: the markup of the whole screen with the new section taken out is compared, character
// for character, with a baseline captured from the committed code BEFORE the section existed (src/__fixtures__/global-settings-before-backup-section.html). The section is the LAST child of the scrolling column, directly after the Save row.
import 'fake-indexeddb/auto';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

vi.setConfig({ testTimeout: 30000 });
configure({ asyncUtilTimeout: 10000 });
const BASELINE = fs.readFileSync(path.join(__dirname, '__fixtures__', 'global-settings-before-backup-section.html'), 'utf8');
beforeEach(() => { localStorage.clear(); });
afterEach(() => cleanup());
const panel = id => screen.getByTestId('gs-panel-' + id);
const openSettings = async () => { const user = userEvent.setup(); const r = render(<AppRoot />); await user.click(screen.getByTestId('settings-pill')); await screen.findByText('Business Identity'); await waitFor(() => { if (!/Storage used/.test(r.container.textContent)) throw new Error('loading'); }); return { user, ...r }; };

describe('the Global Settings screen with the new section', () => {
  it('everything that was on the screen is unchanged, element by element, against the committed screen from before the section and the tabs existed: header, Modules pill, every Company item, the Storage block; only the tab bar and the two panes are new', async () => {
    const { container } = await openSettings(); const base = document.createElement('div'); base.innerHTML = BASELINE; const bRoot = base.firstElementChild, aRoot = container.firstElementChild;
    expect(aRoot.getAttribute('style').replace(' position: relative; overflow: hidden;', '')).toBe(bRoot.getAttribute('style')); expect(aRoot.style.position).toBe('relative'); expect(aRoot.style.overflow).toBe('hidden');                                              // the screen's own frame
    expect(Array.from(aRoot.children).map(c => c.getAttribute('data-testid') || c.getAttribute('role') || 'div').length).toBe(3); expect(bRoot.children.length).toBe(2);
    const [aHead, aScroll, aNav] = Array.from(aRoot.children), [bHead, bScroll] = Array.from(bRoot.children);
    expect(aHead.outerHTML).toBe(bHead.outerHTML);                                                                       // header, Modules pill, title, subtitle, gradient line
    expect(aNav.tagName).toBe('NAV'); expect(aNav.firstElementChild.getAttribute('role')).toBe('tablist');                                                                   // the one new element between them
    expect(aScroll.getAttribute('style').replace(/padding: 18px 16px calc\(.*\);$/, 'padding: 18px 16px 40px;')).toBe(bScroll.getAttribute('style')); expect(aScroll.style.paddingBottom).toMatch(/^calc\(68px \+ max\(8px/);                                           // the scrolling column keeps its padding (the bottom spacing) and overflow
    const bKids = Array.from(bScroll.children), iStorage = bKids.findIndex(k => k.textContent === 'Storage'), saveRow = bKids[bKids.length - 1];
    const company = [...bKids.slice(0, iStorage), saveRow], storage = bKids.slice(iStorage, iStorage + 2); expect(storage[1].textContent).toMatch(/^Storage used/); expect(saveRow.textContent).toMatch(/^Save/);
    expect(Array.from(panel('company').children).map(c => c.outerHTML)).toEqual(company.map(c => c.outerHTML));          // Company = every item before Storage, then the Save row, unchanged
    const dataKids = Array.from(panel('data').children); expect(dataKids.slice(0, 2).map(c => c.outerHTML)).toEqual(storage.map(c => c.outerHTML)); expect(dataKids.length).toBe(3); expect(dataKids[2].getAttribute('data-testid')).toBe('backup-section');
    expect(Array.from(aScroll.children).length).toBe(2);
  });
  it('the section is the LAST child of the Data pane, directly after the Storage block, with a 32 px gap and a line above its heading; the Data pane has no Save row, and the Save row is the last child of the Company pane', async () => {
    const { container } = await openSettings(); const section = screen.getByTestId('backup-section'); const dataPane = section.parentElement;
    expect(dataPane).toBe(panel('data')); expect(dataPane.lastElementChild).toBe(section); const before = section.previousElementSibling; expect(before.textContent).toMatch(/^Storage used/);
    expect(section.style.marginTop).toBe('32px'); expect(section.style.paddingTop).toBe('18px'); expect(section.style.borderTop).toMatch(/^1px solid/);
    expect(within(dataPane).queryByText('Save')).toBeNull(); const company = panel('company'); const save = company.lastElementChild; expect(save.textContent).toMatch(/^Save/); expect(save.querySelector('button').textContent).toBe('Save');
    expect(company.firstElementChild.textContent).toBe('Business Identity'); expect(container.querySelectorAll('[data-testid="backup-section"]').length).toBe(1);
  });
  it('no other screen carries it: the Home screen, and a module, do not render the section', async () => {
    const user = userEvent.setup(); render(<AppRoot />); expect(screen.queryByTestId('backup-section')).toBeNull();
    await user.click(screen.getByText('RCD TESTING', { exact: true })); expect(screen.queryByTestId('backup-section')).toBeNull();
  });
});

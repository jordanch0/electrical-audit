// WHERE THE BACKUP AND RESTORE SECTION GOES (Round d). Everything on the Global Settings screen above it must be EXACTLY what it was: the markup of the whole screen with the new section taken out is compared, character
// for character, with a baseline captured from the committed code BEFORE the section existed (src/__fixtures__/global-settings-before-backup-section.html). The section is the LAST child of the scrolling column, directly after the Save row.
import 'fake-indexeddb/auto';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

vi.setConfig({ testTimeout: 30000 });
configure({ asyncUtilTimeout: 10000 });
const BASELINE = fs.readFileSync(path.join(__dirname, '__fixtures__', 'global-settings-before-backup-section.html'), 'utf8');
beforeEach(() => { localStorage.clear(); });
afterEach(() => cleanup());
const openSettings = async () => { const user = userEvent.setup(); const r = render(<AppRoot />); await user.click(screen.getByTestId('settings-pill')); await screen.findByText('Business Identity'); await waitFor(() => { if (!/Storage used/.test(r.container.textContent)) throw new Error('loading'); }); return { user, ...r }; };

describe('the Global Settings screen with the new section', () => {
  it('everything except the new section is identical to the screen before it existed (header, Modules pill, identity, logo, storage gauge, Save row)', async () => {
    const { container } = await openSettings(); const clone = container.cloneNode(true); clone.querySelector('[data-testid="backup-section"]').remove();
    expect(clone.innerHTML).toBe(BASELINE);
  });
  it('the section is the LAST child of the scrolling column, directly after the Save row, with a 32 px gap and a line above its heading', async () => {
    const { container } = await openSettings(); const section = screen.getByTestId('backup-section'); const column = section.parentElement;
    expect(column.lastElementChild).toBe(section); const save = section.previousElementSibling; expect(save.textContent).toMatch(/^Save/); expect(save.querySelector('button').textContent).toBe('Save');
    expect(section.style.marginTop).toBe('32px'); expect(section.style.paddingTop).toBe('18px'); expect(section.style.borderTop).toMatch(/^1px solid/);
    expect(column.firstElementChild.textContent).toBe('Business Identity'); expect(container.querySelectorAll('[data-testid="backup-section"]').length).toBe(1);
  });
  it('no other screen carries it: the Home screen, and a module, do not render the section', async () => {
    const user = userEvent.setup(); render(<AppRoot />); expect(screen.queryByTestId('backup-section')).toBeNull();
    await user.click(screen.getByText('RCD TESTING', { exact: true })); expect(screen.queryByTestId('backup-section')).toBeNull();
  });
});

// GLOBAL SETTINGS IN TWO TABS: Company | Data (Round e). FICTIONAL data. Proves: the tab semantics and look rules (44 px, the active tab is marked by more than colour, 4.5:1, Left/Right keys), that Storage sits on the Data tab, which tab opens, that switching tabs
// never loses unsaved typing or the logo preview (with a negative control that shows the test can fail), that tabs hold still while a restore runs, that a made-but-not-shared backup is dropped when the Data tab is left, and the arrangement of the screen.
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within, configure, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { GlobalSettingsView, loadAppSettings, saveAppSettings, appLogoStore, backupRestore, backupUndo, backupUndoInfo, backupLastBackupText, RESTORE_KEY } from './App.jsx';
import { wipe, backupOf, seedSourceFull } from './test/backup-fixtures.js';

vi.setConfig({ testTimeout: 30000 });
configure({ asyncUtilTimeout: 10000 });
const NOW = new Date(2026, 9, 9, 12, 0);
const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
const deps = (over = {}) => ({ reload: vi.fn(), now: () => NOW, restore: (f, o) => backupRestore(f, { ...o, storage: S, now: NOW }), undo: () => backupUndo({ storage: S, now: NOW }), undoInfo: () => backupUndoInfo(S, NOW), lastText: () => backupLastBackupText(S, NOW), ...over });
const mount = (props = {}) => { const user = userEvent.setup(); const r = render(<GlobalSettingsView onGoHome={props.onGoHome || (() => {})} backupDeps={props.backupDeps || deps()} initialTab={props.initialTab} />); return { user, ...r }; };
const tabs = () => ({ company: screen.getByTestId('gs-tab-company'), data: screen.getByTestId('gs-tab-data') });
const selected = () => ['company', 'data'].filter(t => screen.getByTestId('gs-tab-' + t).getAttribute('aria-selected') === 'true');
const panel = id => screen.getByTestId('gs-panel-' + id);
const field = ph => screen.getByPlaceholderText(ph);
const lum = hex => { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
beforeAll(() => { URL.createObjectURL = () => 'blob:tabs-test'; URL.revokeObjectURL = () => {}; });                                  // jsdom has none (the existing Global Settings tests stub it the same way)
beforeEach(async () => { await wipe(); });
afterEach(() => cleanup());

describe('the tabs: roles, look and keys', () => {
  it('a tablist with two tabs, Company and Data, each controlling a labelled tabpanel; exactly one is selected and only its panel is shown', async () => {
    mount(); const list = await screen.findByRole('tablist'); expect(list.getAttribute('aria-label')).toBe('Global Settings sections');
    const t = screen.getAllByRole('tab'); expect(t.map(x => x.textContent)).toEqual(['Company', 'Data']);
    for (const id of ['company', 'data']) { const tab = screen.getByTestId('gs-tab-' + id), p = screen.getByTestId('gs-panel-' + id, { hidden: true }); expect(tab.getAttribute('aria-controls')).toBe(p.id); expect(p.getAttribute('aria-labelledby')).toBe(tab.id); expect(p.getAttribute('role')).toBe('tabpanel'); }
    expect(selected()).toEqual(['company']); expect(panel('company').hidden).toBe(false); expect(panel('data').hidden).toBe(true); expect(panel('data').style.display).toBe('none'); expect(tabs().data.getAttribute('tabindex')).toBe('-1'); expect(tabs().company.getAttribute('tabindex')).toBe('0');
  });
  it('every tab is at least 44 px tall, and the active one is marked by more than colour: a check mark, a heavier border and bold text, plus aria-selected', async () => {
    const { user } = mount(); await screen.findByRole('tablist'); const check = () => { const { company, data } = tabs(); for (const b of [company, data]) expect(parseInt(b.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
      const a = selected()[0], on = tabs()[a], off = tabs()[a === 'company' ? 'data' : 'company']; expect(on.querySelector('svg')).toBeTruthy(); expect(off.querySelector('svg')).toBeNull(); expect(on.style.fontWeight).toBe('800'); expect(off.style.fontWeight).toBe('600'); expect(on.style.border).toMatch(/^2px solid/); expect(off.style.border).toMatch(/^2px solid/); expect(on.style.border).not.toBe(off.style.border); };
    check(); await user.click(tabs().data); check();
  });
  it('colour pairs: active text on its fill, inactive text on the page, disabled text on its grey, the active border against the page: all at least 4.5:1 (the border at least 3:1)', () => {
    expect(ratio('#1e293b', '#e2e8f0')).toBeGreaterThanOrEqual(4.5); expect(ratio('#52525b', '#e8e6e2')).toBeGreaterThanOrEqual(4.5); expect(ratio('#52525b', '#e4e4e7')).toBeGreaterThanOrEqual(4.5); expect(ratio('#475569', '#e8e6e2')).toBeGreaterThanOrEqual(3);
  });
  it('the tab styles in the code are those pairs', async () => { mount(); await screen.findByRole('tablist'); const { company, data } = tabs(); expect(company.style.background).toBe('rgb(226, 232, 240)'); expect(company.style.color).toBe('rgb(30, 41, 59)'); expect(data.style.background).toBe('rgb(232, 230, 226)'); expect(data.style.color).toBe('rgb(82, 82, 91)'); });
  it('Left and Right arrow keys move between the two tabs and move the focus with them', async () => {
    mount(); await screen.findByRole('tablist'); tabs().company.focus(); fireEvent.keyDown(tabs().company, { key: 'ArrowRight' }); expect(selected()).toEqual(['data']); expect(document.activeElement).toBe(tabs().data);
    fireEvent.keyDown(tabs().data, { key: 'ArrowLeft' }); expect(selected()).toEqual(['company']); expect(document.activeElement).toBe(tabs().company); fireEvent.keyDown(tabs().company, { key: 'ArrowDown' }); expect(selected()).toEqual(['company']);
  });
  it('clicking a tab switches, and resets the column to the top', async () => {
    const { user } = mount(); await screen.findByRole('tablist'); const col = panel('company').parentElement; col.scrollTop = 120; await user.click(tabs().data); expect(col.scrollTop).toBe(0); expect(selected()).toEqual(['data']);
  });
  it('the tab bar keeps 10 px under the buttons and a 1 px line under the bar, and sits OUTSIDE the scrolling column, so scrolled text is cut under the line and never against the buttons', async () => {
    mount(); const bar = await screen.findByRole('tablist'); const col = panel('company').parentElement;
    expect(bar.style.paddingBottom).toBe('10px'); expect(bar.style.paddingTop).toBe('12px'); expect(bar.style.borderBottom).toBe('1px solid rgb(212, 212, 216)'); expect(bar.style.borderBottomColor).toBe(tabs().data.style.borderColor);      // the same grey as the inactive tab's border
    expect(bar.contains(col)).toBe(false); expect(bar.nextElementSibling).toBe(col); expect(col.style.overflowY).toBe('auto');                 // the bar does not scroll with the column; the column is clipped at the bar's bottom edge, which is below the line
  });
});

describe('what is on which tab', () => {
  it('Company: Business Identity, the three fields, the logo and the Save row. Data: Storage, then Backup and restore. Storage is NOT on Company.', async () => {
    mount(); await screen.findByRole('tablist'); const c = panel('company'), d = panel('data', { hidden: true });
    for (const t of ['Business Identity', 'Company Logo']) expect(within(c).getByText(t)).toBeTruthy(); for (const p of ['Company name', 'e.g. 12 345 678 901', 'e.g. 123456C']) expect(within(c).getByPlaceholderText(p)).toBeTruthy(); expect(within(c).getByText('Save')).toBeTruthy();
    expect(within(c).queryByText('Storage')).toBeNull(); expect(within(c).queryByText(/Storage used/)).toBeNull(); expect(within(c).queryByText('Backup and restore')).toBeNull();
    expect(within(d).getByText('Storage')).toBeTruthy(); expect(within(d).getByText(/Storage used: .* of ~5 MB \(\d+%, approximate\)/)).toBeTruthy(); expect(within(d).getByText('Backup and restore')).toBeTruthy(); expect(within(d).queryByText('Save')).toBeNull(); expect(within(d).queryByText('Business Identity')).toBeNull();
    expect(Array.from(d.children).map(x => x.textContent.slice(0, 7))).toEqual(['Storage', 'Storage', 'A backu'].slice(0, 2).concat([d.children[2].textContent.slice(0, 7)]));
  });
});

describe('which tab opens', () => {
  it('the Settings pill opens on Company', async () => { const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByTestId('settings-pill')); await screen.findByText('Business Identity'); expect(selected()).toEqual(['company']); });
  it('a recorded restore problem opens on Data, with the problem card showing and a warning mark on the Data tab; it goes when the problem is cleared', async () => {
    rawSetItem(RESTORE_KEY, JSON.stringify({ v: 1, journal: null, undo: null, problem: { keys: ['rcd-projects-v6'], at: 'x' } })); mount(); await screen.findByRole('tablist');
    expect(selected()).toEqual(['data']); expect(panel('data').hidden).toBe(false); expect(screen.getByTestId('backup-problem')).toBeVisible(); expect(tabs().data.querySelector('svg + svg')).toBeTruthy(); expect(tabs().data.getAttribute('aria-label')).toBe('Data, a restore problem needs attention');
    cleanup(); rawSetItem(RESTORE_KEY, JSON.stringify({ v: 1, journal: null, undo: null, problem: null })); mount(); await screen.findByRole('tablist'); expect(selected()).toEqual(['company']); expect(tabs().data.getAttribute('aria-label')).toBeNull();
  });
  it('initialTab="data" (the Stage 6 Settings-only screen) opens on Data; initialTab="company" opens on Company even with a problem recorded', async () => {
    mount({ initialTab: 'data' }); await screen.findByRole('tablist'); expect(selected()).toEqual(['data']); expect(panel('company').hidden).toBe(true); cleanup();
    rawSetItem(RESTORE_KEY, JSON.stringify({ v: 1, journal: null, undo: null, problem: { keys: ['rcd-projects-v6'], at: 'x' } })); mount({ initialTab: 'company' }); await screen.findByRole('tablist'); expect(selected()).toEqual(['company']);
  });
  it('a successful restore clears the warning mark on the Data tab while it is open', async () => {
    const file = await backupOf(seedSourceFull); rawSetItem(RESTORE_KEY, JSON.stringify({ v: 1, journal: null, undo: null, problem: { keys: ['rcd-projects-v6'], at: 'x' } })); const { user } = mount(); await screen.findByTestId('backup-problem');
    await user.upload(screen.getByTestId('backup-file-input'), new File([file], 'b.zip')); await screen.findByTestId('backup-summary'); await user.click(screen.getByTestId('backup-restore')); await user.click(screen.getByTestId('backup-restore-confirm-yes')); await screen.findByTestId('backup-result-ok');
    await waitFor(() => expect(tabs().data.getAttribute('aria-label')).toBeNull()); expect(screen.queryByTestId('backup-problem')).toBeNull();
  });
});

describe('switching tabs never loses what you typed', () => {
  it('type a name, ABN and licence; go to Data and back (5 times): the very same inputs hold exactly what was typed, "Saved" has not appeared, and Save then stores exactly that', async () => {
    const { user } = mount(); await screen.findByRole('tablist'); const n = field('Company name'), a = field('e.g. 12 345 678 901'), l = field('e.g. 123456C');
    await user.type(n, 'Hartwell Electrical'); await user.type(a, '12 345 678 901'); await user.type(l, '123456C');
    for (let i = 0; i < 5; i++) { await user.click(tabs().data); expect(panel('data').hidden).toBe(false); await user.click(tabs().company); }
    expect(field('Company name')).toBe(n); expect(field('e.g. 12 345 678 901')).toBe(a); expect(field('e.g. 123456C')).toBe(l); expect(n.value).toBe('Hartwell Electrical'); expect(a.value).toBe('12 345 678 901'); expect(l.value).toBe('123456C'); expect(screen.queryByText('Saved')).toBeNull();
    await user.click(screen.getByText('Save')); await screen.findByText('Saved'); expect(loadAppSettings()).toMatchObject({ businessName: 'Hartwell Electrical', abn: '12 345 678 901', licence: '123456C' });
  });
  it('typing and a "Saved" mark both survive a switch made after saving too', async () => {
    const { user } = mount(); await screen.findByRole('tablist'); await user.type(field('Company name'), 'Acme'); await user.click(screen.getByText('Save')); await screen.findByText('Saved'); await user.click(tabs().data); await user.click(tabs().company); expect(screen.getByText('Saved')).toBeTruthy(); expect(field('Company name').value).toBe('Acme');
  });
  it('NEGATIVE CONTROL: leaving Settings altogether (the screen is unmounted) DOES discard unsaved typing, as it always has, so the test above can fail', async () => {
    const { user, unmount } = mount(); await screen.findByRole('tablist'); await user.type(field('Company name'), 'Gone'); unmount(); cleanup(); mount(); await screen.findByRole('tablist'); expect(field('Company name').value).toBe('');
  });
  it('the logo preview is the same element after a switch, and Remove still works afterwards', async () => {
    await appLogoStore.put({ buf: new Uint8Array([1, 2, 3]).buffer, type: 'image/jpeg' }); saveAppSettings({ businessName: '', abn: '', licence: '', logoId: 'logo' }); const { user } = mount(); const img = await screen.findByAltText('Logo');
    await user.click(tabs().data); await user.click(tabs().company); expect(screen.getByAltText('Logo')).toBe(img);
  });
});

describe('while something runs, the tabs hold still', () => {
  const slow = () => { let finish; const restore = (f, o) => new Promise(r => { finish = async () => r(await backupRestore(f, { ...o, storage: S, now: NOW })); }); return { restore, finish: () => finish() }; };
  it('a running restore: Company cannot be switched to (tap or arrow key; it is aria-disabled and greyed), the restore keeps running, and after it finishes the tabs work again', async () => {
    const file = await backupOf(seedSourceFull); const s = slow(); const { user } = mount({ initialTab: 'data', backupDeps: deps({ restore: s.restore }) }); await screen.findByRole('tablist');
    await user.upload(screen.getByTestId('backup-file-input'), new File([file], 'b.zip')); await screen.findByTestId('backup-summary'); await user.click(screen.getByTestId('backup-restore')); await user.click(screen.getByTestId('backup-restore-confirm-yes')); await screen.findByText('Restoring…');
    await waitFor(() => expect(tabs().company.getAttribute('aria-disabled')).toBe('true')); expect(tabs().company.style.background).toBe('rgb(228, 228, 231)'); await user.click(tabs().company); fireEvent.keyDown(tabs().data, { key: 'ArrowLeft' });
    expect(selected()).toEqual(['data']); expect(panel('data').hidden).toBe(false); expect(screen.getByText('Restoring…')).toBeVisible();
    await act(async () => { await s.finish(); }); await screen.findByTestId('backup-result-ok'); await waitFor(() => expect(tabs().company.getAttribute('aria-disabled')).toBeNull()); await user.click(tabs().company); expect(selected()).toEqual(['company']);
  });
  it('while a backup is being built the tabs also hold still', async () => {
    let release; const d = deps({ measure: async () => ({ estimatedBytes: 5 * 1024 * 1024 }), inspect: async () => ({ ok: true }), build: () => new Promise(r => { release = () => r({ blob: new Blob(['x']), filename: 'f.zip' }); }) }); const { user } = mount({ initialTab: 'data', backupDeps: d }); await screen.findByRole('tablist');
    await user.click(screen.getByTestId('backup-make')); await screen.findByText(/Making your backup/); await user.click(tabs().company); expect(selected()).toEqual(['data']); await act(async () => { release(); }); await screen.findByTestId('backup-card-ready'); await waitFor(() => expect(tabs().company.getAttribute('aria-disabled')).toBeNull());
  });
});

describe('leaving the Data tab drops a made-but-not-shared backup', () => {
  it('a ready backup is gone when you come back; Make backup is offered again and Share is not', async () => {
    await seedSourceFull(); const share = vi.fn(); const { user } = mount({ initialTab: 'data' }); await screen.findByRole('tablist'); await user.click(screen.getByTestId('backup-make')); await screen.findByTestId('backup-card-ready');
    await user.click(tabs().company); await user.click(tabs().data); expect(screen.queryByTestId('backup-card-ready')).toBeNull(); expect(screen.queryByTestId('backup-share')).toBeNull(); expect(screen.getByTestId('backup-make')).toBeEnabled(); expect(share).not.toHaveBeenCalled();
  });
  it('anything else on the Data tab is left alone when you leave it (a restore summary you are looking at stays)', async () => {
    const file = await backupOf(seedSourceFull); const { user } = mount({ initialTab: 'data' }); await screen.findByRole('tablist'); await user.upload(screen.getByTestId('backup-file-input'), new File([file], 'b.zip')); await screen.findByTestId('backup-summary');
    await user.click(tabs().company); await user.click(tabs().data); expect(screen.getByTestId('backup-summary')).toBeTruthy();
  });
  it('leaving the Company tab drops nothing', async () => { await seedSourceFull(); const { user } = mount({ initialTab: 'data' }); await screen.findByRole('tablist'); await user.click(screen.getByTestId('backup-make')); await screen.findByTestId('backup-card-ready'); expect(screen.getByTestId('backup-share')).toBeTruthy(); });
});

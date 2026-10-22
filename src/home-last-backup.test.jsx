// THE QUIET "LAST BACKUP" LINE ON HOME (release r). FICTIONAL data. Below the module tiles and above the footer, inside the scroll area (so the floating pill, whose clearance the area ends with, can never cover it). The text is
// backupLastBackupText(): the SAME words Global Settings shows. Never a colour alarm, never a nag. Tapping it opens Global Settings on Backup & Data; the Settings pill still opens the first section.
import 'fake-indexeddb/auto';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

configure({ asyncUtilTimeout: 5000 });
const KEY = 'sparkcheck-last-backup-v1';
const NOW = new Date(2026, 9, 21, 15, 0, 0);
const record = (at) => localStorage.setItem(KEY, JSON.stringify({ v: 1, at: at.toISOString(), day: `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`, bytes: 1, method: 'share', includesPhotos: true }));
beforeEach(() => { cleanup(); localStorage.clear(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); });
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); });
const line = () => screen.getByTestId('home-last-backup');

describe('the text', () => {
  it('no backup yet: "No backup made yet"', () => { render(<AppRoot />); expect(line().textContent).toBe('No backup made yet ›'); expect(line().getAttribute('aria-label')).toBe('No backup made yet. Opens Backup & Data in Settings.'); });
  it('a backup today: "Last backup: today, 2:38 pm"; yesterday; an older day as DD/MM/YYYY with the time (the existing style, no new format)', () => {
    record(new Date(2026, 9, 21, 14, 38)); render(<AppRoot />); expect(line().textContent).toBe('Last backup: today, 2:38 pm ›');
    cleanup(); record(new Date(2026, 9, 20, 9, 5)); render(<AppRoot />); expect(line().textContent).toBe('Last backup: yesterday, 9:05 am ›');
    cleanup(); record(new Date(2026, 9, 12, 16, 38)); render(<AppRoot />); expect(line().textContent).toBe('Last backup: 12/10/2026, 4:38 pm ›'); expect(line().getAttribute('aria-label')).toBe('Last backup: 12/10/2026, 4:38 pm. Opens Backup & Data in Settings.');
  });
  it('it never reads or writes anything but the one record', () => { const s = vi.spyOn(Storage.prototype, 'setItem'); render(<AppRoot />); expect(s).not.toHaveBeenCalled(); });
});

describe('quiet: no alarm, no nag', () => {
  it('the same plain style for today and for a 200-day-old backup and for none: no amber, no red, no bold', () => {
    const styleOf = () => { const s = line().style; return [s.color, s.fontSize, s.fontWeight, s.background, s.border, s.textDecoration].join('|'); };
    render(<AppRoot />); const none = styleOf(); cleanup(); record(new Date(2026, 9, 21, 14, 38)); render(<AppRoot />); const today = styleOf(); cleanup(); record(new Date(2026, 3, 4, 10, 0)); render(<AppRoot />); const old = styleOf();
    expect(today).toBe(none); expect(old).toBe(none); expect(line().style.color).toBe('rgb(82, 82, 91)'); expect(line().style.fontSize).toBe('12px');
  });
  it('no banner, no dialog, no alert role on Home; it is one button of at least 44 px', () => { render(<AppRoot />); expect(screen.queryAllByRole('alert')).toEqual([]); expect(screen.queryAllByRole('dialog')).toEqual([]); expect(line().tagName).toBe('BUTTON'); expect(line().style.minHeight).toBe('44px'); });
});

describe('where it sits', () => {
  it('after the last module tile, before the footer, outside the nav; the floating pill is a separate element after it', () => {
    render(<AppRoot />); const last = screen.getByText('GENERAL SITE DEFECTS').closest('button'), foot = screen.getByText('© SparkCheck'), pill = screen.getByTestId('settings-pill').closest('div');
    const F = Node.DOCUMENT_POSITION_FOLLOWING; expect(last.compareDocumentPosition(line()) & F).toBeTruthy(); expect(line().compareDocumentPosition(foot) & F).toBeTruthy(); expect(foot.compareDocumentPosition(pill) & F).toBeTruthy();
    expect(line().closest('nav')).toBeNull(); expect(pill.contains(line())).toBe(false);
  });
  it('the scroll area it sits in ends with the pill clearance (NAV_CLEARANCE), so the pill cannot cover it at the end of the scroll', () => {
    const src = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8'), home = src.slice(src.indexOf('function AppRoot()'), src.indexOf('function RCDAppWrapper'));
    const pad = home.indexOf('paddingBottom:NAV_CLEARANCE'), grid = home.indexOf('gridTemplateColumns:"repeat(2, 1fr)"'), ln = home.indexOf('"data-testid":"home-last-backup"'), foot = home.indexOf('© SparkCheck'), pill = home.indexOf('NAV_PILL_STYLE_NARROW');
    expect(pad).toBeGreaterThan(-1); expect(pad).toBeLessThan(grid); expect(grid).toBeLessThan(ln); expect(ln).toBeLessThan(foot); expect(foot).toBeLessThan(pill);
  });
});

describe('where it goes', () => {
  it('a tap opens Global Settings on Backup & Data (the Backup & Data section is the selected tab)', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} }); render(<AppRoot />); await user.click(line());
    expect(await screen.findByTestId('backup-section')).toBeTruthy(); expect(screen.getByRole('tab', { name: /Backup & Data/ }).getAttribute('aria-selected')).toBe('true');
  });
  it('the Home line and the Settings screen show the same words for the same record', async () => {
    record(new Date(2026, 9, 21, 14, 38)); const user = userEvent.setup({ advanceTimers: () => {} }); render(<AppRoot />); const home = line().textContent.replace(/ ›$/, '');
    await user.click(line()); expect((await screen.findByTestId('backup-last')).textContent).toBe(home);
  });
  it('the Settings pill still opens the FIRST section, even after the line opened Backup & Data; Modules returns Home with the current text', async () => {
    const user = userEvent.setup({ advanceTimers: () => {} }); render(<AppRoot />); await user.click(line()); await screen.findByTestId('backup-section');
    record(new Date(2026, 9, 21, 14, 38)); await user.click(screen.getByText('Modules')); expect(line().textContent).toBe('Last backup: today, 2:38 pm ›');
    await user.click(screen.getByTestId('settings-pill')); expect(await screen.findByRole('tab', { name: /Business/ })).toBeTruthy(); expect(screen.getByRole('tab', { name: /Business/ }).getAttribute('aria-selected')).toBe('true');
  });
});

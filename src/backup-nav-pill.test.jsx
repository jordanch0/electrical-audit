// THE GLOBAL SETTINGS SECTION BAR IS THE CALENDAR'S FLOATING PILL, at the bottom of the screen. FICTIONAL data. Proves: the container (position, offsets, z-index, look) and the buttons are the Calendar bar's own (compared with the Calendar
// rendered in the same test, not with copies of its numbers), the scrolling column ends with the same clearance as the Calendar's content, the pill is a <nav> (so index.html hides it while a text field has the keyboard), the labels come from the one
// constant and never wrap, and the Calendar's bar itself is unchanged.
import 'fake-indexeddb/auto';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { GlobalSettingsView, GS_TAB_LABELS } from './App.jsx';
import { wipe } from './test/backup-fixtures.js';

vi.setConfig({ testTimeout: 30000 }); configure({ asyncUtilTimeout: 10000 });
const SRC = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8'), HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
beforeAll(() => { URL.createObjectURL = () => 'blob:nav-test'; URL.revokeObjectURL = () => {}; });
beforeEach(wipe); afterEach(cleanup);
const NAVLOOK = ['position', 'left', 'right', 'bottom', 'zIndex', 'borderRadius', 'background', 'border', 'boxShadow', 'padding', 'display', 'alignItems', 'boxSizing'];
const BTN = ['flex', 'minWidth', 'display', 'flexDirection', 'alignItems', 'justifyContent', 'gap', 'border', 'minHeight', 'borderRadius', 'fontFamily', 'padding'];
const pick = (el, keys) => Object.fromEntries(keys.map(k => [k, el.style[k]]));

describe('the Global Settings bar is the Calendar bar, at the bottom', () => {
  it('the container and the buttons are the Calendar bar’s own, compared with the Calendar rendered here; the Calendar’s bar is untouched', async () => {
    const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByTestId('calendar-pill'));
    const calNav = (await screen.findByText('Upcoming')).closest('nav'), calMain = calNav.parentElement.querySelector('main'), calBtns = Array.from(calNav.querySelectorAll('button'));
    const calContainer = pick(calNav, NAVLOOK), calActive = pick(calBtns.find(b => b.style.background !== 'transparent'), [...BTN, 'background', 'color']), calIdle = pick(calBtns.find(b => b.style.background === 'transparent'), [...BTN, 'background', 'color']);
    const calLabel = calBtns[0].querySelector('span').style, calClear = calMain.style.paddingBottom; expect(calContainer.position).toBe('absolute'); expect(calClear).toMatch(/^calc\(68px \+ max\(8px/);
    cleanup(); const { container } = render(<GlobalSettingsView onGoHome={() => {}} />); const nav = (await screen.findByRole('tablist')).parentElement;
    expect(pick(nav, NAVLOOK)).toEqual(calContainer);                                                            // position, offsets, z-index, safe-area bottom, look: identical
    const on = screen.getByTestId('gs-tab-company'), off = screen.getByTestId('gs-tab-data');
    expect(pick(on, [...BTN, 'background', 'color'])).toEqual(calActive); expect(pick(off, [...BTN, 'background', 'color'])).toEqual(calIdle);
    const l = on.querySelector('span').style; expect([l.fontSize, l.fontWeight, l.lineHeight, l.whiteSpace]).toEqual([calLabel.fontSize, '700', calLabel.lineHeight, calLabel.whiteSpace]);
    expect(nav.parentElement).toBe(container.firstElementChild); expect(container.firstElementChild.style.position).toBe('relative'); expect(container.firstElementChild.lastElementChild).toBe(nav);       // inside the screen, which is its containing block, and last
    expect(panel().parentElement.style.paddingBottom).toBe(calClear);                                              // the scrolling column ends with the SAME clearance as the Calendar's content
  });
  it('the code gives the column NAV_CLEARANCE (never a hard-coded number) and no longer has the old 40 px bottom padding', () => {
    const body = SRC.slice(SRC.indexOf('function GlobalSettingsView'), SRC.indexOf('// BACKUP AND RESTORE — the section at the bottom of Global Settings'));
    expect(body).toMatch(/padding: "18px 16px 0", paddingBottom: NAV_CLEARANCE/); expect(body).not.toMatch(/18px 16px 40px/); expect(body).toMatch(/React\.createElement\('nav', \{ "data-testid": "gs-nav", style: NAV_PILL_STYLE \}/);
  });
  it('the pill is a <nav>, so the rule that hides the bar while a text field has the keyboard (html.kb-open #root nav) applies to it', async () => {
    render(<GlobalSettingsView onGoHome={() => {}} />); const nav = (await screen.findByRole('tablist')).parentElement; expect(nav.tagName).toBe('NAV'); expect(nav.closest('nav')).toBe(nav);
    expect(HTML).toMatch(/html\.kb-open #root nav \{\s*opacity: 0 !important;\s*pointer-events: none !important;/);
  });
  it('the labels come from the one constant, are not allowed to wrap, and every tab can shrink to its half of a 320 px screen', async () => {
    render(<GlobalSettingsView onGoHome={() => {}} />); await screen.findByRole('tablist');
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual([GS_TAB_LABELS.company, GS_TAB_LABELS.data]); expect(GS_TAB_LABELS).toEqual({ company: 'Business', data: 'Backup & Data' });
    for (const t of screen.getAllByRole('tab')) { expect(t.querySelector('span').style.whiteSpace).toBe('nowrap'); expect(t.style.flex).toMatch(/^1/); expect(t.style.minWidth).toBe('0px'); }
  });
  it('the header and the Modules pill are where they were, and the ids and panes are unchanged (company / data)', async () => {
    const onGoHome = vi.fn(); const user = userEvent.setup(); const { container } = render(<GlobalSettingsView onGoHome={onGoHome} />); await screen.findByRole('tablist');
    expect(container.firstElementChild.firstElementChild.querySelector('[data-testid="header-pill-row"]')).toBeTruthy(); expect(screen.getByTestId('gs-panel-company')).toBeTruthy(); expect(screen.getByTestId('gs-panel-data', { hidden: true })).toBeTruthy();
    await user.click(screen.getByText('Modules')); expect(onGoHome).toHaveBeenCalledTimes(1);
  });
});
function panel() { return screen.getByTestId('gs-panel-company'); }

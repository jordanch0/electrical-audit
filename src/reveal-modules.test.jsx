// RELEASE q, through the REAL screens of all nine modules (RCD, IEL, TAT, Thermo, SWB, IRT, ELT, Welder, GSD) and the Calendar: each confirm card that can grow scrolls itself into view when it opens low
// (under the floating pill) and does not when it opens high. FICTIONAL data (the gate seeds and the item-date fixtures). jsdom has no layout and no scrollIntoView, so the positions are STUBBED:
// the module's scroller (its <main> or <div>, found by overflow-y) is 0..700 px, the pill (<nav>) starts at 630, any other element reports `cardRect`; the visible band is therefore 12..614.
//   CARD                       RCD IEL TAT Thermo SWB IRT ELT Welder GSD
//   Complete (Home)             x   x   x    x     x   x   x    x     x   (Thermo / SWB / IRT through their one-line wrappers)
//   Reset all (Home)            x   x   x    x     x   x   x    x     x
//   History Continue            x   x   x    x     x   x   x    x     x   (Thermo ContinueSnapBtn, SWB SWBContinueBtn)
//   Dropdowns list reset        x   x   x    x     x   x   x    x     x   (SWB / ELT / Welder / GSD share ONE view, SWBDropdownsView)
//   duplicate-option notice     x   x   x    x     x   x   x    x     x   (the same view serves SWB / ELT / Welder / GSD: its old bare scroll-on-every-render ref callback is gone)
//   SWB board "Reset board results" (1) and the Calendar event delete (in reveal-cards.test.jsx)
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { GSD_DEFAULT_RESPONSIBILITY } from './App.jsx';
import { GATE_MODS, GATE_SITE_NAMES, seedGateData } from './test/gate-seeds.js';
import { MODULES as FIX, histStore, liveStore, metaStore } from './test/item-dates-fixtures.js';

vi.setConfig({ testTimeout: 30000 });
const frames = async (n = 4) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise(r => requestAnimationFrame(() => r())); }); };
const rectOf = (top, bottom) => ({ top, bottom, left: 0, right: 300, width: 300, height: bottom - top, x: 0, y: top, toJSON() {} });
const LOW = [560, 690], HIGH = [100, 220];

let calls, cardRect, origRect, origClient, origScroll, origMedia, origCS;
beforeEach(() => {
  localStorage.clear(); calls = []; cardRect = LOW;
  origRect = Element.prototype.getBoundingClientRect; origClient = Element.prototype.getClientRects; origScroll = Element.prototype.scrollIntoView; origMedia = window.matchMedia;
  Element.prototype.scrollIntoView = function (o) { calls.push([this.textContent, o]); };
  Element.prototype.getClientRects = function () { return [{}]; };
  Element.prototype.getBoundingClientRect = function () {
    if (this.tagName === 'NAV') return rectOf(630, 682);
    const oy = this.style && this.style.overflowY; if (oy === 'auto' || oy === 'scroll' || this.hasAttribute('data-gs-scroll')) return rectOf(0, 700);       // the module's scroller
    return rectOf(...cardRect);
  };
  window.matchMedia = undefined;
});
afterEach(() => { cleanup(); Element.prototype.getBoundingClientRect = origRect; Element.prototype.getClientRects = origClient; Element.prototype.scrollIntoView = origScroll; window.matchMedia = origMedia; vi.restoreAllMocks(); });

const asked = text => calls.filter(c => c[0].includes(text));
const openSite = async (user, tile, name) => { await user.click(screen.getByText(tile, { exact: true })); await user.click(await screen.findByText(name, { selector: 'div' })); };

describe.each(GATE_MODS)('$short — Home: Complete and Reset all', m => {
  it('Complete opens low: the question and its answers are scrolled into view, once; Cancel scrolls nothing', async () => {
    seedGateData(m, 'new'); const user = userEvent.setup(); render(<AppRoot />); await openSite(user, m.tile, GATE_SITE_NAMES.sa);
    await user.click(screen.getByRole('button', { name: /^Complete/ })); await frames();
    expect(calls.length).toBe(1); expect(calls[0][0]).toContain('Archive this audit and reset for next run?'); expect(calls[0][0]).toContain('Yes, Complete'); expect(calls[0][1]).toEqual({ block: 'nearest', behavior: 'smooth' });
    await user.click(screen.getByRole('button', { name: 'Cancel' })); await frames(); expect(calls.length).toBe(1);
  });
  it('Complete opens high on the screen: no scroll', async () => {
    cardRect = HIGH; seedGateData(m, 'new'); const user = userEvent.setup(); render(<AppRoot />); await openSite(user, m.tile, GATE_SITE_NAMES.sa);
    await user.click(screen.getByRole('button', { name: /^Complete/ })); await frames(); expect(await screen.findByText('Archive this audit and reset for next run?')).toBeInTheDocument(); expect(calls).toEqual([]);
  });
  it('Reset all test results opens low: the prompt and its Reset / Keep are scrolled into view, once', async () => {
    seedGateData(m, 'new'); const user = userEvent.setup(); render(<AppRoot />); await openSite(user, m.tile, GATE_SITE_NAMES.sa);
    await user.click(screen.getByRole('button', { name: m.short === 'Thermo' ? /Reset all photo logs/ : /Reset all test results/ })); await frames();      // Thermo logs photos, not results: its own words
    expect(calls.length).toBe(1); expect(calls[0][0]).toContain(m.short === 'Thermo' ? 'Reset all photo logs?' : 'Reset all results?'); expect(calls[0][0]).toContain('Keep');
  });
});

describe.each(FIX)('$mod — History: Continue', f => {
  it('the Continue question opens low: scrolled into view once (it replaces your audit, so it must be read)', async () => {
    localStorage.setItem(f.keys.p, JSON.stringify(f.project)); localStorage.setItem(f.keys.m, JSON.stringify(metaStore(f))); localStorage.setItem(f.keys.r, JSON.stringify(liveStore(f)));
    localStorage.setItem(f.keys.h, JSON.stringify(histStore(f)));
    const user = userEvent.setup(); render(<AppRoot />); await openSite(user, f.tile, 'Site One');
    await user.click(screen.getByRole('button', { name: /^History$/ })); await user.click(await screen.findByText(/Jane/));
    await user.click(await screen.findByRole('button', { name: /Continue/ })); await frames();
    expect(calls.length).toBe(1); expect(calls[0][0]).toContain('replace your current audit'); expect(calls[0][0]).toContain('Yes, Continue');
  });
});

// Dropdowns: the list Reset and the duplicate-option notice. SWB / ELT / Welder / GSD all run the same SWBDropdownsView.
const site = (id, name) => ({ id, name, company: '', abn: '', licence: '', areas: [] });
const DROP = [
  { name: 'RCD', tile: 'RCD TESTING', key: 'rcd-projects-v6' }, { name: 'IEL', tile: 'IEL TESTING', key: 'iel-projects-v2' }, { name: 'TAT', tile: 'TEST & TAG', key: 'tat-projects-v1' },
  { name: 'Thermo', tile: 'THERMOGRAPHIC', key: 'thermo-projects-v1' }, { name: 'SWB', tile: 'SWITCHBOARD', key: 'swb-projects-v1' }, { name: 'IRT', tile: 'INSULATION RESISTANCE TESTING', key: 'irt-projects-v1' },
  { name: 'ELT', tile: 'EMERGENCY LIGHTING', key: 'elt-projects-v2' }, { name: 'Welder', tile: 'WELDER TESTING', key: 'welder-projects-v1' }, { name: 'GSD', tile: 'GENERAL SITE DEFECTS', key: 'gsd-projects-v1', first: GSD_DEFAULT_RESPONSIBILITY[0] },
];
const firstOf = d => d.first || 'Site Electrician';                // the first (★ default) Responsibility option; GSD has its own short list
async function openDropdowns(user, d) {
  localStorage.setItem(d.key, JSON.stringify([site('s1', 'Site X')])); render(<AppRoot />);
  await openSite(user, d.tile, 'Site X'); await user.click(screen.getByRole('button', { name: 'Dropdowns' })); await screen.findByText(firstOf(d), { selector: 'span' });
}
describe.each(DROP)('$name — Dropdowns', d => {
  it('Reset list to defaults opens low: the prompt and its buttons are scrolled into view, once', async () => {
    const user = userEvent.setup(); await openDropdowns(user, d);
    await user.click(screen.getAllByRole('button', { name: /^Reset( to defaults)?$/ })[0]); await frames();
    expect(calls.length).toBe(1); expect(calls[0][0]).toContain('Reset list to defaults?'); expect(calls[0][0]).toContain('Keep');
  });
  it('a duplicate option: the notice is scrolled into view when it appears, not again on the next keystroke or render', async () => {
    const user = userEvent.setup(); await openDropdowns(user, d);
    const box = screen.getByPlaceholderText('Add new responsibility option…'); await user.type(box, firstOf(d).toLowerCase()); await frames(); expect(calls).toEqual([]);          // typing alone scrolls nothing
    await user.click(within(box.parentElement).getByRole('button', { name: '+ Add' })); await frames();
    const said = `"${firstOf(d)}" is already in the list`;
    expect(screen.getByTestId('dropdown-notice')).toHaveTextContent(said); expect(calls.length).toBe(1); expect(calls[0][0]).toBe(said);
    await user.click(within(box.parentElement).getByRole('button', { name: '+ Add' })); await frames(); expect(calls.length).toBe(1);                 // the same refusal again: the notice stayed, no second scroll
  });
  it('the notice high on the screen: no scroll', async () => {
    cardRect = HIGH; const user = userEvent.setup(); await openDropdowns(user, d);
    const box = screen.getByPlaceholderText('Add new responsibility option…'); await user.type(box, 'Client'); await user.click(within(box.parentElement).getByRole('button', { name: '+ Add' })); await frames();
    expect(screen.getByTestId('dropdown-notice')).toBeInTheDocument(); expect(calls).toEqual([]);
  });
});

describe('SWB — the board page Reset board results', () => {
  it('the question "Reset all results for this board?" opens low: scrolled into view once', async () => {
    seedGateData(GATE_MODS.find(g => g.short === 'SWB'), 'new'); const user = userEvent.setup(); render(<AppRoot />); await openSite(user, 'SWITCHBOARD', GATE_SITE_NAMES.sa);
    await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ })); await user.click(await screen.findByText('Wash Plant')); await user.click(await screen.findByText('MSB 1', { exact: true })); await screen.findByText('BOARD PHOTOS');
    await user.click(screen.getByRole('button', { name: /Reset board results/ })); await frames();
    expect(calls.length).toBe(1); expect(calls[0][0]).toContain('Reset all results for this board'); expect(calls[0][0]).toContain('Keep');
  });
});

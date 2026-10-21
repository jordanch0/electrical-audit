// RELEASE q: the shared confirm cards scroll themselves into view when they open under the floating pill (useRevealOnOpen). FICTIONAL data.
// Each shared component is mounted in a stubbed scroller (0..700 px) with a pill (<nav>) at 630, so the visible band is 12..614; any other element reports the rect the test sets (`cardRect`).
// The Calendar delete is tested through the real Calendar screen. jsdom drops env(), so the margin is read from the source (as gs-reveal.test.jsx and safe-area-layout.test.jsx do).
import React from 'react';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { CompleteAuditBtn, ContinueConfirmBtn, ConfirmReset, DropdownNotice, DeleteButton } from './App.jsx';

const SRC = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8');
const frames = async (n = 4) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise(r => requestAnimationFrame(() => r())); }); };
const rectOf = (top, bottom) => ({ top, bottom, left: 0, right: 300, width: 300, height: bottom - top, x: 0, y: top, toJSON() {} });
const LOW = [560, 690], HIGH = [100, 220];

let calls, cardRect, origRect, origClient, origScroll, origMedia;
beforeEach(() => {
  localStorage.clear(); calls = []; cardRect = LOW;
  origRect = Element.prototype.getBoundingClientRect; origClient = Element.prototype.getClientRects; origScroll = Element.prototype.scrollIntoView; origMedia = window.matchMedia;
  Element.prototype.scrollIntoView = function (o) { calls.push([this.textContent, o]); };
  Element.prototype.getClientRects = function () { return [{}]; };
  Element.prototype.getBoundingClientRect = function () {
    if (this.tagName === 'NAV') return rectOf(630, 682);
    if (this.hasAttribute('data-gs-scroll') || this.tagName === 'MAIN') return rectOf(0, 700);
    return rectOf(...cardRect);
  };
  window.matchMedia = undefined;
});
afterEach(() => { cleanup(); Element.prototype.getBoundingClientRect = origRect; Element.prototype.getClientRects = origClient; Element.prototype.scrollIntoView = origScroll; window.matchMedia = origMedia; vi.restoreAllMocks(); });
const Screen = ({ children }) => <div><div data-gs-scroll="true">{children}</div><nav /></div>;
const fnSrc = name => { const at = SRC.indexOf('function ' + name + '('); expect(at, name).toBeGreaterThan(-1); const end = SRC.indexOf('\nfunction ', at + 10); return SRC.slice(at, end < 0 ? at + 4000 : end); };

describe('CompleteAuditBtn', () => {
  it('opens low: the question and its answers are scrolled into view, once', async () => {
    const user = userEvent.setup(); render(<Screen><CompleteAuditBtn color="#0f766e" label="Complete it" onComplete={() => {}} /></Screen>);
    await user.click(screen.getByRole('button', { name: 'Complete it' })); await frames();
    expect(calls.length).toBe(1); expect(calls[0][0]).toContain('Archive this audit and reset for next run?'); expect(calls[0][0]).toContain('Yes, Complete'); expect(calls[0][1]).toEqual({ block: 'nearest', behavior: 'smooth' });
  });
  it('opens high on the screen: no scroll', async () => {
    cardRect = HIGH; const user = userEvent.setup(); render(<Screen><CompleteAuditBtn color="#0f766e" label="Complete it" onComplete={() => {}} /></Screen>);
    await user.click(screen.getByRole('button', { name: 'Complete it' })); await frames(); expect(calls).toEqual([]);
  });
  it('Cancel does not scroll, and opening it again does', async () => {
    const user = userEvent.setup(); render(<Screen><CompleteAuditBtn color="#0f766e" label="Complete it" onComplete={() => {}} /></Screen>);
    await user.click(screen.getByRole('button', { name: 'Complete it' })); await frames(); await user.click(screen.getByRole('button', { name: 'Cancel' })); await frames(); expect(calls.length).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Complete it' })); await frames(); expect(calls.length).toBe(2);
  });
  it('disabled (a blank auditor): the hook is still called (Rules of Hooks), nothing opens and nothing scrolls; enabling it later works', async () => {
    const user = userEvent.setup(); const { rerender } = render(<Screen><CompleteAuditBtn color="#0f766e" label="Complete it" onComplete={() => {}} disabled /></Screen>);
    await user.click(screen.getByRole('button', { name: 'Complete it' })); await frames(); expect(calls).toEqual([]);
    rerender(<Screen><CompleteAuditBtn color="#0f766e" label="Complete it" onComplete={() => {}} /></Screen>);
    await user.click(screen.getByRole('button', { name: 'Complete it' })); await frames(); expect(calls.length).toBe(1);
  });
});

describe('ContinueConfirmBtn (and the Thermo and Switchboard wrappers that only pass a colour)', () => {
  it('opens low: scrolled into view', async () => {
    const user = userEvent.setup(); render(<Screen><ContinueConfirmBtn onConfirm={() => {}} /></Screen>);
    await user.click(screen.getByRole('button', { name: /Continue/ })); await frames();
    expect(calls.length).toBe(1); expect(calls[0][0]).toContain('replace your current audit'); expect(calls[0][0]).toContain('Yes, Continue');
  });
  it('opens high: no scroll; Cancel does not scroll', async () => {
    cardRect = HIGH; const user = userEvent.setup(); render(<Screen><ContinueConfirmBtn onConfirm={() => {}} /></Screen>);
    await user.click(screen.getByRole('button', { name: /Continue/ })); await frames(); await user.click(screen.getByRole('button', { name: 'Cancel' })); await frames(); expect(calls).toEqual([]);
  });
  it('ContinueSnapBtn and SWBContinueBtn are one-line wrappers of it (so they need no hook of their own)', () => {
    expect(fnSrc('ContinueSnapBtn')).toContain('React.createElement(ContinueConfirmBtn'); expect(fnSrc('SWBContinueBtn')).toContain('React.createElement(ContinueConfirmBtn');
    expect(fnSrc('ThermoCompleteAuditBtn')).toContain('React.createElement(CompleteAuditBtn'); expect(fnSrc('SWBCompleteAuditBtn')).toContain('React.createElement(CompleteAuditBtn'); expect(fnSrc('IRTCompleteBtn')).toContain('React.createElement(CompleteAuditBtn');
  });
});

describe('ConfirmReset', () => {
  const R = () => <Screen><ConfirmReset onConfirm={() => {}} prompt="Reset it?" renderIdle={open => <button onClick={open}>Reset thing</button>} /></Screen>;
  it('opens low: the prompt and its buttons are scrolled into view', async () => {
    const user = userEvent.setup(); render(<R />); await user.click(screen.getByRole('button', { name: 'Reset thing' })); await frames();
    expect(calls.length).toBe(1); expect(calls[0][0]).toContain('Reset it?'); expect(calls[0][0]).toContain('Keep');
  });
  it('opens high: no scroll; Keep does not scroll', async () => {
    cardRect = HIGH; const user = userEvent.setup(); render(<R />); await user.click(screen.getByRole('button', { name: 'Reset thing' })); await frames(); await user.click(screen.getByRole('button', { name: 'Keep' })); await frames(); expect(calls).toEqual([]);
  });
});

describe('DropdownNotice', () => {
  it('a notice that appears low is scrolled into view; one already there on the first render is not', async () => {
    const { rerender } = render(<Screen><DropdownNotice text="" /></Screen>); await frames(); expect(calls).toEqual([]);
    rerender(<Screen><DropdownNotice text={'"Site Electrician" is already in the list'} /></Screen>); await frames();
    expect(calls.length).toBe(1); expect(calls[0][0]).toContain('is already in the list');
    cleanup(); calls = []; render(<Screen><DropdownNotice text="Already here at mount" /></Screen>); await frames(); expect(calls).toEqual([]);
  });
  it('a changed text while it stays shown does not scroll again; clearing it does not scroll; showing it again does', async () => {
    const { rerender } = render(<Screen><DropdownNotice text="first" /></Screen>); rerender(<Screen><DropdownNotice text="" /></Screen>); await frames();
    rerender(<Screen><DropdownNotice text="second" /></Screen>); await frames(); expect(calls.length).toBe(1);
    rerender(<Screen><DropdownNotice text="third" /></Screen>); await frames(); expect(calls.length).toBe(1);
    rerender(<Screen><DropdownNotice text="" /></Screen>); await frames(); expect(calls.length).toBe(1);
    rerender(<Screen><DropdownNotice text="fourth" /></Screen>); await frames(); expect(calls.length).toBe(2);
  });
  it('high on the screen: no scroll', async () => { cardRect = HIGH; const { rerender } = render(<Screen><DropdownNotice text="" /></Screen>); rerender(<Screen><DropdownNotice text="x" /></Screen>); await frames(); expect(calls).toEqual([]); });
});

describe('the Calendar event delete (the tallest in-place question: Delete, All N in series, Keep)', () => {
  const iso = d => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
  const trashes = c => [...c.querySelectorAll('button')].filter(b => b.querySelector('polyline[points="3 6 5 6 21 6"]'));
  it('opens low: the column is scrolled into view; Keep does not scroll', async () => {
    localStorage.setItem('cal-events-v1', JSON.stringify([{ id: 'e1', type: 'rcd_push', site: 'Site A', dueDate: iso(3), notes: '', seriesId: null }]));
    const user = userEvent.setup(); const { container } = render(<AppRoot />);
    await user.click(screen.getByRole('button', { name: 'Open Test Calendar' })); await waitFor(() => expect(trashes(container).length).toBe(1));
    await user.click(trashes(container)[0]); await frames(); expect(calls.length).toBe(1); expect(calls[0][0]).toContain('Delete?'); expect(calls[0][0]).toContain('Keep');
    await user.click(screen.getByRole('button', { name: 'Keep' })); await frames(); expect(calls.length).toBe(1);
  });
  it('a series event: the column holds three buttons and is scrolled as one block', async () => {
    localStorage.setItem('cal-events-v1', JSON.stringify([{ id: 's1', type: 'rcd_push', site: 'Site A', dueDate: iso(3), notes: '', seriesId: 'ser', seriesIndex: 0, seriesTotal: 4, recur: 'Monthly' }]));
    const user = userEvent.setup(); const { container } = render(<AppRoot />);
    await user.click(screen.getByRole('button', { name: 'Open Test Calendar' })); await waitFor(() => expect(trashes(container).length).toBe(1));
    await user.click(trashes(container)[0]); await frames(); expect(calls.length).toBe(1); expect(calls[0][0]).toContain('All 4 in series');
  });
});

describe('DeleteButton is NOT part of release q: it does not scroll (GSD keeps its own revealBottom)', () => {
  it('opening a Delete question under the pill scrolls nothing', async () => {
    const user = userEvent.setup(); const { container } = render(<Screen><DeleteButton onDelete={() => {}} label="Delete A?" /></Screen>);
    await user.click(container.querySelector('button')); await frames(); expect(screen.getByText('Delete A?')).toBeInTheDocument(); expect(calls).toEqual([]);
  });
});

describe('the margin: the cards stop 16 px above the pill (read from the source)', () => {
  it('the shared margin object is still the Global Settings one', () => { expect(SRC).toContain('const GS_MSG_MARGIN = { scrollMarginTop: 12, scrollMarginBottom: NAV_CLEARANCE };'); });
  for (const name of ['DropdownNotice', 'ConfirmReset', 'ContinueConfirmBtn', 'CompleteAuditBtn', 'EventCard']) {
    it(name + ' calls useRevealOnOpen and spreads the margin on the card it reveals', () => { const s = fnSrc(name); expect(s).toContain('useRevealOnOpen('); expect(s).toContain('...GS_MSG_MARGIN'); });
  }
});

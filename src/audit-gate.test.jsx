// ONE gate for all six audit modules: identical layout, copy, icons, buttons and spacing; only the accent (icon + button fill) changes.
// Title/body text is dark; white label on the accent fill >= 4.5:1; icon >= 3:1 on the page background; no test interval in any gate text.
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { AuditGatePage } from './App.jsx';

afterEach(() => cleanup()); beforeEach(() => localStorage.clear());

const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgb = h => `rgb(${[1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ')})`;
const PAGE_BG = '#e8e6e2';
const INTERVAL_WORDS = /monthly|weekly|annual|yearly|quarterly|every \d|\d+[- ]?month|interval|biannual/i;

// [tile, projects key, accent]
const MODULES = [
  ['RCD TESTING', 'rcd-projects-v6', '#a3530f'], ['IEL TESTING', 'iel-projects-v2', '#047857'], ['TEST & TAG', 'tat-projects-v1', '#1d4ed8'],
  ['THERMOGRAPHIC', 'thermo-projects-v1', '#c2410c'], ['SWITCHBOARD', 'swb-projects-v1', '#7e22ce'], ['INSULATION RESISTANCE TESTING', 'irt-projects-v1', '#1d4ed8'],
];
const NO_ACTIVE = ['NO ACTIVE AUDIT', 'No audit is currently in progress.', 'Go to Home, enter your auditor name, then tap Start Audit.', '⌂ Go to Home to Start Audit'];
const IN_PROGRESS = ['AUDIT IN PROGRESS', 'Tap Continue to test items, or go Home to complete the audit.', 'Continue Audit →', '⌂ Back to Home'];
const noop = () => {};

describe('AuditGatePage rendered directly, for every module accent', () => {
  const accents = [...new Set(MODULES.map(m => m[2]))];
  accents.forEach(accent => {
    it(`${accent}: white label on the accent fill >= 4.5:1, icon >= 3:1 on the page`, () => {
      expect(ratio('#ffffff', accent)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(accent, PAGE_BG)).toBeGreaterThanOrEqual(3);
    });
  });
  it('title and body text colours are >= 4.5:1 on the page', () => {
    expect(ratio('#18181b', PAGE_BG)).toBeGreaterThanOrEqual(4.5); expect(ratio('#52525b', PAGE_BG)).toBeGreaterThanOrEqual(4.5);
  });
  it('the markup is identical in every module except the accent colour (both states)', () => {
    [true, false].forEach(active => {
      const html = accent => { const { container, unmount } = render(<AuditGatePage accent={accent} hasActiveAudit={active} onGoHome={noop} onEnterAudit={noop} />); const h = container.innerHTML; unmount(); return h; };
      const norm = (h, accent) => h.split(rgb(accent)).join('ACCENT').split(accent).join('ACCENT');
      const base = norm(html(accents[0]), accents[0]);
      accents.slice(1).forEach(a => expect(norm(html(a), a)).toBe(base));
      expect(base).toContain('ACCENT');
    });
  });
  it('copy: NO ACTIVE has only "Go to Home to Start Audit"; IN PROGRESS has Continue + Back to Home; the outline is >= 3:1; no interval words', () => {
    const { container, rerender } = render(<AuditGatePage accent="#a3530f" hasActiveAudit={false} onGoHome={noop} onEnterAudit={noop} />);
    NO_ACTIVE.forEach(t => expect(container.textContent).toContain(t));
    expect(screen.queryByText(/Back to Home/)).toBeNull(); expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(container.textContent).not.toMatch(INTERVAL_WORDS);
    rerender(<AuditGatePage accent="#a3530f" hasActiveAudit={true} onGoHome={noop} onEnterAudit={noop} />);
    IN_PROGRESS.forEach(t => expect(container.textContent).toContain(t));
    expect(screen.getAllByRole('button')).toHaveLength(2); expect(container.textContent).not.toMatch(INTERVAL_WORDS);
    expect(screen.getByText(/Back to Home/).style.border).toContain('rgb(124, 124, 134)');
    expect(ratio('#7c7c86', PAGE_BG)).toBeGreaterThanOrEqual(3);
    expect(container.textContent).not.toMatch(/Currently running|boards/);
  });
  it('the icon takes the accent; the title is dark, not the accent', () => {
    const { container } = render(<AuditGatePage accent="#7e22ce" hasActiveAudit={true} onGoHome={noop} onEnterAudit={noop} />);
    expect(screen.getByTestId('gate-icon').style.color).toBe(rgb('#7e22ce'));
    expect(screen.getByText('AUDIT IN PROGRESS').style.color).toBe(rgb('#18181b'));
    expect(screen.getByText(/Continue Audit/).style.background).toBe(rgb('#7e22ce'));
    expect(container.querySelectorAll('strong')).toHaveLength(0);
  });
});

describe('every module renders that same gate component (no per-module copies)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8');
  it('SWBAuditGate / IRTAuditGate are gone; exactly one gate definition used nine times (all nine modules)', () => {
    expect(src).not.toMatch(/function SWBAuditGate|function IRTAuditGate/);
    expect(src.match(/function \w*AuditGate\w*\(/g)).toEqual(['function AuditGatePage(']);
    expect((src.match(/createElement\(AuditGatePage/g) || []).length).toBe(9);
  });
});

describe('NO ACTIVE AUDIT gate in each module (site never audited)', () => {
  MODULES.forEach(([tile, key, accent]) => {
    it(`${tile}: same copy, module accent on icon + button`, async () => {
      localStorage.setItem(key, JSON.stringify([{ id: 's1', name: 'Demo Site', company: '', abn: '', licence: '', areas: [] }]));
      const user = userEvent.setup(); render(<AppRoot />);
      await user.click(screen.getByText(tile, { exact: true })); await user.click(await screen.findByText('Demo Site', { selector: 'div' }));
      await user.click(screen.getByRole('button', { name: /^Audit$/ }));
      expect(await screen.findByText('NO ACTIVE AUDIT')).toBeInTheDocument();
      NO_ACTIVE.forEach(t => expect(document.body.textContent).toContain(t));
      expect(screen.getByTestId('gate-icon').style.color).toBe(rgb(accent));
      expect(screen.getByText(/Go to Home to Start Audit/).style.background).toBe(rgb(accent));
      expect(document.body.textContent).not.toMatch(INTERVAL_WORDS);
    });
  });
});

describe('AUDIT IN PROGRESS gate after Start + Back to Home (RCD, TAT, Thermo)', () => {
  const site = { id: 's1', name: 'Demo Site', company: '', abn: '', licence: '', areas: [] };
  it('RCD: Start Push Test, Back to Home, Audit tab', async () => {
    localStorage.setItem('rcd-projects-v6', JSON.stringify([site])); localStorage.setItem('rcd-meta-v6', JSON.stringify({ s1: { auditor: 'Jane' } }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('RCD TESTING', { exact: true })); await user.click(await screen.findByText('Demo Site', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /^Push Test/ })); await user.click(screen.getAllByText('Back')[0]); await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
    IN_PROGRESS.forEach(t => expect(document.body.textContent).toContain(t));
    expect(screen.getByTestId('gate-icon').style.color).toBe(rgb('#a3530f'));
  });
  [['TEST & TAG', 'tat-projects-v1', 'tat-meta-v1', '#1d4ed8'], ['THERMOGRAPHIC', 'thermo-projects-v1', 'thermo-meta-v1', '#c2410c']].forEach(([tile, pk, mk, accent]) => {
    it(`${tile}: Start, Back to Home, Audit tab`, async () => {
      localStorage.setItem(pk, JSON.stringify([site])); localStorage.setItem(mk, JSON.stringify({ s1: { auditor: 'Jane', testDate: '2026-10-01' } }));
      const user = userEvent.setup(); render(<AppRoot />);
      await user.click(screen.getByText(tile, { exact: true })); await user.click(await screen.findByText('Demo Site', { selector: 'div' }));
      await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ })); await user.click(screen.getAllByText('Back')[0]);
      await user.click(screen.getByRole('button', { name: /^Audit$/ }));
      expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
      IN_PROGRESS.forEach(t => expect(document.body.textContent).toContain(t));
      expect(screen.getByTestId('gate-icon').style.color).toBe(rgb(accent));
    });
  });
});

// ── Blank auditor rule (2026-10-03): Start needs an auditor name but the Home field can be cleared afterwards, so with a blank auditor the
// in-progress gate disables Continue (grey, readable) and says why in the line directly under it; Back to Home stays enabled.
const BLANK_MSG = 'Enter the auditor name on Home to continue.';
describe('AuditGatePage blank-auditor rule (the one shared component, so identical in all six modules)', () => {
  [...new Set(MODULES.map(m => m[2]))].forEach(accent => {
    it(`${accent}: blank auditor -> Continue disabled + readable + reason in text, Back to Home works; auditor set -> Continue works`, async () => {
      const user = userEvent.setup(); let went = 0, entered = 0;
      const { container, rerender } = render(<AuditGatePage accent={accent} hasActiveAudit={true} hasAuditor={false} onGoHome={() => { went++; }} onEnterAudit={() => { entered++; }} />);
      const cont = screen.getByRole('button', { name: /Continue Audit/ });
      expect(cont).toBeDisabled(); expect(cont.style.background).toBe(rgb('#e4e4e7')); expect(cont.style.color).toBe(rgb('#52525b'));
      expect(ratio('#52525b', '#e4e4e7')).toBeGreaterThanOrEqual(4.5);                      // the disabled label stays readable
      expect(screen.getByText(BLANK_MSG)).toBeInTheDocument();                              // the reason is TEXT, not only the grey
      expect(ratio('#b91c1c', PAGE_BG)).toBeGreaterThanOrEqual(4.5);
      expect(container.textContent).not.toMatch(INTERVAL_WORDS);
      expect(cont.compareDocumentPosition(screen.getByText(BLANK_MSG)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();   // directly beneath Continue
      await user.click(cont); expect(entered).toBe(0);
      const back = screen.getByRole('button', { name: /Back to Home/ }); expect(back).toBeEnabled();
      await user.click(back); expect(went).toBe(1);
      rerender(<AuditGatePage accent={accent} hasActiveAudit={true} hasAuditor={true} onGoHome={() => { went++; }} onEnterAudit={() => { entered++; }} />);
      expect(screen.queryByText(BLANK_MSG)).toBeNull();
      const cont2 = screen.getByRole('button', { name: /Continue Audit/ });
      expect(cont2).toBeEnabled(); expect(cont2.style.background).toBe(rgb(accent)); expect(cont2.style.color).toBe(rgb('#ffffff'));
      await user.click(cont2); expect(entered).toBe(1);
    });
  });
  it('the NO ACTIVE AUDIT gate is unaffected by the auditor', () => {
    render(<AuditGatePage accent="#a3530f" hasActiveAudit={false} hasAuditor={false} onGoHome={noop} onEnterAudit={noop} />);
    expect(screen.queryByText(BLANK_MSG)).toBeNull(); expect(screen.getByRole('button', { name: /Go to Home to Start Audit/ })).toBeEnabled();
  });
});

describe('blank auditor in the app (the modules that can reach the in-progress gate today: RCD, IEL; the other four join in the per-site-flag commit)', () => {
  const site = { id: 's1', name: 'Demo Site', company: '', abn: '', licence: '', areas: [] };
  it('RCD: start, Back, clear the auditor -> gate shows disabled Continue + message; Back to Home works; setting the auditor re-enables Continue', async () => {
    localStorage.setItem('rcd-projects-v6', JSON.stringify([site])); localStorage.setItem('rcd-meta-v6', JSON.stringify({ s1: { auditor: 'Jane' } }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('RCD TESTING', { exact: true })); await user.click(await screen.findByText('Demo Site', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /^Push Test/ })); await user.click(screen.getAllByText('Back')[0]);
    await user.clear(screen.getByDisplayValue('Jane')); await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue Audit/ })).toBeDisabled(); expect(screen.getByText(BLANK_MSG)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Back to Home/ }));
    expect(await screen.findByRole('button', { name: /^Push Test/ })).toBeInTheDocument();      // Back to Home landed on Home
    await user.type(screen.getAllByRole('textbox')[0], 'Jane');                                // the auditor field is the first text box on Home
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));
    expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
    expect(screen.queryByText(BLANK_MSG)).toBeNull(); expect(screen.getByRole('button', { name: /Continue Audit/ })).toBeEnabled();
  });
  [['IEL TESTING', 'iel-projects-v2', 'iel-meta-v2'], ['RCD TESTING', 'rcd-projects-v6', 'rcd-meta-v6']].forEach(([tile, pk, mk]) => {
    it(`${tile}: with an auditor set the gate's Continue works (enters the audit)`, async () => {
      localStorage.setItem(pk, JSON.stringify([{ ...site, areas: [{ id: 'a1', name: 'Plant', panels: [], categories: [] }] }])); localStorage.setItem(mk, JSON.stringify({ s1: { auditor: 'Jane' } }));
      if (pk.startsWith('iel')) localStorage.setItem('iel-cat-v2', JSON.stringify('estops')); else localStorage.setItem('rcd-mode-v6', JSON.stringify('push'));
      const user = userEvent.setup(); render(<AppRoot />);
      await user.click(screen.getByText(tile, { exact: true })); await user.click(await screen.findByText('Demo Site', { selector: 'div' }));
      await user.click(screen.getByRole('button', { name: /^Audit$/ }));                 // reopening a site goes straight to the folders...
      await user.click(screen.getAllByText('Back')[0]); await user.click(screen.getByRole('button', { name: /^Audit$/ }));   // ...Back arms the gate
      expect(await screen.findByText('AUDIT IN PROGRESS')).toBeInTheDocument();
      expect(screen.queryByText(BLANK_MSG)).toBeNull();
      await user.click(screen.getByRole('button', { name: /Continue Audit/ }));
      expect(screen.queryByText('AUDIT IN PROGRESS')).toBeNull();
    });
  });
});

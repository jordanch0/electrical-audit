// Seven UI consistency fixes: one icon registry (home cards == Calendar), text-only Complete Audit buttons, IRT full title,
// two card descriptions, RCD Push / Injection icons, and equal Calendar grid row heights.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import AppRoot, { moduleIcon, ICON_DEFS, CAL_TYPES, CompleteAuditBtn } from './App.jsx';

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.useRealTimers(); });
const unsize = s => s.replace(/ width="\d+"/, '').replace(/ height="\d+"/, '');   // compare shape, not size
const norm = el => unsize(renderToStaticMarkup(el));
const domOf = el => { const { container } = render(el); return unsize(container.innerHTML); };   // serialised by the same DOM as the page

describe('icon registry: the home cards and the Calendar share the exact same icon per module', () => {
  const PAIRS = { rcd_push: 'rcd_push', rcd_inject: 'rcd_inject', iel_estop: 'iel', iel_lanyard: 'iel', iel_iso: 'iel', tat: 'tat', thermo: 'thermo', swb: 'swb', irt: 'irt', elt: 'elt', welder: 'welder' };
  it.each(Object.entries(PAIRS))('Calendar %s uses registry icon "%s" (same markup, only the size differs)', (calKey, iconKey) => {
    const cal = CAL_TYPES.find(t => t.key === calKey);
    expect(cal).toBeTruthy();
    expect(norm(cal.icon)).toBe(norm(moduleIcon(iconKey)));
    expect(cal.icon.props.width).toBe(15);                      // Calendar size...
    expect(moduleIcon(iconKey).props.width).toBe(18);           // ...home size: the same drawing at two sizes
  });

  it('every home-screen card renders the registry icon for its module', () => {
    render(<AppRoot />);
    const cards = { 'RCD TESTING': 'rcd', 'IEL TESTING': 'iel', 'TEST & TAG': 'tat', 'THERMOGRAPHIC': 'thermo', 'SWITCHBOARD': 'swb', 'INSULATION RESISTANCE TESTING': 'irt', 'EMERGENCY LIGHTING': 'elt', 'WELDER TESTING': 'welder' };
    Object.entries(cards).forEach(([name, key]) => {
      const svg = screen.getByText(name).closest('button').querySelector('svg');
      expect(unsize(svg.outerHTML)).toBe(domOf(moduleIcon(key)));
    });
    const pill = screen.getByRole('button', { name: 'Open Test Calendar' }).querySelector('svg');
    expect(unsize(pill.outerHTML)).toBe(domOf(moduleIcon('cal')));
  });

  it('RCD Push and Injection have their own meaningful icons (not the old clipboard / sun) and differ from each other and the RCD module icon', () => {
    const [rcd, push, inject] = ['rcd', 'rcd_push', 'rcd_inject'].map(k => norm(moduleIcon(k)));
    expect(new Set([rcd, push, inject]).size).toBe(3);
    expect(inject).not.toContain('M12 1v4M12 19v4');            // the old sun-with-rays
    expect(push).not.toContain('M9 5H7');                       // the old clipboard
    expect(Object.keys(ICON_DEFS)).toEqual(expect.arrayContaining(['rcd', 'rcd_push', 'rcd_inject', 'iel', 'tat', 'thermo', 'swb', 'irt', 'elt', 'welder', 'cal']));
    expect(fs.readFileSync('src/App.jsx', 'utf8')).not.toMatch(/x:9,y:2,width:6,height:4,rx:1[\s\S]{0,400}"Push Test"/); // no inline copy left in RCD's mode button
  });
});

describe('Complete Audit button: text only, in both states, in every module', () => {
  it('shared component: no icon idle, no icon on "Yes, Complete"', async () => {
    const user = userEvent.setup();
    render(<CompleteAuditBtn color="#0f766e" label="Complete Test Audit" onComplete={() => {}} />);
    const idle = screen.getByRole('button', { name: 'Complete Test Audit' });
    expect(idle.querySelector('svg')).toBeNull();
    await user.click(idle);
    const yes = screen.getByRole('button', { name: 'Yes, Complete' });
    expect(yes.querySelector('svg')).toBeNull();
    expect(yes.textContent).toBe('Yes, Complete');
  });

  it('no module passes an element (icon / glyph) as the label — every call site passes a plain string', () => {
    const src = fs.readFileSync('src/App.jsx', 'utf8');
    const calls = [...src.matchAll(/CompleteAuditBtn,\s*\{[^\n]*/g)].map(m => m[0]);
    expect(calls.length).toBeGreaterThanOrEqual(8);
    calls.forEach(c => { expect(c).not.toMatch(/label:\s*React\.createElement/); expect(c).not.toContain('✓'); });
    expect(src).not.toMatch(/const lbl=React\.createElement/);
    expect(src).not.toMatch(/Complete [A-Za-z ]+Audit"\)\)/);   // the old "<icon><span> Complete … Audit</span>" fragments
  });
});

describe('IRT header title and card descriptions', () => {
  it('IRT shows its full name as the module title (every IRT screen); the card keeps its short name', async () => {
    localStorage.setItem('irt-projects-v1', JSON.stringify([{ id: 'i1', name: 'IRT Site', company: '', abn: '', licence: '', areas: [] }]));
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('INSULATION RESISTANCE TESTING'));                                  // card unchanged
    expect(await screen.findByText('Insulation Resistance Testing')).toBeInTheDocument();   // landing (site list)
    await user.click(await screen.findByText('IRT Site'));
    expect(screen.getByText('Insulation Resistance Testing')).toBeInTheDocument();     // and inside the module
    expect(screen.queryByText('IR Testing')).not.toBeInTheDocument();
  });

  it('ELT and IEL card descriptions are exactly as specified', () => {
    render(<AppRoot />);
    expect(screen.getByText('Emergency lighting checks')).toBeInTheDocument();
    expect(screen.getByText('Isolators, E-Stops and Lanyards')).toBeInTheDocument();
    expect(screen.queryByText('AS 2293.2 emergency light register')).not.toBeInTheDocument();
    expect(screen.queryByText('Lanyards, e-stops and isolators')).not.toBeInTheDocument();
  });
});

describe('Calendar month grid: every row is the same height', () => {
  it('a month that does not start on Sunday has no taller first row (placeholder cells match date cells)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-15T12:00:00'));                               // September 2026 starts on a Tuesday
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<AppRoot />);
    await user.click(screen.getByRole('button', { name: 'Open Test Calendar' }));
    await user.click(await screen.findByRole('button', { name: /^Calendar$/ }));
    const grid = [...document.querySelectorAll('div')].filter(d => (d.getAttribute('style') || '').includes('repeat(7'))[1];
    const cells = [...grid.children];
    expect(cells.length).toBe(2 + 30);                                               // 2 leading placeholders + 30 days
    expect(new Set(cells.map(c => c.style.height))).toEqual(new Set(['44px']));      // was 52px placeholders vs 44px dates
  });
});

describe('IRT header sits exactly where every other module\'s does; full name on the card and in the Calendar', () => {
  // #root (index.html) carries padding-top: env(safe-area-inset-top). A position:fixed / inset:0 module container ignores that
  // padding, which put IRT's header higher than the others on a notched iPhone. Every module must be an ordinary in-flow flex child.
  const fixedAncestors = el => { const out = []; for (let n = el; n && n !== document.body; n = n.parentElement) { if ((n.style && n.style.position) === 'fixed') out.push(n); } return out; };
  it.each([
    ['SWITCHBOARD', 'swb-projects-v1', 'Switchboard'],
    ['INSULATION RESISTANCE TESTING', 'irt-projects-v1', 'Insulation Resistance Testing'],
  ])('%s: no position:fixed container between #root and the header', async (card, key, title) => {
    localStorage.setItem(key, JSON.stringify([{ id: 's1', name: 'Site S', company: '', abn: '', licence: '', areas: [] }]));
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText(card));
    const heading = await screen.findByText(title);
    expect(fixedAncestors(heading)).toEqual([]);
  });

  it('the home card and the Calendar event type both carry the full name (no "IR Testing" left as a module label)', () => {
    render(<AppRoot />);
    expect(screen.getByText('INSULATION RESISTANCE TESTING')).toBeInTheDocument();
    expect(screen.queryByText('IR TESTING')).not.toBeInTheDocument();
    expect(CAL_TYPES.find(t => t.key === 'irt').label).toBe('Insulation Resistance Testing');
  });
});

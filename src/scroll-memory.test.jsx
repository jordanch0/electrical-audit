// Drill-down list levels remember their scroll position (Back returns to where you tapped); detail pages and the tab views start at the TOP.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { useScrollMemory } from './App.jsx';

afterEach(() => cleanup()); beforeEach(() => localStorage.clear());
const scrollTo = (el, n) => { el.scrollTop = n; fireEvent.scroll(el); };

describe('useScrollMemory', () => {
  function Host({ k, remember }) { const ref = React.useRef(null); useScrollMemory(ref, k, remember); return <div ref={ref} data-testid="box" style={{ overflow: 'auto' }}>content</div>; }
  it('a remembered level comes back where you left it; a level entered for the first time starts at 0; a non-remembered level ALWAYS starts at 0 and never overwrites the list position', () => {
    const { rerender } = render(<Host k="list" remember />); const box = screen.getByTestId('box');
    scrollTo(box, 300); expect(box.scrollTop).toBe(300);
    rerender(<Host k="detail" remember={false} />); expect(box.scrollTop).toBe(0);                  // detail page: top
    scrollTo(box, 80);                                                                             // scrolling the detail page must not clobber the list's position
    rerender(<Host k="list" remember />); expect(box.scrollTop).toBe(300);                          // Back: restored
    rerender(<Host k="detail" remember={false} />); expect(box.scrollTop).toBe(0);                  // opening the SAME detail again: still the top (never a remembered position)
    rerender(<Host k="list" remember />); expect(box.scrollTop).toBe(300);
    rerender(<Host k="list2" remember />); expect(box.scrollTop).toBe(0);                            // a different list level: its own (empty) memory
    scrollTo(box, 40); rerender(<Host k="list" remember />); expect(box.scrollTop).toBe(300); rerender(<Host k="list2" remember />); expect(box.scrollTop).toBe(40);
  });
  it('a container that appears LATER (after the module loads) is still tracked', () => {
    function Late({ k, show }) { const ref = React.useRef(null); useScrollMemory(ref, k, true); return show ? <div ref={ref} data-testid="late">x</div> : <div>loading</div>; }
    const { rerender } = render(<Late k="a" show={false} />); rerender(<Late k="a" show />); const el = screen.getByTestId('late');
    scrollTo(el, 150); rerender(<Late k="b" show />); expect(el.scrollTop).toBe(0); rerender(<Late k="a" show />); expect(el.scrollTop).toBe(150);
  });
});

const mainOf = () => document.querySelector('nav').previousElementSibling;                                 // the module's main scroll container sits just above its bottom nav

describe('SWB: area list, board list and board each remember their position; the item page starts at the top', () => {
  it('walks down and Back up, restoring every level', async () => {
    localStorage.setItem('swb-projects-v1', JSON.stringify([{ id: 's1', name: 'Site S', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }, { id: 'a2', name: 'Yard', boards: [] }] }]));
    localStorage.setItem('swb-meta-v1', JSON.stringify({ s1: { auditor: 'Jane', testDate: '2026-09-21' } }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD')); await user.click(await screen.findByText('Site S', { selector: 'div' })); await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ }));
    await screen.findByText('Yard'); scrollTo(mainOf(), 250);                                             // area list scrolled
    await user.click(screen.getByText('Plant')); await screen.findByText('MSB'); expect(mainOf().scrollTop).toBe(0);      // board list: its own level, starts at 0
    scrollTo(mainOf(), 120); await user.click(screen.getByText('MSB')); await screen.findByText('Enclosure Condition'); expect(mainOf().scrollTop).toBe(0);
    scrollTo(mainOf(), 400); await user.click(screen.getByText('Enclosure Condition')); expect(mainOf().scrollTop).toBe(0);                                  // the ITEM page: always the top
    await user.click(screen.getAllByText('Back')[0]); await screen.findByText('Enclosure Condition'); expect(mainOf().scrollTop).toBe(400);                  // board checklist: where you tapped
    await user.click(screen.getAllByText('Back')[0]); await screen.findByText('MSB'); expect(mainOf().scrollTop).toBe(120);                                 // board list
    await user.click(screen.getAllByText('Back')[0]); await screen.findByText('Yard'); expect(mainOf().scrollTop).toBe(250);                                // area list
  });
});

describe('ELT / Welder / GSD: the Audit list remembers; the item page and the tabs start at the top', () => {
  it('GSD', async () => {
    localStorage.setItem('gsd-projects-v1', JSON.stringify([{ id: 's1', name: 'Site G', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'One' }] }]));
    localStorage.setItem('gsd-meta-v1', JSON.stringify({ s1: { auditor: 'J', testDate: '2026-09-21' } }));
    localStorage.setItem('gsd-items-v1', JSON.stringify({ s1: [{ id: 'i1', areaId: 'a1', assetLocation: '', category: '', commonDefect: '', description: 'x', descAuto: '', photos: [], priority: '', responsibility: '', dueDate: '' }] }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('GENERAL SITE DEFECTS')); await user.click(await screen.findByText('Site G', { selector: 'div' })); await user.click(screen.getByRole('button', { name: 'Audit' }));
    await screen.findByTestId('gsd-card'); scrollTo(mainOf(), 333);
    await user.click(screen.getByTestId('gsd-card')); expect(mainOf().scrollTop).toBe(0);                    // item page
    await user.click(screen.getAllByText('Back')[0]); await screen.findByTestId('gsd-card'); expect(mainOf().scrollTop).toBe(333);
    await user.click(screen.getByRole('button', { name: 'Report' })); expect(mainOf().scrollTop).toBe(0);      // a tab view starts at the top
    await user.click(screen.getByRole('button', { name: 'Audit' })); await screen.findByTestId('gsd-card'); expect(mainOf().scrollTop).toBe(333);   // and the list still remembers
  });
  it('ELT', async () => {
    localStorage.setItem('elt-projects-v2', JSON.stringify([{ id: 'p1', name: 'Site E', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Site E', assets: [{ id: 'x1', assetLocation: 'SE Door', assetId: '', type: 'Exit Signs', typeOther: '', maintained: 'Maintained', fitting: '' }] }] }]));
    localStorage.setItem('elt-meta-v1', JSON.stringify({ p1: { auditor: 'J', testDate: '2026-09-21' } }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('EMERGENCY LIGHTING')); await user.click(await screen.findByText('Site E', { selector: 'div' })); await user.click(screen.getByRole('button', { name: 'Audit' }));
    await screen.findByText('SE Door'); scrollTo(mainOf(), 210);
    await user.click(screen.getByText('SE Door')); expect(mainOf().scrollTop).toBe(0);
    await user.click(screen.getAllByText('Back')[0]); await screen.findByText('SE Door'); expect(mainOf().scrollTop).toBe(210);
  });
});

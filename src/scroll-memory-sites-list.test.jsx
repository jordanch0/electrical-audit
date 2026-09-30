// Fix #2 (2026-09-29): the top-level Sites list (view==="projects") is a drill-down list level exactly like an
// area/board list — scrolling down a long site list, opening a site, then hitting Back should restore the scroll
// position. This was missed in the original useScrollMemory rollout (2026-09-27) because the site list reads as a
// "tab view" rather than a drill-down level. Covers all 9 modules that have a site list (Calendar has none).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

// Finds the nearest ancestor styled as the module's scrollable content container.
function findScrollContainer(el) {
  let node = el;
  while (node && node !== document.body) {
    if (node.style && node.style.overflowY === 'auto') return node;
    node = node.parentElement;
  }
  throw new Error('No scrollable container found above ' + el.outerHTML.slice(0, 80));
}
const scrollTo = (el, n) => { el.scrollTop = n; fireEvent.scroll(el); };

describe('Sites list remembers scroll position on Back (all 9 modules)', () => {
  it('RCD', async () => {
    const user = userEvent.setup();
    const mk = (id, name) => ({ id, name, company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Area 1', panels: [{ id: 'p1', name: 'MSB1', circuits: ['CB1'] }] }] });
    localStorage.setItem('rcd-projects-v6', JSON.stringify([mk('s1', 'Alpha Site'), mk('s2', 'Beta Site')]));
    render(<AppRoot />);
    await user.click(await screen.findByText('RCD TESTING'));
    const site2 = await screen.findByText('Beta Site');
    scrollTo(findScrollContainer(site2), 300);
    await user.click(await screen.findByText('Alpha Site'));
    await screen.findByPlaceholderText('Enter name to begin audit…');
    await user.click(screen.getAllByText('Back')[0]);
    const restored = await screen.findByText('Beta Site');
    expect(findScrollContainer(restored).scrollTop).toBe(300);
  });

  it('IEL', async () => {
    const user = userEvent.setup();
    const mk = (id, name) => ({ id, name, company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Warehouse', panels: [{ id: 'estops', name: 'estops', circuits: ['item-1'], machineNames: { 'item-1': 'E-Stop 1' } }] }] });
    localStorage.setItem('iel-projects-v2', JSON.stringify([mk('s1', 'Alpha Site'), mk('s2', 'Beta Site')]));
    render(<AppRoot />);
    await user.click(await screen.findByText('IEL TESTING'));
    const site2 = await screen.findByText('Beta Site');
    scrollTo(findScrollContainer(site2), 300);
    await user.click(await screen.findByText('Alpha Site'));
    await screen.findByPlaceholderText('Enter name to begin audit…');
    await user.click(screen.getAllByText('Back')[0]);
    const restored = await screen.findByText('Beta Site');
    expect(findScrollContainer(restored).scrollTop).toBe(300);
  });

  it('TAT', async () => {
    const user = userEvent.setup();
    const mk = (id, name) => ({ id, name, company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Workshop', items: ['item-1'], itemNames: { 'item-1': 'Tool 1' } }] });
    localStorage.setItem('tat-projects-v1', JSON.stringify([mk('s1', 'Alpha Site'), mk('s2', 'Beta Site')]));
    render(<AppRoot />);
    await user.click(await screen.findByText('TEST & TAG'));
    const site2 = await screen.findByText('Beta Site');
    scrollTo(findScrollContainer(site2), 300);
    await user.click(await screen.findByText('Alpha Site'));
    await screen.findByPlaceholderText('Enter name to begin audit…');
    await user.click(screen.getAllByText('Back')[0]);
    const restored = await screen.findByText('Beta Site');
    expect(findScrollContainer(restored).scrollTop).toBe(300);
  });

  it('Thermo', async () => {
    const user = userEvent.setup();
    const mk = (id, name) => ({ id, name, company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Substation', boards: [{ id: 'b1', name: 'MSB1', circuits: ['c-1'], circuitNames: { 'c-1': 'Circuit 1' } }] }] });
    localStorage.setItem('thermo-projects-v1', JSON.stringify([mk('s1', 'Alpha Site'), mk('s2', 'Beta Site')]));
    render(<AppRoot />);
    await user.click(await screen.findByText('THERMOGRAPHIC'));
    const site2 = await screen.findByText('Beta Site');
    scrollTo(findScrollContainer(site2), 300);
    await user.click(await screen.findByText('Alpha Site'));
    await screen.findByPlaceholderText('Enter name to begin audit…');
    await user.click(screen.getAllByText('Back')[0]);
    const restored = await screen.findByText('Beta Site');
    expect(findScrollContainer(restored).scrollTop).toBe(300);
  });

  it('SWB', async () => {
    const user = userEvent.setup();
    const mk = (id, name) => ({ id, name, company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Main Building', boards: [{ id: 'b1', name: 'MSB1' }] }] });
    localStorage.setItem('swb-projects-v1', JSON.stringify([mk('s1', 'Alpha Site'), mk('s2', 'Beta Site')]));
    render(<AppRoot />);
    await user.click(await screen.findByText('SWITCHBOARD'));
    const site2 = await screen.findByText('Beta Site');
    scrollTo(findScrollContainer(site2), 300);
    await user.click(await screen.findByText('Alpha Site'));
    await screen.findByPlaceholderText('Enter name to begin audit…');
    await user.click(screen.getAllByText('Back')[0]);
    const restored = await screen.findByText('Beta Site');
    expect(findScrollContainer(restored).scrollTop).toBe(300);
  });

  it('IRT', async () => {
    const user = userEvent.setup();
    const mk = (id, name) => ({ id, name, company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant Room', panels: [{ id: 'p1', name: 'DB1', items: ['item-1'], itemNames: { 'item-1': 'Motor 1' } }] }] });
    localStorage.setItem('irt-projects-v1', JSON.stringify([mk('s1', 'Alpha Site'), mk('s2', 'Beta Site')]));
    render(<AppRoot />);
    await user.click(await screen.findByText('INSULATION RESISTANCE TESTING'));
    const site2 = await screen.findByText('Beta Site');
    scrollTo(findScrollContainer(site2), 300);
    await user.click(await screen.findByText('Alpha Site'));
    await screen.findByPlaceholderText('Enter name to begin audit…');
    await user.click(screen.getAllByText('Back')[0]);
    const restored = await screen.findByText('Beta Site');
    expect(findScrollContainer(restored).scrollTop).toBe(300);
  });

  it('ELT', async () => {
    const user = userEvent.setup();
    const mk = (id, name) => ({ id, name, company: '', abn: '', licence: '', areas: [{ id: 'ar', name, assets: [{ id: 'x1', assetLocation: 'SE Door', assetId: '', type: 'Emergency Exit Sign', maintained: 'Maintained', fitting: '' }] }] });
    localStorage.setItem('elt-projects-v2', JSON.stringify([mk('s1', 'Alpha Site'), mk('s2', 'Beta Site')]));
    localStorage.setItem('elt-meta-v1', JSON.stringify({ s1: { auditor: 'J', testDate: '2026-09-21' }, s2: { auditor: 'J', testDate: '2026-09-21' } }));
    render(<AppRoot />);
    await user.click(await screen.findByText('EMERGENCY LIGHTING'));
    const site2 = await screen.findByText('Beta Site', { selector: 'div' });
    scrollTo(findScrollContainer(site2), 300);
    await user.click(await screen.findByText('Alpha Site', { selector: 'div' }));
    await screen.findByRole('button', { name: /^Audit$/ });
    await user.click(screen.getAllByText('Back')[0]);
    const restored = await screen.findByText('Beta Site', { selector: 'div' });
    expect(findScrollContainer(restored).scrollTop).toBe(300);
  });

  it('Welder', async () => {
    const user = userEvent.setup();
    const mk = (id, name) => ({ id, name, company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Shop', assets: [{ id: 'x1', assetId: 'W001', brand: 'B', model: 'M', serial: '1' }] }] });
    localStorage.setItem('welder-projects-v2', JSON.stringify([mk('s1', 'Alpha Site'), mk('s2', 'Beta Site')]));
    localStorage.setItem('welder-meta-v1', JSON.stringify({ s1: { auditor: 'J', testDate: '2026-09-21' }, s2: { auditor: 'J', testDate: '2026-09-21' } }));
    render(<AppRoot />);
    await user.click(await screen.findByText('WELDER TESTING'));
    const site2 = await screen.findByText('Beta Site', { selector: 'div' });
    scrollTo(findScrollContainer(site2), 300);
    await user.click(await screen.findByText('Alpha Site', { selector: 'div' }));
    await screen.findByRole('button', { name: /^Audit$/ });
    await user.click(screen.getAllByText('Back')[0]);
    const restored = await screen.findByText('Beta Site', { selector: 'div' });
    expect(findScrollContainer(restored).scrollTop).toBe(300);
  });

  it('GSD', async () => {
    const user = userEvent.setup();
    const mk = (id, name) => ({ id, name, company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'One' }] });
    localStorage.setItem('gsd-projects-v1', JSON.stringify([mk('s1', 'Alpha Site'), mk('s2', 'Beta Site')]));
    localStorage.setItem('gsd-meta-v1', JSON.stringify({ s1: { auditor: 'J', testDate: '2026-09-21' }, s2: { auditor: 'J', testDate: '2026-09-21' } }));
    render(<AppRoot />);
    await user.click(await screen.findByText('GENERAL SITE DEFECTS'));
    const site2 = await screen.findByText('Beta Site', { selector: 'div' });
    scrollTo(findScrollContainer(site2), 300);
    await user.click(await screen.findByText('Alpha Site', { selector: 'div' }));
    await screen.findByRole('button', { name: /^Audit$/ });
    await user.click(screen.getAllByText('Back')[0]);
    const restored = await screen.findByText('Beta Site', { selector: 'div' });
    expect(findScrollContainer(restored).scrollTop).toBe(300);
  });
});

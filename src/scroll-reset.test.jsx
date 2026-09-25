// Regression coverage for the "item detail opens scrolled to the bottom"
// bug: every module renders its item list and item-detail view as siblings
// inside one persistent scrollable container, so a leftover scrollTop from
// the list carried into the (much shorter) detail view. The fix resets
// scrollTop to 0 when a new item is opened. These tests drive the real app
// through AppRoot (the only export) exactly as a user would, pre-seeding
// localStorage to skip the tedious "create a site" UI.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

// Finds the nearest ancestor styled as the module's scrollable content
// container (every module sets overflowY:"auto" on it, whether it's a
// <main> or a plain <div>).
function findScrollContainer(el) {
  let node = el;
  while (node && node !== document.body) {
    if (node.style && node.style.overflowY === 'auto') return node;
    node = node.parentElement;
  }
  throw new Error('No scrollable container found above ' + el.outerHTML.slice(0, 80));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('scroll resets to top when opening an item (regression for scroll-to-bottom bug)', () => {
  it('RCD: opening a circuit resets the shared scroll container', async () => {
    const user = userEvent.setup();
    const project = {
      id: 'site-1', name: 'Test Site', company: '', abn: '', licence: '',
      areas: [{
        id: 'area-1', name: 'Area 1',
        panels: [{ id: 'panel-1', name: 'MSB1', circuits: ['CB1', 'CB2', 'CB3'] }],
      }],
    };
    localStorage.setItem('rcd-projects-v6', JSON.stringify([project]));

    render(<AppRoot />);
    await user.click(await screen.findByText('RCD TESTING'));
    await user.click(await screen.findByText('Test Site'));
    await user.type(await screen.findByPlaceholderText('Enter name to begin audit…'), 'Jordan');
    await user.click(await screen.findByText('Push Test'));

    await user.click(await screen.findByText('Area 1'));
    await user.click(await screen.findByText('MSB1'));

    const lastCircuit = await screen.findByText('CB3');
    const container = findScrollContainer(lastCircuit);
    container.scrollTop = 500; // simulate having scrolled down the list

    // In push mode, tapping the circuit card cycles its status — the small
    // "note" button (one per circuit) is what opens the detail view.
    const noteButtons = await screen.findAllByText('note');
    await user.click(noteButtons[noteButtons.length - 1]);

    await waitFor(() => expect(screen.queryByText('Set all:')).not.toBeInTheDocument()); // left the list
    expect(container.scrollTop).toBe(0);
  });

  it('IEL: opening an item resets the shared scroll container (already had a partial fix — this covers the open side)', async () => {
    const user = userEvent.setup();
    const project = {
      id: 'site-1', name: 'IEL Site', company: '', abn: '', licence: '',
      areas: [{
        id: 'area-1', name: 'Warehouse',
        panels: [{
          id: 'panel-estops', name: 'estops',
          circuits: ['item-1', 'item-2', 'item-3'],
          machineNames: { 'item-1': 'E-Stop 1', 'item-2': 'E-Stop 2', 'item-3': 'E-Stop 3' },
        }],
      }],
    };
    localStorage.setItem('iel-projects-v2', JSON.stringify([project]));

    render(<AppRoot />);
    await user.click(await screen.findByText('IEL TESTING'));
    await user.click(await screen.findByText('IEL Site'));
    await user.type(await screen.findByPlaceholderText('Enter name to begin audit…'), 'Jordan');
    await user.click(await screen.findByText('E-Stops'));
    await user.click(await screen.findByText('Warehouse'));
    await user.click(await screen.findByText(/E-Stops/)); // category summary card

    const lastItem = await screen.findByText('E-Stop 3');
    const container = findScrollContainer(lastItem);
    container.scrollTop = 500;

    await user.click(lastItem);

    await waitFor(() => expect(screen.queryByText('Tap any item to open the test form')).not.toBeInTheDocument());
    expect(container.scrollTop).toBe(0);
  });

  it('TAT: opening an item resets the shared scroll container', async () => {
    const user = userEvent.setup();
    const project = {
      id: 'site-1', name: 'TAT Site', company: '', abn: '', licence: '',
      areas: [{
        id: 'area-1', name: 'Workshop',
        items: ['item-1', 'item-2', 'item-3'],
        itemNames: { 'item-1': 'Tool 1', 'item-2': 'Tool 2', 'item-3': 'Tool 3' },
      }],
    };
    localStorage.setItem('tat-projects-v1', JSON.stringify([project]));

    render(<AppRoot />);
    await user.click(await screen.findByText('TEST & TAG'));
    await user.click(await screen.findByText('TAT Site'));
    await user.type(await screen.findByPlaceholderText('Enter name to begin audit…'), 'Jordan');
    await user.click(await screen.findByText(/Start \/ Continue Audit/));
    await user.click(await screen.findByText('Workshop'));

    const lastItem = await screen.findByText('Tool 3');
    const container = findScrollContainer(lastItem);
    container.scrollTop = 500;

    await user.click(lastItem);

    await waitFor(() => expect(screen.queryByText('Tap any item to open the test form')).not.toBeInTheDocument());
    expect(container.scrollTop).toBe(0);
  });

  it('Thermo: opening a circuit resets the shared scroll container', async () => {
    const user = userEvent.setup();
    const project = {
      id: 'site-1', name: 'Thermo Site', company: '', abn: '', licence: '',
      areas: [{
        id: 'area-1', name: 'Substation',
        boards: [{
          id: 'board-1', name: 'MSB1',
          circuits: ['c-1', 'c-2', 'c-3'],
          circuitNames: { 'c-1': 'Circuit 1', 'c-2': 'Circuit 2', 'c-3': 'Circuit 3' },
        }],
      }],
    };
    localStorage.setItem('thermo-projects-v1', JSON.stringify([project]));

    render(<AppRoot />);
    await user.click(await screen.findByText('THERMOGRAPHIC'));
    await user.click(await screen.findByText('Thermo Site'));
    await user.type(await screen.findByPlaceholderText('Enter name to begin audit…'), 'Jordan');
    await user.click(await screen.findByText(/Start \/ Continue Audit/));
    await user.click(await screen.findByText('Substation'));
    await user.click(await screen.findByText('MSB1'));

    const lastCircuit = await screen.findByText('Circuit 3');
    const container = findScrollContainer(lastCircuit);
    container.scrollTop = 500;

    await user.click(lastCircuit);

    await screen.findByText(/ADD PHOTO/);
    expect(container.scrollTop).toBe(0);
  });

  it('SWB: opening a checklist item resets the shared scroll container', async () => {
    const user = userEvent.setup();
    const project = {
      id: 'site-1', name: 'SWB Site', company: '', abn: '', licence: '',
      areas: [{
        id: 'area-1', name: 'Main Building',
        boards: [{ id: 'board-1', name: 'MSB1' }],
      }],
    };
    localStorage.setItem('swb-projects-v1', JSON.stringify([project]));

    render(<AppRoot />);
    await user.click(await screen.findByText('SWITCHBOARD'));
    await user.click(await screen.findByText('SWB Site'));
    await user.type(await screen.findByPlaceholderText('Enter name to begin audit…'), 'Jordan');
    await user.click(await screen.findByText(/Start \/ Continue Audit/));
    await user.click(await screen.findByText('Main Building'));
    await user.click(await screen.findByText('MSB1'));

    // "Door Earthing" is the last of the 11 fixed checklist items.
    const lastItem = await screen.findByText('Door Earthing');
    const container = findScrollContainer(lastItem);
    container.scrollTop = 500;

    await user.click(lastItem);

    await screen.findByText(/PASS CRITERIA/);
    expect(container.scrollTop).toBe(0);
  });

  it('IRT: opening an item resets the shared scroll container', async () => {
    const user = userEvent.setup();
    const project = {
      id: 'site-1', name: 'IRT Site', company: '', abn: '', licence: '',
      areas: [{
        id: 'area-1', name: 'Plant Room',
        panels: [{
          id: 'panel-1', name: 'DB1',
          items: ['item-1', 'item-2', 'item-3'],
          itemNames: { 'item-1': 'Motor 1', 'item-2': 'Motor 2', 'item-3': 'Motor 3' },
        }],
      }],
    };
    localStorage.setItem('irt-projects-v1', JSON.stringify([project]));

    render(<AppRoot />);
    await user.click(await screen.findByText('INSULATION RESISTANCE TESTING'));
    await user.click(await screen.findByText('IRT Site'));
    await user.type(await screen.findByPlaceholderText('Enter name to begin audit…'), 'Jordan');
    await user.click(await screen.findByText(/Start \/ Continue Audit/));
    await user.click(await screen.findByText('Plant Room'));
    await user.click(await screen.findByText('DB1'));

    const lastItem = await screen.findByText('Motor 3');
    const container = findScrollContainer(lastItem);
    container.scrollTop = 500;

    await user.click(lastItem);

    await screen.findByText(/DANGER/);
    expect(container.scrollTop).toBe(0);
  });

  it('ELT: opening a fitting resets the shared scroll container', async () => {
    const user = userEvent.setup();
    const project = {
      id: 'site-1', name: 'ELT Site', company: '', abn: '', licence: '',
      assets: ['Door 1', 'Door 2', 'Door 3'].map((n, i) => ({ id: 'a' + i, location: 'ELT Site', assetLocation: n, assetId: '', type: 'Emergency Exit Sign', maintained: 'Maintained', fitting: 'X' })),
    };
    localStorage.setItem('elt-projects-v1', JSON.stringify([project]));
    localStorage.setItem('elt-meta-v1', JSON.stringify({ 'site-1': { auditor: 'Jordan', testDate: '2026-09-21', nextTestDate: '2027-03-21' } }));

    render(<AppRoot />);
    await user.click(await screen.findByText('EMERGENCY LIGHTING'));
    await user.click(await screen.findByText('ELT Site', { selector: 'div' }));
    await user.click(await screen.findByRole('button', { name: /^Audit$/ }));

    const lastItem = await screen.findByText('Door 3');
    const container = findScrollContainer(lastItem);
    container.scrollTop = 500;

    await user.click(lastItem);

    await screen.findByText('Visual Inspection');
    expect(container.scrollTop).toBe(0);
  });
  it('Welder: opening a welder resets the shared scroll container', async () => {
    const user = userEvent.setup();
    const project = {
      id: 'site-1', name: 'Welder Site', company: '', abn: '', licence: '',
      assets: ['W001', 'W002', 'W003'].map((n, i) => ({ id: 'a' + i, location: 'Shop', assetId: n, brand: 'B', model: 'M', serial: '1' })),
    };
    localStorage.setItem('welder-projects-v1', JSON.stringify([project]));
    localStorage.setItem('welder-meta-v1', JSON.stringify({ 'site-1': { auditor: 'Jordan', testDate: '2026-09-21', nextTestDate: '2026-12-21' } }));

    render(<AppRoot />);
    await user.click(await screen.findByText('WELDER TESTING'));
    await user.click(await screen.findByText('Welder Site', { selector: 'div' }));
    await user.click(await screen.findByRole('button', { name: /^Audit$/ }));

    const lastItem = await screen.findByText('W003');
    const container = findScrollContainer(lastItem);
    container.scrollTop = 500;

    await user.click(lastItem);

    await screen.findByText('Welder Inspection & Audit Checklist');
    expect(container.scrollTop).toBe(0);
  });
});

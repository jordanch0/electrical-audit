// HEADER BACK CONTROLS (2026-10-05): the ONLY back control on a screen is the standard Back pill at the top left of the header, in line with the Modules pill at the top right.
// No duplicate body Back buttons, no hidden back controls (tap-outside), and a screen reached directly from the Modules screen (Test Calendar, Global Settings) has no Back at all
// — only the Modules pill. Modelled on gsd.test.jsx ("the item page has ONE Back"). FICTIONAL data.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

vi.setConfig({ testTimeout: 30000 });
afterEach(() => cleanup()); beforeEach(() => localStorage.clear());

const DATE = '2026-10-01';
const site = (areas) => [{ id: 's1', name: 'Site One', company: '', abn: '', licence: '', areas }];
const openSite = async (user, tile) => { await user.click(screen.getByText(tile, { exact: true })); await user.click(await screen.findByText('Site One', { selector: 'div' })); };
const seedRcd = () => {
  localStorage.setItem('rcd-projects-v6', JSON.stringify(site([{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'p1', name: 'MSB 1', circuits: ['CB 1', 'CB 2'] }] }])));
  localStorage.setItem('rcd-meta-v6', JSON.stringify({ s1: { auditor: 'Jane', pushDate: DATE, injectDate: DATE, notes: '' } }));
};
const openRcdItem = async user => {
  seedRcd(); render(<AppRoot />); await openSite(user, 'RCD TESTING');
  await user.click(screen.getByRole('button', { name: /^Injection Test/ }));                       // an active audit, so Audit opens the folders
  await user.click(await screen.findByText('Wash Plant')); await user.click(await screen.findByText('MSB 1')); await user.click(await screen.findByText('CB 1'));
  return await screen.findByText(/MSB 1\s*·\s*CB 1/);                                                // the item page's title
};

describe('RCD item page: no hidden back control (tap-outside is gone)', () => {
  it('clicking the empty area around an open item does NOT close it; the header Back closes it in one tap', async () => {
    const user = userEvent.setup(); const title = await openRcdItem(user);
    let wrapper = title; while (wrapper && !(wrapper.style && wrapper.style.overflowY === 'auto' && wrapper.style.padding === '16px')) wrapper = wrapper.parentElement;
    expect(wrapper).toBeTruthy();                                                                    // the item page's own full-page wrapper = the empty area around the card
    await user.click(wrapper);
    expect(screen.getByText(/MSB 1\s*·\s*CB 1/)).toBeInTheDocument();                                // still open
    await user.click(screen.getAllByText('Back')[0]);                                                // the header Back, one tap
    expect(screen.queryByText(/MSB 1\s*·\s*CB 1/)).toBeNull();
    expect(await screen.findByText('CB 2')).toBeInTheDocument();                                     // back on the circuit list
  });
});

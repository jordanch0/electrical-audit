// Back must go up exactly ONE level at every level of every drill-down module (SWB used to jump from the board list straight to the site list).
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

afterEach(() => cleanup()); beforeEach(() => localStorage.clear());
const back = user => user.click(screen.getAllByText('Back')[0]);                     // the header Back (some views also have their own in-view one)

describe('SWB Back walks up one level at a time', () => {
  it('item -> board -> board list -> AREA LIST -> Home -> site list (the board-list step used to skip straight to the site list)', async () => {
    localStorage.setItem('swb-projects-v1', JSON.stringify([{ id: 's1', name: 'Site S', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }, { id: 'a2', name: 'Yard', boards: [] }] }]));
    localStorage.setItem('swb-meta-v1', JSON.stringify({ s1: { auditor: 'Jane', testDate: '2026-09-21' } }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD')); await user.click(await screen.findByText('Site S', { selector: 'div' })); await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ }));
    await user.click(await screen.findByText('Plant')); await user.click(await screen.findByText('MSB')); await user.click(await screen.findByText('Enclosure Condition'));
    await back(user); expect(await screen.findByText('Enclosure Condition')).toBeInTheDocument();       // board checklist
    await back(user); expect(await screen.findByText('MSB')).toBeInTheDocument(); expect(screen.queryByText('Enclosure Condition')).not.toBeInTheDocument();     // board list of the area
    await back(user); expect(await screen.findByText('Yard')).toBeInTheDocument(); expect(screen.getByText('Plant')).toBeInTheDocument(); expect(screen.queryByText('MSB')).not.toBeInTheDocument();   // AREA LIST (both areas)
    await back(user); expect(await screen.findByRole('button', { name: /Start \/ Continue Audit/ })).toBeInTheDocument();                                                                        // Home
    await back(user); expect(await screen.findByRole('button', { name: /Add.+Import Site/ })).toBeInTheDocument(); expect(screen.queryAllByText('Back')).toHaveLength(0);                              // site list (no Back there)
  });
  it('Back from the board list never lands on the site list (regression guard, from the Audit bottom-tab entry too)', async () => {
    localStorage.setItem('swb-projects-v1', JSON.stringify([{ id: 's1', name: 'Site S', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] }]));
    localStorage.setItem('swb-meta-v1', JSON.stringify({ s1: { auditor: 'Jane', testDate: '2026-09-21' } }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD')); await user.click(await screen.findByText('Site S', { selector: 'div' })); await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ }));
    await user.click(await screen.findByText('Plant')); expect(await screen.findByText('MSB')).toBeInTheDocument();
    await back(user); expect(screen.queryByRole('button', { name: /Add.+Import Site/ })).not.toBeInTheDocument(); expect(await screen.findByText('Plant')).toBeInTheDocument(); expect(screen.queryByText('MSB')).not.toBeInTheDocument();
  });
});

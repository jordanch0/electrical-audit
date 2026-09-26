// Calendar event-type labels must match the home-screen module names (the home card is the source of truth). RCD and IEL map to several event types,
// so they keep their exact home name as a prefix plus a per-type suffix.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

afterEach(() => cleanup()); beforeEach(() => localStorage.clear());
const HOME = ['RCD TESTING', 'IEL TESTING', 'TEST & TAG', 'THERMOGRAPHIC', 'SWITCHBOARD', 'INSULATION RESISTANCE TESTING', 'EMERGENCY LIGHTING', 'WELDER TESTING', 'GENERAL SITE DEFECTS'];

describe('Calendar labels vs home-screen names', () => {
  it('every home card name appears on the home screen, and Calendar has an event type whose label is that name (title case), or that name + a suffix for RCD / IEL', async () => {
    const user = userEvent.setup(); render(<AppRoot />);
    HOME.forEach(n => expect(screen.getByText(n)).toBeInTheDocument());                       // the source of truth
    await user.click(screen.getByTestId('calendar-pill')); await user.click(await screen.findByText('Add Event'));
    const labels = (await screen.findAllByRole('button')).map(b => b.textContent.trim());
    const cal = l => labels.filter(x => x.toLowerCase() === l.toLowerCase() || x.toLowerCase().startsWith(l.toLowerCase() + ' · '));
    for (const n of HOME) expect(cal(n).length, n).toBeGreaterThan(0);
    expect(cal('RCD TESTING').sort()).toEqual(['RCD Testing · Injection', 'RCD Testing · Push']);
    expect(cal('IEL TESTING').sort()).toEqual(['IEL Testing · E-Stops', 'IEL Testing · Isolators', 'IEL Testing · Lanyards']);
    for (const old of ['RCD Push Test', 'RCD Injection Test', 'IEL E-Stops', 'IEL Lanyards', 'IEL Isolators', 'Thermographic Testing', 'Switchboard Audit', 'Welder Test', 'Site Defects Audit']) expect(labels, old).not.toContain(old);
    expect(labels.some(l => l.startsWith('Other'))).toBe(true);                                // "Other / Custom" is not a module and stays
  });
});

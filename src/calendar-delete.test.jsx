// Calendar event delete: the custom confirm must follow the same one-prompt-open-at-a-time rule as DeleteButton.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

const iso = days => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
const trashButtons = container => [...container.querySelectorAll('button')].filter(b => b.querySelector('polyline[points="3 6 5 6 21 6"]'));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('cal-events-v1', JSON.stringify([
    { id: 'e1', type: 'rcd_push', site: 'Site A', dueDate: iso(3), notes: '', seriesId: null },
    { id: 'e2', type: 'tat', site: 'Site B', dueDate: iso(4), notes: '', seriesId: null },
  ]));
});
afterEach(() => cleanup());

describe('Calendar delete confirm', () => {
  it('opening a second delete prompt closes the first (never two open at once)', async () => {
    const user = userEvent.setup();
    const { container } = render(<AppRoot />);
    await user.click(screen.getByText('TEST CALENDAR'));
    await waitFor(() => expect(trashButtons(container).length).toBe(2));

    await user.click(trashButtons(container)[0]);
    expect(screen.getAllByRole('button', { name: 'Keep' })).toHaveLength(1);

    const trashes = trashButtons(container); // the open prompt's own Delete button also has a trash icon, so take the last one
    await user.click(trashes[trashes.length - 1]); // the second card's idle trash
    expect(screen.getAllByRole('button', { name: 'Keep' })).toHaveLength(1);
  });

  it('Keep cancels and nothing is deleted', async () => {
    const user = userEvent.setup();
    const { container } = render(<AppRoot />);
    await user.click(screen.getByText('TEST CALENDAR'));
    await waitFor(() => expect(trashButtons(container).length).toBe(2));
    await user.click(trashButtons(container)[0]);
    await user.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.queryByRole('button', { name: 'Keep' })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('cal-events-v1'))).toHaveLength(2);
  });

  it('lists Emergency Lighting as an event type and offers ELT sites', async () => {
    const user = userEvent.setup();
    localStorage.setItem('elt-projects-v1', JSON.stringify([{ id: 'p1', name: 'ELT Site Z', company: '', abn: '', licence: '', assets: [] }]));
    render(<AppRoot />);
    await user.click(screen.getByText('TEST CALENDAR'));
    await user.click(screen.getByRole('button', { name: /Add Event/ }));
    expect(await screen.findByText('Emergency Lighting')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'ELT Site Z' })).toBeInTheDocument();
  });
});

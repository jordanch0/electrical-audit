// Shared helpers for the item-date UI tests (one file per module). Only Date is faked; the Home date (meta) is 5 Oct and the device day is 7 Oct, so a stamp of
// "the Home date" is distinguishable from "today". The meta carries dateDay = today, so neither the backfill nor the Home-date follow touches the seeded site.
import { vi, expect } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';

export const ls = k => JSON.parse(localStorage.getItem(k));
export const day = d => `2026-10-${String(d).padStart(2, '0')}`;
export const HOME = day(5), TODAY = day(7);
export const at = (d, h = 12) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, d, h, 0, 0)); };
export const site = (areas, extra = {}) => ({ id: 's1', name: 'Site One', company: '', abn: '', licence: '', areas, ...extra });
export const setDate = (label, iso) => fireEvent.change(screen.getByLabelText(label), { target: { value: iso } });
export const homeTab = user => user.click(screen.getByRole('button', { name: /^Home$/ }));
// Home-screen Complete / Reset (each asks "Yes" / "Reset" first)
export async function completeAudit(user) { await user.click(screen.getByRole('button', { name: /^Complete/ })); await user.click(await screen.findByRole('button', { name: /^Yes/ })); }
export async function resetAudit(user) { await user.click(screen.getByRole('button', { name: /^Reset/ })); await user.click(await screen.findByRole('button', { name: /^(Reset|Yes)$/ })); }
export const stored = (key, pick) => waitFor(() => expect(pick(ls(key))).toBeTruthy());

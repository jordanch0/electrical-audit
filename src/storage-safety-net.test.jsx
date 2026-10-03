// Fix #1 (2026-09-29): a "Storage used" gauge on Global Settings, and a blocking (dismiss-until-clicked) banner on a
// failed save — replacing the old 6-second auto-dismiss toast, which could disappear before the user read it while
// their data silently wasn't saved. localStorage's ~5MB assumption is still the right one to warn against: ELT/Welder/
// SWB/GSD photos now live in IndexedDB (a separate store with its own error handling), so this `save()` only ever
// writes plain JSON (sites, results, meta, history) — but the browser's real localStorage ceiling hasn't changed.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import AppRoot, { localStorageUsageBytes, fmtBytes, STORAGE_QUOTA_ASSUMED_BYTES, save, GlobalSettingsView } from './App.jsx';

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); document.querySelectorAll('[role="alert"]').forEach(el => el.remove()); });

describe('localStorageUsageBytes / fmtBytes', () => {
  it('sums key+value lengths across every localStorage key (UTF-16, 2 bytes/unit)', () => {
    localStorage.setItem('a', '12345');       // key 1 + value 5 = 6 units
    localStorage.setItem('bb', '1234567890'); // key 2 + value 10 = 12 units
    expect(localStorageUsageBytes()).toBe((6 + 12) * 2);
  });
  it('is 0 on an empty store', () => { expect(localStorageUsageBytes()).toBe(0); });
  it('fmtBytes formats B / KB / MB', () => {
    expect(fmtBytes(500)).toBe('500 B');
    expect(fmtBytes(2048)).toBe('2 KB');
    expect(fmtBytes(3 * 1024 * 1024)).toBe('3.00 MB');
  });
  it('the assumed quota is 5MB', () => { expect(STORAGE_QUOTA_ASSUMED_BYTES).toBe(5 * 1024 * 1024); });
});

describe('Global Settings: Storage used line', () => {
  it('shows a low, neutral-coloured reading with little data', async () => {
    render(<AppRoot />);
    render(<GlobalSettingsView onGoHome={() => {}} />);
    const line = await screen.findByText(/Storage used: .* of ~5 MB \(\d+%, approximate\)/);
    expect(line.style.color).not.toBe('rgb(185, 28, 28)');
    expect(line.style.color).not.toBe('rgb(180, 83, 9)');
  });
  it('turns amber above 60% and red above 85%', async () => {
    const pad = (bytes) => 'x'.repeat(Math.ceil(bytes / 2)); // 2 bytes/char
    localStorage.setItem('k', pad(STORAGE_QUOTA_ASSUMED_BYTES * 0.7));
    const { unmount } = render(<GlobalSettingsView onGoHome={() => {}} />);
    let line = await screen.findByText(/Storage used:/);
    expect(line.style.color).toBe('rgb(180, 83, 9)'); // amber #b45309
    unmount(); cleanup();
    localStorage.clear();
    localStorage.setItem('k', pad(STORAGE_QUOTA_ASSUMED_BYTES * 0.9));
    render(<GlobalSettingsView onGoHome={() => {}} />);
    line = await screen.findByText(/Storage used:/);
    expect(line.style.color).toBe('rgb(185, 28, 28)'); // red #b91c1c (was #dc2626, 3.8:1; now >= 4.5:1)
  });
  it('label says approximate and excludes photos', async () => {
    render(<GlobalSettingsView onGoHome={() => {}} />);
    await screen.findByText(/approximate/);
    await screen.findByText(/not photos/);
  });
});

describe('save(): a failed write shows a BLOCKING banner (stays until dismissed, never a 6s auto-hide)', () => {
  it('shows the exact message and stays after 10 seconds with no interaction', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    vi.useFakeTimers();
    try {
      await save('some-key', { a: 1 });
      const banner = document.querySelector('[role="alert"]');
      expect(banner).toBeTruthy();
      expect(banner.textContent).toContain('Storage full: your latest changes were NOT saved. Export now, then free space.');
      vi.advanceTimersByTime(10000); // old behaviour auto-removed at 6s — this must NOT happen any more
      expect(document.body.contains(banner)).toBe(true);
    } finally { vi.useRealTimers(); spy.mockRestore(); }
  });
  it('a dismiss control removes it, and dismissing lets a later failure show a new one', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('fail'); });
    try {
      await save('k1', {});
      const banner = document.querySelector('[role="alert"]');
      const dismissBtn = banner.querySelector('button[aria-label="Dismiss"]');
      expect(dismissBtn).toBeTruthy();
      fireEvent.click(dismissBtn);
      expect(document.querySelectorAll('[role="alert"]').length).toBe(0);
      await save('k2', {});
      expect(document.querySelectorAll('[role="alert"]').length).toBe(1);
    } finally { spy.mockRestore(); }
  });
  it('never stacks a second banner while one is already showing', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('fail'); });
    try {
      await save('k1', {}); await save('k2', {}); await save('k3', {});
      expect(document.querySelectorAll('[role="alert"]').length).toBe(1);
    } finally { spy.mockRestore(); }
  });
  it('a successful save never shows the banner', async () => {
    await save('ok-key', { fine: true });
    expect(document.querySelectorAll('[role="alert"]').length).toBe(0);
  });
});

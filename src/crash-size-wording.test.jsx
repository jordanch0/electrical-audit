// THE ERROR SCREEN AND SETTINGS SAY A BACKUP'S SIZE IN THE SAME WORDS (release s). The error screen used to have its own one-decimal formatter, so a tiny backup read "0.0 MB" there and "under 1 MB" in Settings
// (Backup & Data). CrashScreen now calls backupMbText, the function Settings uses. FICTIONAL data; a fake engine plays the backup.
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CrashScreen, backupMbText } from './App.jsx';

const MB = 1024 * 1024;
beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const engine = size => ({ reload: vi.fn(), now: () => new Date(2026, 9, 22, 12, 0), canBackup: () => true, measure: async () => ({ estimatedBytes: 5 * MB }), build: async () => ({ blob: { size }, filename: 'SparkCheck-backup-2026-10-22.zip' }), inspect: async () => ({ ok: true }), deliver: async () => ({ ok: true }) });
async function readyText(size) { render(<CrashScreen name="Error" deps={engine(size)} />); await userEvent.setup().click(screen.getByTestId('crash-backup')); return (await screen.findByTestId('crash-backup-ready')).querySelector('b').textContent; }

describe('the error screen uses the Settings size words', () => {
  it.each([
    [0, 'Backup ready, 0 MB'], [3, 'Backup ready, under 1 MB'], [1048575, 'Backup ready, under 1 MB'], [1048576, 'Backup ready, 1.0 MB'], [5 * MB, 'Backup ready, 5.0 MB'],
    [10 * MB, 'Backup ready, 10 MB'], [104 * MB, 'Backup ready, 104 MB'],
  ])('%i bytes reads %s', async (bytes, expected) => { expect(await readyText(bytes)).toBe(expected); });
  it('for every size the error screen reads exactly what Settings reads (both go through backupMbText)', async () => {
    for (const bytes of [0, 1, 1048575, 1048576, 3 * MB, 9.99 * MB, 10 * MB, 109051904]) { cleanup(); expect(await readyText(bytes), String(bytes)).toBe('Backup ready, ' + backupMbText(bytes)); }
  });
  it('a three-byte backup never reads 0.0 MB', async () => { expect(await readyText(3)).not.toMatch(/0\.0 MB/); });
});

describe('source: the error screen has no size formatter of its own', () => {
  it('CrashScreen calls backupMbText and contains no toFixed', () => {
    const app = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8'); const from = app.indexOf('function CrashScreen('), to = app.indexOf('class AppErrorBoundary');
    expect(from).toBeGreaterThan(0); expect(to).toBeGreaterThan(from); const body = app.slice(from, to);
    expect(body).toContain('backupMbText(bk.bytes)'); expect(body).not.toMatch(/toFixed|1024 \* 1024|1048576/);
  });
});

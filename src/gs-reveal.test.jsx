// GLOBAL SETTINGS: A MESSAGE THAT OPENS IS SCROLLED INTO VIEW (release m, part c). FICTIONAL data.
// jsdom has no layout and no Element.prototype.scrollIntoView, so (as src/backup-section.test.jsx and src/gsd.test.jsx already do) scrollIntoView is a spy, and the positions are STUBBED:
// the scrolling column is 0..700 px, the floating pill starts at 630, a message sits wherever the test says. The visible band is therefore 12..614 (12 px at the top, the pill minus the 16 px gap at the bottom).
import 'fake-indexeddb/auto';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, configure, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobalSettingsView, BackupRestoreSection, backupDeliver, backupRestore, backupUndo, backupUndoInfo, backupLastBackupText, RESTORE_KEY } from './App.jsx';
import { wipe, seedSourceFull } from './test/backup-fixtures.js';

vi.setConfig({ testTimeout: 30000 });
configure({ asyncUtilTimeout: 10000 });
const NOW = new Date(2026, 9, 9, 12, 0);
const S = { getItem: k => localStorage.getItem(k), setItem: (k, v) => rawSetItem(k, v), removeItem: k => localStorage.removeItem(k), key: i => localStorage.key(i), get length() { return localStorage.length; } };
const deps = (over = {}) => ({ reload: vi.fn(), now: () => NOW, restore: (f, o) => backupRestore(f, { ...o, storage: S, now: NOW }), undo: () => backupUndo({ storage: S, now: NOW }), undoInfo: () => backupUndoInfo(S, NOW), lastText: () => backupLastBackupText(S, NOW), ...over });
const T = id => screen.getByTestId(id);
const frames = async (n = 4) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise(r => requestAnimationFrame(() => r())); }); };

let calls, rects, origRect, origClient, origScroll, origMedia;
const rectOf = (top, bottom) => ({ top, bottom, left: 0, right: 300, width: 300, height: bottom - top, x: 0, y: top, toJSON() {} });
beforeEach(async () => {
  await wipe(); localStorage.clear(); calls = []; rects = {};
  origRect = Element.prototype.getBoundingClientRect; origClient = Element.prototype.getClientRects; origScroll = Element.prototype.scrollIntoView; origMedia = window.matchMedia;
  Element.prototype.scrollIntoView = function (o) { calls.push([this.getAttribute('data-testid'), o]); };
  Element.prototype.getClientRects = function () { return [{}]; };
  Element.prototype.getBoundingClientRect = function () { if (this.hasAttribute('data-gs-scroll')) return rectOf(0, 700); if (this.tagName === 'NAV') return rectOf(630, 682); const id = this.getAttribute('data-testid'); return rects[id] ? rectOf(...rects[id]) : rectOf(0, 0); };
  window.matchMedia = undefined;
});
afterEach(() => { cleanup(); Element.prototype.getBoundingClientRect = origRect; Element.prototype.getClientRects = origClient; Element.prototype.scrollIntoView = origScroll; window.matchMedia = origMedia; vi.restoreAllMocks(); });
const mountData = (d = deps()) => { const user = userEvent.setup(); render(<GlobalSettingsView onGoHome={() => {}} initialTab="data" backupDeps={d} />); return user; };

describe('a message that opens is scrolled into view when it is hidden', () => {
  it('the Delete question opens under the pill: the page scrolls to it (just far enough: block "nearest", smooth)', async () => {
    const user = mountData(); rects['erase-confirm'] = [560, 690]; await user.click(T('erase-open')); await frames();
    expect(calls.length).toBe(1); expect(calls[0][0]).toBe('erase-confirm'); expect(calls[0][1]).toEqual({ block: 'nearest', behavior: 'smooth' });
  });
  it('a message hidden ABOVE the visible part is brought down (block "nearest" on its top)', async () => {
    const user = mountData(); rects['erase-confirm'] = [-80, 40]; await user.click(T('erase-open')); await frames();
    expect(calls.length).toBe(1); expect(calls[0][1]).toEqual({ block: 'nearest', behavior: 'smooth' });
  });
  it('a message taller than the room starts at its own top (its words are read first)', async () => {
    const user = mountData(); rects['erase-confirm'] = [300, 1000]; await user.click(T('erase-open')); await frames();
    expect(calls.length).toBe(1); expect(calls[0][1]).toEqual({ block: 'start', behavior: 'smooth' });
  });
  it('the pill counts: a message that ends at 620 (inside the column, but under the pill) is NOT visible', async () => {
    const user = mountData(); rects['erase-confirm'] = [480, 620]; await user.click(T('erase-open')); await frames();
    expect(calls.length).toBe(1);
  });
  it('the messages keep the shared clearance: scroll-margin-bottom is NAV_CLEARANCE and the top gap is 12 px (read from the source, as safe-area-layout.test.jsx does: jsdom drops env())', () => {
    const src = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8'); expect(src).toContain('const GS_MSG_MARGIN = { scrollMarginTop: 12, scrollMarginBottom: NAV_CLEARANCE };');
    for (const h of ['const bsCard', 'const bsBusyRow', 'const bsTwoStep']) { const at = src.indexOf(h); expect(src.slice(at, at + 900), h).toContain('...GS_MSG_MARGIN'); }
  });
});

describe('and only then', () => {
  it('a message that opens fully inside the visible part causes no scroll', async () => {
    const user = mountData(); rects['erase-confirm'] = [100, 300]; await user.click(T('erase-open')); await frames(); expect(calls).toEqual([]);
  });
  it('nothing scrolls on the first render, even for a message that is already there and hidden (a recorded restore problem)', async () => {
    rawSetItem(RESTORE_KEY, JSON.stringify({ v: 1, journal: null, undo: null, problem: { keys: ['rcd-projects-v6'], at: 'x' } })); rects['backup-problem'] = [560, 690];
    mountData(); await screen.findByTestId('backup-problem'); await frames(); expect(calls).toEqual([]);
  });
  it('nothing scrolls when a tab opens (Business -> Backup & Data) while a hidden message is already there', async () => {
    rawSetItem(RESTORE_KEY, JSON.stringify({ v: 1, journal: null, undo: null, problem: { keys: ['rcd-projects-v6'], at: 'x' } })); rects['backup-problem'] = [560, 690];
    const user = userEvent.setup(); render(<GlobalSettingsView onGoHome={() => {}} initialTab="company" backupDeps={deps()} />); await frames();
    await user.click(screen.getByRole('tab', { name: /Backup & Data/ })); await frames(); expect(calls).toEqual([]);
  });
  it('closing a message does not scroll back or scroll to anything else; opening it again scrolls again', async () => {
    rawSetItem(RESTORE_KEY, JSON.stringify({ v: 1, journal: null, undo: null, problem: { keys: ['rcd-projects-v6'], at: 'x' } })); rects['backup-problem'] = [560, 690]; rects['erase-confirm'] = [560, 690];
    const user = mountData(); await user.click(T('erase-open')); await frames(); expect(calls.length).toBe(1);
    await user.click(T('erase-confirm-no')); await frames(); expect(calls.length).toBe(1);                      // closed: nothing scrolls (the hidden problem card was already there, so it is not new)
    await user.click(T('erase-open')); await frames(); expect(calls.length).toBe(2);
  });
  it('a re-render that changes nothing about the messages does not scroll (ticking "Include photos")', async () => {
    const user = mountData(); rects['erase-confirm'] = [560, 690]; await user.click(T('erase-open')); await frames(); const n = calls.length;
    await user.click(screen.getByLabelText(/Include photos/).closest('label') || screen.getByLabelText(/Include photos/)); await frames(); expect(calls.length).toBe(n);
  });
});

describe('reduced motion, sequences and the other tab', () => {
  it('with "reduce motion" on the scroll is instant ("auto"), not smooth', async () => {
    window.matchMedia = q => ({ matches: /prefers-reduced-motion: reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {} });
    const user = mountData(); rects['erase-confirm'] = [560, 690]; await user.click(T('erase-open')); await frames(); expect(calls[0][1]).toEqual({ block: 'nearest', behavior: 'auto' });
  });
  it('messages in sequence: Make backup -> the ready card, Share backup -> the "Backup shared" card: each new one is revealed when hidden', async () => {
    await seedSourceFull(); const dl = { doc: { createElement: () => ({ click() {} }), body: { appendChild() {}, removeChild() {} } }, urlApi: { createObjectURL: () => 'blob:x', revokeObjectURL() {} } };
    const user = mountData(deps({ deliver: (b, f, o) => backupDeliver(b, f, { ...o, nav: { canShare: () => true, share: async () => {} }, doc: dl.doc, urlApi: dl.urlApi }) }));
    rects['backup-card-ready'] = [560, 690]; rects['backup-note-ok'] = [560, 690];
    await user.click(T('backup-make')); await screen.findByTestId('backup-card-ready'); await frames(); expect(calls.filter(c => c[0] === 'backup-card-ready').length).toBe(1);
    await user.click(T('backup-share')); await screen.findByTestId('backup-note-ok'); await frames(); expect(calls.filter(c => c[0] === 'backup-note-ok').length).toBe(1);
  });
  it('a progress row that only changes its text ("photos 3 of 6" -> "photos 4 of 6") never scrolls again', async () => {
    const file = await (await import('./test/backup-fixtures.js')).backupOf(seedSourceFull); let tick; let finish;
    const d = deps({ restore: (f, o) => { o.onProgress({ phase: 'photos', done: 3, total: 6 }); tick = () => o.onProgress({ phase: 'photos', done: 4, total: 6 }); return new Promise(r => { finish = async () => r(await backupRestore(f, { ...o, storage: S, now: NOW })); }); } });
    const user = mountData(d); await user.upload(T('backup-file-input'), new File([file], 'b.zip', { type: 'application/zip' })); await screen.findByTestId('backup-summary'); await user.click(T('backup-restore'));
    await user.click(T('backup-restore-confirm-yes')); await screen.findByText('Restoring… photos 3 of 6.'); await frames(); const n = calls.length;
    await act(async () => { tick(); }); await screen.findByText('Restoring… photos 4 of 6.'); await frames(); expect(calls.length).toBe(n);
    await act(async () => { await finish(); }); await screen.findByTestId('backup-result-ok');
  });
  it('a message that opens in a pane that is not showing (display:none) is never scrolled to', async () => {
    Element.prototype.getClientRects = function () { return this.closest('[data-hidden-pane]') ? [] : [{}]; };       // no boxes for anything inside the hidden pane, as in a real browser
    const gate = { current: { busy: false, reloadPending: false, reveal: null, reload: null } };
    render(<div data-gs-scroll="true"><div data-hidden-pane="true" style={{ display: 'none' }}><BackupRestoreSection gate={gate} deps={deps()} /></div><nav /></div>);
    rects['erase-confirm'] = [560, 690]; await act(async () => { T('erase-open').click(); }); await screen.findByTestId('erase-confirm'); await frames(); expect(calls).toEqual([]);
  });
});

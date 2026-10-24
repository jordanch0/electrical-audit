// THE EXCEL HAND-OVER (release t). FICTIONAL names. On a phone or tablet (touch is the primary input) a snapshot export is built, HELD in memory, and the person taps Share file: the system share sheet gets the file ONLY
// (no title, text or url). A closed sheet is a note, not a failure (and logs nothing); a refused sheet falls back to ONE download and says so; a real failure is still the failure card. A template shares in the SAME tick as
// the tap. A desktop (and anything with the native bridge) keeps today's one-tap download. exportShareWanted is the one capability test and takes the browser objects as arguments, so every kind of computer is faked here.
// The done step (the photo-migration proof) runs only when the file really left the app. Timer rule (release r): any test that fakes timers resets first and keeps Date faked at CLOCK_AT when it is set.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { runExport, exportShareWanted, ExportBtn, ExportFailureCard } from './App.jsx';
import { phoneOn, phoneOff, downloadsOn, abortError, named, SAMPLE_B64 } from './test/share-env.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const fakeTimers = toFake => { vi.useRealTimers(); vi.useFakeTimers({ toFake: [...toFake, ...(process.env.CLOCK_AT ? ['Date'] : [])] }); if (process.env.CLOCK_AT) vi.setSystemTime(new Date(process.env.CLOCK_AT)); };
let warn, n = 0;
const scope = (p = 'iel') => p + ':snap:ZQ' + (++n);
beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); phoneOff(); });
const exportLogs = () => warn.mock.calls.filter(a => a[0] === '[SparkCheck export]').map(a => a.slice(1));

const STYLE = { padding: '5px 10px', background: 'transparent', border: '1px solid #d4d4d8', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#14532d' };
const Harness = ({ scope: sc, fn, template, label = 'Export', id = 'h' }) => <div data-testid={id}><ExportBtn scope={sc} template={template} style={STYLE} run={() => runExport(sc, fn)}>{label}</ExportBtn><ExportFailureCard scope={sc} /></div>;
const file = (name = 'IEL_Example_Quarry_2026-10-20.xlsx', done) => h => { h(SAMPLE_B64, name, done); };
const pause = ms => new Promise(r => setTimeout(r, ms));
const never = () => new Promise(() => {});

describe('exportShareWanted: the share path is for phones and tablets only (the desktop condition)', () => {
  const nav = (o = {}) => ({ share: async () => {}, canShare: () => true, maxTouchPoints: 0, ...o });
  const mm = coarse => q => ({ matches: q === '(pointer: coarse)' ? coarse : false });
  const CASES = [
    ['this PC (Windows: 0 touch points, fine pointer)', nav({ platform: 'Win32' }), mm(false), false],
    ['a Mac', nav({ platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }), mm(false), false],
    ['a Windows touch laptop with a mouse (5 touch points, fine pointer)', nav({ maxTouchPoints: 5, platform: 'Win32' }), mm(false), false],
    ['a coarse pointer with 0 touch points', nav(), mm(true), false],
    ['an iPhone', nav({ maxTouchPoints: 5, platform: 'iPhone' }), mm(true), true],
    ['an iPad', nav({ maxTouchPoints: 5, platform: 'iPad' }), mm(true), true],
    ['an iPad that reports as a Mac (MacIntel, a Macintosh user agent, 5 touch points, coarse)', nav({ maxTouchPoints: 5, platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }), mm(true), true],
    ['an Android phone', nav({ maxTouchPoints: 5, platform: 'Linux armv81', userAgentData: { mobile: true } }), mm(true), true],
    ['a phone with no navigator.share', nav({ maxTouchPoints: 5, share: undefined }), mm(true), false],
    ['a phone with no navigator.canShare', nav({ maxTouchPoints: 5, canShare: undefined }), mm(true), false],
    ['a phone where canShare says false for an xlsx file', nav({ maxTouchPoints: 5, canShare: () => false }), mm(true), false],
    ['a phone where canShare throws', nav({ maxTouchPoints: 5, canShare: () => { throw new TypeError('x'); } }), mm(true), false],
    ['a phone with no matchMedia', nav({ maxTouchPoints: 5 }), null, false],
    ['a phone where matchMedia throws', nav({ maxTouchPoints: 5 }), () => { throw new Error('x'); }, false],
  ];
  it.each(CASES)('%s: %s', (_n, navigatorLike, matchMedia, expected) => { expect(exportShareWanted(navigatorLike, matchMedia, false)).toBe(expected); });
  it('the native bridge always wins: a phone with the bridge present does not take the share path', () => { expect(exportShareWanted(nav({ maxTouchPoints: 5 }), mm(true), true)).toBe(false); });
  it('the probe asks canShare about an EMPTY xlsx file named x.xlsx and nothing else', () => {
    const canShare = vi.fn(() => true); exportShareWanted(nav({ maxTouchPoints: 5, canShare }), mm(true), false);
    expect(canShare).toHaveBeenCalledTimes(1); const arg = canShare.mock.calls[0][0]; expect(Object.keys(arg)).toEqual(['files']); expect(arg.files).toHaveLength(1);
    expect(arg.files[0].name).toBe('x.xlsx'); expect(arg.files[0].type).toBe(XLSX_MIME); expect(arg.files[0].size).toBe(0);
  });
  it('with no arguments it reads this window: false on a computer with no share sheet, true once the window is a phone', () => {
    expect(exportShareWanted()).toBe(false); phoneOn(); expect(exportShareWanted()).toBe(true); phoneOn({ touch: 0 }); expect(exportShareWanted()).toBe(false); phoneOn({ coarse: false }); expect(exportShareWanted()).toBe(false);
  });
});

describe('a snapshot export on a phone: built, held, then Share file', () => {
  it('Export holds the file and shows the ready card; nothing is shared or downloaded yet; Share file gives the share sheet the file ONLY, with the release p name and the xlsx type', async () => {
    const share = phoneOn(); const d = downloadsOn(); const done = vi.fn(); const user = userEvent.setup(); const NAME = 'IEL_Ross_&_Sons_(East)_2026-10-20.xlsx';
    render(<Harness scope={scope()} fn={file(NAME, done)} />);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    const card = await screen.findByTestId('export-ready');
    // release t, design D2: ONE compact card: the title, the name shortened in the middle (aria-hidden) and in full for a screen reader, one short line, then the two buttons inside the card
    expect(card.textContent).toBe('Excel file ready' + 'IEL_Ross_&_Sons_…026-10-20.xlsx' + NAME + 'Not saved yet. Tap Share file.' + 'Share file' + 'Discard this file'); expect(card.getAttribute('role')).toBe('status');
    expect(screen.getByTestId('export-share').closest('[data-testid="export-ready"]')).toBe(card); expect(screen.getByTestId('export-discard').closest('[data-testid="export-ready"]')).toBe(card);
    expect(share).not.toHaveBeenCalled(); expect(d.created).toEqual([]); expect(done).not.toHaveBeenCalled(); expect(screen.queryByTestId('export-failed')).toBeNull();
    await user.click(screen.getByTestId('export-share')); const shared = await screen.findByTestId('export-shared');
    expect(shared.textContent).toBe('Excel file sharedIf you chose Save to Files, it is in the folder you picked.');
    expect(share).toHaveBeenCalledTimes(1); const arg = share.mock.calls[0][0]; expect(Object.keys(arg)).toEqual(['files']); expect(arg.files).toHaveLength(1);
    expect(arg.files[0].name).toBe(NAME); expect(arg.files[0].type).toBe(XLSX_MIME); expect(arg.files[0].size).toBe(3);
    expect(done).toHaveBeenCalledTimes(1); expect(d.created).toEqual([]); expect(screen.queryByTestId('export-ready')).toBeNull(); expect(screen.getByRole('button', { name: 'Export' }).getAttribute('aria-busy')).toBeNull(); expect(exportLogs()).toEqual([]);
  });
  it('Share file and Discard this file are 44 px high and sit side by side (Share file takes the room, Discard its own width)', async () => {
    phoneOn(); render(<Harness scope={scope()} fn={file()} />); await userEvent.setup().click(screen.getByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready');
    const s = screen.getByTestId('export-share'), x = screen.getByTestId('export-discard'); expect(s.style.minHeight).toBe('44px'); expect(x.style.minHeight).toBe('44px'); expect(s.style.width).toBe(''); expect(s.style.flex).toBe('1 1 0%'); expect(x.style.width).toBe('auto'); expect(s.parentElement).toBe(x.parentElement); expect(s.textContent).toBe('Share file'); expect(x.textContent).toBe('Discard this file');
  });
  it('the share sheet is opened INSIDE the Share file tap, as its first action (no wait before it)', async () => {
    const share = phoneOn(); render(<Harness scope={scope()} fn={file()} />); await userEvent.setup().click(screen.getByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready');
    fireEvent.click(screen.getByTestId('export-share')); expect(share).toHaveBeenCalledTimes(1);                       // checked synchronously, before any await
  });
  it('a double tap on Share file opens the sheet once; while it is open the button is aria-busy and aria-disabled (not disabled); when it resolves the card says shared', async () => {
    let resolve; const share = phoneOn({ share: vi.fn(() => new Promise(r => { resolve = r; })) }); render(<Harness scope={scope()} fn={file()} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready');
    const b = screen.getByTestId('export-share'); fireEvent.click(b); fireEvent.click(b); fireEvent.click(b); expect(share).toHaveBeenCalledTimes(1);
    const open = screen.getByTestId('export-share'); expect(open.getAttribute('aria-busy')).toBe('true'); expect(open.getAttribute('aria-disabled')).toBe('true'); expect(open.disabled).toBe(false);
    await act(async () => { resolve(); }); expect(await screen.findByTestId('export-shared')).toBeTruthy(); expect(share).toHaveBeenCalledTimes(1);
  });
  it('a closed sheet (AbortError) is a note, not a failure: the file is kept, nothing is logged, nothing is downloaded, done does not run; Share file works again', async () => {
    const share = phoneOn({ share: vi.fn().mockRejectedValueOnce(abortError()).mockResolvedValue(undefined) }); const d = downloadsOn(); const done = vi.fn(); const user = userEvent.setup(); const sc = scope();
    render(<Harness scope={sc} fn={file('IEL_Cancel_2026-10-20.xlsx', done)} />); await user.click(screen.getByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready');
    await user.click(screen.getByTestId('export-share')); await act(async () => {});
    const card = screen.getByTestId('export-ready'); expect(card.textContent).toBe('The share sheet was closed, so the file was not saved.' + 'IEL_Cancel_2026-10-20.xlsx' + 'IEL_Cancel_2026-10-20.xlsx' + 'Still ready. Tap Share file to try again.' + 'Share file' + 'Discard this file');
    expect(screen.queryByTestId('export-failed')).toBeNull(); expect(warn).not.toHaveBeenCalled(); expect(d.created).toEqual([]); expect(done).not.toHaveBeenCalled(); expect(screen.getByTestId('export-share').getAttribute('aria-busy')).toBeNull();
    await user.click(screen.getByTestId('export-share')); expect(await screen.findByTestId('export-shared')).toBeTruthy(); expect(share).toHaveBeenCalledTimes(2); expect(done).toHaveBeenCalledTimes(1); expect(exportLogs()).toEqual([]);
  });
  it.each(['NotAllowedError', 'InvalidStateError', 'SecurityError'])('a refused sheet (%s) falls back to ONE download, says so, logs share-refused (code, module key, error name) and runs done once', async name => {
    const share = phoneOn({ share: vi.fn().mockRejectedValue(named(name)) }); const d = downloadsOn(); const done = vi.fn(); const user = userEvent.setup();
    render(<Harness scope={scope('tat')} fn={file('TAT_Example_2026-10-20.xlsx', done)} />); await user.click(screen.getByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready');
    await user.click(screen.getByTestId('export-share')); const card = await screen.findByTestId('export-downloaded');
    expect(card.textContent).toBe('Excel file download startedThis phone could not open the share sheet, so the file was downloaded. Find it in the Files app.TAT_Example_2026-10-20.xlsx');
    expect(d.clicks).toEqual(['TAT_Example_2026-10-20.xlsx']); expect(d.created).toHaveLength(1); expect(share).toHaveBeenCalledTimes(1); expect(done).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('export-ready')).toBeNull(); expect(screen.queryByTestId('export-failed')).toBeNull(); expect(exportLogs()).toEqual([['share-refused', 'tat', name]]);
  });
  it('any other share failure also falls back to the download and logs share-failed with the error name', async () => {
    phoneOn({ share: vi.fn().mockRejectedValue(named('TypeError')) }); const d = downloadsOn(); const done = vi.fn(); const user = userEvent.setup();
    render(<Harness scope={scope('swb')} fn={file('SWB_Example_2026-10-20.xlsx', done)} />); await user.click(screen.getByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready');
    await user.click(screen.getByTestId('export-share')); await screen.findByTestId('export-downloaded'); expect(d.clicks).toHaveLength(1); expect(done).toHaveBeenCalledTimes(1); expect(exportLogs()).toEqual([['share-failed', 'swb', 'TypeError']]);
  });
  it('a refused sheet AND a failing download: the failure card "could not be saved", no URL left unrevoked, done does not run', async () => {
    phoneOn({ share: vi.fn().mockRejectedValue(named('NotAllowedError')) }); const d = downloadsOn({ failClick: true }); const done = vi.fn(); const user = userEvent.setup();
    render(<Harness scope={scope('elt')} fn={file('ELT_Example_2026-10-20.xlsx', done)} />); await user.click(screen.getByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready');
    await user.click(screen.getByTestId('export-share')); const c = await screen.findByTestId('export-failed');
    expect(c.textContent).toBe('The Excel file could not be savedNothing on this phone was changed. Please try again.'); expect(done).not.toHaveBeenCalled(); expect(d.revoked).toEqual(['blob:zq1']);
    expect(exportLogs()).toEqual([['share-refused', 'elt', 'NotAllowedError'], ['deliver-failed', 'elt', 'ExportDeliveryError']]); expect(screen.queryByTestId('export-ready')).toBeNull();
  });
  it('Discard this file drops the held file: no share, no download, done does not run, and the next Export works', async () => {
    const share = phoneOn(); const d = downloadsOn(); const done = vi.fn(); const user = userEvent.setup(); render(<Harness scope={scope()} fn={file('IEL_Discard_2026-10-20.xlsx', done)} />);
    await user.click(screen.getByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready'); await user.click(screen.getByTestId('export-discard'));
    expect(screen.queryByTestId('export-ready')).toBeNull(); expect(screen.queryByTestId('export-share')).toBeNull(); expect(share).not.toHaveBeenCalled(); expect(d.created).toEqual([]); expect(done).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Export' })); expect(await screen.findByTestId('export-ready')).toBeTruthy();
  });
  it('a new Export drops the old ready file: only the new file is offered and shared', async () => {
    const share = phoneOn(); const user = userEvent.setup(); let k = 0; render(<Harness scope={scope()} fn={h => { k++; h(SAMPLE_B64, k === 1 ? 'IEL_First_2026-10-20.xlsx' : 'IEL_Second_2026-10-20.xlsx'); }} />);
    await user.click(screen.getByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready'); await user.click(screen.getByRole('button', { name: 'Export' }));
    const cards = await screen.findAllByTestId('export-ready'); expect(cards).toHaveLength(1); expect(cards[0].textContent).toContain('IEL_Second_2026-10-20.xlsx'); expect(cards[0].textContent).not.toContain('First');
    await user.click(screen.getByTestId('export-share')); await screen.findByTestId('export-shared'); expect(share.mock.calls[0][0].files[0].name).toBe('IEL_Second_2026-10-20.xlsx');
  });
  it('leaving the screen drops the held file; a share that resolves after the screen was left still counts as handed over (done runs) but shows no stale card on the next visit', async () => {
    let resolve; phoneOn({ share: vi.fn(() => new Promise(r => { resolve = r; })) }); const done = vi.fn(); const user = userEvent.setup(); const sc = scope();
    const { unmount } = render(<Harness scope={sc} fn={file('IEL_Leave_2026-10-20.xlsx', done)} />); await user.click(screen.getByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready');
    fireEvent.click(screen.getByTestId('export-share')); unmount(); await act(async () => { resolve(); }); expect(done).toHaveBeenCalledTimes(1);
    render(<ExportFailureCard scope={sc} />); expect(screen.queryByTestId('export-ready')).toBeNull(); expect(screen.queryByTestId('export-shared')).toBeNull();
    cleanup(); const sc2 = scope(); phoneOn(); const r2 = render(<Harness scope={sc2} fn={file()} />); await user.click(screen.getByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready'); r2.unmount();
    render(<ExportFailureCard scope={sc2} />); expect(screen.queryByTestId('export-ready')).toBeNull();
  });
  it('a build that fails shows the existing failure card, never the ready card', async () => {
    phoneOn(); render(<Harness scope={scope()} fn={async () => { throw new TypeError('ZQ boom'); }} />); await userEvent.setup().click(screen.getByRole('button', { name: 'Export' }));
    expect((await screen.findByTestId('export-failed')).textContent).toMatch(/^The Excel file could not be made/); expect(screen.queryByTestId('export-ready')).toBeNull(); expect(exportLogs()).toEqual([['build-failed', 'iel', 'TypeError']]);
  });
  it('the 60 s release: a build that never settles frees the button; a file that arrives late still becomes the ready file', async () => {
    phoneOn(); fakeTimers(['setTimeout', 'clearTimeout']); const sc = scope(); let late, calls = 0;
    const fn = h => { calls++; return new Promise(res => { if (calls === 1) late = () => { h(SAMPLE_B64, 'IEL_Late_2026-10-20.xlsx'); res(); }; }); };
    render(<Harness scope={sc} fn={fn} />); const b = screen.getByRole('button', { name: 'Export' });
    fireEvent.click(b); fireEvent.click(b); await act(async () => {}); expect(calls).toBe(1); expect(b.getAttribute('aria-busy')).toBe('true');
    await act(async () => { await vi.advanceTimersByTimeAsync(60001); }); expect(b.getAttribute('aria-busy')).toBeNull();
    fireEvent.click(b); await act(async () => {}); expect(calls).toBe(2);
    await act(async () => { late(); }); expect(screen.getByTestId('export-ready').textContent).toContain('IEL_Late_2026-10-20.xlsx');
  });
});

describe('two scopes at the same time: each file reaches its own card', () => {
  it('two builds interleave, a third fails: each ready card holds its own file, Share file shares only that file, and the failure touches neither', async () => {
    const share = phoneOn(); const user = userEvent.setup(); let finishA, finishB; const doneA = vi.fn(), doneB = vi.fn();
    const A = scope('iel'), B = scope('tat'), C = scope('swb');
    render(<div>
      <Harness id="A" scope={A} fn={h => new Promise(r => { finishA = () => { h(SAMPLE_B64, 'IEL_A_2026-10-20.xlsx', doneA); r(); }; })} />
      <Harness id="B" scope={B} fn={h => new Promise(r => { finishB = () => { h(SAMPLE_B64, 'TAT_B_2026-10-20.xlsx', doneB); r(); }; })} />
      <Harness id="C" scope={C} fn={async () => { throw new RangeError('x'); }} /></div>);
    const inA = () => within(screen.getByTestId('A')), inB = () => within(screen.getByTestId('B')), inC = () => within(screen.getByTestId('C'));
    await user.click(inA().getByRole('button', { name: 'Export' })); await user.click(inB().getByRole('button', { name: 'Export' }));
    await act(async () => { finishB(); }); await act(async () => { finishA(); });
    expect(inA().getByTestId('export-ready').textContent).toContain('IEL_A_2026-10-20.xlsx'); expect(inB().getByTestId('export-ready').textContent).toContain('TAT_B_2026-10-20.xlsx');
    expect(inA().getByTestId('export-ready').textContent).not.toContain('TAT_B'); expect(inB().getByTestId('export-ready').textContent).not.toContain('IEL_A');
    await user.click(inC().getByRole('button', { name: 'Export' })); expect((await inC().findByTestId('export-failed')).textContent).toMatch(/could not be made/);
    expect(inA().queryByTestId('export-failed')).toBeNull(); expect(inB().queryByTestId('export-failed')).toBeNull(); expect(inA().getByTestId('export-ready')).toBeTruthy(); expect(inB().getByTestId('export-ready')).toBeTruthy();
    await user.click(inB().getByTestId('export-share')); await inB().findByTestId('export-shared');
    expect(share).toHaveBeenCalledTimes(1); expect(share.mock.calls[0][0].files[0].name).toBe('TAT_B_2026-10-20.xlsx'); expect(doneB).toHaveBeenCalledTimes(1); expect(doneA).not.toHaveBeenCalled();
    expect(inA().getByTestId('export-ready').textContent).toContain('IEL_A_2026-10-20.xlsx'); expect(inA().queryByTestId('export-shared')).toBeNull();
    await user.click(inA().getByTestId('export-share')); await inA().findByTestId('export-shared'); expect(share.mock.calls[1][0].files[0].name).toBe('IEL_A_2026-10-20.xlsx'); expect(doneA).toHaveBeenCalledTimes(1);
  });
  it('a cancel on one scope does not change the other scope\'s ready card', async () => {
    phoneOn({ share: vi.fn().mockRejectedValueOnce(abortError()).mockResolvedValue(undefined) }); const user = userEvent.setup();
    render(<div><Harness id="A" scope={scope('gsd')} fn={file('GSD_A_2026-10-20.xlsx')} /><Harness id="B" scope={scope('irt')} fn={file('IR_Test_B_2026-10-20.xlsx')} /></div>);
    await user.click(within(screen.getByTestId('A')).getByRole('button', { name: 'Export' })); await user.click(within(screen.getByTestId('B')).getByRole('button', { name: 'Export' }));
    await within(screen.getByTestId('A')).findByTestId('export-ready'); await within(screen.getByTestId('B')).findByTestId('export-ready');
    await user.click(within(screen.getByTestId('A')).getByTestId('export-share')); await act(async () => {});
    expect(within(screen.getByTestId('A')).getByTestId('export-ready').textContent).toMatch(/^The share sheet was closed/); expect(within(screen.getByTestId('B')).getByTestId('export-ready').textContent).toMatch(/^Excel file ready/);
  });
});

describe('everything that is not a phone keeps today\'s one-tap download', () => {
  it.each([
    ['this PC (0 touch points, fine pointer)', { touch: 0, coarse: false }], ['a touch laptop with a mouse', { touch: 5, coarse: false }], ['canShare says false', { canShare: () => false }], ['canShare throws', { canShare: () => { throw new Error('x'); } }],
    ['no navigator.share', { hasShare: false }], ['no navigator.canShare', { hasCanShare: false }], ['no matchMedia', { hasMatchMedia: false }],
  ])('%s: Export downloads at once, no ready card, share never called, done runs once', async (_n, opts) => {
    const share = phoneOn(opts); const d = downloadsOn(); const done = vi.fn(); render(<Harness scope={scope()} fn={file('IEL_Desktop_2026-10-20.xlsx', done)} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Export' })); await act(async () => {});
    expect(d.clicks).toEqual(['IEL_Desktop_2026-10-20.xlsx']); expect(screen.queryByTestId('export-ready')).toBeNull(); expect(share).not.toHaveBeenCalled(); expect(done).toHaveBeenCalledTimes(1); expect(screen.queryByTestId('export-failed')).toBeNull();
  });
  it('the native bridge on a phone: the file is posted to the bridge, the share sheet and the download are never used, done runs once', async () => {
    const share = phoneOn(); const d = downloadsOn(); const post = vi.fn(); window.webkit = { messageHandlers: { shareFile: { postMessage: post } } }; const done = vi.fn();
    render(<Harness scope={scope()} fn={file('IEL_Bridge_2026-10-20.xlsx', done)} />); await userEvent.setup().click(screen.getByRole('button', { name: 'Export' })); await act(async () => {});
    expect(post).toHaveBeenCalledTimes(1); expect(post).toHaveBeenCalledWith({ base64: SAMPLE_B64, filename: 'IEL_Bridge_2026-10-20.xlsx', mimeType: XLSX_MIME }); expect(share).not.toHaveBeenCalled(); expect(d.created).toEqual([]); expect(done).toHaveBeenCalledTimes(1); expect(screen.queryByTestId('export-ready')).toBeNull();
  });
});

describe('a template shares in ONE step, in the same tick as the tap', () => {
  const TEMPLATE = 'IEL_Import_Template.xlsx';
  it('the share sheet is open the moment the tap returns (checked with no await), once even on a double tap; nothing is shown on success; no ready card', async () => {
    const share = phoneOn(); const d = downloadsOn(); render(<Harness scope="iel:template" template label="Download Import Template" fn={h => { h(SAMPLE_B64, TEMPLATE); }} />);
    const b = screen.getByRole('button', { name: 'Download Import Template' }); fireEvent.click(b); expect(share).toHaveBeenCalledTimes(1); fireEvent.click(b); expect(share).toHaveBeenCalledTimes(1);
    const arg = share.mock.calls[0][0]; expect(Object.keys(arg)).toEqual(['files']); expect(arg.files[0].name).toBe(TEMPLATE); expect(arg.files[0].type).toBe(XLSX_MIME);
    await act(async () => {}); expect(screen.queryByTestId('export-ready')).toBeNull(); expect(screen.queryByTestId('export-shared')).toBeNull(); expect(screen.queryByTestId('export-closed')).toBeNull(); expect(screen.queryByTestId('export-failed')).toBeNull(); expect(d.created).toEqual([]);
  });
  it('a closed sheet leaves the info note "the template was not saved", no failure card, no log, no download', async () => {
    phoneOn({ share: vi.fn().mockRejectedValue(abortError()) }); const d = downloadsOn(); render(<Harness scope="tat:template" template label="Download Import Template" fn={h => { h(SAMPLE_B64, 'TAT_Import_Template.xlsx'); }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download Import Template' })); const c = await screen.findByTestId('export-closed');
    expect(c.textContent).toBe('The share sheet was closed, so the template was not saved.Tap Download Import Template to try again.'); expect(screen.queryByTestId('export-failed')).toBeNull(); expect(warn).not.toHaveBeenCalled(); expect(d.created).toEqual([]);
  });
  it('a refused sheet downloads the template once and says "Template download started"; the log has the code, the module key and the error name', async () => {
    phoneOn({ share: vi.fn().mockRejectedValue(named('NotAllowedError')) }); const d = downloadsOn(); render(<Harness scope="swb:template" template label="Download Import Template" fn={h => { h(SAMPLE_B64, 'SWB_Import_Template.xlsx'); }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download Import Template' })); const c = await screen.findByTestId('export-downloaded');
    expect(c.textContent).toBe('Template download startedThis phone could not open the share sheet, so the template was downloaded. Find it in the Files app.SWB_Import_Template.xlsx'); expect(d.clicks).toEqual(['SWB_Import_Template.xlsx']); expect(exportLogs()).toEqual([['share-refused', 'swb', 'NotAllowedError']]);
  });
  it('a template on a desktop downloads at once, as today', async () => {
    const share = phoneOn({ touch: 0, coarse: false }); const d = downloadsOn(); render(<Harness scope="irt:template" template label="Download Import Template" fn={h => { h(SAMPLE_B64, 'IRT_Import_Template.xlsx'); }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download Import Template' })); await act(async () => {}); expect(d.clicks).toEqual(['IRT_Import_Template.xlsx']); expect(share).not.toHaveBeenCalled();
  });
});

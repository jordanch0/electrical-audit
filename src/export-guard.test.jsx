// EXPORT GUARD (release r). FICTIONAL names. Every export and blank-template button runs through runExport(scope, fn); a failure anywhere inside fn ends in ONE card (ExportFailureCard) under the control that was
// pressed. The card says what failed, that nothing on the phone was changed and to try again; it never shows the cause; it clears on the next tap and when the screen is left; a second tap while one is building is
// ignored; nothing reaches window "error" / "unhandledrejection"; the log line is a code, the module key and the error NAME only. deliverExportFile throws instead of alerting and always cleans up after itself.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { runExport, ExportFailureCard, ExportDeliveryError, ExportLibraryError, exportSnapScope, deliverExportFile } from './App.jsx';

let warn, winErrors;
const onWinError = e => winErrors.push('error:' + e.message), onWinRej = e => winErrors.push('rejection');
beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); winErrors = []; window.addEventListener('error', onWinError); window.addEventListener('unhandledrejection', onWinRej); delete window.webkit; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); window.removeEventListener('error', onWinError); window.removeEventListener('unhandledrejection', onWinRej); delete window.webkit; });
// Fake only the named timers. The clock runs (CLOCK_AT) already fake Date in a global beforeEach, where a plain vi.useFakeTimers() installs nothing: reset first, keep Date faked at CLOCK_AT when it is set.
const fakeTimers = toFake => { vi.useRealTimers(); vi.useFakeTimers({ toFake: [...toFake, ...(process.env.CLOCK_AT ? ['Date'] : [])] }); if (process.env.CLOCK_AT) vi.setSystemTime(new Date(process.env.CLOCK_AT)); };
const Harness = ({ scope, fn, template }) => <div><button onClick={() => runExport(scope, fn)}>Export</button><ExportFailureCard scope={scope} /></div>;
const card = () => screen.queryByTestId('export-failed');

describe('runExport and the card', () => {
  it('a good export shows nothing and resolves', async () => {
    const fn = vi.fn(async () => {}); render(<Harness scope="iel:snap:a" fn={fn} />);
    await userEvent.setup().click(screen.getByText('Export')); expect(fn).toHaveBeenCalledTimes(1); expect(card()).toBeNull();
  });
  it('a build that throws ends in the card: icon, title, "Nothing on this phone was changed. Please try again.", role alert, no cause shown', async () => {
    render(<Harness scope="iel:snap:a" fn={async () => { throw new TypeError('Cannot read properties of undefined (reading ZQSITE-Mulberry-Depot)'); }} />);
    await userEvent.setup().click(screen.getByText('Export'));
    const c = await screen.findByTestId('export-failed'); expect(c.getAttribute('role')).toBe('alert'); expect(c.querySelector('svg')).toBeTruthy();
    expect(c.textContent).toBe('The Excel file could not be madeNothing on this phone was changed. Please try again.');
    expect(document.body.textContent).not.toMatch(/ZQSITE|Cannot read|TypeError/);
  });
  it('a hand-over failure says "could not be saved"; a missing library says "made"; a template says "The blank template"', async () => {
    const user = userEvent.setup();
    const run = async (scope, err) => { cleanup(); render(<Harness scope={scope} fn={async () => { throw err; }} />); await user.click(screen.getByText('Export')); return (await screen.findByTestId('export-failed')).textContent; };
    expect(await run('iel:snap:a', new ExportDeliveryError())).toMatch(/^The Excel file could not be saved/);
    expect(await run('iel:snap:a', new ExportLibraryError())).toMatch(/^The Excel file could not be made/);
    expect(await run('iel:template', new ExportLibraryError())).toMatch(/^The blank template could not be made/);
    expect(await run('iel:template', new ExportDeliveryError())).toMatch(/^The blank template could not be saved/);
  });
  it('a synchronous throw inside fn (not a rejected promise) is caught the same way', async () => {
    render(<Harness scope="tat:home" fn={() => { throw new Error('x'); }} />); await userEvent.setup().click(screen.getByText('Export')); expect(await screen.findByTestId('export-failed')).toBeTruthy();
  });
  it('the next tap clears the old card; a success leaves it clear; a new failure shows a new one', async () => {
    let n = 0; const user = userEvent.setup();
    render(<Harness scope="irt:snap:a" fn={async () => { n++; if (n !== 2) throw new Error('x'); }} />);
    await user.click(screen.getByText('Export')); expect(await screen.findByTestId('export-failed')).toBeTruthy();
    await user.click(screen.getByText('Export')); await act(async () => {}); expect(card()).toBeNull();
    await user.click(screen.getByText('Export')); expect(await screen.findByTestId('export-failed')).toBeTruthy();
  });
  it('leaving the screen drops the card: it is not there when the screen comes back', async () => {
    const user = userEvent.setup(); const { unmount } = render(<Harness scope="swb:snap:a" fn={async () => { throw new Error('x'); }} />);
    await user.click(screen.getByText('Export')); await screen.findByTestId('export-failed'); unmount();
    render(<ExportFailureCard scope="swb:snap:a" />); expect(card()).toBeNull();
  });
  it('two scopes are independent (a failure on one snapshot does not show under another)', async () => {
    const user = userEvent.setup(); render(<div><Harness scope="gsd:snap:1" fn={async () => { throw new Error('x'); }} /><ExportFailureCard scope="gsd:snap:2" /></div>);
    await user.click(screen.getByText('Export')); await screen.findByTestId('export-failed'); expect(screen.getAllByTestId('export-failed')).toHaveLength(1);
  });
  it('a second tap while one is building is ignored; once it settles the button works again', async () => {
    let release; const fn = vi.fn(() => new Promise(r => { release = r; })); const user = userEvent.setup(); render(<Harness scope="elt:snap:a" fn={fn} />);
    await user.click(screen.getByText('Export')); await user.click(screen.getByText('Export')); expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => { release(); }); await user.click(screen.getByText('Export')); expect(fn).toHaveBeenCalledTimes(2);
  });
  it('a build that never settles does not block the button for ever (released after 60 s)', async () => {
    fakeTimers(['setTimeout', 'clearTimeout']); const fn = vi.fn(() => new Promise(() => {}));
    runExport('welder:snap:a', fn); runExport('welder:snap:a', fn); expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60001); runExport('welder:snap:a', fn); expect(fn).toHaveBeenCalledTimes(2);
  });
  it('runExport never rejects and nothing reaches window error / unhandledrejection', async () => {
    await expect(runExport('rcd:snap:a', async () => { throw new Error('x'); })).resolves.toBeUndefined();
    await expect(runExport('rcd:snap:b', () => { throw new Error('x'); })).resolves.toBeUndefined();
    await new Promise(r => setTimeout(r, 20)); expect(winErrors).toEqual([]);
  });
  it('the scope helper is module:snap:id', () => { expect(exportSnapScope('iel', { id: 'abc' })).toBe('iel:snap:abc'); });
});

describe('the log: a code, the module key and the error NAME only', () => {
  it('build / deliver / library codes; never the message, the scope or an id', async () => {
    const SITE = 'ZQSITE-Mulberry-Depot';
    await runExport('iel:snap:' + SITE + '-uid1', async () => { throw new TypeError('bad ' + SITE); });
    await runExport('tat:snap:' + SITE, async () => { throw new ExportDeliveryError(); });
    await runExport('swb:template', async () => { throw new ExportLibraryError(); });
    await runExport('irt:snap:x', async () => { throw 'a plain string with ' + SITE; });
    expect(warn.mock.calls).toEqual([['[SparkCheck export]', 'build-failed', 'iel', 'TypeError'], ['[SparkCheck export]', 'deliver-failed', 'tat', 'ExportDeliveryError'], ['[SparkCheck export]', 'library-missing', 'swb', 'ExportLibraryError'], ['[SparkCheck export]', 'build-failed', 'irt', 'Error']]);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SITE);
  });
  it('an error whose name is not a plain word is logged as "Error"', async () => {
    const e = new Error('x'); e.name = 'ZQ Site: Mulberry (Depot)'; await runExport('rcd:home:push', async () => { throw e; });
    expect(warn.mock.calls[0]).toEqual(['[SparkCheck export]', 'build-failed', 'rcd', 'Error']);
  });
});

describe('deliverExportFile: never alerts, always cleans up', () => {
  const stubUrl = () => { const created = [], revoked = []; vi.stubGlobal('URL', Object.assign(function () {}, { createObjectURL: b => { created.push(b); return 'blob:zq' + created.length; }, revokeObjectURL: u => revoked.push(u) })); return { created, revoked }; };
  it('the bridge branch is unchanged: the payload is posted and nothing is downloaded', () => {
    const post = vi.fn(); window.webkit = { messageHandlers: { shareFile: { postMessage: post } } }; const u = stubUrl();
    deliverExportFile('QUJD', 'f.xlsx'); expect(post).toHaveBeenCalledWith({ base64: 'QUJD', filename: 'f.xlsx', mimeType: expect.stringContaining('spreadsheetml') }); expect(u.created).toEqual([]);
  });
  it('a bridge that throws becomes an ExportDeliveryError and no alert is shown', () => {
    const alertSpy = vi.fn(); vi.stubGlobal('alert', alertSpy); window.webkit = { messageHandlers: { shareFile: { postMessage: () => { throw new Error('ZQSITE secret'); } } } };
    let caught; try { deliverExportFile('QUJD', 'f.xlsx'); } catch (e) { caught = e; } expect(caught).toBeInstanceOf(ExportDeliveryError); expect(caught.message).not.toContain('ZQSITE'); expect(alertSpy).not.toHaveBeenCalled();
  });
  it('the download path: the link is added, clicked, removed, and the URL revoked after 120 s (release t: it was 30 s; a big download on a slow phone must not lose its URL)', () => {
    fakeTimers(['setTimeout', 'clearTimeout']); const u = stubUrl(); const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { expect(document.body.contains(this)).toBe(true); expect(this.download).toBe('f.xlsx'); });
    deliverExportFile('QUJD', 'f.xlsx'); expect(click).toHaveBeenCalledTimes(1); expect(document.querySelector('a[download]')).toBeNull(); expect(u.revoked).toEqual([]);
    vi.advanceTimersByTime(30001); expect(u.revoked, 'still held after the old 30 s').toEqual([]);
    vi.advanceTimersByTime(90000); expect(u.revoked).toEqual(['blob:zq1']);
  });
  it('a click that throws leaves no link in the page and no un-revoked URL, and throws ExportDeliveryError', () => {
    const u = stubUrl(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => deliverExportFile('QUJD', 'f.xlsx')).toThrow(ExportDeliveryError); expect(document.querySelector('a[download]')).toBeNull(); expect(u.revoked).toEqual(['blob:zq1']);
  });
  it('bad base64 throws ExportDeliveryError too', () => { stubUrl(); expect(() => deliverExportFile('%%%not base64%%%', 'f.xlsx')).toThrow(ExportDeliveryError); });
});

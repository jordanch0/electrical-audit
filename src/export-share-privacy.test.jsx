// THE SHARE HAND-OVER LOGS A CODE, THE MODULE KEY AND THE ERROR NAME ONLY (release t). A site name, a file name, a size or a scope id is never logged; a closed share sheet logs nothing at all; the held file lives in memory only.
// FICTIONAL names with a marker (ZQSITE) so any leak is easy to see.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { runExport, ExportBtn, ExportFailureCard } from './App.jsx';
import { phoneOn, phoneOff, downloadsOn, abortError, named, SAMPLE_B64 } from './test/share-env.js';

const SITE = 'ZQSITE-Mulberry-Depot';
let warn, err, log, info, n = 0;
beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); err = vi.spyOn(console, 'error').mockImplementation(() => {}); log = vi.spyOn(console, 'log').mockImplementation(() => {}); info = vi.spyOn(console, 'info').mockImplementation(() => {}); localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); phoneOff(); });
const STYLE = { padding: '5px 10px' };
const H = ({ scope, fn, template }) => <div><ExportBtn scope={scope} template={template} style={STYLE} run={() => runExport(scope, fn)}>Export</ExportBtn><ExportFailureCard scope={scope} /></div>;
const FILE = SITE.replace(/-/g, '_') + '_2026-10-20.xlsx';
const fn = h => { h(SAMPLE_B64, 'IEL_' + FILE); };
const exportLogs = () => warn.mock.calls.filter(a => a[0] === '[SparkCheck export]');
const everything = () => JSON.stringify([warn.mock.calls, err.mock.calls, log.mock.calls, info.mock.calls]);
async function readyThenShare(user, scope) { render(<H scope={scope} fn={fn} />); await user.click(screen.getByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready'); await user.click(screen.getByTestId('export-share')); await act(async () => {}); }

describe('what the hand-over writes to the console', () => {
  it('a closed sheet logs nothing at all', async () => { phoneOn({ share: vi.fn().mockRejectedValue(abortError()) }); await readyThenShare(userEvent.setup(), 'iel:snap:' + SITE + '-uid1'); expect(warn).not.toHaveBeenCalled(); expect(err).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled(); expect(info).not.toHaveBeenCalled(); });
  it('a good share logs nothing at all', async () => { phoneOn(); await readyThenShare(userEvent.setup(), 'tat:snap:' + SITE); expect(everything()).toBe('[[],[],[],[]]'); });
  it('a refusal logs share-refused with the module key and the error name; a failure logs share-failed; the site name, the file name and the scope never appear', async () => {
    phoneOn({ share: vi.fn().mockRejectedValue(named('NotAllowedError')) }); downloadsOn(); await readyThenShare(userEvent.setup(), 'swb:snap:' + SITE + '-uid2');
    expect(exportLogs()).toEqual([['[SparkCheck export]', 'share-refused', 'swb', 'NotAllowedError']]); expect(everything()).not.toContain('ZQSITE'); expect(everything()).not.toContain('.xlsx'); expect(everything()).not.toContain('uid2');
    cleanup(); warn.mockClear(); phoneOn({ share: vi.fn().mockRejectedValue(Object.assign(new Error('secret ' + SITE), { name: 'WeirdError' })) }); downloadsOn(); await readyThenShare(userEvent.setup(), 'elt:snap:' + SITE);
    expect(exportLogs()).toEqual([['[SparkCheck export]', 'share-failed', 'elt', 'WeirdError']]); expect(everything()).not.toContain('ZQSITE'); expect(everything()).not.toContain('secret');
  });
  it('an error whose name is not a plain word is logged as "Error"', async () => {
    phoneOn({ share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'ZQ Site: Mulberry (Depot)' })) }); downloadsOn(); await readyThenShare(userEvent.setup(), 'gsd:snap:a');
    expect(exportLogs()).toEqual([['[SparkCheck export]', 'share-failed', 'gsd', 'Error']]);
  });
  it('a refusal followed by a failing download logs the refusal and then deliver-failed, still with no name in them', async () => {
    phoneOn({ share: vi.fn().mockRejectedValue(named('SecurityError')) }); downloadsOn({ failClick: true }); await readyThenShare(userEvent.setup(), 'irt:snap:' + SITE);
    expect(exportLogs()).toEqual([['[SparkCheck export]', 'share-refused', 'irt', 'SecurityError'], ['[SparkCheck export]', 'deliver-failed', 'irt', 'ExportDeliveryError']]); expect(everything()).not.toContain('ZQSITE');
  });
  it('a template that is closed, refused or shared logs per the same rules (nothing, a code, nothing)', async () => {
    const t = async share => { cleanup(); warn.mockClear(); phoneOn({ share }); downloadsOn(); render(<H scope="welder:template" template fn={h => { h(SAMPLE_B64, 'Welder_Import_Template.xlsx'); }} />); await userEvent.setup().click(screen.getByRole('button', { name: 'Export' })); await act(async () => {}); return exportLogs(); };
    expect(await t(vi.fn().mockRejectedValue(abortError()))).toEqual([]); expect(await t(vi.fn().mockResolvedValue(undefined))).toEqual([]);
    expect(await t(vi.fn().mockRejectedValue(named('NotAllowedError')))).toEqual([['[SparkCheck export]', 'share-refused', 'welder', 'NotAllowedError']]);
  });
});

describe('the held file is memory only', () => {
  it('nothing is written to localStorage or sessionStorage while a file is held, shared, discarded or refused', async () => {
    phoneOn(); downloadsOn(); const user = userEvent.setup(); const before = JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]);
    render(<H scope={'iel:snap:' + SITE} fn={fn} />); await user.click(screen.getByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready');
    expect(JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)])).toBe(before);
    await user.click(screen.getByTestId('export-discard')); await user.click(screen.getByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready'); await user.click(screen.getByTestId('export-share')); await screen.findByTestId('export-shared');
    expect(JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)])).toBe(before);
  });
});

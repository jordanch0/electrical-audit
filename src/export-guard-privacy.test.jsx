// THE CONSOLE LOG AND THE SCREEN NEVER CARRY A SITE NAME WHEN AN EXPORT FAILS (release r). Same rule as backup-log-privacy.test.jsx. FICTIONAL names are put in the site name, the error message, the error name and the scope;
// every failure path of the guard is driven; everything written to console.* and all the text on screen is collected and must not contain a name.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { runExport, ExportFailureCard, ExportDeliveryError, ExportLibraryError, exportSnapScope } from './App.jsx';

const NAMES = ['ZQSITE-Mulberry-Depot', 'ZQCLIENT-Hartwell', 'ZQ-ABN-99887766554'];
let logged;
beforeEach(() => { logged = []; for (const m of ['warn', 'log', 'info', 'error', 'debug']) vi.spyOn(console, m).mockImplementation((...a) => { logged.push(m + ': ' + a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const noNames = label => { const all = logged.join('\n') + '\n' + document.body.textContent; for (const n of NAMES) expect(all, label + ' leaked ' + n).not.toContain(n); };

describe('no site name reaches the console or the card', () => {
  const cases = [
    ['an Error whose message holds the names', () => new Error('Cannot export ' + NAMES[0] + ' for ' + NAMES[1])],
    ['a TypeError naming a property', () => new TypeError("Cannot read properties of undefined (reading '" + NAMES[0] + "')")],
    ['an error whose NAME is a site name', () => { const e = new Error('x'); e.name = NAMES[0]; return e; }],
    ['a thrown string', () => NAMES.join(' ')],
    ['a thrown object', () => ({ site: NAMES[0], abn: NAMES[2] })],
    ['a delivery failure built from a cause', () => { const e = new ExportDeliveryError(); e.cause = new Error(NAMES[0]); return e; }],
    ['a library failure', () => new ExportLibraryError()],
  ];
  it.each(cases)('%s', async (_, make) => {
    const scope = exportSnapScope('iel', { id: NAMES[0].toLowerCase() + '-k3j9x2' }); const user = userEvent.setup();
    render(<div><button onClick={() => runExport(scope, async () => { throw make(); })}>Export</button><ExportFailureCard scope={scope} /></div>);
    await user.click(screen.getByText('Export')); await screen.findByTestId('export-failed'); noNames('card + log');
    const lines = logged.filter(l => l.includes('[SparkCheck export]')); expect(lines).toHaveLength(1); expect(lines[0]).toMatch(/^warn: \[SparkCheck export\] (build|deliver)-failed iel [A-Za-z]+$|^warn: \[SparkCheck export\] library-missing iel [A-Za-z]+$/);
  });
  it('a template scope and a Home scope are logged by module key only', async () => {
    await runExport('welder:template', async () => { throw new ExportLibraryError(); }); await runExport('rcd:home:push', async () => { throw new Error(NAMES[0]); });
    expect(logged).toEqual(['warn: [SparkCheck export] library-missing welder ExportLibraryError', 'warn: [SparkCheck export] build-failed rcd Error']);
  });
});

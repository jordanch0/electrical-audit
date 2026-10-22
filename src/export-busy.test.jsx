// THE EXPORT BUTTON SHOWS THAT IT IS WORKING (release s). FICTIONAL scopes. Every export and template button is an ExportBtn: while its scope is running the label is "Making…" ("Making the template…" for a blank
// template), the button keeps its size (both labels share one grid cell), stays focusable (aria-busy + aria-disabled, never the disabled attribute), and a polite live region says what is happening. The label comes back when
// the run ends, when it fails (the card appears) and when the 60 s release frees a stuck run. A second tap is still ignored by runExport. The module colour is untouched: the busy label has no colour of its own.
// Timer rule (release r): the clock runs fake Date in a global beforeEach, so vi.useFakeTimers() alone installs nothing: reset first, keep Date faked at CLOCK_AT when it is set.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { runExport, ExportBtn, ExportFailureCard, useExportBusy } from './App.jsx';

const fakeTimers = toFake => { vi.useRealTimers(); vi.useFakeTimers({ toFake: [...toFake, ...(process.env.CLOCK_AT ? ['Date'] : [])] }); if (process.env.CLOCK_AT) vi.setSystemTime(new Date(process.env.CLOCK_AT)); };
let errSpy;
beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); errSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

const STYLE = { padding: '5px 10px', background: 'transparent', border: '1px solid #d4d4d8', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#14532d' };
const Harness = ({ scope, fn, template, label = 'Export' }) => <div><ExportBtn scope={scope} template={template} style={STYLE} run={() => runExport(scope, fn)}><svg width="15" height="15" />{' ' + label}</ExportBtn><ExportFailureCard scope={scope} /></div>;
const btn = () => screen.getByRole('button');
const live = () => screen.getByTestId('export-live');
const busyLayer = () => screen.getByTestId('export-busy-label');
let n = 0; const scopeId = p => p + ':snap:busy' + (++n);

describe('the idle button', () => {
  it('reads Export, has no aria-busy / aria-disabled / disabled, and the live region is there but empty', () => {
    render(<Harness scope={scopeId('iel')} fn={async () => {}} />);
    expect(btn().textContent).toContain('Export'); expect(btn().getAttribute('aria-busy')).toBeNull(); expect(btn().getAttribute('aria-disabled')).toBeNull(); expect(btn().disabled).toBe(false);
    expect(live().getAttribute('role')).toBe('status'); expect(live().getAttribute('aria-live')).toBe('polite'); expect(live().textContent).toBe('');
    expect(screen.getByRole('button', { name: 'Export' })).toBe(btn());                                    // the hidden busy label is not part of the name
  });
  it('the module button style is passed through untouched', () => {
    render(<Harness scope={scopeId('tat')} fn={async () => {}} />); const s = btn().style;
    expect(s.color).toBe('rgb(20, 83, 45)'); expect(s.padding).toBe('5px 10px'); expect(s.fontSize).toBe('12px'); expect(s.borderRadius).toBe('6px'); expect(s.background).toBe('transparent');
  });
  it('both labels sit in ONE grid cell (the button is as wide as the longer one, so it never changes width or wraps) and the busy label has no colour or opacity of its own', () => {
    render(<Harness scope={scopeId('swb')} fn={async () => {}} />);
    const wrap = btn().firstChild; expect(wrap.style.display).toBe('grid');
    const [idle, busy] = [wrap.children[0], wrap.children[1]]; expect(idle.style.gridArea).toBe('1 / 1'); expect(busy.style.gridArea).toBe('1 / 1');
    expect(idle.style.visibility).toBe('visible'); expect(busy.style.visibility).toBe('hidden'); expect(busy.getAttribute('aria-hidden')).toBe('true'); expect(busy.style.whiteSpace).toBe('nowrap');
    expect(busy.style.color).toBe(''); expect(busy.style.opacity).toBe('');
  });
});

describe('while an export is running', () => {
  it('the label is Making…, aria-busy and aria-disabled are set, the button is not disabled and can take focus, the live region speaks', async () => {
    let release; render(<Harness scope={scopeId('elt')} fn={() => new Promise(r => { release = r; })} />);
    await userEvent.setup().click(btn());
    expect(btn().getAttribute('aria-busy')).toBe('true'); expect(btn().getAttribute('aria-disabled')).toBe('true'); expect(btn().disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Making…' })).toBe(btn()); expect(busyLayer().style.visibility).toBe('visible'); expect(btn().firstChild.children[0].style.visibility).toBe('hidden');
    act(() => btn().focus()); expect(document.activeElement).toBe(btn());
    expect(live().textContent).toBe('Making the Excel file. Please wait.');
    await act(async () => { release(); });
  });
  it('a blank template says Making the template… and the live region says the blank template', async () => {
    let release; render(<Harness scope="iel:template" template label="Download Import Template" fn={() => new Promise(r => { release = r; })} />);
    await userEvent.setup().click(btn());
    expect(screen.getByRole('button', { name: 'Making the template…' })).toBe(btn()); expect(live().textContent).toBe('Making the blank template. Please wait.');
    await act(async () => { release(); }); expect(screen.getByRole('button', { name: 'Download Import Template' })).toBe(btn());
  });
  it('a second tap does not start a second run', async () => {
    const fn = vi.fn(() => new Promise(() => {})); render(<Harness scope={scopeId('irt')} fn={fn} />); const user = userEvent.setup();
    await user.click(btn()); await user.click(btn()); fireEvent.click(btn()); expect(fn).toHaveBeenCalledTimes(1);
  });
  it('only the pressed scope is busy: a neighbour with another scope keeps its normal label', async () => {
    const a = scopeId('gsd'), b = scopeId('gsd'); render(<div><Harness scope={a} fn={() => new Promise(() => {})} /><Harness scope={b} fn={async () => {}} /></div>);
    await userEvent.setup().click(screen.getAllByRole('button')[0]);
    const [first, second] = screen.getAllByRole('button'); expect(first.getAttribute('aria-busy')).toBe('true'); expect(second.getAttribute('aria-busy')).toBeNull(); expect(screen.getAllByTestId('export-live').map(e => e.textContent)).toEqual(['Making the Excel file. Please wait.', '']);
  });
});

describe('the label comes back', () => {
  it('when the run ends well: the name is Export again, aria-busy is gone, the live region is empty and no card shows', async () => {
    let release; render(<Harness scope={scopeId('rcd')} fn={() => new Promise(r => { release = r; })} />);
    await userEvent.setup().click(btn()); expect(btn().getAttribute('aria-busy')).toBe('true');
    await act(async () => { release(); });
    expect(screen.getByRole('button', { name: 'Export' })).toBe(btn()); expect(btn().getAttribute('aria-busy')).toBeNull(); expect(btn().getAttribute('aria-disabled')).toBeNull(); expect(live().textContent).toBe(''); expect(screen.queryByTestId('export-failed')).toBeNull();
  });
  it('when the run FAILS: the label returns AND the failure card shows (for a rejected promise and for a synchronous throw)', async () => {
    const user = userEvent.setup();
    render(<Harness scope={scopeId('welder')} fn={async () => { throw new Error('x'); }} />); await user.click(btn());
    expect(await screen.findByTestId('export-failed')).toBeTruthy(); expect(screen.getByRole('button', { name: 'Export' })).toBe(btn()); expect(btn().getAttribute('aria-busy')).toBeNull(); expect(live().textContent).toBe('');
    cleanup(); render(<Harness scope={scopeId('welder')} fn={() => { throw new Error('y'); }} />); await user.click(btn());
    expect(await screen.findByTestId('export-failed')).toBeTruthy(); expect(btn().getAttribute('aria-busy')).toBeNull();
  });
  it('after the 60 s release of a stuck run (a build that never settles)', async () => {
    fakeTimers(['setTimeout', 'clearTimeout']); const scope = scopeId('thermo'); const fn = vi.fn(() => new Promise(() => {}));
    render(<Harness scope={scope} fn={fn} />); fireEvent.click(btn()); await act(async () => {});
    expect(btn().getAttribute('aria-busy')).toBe('true');
    await act(async () => { await vi.advanceTimersByTimeAsync(59000); }); expect(btn().getAttribute('aria-busy')).toBe('true');
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(btn().getAttribute('aria-busy')).toBeNull(); expect(screen.getByRole('button', { name: 'Export' })).toBe(btn()); expect(live().textContent).toBe('');
    fireEvent.click(btn()); await act(async () => {}); expect(fn).toHaveBeenCalledTimes(2); expect(btn().getAttribute('aria-busy')).toBe('true');
  });
  it('a stuck run that settles LATE does not switch off a newer run of the same scope', async () => {
    fakeTimers(['setTimeout', 'clearTimeout']); const scope = scopeId('swb'); let releaseOld, releaseNew;
    render(<Harness scope={scope} fn={() => new Promise(r => { if (!releaseOld) releaseOld = r; else releaseNew = r; })} />);
    fireEvent.click(btn()); await act(async () => {}); await act(async () => { await vi.advanceTimersByTimeAsync(60001); }); expect(btn().getAttribute('aria-busy')).toBeNull();
    fireEvent.click(btn()); await act(async () => {}); expect(btn().getAttribute('aria-busy')).toBe('true');
    await act(async () => { releaseOld(); }); expect(btn().getAttribute('aria-busy')).toBe('true');
    await act(async () => { releaseNew(); }); expect(btn().getAttribute('aria-busy')).toBeNull();
  });
  it('a button that leaves the screen while its run is going causes no React warning when the run ends', async () => {
    let release; const { unmount } = render(<Harness scope={scopeId('iel')} fn={() => new Promise(r => { release = r; })} />);
    await userEvent.setup().click(btn()); unmount(); await act(async () => { release(); }); await new Promise(r => setTimeout(r, 10)); expect(errSpy).not.toHaveBeenCalled();
  });
});

describe('useExportBusy', () => {
  const Probe = ({ scope }) => <span data-testid="probe">{String(useExportBusy(scope))}</span>;
  it('is false at rest, true while the scope runs and false again after', async () => {
    const scope = scopeId('tat'); let release; render(<Probe scope={scope} />); expect(screen.getByTestId('probe').textContent).toBe('false');
    let p; act(() => { p = runExport(scope, () => new Promise(r => { release = r; })); }); expect(screen.getByTestId('probe').textContent).toBe('true');
    await act(async () => { release(); await p; }); expect(screen.getByTestId('probe').textContent).toBe('false');
  });
});

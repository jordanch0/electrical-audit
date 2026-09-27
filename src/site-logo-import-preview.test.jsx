// Per-site logo, follow-up fixes (2026-09-27):
// 1. LogoField's Replace/Upload button must stay a fixed size when the Delete (bin) button next to it expands into its confirm row —
//    same root cause as the earlier GSD Delete/Duplicate/Move sizing bug (a flexDirection:"column" container defaults to
//    alignItems:"stretch", so the whole column — including the label — stretches to match Delete's widened confirm-state content).
// 2. The import preview screen (before a site is created) now shows the logo detected by xjExtractLogo through the SAME LogoField used
//    for manual Add Site entry, with working Replace/Remove, staged there until "Import Site" is actually clicked — falling back to the
//    global default (with the same "Using the global default logo" note) when the file has no embedded logo, exactly like manual entry.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { LogoField, siteLogoStore, appLogoStore, saveAppSettings, exportSWBExcel } from './App.jsx';
import 'fake-indexeddb/auto';

afterEach(() => cleanup()); beforeEach(() => localStorage.clear());
beforeAll(() => {
  URL.createObjectURL = () => 'blob:preview-test'; URL.revokeObjectURL = () => {};
  // jsdom has no DataTransfer; a minimal stand-in is enough to drive a simulated file-input drop in these tests.
  if (typeof globalThis.DataTransfer === 'undefined') {
    globalThis.DataTransfer = class { constructor() { this._files = []; this.items = { add: f => this._files.push(f) }; } get files() { return this._files; } };
  }
});
const rec = byte => ({ buf: new Uint8Array([byte, byte + 1, byte + 2]).buffer, type: 'image/jpeg' });

describe('LogoField: Replace stays fixed-size regardless of Delete\'s expand state', () => {
  it('the button column does not stretch to match the DeleteButton\'s widened confirm row (alignItems: flex-start, not the flex default of stretch)', () => {
    const { container } = render(<LogoField value="data:image/jpeg;base64,x" onUpload={() => {}} onRemove={() => {}} />);
    const label = screen.getByText('Replace').closest('label');
    const column = label.parentElement;
    expect(column.style.alignItems).toBe('flex-start');   // decouples the label's width from any sibling's (Delete's) width
    expect(label.style.flexShrink).toBe('0');
  });
  it('Delete can still expand into its confirm row alongside a fixed-size Replace', async () => {
    const user = userEvent.setup();
    render(<LogoField value="data:image/jpeg;base64,x" onUpload={() => {}} onRemove={() => {}} />);
    expect(screen.getByText('Replace')).toBeTruthy();
    const bin = screen.getAllByRole('button').find(b => b.textContent === '' && b.querySelector('svg') && !b.getAttribute('aria-label'));
    await user.click(bin);
    expect(await screen.findByText('Remove logo?')).toBeTruthy();   // Delete's confirm row is showing…
    expect(screen.getByText('Replace')).toBeTruthy();               // …and Replace is still there, untouched
  });
});

describe('Import preview: shows the extracted logo (or the global default) via the same LogoField, with working Replace/Remove', () => {
  let payload;
  beforeEach(() => { payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
  afterEach(() => { delete window.webkit; });
  const buildImportFile = async project => {
    await exportSWBExcel(project, {}, { auditor: 'J', testDate: '2026-09-21' });
    const bytes = Buffer.from(payload.base64, 'base64');
    return new File([bytes], 'export.xlsx', { type: payload.mimeType });
  };
  const dropFile = async file => {
    const input = document.querySelector('input[type=file]');
    const dt = new DataTransfer(); dt.items.add(file);
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true });
    fireEvent.change(input);
  };

  it('a file with an embedded logo previews it with Replace/Remove — not the global default', async () => {
    await appLogoStore.put(rec(1)); saveAppSettings({ businessName: '', abn: '', licence: '', logoId: 'logo' });                 // a DIFFERENT global logo
    const withLogo = { id: 's1', name: 'Site With Logo', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] };
    await siteLogoStore.put('swb', 's1', rec(9));                                                                                // this export's OWN per-site logo
    const file = await buildImportFile(withLogo);

    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD'));
    await user.click(await screen.findByText(/\+ Add/));
    await user.click(screen.getByText('Import Excel'));
    await dropFile(file);

    expect(await screen.findByText('✓ Preview')).toBeTruthy();
    expect(await screen.findByAltText('Logo')).toBeTruthy();
    // xjExtractLogo resolves asynchronously after the preview first renders (which shows the global default
    // until the extracted logo arrives), so wait for that settle before asserting the final displayed state.
    await waitFor(() => expect(screen.queryByText(/Using the global default logo/)).not.toBeInTheDocument());   // it's the extracted one, not the fallback
    const bin = screen.getAllByRole('button').find(b => b.textContent === '' && b.querySelector('svg') && !b.getAttribute('aria-label'));
    expect(bin).toBeTruthy();   // a Remove control is present — a real value, not the default-fallback display
  });

  it('a file with NO embedded logo falls back to the global default in the preview, same as manual Add Site', async () => {
    await appLogoStore.put(rec(2)); saveAppSettings({ businessName: '', abn: '', licence: '', logoId: 'logo' });
    const noLogo = { id: 's2', name: 'Site No Logo', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] };
    const file = await buildImportFile(noLogo);

    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD'));
    await user.click(await screen.findByText(/\+ Add/));
    await user.click(screen.getByText('Import Excel'));
    await dropFile(file);

    expect(await screen.findByText('✓ Preview')).toBeTruthy();
    expect(await screen.findByAltText('Logo')).toBeTruthy();
    expect(await screen.findByText(/Using the global default logo/)).toBeTruthy();
  });

  it('with NO global logo either, the preview correctly shows "No logo set"', async () => {
    const noLogo = { id: 's3', name: 'Site No Logo At All', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] };
    const file = await buildImportFile(noLogo);

    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD'));
    await user.click(await screen.findByText(/\+ Add/));
    await user.click(screen.getByText('Import Excel'));
    await dropFile(file);

    expect(await screen.findByText('✓ Preview')).toBeTruthy();
    expect(await screen.findByText('No logo set')).toBeTruthy();
  });

  it('Remove in the preview falls back to the global default (same as Add Site/Manage), and the FINAL committed site has NO per-site override', async () => {
    await appLogoStore.put(rec(3)); saveAppSettings({ businessName: '', abn: '', licence: '', logoId: 'logo' });
    const withLogo = { id: 's4', name: 'Remove Before Confirm', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] };
    await siteLogoStore.put('swb', 's4', rec(9));
    const file = await buildImportFile(withLogo);

    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD'));
    await user.click(await screen.findByText(/\+ Add/));
    await user.click(screen.getByText('Import Excel'));
    await dropFile(file);
    await screen.findByAltText('Logo');
    // wait for xjExtractLogo's async resolution to settle (it re-renders LogoField, which would otherwise
    // remount the DeleteButton mid-confirm and swallow the click below) before starting the Remove flow.
    await waitFor(() => expect(screen.queryByText(/Using the global default logo/)).not.toBeInTheDocument());

    const bin = screen.getAllByRole('button').find(b => b.textContent === '' && b.querySelector('svg') && !b.getAttribute('aria-label'));
    await user.click(bin);
    await user.click(await screen.findByRole('button', { name: /Delete$/ }));
    // removing the extracted value falls back to the global default, exactly like Add Site/Manage's Remove does —
    // there's no way to distinguish "never had a value" from "had one and it was removed" once importLogoUrl is null
    expect(await screen.findByText(/Using the global default logo/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Import Site/ }));
    const newId = JSON.parse(localStorage.getItem('swb-projects-v1')).find(p => p.name === 'Remove Before Confirm').id;
    expect(await siteLogoStore.get('swb', newId)).toBeUndefined();   // no per-site override was written for the new site
  });

  it('un-doing the preview (a fresh Re-upload) drops the previously-extracted logo, proving the preview\'s CURRENT state — not whatever xjExtractLogo first found — is what gets committed', async () => {
    const withLogo = { id: 's5', name: 'Reupload Before Confirm', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] };
    await siteLogoStore.put('swb', 's5', rec(9));
    const fileWithLogo = await buildImportFile(withLogo);
    const noLogo = { id: 's6', name: 'Reupload Before Confirm', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] };
    const fileNoLogo = await buildImportFile(noLogo);

    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD'));
    await user.click(await screen.findByText(/\+ Add/));
    await user.click(screen.getByText('Import Excel'));
    await dropFile(fileWithLogo);
    await screen.findByAltText('Logo');                        // first file's logo extracted and previewed

    await user.click(screen.getByText('Re-upload'));           // back to the file picker, discarding the first preview
    await dropFile(fileNoLogo);                                // a second file, with no embedded logo
    expect(await screen.findByText('No logo set')).toBeTruthy();
    expect(screen.queryByAltText('Logo')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Import Site/ }));
    const newId = JSON.parse(localStorage.getItem('swb-projects-v1')).find(p => p.name === 'Reupload Before Confirm').id;
    expect(await siteLogoStore.get('swb', newId)).toBeUndefined();   // the second (no-logo) file's state won, not the first file's logo
  });
});

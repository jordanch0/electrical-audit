// Per-site logo override, Stage 2: Add Site / Manage UI. Every module's Add Site form lets you upload a logo that's staged locally (the
// site has no id yet) and written to siteLogoStore only once "Add Site" is clicked; every module's Manage edit form loads any existing
// per-site logo, lets you replace/remove it, and — matching how Company/ABN/Licence already behave there — stages the change and commits
// it only on that form's own Save button, not immediately on pick.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { siteLogoStore } from './App.jsx';
import 'fake-indexeddb/auto';

afterEach(() => cleanup()); beforeEach(() => localStorage.clear());
beforeAll(() => { URL.createObjectURL = () => 'blob:site-logo-ui-test'; URL.revokeObjectURL = () => {}; });

// jsdom has no canvas, so resizeImageToDataUrl (which draws to a canvas) can't run for a real <input type=file> pick in these tests.
// Stage 1 already covers the storage/resolution math directly; here we cover the STAGE-UNTIL-SUBMIT wiring — that no write happens before
// the form's own commit action — using the Remove path (no canvas involved) to prove that, plus the on-load preview from existing storage.
const bin = () => screen.getAllByRole('button').filter(b => b.textContent === '' && b.querySelector('svg') && !b.getAttribute('aria-label'));

describe('Add Site: a logo control is present and does not touch storage before "Add Site" is clicked', () => {
  it('RCD', async () => {
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('RCD TESTING'));
    await user.click(await screen.findByText(/\+ Add/));
    expect(await screen.findByText('LOGO (optional — overrides the global one)')).toBeTruthy();
    expect(screen.getByText('Upload')).toBeTruthy();
    expect(await siteLogoStore.get('rcd', 'my-site')).toBeUndefined();   // nothing written just by opening the form
  });
  it('GSD (object-shaped vals form)', async () => {
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('GENERAL SITE DEFECTS'));
    await user.click(await screen.findByText(/\+ Add/));
    expect(await screen.findByText('LOGO (optional — overrides the global one)')).toBeTruthy();
  });
});

describe('Manage: an existing per-site logo previews on load; Remove stages until Save, not immediately', () => {
  it('RCD', async () => {
    localStorage.setItem('rcd-projects-v6', JSON.stringify([{ id: 's1', name: 'Site S', company: '', abn: '', licence: '', areas: [] }]));
    await siteLogoStore.put('rcd', 's1', { buf: new Uint8Array([1]).buffer, type: 'image/jpeg' });
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('RCD TESTING'));
    await user.click(await screen.findByText('Site S', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: 'Manage' }));
    await user.click((await screen.findAllByRole('button')).find(b => b.querySelector('path[d^="M11 4H4a2"]')));  // the pencil edit button
    expect(await screen.findByAltText('Logo')).toBeTruthy();            // previews the existing per-site logo
    const removeBin = bin().find(b => b !== undefined);
    await user.click(removeBin); await user.click(await screen.findByRole('button', { name: /Delete$/ }));
    expect(await screen.findByText('No logo set')).toBeTruthy();        // removed in the FORM
    expect(await siteLogoStore.get('rcd', 's1')).toBeTruthy();          // but NOT yet in storage — staged, not committed
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await siteLogoStore.get('rcd', 's1')).toBeUndefined();       // committed on Save
  });
  it('GSD (object-shaped vals form, edited via the pencil icon)', async () => {
    localStorage.setItem('gsd-projects-v1', JSON.stringify([{ id: 'g1', name: 'Site G', company: '', abn: '', licence: '', areas: [] }]));
    await siteLogoStore.put('gsd', 'g1', { buf: new Uint8Array([1]).buffer, type: 'image/jpeg' });
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('GENERAL SITE DEFECTS'));
    await user.click(await screen.findByText('Site G', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: 'Manage' }));
    await user.click(await screen.findByLabelText('Edit site details'));
    expect(await screen.findByAltText('Logo')).toBeTruthy();
    const removeBin = bin().find(b => b !== undefined);
    await user.click(removeBin); await user.click(await screen.findByRole('button', { name: /Delete$/ }));
    expect(await siteLogoStore.get('gsd', 'g1')).toBeTruthy();          // staged only
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await siteLogoStore.get('gsd', 'g1')).toBeUndefined();       // committed
  });
});

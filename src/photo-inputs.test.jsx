// Every photo input gives the OS's normal chooser (Take Photo / Photo Library / Files): NO `capture` attribute (with capture="environment" phones open a camera-only screen
// with no photo library — confirmed on a real phone), `accept="image/*"` and `multiple` kept.
import React from 'react';
import fs from 'fs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot from './App.jsx';

afterEach(() => cleanup()); beforeEach(() => localStorage.clear());
const chooserOk = el => { expect(el).toBeTruthy(); expect(el.hasAttribute('capture')).toBe(false); expect(el.getAttribute('accept')).toBe('image/*'); expect(el.multiple).toBe(true); expect(el.type).toBe('file'); };

describe('no photo input forces the camera', () => {
  it('source: all five image file inputs (SWB, ELT, Welder, GSD x2) exist and none of them mentions capture', () => {
    const src = fs.readFileSync('src/App.jsx', 'utf8'); const hits = [...src.matchAll(/accept:\s*"image\/\*"/g)];
    expect(hits).toHaveLength(5);
    hits.forEach(h => expect(src.slice(Math.max(0, h.index - 160), h.index + 200), 'near ' + h.index).not.toMatch(/capture\s*:/));
  });
  it('GSD: the quick-add input and the item page input', async () => {
    localStorage.setItem('gsd-projects-v1', JSON.stringify([{ id: 's1', name: 'Site G', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'One' }] }]));
    localStorage.setItem('gsd-meta-v1', JSON.stringify({ s1: { auditor: 'J', testDate: '2026-09-21' } }));
    localStorage.setItem('gsd-items-v1', JSON.stringify({ s1: [{ id: 'i1', areaId: 'a1', assetLocation: '', category: '', commonDefect: '', description: 'x', descAuto: '', photos: [], priority: '', responsibility: '', dueDate: '' }] }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('GENERAL SITE DEFECTS')); await user.click(await screen.findByText('Site G', { selector: 'div' })); await user.click(screen.getByRole('button', { name: 'Audit' }));
    chooserOk(await screen.findByTestId('gsd-add-photos')); await user.click(await screen.findByTestId('gsd-card')); chooserOk(await screen.findByTestId('gsd-item-photos'));
  });
  it('Welder: the photo input', async () => {
    localStorage.setItem('welder-projects-v2', JSON.stringify([{ id: 'w1', name: 'Site W', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Site W', assets: [{ id: 'a1', assetId: 'W1', brand: 'K', model: 'E', serial: '1' }] }] }]));
    localStorage.setItem('welder-meta-v1', JSON.stringify({ w1: { auditor: 'J', testDate: '2026-09-21' } }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('WELDER TESTING')); await user.click(await screen.findByText('Site W', { selector: 'div' })); await user.click(screen.getByRole('button', { name: 'Audit' }));
    await user.click(await screen.findByText(/W1/)); chooserOk(await screen.findByTestId('welder-photo-input'));
  });
  it('SWB: the board photo input', async () => {
    localStorage.setItem('swb-projects-v1', JSON.stringify([{ id: 's1', name: 'Site S', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] }]));
    localStorage.setItem('swb-meta-v1', JSON.stringify({ s1: { auditor: 'J', testDate: '2026-09-21' } }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD')); await user.click(await screen.findByText('Site S', { selector: 'div' })); await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ }));
    await user.click(await screen.findByText('Plant')); await user.click(await screen.findByText('MSB')); await screen.findByText('Enclosure Condition');
    chooserOk(document.querySelector('input[type="file"][accept="image/*"]'));
  });
  it('ELT: the fitting photo input', async () => {
    localStorage.setItem('elt-projects-v2', JSON.stringify([{ id: 'p1', name: 'Site E', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Site E', assets: [{ id: 'x1', assetLocation: 'SE Door', assetId: '', type: 'Exit Signs', typeOther: '', maintained: 'Maintained', fitting: '' }] }] }]));
    localStorage.setItem('elt-meta-v1', JSON.stringify({ p1: { auditor: 'J', testDate: '2026-09-21' } }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('EMERGENCY LIGHTING')); await user.click(await screen.findByText('Site E', { selector: 'div' })); await user.click(screen.getByRole('button', { name: 'Audit' }));
    await user.click(await screen.findByText('SE Door')); chooserOk(document.querySelector('input[type="file"][accept="image/*"]'));
  });
});

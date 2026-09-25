// Multi-area round trip through the real UI, both modules: seed a two-area site with results, Complete Audit, Export from History,
// then import that .xlsx into a fresh app — the areas (and the order of assets inside them) must come back.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { WELDER_CHECKLIST } from './App.jsx';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const keys = WELDER_CHECKLIST.map(c => c.key);
const ls = k => JSON.parse(localStorage.getItem(k));
let payload;
beforeEach(() => { localStorage.clear(); payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { cleanup(); delete window.webkit; });

const MODS = [
  { name: 'ELT', pfx: 'elt', card: 'EMERGENCY LIGHTING', complete: /Complete Emergency Lighting Audit/, snap: 'Emergency Lighting Audit', noun: 'fitting',
    asset: (id, n) => ({ id, assetLocation: `Door ${n}`, assetId: `E${n}`, type: 'Emergency Exit Sign', typeOther: '', maintained: 'Maintained', fitting: '' }),
    tested: () => ({ visual: 'pass', discharge: 'pass', switching: 'pass', charging: 'pass' }), key: a => a.assetLocation, fileInput: 'elt-import-file' },
  { name: 'Welder', pfx: 'welder', card: 'WELDER TESTING', complete: /Complete Welder Audit/, snap: 'Welder Audit', noun: 'welder',
    asset: (id, n) => ({ id, assetId: `W${n}`, brand: 'Lincoln Electric', model: 'Invertec', serial: `S${n}` }),
    tested: () => ({ date: '2026-07-13', items: Object.fromEntries(keys.map(k => [k, { result: 'pass', value: '', action: '' }])) }), key: a => a.assetId, fileInput: 'welder-import-file' },
];

describe.each(MODS)('$name: area round trip (export -> import)', m => {
  it('re-imports the same areas, in order, with their assets', async () => {
    const areas = [
      { id: 'area-hearse-road', name: 'Hearse Road Firestone', assets: [m.asset('a1', 1), m.asset('a3', 3)] },
      { id: 'area-workshop', name: 'Workshop', assets: [m.asset('a2', 2), m.asset('a4', 4)] },
    ];
    localStorage.setItem(`${m.pfx}-projects-v2`, JSON.stringify([{ id: 'p1', name: 'Site A - North', company: 'Co', abn: '', licence: '', areas }]));
    localStorage.setItem(`${m.pfx}-meta-v1`, JSON.stringify({ p1: { auditor: 'Jane', testDate: '2026-07-13', nextTestDate: '2026-10-13' } }));
    localStorage.setItem(`${m.pfx}-results-v1`, JSON.stringify({ p1: Object.fromEntries(['a1', 'a2', 'a3', 'a4'].map(id => [id, m.tested()])) }));
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText(m.card));
    await user.click(await screen.findByText('Site A - North', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /^Home$/ }));
    await user.click(await screen.findByRole('button', { name: m.complete }));
    await user.click(screen.getByRole('button', { name: /Yes, Complete/ }));
    await user.click(screen.getByRole('button', { name: /History/ }));
    await user.click(await screen.findByText(m.snap));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(payload).toBeTruthy());
    const bytes = Buffer.from(payload.base64, 'base64');

    cleanup(); localStorage.clear(); payload = null;                                   // brand-new install
    const user2 = userEvent.setup();
    render(<AppRoot />);
    await user2.click(screen.getByText(m.card));
    await user2.click(await screen.findByRole('button', { name: '+ Add / Import Site' }));
    await user2.click(screen.getByRole('button', { name: /Import Excel/ }));
    await user2.upload(screen.getByTestId(m.fileInput), new File([bytes], 'export.xlsx', { type: XLSX_MIME }));
    expect(await screen.findByText(`4 ${m.noun}s in 2 areas`)).toBeInTheDocument();
    expect(screen.getByText(`Hearse Road Firestone — 2 ${m.noun}s`)).toBeInTheDocument();
    expect(screen.getByText(`Workshop — 2 ${m.noun}s`)).toBeInTheDocument();
    await user2.click(screen.getByRole('button', { name: '✓ Import Site' }));
    await waitFor(() => expect(ls(`${m.pfx}-projects-v2`)).toHaveLength(1));
    const p = ls(`${m.pfx}-projects-v2`)[0];
    expect(p.name).toBe('Site A - North');
    expect(p.assets).toBeUndefined();
    expect(p.areas.map(a => [a.name, a.assets.map(m.key)])).toEqual([
      ['Hearse Road Firestone', areas[0].assets.map(m.key)], ['Workshop', areas[1].assets.map(m.key)] ]);   // order inside each area preserved
    expect(p.areas.flatMap(a => a.assets).every(a => a.id && !('location' in a))).toBe(true);
    const r = localStorage.getItem(`${m.pfx}-results-v1`); expect(r === null || r === '{}').toBe(true);      // structure only
  }, 30000);
});

// RELOAD / KILL GUARD for writes that finish AFTER an await (photo pointers, quick-add, History -> Continue).
// Question: is there a window in which the screen already shows the change but storage does not yet hold it (a force-quit / crash there would lose it)?
// MEASURED (2026-10-03, real Chromium with the real photo pipeline for SWB, and jsdom here for all of them): NO. React runs the save effect in the SAME task as
// the commit — localStorage.setItem for the results key is logged ~0.2ms BEFORE the first DOM-mutation callback. So no pagehide / visibilitychange flush and no
// flushSync was added: they would only duplicate a write that has already happened. This file keeps that true: it snapshots localStorage at the very first DOM
// change caused by the update (a MutationObserver callback runs right after the commit and BEFORE any later task) and requires the new value to be there.
// The rule: UI shown => stored. If a future change moves one of these writes behind a timer / transition / deferred value, this fails.
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { sitePhotoStore, sitePhotoIO, gsdPhotoIO } from './App.jsx';
import { GATE_MODS, GATE_SITE_NAMES, seedGateData } from './test/gate-seeds.js';

vi.setConfig({ testTimeout: 30000 });
const ab = n => new Uint8Array(n).buffer;
beforeAll(() => {
  URL.createObjectURL = () => 'blob:probe'; URL.revokeObjectURL = () => {};
  sitePhotoIO.resize = async () => ({ full: { buf: ab(8), type: 'image/jpeg' }, thumb: { buf: ab(4), type: 'image/jpeg' }, w: 10, h: 10 });
  gsdPhotoIO.resize = async () => ({ full: { buf: ab(20), type: 'image/jpeg' }, thumb: { buf: ab(5), type: 'image/jpeg' }, w: 300, h: 400 }); gsdPhotoIO.exportCopy = async () => ({ dataUrl: 'data:image/jpeg;base64,AA==' });
  sitePhotoIO.imageSize = async () => ({ w: 10, h: 10 }); sitePhotoIO.thumbFromDataUrl = async u => u;
});
const clearIdb = () => new Promise(res => { const rq = indexedDB.open('sparkcheck-site-photos', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('photos'); rq.onsuccess = () => { const db = rq.result; const tx = db.transaction('photos', 'readwrite'); tx.objectStore('photos').clear(); tx.oncomplete = () => { db.close(); res(); }; }; });
beforeEach(async () => { cleanup(); localStorage.clear(); await clearIdb(); });
afterEach(() => { cleanup(); globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
const file = () => new File([new Uint8Array(8)], 'p.jpg', { type: 'image/jpeg' });
const tick = ms => new Promise(r => setTimeout(r, ms));

// Returns the storage value at the instant the screen first changed in a way that shows the new photo (the new photo row adds a delete button), and the eventual value.
const count = () => document.querySelectorAll('button').length;
async function probe({ resultsKey, input, imgsBefore, isShown }) {
  let atCommit = null; let done = false;
  const mo = new MutationObserver(() => { if (!done && (isShown ? isShown() : count() > imgsBefore)) { done = true; atCommit = localStorage.getItem(resultsKey); } });
  mo.observe(document.body, { childList: true, subtree: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;                       // let React use its real scheduler (as in the browser) instead of the test act() queue
  fireEvent.change(input, { target: { files: [file()] } });
  await waitFor(() => expect(done).toBe(true), { timeout: 5000 });
  await tick(100);                                                    // let every task run: this is the "eventually stored" value
  const eventually = localStorage.getItem(resultsKey); mo.disconnect();
  return { atCommit, eventually };
}
const hasPointer = v => !!v && /"_photos":\[\{"id"/.test(v);

describe('SWB: a board photo added after the await', () => {
  it('is already STORED when the screen first shows it (UI shown => stored)', async () => {
    localStorage.setItem('swb-projects-v1', JSON.stringify([{ id: 's1', name: 'Site S', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant', boards: [{ id: 'b1', name: 'MSB' }] }] }]));
    localStorage.setItem('swb-meta-v1', JSON.stringify({ s1: { auditor: 'Jane', testDate: '2026-10-01' } }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD')); await user.click(await screen.findByText('Site S', { selector: 'div' })); await user.click(screen.getByRole('button', { name: /Start \/ Continue Audit/ }));
    await user.click(await screen.findByText('Plant')); await user.click(await screen.findByText('MSB')); await screen.findByText('Enclosure Condition');
    const before = count();
    const r = await probe({ resultsKey: 'swb-results-v1', input: document.querySelector('input[type="file"][accept="image/*"]'), imgsBefore: before });
    expect(hasPointer(r.eventually)).toBe(true);                     // it does get stored
    expect(hasPointer(r.atCommit)).toBe(true);                       // ...and it is stored by the time the user can see it
  });
});

const POINTER = /"(photos|_photos)":\[\{"id"/;
const ptr = v => !!v && POINTER.test(v);
describe('ELT / Welder / GSD: the same rule (UI shown => stored)', () => {
  it('ELT: a fitting photo', async () => {
    localStorage.setItem('elt-projects-v2', JSON.stringify([{ id: 'p1', name: 'Site E', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Site E', assets: [{ id: 'x1', assetLocation: 'SE Door', assetId: '', type: 'Exit Signs', typeOther: '', maintained: 'Maintained', fitting: '' }] }] }]));
    localStorage.setItem('elt-meta-v1', JSON.stringify({ p1: { auditor: 'J', testDate: '2026-09-21' } }));
    localStorage.setItem('elt-audit-active-v1', JSON.stringify({ v: 1, sites: { 'p1': {} } }));   // a STARTED audit: the Audit tab is gated now
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('EMERGENCY LIGHTING')); await user.click(await screen.findByText('Site E', { selector: 'div' })); await user.click(screen.getByRole('button', { name: 'Audit' }));
    await user.click(await screen.findByText('SE Door'));
    const r = await probe({ resultsKey: 'elt-results-v1', input: document.querySelector('input[type="file"][accept="image/*"]'), imgsBefore: count() });
    expect(ptr(r.eventually)).toBe(true); expect(ptr(r.atCommit)).toBe(true);
  });
  it('Welder: a welder photo', async () => {
    localStorage.setItem('welder-projects-v2', JSON.stringify([{ id: 'w1', name: 'Site W', company: '', abn: '', licence: '', areas: [{ id: 'ar', name: 'Site W', assets: [{ id: 'a1', assetId: 'W1', brand: 'K', model: 'E', serial: '1' }] }] }]));
    localStorage.setItem('welder-meta-v1', JSON.stringify({ w1: { auditor: 'J', testDate: '2026-09-21' } }));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('WELDER TESTING')); await user.click(await screen.findByText('Site W', { selector: 'div' })); await user.click(screen.getByRole('button', { name: 'Audit' }));
    await user.click(await screen.findByText(/W1/));
    const r = await probe({ resultsKey: 'welder-results-v1', input: await screen.findByTestId('welder-photo-input'), imgsBefore: count() });
    expect(ptr(r.eventually)).toBe(true); expect(ptr(r.atCommit)).toBe(true);
  });
  const gsdSeed = items => { localStorage.setItem('gsd-projects-v1', JSON.stringify([{ id: 's1', name: 'Site G', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'One' }] }])); localStorage.setItem('gsd-meta-v1', JSON.stringify({ s1: { auditor: 'J', testDate: '2026-09-21' } })); if (items) localStorage.setItem('gsd-items-v1', JSON.stringify({ s1: items })); };
  const openGsd = async user => { render(<AppRoot />); await user.click(screen.getByText('GENERAL SITE DEFECTS')); await user.click(await screen.findByText('Site G', { selector: 'div' })); await user.click(screen.getByRole('button', { name: 'Audit' })); };
  it('GSD: photos added to an existing defect', async () => {
    gsdSeed([{ id: 'i1', areaId: 'a1', assetLocation: '', category: '', commonDefect: '', description: 'x', descAuto: '', photos: [], priority: '', responsibility: '', dueDate: '' }]);
    const user = userEvent.setup(); await openGsd(user); await user.click(await screen.findByTestId('gsd-card'));
    const r = await probe({ resultsKey: 'gsd-items-v1', input: await screen.findByTestId('gsd-item-photos'), imgsBefore: count() });
    expect(ptr(r.eventually)).toBe(true); expect(ptr(r.atCommit)).toBe(true);
  });
  it('GSD: quick-add (photos first, the defect is created when they come back)', async () => {
    gsdSeed(null); const user = userEvent.setup(); await openGsd(user);
    await user.click(await screen.findByText(/Add Defect/));                                  // sets the target area (the OS chooser itself does not open in jsdom)
    const r = await probe({ resultsKey: 'gsd-items-v1', input: await screen.findByTestId('gsd-add-photos'), isShown: () => !!screen.queryByText('Duplicate') });   // the new defect's page opens when its photos come back
    expect(ptr(r.eventually)).toBe(true); expect(ptr(r.atCommit)).toBe(true);
  });
});

// History -> Continue is async too (it copies every photo record first). Same rule: when the audit screen has replaced the History screen, storage must
// already hold the continued audit (the copies' new ids), not the replaced one.
async function probeClick({ resultsKey, trigger, isShown }) {
  let atCommit = null; let done = false;
  const mo = new MutationObserver(() => { if (!done && isShown()) { done = true; atCommit = localStorage.getItem(resultsKey); } });
  mo.observe(document.body, { childList: true, subtree: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  await trigger();
  await waitFor(() => expect(done).toBe(true), { timeout: 5000 });
  await tick(100); const eventually = localStorage.getItem(resultsKey); mo.disconnect();
  return { atCommit, eventually };
}
describe('SWB History -> Continue', () => {
  it('the continued audit is already STORED (new photo ids) when the audit screen is shown', async () => {
    const ab2 = n => new Uint8Array(n).buffer;
    await sitePhotoStore.put('snapP', { buf: ab2(8), type: 'image/jpeg' }); await sitePhotoStore.put('snapP~t', { buf: ab2(4), type: 'image/jpeg' });
    await sitePhotoStore.put('liveP', { buf: ab2(8), type: 'image/jpeg' }); await sitePhotoStore.put('liveP~t', { buf: ab2(4), type: 'image/jpeg' });
    localStorage.setItem('swb-projects-v1', JSON.stringify([{ id: 'dixon', name: 'Dixon Quarry Group', company: 'Co', abn: '', licence: '', areas: [{ id: 'area-onr', name: 'ONR Workshop', boards: [{ id: 'b1', name: 'MSB 1' }] }] }]));
    localStorage.setItem('swb-meta-v1', JSON.stringify({ dixon: { auditor: 'Jordan', testDate: '2026-07-13', nextTestDate: '2027-07-13' } }));
    localStorage.setItem('swb-results-v1', JSON.stringify({ dixon: { 'area-onr': { b1: { _photos: [{ id: 'liveP', w: 5, h: 5 }] } } } }));
    localStorage.setItem('swb-history-v1', JSON.stringify([{ id: 'snapA', projectId: 'dixon', projectName: 'Dixon Quarry Group', testDate: '2026-06-01', auditor: 'Jane', archivedAt: '2026-06-01T00:00:00Z', results: { 'area-onr': { b1: { _photos: [{ id: 'snapP', w: 7, h: 7 }] } } }, meta: { auditor: 'Jane', testDate: '2026-06-01' } }]));
    const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD')); await user.click(await screen.findByText('Dixon Quarry Group', { selector: 'div' })); await user.click(screen.getByRole('button', { name: 'History' }));
    await user.click((await screen.findAllByText('Switchboard Audit'))[0].closest('button'));
    await user.click(await screen.findByRole('button', { name: /Continue/ }));
    const yes = await screen.findByRole('button', { name: /Yes, Continue/ });
    const r = await probeClick({ resultsKey: 'swb-results-v1', trigger: async () => { fireEvent.click(yes); }, isShown: () => !!screen.queryByText('ONR Workshop') && !screen.queryByRole('button', { name: /Yes, Continue/ }) && !screen.queryByText('Switchboard Audit') });
    const idOf = v => JSON.parse(v).dixon['area-onr'].b1._photos[0].id;
    expect(idOf(r.eventually)).not.toBe('liveP'); expect(idOf(r.eventually)).not.toBe('snapP');
    expect(idOf(r.atCommit)).toBe(idOf(r.eventually));               // already the continued audit when the screen shows it
  });
});

// Back from the top of Audit arms the gate, and the gate is stored WITH the site's flag entry. A force-quit right after Back must not lose it: at the very first
// screen change (Home appearing) the stored entry must already hold `gate:true` (React runs the save effect in the same task as the commit).
describe.each(GATE_MODS)('$short: Back from the top of Audit stores the gate before the screen shows Home', m => {
  it('storage already holds gate:true when Home first appears', async () => {
    seedGateData(m, 'new'); const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByText(m.tile, { exact: true })); await user.click(await screen.findByText(GATE_SITE_NAMES.sa, { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: /^Audit$/ }));                          // the folders (unarmed)
    const backEl = screen.getAllByText('Back')[0];
    const r = await probeClick({ resultsKey: m.a, trigger: async () => { fireEvent.click(backEl); }, isShown: () => /AUDITOR/.test(document.body.textContent) });
    expect(JSON.parse(r.atCommit).sites.sa.gate).toBe(true);                                    // stored by the time Home is on screen
    expect(JSON.parse(r.eventually).sites.sa.gate).toBe(true);
  });
});

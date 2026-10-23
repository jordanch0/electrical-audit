// THE PHOTO-MIGRATION PROOF STAYS TIED TO A REAL HAND-OVER (release t). FICTIONAL data. After the photo migration (Switchboard, Emergency Lighting, Welder) the app keeps a pre-migration copy of the results; an export that
// EMBEDS a migrated photo is the proof that the photos read back, and confirmPhotoMigrationVerified then DELETES that copy. So it must run only when the file really left the app: the bridge posted, the download started,
// or the share sheet resolved (or the refusal fallback download started). A file that is only built and held, a closed sheet, Discard, and a failing download must leave the copy where it is. A direct call of the export
// function with no handler behaves as in release s (deliver, then verify).
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, waitFor, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { sitePhotoStore, sitePhotoIO, exportSWBExcel, exportELTExcel, exportWelderExcel } from './App.jsx';
import { JPEG_A } from './test/jpeg-fixtures.js';
import { phoneOn, phoneOff, downloadsOn, abortError, named } from './test/share-env.js';

vi.setConfig({ testTimeout: 30000 });
configure({ asyncUtilTimeout: 8000 });
const ab = n => new Uint8Array(n).buffer;
const idbClear = () => new Promise(res => { const rq = indexedDB.open('sparkcheck-site-photos', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('photos'); rq.onsuccess = () => { const db = rq.result; const t = db.transaction('photos', 'readwrite'); t.objectStore('photos').clear(); t.oncomplete = () => { db.close(); res(); }; }; rq.onerror = () => res(); });
const seedPhoto = async id => { await sitePhotoStore.put(id, { buf: ab(8), type: 'image/jpeg' }); await sitePhotoStore.put(id + '~t', { buf: ab(4), type: 'image/jpeg' }); };
const meta = { auditor: 'Jordan', testDate: '2026-07-13', nextTestDate: '2027-07-13' };
const CASES = [
  { key: 'swb', tile: 'SWITCHBOARD', card: 'Switchboard Audit', hist: 'swb-history-v1', proj: 'swb-projects-v1', metaKey: 'swb-meta-v1', pre: 'swb-results-preMigration-v1', done: 'swb-photos-migrated-v1', direct: exportSWBExcel, withAreas: false,
    site: { id: 'dixon', name: 'Dixon Quarry Group', company: 'Co', abn: '', licence: '', areas: [{ id: 'area-onr', name: 'ONR Workshop', boards: [{ id: 'b1', name: 'MSB 1' }] }] },
    results: { 'area-onr': { b1: { _photos: [{ id: 'exportp', w: 4, h: 3 }] } } }, preVal: { dixon: { 'area-onr': { b1: { _photos: [{ id: 'exportp', dataUrl: 'x' }] } } } } },
  { key: 'elt', tile: 'EMERGENCY LIGHTING', card: 'Emergency Lighting Audit', hist: 'elt-history-v2', proj: 'elt-projects-v2', metaKey: 'elt-meta-v1', pre: 'elt-results-preMigration-v1', done: 'elt-photos-migrated-v1', direct: exportELTExcel, withAreas: true,
    site: { id: 'dixon', name: 'Dixon Quarry Group', company: 'Co', abn: '', licence: '', areas: [{ id: 'area-onr', name: 'ONR Workshop', assets: [{ id: 'a1', assetLocation: 'SE Door', assetId: '', type: 'Emergency Exit Sign', maintained: 'Maintained', fitting: 'X' }] }] },
    results: { a1: { photos: [{ id: 'exportp', w: 4, h: 3 }] } }, preVal: { dixon: { a1: { photos: [{ id: 'exportp', dataUrl: 'x' }] } } } },
  { key: 'welder', tile: 'WELDER TESTING', card: 'Welder Audit', hist: 'welder-history-v2', proj: 'welder-projects-v2', metaKey: 'welder-meta-v1', pre: 'welder-results-preMigration-v1', done: 'welder-photos-migrated-v1', direct: exportWelderExcel, withAreas: true,
    site: { id: 'dixon', name: 'Dixon Quarry Group', company: 'Co', abn: '', licence: '', areas: [{ id: 'area-onr', name: 'ONR Workshop', assets: [{ id: 'a1', assetId: 'W001', brand: 'Kemppi', model: 'Evo', serial: '1' }] }] },
    results: { a1: { items: {}, photos: [{ id: 'exportp', w: 4, h: 3 }] } }, preVal: { dixon: { a1: { items: {}, photos: [{ id: 'exportp', dataUrl: 'x' }] } } } },
];
let origExportCopy, origSize, origThumb, share, d;
beforeAll(() => { origSize = sitePhotoIO.imageSize; origThumb = sitePhotoIO.thumbFromDataUrl; sitePhotoIO.imageSize = async () => ({ w: 10, h: 10 }); sitePhotoIO.thumbFromDataUrl = async url => url; });
beforeEach(async () => { cleanup(); localStorage.clear(); await idbClear(); vi.spyOn(console, 'warn').mockImplementation(() => {}); origExportCopy = sitePhotoIO.exportCopy; sitePhotoIO.exportCopy = async () => ({ dataUrl: JPEG_A }); share = phoneOn({ share: vi.fn(async () => {}) }); d = downloadsOn(); });
afterEach(() => { cleanup(); sitePhotoIO.exportCopy = origExportCopy; vi.restoreAllMocks(); phoneOff(); });
const histEntry = c => ({ id: 'snapA', projectId: 'dixon', projectName: 'Dixon Quarry Group', testDate: '2026-06-01', auditor: 'J', archivedAt: '2026-06-01T00:00:00Z', results: c.results, ...(c.withAreas ? { areas: c.site.areas } : {}), meta });
async function seedAndOpen(c) {
  await seedPhoto('exportp');
  localStorage.setItem(c.proj, JSON.stringify([c.site])); localStorage.setItem(c.metaKey, JSON.stringify({ dixon: meta })); localStorage.setItem(c.hist, JSON.stringify([histEntry(c)]));
  localStorage.setItem(c.pre, JSON.stringify(c.preVal)); localStorage.setItem(c.done, JSON.stringify(new Date().toISOString()));
  const user = userEvent.setup(); render(<AppRoot />); await user.click(screen.getByText(c.tile)); await user.click(await screen.findByText('Dixon Quarry Group', { selector: 'div' })); await user.click(screen.getByRole('button', { name: 'History' }));
  await user.click((await screen.findAllByText(c.card))[0].closest('button')); return user;
}
const kept = c => localStorage.getItem(c.pre) !== null;

describe.each(CASES)('$key', c => {
  it('built but not shared: the held file leaves the pre-migration copy where it is', async () => {
    const user = await seedAndOpen(c); await user.click(await screen.findByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready');
    await new Promise(r => setTimeout(r, 150)); expect(kept(c)).toBe(true); expect(share).not.toHaveBeenCalled();
  });
  it('a closed sheet keeps the copy; Share file again (resolved) removes it', async () => {
    share.mockRejectedValueOnce(abortError()); const user = await seedAndOpen(c); await user.click(await screen.findByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready'); await user.click(screen.getByTestId('export-share'));
    await waitFor(() => expect(screen.getByTestId('export-ready').textContent).toMatch(/^The share sheet was closed/)); expect(kept(c)).toBe(true);
    await user.click(screen.getByTestId('export-share')); await screen.findByTestId('export-shared'); expect(kept(c)).toBe(false);
  });
  it('Discard keeps the copy', async () => {
    const user = await seedAndOpen(c); await user.click(await screen.findByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready'); await user.click(screen.getByTestId('export-discard'));
    await new Promise(r => setTimeout(r, 100)); expect(kept(c)).toBe(true);
  });
  it('the share sheet resolved: the copy is removed (the proof ran after a real hand-over)', async () => {
    const user = await seedAndOpen(c); await user.click(await screen.findByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready'); expect(kept(c)).toBe(true);
    await user.click(screen.getByTestId('export-share')); await screen.findByTestId('export-shared'); expect(kept(c)).toBe(false); expect(d.created).toEqual([]);
  });
  it('a refused sheet and the fallback download started: the copy is removed', async () => {
    share.mockRejectedValueOnce(named('NotAllowedError')); const user = await seedAndOpen(c); await user.click(await screen.findByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready'); expect(kept(c)).toBe(true);
    await user.click(screen.getByTestId('export-share')); await screen.findByTestId('export-downloaded'); expect(d.clicks).toHaveLength(1); expect(kept(c)).toBe(false);
  });
  it('a refused sheet and a download that FAILS: the copy is kept and the failure card shows', async () => {
    cleanup(); vi.restoreAllMocks(); vi.spyOn(console, 'warn').mockImplementation(() => {}); d = downloadsOn({ failClick: true }); share.mockRejectedValue(named('NotAllowedError'));
    const user = await seedAndOpen(c); await user.click(await screen.findByRole('button', { name: 'Export' })); await screen.findByTestId('export-ready'); await user.click(screen.getByTestId('export-share'));
    expect((await screen.findByTestId('export-failed')).textContent).toMatch(/could not be saved/); expect(kept(c)).toBe(true);
  });
  it('a desktop (one-tap download) removes the copy once the download started, as in release s', async () => {
    phoneOn({ touch: 0, coarse: false }); const user = await seedAndOpen(c); await user.click(await screen.findByRole('button', { name: 'Export' })); await waitFor(() => expect(d.clicks).toHaveLength(1)); expect(kept(c)).toBe(false);
  });
  it('the native bridge removes the copy once it has posted, as in release s', async () => {
    const post = vi.fn(); window.webkit = { messageHandlers: { shareFile: { postMessage: post } } }; const user = await seedAndOpen(c); await user.click(await screen.findByRole('button', { name: 'Export' })); await waitFor(() => expect(post).toHaveBeenCalledTimes(1)); expect(kept(c)).toBe(false); expect(share).not.toHaveBeenCalled();
  });
  it('the export function called directly with NO handler delivers to the bridge and then verifies, exactly as in release s', async () => {
    await seedPhoto('exportp'); localStorage.setItem(c.pre, JSON.stringify(c.preVal)); const post = vi.fn(); window.webkit = { messageHandlers: { shareFile: { postMessage: post } } };
    await c.direct({ ...c.site }, { dixon: c.results }, meta); expect(post).toHaveBeenCalledTimes(1); expect(post.mock.calls[0][0].filename).toMatch(/\.xlsx$/); expect(kept(c)).toBe(false);
  });
  it('the export function called directly with a handler hands the file to the handler and does NOT verify until the handler says the file left', async () => {
    await seedPhoto('exportp'); localStorage.setItem(c.pre, JSON.stringify(c.preVal)); const handOver = vi.fn(); const post = vi.fn(); window.webkit = { messageHandlers: { shareFile: { postMessage: post } } };
    await c.direct({ ...c.site }, { dixon: c.results }, meta, handOver);
    expect(handOver).toHaveBeenCalledTimes(1); const [b64, name, done] = handOver.mock.calls[0]; expect(b64.length).toBeGreaterThan(100); expect(name).toMatch(/\.xlsx$/); expect(typeof done).toBe('function'); expect(post).not.toHaveBeenCalled(); expect(kept(c)).toBe(true);
    done(); expect(kept(c)).toBe(false);
  });
});

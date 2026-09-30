// SWB/ELT/Welder photo storage migration, Stage 3: ELT wired to the Stage 1 shared infrastructure. ELT's per-asset results
// shape (results[assetId] = {...,photos:[]}) is identical to Welder's, confirmed by reading eltGetRes/welderGetRes side by
// side before writing this — so this file reuses copySitePhotosForContinue/assetPhotoList/assetResultsExtractPhotos as-is,
// no ELT-specific variant needed. Otherwise a close mirror of welder-photo-migration.test.jsx (Stage 2), covering the same
// ownership rules: migration-on-load, Complete Audit transfers (doesn't free), Reset frees, delete history/site/area free
// exactly what they own, and Continue copies to new ids without ever aliasing the archived snapshot.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { sitePhotoStore, sitePhotoIO } from './App.jsx';
import { JPEG_A } from './test/jpeg-fixtures.js';

const ls = k => JSON.parse(localStorage.getItem(k));
const ab = n => new Uint8Array(n).buffer;
beforeAll(() => {
  URL.createObjectURL = () => 'blob:elt-photo-test'; URL.revokeObjectURL = () => {};
  // jsdom has no real image decoder — a data: URL Image never fires onload/onerror, hanging migrateSitePhotos forever.
  sitePhotoIO.imageSize = async () => ({ w: 10, h: 10 });
  sitePhotoIO.thumbFromDataUrl = async url => url;
});
afterEach(() => cleanup());
const idbKeys = () => new Promise((res, rej) => { const rq = indexedDB.open('sparkcheck-site-photos', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('photos'); rq.onsuccess = () => { const db = rq.result; const q = db.transaction('photos').objectStore('photos').getAllKeys(); q.onsuccess = () => { db.close(); res(q.result.map(String).sort()); }; q.onerror = () => rej(q.error); }; rq.onerror = () => rej(rq.error); });
const clearIdb = () => new Promise(res => { const rq = indexedDB.open('sparkcheck-site-photos', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('photos'); rq.onsuccess = () => { const db = rq.result; const t = db.transaction('photos', 'readwrite'); t.objectStore('photos').clear(); t.oncomplete = () => { db.close(); res(); }; }; rq.onerror = () => res(); });
beforeEach(async () => { cleanup(); localStorage.clear(); await clearIdb(); });

const site = { id: 'dixon', name: 'Dixon Quarry Group', company: 'Co', abn: '', licence: '', areas: [
  { id: 'area-onr', name: 'ONR Workshop', assets: [
    { id: 'a1', assetLocation: 'SE Door', assetId: '', type: 'Emergency Exit Sign', maintained: 'Maintained', fitting: 'X' },
    { id: 'a2', assetLocation: 'SW Roof', assetId: '', type: 'Emergency Exit Sign', maintained: 'Maintained', fitting: 'Y' },
  ] } ] };
const meta = { auditor: 'Jordan', testDate: '2026-07-13', nextTestDate: '2027-01-13' };
const seedPhoto = async id => { await sitePhotoStore.put(id, { buf: ab(8), type: 'image/jpeg' }); await sitePhotoStore.put(id + '~t', { buf: ab(4), type: 'image/jpeg' }); };
const seed = (results, extra) => {
  localStorage.setItem('elt-projects-v2', JSON.stringify([site]));
  localStorage.setItem('elt-meta-v1', JSON.stringify({ dixon: meta }));
  if (results) localStorage.setItem('elt-results-v1', JSON.stringify({ dixon: results }));
  Object.entries(extra || {}).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
};
async function open(user, tab) {
  render(<AppRoot />);
  await user.click(screen.getByText('EMERGENCY LIGHTING'));
  await user.click(await screen.findByText('Dixon Quarry Group', { selector: 'div' }));
  if (tab) await user.click(screen.getByRole('button', { name: tab }));
}
// Expands the (only, in these tests) history card so its Export/Continue/Delete row becomes visible.
const expandHistoryCard = async user => user.click((await screen.findAllByText('Emergency Lighting Audit'))[0].closest('button'));

describe('Migration: a legacy inline-photo ELT site is moved into sitePhotoStore on load', () => {
  it('rewrites elt-results-v1 to {id,w,h} pointers, moves the bytes into sitePhotoStore, and keeps a pre-migration backup', async () => {
    const url = `data:image/jpeg;base64,${btoa('legacyphotobytes')}`;
    seed({ a1: { photos: [{ id: 'old1', dataUrl: url }] } });
    const user = userEvent.setup(); await open(user);
    await waitFor(() => expect(localStorage.getItem('elt-photos-migrated-v1')).toBeTruthy());
    const migrated = ls('elt-results-v1').dixon.a1.photos[0];
    expect(migrated.dataUrl).toBeUndefined(); expect(migrated.id).toBeTruthy();
    const stored = await sitePhotoStore.get(migrated.id);
    expect(new Uint8Array(stored.buf)).toEqual(Uint8Array.from('legacyphotobytes', c => c.charCodeAt(0)));
    expect(ls('elt-results-preMigration-v1').dixon.a1.photos[0].dataUrl).toBe(url);   // the original is kept as a backup, untouched
  });
});

describe('Complete Audit transfers ownership (does NOT free); Reset frees', () => {
  it('Complete Audit: the photo survives in the archived snapshot; the live audit is cleared', async () => {
    await seedPhoto('p1');
    seed({ a1: { photos: [{ id: 'p1', w: 10, h: 10 }] } });
    const user = userEvent.setup(); await open(user);
    await user.click(await screen.findByRole('button', { name: /Complete Emergency Lighting Audit/ }));
    await user.click(screen.getByRole('button', { name: /Yes, Complete/ }));
    await waitFor(() => expect(ls('elt-history-v2')).toHaveLength(1));
    expect(ls('elt-results-v1').dixon).toEqual({});                                        // live cleared
    expect(ls('elt-history-v2')[0].results.a1.photos[0].id).toBe('p1');                    // snapshot references the SAME id
    expect(await sitePhotoStore.get('p1')).toBeTruthy();                                   // never freed — the snapshot owns it now
    expect(await sitePhotoStore.get('p1~t')).toBeTruthy();
  });
  it('Reset: the photo is freed — nothing will reference it afterward', async () => {
    await seedPhoto('p2');
    seed({ a1: { photos: [{ id: 'p2', w: 10, h: 10 }] } });
    const user = userEvent.setup(); await open(user);
    await user.click(await screen.findByRole('button', { name: 'Reset all test results' }));
    await user.click(await screen.findByText('Reset all results?'));
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(ls('elt-results-v1').dixon).toEqual({}));
    expect(await sitePhotoStore.get('p2')).toBeUndefined();
    expect(await sitePhotoStore.get('p2~t')).toBeUndefined();
  });
});

describe('Delete history snapshot / delete site free exactly what they own', () => {
  it('deleting one history snapshot frees only that snapshot\'s photos', async () => {
    await seedPhoto('h1p'); await seedPhoto('h2p');
    seed(null, { 'elt-history-v2': [
      { id: 'snapA', projectId: 'dixon', projectName: 'Dixon Quarry Group', testDate: '2026-06-01', auditor: 'J', archivedAt: '2026-06-01T00:00:00Z', results: { a1: { photos: [{ id: 'h1p', w: 1, h: 1 }] } }, areas: site.areas, meta },
      { id: 'snapB', projectId: 'dixon', projectName: 'Dixon Quarry Group', testDate: '2026-07-01', auditor: 'J', archivedAt: '2026-07-01T00:00:00Z', results: { a1: { photos: [{ id: 'h2p', w: 1, h: 1 }] } }, areas: site.areas, meta },
    ] });
    const user = userEvent.setup(); await open(user, 'History');
    const cards = await screen.findAllByText('Emergency Lighting Audit');
    // snapshots render newest-first; expand the OLDER one (archived 2026-06-01) specifically, by its own toggle button
    const toggle = cards.map(c => c.closest('button')).find(b => b.textContent.includes('01/06/2026'));
    await user.click(toggle);
    const bins = screen.getAllByRole('button').filter(b => b.textContent === '' && b.querySelector('svg') && !b.getAttribute('aria-label'));
    await user.click(bins[bins.length - 1]);
    await user.click(await screen.findByRole('button', { name: /Delete$/ }));
    await waitFor(() => expect(ls('elt-history-v2')).toHaveLength(1));
    expect(await sitePhotoStore.get('h1p')).toBeUndefined();   // the deleted snapshot's photo is gone
    expect(await sitePhotoStore.get('h2p')).toBeTruthy();      // the OTHER snapshot's photo is untouched
  });

  it('deleting the whole site frees the live audit\'s photos AND every one of its history snapshots\' photos', async () => {
    await seedPhoto('livep'); await seedPhoto('histp');
    seed({ a1: { photos: [{ id: 'livep', w: 1, h: 1 }] } }, { 'elt-history-v2': [
      { id: 'snapA', projectId: 'dixon', projectName: 'Dixon Quarry Group', testDate: '2026-06-01', auditor: 'J', archivedAt: '2026-06-01T00:00:00Z', results: { a1: { photos: [{ id: 'histp', w: 1, h: 1 }] } }, areas: site.areas, meta },
    ] });
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('EMERGENCY LIGHTING'));
    const bins = screen.getAllByRole('button').filter(b => b.textContent === '' && b.querySelector('svg') && !b.getAttribute('aria-label'));
    await user.click(bins[bins.length - 1]);
    await user.click(await screen.findByRole('button', { name: /Delete$/ }));
    await waitFor(() => expect(ls('elt-projects-v2')).toEqual([]));
    expect(await sitePhotoStore.get('livep')).toBeUndefined();
    expect(await sitePhotoStore.get('histp')).toBeUndefined();
  });
});

describe('Manage: deleting an area frees its assets\' photos', () => {
  it('"Delete area" removes the area and frees every asset it contained', async () => {
    await seedPhoto('areap');
    seed({ a1: { photos: [{ id: 'areap', w: 1, h: 1 }] } });
    const user = userEvent.setup(); await open(user, 'Manage');
    await user.click(within(screen.getByRole('group', { name: 'Delete area ONR Workshop' })).getByRole('button'));
    await user.click(await screen.findByRole('button', { name: /Delete$/ }));
    await waitFor(() => expect(ls('elt-projects-v2')[0].areas).toEqual([]));
    expect(await sitePhotoStore.get('areap')).toBeUndefined();
  });
});

describe('Continue: copies to NEW ids, never aliases the archived snapshot\'s photos', () => {
  async function seedContinue() {
    await seedPhoto('snapP'); await seedPhoto('liveP');
    seed({ a1: { photos: [{ id: 'liveP', w: 5, h: 5 }] } }, { 'elt-history-v2': [
      { id: 'snapA', projectId: 'dixon', projectName: 'Dixon Quarry Group', testDate: '2026-06-01', auditor: 'Jane', archivedAt: '2026-06-01T00:00:00Z', results: { a1: { photos: [{ id: 'snapP', w: 7, h: 7 }] } }, areas: site.areas, meta: { auditor: 'Jane', testDate: '2026-06-01' } },
    ] });
  }
  it('Continue replaces the live audit with a COPY (new id, same bytes/size); the archived snapshot is untouched', async () => {
    await seedContinue();
    const before = await sitePhotoStore.get('snapP');
    const user = userEvent.setup(); await open(user, 'History');
    await expandHistoryCard(user);
    await user.click(await screen.findByRole('button', { name: /Continue/ }));
    await user.click(await screen.findByRole('button', { name: /Yes, Continue/ }));
    await waitFor(() => expect(ls('elt-results-v1').dixon.a1.photos[0].id).not.toBe('snapP'));
    const live = ls('elt-results-v1').dixon.a1.photos[0];
    expect(live.id).not.toBe('snapP'); expect([live.w, live.h]).toEqual([7, 7]);            // size carried over
    const copy = await sitePhotoStore.get(live.id);
    expect(new Uint8Array(copy.buf)).toEqual(new Uint8Array(before.buf)); expect(copy.type).toBe(before.type);  // same bytes
    expect(await sitePhotoStore.get(live.id + '~t')).toBeTruthy();                          // thumbnail copied too
    expect(ls('elt-history-v2')[0].results.a1.photos[0].id).toBe('snapP');                  // the snapshot itself is untouched
    expect(await sitePhotoStore.get('snapP')).toBeTruthy();
  });
  it('OWNERSHIP INDEPENDENCE: resetting the continued (copied) live audit does NOT touch the archived snapshot\'s photo', async () => {
    await seedContinue();
    const user = userEvent.setup(); await open(user, 'History');
    await expandHistoryCard(user);
    await user.click(await screen.findByRole('button', { name: /Continue/ }));
    await user.click(await screen.findByRole('button', { name: /Yes, Continue/ }));
    await waitFor(() => expect(ls('elt-results-v1').dixon.a1.photos[0].id).not.toBe('snapP'));
    await user.click(screen.getByRole('button', { name: /^Home$/ }));
    await user.click(await screen.findByRole('button', { name: 'Reset all test results' }));
    await user.click(await screen.findByText('Reset all results?'));
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(ls('elt-results-v1').dixon).toEqual({}));
    expect(await sitePhotoStore.get('snapP')).toBeTruthy();                                 // the snapshot's own photo survives — it was never shared
  });
});

describe('Export: embeds a resolved photo and confirms the migration (removes the pre-migration backup)', () => {
  it('exporting a history snapshot that embeds a real migrated photo removes the pre-migration backup keys', async () => {
    await seedPhoto('exportp');
    const origExportCopy = sitePhotoIO.exportCopy;
    sitePhotoIO.exportCopy = async () => ({ dataUrl: JPEG_A });
    seed(null, {
      'elt-history-v2': [{ id: 'snapA', projectId: 'dixon', projectName: 'Dixon Quarry Group', testDate: '2026-06-01', auditor: 'J', archivedAt: '2026-06-01T00:00:00Z', results: { a1: { photos: [{ id: 'exportp', w: 4, h: 3 }] } }, areas: site.areas, meta }],
      'elt-results-preMigration-v1': { dixon: { a1: { photos: [{ id: 'exportp', dataUrl: 'x' }] } } },
      'elt-photos-migrated-v1': new Date().toISOString(),
    });
    let payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } };
    try {
      const user = userEvent.setup(); await open(user, 'History');
      await expandHistoryCard(user);
      await user.click(await screen.findByRole('button', { name: 'Export' }));
      await waitFor(() => expect(payload).toBeTruthy());
      expect(localStorage.getItem('elt-results-preMigration-v1')).toBeNull();   // a real export that embedded a migrated photo IS the verifying proof
    } finally { delete window.webkit; sitePhotoIO.exportCopy = origExportCopy; }
  });
});

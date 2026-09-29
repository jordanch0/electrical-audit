// SWB/ELT/Welder photo storage migration, Stage 4: SWB wired to the Stage 1 shared infrastructure — the most involved stage,
// per the approved plan: SWB's results are THREE levels deep (project -> area -> board), board-level photos live under a
// reserved `_photos` key with legacy stray `item.photos` also possible (swbGetBoardPhotos already normalises both), Reset
// Board previously silently dropped its own photos when replacing the board object, and Manage's board/area delete had NO
// results/photo cleanup at all (a pre-existing, accepted gap for inline data — a real permanent leak once photos live in
// IndexedDB) — fixed here as agreed. Otherwise mirrors elt-photo-migration.test.jsx/welder-photo-migration.test.jsx: the same
// ownership rules (migration-on-load, Complete Audit transfers, Reset frees, Continue copies to new ids, delete
// history/site/area/board each free exactly what they own).
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { sitePhotoStore, sitePhotoIO } from './App.jsx';
import { JPEG_A } from './test/jpeg-fixtures.js';

const ls = k => JSON.parse(localStorage.getItem(k));
const ab = n => new Uint8Array(n).buffer;
beforeAll(() => {
  URL.createObjectURL = () => 'blob:swb-photo-test'; URL.revokeObjectURL = () => {};
  // jsdom has no real image decoder — a data: URL Image never fires onload/onerror, hanging migrateSitePhotos forever.
  sitePhotoIO.imageSize = async () => ({ w: 10, h: 10 });
  sitePhotoIO.thumbFromDataUrl = async url => url;
});
afterEach(() => cleanup());
const idbKeys = () => new Promise((res, rej) => { const rq = indexedDB.open('sparkcheck-site-photos', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('photos'); rq.onsuccess = () => { const db = rq.result; const q = db.transaction('photos').objectStore('photos').getAllKeys(); q.onsuccess = () => { db.close(); res(q.result.map(String).sort()); }; q.onerror = () => rej(q.error); }; rq.onerror = () => rej(rq.error); });
const clearIdb = () => new Promise(res => { const rq = indexedDB.open('sparkcheck-site-photos', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('photos'); rq.onsuccess = () => { const db = rq.result; const t = db.transaction('photos', 'readwrite'); t.objectStore('photos').clear(); t.oncomplete = () => { db.close(); res(); }; }; rq.onerror = () => res(); });
beforeEach(async () => { cleanup(); localStorage.clear(); await clearIdb(); });

const site = { id: 'dixon', name: 'Dixon Quarry Group', company: 'Co', abn: '', licence: '', areas: [
  { id: 'area-onr', name: 'ONR Workshop', boards: [{ id: 'b1', name: 'MSB 1' }, { id: 'b2', name: 'MSB 2' }] } ] };
const meta = { auditor: 'Jordan', testDate: '2026-07-13', nextTestDate: '2027-07-13' };
const seedPhoto = async id => { await sitePhotoStore.put(id, { buf: ab(8), type: 'image/jpeg' }); await sitePhotoStore.put(id + '~t', { buf: ab(4), type: 'image/jpeg' }); };
const seed = (results, extra) => {
  localStorage.setItem('swb-projects-v1', JSON.stringify([site]));
  localStorage.setItem('swb-meta-v1', JSON.stringify({ dixon: meta }));
  if (results) localStorage.setItem('swb-results-v1', JSON.stringify({ dixon: results }));
  Object.entries(extra || {}).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
};
async function open(user, tab) {
  render(<AppRoot />);
  await user.click(screen.getByText('SWITCHBOARD'));
  await user.click(await screen.findByText('Dixon Quarry Group', { selector: 'div' }));
  if (tab) await user.click(screen.getByRole('button', { name: tab }));
}
// Expands the (only, in these tests) history card so its Export/Continue/Delete row becomes visible.
const expandHistoryCard = async user => user.click((await screen.findAllByText('Switchboard Audit'))[0].closest('button'));
const bins = () => screen.getAllByRole('button').filter(b => b.textContent === '' && b.querySelector('svg') && !b.getAttribute('aria-label'));

describe('Migration: a legacy inline-photo SWB site is moved into sitePhotoStore on load', () => {
  it('rewrites swb-results-v1 to {id,w,h} pointers, moves the bytes into sitePhotoStore, and keeps a pre-migration backup', async () => {
    const url = `data:image/jpeg;base64,${btoa('legacyphotobytes')}`;
    seed({ 'area-onr': { b1: { _photos: [{ id: 'old1', dataUrl: url }] } } });
    const user = userEvent.setup(); await open(user);
    await waitFor(() => expect(localStorage.getItem('swb-photos-migrated-v1')).toBeTruthy());
    const migrated = ls('swb-results-v1').dixon['area-onr'].b1._photos[0];
    expect(migrated.dataUrl).toBeUndefined(); expect(migrated.id).toBeTruthy();
    const stored = await sitePhotoStore.get(migrated.id);
    expect(new Uint8Array(stored.buf)).toEqual(Uint8Array.from('legacyphotobytes', c => c.charCodeAt(0)));
    expect(ls('swb-results-preMigration-v1').dixon['area-onr'].b1._photos[0].dataUrl).toBe(url);   // the original is kept as a backup, untouched
  });

  it('also migrates legacy stray item.photos, not just board-level _photos', async () => {
    const url = `data:image/jpeg;base64,${btoa('strayphoto')}`;
    seed({ 'area-onr': { b1: { enclosure: { status: 'pass', photos: [{ id: 'stray1', dataUrl: url }] } } } });
    const user = userEvent.setup(); await open(user);
    await waitFor(() => expect(localStorage.getItem('swb-photos-migrated-v1')).toBeTruthy());
    const migrated = ls('swb-results-v1').dixon['area-onr'].b1.enclosure.photos[0];
    expect(migrated.dataUrl).toBeUndefined(); expect(migrated.id).toBeTruthy();
    expect(await sitePhotoStore.get(migrated.id)).toBeTruthy();
  });
});

describe('Complete Audit transfers ownership (does NOT free); Reset (site) frees; Reset Board frees', () => {
  it('Complete Audit: the photo survives in the archived snapshot; the live audit is cleared', async () => {
    await seedPhoto('p1');
    seed({ 'area-onr': { b1: { _photos: [{ id: 'p1', w: 10, h: 10 }] } } });
    const user = userEvent.setup(); await open(user);
    // "Complete Switchboard Audit" only appears once an audit is actively entered (auditEntered) — a photo alone doesn't
    // trip SWBApp's own "results exist" heuristic on site-select, so enter the audit explicitly first, then come back.
    await user.click(await screen.findByRole('button', { name: /Start \/ Continue Audit/ }));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(await screen.findByRole('button', { name: /Complete Switchboard Audit/ }));
    await user.click(screen.getByRole('button', { name: /Yes, Complete/ }));
    await waitFor(() => expect(ls('swb-history-v1')).toHaveLength(1));
    expect(ls('swb-results-v1').dixon).toEqual({});                                              // live cleared
    expect(ls('swb-history-v1')[0].results['area-onr'].b1._photos[0].id).toBe('p1');              // snapshot references the SAME id
    expect(await sitePhotoStore.get('p1')).toBeTruthy();                                          // never freed — the snapshot owns it now
    expect(await sitePhotoStore.get('p1~t')).toBeTruthy();
  });
  it('Reset (site-level): the photo is freed — nothing will reference it afterward', async () => {
    await seedPhoto('p2');
    seed({ 'area-onr': { b1: { _photos: [{ id: 'p2', w: 10, h: 10 }] } } });
    const user = userEvent.setup(); await open(user);
    await user.click(await screen.findByRole('button', { name: 'Reset all test results' }));
    await user.click(await screen.findByText('Reset all results?'));
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(ls('swb-results-v1').dixon).toEqual({}));
    expect(await sitePhotoStore.get('p2')).toBeUndefined();
    expect(await sitePhotoStore.get('p2~t')).toBeUndefined();
  });
  it('Reset Board: frees only that board\'s photos, leaving the other board\'s photos untouched (the previously-silent drop, now fixed)', async () => {
    await seedPhoto('b1p'); await seedPhoto('b2p');
    seed({ 'area-onr': { b1: { enclosure: { status: 'pass' }, _photos: [{ id: 'b1p', w: 10, h: 10 }] }, b2: { _photos: [{ id: 'b2p', w: 10, h: 10 }] } } });
    const user = userEvent.setup(); await open(user);
    await user.click(await screen.findByRole('button', { name: /Start \/ Continue Audit/ }));
    await user.click(await screen.findByText('ONR Workshop'));
    await user.click(await screen.findByText('MSB 1'));
    await user.click(await screen.findByText('Reset board results'));
    await user.click(await screen.findByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(ls('swb-results-v1').dixon['area-onr'].b1._photos).toBeUndefined());
    expect(await sitePhotoStore.get('b1p')).toBeUndefined();   // this board's photo is freed
    expect(await sitePhotoStore.get('b2p')).toBeTruthy();      // the OTHER board's photo is untouched
  });
});

describe('Delete history snapshot / delete site free exactly what they own', () => {
  it('deleting one history snapshot frees only that snapshot\'s photos', async () => {
    await seedPhoto('h1p'); await seedPhoto('h2p');
    seed(null, { 'swb-history-v1': [
      { id: 'snapA', projectId: 'dixon', projectName: 'Dixon Quarry Group', testDate: '2026-06-01', auditor: 'J', archivedAt: '2026-06-01T00:00:00Z', results: { 'area-onr': { b1: { _photos: [{ id: 'h1p', w: 1, h: 1 }] } } }, meta },
      { id: 'snapB', projectId: 'dixon', projectName: 'Dixon Quarry Group', testDate: '2026-07-01', auditor: 'J', archivedAt: '2026-07-01T00:00:00Z', results: { 'area-onr': { b1: { _photos: [{ id: 'h2p', w: 1, h: 1 }] } } }, meta },
    ] });
    const user = userEvent.setup(); await open(user, 'History');
    const cards = await screen.findAllByText('Switchboard Audit');
    // snapshots render newest-first; expand the OLDER one (archived 2026-06-01) specifically, by its own toggle button
    const toggle = cards.map(c => c.closest('button')).find(b => b.textContent.includes('01/06/2026'));
    await user.click(toggle);
    const bs = bins();
    await user.click(bs[bs.length - 1]);
    await user.click(await screen.findByRole('button', { name: /Delete$/ }));
    await waitFor(() => expect(ls('swb-history-v1')).toHaveLength(1));
    expect(await sitePhotoStore.get('h1p')).toBeUndefined();   // the deleted snapshot's photo is gone
    expect(await sitePhotoStore.get('h2p')).toBeTruthy();      // the OTHER snapshot's photo is untouched
  });

  it('deleting the whole site frees the live audit\'s photos AND every one of its history snapshots\' photos', async () => {
    await seedPhoto('livep'); await seedPhoto('histp');
    seed({ 'area-onr': { b1: { _photos: [{ id: 'livep', w: 1, h: 1 }] } } }, { 'swb-history-v1': [
      { id: 'snapA', projectId: 'dixon', projectName: 'Dixon Quarry Group', testDate: '2026-06-01', auditor: 'J', archivedAt: '2026-06-01T00:00:00Z', results: { 'area-onr': { b1: { _photos: [{ id: 'histp', w: 1, h: 1 }] } } }, meta },
    ] });
    const user = userEvent.setup();
    render(<AppRoot />);
    await user.click(screen.getByText('SWITCHBOARD'));
    const bs = bins();
    await user.click(bs[bs.length - 1]);
    await user.click(await screen.findByRole('button', { name: /Delete$/ }));
    await waitFor(() => expect(ls('swb-projects-v1')).toEqual([]));
    expect(await sitePhotoStore.get('livep')).toBeUndefined();
    expect(await sitePhotoStore.get('histp')).toBeUndefined();
  });
});

describe('Manage: deleting an area or a board frees exactly the photos it contained (the previously-missing gap, now fixed)', () => {
  it('"Delete area?" removes the area and frees every board it contained', async () => {
    await seedPhoto('areap');
    seed({ 'area-onr': { b1: { _photos: [{ id: 'areap', w: 1, h: 1 }] } } });
    const user = userEvent.setup(); await open(user, 'Manage');
    const bs = bins(); // [rename-area pencil, delete-area bin] — no board rows visible yet (area starts collapsed)
    await user.click(bs[bs.length - 1]);
    await user.click(await screen.findByRole('button', { name: /Delete$/ }));
    await waitFor(() => expect(ls('swb-projects-v1')[0].areas).toEqual([]));
    expect(await sitePhotoStore.get('areap')).toBeUndefined();
  });

  it('"Delete board?" removes just that board and frees only its photos, leaving the area\'s other board untouched', async () => {
    await seedPhoto('b1p'); await seedPhoto('b2p');
    seed({ 'area-onr': { b1: { _photos: [{ id: 'b1p', w: 1, h: 1 }] }, b2: { _photos: [{ id: 'b2p', w: 1, h: 1 }] } } });
    const user = userEvent.setup(); await open(user, 'Manage');
    await user.click(screen.getByText('ONR Workshop'));   // expand the area to see its boards
    // Board deletes are compact DeleteButtons — no accessible "Delete" text even in the confirm state (compact hides the
    // label), so scope to the specific board's own row instead of relying on global text matching.
    const row = screen.getByText('MSB 1').closest('div').parentElement;
    await user.click(within(row).getAllByRole('button')[1]);       // [edit-pencil, delete-bin] -> the bin
    await user.click(within(row).getAllByRole('button')[1]);       // the bin's OWN position now holds [confirm, cancel] — confirm is still index 1
    await waitFor(() => expect(ls('swb-projects-v1')[0].areas[0].boards.map(b => b.id)).toEqual(['b2']));
    expect(await sitePhotoStore.get('b1p')).toBeUndefined();
    expect(await sitePhotoStore.get('b2p')).toBeTruthy();
  });
});

describe('Continue: copies to NEW ids, never aliases the archived snapshot\'s photos', () => {
  async function seedContinue() {
    await seedPhoto('snapP'); await seedPhoto('liveP');
    seed({ 'area-onr': { b1: { _photos: [{ id: 'liveP', w: 5, h: 5 }] } } }, { 'swb-history-v1': [
      { id: 'snapA', projectId: 'dixon', projectName: 'Dixon Quarry Group', testDate: '2026-06-01', auditor: 'Jane', archivedAt: '2026-06-01T00:00:00Z', results: { 'area-onr': { b1: { _photos: [{ id: 'snapP', w: 7, h: 7 }] } } }, meta: { auditor: 'Jane', testDate: '2026-06-01' } },
    ] });
  }
  it('Continue replaces the live audit with a COPY (new id, same bytes/size); the archived snapshot is untouched', async () => {
    await seedContinue();
    const before = await sitePhotoStore.get('snapP');
    const user = userEvent.setup(); await open(user, 'History');
    await expandHistoryCard(user);
    await user.click(await screen.findByRole('button', { name: /Continue/ }));
    await user.click(await screen.findByRole('button', { name: /Yes, Continue/ }));
    await waitFor(() => expect(ls('swb-results-v1').dixon['area-onr'].b1._photos[0].id).not.toBe('snapP'));
    const live = ls('swb-results-v1').dixon['area-onr'].b1._photos[0];
    expect(live.id).not.toBe('snapP'); expect([live.w, live.h]).toEqual([7, 7]);             // size carried over
    const copy = await sitePhotoStore.get(live.id);
    expect(new Uint8Array(copy.buf)).toEqual(new Uint8Array(before.buf)); expect(copy.type).toBe(before.type);  // same bytes
    expect(await sitePhotoStore.get(live.id + '~t')).toBeTruthy();                          // thumbnail copied too
    expect(ls('swb-history-v1')[0].results['area-onr'].b1._photos[0].id).toBe('snapP');      // the snapshot itself is untouched
    expect(await sitePhotoStore.get('snapP')).toBeTruthy();
  });
  it('OWNERSHIP INDEPENDENCE: resetting the continued (copied) live audit does NOT touch the archived snapshot\'s photo', async () => {
    await seedContinue();
    const user = userEvent.setup(); await open(user, 'History');
    await expandHistoryCard(user);
    await user.click(await screen.findByRole('button', { name: /Continue/ }));
    await user.click(await screen.findByRole('button', { name: /Yes, Continue/ }));
    await waitFor(() => expect(ls('swb-results-v1').dixon['area-onr'].b1._photos[0].id).not.toBe('snapP'));
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(await screen.findByRole('button', { name: 'Reset all test results' }));
    await user.click(await screen.findByText('Reset all results?'));
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(ls('swb-results-v1').dixon).toEqual({}));
    expect(await sitePhotoStore.get('snapP')).toBeTruthy();                                 // the snapshot's own photo survives — it was never shared
  });
});

describe('Export: embeds a resolved photo and confirms the migration (removes the pre-migration backup)', () => {
  it('exporting a history snapshot that embeds a real migrated photo removes the pre-migration backup keys', async () => {
    await seedPhoto('exportp');
    const origExportCopy = sitePhotoIO.exportCopy;
    sitePhotoIO.exportCopy = async () => ({ dataUrl: JPEG_A });
    seed(null, {
      'swb-history-v1': [{ id: 'snapA', projectId: 'dixon', projectName: 'Dixon Quarry Group', testDate: '2026-06-01', auditor: 'J', archivedAt: '2026-06-01T00:00:00Z', results: { 'area-onr': { b1: { _photos: [{ id: 'exportp', w: 4, h: 3 }] } } }, meta }],
      'swb-results-preMigration-v1': { dixon: { 'area-onr': { b1: { _photos: [{ id: 'exportp', dataUrl: 'x' }] } } } },
      'swb-photos-migrated-v1': new Date().toISOString(),
    });
    let payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } };
    try {
      const user = userEvent.setup(); await open(user, 'History');
      await expandHistoryCard(user);
      await user.click(await screen.findByRole('button', { name: 'Export' }));
      await waitFor(() => expect(payload).toBeTruthy());
      expect(localStorage.getItem('swb-results-preMigration-v1')).toBeNull();   // a real export that embedded a migrated photo IS the verifying proof
    } finally { delete window.webkit; sitePhotoIO.exportCopy = origExportCopy; }
  });
});

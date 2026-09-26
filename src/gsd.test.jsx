// General Site Defects (GSD): a single-visit punch-list REPORT tool — Site -> Area -> Defects, photos in IndexedDB, exported as a photo report + Register.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExcelJS from 'exceljs';
import AppRoot, { exportGSDExcel, gsdPhotoIO, gsdPhotoStore, gsdNumbered, gsdLayout, gsdFit, gsdReportSections, gsdTitle, gsdAreaTaken, GSD_DEFAULT_CATEGORIES, GSD_DEFAULT_COMMON, GSD_DEFAULT_RESPONSIBILITY } from './App.jsx';
import { JPEG_A } from './test/jpeg-fixtures.js';

const ls = k => JSON.parse(localStorage.getItem(k));
const ab = n => new Uint8Array(n).buffer;
// deterministic photo IO (jsdom has no canvas): the file NAME carries its pixel size, e.g. "p_300x400.jpg"
beforeAll(() => {
  URL.createObjectURL = () => 'blob:gsd-test'; URL.revokeObjectURL = () => {};
  gsdPhotoIO.resize = async f => { const m = /_(\d+)x(\d+)/.exec(f.name) || [0, 300, 400]; return { full: { buf: ab(20), type: 'image/jpeg' }, thumb: { buf: ab(5), type: 'image/jpeg' }, w: +m[1], h: +m[2] }; };
  gsdPhotoIO.exportCopy = async () => ({ dataUrl: JPEG_A });
});
const img = (w = 300, h = 400, n = 'p') => new File(['x'], `${n}_${w}x${h}.jpg`, { type: 'image/jpeg' });
afterEach(() => cleanup());
const bins = () => screen.getAllByRole('button').filter(b => b.textContent === '' && b.querySelector('svg'));
const idbKeys = () => new Promise((res, rej) => { const rq = indexedDB.open('sparkcheck-gsd-photos', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('photos'); rq.onsuccess = () => { const db = rq.result; const q = db.transaction('photos').objectStore('photos').getAllKeys(); q.onsuccess = () => { db.close(); res(q.result.map(String).sort()); }; q.onerror = () => rej(q.error); }; rq.onerror = () => rej(rq.error); });
const clearIdb = () => new Promise(res => { const rq = indexedDB.open('sparkcheck-gsd-photos', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('photos'); rq.onsuccess = () => { const db = rq.result; const t = db.transaction('photos', 'readwrite'); t.objectStore('photos').clear(); t.oncomplete = () => { db.close(); res(); }; }; rq.onerror = () => res(); });

// ── pure helpers ──
describe('layout maths', () => {
  it('a photo is scaled to fit the 120 x 160 px box, aspect preserved (portrait, landscape, square, unknown size)', () => {
    expect(gsdFit(300, 400)).toEqual({ dw: 120, dh: 160 });
    expect(gsdFit(400, 300)).toEqual({ dw: 120, dh: 90 });
    expect(gsdFit(500, 500)).toEqual({ dw: 120, dh: 120 });
    expect(gsdFit(0, 0)).toEqual({ dw: 120, dh: 90 });                         // unknown size -> 4:3, never NaN
  });
  const P = (n, dh = 160) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, dw: 120, dh }));
  it('caption above its photos, a gap after the area bar, a spacer after each defect, 5 photos per row', () => {
    const { rows } = gsdLayout([{ name: 'Plant', items: [{ caption: '#1 A', detail: 'x', photos: P(7) }, { caption: '#2 B', detail: '', photos: [] }] }]);
    expect(rows.map(r => r.kind)).toEqual(['bar', 'gap', 'caption', 'detail', 'photos', 'photos', 'spacer', 'caption', 'spacer']);
    expect(rows[4].photos).toHaveLength(5); expect(rows[5].photos).toHaveLength(2);
    expect(rows[4].h).toBe(160 * 0.75 + 3);                                       // a photo row is as tall as its tallest photo
  });
  it('an area bar never stands alone at the bottom of a page: it moves to the next page WITH its first defect', () => {
    const items = n => Array.from({ length: n }, (_, i) => ({ caption: `#${i} x`, detail: '', photos: P(1) }));
    const { rows, breaks } = gsdLayout([{ name: 'A', items: items(4) }, { name: 'B', items: items(1) }]);
    const barB = rows.findIndex(r => r.kind === 'bar' && r.text === 'B');
    const before = rows.slice(0, barB); const pageStart = breaks.length ? breaks[breaks.length - 1] : 0;
    expect(breaks.length).toBeGreaterThan(0);
    // every break is directly before a bar or a caption or a photo row — never between a bar and its caption
    breaks.forEach(b => expect(['bar', 'caption', 'photos']).toContain(rows[b].kind));
    breaks.forEach(b => { expect(rows[b - 1] && rows[b - 1].kind).not.toBe('bar'); expect(rows[b - 1] && rows[b - 1].kind).not.toBe('gap'); });
    expect(before.length).toBeGreaterThan(0); expect(pageStart).toBeGreaterThanOrEqual(0);
  });
  it('a caption never leaves its first photo row behind; a very tall defect splits only at a photo-row boundary', () => {
    const many = { caption: '#1 tall', detail: 'd', photos: P(45) };                // 9 photo rows of 123pt
    const { rows, breaks } = gsdLayout([{ name: 'A', items: [{ caption: '#0 first', detail: '', photos: P(2) }, many] }]);
    breaks.forEach(b => { const prev = rows[b - 1]; const cur = rows[b]; if (cur.kind === 'photos') expect(prev.kind).toBe('photos'); expect(prev.kind).not.toBe('caption'); expect(prev.kind).not.toBe('detail'); });
    let y = 70, page = 0; const spans = []; rows.forEach((r, i) => { if (breaks.includes(i)) { spans.push(y); y = 0; page++; } y += r.h; }); spans.push(y);
    spans.forEach(s => expect(s).toBeLessThanOrEqual(730 + 1));                       // no page is over-full
    expect(page).toBeGreaterThan(0);
  });
  it('when only the caption would fit at the bottom of a page, the caption moves WITH its photos (no page is ever over-full)', () => {
    const fill = Array.from({ length: 24 }, (_, i) => ({ caption: '#' + i + ' filler', detail: '', photos: [] }));
    const { rows, breaks } = gsdLayout([{ name: 'A', items: [...fill, { caption: '#25 with photo', detail: '', photos: P(1) }] }]);
    const cap = rows.findIndex(r => r.text === '#25 with photo'); expect(breaks).toContain(cap);                       // the break goes BEFORE the caption
    let y = 70; const pages = []; rows.forEach((r, i) => { if (breaks.includes(i)) { pages.push(y); y = 0; } y += r.h; }); pages.push(y);
    pages.forEach(s => expect(s).toBeLessThanOrEqual(731));
  });
  it('a caption estimate grows with length (wrapped lines)', () => {
    const one = gsdLayout([{ name: 'A', items: [{ caption: 'short', detail: '', photos: [] }] }]).rows[2].h;
    const many = gsdLayout([{ name: 'A', items: [{ caption: 'x'.repeat(400), detail: '', photos: [] }] }]).rows[2].h;
    expect(many).toBeGreaterThan(one);
  });
});

describe('data helpers', () => {
  const proj = { areas: [{ id: 'a1', name: 'Concrete Plant' }, { id: 'a2', name: 'Workshop' }] };
  it('# = area order, then position within the area (not creation order)', () => {
    const items = [{ id: 'x', areaId: 'a2' }, { id: 'y', areaId: 'a1' }, { id: 'z', areaId: 'a2' }];
    expect(gsdNumbered(proj, items).map(e => [e.item.id, e.n])).toEqual([['y', 1], ['x', 2], ['z', 3]]);
  });
  it('title = the Common Defect, or the first line of the Description when it is "Other" / blank', () => {
    expect(gsdTitle({ commonDefect: 'Oil / grease spill', description: 'x' })).toBe('Oil / grease spill');
    expect(gsdTitle({ commonDefect: 'Other', description: 'Cable rubbing\nmore' })).toBe('Cable rubbing');
    expect(gsdTitle({ commonDefect: '', description: '' })).toBe('Untitled defect');
  });
  it('area names are unique per site, case / whitespace insensitive (except the area being renamed)', () => {
    expect(gsdAreaTaken(proj, '  concrete   PLANT ')).toBe(true); expect(gsdAreaTaken(proj, 'Pit 4')).toBe(false); expect(gsdAreaTaken(proj, 'Workshop', 'a2')).toBe(false);
  });
  it('the report caption is "#n  Asset Location — Description"; the muted line carries Category · Priority · Responsibility · Fix by', () => {
    const [s] = gsdReportSections(proj, [{ id: 'i', areaId: 'a1', assetLocation: 'Screen deck', description: 'Fix cabling', category: 'Guarding', priority: 'H', responsibility: 'Site Manager', dueDate: '2026-10-31', photos: [] }]);
    expect(s.entries[0].caption).toBe('#1  Screen deck — Fix cabling');
    expect(s.entries[0].detail).toBe('Guarding · High · Site Manager · Fix by 31/10/2026');
    expect(gsdReportSections(proj, [{ id: 'i', areaId: 'a1', description: 'Only text', photos: [] }])[0].entries[0].detail).toBe('');
  });
  it('the default lists avoid every other module\'s scope', () => {
    const owned = /switchboard|labell?ing|ventilation|vermin|busbar|rcd|e-?stop|isolator|lanyard|extension lead|power board|(?<!non-)emergency|exit sign|hot ?spot|weld/i;
    [...GSD_DEFAULT_CATEGORIES, ...GSD_DEFAULT_COMMON].forEach(x => expect(x, x).not.toMatch(owned));
    expect(GSD_DEFAULT_RESPONSIBILITY[0]).toBe('Site Manager');
  });
});

// ── UI, through the real app ──
const seedSite = (areas = ['Concrete Plant', 'Workshop']) => {
  localStorage.setItem('gsd-projects-v1', JSON.stringify([{ id: 's1', name: 'Site G', company: 'Co', abn: '', licence: '', areas: areas.map((n, i) => ({ id: 'a' + (i + 1), name: n })) }]));
  localStorage.setItem('gsd-meta-v1', JSON.stringify({ s1: { auditor: 'Jane', testDate: '2026-09-21' } }));
};
async function open(user, tab) {
  render(<AppRoot />);
  await user.click(screen.getByText('GENERAL SITE DEFECTS'));
  await user.click(await screen.findByText('Site G', { selector: 'div' }));
  if (tab) await user.click(screen.getByRole('button', { name: tab }));
}
async function addDefect(user, area, files = [img()]) {
  await user.click(screen.getByRole('button', { name: `Add defect to ${area}` }));
  await user.upload(screen.getByTestId('gsd-add-photos'), files);
  await screen.findByText(/^#\d+ · /);
}
beforeEach(async () => { cleanup(); localStorage.clear(); await clearIdb(); });

describe('module registration', () => {
  it('has a home card with its own accent, and nav is Home, Audit, Report, History, Manage, Dropdowns', async () => {
    seedSite(); const user = userEvent.setup(); await open(user, null);
    expect(screen.getByText('General Site Defects')).toBeInTheDocument();
    const nav = screen.getByRole('navigation'); expect(within(nav).getAllByRole('button').map(b => b.textContent)).toEqual(['Home', 'Audit', 'Report', 'History', 'Manage', 'Dropdowns']);
  });
  it('is registered with Calendar: an "Annual" event type, and its sites feed the Calendar site list', async () => {
    seedSite(); const user = userEvent.setup(); render(<AppRoot />);
    await user.click(screen.getByTestId('calendar-pill'));
    expect(await screen.findByText('Upcoming')).toBeInTheDocument();
    await user.click(screen.getByText('Add Event'));
    expect(await screen.findByText('Site Defects Audit')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox').some(s => within(s).queryByText('Site G'))).toBe(true);
  });
});

describe('Home', () => {
  it('Date Audited defaults Next Audit Due to ONE YEAR later, and follows a change of date until it is set by hand', async () => {
    seedSite(); const user = userEvent.setup(); await open(user, null);
    expect(screen.getByText('DATE AUDITED')).toBeInTheDocument();
    expect(screen.getByText('21/09/2026')).toBeInTheDocument(); expect(screen.getByText('21/09/2027')).toBeInTheDocument();
  });
});

describe('Audit: photo-first quick-add, live auto-save, cards', () => {
  it('"+ Add Defect" creates the defect FROM its photos and opens its page; nothing is created without a photo; stored as {id,w,h} + IndexedDB records', async () => {
    seedSite(); const user = userEvent.setup(); await open(user, 'Audit');
    expect(ls('gsd-items-v1')).toEqual({});
    await addDefect(user, 'Concrete Plant', [img(300, 400, 'a'), img(400, 300, 'b')]);
    await waitFor(() => expect(ls('gsd-items-v1').s1).toHaveLength(1));
    const it = ls('gsd-items-v1').s1[0];
    expect(it.areaId).toBe('a1'); expect(it.photos).toHaveLength(2); expect(it.photos[0]).toMatchObject({ w: 300, h: 400 }); expect(it.photos[1]).toMatchObject({ w: 400, h: 300 });
    expect(it).not.toHaveProperty('status'); expect(it.responsibility).toBe('Site Manager'); expect(it.priority).toBe('');       // ★ Responsibility pre-filled, Priority starts blank
    expect(JSON.stringify(it)).not.toMatch(/data:image/);                                                                       // no image bytes in localStorage
    expect(await idbKeys()).toEqual(it.photos.flatMap(p => [p.id, p.id + '~t']).sort());
  });
  it('the item page is live auto-save: no Save button; every field is written as it changes', async () => {
    seedSite(); const user = userEvent.setup(); await open(user, 'Audit'); await addDefect(user, 'Workshop');
    expect(screen.queryByRole('button', { name: /^save/i })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Asset location'), 'Pump room'); await user.click(screen.getByRole('button', { name: 'H — High' }));
    await user.type(screen.getByLabelText('Description'), 'Cable rubbing'); fireEvent.change(screen.getByLabelText('Fix by date'), { target: { value: '2026-11-30' } });
    await waitFor(() => { const it = ls('gsd-items-v1').s1[0]; expect(it).toMatchObject({ assetLocation: 'Pump room', priority: 'H', description: 'Cable rubbing', dueDate: '2026-11-30' }); });
  });
  it('Common Defect pre-fills the Description — but never over the user\'s own wording, and re-picks replace only its own auto text', async () => {
    seedSite(); const user = userEvent.setup(); await open(user, 'Audit'); await addDefect(user, 'Workshop');
    const sel = screen.getByLabelText('Common defect'); const desc = screen.getByLabelText('Description');
    await user.selectOptions(sel, 'Oil / grease spill'); expect(desc).toHaveValue('Oil / grease spill');
    await user.selectOptions(sel, 'Loose or missing fixings'); expect(desc).toHaveValue('Loose or missing fixings');       // still the auto text -> replaced
    await user.clear(desc); await user.type(desc, 'Bolts sheared at base');
    await user.selectOptions(sel, 'Oil / grease spill'); expect(desc).toHaveValue('Bolts sheared at base');                // user wording is kept
    await user.selectOptions(sel, 'Other'); expect(desc).toHaveValue('Bolts sheared at base');
    await waitFor(() => expect(ls('gsd-items-v1').s1[0]).toMatchObject({ commonDefect: 'Other', description: 'Bolts sheared at base' }));
  });
  it('a card shows the # , the priority dot, the title, and "Area — Asset Location"; tapping opens the item', async () => {
    seedSite(); localStorage.setItem('gsd-items-v1', JSON.stringify({ s1: [
      { id: 'i1', areaId: 'a1', assetLocation: 'Screen deck', category: '', commonDefect: 'Oil / grease spill', description: 'x', descAuto: '', photos: [], priority: 'H', responsibility: '', dueDate: '' },
      { id: 'i2', areaId: 'a1', assetLocation: '', category: '', commonDefect: 'Other', description: 'Fix cabling from isolator\nmore', descAuto: '', photos: [], priority: '', responsibility: '', dueDate: '' }] }));
    const user = userEvent.setup(); await open(user, 'Audit');
    const cards = screen.getAllByTestId('gsd-card');
    expect(within(cards[0]).getByText('#1')).toBeInTheDocument(); expect(within(cards[0]).getByText('Oil / grease spill')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Concrete Plant — Screen deck')).toBeInTheDocument(); expect(within(cards[0]).getByTestId('gsd-pri-H')).toBeInTheDocument();
    expect(within(cards[1]).getByText('Fix cabling from isolator')).toBeInTheDocument(); expect(within(cards[1]).getByText('Concrete Plant')).toBeInTheDocument();
    expect(within(cards[1]).queryByTestId(/gsd-pri-/)).not.toBeInTheDocument();
    await user.click(cards[0]); expect(await screen.findByText('#1 · Concrete Plant')).toBeInTheDocument();
  });
  it('"Add another defect in <area>" keeps you in the same area: new defect, new photo, opens its page', async () => {
    seedSite(); const user = userEvent.setup(); await open(user, 'Audit'); await addDefect(user, 'Workshop');
    await user.upload(screen.getByTestId('gsd-add-another'), img(300, 400, 'n2'));
    await waitFor(() => expect(ls('gsd-items-v1').s1).toHaveLength(2));
    expect(ls('gsd-items-v1').s1.map(i => i.areaId)).toEqual(['a2', 'a2']); expect(await screen.findByText('#2 · Workshop')).toBeInTheDocument();
  });
  it('areas can be added inline (unique per site, case-insensitive) and show even when empty', async () => {
    seedSite(); const user = userEvent.setup(); await open(user, 'Audit');
    await user.type(screen.getByLabelText('New area name'), 'workshop'); await user.click(screen.getByRole('button', { name: '+ Add Area' }));
    expect(screen.getByText('"workshop" is already an area')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('New area name')); await user.type(screen.getByLabelText('New area name'), 'Pit 4'); await user.click(screen.getByRole('button', { name: '+ Add Area' }));
    expect(await screen.findByRole('button', { name: 'Add defect to Pit 4' })).toBeInTheDocument();
    expect(ls('gsd-projects-v1')[0].areas.map(a => a.name)).toEqual(['Concrete Plant', 'Workshop', 'Pit 4']);
  });
});

describe('photos on an item: add / remove / reorder', () => {
  it('several photos; the first is Primary and drives the thumbnail; reorder swaps them; removing deletes the IndexedDB records', async () => {
    seedSite(); const user = userEvent.setup(); await open(user, 'Audit'); await addDefect(user, 'Workshop', [img(300, 400, 'a')]);
    await user.upload(screen.getByTestId('gsd-item-photos'), [img(400, 300, 'b'), img(500, 500, 'c')]);
    await waitFor(() => expect(ls('gsd-items-v1').s1[0].photos).toHaveLength(3));
    const ids = () => ls('gsd-items-v1').s1[0].photos.map(p => p.w);
    expect(ids()).toEqual([300, 400, 500]); expect(screen.getByText('Primary photo')).toBeInTheDocument();
    const rows = () => screen.getAllByTestId('gsd-photo-row');
    await user.click(within(rows()[1]).getByRole('button', { name: 'Move photo earlier' }));
    await waitFor(() => expect(ids()).toEqual([400, 300, 500]));
    expect(within(rows()[0]).getByRole('button', { name: 'Move photo earlier' })).toBeDisabled(); expect(within(rows()[2]).getByRole('button', { name: 'Move photo later' })).toBeDisabled();
    const removedId = ls('gsd-items-v1').s1[0].photos[2].id;
    await user.click(within(rows()[2]).getAllByRole('button').pop());                       // the bin (compact, icon only)
    { const bs = within(rows()[2]).getAllByRole('button'); await user.click(bs[bs.length - 2]); }   // compact confirm has no accessible name: the button before Keep
    await waitFor(() => expect(ids()).toEqual([400, 300]));
    expect(await idbKeys()).not.toContain(removedId); expect(await idbKeys()).not.toContain(removedId + '~t'); expect(await idbKeys()).toHaveLength(4);
  });
  it('a storage failure is reported, and creates nothing', async () => {
    seedSite(); const user = userEvent.setup(); const orig = gsdPhotoStore.put; gsdPhotoStore.put = async () => { throw new Error('quota'); };
    try { await open(user, 'Audit'); await user.click(screen.getByRole('button', { name: 'Add defect to Workshop' })); await user.upload(screen.getByTestId('gsd-add-photos'), img());
      expect(await screen.findByText(/Photos could not be saved/)).toBeInTheDocument(); expect(ls('gsd-items-v1')).toEqual({}); }
    finally { gsdPhotoStore.put = orig; }
  });
});

describe('duplicate, delete, area removal', () => {
  it('Duplicate copies every field EXCEPT the photos, into the chosen area, and opens the copy', async () => {
    seedSite(); const user = userEvent.setup(); await open(user, 'Audit'); await addDefect(user, 'Concrete Plant', [img(300, 400, 'a'), img(300, 400, 'b')]);
    await user.type(screen.getByLabelText('Description'), 'Guard missing'); await user.type(screen.getByLabelText('Asset location'), 'Crusher'); await user.click(screen.getByRole('button', { name: 'M — Medium' }));
    await user.selectOptions(screen.getByLabelText('Duplicate into area'), 'Workshop'); await user.click(screen.getByRole('button', { name: 'Duplicate (no photos)' }));
    await waitFor(() => expect(ls('gsd-items-v1').s1).toHaveLength(2));
    const [orig, copy] = ls('gsd-items-v1').s1;
    expect(copy).toMatchObject({ areaId: 'a2', description: 'Guard missing', assetLocation: 'Crusher', priority: 'M' }); expect(copy.photos).toEqual([]); expect(copy.id).not.toBe(orig.id); expect(orig.photos).toHaveLength(2);
    expect(await screen.findByText('#2 · Workshop')).toBeInTheDocument();
  });
  it('Delete asks first ("Keep" leaves everything), then removes the defect AND its photos', async () => {
    seedSite(); const user = userEvent.setup(); await open(user, 'Audit'); await addDefect(user, 'Workshop');
    expect(await idbKeys()).toHaveLength(2);
    await user.click(bins()[bins().length - 1]);                                        // the defect's own bin is the last on the page
    expect(screen.getByText('Delete defect?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep' }));
    expect(ls('gsd-items-v1').s1).toHaveLength(1); expect(await idbKeys()).toHaveLength(2);
    await user.click(bins()[bins().length - 1]); await user.click(screen.getByRole('button', { name: /Delete$/ }));
    await waitFor(() => expect(ls('gsd-items-v1').s1).toEqual([]));
    await waitFor(async () => expect(await idbKeys()).toEqual([]));
    expect(screen.getByRole('button', { name: 'Add defect to Workshop' })).toBeInTheDocument();     // back on the Audit list
  });
});

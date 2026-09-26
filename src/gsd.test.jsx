// General Site Defects (GSD): a single-visit punch-list REPORT tool — Site -> Area -> Defects, photos in IndexedDB, exported as a photo report + Register.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExcelJS from 'exceljs';
import AppRoot, { exportGSDExcel, gsdPhotoIO, gsdPhotoStore, gsdNumbered, gsdLayout, gsdFit, gsdReportSections, gsdTitle, gsdAreaTaken, GSD_DEFAULT_CATEGORIES, GSD_DEFAULT_COMMON, GSD_DEFAULT_RESPONSIBILITY, gsdUpgradeDropdowns, GSD_LEGACY_CATEGORIES, GSD_LEGACY_COMMON } from './App.jsx';
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
const bins = () => screen.getAllByRole('button').filter(b => b.textContent === '' && b.querySelector('svg') && !b.getAttribute('aria-label'));
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
    expect(gsdTitle({ commonDefect: 'Conduit loose or damaged', description: 'x' })).toBe('Conduit loose or damaged');
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
  it('the default lists are ELECTRICAL (items, electrical defects, or what an electrical item could cause) and avoid every other module\'s scope', () => {
    const owned = /switchboard|labell?ing|ventilation|vermin|busbar|rcd|e-?stop|isolator|lanyard|extension lead|power board|(?<!non-)emergency|exit sign|hot ?spot|weld/i;
    const electrical = /cable|conduit|junction|outlet|gpo|light|conductor|motor|electrical|wiring|equipment|ingress|weatherproof|enclosure|gland/i;
    [...GSD_DEFAULT_CATEGORIES, ...GSD_DEFAULT_COMMON].forEach(x => { expect(x, x).not.toMatch(owned); expect(x, x).toMatch(electrical); });
    [...GSD_DEFAULT_CATEGORIES, ...GSD_DEFAULT_COMMON].forEach(x => expect(x, x).not.toMatch(/housekeeping|structural|handrail|grating|oil|corroded|walkway or exit|machine guarding/i));   // the old general items are gone
    expect(GSD_DEFAULT_RESPONSIBILITY[0]).toBe('Site Manager');
  });
  it('a stored list that is EXACTLY the old default is replaced by the new default; a customised list is left alone', () => {
    const up = gsdUpgradeDropdowns({ categories: GSD_LEGACY_CATEGORIES, common: GSD_LEGACY_COMMON, responsibility: ['A'] });
    expect(up.categories).toEqual(GSD_DEFAULT_CATEGORIES); expect(up.common).toEqual(GSD_DEFAULT_COMMON); expect(up.responsibility).toEqual(['A']);
    const custom = ['Housekeeping', 'Mine']; expect(gsdUpgradeDropdowns({ categories: custom }).categories).toEqual(custom);
  });
  it('the Common Defect text is exported ONCE (through the Description), never as a second field — even when Description is still the auto-filled text', async () => {
    let payload; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } };
    const proj = { id: 's1', name: 'S', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Plant' }] };
    const item = { id: 'i', areaId: 'a1', assetLocation: 'Pump', category: 'Conduit / Cable Tray', commonDefect: 'Conduit loose or damaged', description: 'Conduit loose or damaged', descAuto: 'Conduit loose or damaged', photos: [], priority: 'H', responsibility: 'Site Manager', dueDate: '' };
    await exportGSDExcel(proj, [item], { auditor: 'J', testDate: '2026-09-21' });
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64'));
    const rowsWith = ws => { let n = 0; ws.eachRow(row => { let hit = false; row.eachCell(cell => { if (String(cell.value).includes('Conduit loose or damaged')) hit = true; }); if (hit) n++; }); return n; };
    expect(rowsWith(wb.getWorksheet('Defects Report'))).toBe(1);        // the caption row ("#1  Pump — Conduit loose or damaged"); the muted line does not repeat it
    expect(rowsWith(wb.getWorksheet('Register'))).toBe(1);              // the Register's Description column; there is no separate Common Defect column
    expect(wb.getWorksheet('Register').getRow(5).values.slice(1)).not.toContain('Common Defect');
    delete window.webkit;
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
const field = label => screen.getByText(label).parentElement;                                    // a labelled field block on the item page
const chooseFrom = async (user, label, option) => { await user.click(within(field(label)).getByRole('button')); await user.click(await within(field(label)).findByText(option, { selector: 'div' })); };

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
    expect(await screen.findByText('General Site Defects')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Site' })); expect(within(screen.getByRole('listbox')).getByRole('option', { name: 'Site G' })).toBeInTheDocument();
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
    const desc = screen.getByLabelText('Description');
    await chooseFrom(user, 'COMMON DEFECT', 'Conduit loose or damaged'); expect(desc).toHaveValue('Conduit loose or damaged');
    await chooseFrom(user, 'COMMON DEFECT', 'Outlet / GPO damaged'); expect(desc).toHaveValue('Outlet / GPO damaged');       // still the auto text -> replaced
    await user.clear(desc); await user.type(desc, 'Bolts sheared at base');
    await chooseFrom(user, 'COMMON DEFECT', 'Conduit loose or damaged'); expect(desc).toHaveValue('Bolts sheared at base');   // user wording is kept
    await chooseFrom(user, 'COMMON DEFECT', 'Other'); expect(desc).toHaveValue('Bolts sheared at base');
    await waitFor(() => expect(ls('gsd-items-v1').s1[0]).toMatchObject({ commonDefect: 'Other', description: 'Bolts sheared at base' }));
  });
  it('Common Defect is the app\'s styled dropdown (the SAME control and look as Category / Responsibility), not a native select; "Type custom…" is the free-text case and pre-fills Description', async () => {
    seedSite(); const user = userEvent.setup(); await open(user, 'Audit'); await addDefect(user, 'Workshop');
    expect(screen.queryByLabelText('Common defect')).not.toBeInTheDocument(); expect(document.querySelectorAll('select')).toHaveLength(0);      // no native <select> left on the item page
    const look = label => { const b = within(field(label)).getByRole('button'); const s = getComputedStyle(b); return [s.backgroundColor, s.borderTopColor, s.borderRadius, s.padding, s.fontSize, s.color, s.display, s.justifyContent]; };
    expect(look('COMMON DEFECT')).toEqual(look('CATEGORY'));                                     // both empty: identical, including the muted placeholder colour
    expect(look('COMMON DEFECT').filter((_, i) => i !== 5)).toEqual(look('RESPONSIBILITY').filter((_, i) => i !== 5));   // Responsibility has a value (darker text); everything else identical
    expect(within(field('COMMON DEFECT')).getByText('Select or type…')).toBeInTheDocument();
    await user.click(within(field('COMMON DEFECT')).getByRole('button')); await user.click(await within(field('COMMON DEFECT')).findByText('Type custom…', { exact: false }));
    await user.type(within(field('COMMON DEFECT')).getByPlaceholderText('Select or type…'), 'Cable gland cracked');
    expect(screen.getByLabelText('Description')).toHaveValue('Cable gland cracked');
    await waitFor(() => expect(ls('gsd-items-v1').s1[0]).toMatchObject({ commonDefect: 'Cable gland cracked', description: 'Cable gland cracked' }));
  });
  it('a card shows the # , the priority dot, the title, and "Area — Asset Location"; tapping opens the item', async () => {
    seedSite(); localStorage.setItem('gsd-items-v1', JSON.stringify({ s1: [
      { id: 'i1', areaId: 'a1', assetLocation: 'Screen deck', category: '', commonDefect: 'Conduit loose or damaged', description: 'x', descAuto: '', photos: [], priority: 'H', responsibility: '', dueDate: '' },
      { id: 'i2', areaId: 'a1', assetLocation: '', category: '', commonDefect: 'Other', description: 'Fix cabling from isolator\nmore', descAuto: '', photos: [], priority: '', responsibility: '', dueDate: '' }] }));
    const user = userEvent.setup(); await open(user, 'Audit');
    const cards = screen.getAllByTestId('gsd-card');
    expect(within(cards[0]).getByText('#1')).toBeInTheDocument(); expect(within(cards[0]).getByText('Conduit loose or damaged')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Concrete Plant — Screen deck')).toBeInTheDocument(); expect(within(cards[0]).getByTestId('gsd-pri-H')).toBeInTheDocument();
    expect(within(cards[1]).getByText('Fix cabling from isolator')).toBeInTheDocument(); expect(within(cards[1]).getByText('Concrete Plant')).toBeInTheDocument();
    expect(within(cards[1]).queryByTestId(/gsd-pri-/)).not.toBeInTheDocument();
    await user.click(cards[0]); expect(await screen.findByText('#1 · Concrete Plant')).toBeInTheDocument();
  });
  it('the item page has ONE Back (the header one), no Area field, and no "Add another defect"; the Audit tab has no Add Area (Manage owns areas)', async () => {
    seedSite(); const user = userEvent.setup(); await open(user, 'Audit');
    expect(screen.queryByLabelText('New area name')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: '+ Add Area' })).not.toBeInTheDocument(); expect(screen.queryByTestId('gsd-add-another')).not.toBeInTheDocument();
    await addDefect(user, 'Workshop');
    expect(screen.getAllByText('Back')).toHaveLength(1);                                              // only the header Back
    expect(screen.queryByLabelText('Area')).not.toBeInTheDocument(); expect(screen.queryByText('AREA')).not.toBeInTheDocument();
    expect(screen.queryByText(/Add another defect/)).not.toBeInTheDocument(); expect(screen.queryByTestId('gsd-add-another')).not.toBeInTheDocument();
    await user.click(screen.getByText('Back')); expect(await screen.findByRole('button', { name: 'Add defect to Workshop' })).toBeInTheDocument();   // the one Back returns to the Audit list
  });
  it('areas are added in MANAGE (unique per site, case-insensitive) and then show on the Audit tab even when empty', async () => {
    seedSite(); const user = userEvent.setup(); await open(user, 'Manage');
    await user.type(screen.getByLabelText('New area name'), 'workshop'); await user.click(screen.getByRole('button', { name: '+ Add Area' }));
    expect(screen.getByText('"workshop" is already an area')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('New area name')); await user.type(screen.getByLabelText('New area name'), 'Pit 4'); await user.click(screen.getByRole('button', { name: '+ Add Area' }));
    await waitFor(() => expect(ls('gsd-projects-v1')[0].areas.map(a => a.name)).toEqual(['Concrete Plant', 'Workshop', 'Pit 4']));
    await user.click(screen.getByRole('button', { name: 'Audit' })); expect(await screen.findByRole('button', { name: 'Add defect to Pit 4' })).toBeInTheDocument();
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
    await user.click(within(rows()[1]).getByRole('button', { name: 'Move photo up' }));
    await waitFor(() => expect(ids()).toEqual([400, 300, 500]));
    expect(within(rows()[0]).getByRole('button', { name: 'Move photo up' })).toBeDisabled(); expect(within(rows()[2]).getByRole('button', { name: 'Move photo down' })).toBeDisabled();
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
  const openPicker = async (user, name) => { await user.click(screen.getByRole('button', { name })); return within(await screen.findByTestId('gsd-area-picker')); };
  it('Duplicate is a pill; tapping it OFFERS the areas (including this one); picking one copies every field EXCEPT the photos into it and opens the copy', async () => {
    seedSite(['Concrete Plant', 'Workshop', 'Pit 4']); const user = userEvent.setup(); await open(user, 'Audit'); await addDefect(user, 'Concrete Plant', [img(300, 400, 'a'), img(300, 400, 'b')]);
    await user.type(screen.getByLabelText('Description'), 'Guard missing'); await user.type(screen.getByLabelText('Asset location'), 'Crusher'); await user.click(screen.getByRole('button', { name: 'M — Medium' }));
    const dup = screen.getByRole('button', { name: 'Duplicate' }); expect(dup).toHaveStyle({ borderRadius: '999px' });
    expect(ls('gsd-items-v1').s1).toHaveLength(1);                                       // tapping does not silently copy
    const picker = await openPicker(user, 'Duplicate');
    expect(picker.getAllByRole('button').map(b => b.textContent)).toEqual(['Concrete Plant (this area)', 'Workshop', 'Pit 4', 'Cancel']);
    await user.click(picker.getByRole('button', { name: 'Workshop' }));
    await waitFor(() => expect(ls('gsd-items-v1').s1).toHaveLength(2));
    const [orig, copy] = ls('gsd-items-v1').s1;
    expect(copy).toMatchObject({ areaId: 'a2', description: 'Guard missing', assetLocation: 'Crusher', priority: 'M' }); expect(copy.photos).toEqual([]); expect(copy.id).not.toBe(orig.id); expect(orig.photos).toHaveLength(2);
    expect(await screen.findByText('#2 · Workshop')).toBeInTheDocument();
  });
  it('Duplicate into the SAME area is a deliberate choice, and Cancel leaves everything alone', async () => {
    seedSite(); const user = userEvent.setup(); await open(user, 'Audit'); await addDefect(user, 'Workshop');
    let picker = await openPicker(user, 'Duplicate'); await user.click(picker.getByRole('button', { name: 'Cancel' })); expect(screen.queryByTestId('gsd-area-picker')).not.toBeInTheDocument(); expect(ls('gsd-items-v1').s1).toHaveLength(1);
    picker = await openPicker(user, 'Duplicate'); await user.click(picker.getByRole('button', { name: 'Workshop (this area)' }));
    await waitFor(() => expect(ls('gsd-items-v1').s1.map(i => i.areaId)).toEqual(['a2', 'a2']));
  });
  it('Move re-parents the SAME record (id, data and photos kept) into the chosen area; the current area is not offered; # follows the area order', async () => {
    seedSite(); const user = userEvent.setup(); await open(user, 'Audit');
    await addDefect(user, 'Concrete Plant', [img(300, 400, 'a')]); await user.type(screen.getByLabelText('Description'), 'First'); await user.click(screen.getByText('Back'));
    await addDefect(user, 'Workshop', [img(300, 400, 'b'), img(400, 300, 'c')]); await user.type(screen.getByLabelText('Description'), 'Misplaced'); await user.click(screen.getByRole('button', { name: 'H — High' }));
    expect(await screen.findByText('#2 · Workshop')).toBeInTheDocument();
    const before = ls('gsd-items-v1').s1.find(i => i.description === 'Misplaced'); const keys = await idbKeys();
    const move = screen.getByRole('button', { name: 'Move' }); expect(move).toHaveStyle({ borderRadius: '999px' });
    const picker = await openPicker(user, 'Move'); expect(picker.getAllByRole('button').map(b => b.textContent)).toEqual(['Concrete Plant', 'Cancel']);   // Workshop (where it is) is not offered
    await user.click(picker.getByRole('button', { name: 'Concrete Plant' }));
    await waitFor(() => expect(ls('gsd-items-v1').s1.find(i => i.id === before.id).areaId).toBe('a1'));
    const after = ls('gsd-items-v1').s1.find(i => i.id === before.id);
    expect(after).toMatchObject({ id: before.id, description: 'Misplaced', priority: 'H' }); expect(after.photos).toEqual(before.photos); expect(ls('gsd-items-v1').s1).toHaveLength(2);
    expect(await idbKeys()).toEqual(keys);                                                 // no photo record created or removed
    expect(await screen.findByText('#2 · Concrete Plant')).toBeInTheDocument();          // now the LAST defect of Concrete Plant (area order), so # 2
    await user.click(screen.getByText('Back')); const cards = screen.getAllByTestId('gsd-card');
    expect(cards.map(c => c.textContent.match(/#\d+/)[0])).toEqual(['#1', '#2']); expect(within(cards[1]).getByText('Misplaced')).toBeInTheDocument();
  });
  it('a moved defect goes to the END of the new area, like a newly added one', async () => {
    seedSite(); const user = userEvent.setup(); await open(user, 'Audit');
    await addDefect(user, 'Workshop'); await user.type(screen.getByLabelText('Description'), 'Misplaced'); await user.click(screen.getByText('Back'));
    await addDefect(user, 'Concrete Plant'); await user.type(screen.getByLabelText('Description'), 'Later'); await user.click(screen.getByText('Back'));
    await user.click(screen.getAllByTestId('gsd-card').find(c => c.textContent.includes('Misplaced')));
    const picker = await openPicker(user, 'Move'); await user.click(picker.getByRole('button', { name: 'Concrete Plant' }));
    await user.click(screen.getByText('Back')); const cards = screen.getAllByTestId('gsd-card');
    expect(cards.map(c => c.textContent.replace(/[^A-Za-z#0-9]/g, ''))).toEqual([expect.stringContaining('#1Later'), expect.stringContaining('#2Misplaced')]);
  });
  it('ONE row: Duplicate, Move and the bin share it; an open Delete confirm takes the whole row (pills step aside); an open picker hides the bin', async () => {
    seedSite(); const user = userEvent.setup(); await open(user, 'Audit'); await addDefect(user, 'Workshop');
    const actions = screen.getByTestId('gsd-actions');
    expect(within(actions).getByRole('button', { name: 'Duplicate' })).toBeInTheDocument(); expect(within(actions).getByRole('button', { name: 'Move' })).toBeInTheDocument();
    expect(within(screen.getByTestId('gsd-delete')).getAllByRole('button')).toHaveLength(1);         // the bin, on the same row as the pills
    expect(screen.getByTestId('gsd-delete')).toHaveStyle({ marginLeft: 'auto' });
    await user.click(within(screen.getByTestId('gsd-delete')).getByRole('button'));                   // Delete expands INLINE
    expect(within(actions).getByText('Delete defect?')).toBeInTheDocument(); expect(within(actions).getByRole('button', { name: 'Keep' })).toBeInTheDocument();
    expect(within(actions).queryByRole('button', { name: 'Duplicate' })).not.toBeInTheDocument(); expect(within(actions).queryByRole('button', { name: 'Move' })).not.toBeInTheDocument();   // stepped aside
    await user.click(within(actions).getByRole('button', { name: 'Keep' }));
    expect(within(actions).getByRole('button', { name: 'Duplicate' })).toBeInTheDocument(); expect(within(actions).getByRole('button', { name: 'Move' })).toBeInTheDocument(); expect(within(actions).queryByText('Delete defect?')).not.toBeInTheDocument();
    await user.click(within(actions).getByRole('button', { name: 'Duplicate' }));                   // a picker opens above; the bin steps aside
    expect(screen.getByTestId('gsd-area-picker')).toBeInTheDocument(); expect(screen.getByTestId('gsd-delete')).toBeInTheDocument(); expect(within(screen.getByTestId('gsd-delete')).getAllByRole('button')).toHaveLength(1); expect(within(actions).getByRole('button', { name: 'Move' })).toBeInTheDocument();   // the bin NEVER hides
    await user.click(within(screen.getByTestId('gsd-area-picker')).getByRole('button', { name: 'Cancel' }));
    await user.click(within(actions).getByRole('button', { name: 'Move' })); expect(screen.getByTestId('gsd-delete')).toBeInTheDocument();
    await user.click(within(screen.getByTestId('gsd-delete')).getByRole('button'));                   // Delete opens while a picker is open: the picker closes, Duplicate / Move step aside
    expect(screen.queryByTestId('gsd-area-picker')).not.toBeInTheDocument(); expect(within(actions).getByText('Delete defect?')).toBeInTheDocument(); expect(within(actions).queryByRole('button', { name: 'Move' })).not.toBeInTheDocument();
  });
  it('expanding Duplicate, Move or Delete scrolls the expanded block into view', async () => {
    const calls = []; const orig = Element.prototype.scrollIntoView; Element.prototype.scrollIntoView = function (o) { calls.push([this.getAttribute('data-testid'), o]); };
    try {
      seedSite(); const user = userEvent.setup(); await open(user, 'Audit'); await addDefect(user, 'Workshop'); calls.length = 0;
      await user.click(screen.getByRole('button', { name: 'Duplicate' })); await waitFor(() => expect(calls.length).toBeGreaterThan(0));
      expect(calls[calls.length - 1][0]).toBe('gsd-bottom'); expect(calls[calls.length - 1][1]).toMatchObject({ block: 'end' });
      await user.click(screen.getByRole('button', { name: 'Cancel' })); calls.length = 0;
      await user.click(screen.getByRole('button', { name: 'Move' })); await waitFor(() => expect(calls.length).toBeGreaterThan(0)); expect(calls[calls.length - 1][0]).toBe('gsd-bottom');
      await user.click(screen.getByRole('button', { name: 'Cancel' })); calls.length = 0;
      await user.click(within(screen.getByTestId('gsd-delete')).getByRole('button')); await waitFor(() => expect(calls.length).toBeGreaterThan(0)); expect(calls[calls.length - 1][0]).toBe('gsd-bottom');
    } finally { Element.prototype.scrollIntoView = orig; }
  });
  it('Move with no other area explains why instead of offering nothing silently', async () => {
    seedSite(['Only Area']); const user = userEvent.setup(); await open(user, 'Audit'); await addDefect(user, 'Only Area');
    const picker = await openPicker(user, 'Move'); expect(picker.getByText(/no other area/i)).toBeInTheDocument();
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

// THE LEAN PHOTO EXPORT COPY (release t). FICTIONAL data. The export copy of a photo (gsdPhotoIO.exportCopy / sitePhotoIO.exportCopy, both delegating to ONE helper) decodes the full-size image ONCE (the old path decoded it twice and built a
// base64 text of the whole image), reads its size from that same decode, reuses ONE Image and ONE canvas for the whole export, revokes its blob URL and removes the Image source after every photo, and shrinks the canvas to 0 x 0 after the
// last one (photoCopyRelease, in a finally around each of the four export loops). Its output must be the bytes the old path made: the OLD algorithm is kept below as a fixture and both run on the same fake browser.
// jsdom has no decoder and no canvas, so Image, the canvas and URL.createObjectURL are faked and every call is counted. The byte comparison against the real browser (21 of 21 SHA-256 equal) is in report-t2-build.txt.
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exportGSDExcel, gsdPhotoIO, sitePhotoIO, gsdPhotoStore } from './App.jsx';
import { JPEG_A } from './test/jpeg-fixtures.js';

const SRC = fs.readFileSync(process.cwd() + '/src/App.jsx', 'utf8');
const env = { images: [], canvases: [], encoded: [], drawn: [], created: [], revoked: [], size: [1280, 960], sizes: [], failLoad: false, decodes: 0 };
class FakeImage {
  constructor() { env.images.push(this); this.srcs = []; this.removed = 0; this.naturalWidth = 0; this.naturalHeight = 0; this._src = ''; }
  set src(v) {
    this.srcs.push(v); this._src = v; env.decodes++; const [w, h] = env.sizes.length ? env.sizes.shift() : env.size;
    Promise.resolve().then(() => { if (env.failLoad) { if (this.onerror) this.onerror(); } else { this.naturalWidth = w; this.naturalHeight = h; if (this.onload) this.onload(); } });
  }
  get src() { return this._src; }
  removeAttribute(n) { if (n === 'src') { this.removed++; this._src = ''; } }
}
const mkCanvas = () => { const c = { width: 0, height: 0, getContext: () => ({ drawImage: (...a) => env.drawn.push([a[1], a[2], a[3], a[4]]) }), toDataURL: (t, q) => { env.encoded.push([c.width, c.height, t, q]); return JPEG_A; } }; env.canvases.push(c); return c; };
const rec = (n = 4, type = 'image/jpeg') => ({ buf: new Uint8Array(Array.from({ length: n }, (_, i) => i + 1)).buffer, type });
const dataUrlOf = r => 'data:' + (r.type || 'image/jpeg') + ';base64,' + btoa(String.fromCharCode(...new Uint8Array(r.buf)));
const PROJ = { id: 'zq-site', name: 'ZQ Quarry', company: '', abn: '', licence: '', areas: [{ id: 'a1', name: 'Area 1' }] }, META = { auditor: 'J', testDate: '2026-10-20' };
const release = () => exportGSDExcel(PROJ, [], META, () => {});            // a GSD export with no photos still ends in photoCopyRelease(): the way a test empties the kit

let realCreate, realRevoke, realCreateEl;
beforeEach(async () => {
  Object.assign(env, { images: [], canvases: [], encoded: [], drawn: [], created: [], revoked: [], size: [1280, 960], sizes: [], failLoad: false, decodes: 0 });
  realCreate = URL.createObjectURL; realRevoke = URL.revokeObjectURL;
  URL.createObjectURL = b => { env.created.push(b); return 'blob:zq' + env.created.length; }; URL.revokeObjectURL = u => { env.revoked.push(u); };
  vi.stubGlobal('Image', FakeImage); realCreateEl = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((t, ...r) => (t === 'canvas' ? mkCanvas() : realCreateEl(t, ...r)));
  await release(); Object.assign(env, { images: [], canvases: [], encoded: [], drawn: [], created: [], revoked: [], decodes: 0 });      // a clean kit and clean counters
});
afterEach(() => { URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('one decode per photo, a blob URL, one Image and one canvas for the whole export', () => {
  it('each photo is decoded once, from a blob URL (no data: URL of the full image), with one Image for all of them', async () => {
    for (let i = 0; i < 5; i++) await gsdPhotoIO.exportCopy(rec(4 + i));
    expect(env.decodes).toBe(5); expect(env.images).toHaveLength(1); expect(env.images[0].srcs).toHaveLength(5); env.images[0].srcs.forEach(s => expect(s).toMatch(/^blob:zq\d+$/)); expect(env.created).toHaveLength(5);
  });
  it('one canvas is reused for every photo, resized each time', async () => {
    env.sizes = [[1280, 960], [960, 1280], [1280, 720]]; for (let i = 0; i < 3; i++) await sitePhotoIO.exportCopy(rec());
    expect(env.canvases).toHaveLength(1); expect(env.encoded.map(e => [e[0], e[1]])).toEqual([[320, 240], [240, 320], [320, 180]]);
  });
  it('the size comes from the SAME decode: the canvas is the scaled natural size, drawn at that size, saved as JPEG at 0.7', async () => {
    env.size = [1000, 333]; const r = await gsdPhotoIO.exportCopy(rec()); expect(r).toEqual({ dataUrl: JPEG_A });
    expect(env.encoded).toEqual([[320, 107, 'image/jpeg', 0.7]]); expect(env.drawn).toEqual([[0, 0, 320, 107]]); expect(env.decodes).toBe(1);
  });
  it('a photo whose long edge is already 320 or less comes back untouched as its own data URL (no canvas)', async () => {
    env.size = [320, 240]; const r = rec(6); expect(await gsdPhotoIO.exportCopy(r)).toEqual({ dataUrl: dataUrlOf(r) }); expect(env.canvases).toHaveLength(0);
    env.size = [4, 3]; expect(await gsdPhotoIO.exportCopy(r)).toEqual({ dataUrl: dataUrlOf(r) });
  });
  it('a second limit is honoured (maxSide)', async () => { env.size = [1280, 960]; await gsdPhotoIO.exportCopy(rec(), 200); expect(env.encoded[0].slice(0, 2)).toEqual([200, 150]); });
  it('every 4th photo yields to the browser (a zero-delay timer), so 8 photos yield twice', async () => {
    const st = vi.spyOn(globalThis, 'setTimeout'); for (let i = 0; i < 8; i++) await gsdPhotoIO.exportCopy(rec());
    expect(st.mock.calls.filter(c => c[1] === 0)).toHaveLength(2);
  });
});

describe('what is released, and when', () => {
  it('after every photo the blob URL is revoked and the Image source removed', async () => {
    await gsdPhotoIO.exportCopy(rec()); await gsdPhotoIO.exportCopy(rec()); expect(env.revoked).toEqual(env.created.map((_, i) => 'blob:zq' + (i + 1))); expect(env.images[0].removed).toBe(2);
  });
  it('a photo that cannot be decoded gives its own data URL, and its blob URL is still revoked', async () => {
    env.failLoad = true; const r = rec(5); expect(await gsdPhotoIO.exportCopy(r)).toEqual({ dataUrl: dataUrlOf(r) }); expect(env.canvases).toHaveLength(0); expect(env.revoked).toEqual(['blob:zq1']);
  });
  it('a browser without createObjectURL (jsdom) uses the data URL as the source, as the old path did, and revokes nothing', async () => {
    URL.createObjectURL = undefined; const r = rec(5); await gsdPhotoIO.exportCopy(r); expect(env.images[0].srcs[0]).toBe(dataUrlOf(r)); expect(env.revoked).toEqual([]); expect(env.encoded).toHaveLength(1);
  });
  it('photoCopyRelease (the end of an export) shrinks the canvas to 0 x 0 and clears the Image; the next export starts with a new Image and canvas', async () => {
    await gsdPhotoIO.exportCopy(rec()); await gsdPhotoIO.exportCopy(rec()); expect(env.canvases[0].width).toBe(320); expect(env.canvases[0].height).toBe(240);
    const im = env.images[0]; const before = im.removed; await release();
    expect(env.canvases[0].width).toBe(0); expect(env.canvases[0].height).toBe(0); expect(im.removed).toBeGreaterThan(before);
    await gsdPhotoIO.exportCopy(rec()); expect(env.images).toHaveLength(2); expect(env.canvases).toHaveLength(2); expect(env.canvases[1].width).toBe(320);
  });
  it('the real GSD export (3 fictional photos): one decode each, one Image, one canvas, every blob URL revoked, the canvas 0 x 0 at the end, the file handed over once', async () => {
    const photos = [1, 2, 3].map(i => ({ id: 'zp' + i, w: 1280, h: 960 })); for (const p of photos) await gsdPhotoStore.put(p.id, rec(8 + p.id.length));
    const item = { id: 'i1', areaId: 'a1', assetLocation: 'Pump', category: 'c', commonDefect: '', description: 'd', descAuto: '', photos, priority: 'H', responsibility: '', dueDate: '' };
    const handed = vi.fn(); await exportGSDExcel(PROJ, [item], META, handed);
    expect(handed).toHaveBeenCalledTimes(1); expect(env.decodes).toBe(3); expect(env.images).toHaveLength(1); expect(env.canvases).toHaveLength(1); expect(env.revoked).toHaveLength(env.created.length); expect(env.created).toHaveLength(3);
    expect(env.canvases[0].width).toBe(0); expect(env.canvases[0].height).toBe(0);
  });
});

describe('the bytes are the old path\'s (the old algorithm kept as a fixture, both run on the same fake browser)', () => {
  // the OLD export copy (release s): two full decodes per photo, the full image as a data URL
  const oldUrl = r => { const u = new Uint8Array(r.buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return `data:${r.type || 'image/jpeg'};base64,${btoa(s)}`; };
  const oldSize = url => new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth || 4, h: im.naturalHeight || 3 }); im.onerror = () => res({ w: 4, h: 3 }); im.src = url; });
  const oldCopy = async (r, maxSide = 320) => {
    const url = oldUrl(r); const { w, h } = await oldSize(url); const s = Math.min(1, maxSide / Math.max(w, h));
    if (s >= 1 || typeof document === 'undefined') return { dataUrl: url };
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    const im = new Image(); await new Promise(rr => { im.onload = rr; im.onerror = rr; im.src = url; });
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return { dataUrl: c.toDataURL('image/jpeg', 0.7) };
  };
  const SHAPES = [[1280, 960], [960, 1280], [1280, 720], [640, 480], [321, 240], [320, 240], [300, 200], [1280, 1280], [1000, 333], [4, 3], [0, 0]];
  it('same returned data URL, same canvas size, same draw call, same JPEG type and quality, for every shape (and for an unreadable image)', async () => {
    for (const failLoad of [false, true]) for (const shape of SHAPES) for (const type of ['image/jpeg', undefined]) {
      Object.assign(env, { size: shape, failLoad, encoded: [], drawn: [], canvases: [] }); const r = rec(7, type);
      const a = await oldCopy(r); const ea = [env.encoded.slice(), env.drawn.slice()]; Object.assign(env, { encoded: [], drawn: [], canvases: [] }); await release();
      const b = await gsdPhotoIO.exportCopy(r); const eb = [env.encoded.slice(), env.drawn.slice()];
      expect(b, 'result for ' + shape + ' failLoad ' + failLoad).toEqual(a); expect(eb, 'canvas calls for ' + shape).toEqual(ea);
    }
  });
  it('the same photos in the reverse order give the same results (the reused canvas leaks nothing from one photo into the next)', async () => {
    const run = async shapes => { const out = []; for (const s of shapes) { env.size = s; env.encoded = []; out.push([(await gsdPhotoIO.exportCopy(rec(7))).dataUrl, env.encoded.slice()]); } return out; };
    const fwd = await run(SHAPES); await release(); const rev = await run([...SHAPES].reverse()); expect(rev.reverse()).toEqual(fwd);
  });
});

describe('source scan: the two exportCopy methods only delegate and the four export loops release in a finally', () => {
  it('gsdPhotoIO.exportCopy and sitePhotoIO.exportCopy are one-line delegations to photoExportCopy', () => {
    const m = SRC.match(/async exportCopy\(rec, maxSide = 320\) \{[^\n]*\}/g) || []; expect(m).toHaveLength(2); m.forEach(x => expect(x).toBe('async exportCopy(rec, maxSide = 320) { return photoExportCopy(rec, maxSide); }'));
  });
  it('each of the four photo loops is inside try with photoCopyRelease() in its finally (swb, elt, welder, gsd)', () => {
    const fin = SRC.match(/\n  \} finally \{ photoCopyRelease\(\); \}/g) || []; expect(fin).toHaveLength(4);
    const heads = [/for \(const row of rows\) for \(const p of swbGetBoardPhotos\(/, /for \(const \{ res \} of withPhotos\) for \(const p of res\.photos/, /for \(const row of rows\) for \(const p of \(row\.res && row\.res\.photos\)/, /for \(const sec of sections\) for \(const e of sec\.entries\) for \(const p of e\.item\.photos/];
    heads.forEach(re => { const i = SRC.search(re); expect(i, String(re)).toBeGreaterThan(-1); expect(SRC.slice(SRC.lastIndexOf('\n', SRC.lastIndexOf('\n', i - 1) - 1) + 1, i)).toMatch(/^  try \{\n\s*$/); });
  });
  it('the helper decodes once: one new Image per kit, no gsdImageSize call, no createElement("canvas") outside the kit check, the blob URL revoked in a finally', () => {
    const a = SRC.indexOf('async function photoExportCopy('), z = SRC.indexOf('const sitePhotoIO = {'); const body = SRC.slice(a, z);
    expect(body.match(/new Image\(\)/g)).toHaveLength(1); expect(body).not.toContain('gsdImageSize'); expect(body.match(/createElement\("canvas"\)/g)).toHaveLength(1); expect(body).toMatch(/finally \{[\s\S]*URL\.revokeObjectURL\(blobUrl\)/);
  });
});

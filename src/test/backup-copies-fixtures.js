// Shared seeding for the release o tests (FICTIONAL data): LOOK-ALIKE sites with the same kind of name, every photo's and logo's bytes TAGGED with the number of the site they belong to, so a copy that lands on the wrong
// site (or a photo that lands on the wrong copy) is a visible failure. `seedLookAlike(f)` puts four sites into module f; `diverge(f)` then changes the PHONE the way a few weeks of work would.
import { seedModule, FM, rec, patchKey, wipe } from './backup-fixtures.js';
import { sitePhotoStore, gsdPhotoStore, siteLogoStore } from '../App.jsx';

export const SITES = [{ id: 'pra', name: 'Plant Room A', no: 1 }, { id: 'prb', name: 'Plant Room B', no: 2 }, { id: 'pra2', name: 'Plant Room A2', no: 3 }, { id: 'pre', name: 'Plant Room A (east)', no: 4 }];
const ptr = ids => ids.map(id => ({ id, w: 1, h: 1 }));
export const PH = {
  swb:    { store: sitePhotoStore, id: 'site-photos', live: (r, ids) => { r.a1.b1._photos = ptr(ids); }, hist: (r, ids) => { r.a1.b1._photos = ptr(ids); } },
  elt:    { store: sitePhotoStore, id: 'site-photos', live: (r, ids) => { Object.values(r)[0].photos = ptr(ids); }, hist: (r, ids) => { Object.values(r)[0].photos = ptr(ids); } },
  welder: { store: sitePhotoStore, id: 'site-photos', live: (r, ids) => { Object.values(r)[0].photos = ptr(ids); }, hist: (r, ids) => { Object.values(r)[0].photos = ptr(ids); } },
  gsd:    { store: gsdPhotoStore, id: 'gsd-photos', live: (r, ids) => { r[0].photos = ptr(ids); }, hist: (r, ids) => { r[0].photos = ptr(ids); } },
};
export const photoIdsOf = (site) => ({ live: [site.id + '-L1', site.id + '-L2'], hist: [site.id + '-H1'] });
// bytes tagged with the site's number: [no, kind, n, ...]; kind 1 = full, 2 = thumbnail, 3 = site logo
export const tagBytes = (no, kind, n) => rec(no, kind, n, 200 + no);
export const snapIdOf = site => 'h-' + site.id;

export async function seedLookAlike(f, sites = SITES) {
  for (const s of sites) {
    seedModule(f, { id: s.id, name: s.name, snapId: snapIdOf(s) });
    const ph = PH[f.mod]; const pi = photoIdsOf(s);
    if (ph) {
      patchKey(f.keys.r, v => ph.live(v[s.id], pi.live)); patchKey(f.keys.h, v => ph.hist(f.mod === 'gsd' ? v.find(h => h.id === snapIdOf(s)).items : v.find(h => h.id === snapIdOf(s)).results, pi.hist));
      let n = 0; for (const id of [...pi.live, ...pi.hist]) { n++; await ph.store.put(id, tagBytes(s.no, 1, n)); await ph.store.put(id + '~t', tagBytes(s.no, 2, n)); }
    }
    await siteLogoStore.put(f.mod, s.id, tagBytes(s.no, 3, 0));
  }
}
// what the phone looks like some weeks later: pra renamed, prb has more results, pra2 untouched, pre deleted, prc new
export function diverge(f) {
  const P = f.keys.p;
  patchKey(P, v => { v.find(p => p.id === 'pra').name = 'Plant Room A (renamed)'; });
  patchKey(f.keys.r, v => { const r = v.prb; if (Array.isArray(r)) r.push({ id: 'gx', areaId: 'a1', assetLocation: 'Pump', category: 'Guarding', commonDefect: '', description: 'added later', descAuto: '', photos: [], priority: 'H', responsibility: '', dueDate: '' }); else r.extraArea = { note: 'added later' }; });
}
export async function removeSite(f, id) {
  patchKey(f.keys.p, v => { const i = v.findIndex(p => p.id === id); if (i >= 0) v.splice(i, 1); });
  for (const k of [f.keys.r, f.keys.m]) patchKey(k, v => { delete v[id]; });
  patchKey(f.keys.h, v => { for (let i = v.length - 1; i >= 0; i--) if (v[i].projectId === id) v.splice(i, 1); });
  patchKey(`${f.mod}-audit-active-v1`, v => { delete v.sites[id]; });
  const s = SITES.find(x => x.id === id), ph = PH[f.mod];                       // like the app: the site's photos and logo go with it
  if (s && ph) { const pi = photoIdsOf(s); for (const p of [...pi.live, ...pi.hist]) { await ph.store.del(p); await ph.store.del(p + '~t'); } }
  await siteLogoStore.del(f.mod, id);
}
export const modsWithPhotos = ['swb', 'elt', 'welder', 'gsd'];
export { FM, wipe };

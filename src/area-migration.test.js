// Flat -> Site/Area/Assets migration (ELT + Welder). Data-safety tests: nothing lost, no duplicate areas, old key untouched.
import { describe, it, expect, beforeEach } from 'vitest';
import { areaKey, groupAssetsIntoAreas, migrateProjectToAreas, migrateHistoryToAreas, migrateProjectList, migrateHistoryList, loadVersioned, areaAssets } from './App.jsx';

const clone = o => JSON.parse(JSON.stringify(o));
const deepFreeze = o => { Object.values(o).forEach(v => { if (v && typeof v === 'object') deepFreeze(v); }); return Object.freeze(o); };

// Realistic OLD flat shapes (what v1 stored).
const eltSite = () => ({
  id: 'hearse-road-firestone-ab12cd3', name: 'Hearse Road Firestone', company: 'Acme Pty Ltd', abn: '12 345 678 901', licence: 'EW123456',
  assets: [
    { id: 'e1', location: 'Hearse Road Firestone', assetLocation: 'SE Door',   assetId: '',     type: 'Emergency Exit Sign', typeOther: '', maintained: 'Maintained',     fitting: 'Clevertronics 24m' },
    { id: 'e2', location: 'Hearse Road Firestone', assetLocation: 'SW Roof',   assetId: 'E-02', type: 'Combination Unit (Sign + 2 Side Lights)', typeOther: '', maintained: 'Non-Maintained', fitting: '' },
    { id: 'e3', location: 'Workshop',              assetLocation: 'North Bay', assetId: 'E-03', type: 'Other', typeOther: 'Bulkhead', maintained: '', fitting: '' },
    { id: 'e4', location: 'Hearse Road Firestone', assetLocation: 'Foyer',     assetId: 'E-04', type: 'Emergency Exit Sign', typeOther: '', maintained: 'Maintained', fitting: '' }, // same Location as e1/e2, non-adjacent
    { id: 'e5', location: '',                      assetLocation: 'Store',     assetId: '',     type: '', typeOther: '', maintained: '', fitting: '' },                                     // blank -> site name
  ],
});
const welderSite = () => ({
  id: 'p1', name: 'Site A', company: 'Co', abn: '1', licence: 'L1',
  assets: [
    { id: 'w1', location: 'ONR Workshop', assetId: 'W001', brand: 'Lincoln Electric', model: 'Invertec 300', serial: '2699294' },
    { id: 'w2', location: 'ONR Workshop', assetId: 'W002', brand: 'Unimig', model: 'Razor', serial: 'N/A' },
    { id: 'w3', location: 'Yard',         assetId: 'W003', brand: '', model: '', serial: '' },
    { id: 'w4', location: 'onr workshop ', assetId: 'W004', brand: 'Kemppi', model: '', serial: 'K-4' },  // spelling / whitespace variant
  ],
});
const names = p => p.areas.map(a => a.name);

describe('groupAssetsIntoAreas / migrateProjectToAreas', () => {
  it('ELT: many fittings sharing a Location land in ONE area, in first-appearance order, nothing lost', () => {
    const old = eltSite();
    const m = migrateProjectToAreas(old);
    expect(names(m)).toEqual(['Hearse Road Firestone', 'Workshop']);            // 5 fittings, 2 areas — not 3, not 5
    expect(m.areas[0].assets.map(a => a.id)).toEqual(['e1', 'e2', 'e4', 'e5']); // relative order kept; blank Location joined the site-name area
    expect(m.areas[1].assets.map(a => a.id)).toEqual(['e3']);
    expect(m.assets).toBeUndefined();
    // every fitting keeps every field except `location`, which became the area name
    const back = m.areas.flatMap(a => a.assets);
    old.assets.forEach(o => { const { location, ...rest } = o; expect(back.find(b => b.id === o.id)).toEqual(rest); });
    // site-level fields survive
    expect(m).toMatchObject({ id: old.id, name: old.name, company: 'Acme Pty Ltd', abn: '12 345 678 901', licence: 'EW123456' });
  });

  it('Welder: same Location (incl. case / trailing-space variants) groups into one area, first-seen spelling wins', () => {
    const m = migrateProjectToAreas(welderSite());
    expect(names(m)).toEqual(['ONR Workshop', 'Yard']);
    expect(m.areas[0].assets.map(a => a.assetId)).toEqual(['W001', 'W002', 'W004']);
    expect(m.areas[0].assets[2]).toEqual({ id: 'w4', assetId: 'W004', brand: 'Kemppi', model: '', serial: 'K-4' });
  });

  it('interleaved locations become grouped (A, C, A -> A, A | C); area order = first appearance', () => {
    const m = migrateProjectToAreas({ id: 's', name: 'S', assets: [{ id: '1', location: 'A' }, { id: '2', location: 'C' }, { id: '3', location: 'A' }] });
    expect(names(m)).toEqual(['A', 'C']);
    expect(m.areas.map(a => a.assets.map(x => x.id))).toEqual([['1', '3'], ['2']]);
  });

  it('blank Location and a Location equal to the site name are ONE area (what the old export already printed)', () => {
    const m = migrateProjectToAreas({ id: 's', name: 'Hearse Road Firestone', assets: [{ id: '1', location: '' }, { id: '2', location: 'hearse road  firestone' }, { id: '3' }] });
    expect(m.areas).toHaveLength(1);
    expect(m.areas[0]).toMatchObject({ name: 'Hearse Road Firestone' });
    expect(m.areas[0].assets.map(a => a.id)).toEqual(['1', '2', '3']);
  });

  it('empty and malformed sites migrate to areas: [] without throwing', () => {
    expect(migrateProjectToAreas({ id: 's', name: 'S', assets: [] }).areas).toEqual([]);
    expect(migrateProjectToAreas({ id: 's', name: 'S' }).areas).toEqual([]);
    expect(migrateProjectToAreas({ id: 's', name: 'S', assets: 'oops' }).areas).toEqual([]);
    expect(migrateProjectToAreas({ id: 's', name: '', assets: [{ id: '1' }] }).areas[0].name).toBe('Site'); // nameless site + blank Location
    expect(migrateProjectToAreas(null)).toBeNull();
    expect(groupAssetsIntoAreas([null, 7, { id: 'ok', location: 'X' }], 'S').map(a => a.assets.length)).toEqual([1]);
  });

  it('is idempotent: an already-migrated site is returned untouched, and migrating twice equals migrating once', () => {
    const once = migrateProjectToAreas(eltSite());
    expect(migrateProjectToAreas(once)).toBe(once);
    expect(migrateProjectToAreas(clone(once))).toEqual(once);
    expect(migrateProjectToAreas(eltSite())).toEqual(migrateProjectToAreas(eltSite())); // deterministic ids across runs
  });

  it('area ids are deterministic and unique even when different names slug the same ("A/B" vs "A B" vs "a-b")', () => {
    const m = migrateProjectToAreas({ id: 's', name: 'S', assets: [{ id: '1', location: 'A/B' }, { id: '2', location: 'A B' }, { id: '3', location: 'a-b' }, { id: '4', location: '???' }, { id: '5', location: '!!!' }] });
    expect(names(m)).toEqual(['A/B', 'A B', 'a-b', '???', '!!!']); // distinct names stay distinct areas...
    expect(new Set(m.areas.map(a => a.id)).size).toBe(5);          // ...with distinct ids
    expect(m.areas.map(a => a.id)).toEqual(['area-a-b', 'area-a-b-2', 'area-a-b-3', 'area-area', 'area-area-2']);
  });

  it('does not mutate its input', () => {
    const frozen = deepFreeze(eltSite());
    expect(() => migrateProjectToAreas(frozen)).not.toThrow();
    expect(() => migrateHistoryToAreas(deepFreeze({ id: 'h', projectName: 'S', assets: [{ id: '1', location: 'A' }], results: {} }))).not.toThrow();
  });

  it('property test: for 500 random flat sites nothing is lost and no area name repeats', () => {
    let seed = 1234567; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const pool = ['Hearse Road Firestone', 'hearse road firestone', ' Hearse  Road Firestone ', 'Workshop', 'WORKSHOP', 'Yard', 'North Bay', '', undefined, '   ', 'A/B', 'A B'];
    for (let i = 0; i < 500; i++) {
      const n = Math.floor(rnd() * 12);
      const assets = Array.from({ length: n }, (_, k) => { const o = { id: `a${i}-${k}`, assetId: 'X' + k, extra: { keep: [k] } }; const l = pool[Math.floor(rnd() * pool.length)]; if (l !== undefined) o.location = l; return o; });
      const site = { id: 's' + i, name: rnd() < 0.5 ? 'Hearse Road Firestone' : 'Other Site', assets };
      const m = migrateProjectToAreas(clone(site));
      const flat = m.areas.flatMap(a => a.assets);
      expect(flat).toHaveLength(assets.length);                                                    // count preserved
      expect(flat.map(a => a.id).sort()).toEqual(assets.map(a => a.id).sort());                   // every id preserved exactly once
      assets.forEach(o => { const { location, ...rest } = o; expect(flat.find(f => f.id === o.id)).toEqual(rest); }); // every other field intact
      const keys = m.areas.map(a => areaKey(a.name));
      expect(new Set(keys).size).toBe(keys.length);                                               // no duplicate areas
      expect(m.areas.every(a => a.assets.length > 0)).toBe(true);                                 // no empty areas invented
      expect(new Set(m.areas.map(a => a.id)).size).toBe(m.areas.length);
    }
  });
});

describe('history snapshots', () => {
  it('assets -> areas; results, meta and everything else untouched; blank Location uses the snapshot site name', () => {
    const snap = { id: 'h1', projectId: 'p1', projectName: 'Site A', testDate: '2026-07-13', auditor: 'Jane', archivedAt: '2026-07-13T01:00:00Z',
      results: { w1: { items: { visual: { result: 'pass' } }, photos: [{ id: 'ph', dataUrl: 'data:image/jpeg;base64,AAAA' }] } },
      meta: { auditor: 'Jane' }, assets: welderSite().assets.concat([{ id: 'w5', location: '', assetId: 'W005' }]) };
    const m = migrateHistoryToAreas(clone(snap));
    expect(m.assets).toBeUndefined();
    expect(names(m)).toEqual(['ONR Workshop', 'Yard', 'Site A']);
    expect(m.results).toEqual(snap.results); expect(m.meta).toEqual(snap.meta);
    expect(m).toMatchObject({ id: 'h1', projectId: 'p1', testDate: '2026-07-13', auditor: 'Jane', archivedAt: snap.archivedAt });
    expect(migrateHistoryToAreas(m)).toBe(m);
    expect(migrateHistoryList([snap, snap]).every(s => Array.isArray(s.areas))).toBe(true);
  });
});

describe('areaAssets (read path)', () => {
  it('flattens in AREA order, annotating location + areaId — so exports come out grouped by area', () => {
    const m = migrateProjectToAreas({ id: 's', name: 'S', assets: [{ id: '1', location: 'A' }, { id: '2', location: 'C' }, { id: '3', location: 'A' }] });
    const flat = areaAssets(m);
    expect(flat.map(a => [a.id, a.location])).toEqual([['1', 'A'], ['3', 'A'], ['2', 'C']]);
    expect(flat.every(a => a.areaId)).toBe(true);
    expect(areaAssets({})).toEqual([]); expect(areaAssets(null)).toEqual([]);
  });
});

describe('loadVersioned — old key is never written', () => {
  beforeEach(() => localStorage.clear());
  const list = [eltSite(), { id: 'empty', name: 'Empty Site', assets: [] }];

  it('reads v1 + migrates when v2 is absent; v1 stays byte-identical', async () => {
    const raw = JSON.stringify(list); localStorage.setItem('elt-projects-v1', raw);
    const got = await loadVersioned('elt-projects-v2', 'elt-projects-v1', [], migrateProjectList);
    expect(got.map(p => p.areas.length)).toEqual([2, 0]);
    expect(got.flatMap(p => p.areas.flatMap(a => a.assets)).map(a => a.id)).toEqual(['e1', 'e2', 'e4', 'e5', 'e3']);
    expect(localStorage.getItem('elt-projects-v1')).toBe(raw);       // untouched
    expect(localStorage.getItem('elt-projects-v2')).toBeNull();      // the loader itself writes nothing
  });

  it('v2 wins when it exists (v1 ignored); nothing to migrate returns the fallback; running twice is stable', async () => {
    localStorage.setItem('elt-projects-v1', JSON.stringify(list));
    const v2 = [{ id: 'n', name: 'New', areas: [{ id: 'area-x', name: 'X', assets: [{ id: 'z' }] }] }];
    localStorage.setItem('elt-projects-v2', JSON.stringify(v2));
    expect(await loadVersioned('elt-projects-v2', 'elt-projects-v1', [], migrateProjectList)).toEqual(v2);
    expect(await loadVersioned('welder-projects-v2', 'welder-projects-v1', [], migrateProjectList)).toEqual([]);
    localStorage.removeItem('elt-projects-v2');
    const a = await loadVersioned('elt-projects-v2', 'elt-projects-v1', [], migrateProjectList);
    const b = await loadVersioned('elt-projects-v2', 'elt-projects-v1', [], migrateProjectList);
    expect(b).toEqual(a);
  });

  it('a non-array v1 value passes through untouched instead of throwing', async () => {
    localStorage.setItem('welder-history-v1', JSON.stringify({ weird: true }));
    expect(await loadVersioned('welder-history-v2', 'welder-history-v1', [], migrateHistoryList)).toEqual({ weird: true });
  });
});

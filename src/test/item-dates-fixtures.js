// OLD-FORMAT fixtures for the one-time item-date backfill (FICTIONAL data): what each module stored BEFORE item dates existed.
// Per module: tile, storage keys, a project, the live results / meta / history, and EXPECTED = the same data after the backfill.
//   Live site s1: Home date 2026-09-21 (RCD: push 2026-09-21, inject 2026-09-22). Snapshot h1: its own date 2026-08-10 (RCD: push 08-10, inject 08-11).
//   Each fixture has: items with a result and no date (stamped), untested items (untouched), and an item that already has a date (kept). `dated` lists where the stamps land.
const clone = x => JSON.parse(JSON.stringify(x));
const site = areas => [{ id: 's1', name: 'Site One', company: '', abn: '', licence: '', areas }];
const HOME = '2026-09-21', SNAP = '2026-08-10', KEPT = '2026-07-01';
const snap = (extra, over = {}) => ({ id: 'h1', projectId: 's1', projectName: 'Site One', testDate: SNAP, auditor: 'Jane', archivedAt: '2026-08-12T01:00:00.000Z', meta: { auditor: 'Jane', testDate: SNAP }, ...extra, ...over });

const rcd = (() => {
  const live = { a1: { p1: { 'CB 1': { push: { status: 'pass', comment: '' }, inject: { status: 'untested' } }, 'CB 2': { push: { status: 'untested' }, inject: { status: 'fail', resultPos: '>300' } }, 'CB 3': { push: { status: 'pass', lastTested: KEPT }, inject: {} } } } };
  const hist = { a1: { p1: { 'CB 1': { push: { status: 'pass' }, inject: { status: 'pass' } } } } };
  const exp = clone({ live, hist });
  exp.live.a1.p1['CB 1'].push.lastTested = HOME; exp.live.a1.p1['CB 2'].inject.lastTested = '2026-09-22'; exp.hist.a1.p1['CB 1'].push.lastTested = SNAP; exp.hist.a1.p1['CB 1'].inject.lastTested = '2026-08-11';
  return { mod: 'rcd', tile: 'RCD TESTING', keys: { p: 'rcd-projects-v6', r: 'rcd-results-v6', m: 'rcd-meta-v6', h: 'rcd-history-v6' },
    project: site([{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'p1', name: 'MSB 1', circuits: ['CB 1', 'CB 2', 'CB 3'] }] }]),
    meta: { auditor: 'Jane', pushDate: HOME, injectDate: '2026-09-22', notes: '' }, snapMeta: { auditor: 'Jane', pushDate: SNAP, injectDate: '2026-08-11' },
    live, hist, expLive: exp.live, expHist: exp.hist, stamped: 4 };
})();
const iel = (() => {
  const live = { a1: { estops: { x1: { status: 'pass', lastTested: KEPT }, x2: { status: 'na' }, x3: { status: 'untested' }, x4: { status: 'fail' } } } };
  const hist = { a1: { estops: { x1: { status: 'pass' } } } };
  const exp = clone({ live, hist }); exp.live.a1.estops.x2.lastTested = HOME; exp.live.a1.estops.x4.lastTested = HOME; exp.hist.a1.estops.x1.lastTested = SNAP;
  return { mod: 'iel', tile: 'IEL TESTING', keys: { p: 'iel-projects-v2', r: 'iel-results-v2', m: 'iel-meta-v2', h: 'iel-history-v2' },
    project: site([{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'e1', name: 'estops', circuits: ['x1', 'x2', 'x3', 'x4'], machineNames: {} }] }]),
    meta: { auditor: 'Jane', testDate: HOME, notes: '' }, live, hist, expLive: exp.live, expHist: exp.hist, stamped: 3 };
})();
const tat = (() => {
  const live = { a1: { i1: { status: 'fail' }, i2: { status: 'untested' }, i3: { status: 'pass', lastTested: KEPT }, i4: { status: 'na' } } };
  const hist = { a1: { i1: { status: 'pass' } } };
  const exp = clone({ live, hist }); exp.live.a1.i1.lastTested = HOME; exp.live.a1.i4.lastTested = HOME; exp.hist.a1.i1.lastTested = SNAP;
  return { mod: 'tat', tile: 'TEST & TAG', keys: { p: 'tat-projects-v1', r: 'tat-results-v1', m: 'tat-meta-v1', h: 'tat-history-v1' },
    project: site([{ id: 'a1', name: 'Workshop', defaultFreq: '3', items: ['i1', 'i2', 'i3', 'i4'], itemNames: {}, itemTags: {}, itemEquipTypes: {}, itemFreqs: {} }]),
    meta: { auditor: 'Jane', testDate: HOME, notes: '' }, live, hist, expLive: exp.live, expHist: exp.hist, stamped: 3 };
})();
const swb = (() => {
  const live = { a1: { b1: { enclosure: { status: 'pass' }, ventilation: { status: 'untested' }, moisture: { status: 'na', lastTested: KEPT }, photos: [] } } };
  const hist = { a1: { b1: { enclosure: { status: 'fail' }, photos: [] } } };
  const exp = clone({ live, hist }); exp.live.a1.b1.enclosure.lastTested = HOME; exp.hist.a1.b1.enclosure.lastTested = SNAP;
  return { mod: 'swb', tile: 'SWITCHBOARD', keys: { p: 'swb-projects-v1', r: 'swb-results-v1', m: 'swb-meta-v1', h: 'swb-history-v1' },
    project: site([{ id: 'a1', name: 'Wash Plant', boards: [{ id: 'b1', name: 'MSB 1' }] }]),
    meta: { auditor: 'Jane', testDate: HOME, notes: '' }, live, hist, expLive: exp.live, expHist: exp.hist, stamped: 2 };
})();
const irt = (() => {
  const live = { a1: { p1: { m1: { status: 'untested', readings: { 'L1-E': '500' } }, m2: { status: 'pass' }, m3: { status: 'untested', readings: {} }, m4: { status: 'fail', lastTested: KEPT } } } };
  const hist = { a1: { p1: { m2: { status: 'fail' } } } };
  const exp = clone({ live, hist }); exp.live.a1.p1.m1.lastTested = HOME; exp.live.a1.p1.m2.lastTested = HOME; exp.hist.a1.p1.m2.lastTested = SNAP;
  return { mod: 'irt', tile: 'INSULATION RESISTANCE TESTING', keys: { p: 'irt-projects-v1', r: 'irt-results-v1', m: 'irt-meta-v1', h: 'irt-history-v1' },
    project: site([{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'p1', name: 'MSB 1', items: ['m1', 'm2', 'm3', 'm4'] }] }]),
    meta: { auditor: 'Jane', testDate: HOME, notes: '' }, live, hist, expLive: exp.live, expHist: exp.hist, stamped: 3 };
})();
const thermo = (() => {
  const live = { a1: { b1: { c1: [{ id: '1', flirFile: '1001', result: 'PASS' }, { id: '2', flirFile: '1002', result: 'FAIL', lastTested: KEPT }], c2: [], __board__: [{ id: '3', flirFile: '1003', result: 'MONITOR' }] } } };
  const hist = { a1: { b1: { c1: [{ id: '1', flirFile: '1001', result: 'PASS' }] } } };
  const exp = clone({ live, hist }); exp.live.a1.b1.c1[0].lastTested = HOME; exp.live.a1.b1.__board__[0].lastTested = HOME; exp.hist.a1.b1.c1[0].lastTested = SNAP;
  return { mod: 'thermo', tile: 'THERMOGRAPHIC', keys: { p: 'thermo-projects-v1', r: 'thermo-results-v1', m: 'thermo-meta-v1', h: 'thermo-history-v1' },
    project: site([{ id: 'a1', name: 'Wash Plant', boards: [{ id: 'b1', name: 'MSB 1', circuits: ['c1', 'c2'], circuitNames: { c1: 'Main', c2: 'Feed' } }] }]),
    meta: { auditor: 'Jane', testDate: HOME, notes: '' }, live, hist, expLive: exp.live, expHist: exp.hist, stamped: 3 };
})();
const elt = (() => {
  const live = { x1: { visual: 'pass', notes: '' }, x2: { notes: 'only a note' }, x3: { charging: 'fail' }, x4: { visual: 'pass', lastTested: KEPT } };
  const hist = { x1: { discharge: 'pass' } };
  const exp = clone({ live, hist }); exp.live.x1.lastTested = HOME; exp.live.x3.lastTested = HOME; exp.hist.x1.lastTested = SNAP;
  return { mod: 'elt', tile: 'EMERGENCY LIGHTING', keys: { p: 'elt-projects-v2', r: 'elt-results-v1', m: 'elt-meta-v1', h: 'elt-history-v2' },
    project: site([{ id: 'ar', name: 'Plant Room', assets: [{ id: 'x1', assetLocation: 'Door', assetId: 'E1', type: 'Exit Signs', typeOther: '', maintained: 'Maintained', fitting: '' }] }]),
    meta: { auditor: 'Jane', testDate: HOME }, live, hist, expLive: exp.live, expHist: exp.hist, stamped: 3 };
})();
const welder = (() => {
  const live = { a1: { items: { visual: { result: 'pass' } } }, a2: { items: {} }, a3: { items: { visual: { result: '' } } }, a4: { items: { visual: { result: 'fail' } }, lastTested: KEPT } };
  const hist = { a1: { items: { visual: { result: 'fail' } } } };
  const exp = clone({ live, hist }); exp.live.a1.lastTested = HOME; exp.hist.a1.lastTested = SNAP;
  return { mod: 'welder', tile: 'WELDER TESTING', keys: { p: 'welder-projects-v2', r: 'welder-results-v1', m: 'welder-meta-v1', h: 'welder-history-v2' },
    project: site([{ id: 'ar', name: 'Workshop', assets: [{ id: 'a1', assetId: 'W1', brand: 'K', model: 'M', serial: '1' }] }]),
    meta: { auditor: 'Jane', testDate: HOME }, live, hist, expLive: exp.live, expHist: exp.hist, stamped: 2 };
})();
const gsd = (() => {
  const d = (id, extra) => ({ id, areaId: 'a1', assetLocation: 'Gate', category: 'Guarding', commonDefect: '', description: 'x', descAuto: '', photos: [], priority: 'H', responsibility: '', dueDate: '', ...extra });
  const live = [d('i1'), d('i2', { lastTested: KEPT })], hist = [d('i1')];
  const exp = clone({ live, hist }); exp.live[0].lastTested = HOME; exp.hist[0].lastTested = SNAP;
  return { mod: 'gsd', tile: 'GENERAL SITE DEFECTS', keys: { p: 'gsd-projects-v1', r: 'gsd-items-v1', m: 'gsd-meta-v1', h: 'gsd-history-v1' }, snapField: 'items',
    project: site([{ id: 'a1', name: 'Yard' }]),
    meta: { auditor: 'Jane', testDate: HOME }, live, hist, expLive: exp.live, expHist: exp.hist, stamped: 2 };
})();

export const MODULES = [rcd, iel, tat, thermo, swb, irt, elt, welder, gsd];
export { HOME, SNAP, KEPT, clone };
// the whole-store shapes (site level above the fixture's site data) for the pure function
export const liveStore = f => ({ s1: clone(f.live) });
export const metaStore = f => ({ s1: clone(f.meta) });
export const histStore = f => [snap({ [f.snapField || 'results']: clone(f.hist), meta: clone(f.snapMeta || { auditor: 'Jane', testDate: SNAP }) })];
export const expHistStore = f => [snap({ [f.snapField || 'results']: clone(f.expHist), meta: clone(f.snapMeta || { auditor: 'Jane', testDate: SNAP }) })];

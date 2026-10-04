// Shared seeds for the audit-gate tests (FICTIONAL data). Three sites per module:
//   sa  A: items marked, auditor set            (an audit in progress)
//   sb  B: started, nothing marked, auditor set (recordable in the OLD format only for RCD / IEL, via their global key)
//   sc  C: never touched (no auditor, no data)
// Formats: OLD = what the first release stored (global rcd-mode-v6 / iel-cat-v2, NO per-site flag key); NEW = the per-site flag key.
const DATE = '2026-10-01';
const SWB_KEYS = ['enclosure', 'ventilation', 'moisture', 'insulation', 'busbars', 'terminations', 'protection', 'contactors', 'mounting', 'labelling', 'earthing'];
export const GATE_MODS = [
  { tile: 'RCD TESTING', short: 'RCD', p: 'rcd-projects-v6', r: 'rcd-results-v6', m: 'rcd-meta-v6', a: 'rcd-audit-active-v1', old: ['rcd-mode-v6', 'push'], entry: { mode: 'push' }, start: /^Push Test/,
    areas: [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'p1', name: 'MSB 1', circuits: ['CB 1', 'CB 2'] }] }],
    marked: { a1: { p1: { 'CB 1': { push: { status: 'pass' }, inject: {} } } } }, meta: au => ({ auditor: au, pushDate: DATE, injectDate: DATE, notes: '' }) },
  { tile: 'IEL TESTING', short: 'IEL', p: 'iel-projects-v2', r: 'iel-results-v2', m: 'iel-meta-v2', a: 'iel-audit-active-v1', old: ['iel-cat-v2', 'estops'], entry: { cat: 'estops' }, start: /E-Stops/,
    areas: [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'e1', name: 'estops', circuits: ['x1', 'x2'], machineNames: { x1: 'Feed Conveyor 1', x2: 'Feed Conveyor 2' } }] }],
    marked: { a1: { estops: { x1: { status: 'pass', lastTested: DATE } } } }, meta: au => ({ auditor: au, testDate: DATE, notes: '' }) },
  { tile: 'TEST & TAG', short: 'TAT', p: 'tat-projects-v1', r: 'tat-results-v1', m: 'tat-meta-v1', a: 'tat-audit-active-v1', entry: {}, start: /Start \/ Continue Audit/,
    areas: [{ id: 'a1', name: 'Workshop', defaultFreq: '3', items: ['i1', 'i2'], itemNames: { i1: 'Angle grinder', i2: 'Drill' }, itemTags: {}, itemEquipTypes: {}, itemFreqs: {} }],
    marked: { a1: { i1: { status: 'pass', visualCheck: 'pass', electricalCheck: 'pass', lastTested: DATE } } }, meta: au => ({ auditor: au, testDate: DATE, notes: '' }) },
  { tile: 'THERMOGRAPHIC', short: 'Thermo', p: 'thermo-projects-v1', r: 'thermo-results-v1', m: 'thermo-meta-v1', a: 'thermo-audit-active-v1', entry: {}, start: /Start \/ Continue Audit/,
    areas: [{ id: 'a1', name: 'Wash Plant', boards: [{ id: 'b1', name: 'MSB 1', circuits: ['c1', 'c2'], circuitNames: { c1: 'Main incomer', c2: 'Feed Conveyor 1' } }] }],
    marked: { a1: { b1: { c1: [{ id: '1', flirFile: '1001', temp: '34', result: 'PASS', notes: '', rectifiedDate: '' }] } } }, meta: au => ({ auditor: au, testDate: DATE, notes: '' }) },
  { tile: 'SWITCHBOARD', short: 'SWB', p: 'swb-projects-v1', r: 'swb-results-v1', m: 'swb-meta-v1', a: 'swb-audit-active-v1', entry: {}, start: /Start \/ Continue Audit/,
    areas: [{ id: 'a1', name: 'Wash Plant', boards: [{ id: 'b1', name: 'MSB 1' }] }],
    marked: { a1: { b1: { [SWB_KEYS[0]]: { status: 'pass' } } } }, meta: au => ({ auditor: au, testDate: DATE, notes: '' }) },
  { tile: 'INSULATION RESISTANCE TESTING', short: 'IRT', p: 'irt-projects-v1', r: 'irt-results-v1', m: 'irt-meta-v1', a: 'irt-audit-active-v1', entry: {}, start: /Start \/ Continue Audit/,
    areas: [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'p1', name: 'MSB 1', items: ['m1', 'm2'] }] }],
    marked: { a1: { p1: { m1: { status: 'pass', readings: {}, testVoltage: '500V' } } } }, meta: au => ({ auditor: au, testDate: DATE, notes: '' }) },
  // ELT: no folders — the Audit tab is one list, tapping a fitting opens its page (the second level). Results are keyed site -> fitting id (not by area).
  { tile: 'EMERGENCY LIGHTING', short: 'ELT', p: 'elt-projects-v2', r: 'elt-results-v1', m: 'elt-meta-v1', a: 'elt-audit-active-v1', entry: {}, start: /Start \/ Continue Testing/,
    areas: [{ id: 'ar', name: 'Plant Room', assets: [{ id: 'x1', assetLocation: 'Plant Room Door', assetId: 'E1', type: 'Exit Signs', typeOther: '', maintained: 'Maintained', fitting: '' }, { id: 'x2', assetLocation: 'Corridor', assetId: 'E2', type: 'Exit Signs', typeOther: '', maintained: 'Maintained', fitting: '' }] }],
    marked: { x1: { visual: 'pass' } }, meta: au => ({ auditor: au, testDate: DATE }) },
  // Welder: the same two-level shape as ELT (a list of welders; a welder's page). Results are keyed site -> welder id, with the answers under items.
  { tile: 'WELDER TESTING', short: 'Welder', p: 'welder-projects-v2', r: 'welder-results-v1', m: 'welder-meta-v1', a: 'welder-audit-active-v1', entry: {}, start: /Start \/ Continue Audit/,
    areas: [{ id: 'ar', name: 'Workshop', assets: [{ id: 'a1', assetId: 'W1', brand: 'Kemppi', model: 'Mig 300', serial: '1234' }, { id: 'a2', assetId: 'W2', brand: 'Lincoln', model: 'Pro', serial: '5678' }] }],
    marked: { a1: { items: { visual: { result: 'pass' } } } }, meta: au => ({ auditor: au, testDate: DATE }) },
];
export const GATE_SITE_NAMES = { sa: 'Site A items marked', sb: 'Site B started nothing marked', sc: 'Site C never touched' };
// opts.noFlagKey: write NO per-site flag key at all (a pure NEW-format "progress only" case)
export function seedGateData(m, fmt, opts = {}) {
  localStorage.setItem(m.p, JSON.stringify(['sa', 'sb', 'sc'].map(id => ({ id, name: GATE_SITE_NAMES[id], company: '', abn: '', licence: '', areas: m.areas }))));
  localStorage.setItem(m.m, JSON.stringify({ sa: m.meta('Jane'), sb: m.meta('Jane') }));            // sc: no meta at all
  localStorage.setItem(m.r, JSON.stringify({ sa: m.marked }));
  if (fmt === 'new') { if (!opts.noFlagKey) localStorage.setItem(m.a, JSON.stringify({ v: 1, sites: { sa: m.entry, sb: m.entry } })); }
  else if (m.old) localStorage.setItem(m.old[0], JSON.stringify(m.old[1]));
}

// FICTIONAL data only. One builder per export type: localStorage seed, IndexedDB images, per-site logo, and the UI recipe.
const co = { company: 'Example Electrical Pty Ltd', abn: '98 765 432 109', licence: 'EW123456' };
const SITE = 'Example Quarry';
const M = { auditor: 'Jane Auditor', testDate: '2026-09-30', nextTestDate: '2027-09-30', pushDate: '2026-09-30', injectDate: '2026-09-30', nextPushDate: '2026-10-30', nextInjectDate: '2027-09-30', notes: 'Sample notes: all circuits tested with the site electrician present.' };
const df = (n, p = 'H') => ({ defectId: String(100 + n), rectified: 'Scheduled for Repair', rectifiedDate: '2026-10-14', scheduledDate: '2026-10-14', responsibility: 'Site Electrician', priority: p });
const SWB_KEYS = ['enclosure', 'ventilation', 'moisture', 'insulation', 'busbars', 'terminations', 'protection', 'contactors', 'mounting', 'labelling', 'earthing'];
const WELD_KEYS = ['visual', 'clamp', 'leads', 'ir_input', 'ir_exposed', 'ir_above_elv', 'ir_below_elv', 'ir_separate', 'ocv_ac', 'ocv_dc', 'vrd_res', 'vrd_speed'];
const img = (id, w, h, label, hue, store = 'site') => ({ id, w, h, label, hue, store });

function build(mod, variant) {
  const pid = `p-${mod}-${variant}`;
  const logos = variant === 'logo' ? [{ key: `${mod.split('-')[0]}:${pid}`, hue: { rcd: 25, iel: 140, tat: 215, thermo: 15, swb: 280, irt: 200, elt: 170, welder: 330, gsd: 90 }[mod.split('-')[0]] }] : [];
  const out = { pid, logos, images: [], ls: {}, flow: {} };
  const base = { id: pid, name: SITE, ...co };

  if (mod === 'rcd-push' || mod === 'rcd-injection') {
    const inj = mod === 'rcd-injection';
    const circ = n => Array.from({ length: n }, (_, i) => `CB ${i + 1}`);
    const project = { ...base, areas: [
      { id: 'a1', name: 'Wash Plant', panels: [{ id: 'pn1', name: 'MSB 1', circuits: circ(6), circuitMeta: { 'CB 1': { cbType: 'RCBO Type A', ampRating: '16A' }, 'CB 2': { cbType: 'RCBO Type A', ampRating: '20A' }, 'CB 3': { cbType: 'RCD Type A', ampRating: '32A' }, 'CB 4': { cbType: 'RCBO Type AC', ampRating: '16A' } } }] },
      { id: 'a2', name: 'Crusher', panels: [{ id: 'pn2', name: 'MCC 2', circuits: circ(4), circuitMeta: { 'CB 1': { cbType: 'RCD Type A', ampRating: '40A' } } }] }] };
    const mk = (st, n, ex = {}) => inj ? { inject: { status: st, ...(st === 'pass' ? { resultPos: String(10 + n), resultNeg: String(11 + n), comment: n % 2 ? 'Within limits' : '' } : st === 'fail' ? { resultPos: '>300', resultNeg: '24', comment: 'Failed to trip in time', ...df(n) } : {}), ...ex } } : { push: { status: st, ...(st === 'fail' ? { comment: 'Did not trip on push test', ...df(n) } : st === 'pass' && n % 3 === 0 ? { comment: 'Replaced test button cover' } : {}), ...ex } };
    out.ls = { 'rcd-projects-v6': [project], 'rcd-mode-v6': inj ? 'inject' : 'push', 'rcd-meta-v6': { [pid]: M },
      'rcd-results-v6': { [pid]: { a1: { pn1: Object.fromEntries(['pass', 'fail', 'na', 'pass', 'untested', 'pass'].map((s, i) => [`CB ${i + 1}`, mk(s, i + 1)])) }, a2: { pn2: Object.fromEntries(['pass', 'fail', 'pass', 'pass'].map((s, i) => [`CB ${i + 1}`, mk(s, i + 7)])) } } } };
    out.flow = { card: 'RCD TESTING', complete: /Complete (RCD Audit|Push Test|Injection Test)/ };
  }
  if (mod === 'iel') {
    const project = { ...base, areas: [
      { id: 'a1', name: 'Wash Plant', panels: [{ id: 'e1', name: 'estops', circuits: ['x1', 'x2', 'x3', 'x4'], machineNames: { x1: 'Feed Conveyor 1', x2: 'Feed Conveyor 2', x3: 'Screen A', x4: 'Screen B' } }, { id: 'l1', name: 'lanyards', circuits: ['y1', 'y2', 'y3'], machineNames: { y1: 'Overland Conveyor (north)', y2: 'Overland Conveyor (south)', y3: 'Stacker' } }, { id: 'i1', name: 'isolators', circuits: ['z1', 'z2', 'z3'], machineNames: { z1: 'Crusher Isolator', z2: 'Pump House Isolator', z3: 'Wash Plant Main Isolator' } }] },
      { id: 'a2', name: 'Crusher', panels: [{ id: 'e2', name: 'estops', circuits: ['w1', 'w2'], machineNames: { w1: 'Jaw Crusher', w2: 'Cone Crusher' } }] }] };
    const it = (st, n, ex = {}) => ({ status: st, lastTested: '2026-09-30', mechCheck: st === 'pass', circuitIso: st === 'pass', lanyardCond: st === 'pass', notes: st === 'fail' ? 'Reset mechanism sticking' : st === 'pass' && n % 2 ? 'Tested OK' : '', ...(st === 'fail' ? df(n) : {}), ...ex });
    out.ls = { 'iel-projects-v2': [project], 'iel-meta-v2': { [pid]: M },
      'iel-results-v2': { [pid]: { a1: { estops: { x1: it('pass', 1), x2: it('fail', 2), x3: it('na', 3, { lastTested: '' }), x4: it('pass', 4) }, lanyards: { y1: it('pass', 5), y2: it('fail', 6, df(6, 'U')), y3: it('pass', 7) }, isolators: { z1: it('pass', 8), z2: it('pass', 9), z3: it('untested', 10, { lastTested: '' }) } }, a2: { estops: { w1: it('pass', 11), w2: it('fail', 12, df(12, 'M')) } } } } };
    out.flow = { card: 'IEL TESTING', complete: /Complete IEL Audit/ };
  }
  if (mod === 'tat') {
    const items = n => Array.from({ length: n }, (_, i) => `i${i + 1}`);
    const area = (id, name, n, names, freq) => ({ id, name, defaultFreq: freq, items: items(n), itemNames: Object.fromEntries(items(n).map((k, i) => [k, names[i]])), itemTags: Object.fromEntries(items(n).map((k, i) => [k, `${id.toUpperCase()}-${100 + i}`])), itemEquipTypes: Object.fromEntries(items(n).map((k, i) => [k, ['Power Tool', 'Extension Lead', 'Appliance'][i % 3]])), itemFreqs: Object.fromEntries(items(n).map((k) => [k, freq])) });
    const project = { ...base, areas: [area('a1', 'Workshop', 6, ['Angle grinder', 'Cordless drill charger', 'Bench grinder', '15m extension lead', 'Heat gun', 'Portable heater'], '3'), area('a2', 'Site Office', 4, ['Kettle', 'Microwave', 'Desk fan', 'Power board'], '12')] };
    const it = (st, n) => ({ status: st, visualCheck: st === 'fail' ? 'fail' : st === 'pass' ? 'pass' : '', electricalCheck: st === 'fail' ? 'fail' : st === 'pass' ? 'pass' : '', lastTested: st === 'untested' ? '' : '2026-09-30', notes: st === 'fail' ? 'Cord damaged near plug' : st === 'pass' && n % 3 === 0 ? 'Tag renewed' : '', ...(st === 'fail' ? df(n) : {}) });
    out.ls = { 'tat-projects-v1': [project], 'tat-meta-v1': { [pid]: { ...M, machine: 'Test Machine 1 (S/N 0001)' } },
      'tat-results-v1': { [pid]: { a1: Object.fromEntries(['pass', 'pass', 'fail', 'pass', 'na', 'pass'].map((s, i) => [`i${i + 1}`, it(s, i + 1)])), a2: Object.fromEntries(['pass', 'pass', 'untested', 'fail'].map((s, i) => [`i${i + 1}`, it(s, i + 7)])) } } };
    out.flow = { card: 'TEST & TAG', complete: /Complete Test & Tag Audit/ };
  }
  if (mod === 'thermo') {
    const project = { ...base, areas: [{ id: 'a1', name: 'Wash Plant', boards: [{ id: 'b1', name: 'MSB 1', circuits: ['c1', 'c2', 'c3', 'c4'], circuitNames: { c1: 'Main incomer', c2: 'Feed Conveyor 1', c3: 'Screen A', c4: 'Pump 2' } }, { id: 'b2', name: 'DB Lunch Shed', circuits: ['c1', 'c2'], circuitNames: { c1: 'Lighting', c2: 'Kitchen GPOs' } }] }] };
    const ph = (id, result, temp, n, ex = {}) => ({ id, flirFile: String(1000 + n), temp, result, notes: result === 'PASS' ? '' : 'Elevated termination temperature', rectifiedDate: '', ...(result === 'PASS' ? {} : df(n)), ...ex });
    out.ls = { 'thermo-projects-v1': [project], 'thermo-meta-v1': { [pid]: M },
      'thermo-results-v1': { [pid]: { a1: { b1: { c1: [ph('1', 'PASS', '34', 1)], c2: [ph('2', 'FAIL', '78', 2), ph('3', 'PASS', '41', 3)], c3: [ph('4', 'MONITOR', '58', 4)], c4: [ph('5', 'PASS', '36', 5)] }, b2: { c1: [ph('6', 'PASS', '30', 6)], c2: [ph('7', 'FAIL', '71', 7, { priority: 'U' })] } } } } };
    out.flow = { card: 'THERMOGRAPHIC', complete: /Complete Thermographic Audit/ };
  }
  if (mod === 'swb') {
    const project = { ...base, areas: [{ id: 'ar1', name: 'Wash Plant', boards: [{ id: 'b1', name: 'MSB 1' }, { id: 'b2', name: 'DB Lunch Shed' }] }, { id: 'ar2', name: 'Crusher', boards: [{ id: 'b3', name: 'MCC 2' }] }] };
    const board = (pattern, extra = {}, photos = []) => ({ ...Object.fromEntries(SWB_KEYS.map((k, i) => [k, pattern[i] === 'P' ? { status: 'pass' } : pattern[i] === 'F' ? { status: 'fail', comment: 'Needs attention', risk: ['L', 'M', 'H', 'U'][i % 4], ...df(i) } : pattern[i] === 'N' ? { status: 'na' } : { status: 'untested' }])), ...extra, _photos: photos });
    out.images = [img('sw1', 400, 300, 'MSB door', 20), img('sw2', 300, 400, 'Busbar', 180), img('sw3', 400, 300, 'MCC label', 300)];
    out.ls = { 'swb-projects-v1': [project], 'swb-meta-v1': { [pid]: M },
      'swb-results-v1': { [pid]: { ar1: { b1: board('PPPFPPPNPFP', {}, [{ id: 'sw1', w: 400, h: 300 }, { id: 'sw2', w: 300, h: 400 }]), b2: board('PPPPPPPPPPP') }, ar2: { b3: board('PFPPPPFPPPP', {}, [{ id: 'sw3', w: 400, h: 300 }]) } } } };
    out.flow = { card: 'SWITCHBOARD', complete: /Complete Switchboard Audit/ };
  }
  if (mod === 'irt') {
    const project = { ...base, areas: [{ id: 'a1', name: 'Wash Plant', panels: [{ id: 'pn1', name: 'MCC 1', items: ['m1', 'm2', 'm3'], itemNames: { m1: 'Feed pump motor', m2: 'Screen A motor', m3: 'Screen B motor' } }] }, { id: 'a2', name: 'Crusher', panels: [{ id: 'pn2', name: 'MCC 2', items: ['m4', 'm5'], itemNames: { m4: 'Jaw crusher motor', m5: 'Cone crusher motor' } }] }] };
    const good = { L1E: '>200', L2E: '>200', L3E: '>200', NE: '>200', L1L2: '>200', L1L3: '>200', L2L3: '>200', L1N: '>200', L2N: '>200', L3N: '>200' };
    const it = (readings, extra = {}) => ({ status: 'untested', testVoltage: '500V', readings, notes: '', ...extra });
    out.ls = { 'irt-projects-v1': [project], 'irt-meta-v1': { [pid]: M },
      'irt-results-v1': { [pid]: { a1: { pn1: { m1: it(good, { notes: 'Dry' }), m2: it({ L1E: '0.4', L2E: '250', L3E: '250', NE: '300' }, { notes: 'Wet terminal box', ...df(2) }), m3: it({ ...good, L1N: '48' }, { testVoltage: '1000V' }) } }, a2: { pn2: { m4: it(good), m5: it({}) } } } } };
    out.flow = { card: 'INSULATION RESISTANCE TESTING', complete: /Complete IR Testing Audit/ };
  }
  if (mod === 'elt') {
    const asset = (id, loc, al, aid, type, maint, fit) => ({ id, location: loc, assetLocation: al, assetId: aid, type, maintained: maint, fitting: fit });
    const project = { ...base, areas: [
      { id: 'ar1', name: 'Wash Plant', assets: [asset('a1', 'Wash Plant', 'North Door', 'EL-001', 'Emergency Exit Sign', 'Maintained', 'Acme Exit 24m'), asset('a2', 'Wash Plant', 'South Roof', 'EL-002', 'Combination Unit (Sign + 2 Side Lights)', 'Non-Maintained', 'Acme Twin Spots'), asset('a3', 'Wash Plant', 'Walkway', 'EL-003', 'Emergency Exit Sign', 'Maintained', 'Acme Exit 24m')] },
      { id: 'ar2', name: 'Workshop', assets: [asset('a4', 'Workshop', 'Roller Door', 'EL-004', 'Emergency Exit Sign', 'Maintained', 'Beta Slim Exit'), asset('a5', 'Workshop', 'Store Room', 'EL-005', 'Other', 'Non-Maintained', 'Generic LED')] }] };
    const p4 = { visual: 'pass', discharge: 'pass', switching: 'pass', charging: 'pass' };
    out.images = [img('el1', 400, 300, 'Exit sign', 130), img('el2', 300, 400, 'Twin spots', 200), img('el3', 400, 300, 'Roller door', 350)];
    out.ls = { 'elt-projects-v2': [project], 'elt-meta-v1': { [pid]: M },
      'elt-results-v1': { [pid]: { a1: { ...p4, notes: 'Working well', photos: [{ id: 'el1', w: 400, h: 300 }] }, a2: { ...p4, discharge: 'fail', notes: 'Seal cracked', ...df(2), photos: [{ id: 'el2', w: 300, h: 400 }] }, a3: { ...p4 }, a4: { ...p4, visual: 'fail', notes: 'Lens cracked', ...df(4, 'M'), photos: [{ id: 'el3', w: 400, h: 300 }] }, a5: { ...p4, switching: 'pass' } } } };
    out.flow = { card: 'EMERGENCY LIGHTING', complete: /Complete Emergency Lighting Audit/ };
  }
  if (mod === 'welder') {
    const asset = (id, loc, aid, brand, model, serial) => ({ id, location: loc, assetId: aid, brand, model, serial });
    const project = { ...base, areas: [{ id: 'ar1', name: 'Example Workshop', assets: [asset('a1', 'Example Workshop', 'W001', 'Acme', 'WeldMaster 200', 'SN-1001'), asset('a2', 'Example Workshop', 'W002', 'Beta', 'Arc 200', 'SN-1002'), asset('a3', 'Example Workshop', 'W003', 'Gamma', 'Stick 160', 'N/A')] }] };
    const rec = (pattern, extra = {}) => ({ items: Object.fromEntries(WELD_KEYS.map((k, i) => [k, { result: { P: 'pass', F: 'fail', N: 'na', '.': '' }[pattern[i]], value: i === 3 ? '9.9 MΩ' : '', action: pattern[i] === 'F' ? 'Replace damaged lead' : '' }])), ...extra });
    out.images = [img('wd1', 400, 300, 'Welder W001', 45), img('wd2', 300, 400, 'Lead damage', 10)];
    out.ls = { 'welder-projects-v2': [project], 'welder-meta-v1': { [pid]: M },
      'welder-results-v1': { [pid]: { a1: rec('PPPPPNNNPPNN', { notes: 'All good', photos: [{ id: 'wd1', w: 400, h: 300 }] }), a2: rec('PPFPPPPPPPPF', { notes: 'Return to supplier', ...df(2), photos: [{ id: 'wd2', w: 300, h: 400 }] }), a3: rec('PPP.........') } } };
    out.flow = { card: 'WELDER TESTING', complete: /Complete Welder Audit/ };
  }
  if (mod === 'gsd') {
    const project = { ...base, areas: [{ id: 'a1', name: 'Wash Plant' }, { id: 'a2', name: 'Workshop' }, { id: 'a3', name: 'Empty Area' }] };
    const item = (id, areaId, n, photos, ex = {}) => ({ id, areaId, assetLocation: `Location ${n}`, category: 'Cabling / Cable Management', commonDefect: '', description: `Sample defect ${n}: cable sheath damaged and unsupported`, descAuto: '', photos: photos.map((d, i) => ({ id: `${id}p${i}`, w: d[0], h: d[1] })), priority: ['H', 'M', 'U', 'L'][n % 4], responsibility: 'Site Manager', dueDate: '2026-11-15', ...ex });
    const items = [item('g1', 'a1', 1, [[400, 300], [300, 400], [400, 300]]), item('g2', 'a1', 2, [[400, 300]]), item('g3', 'a2', 3, [[300, 400], [400, 300], [400, 300], [300, 400], [400, 300], [400, 300]]), item('g4', 'a2', 4, [])];
    out.images = items.flatMap(it => it.photos.map((p, i) => img(p.id, p.w, p.h, `${it.id} #${i + 1}`, (it.id.charCodeAt(1) * 60 + i * 40) % 360, 'gsd')));
    out.ls = { 'gsd-projects-v1': [project], 'gsd-meta-v1': { [pid]: M }, 'gsd-items-v1': { [pid]: items } };
    out.flow = { card: 'GENERAL SITE DEFECTS', complete: 'Complete Site Defects Audit' };
  }
  return out;
}
module.exports = { build, SITE, ALL: ['rcd-push', 'rcd-injection', 'iel', 'tat', 'thermo', 'swb', 'irt', 'elt', 'welder', 'gsd'] };

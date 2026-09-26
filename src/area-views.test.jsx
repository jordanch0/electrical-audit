// Site -> Area -> Assets (ELT + Welder) through the real UI: v1 flat data opens migrated, Audit / Report / History are grouped by
// area, Manage adds / renames / moves / deletes within areas, and delete cleans up the deleted assets' results (a deliberate
// improvement over the older modules, which leave orphaned results and photos behind).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { WELDER_CHECKLIST, migrateProjectToAreas as toAreas, eltRegisterRows, welderRegisterRows, exportELTExcel, exportWelderExcel } from './App.jsx';
import ExcelJS from 'exceljs';

const keys = WELDER_CHECKLIST.map(c => c.key);
const PHOTO = [{ id: 'ph', dataUrl: 'data:image/jpeg;base64,AAAA' }];
const MODS = {
  elt: {
    name: 'ELT', card: 'EMERGENCY LIGHTING', noun: 'fitting', Noun: 'Fitting', placeholder: 'e.g. SE Door', title: n => `Door ${n}`,
    flat: (id, loc, n) => ({ id, location: loc, assetLocation: `Door ${n}`, assetId: '', type: 'Emergency Exit Sign', typeOther: '', maintained: 'Maintained', fitting: '' }),
    bare: (id, n) => ({ id, assetLocation: `Door ${n}`, assetId: '', type: 'Emergency Exit Sign', typeOther: '', maintained: 'Maintained', fitting: '' }),
    tested: () => ({ visual: 'pass', discharge: 'pass', switching: 'pass', charging: 'pass' }),
  },
  welder: {
    name: 'Welder', card: 'WELDER TESTING', noun: 'welder', Noun: 'Welder', placeholder: 'e.g. W001', title: n => `W${n}`,
    flat: (id, loc, n) => ({ id, location: loc, assetId: `W${n}`, brand: 'B', model: 'M', serial: '1' }),
    bare: (id, n) => ({ id, assetId: `W${n}`, brand: 'B', model: 'M', serial: '1' }),
    tested: () => ({ date: '2026-07-13', items: Object.fromEntries(keys.map(k => [k, { result: 'pass', value: '', action: '' }])) }),
  },
};
const ls = k => JSON.parse(localStorage.getItem(k));
const meta = { p1: { auditor: 'Jane', testDate: '2026-07-13', nextTestDate: '2026-10-13' } };
let payload;
beforeEach(() => { localStorage.clear(); payload = null; window.webkit = { messageHandlers: { shareFile: { postMessage: p => { payload = p; } } } }; });
afterEach(() => { cleanup(); delete window.webkit; });

async function openSite(user, m, tab) {
  render(<AppRoot />);
  await user.click(screen.getByText(m.card));
  await user.click(await screen.findByText('Site A', { selector: 'div' }));
  if (tab) await user.click(screen.getByRole('button', { name: tab }));
}
const areaNames = () => [...document.querySelectorAll('[data-area]')].map(e => e.getAttribute('data-area'));

describe.each(Object.values(MODS))('$name: Site -> Area -> Assets', m => {
  const p = k => `${m.name.toLowerCase()}-${k}`;

  it('opens v1 FLAT data migrated: same-Location assets share ONE area; Audit is grouped by area; v1 key untouched, v2 written', async () => {
    const user = userEvent.setup();
    const flat = { id: 'p1', name: 'Site A', company: '', abn: '', licence: '', assets: [
      m.flat('n1', 'Shed', 1), m.flat('n2', 'Yard', 2), m.flat('n3', 'shed ', 3), m.flat('n4', '', 4), m.flat('n5', 'Yard', 5) ] };
    const raw = JSON.stringify([flat]);
    localStorage.setItem(p('projects-v1'), raw);
    localStorage.setItem(p('meta-v1'), JSON.stringify(meta));
    await openSite(user, m, 'Audit');
    expect(areaNames()).toEqual(['Shed', 'Yard', 'Site A']);                        // 3 areas — not 5, not 4
    const shed = within(document.querySelector('[data-area="Shed"]'));
    expect(shed.getByText(new RegExp(`2 ${m.noun}s · 0 tested`))).toBeInTheDocument();
    expect(shed.getAllByRole('button').map(b => b.textContent)).toEqual([expect.stringContaining(m.title(1)), expect.stringContaining(m.title(3))]);
    expect(within(document.querySelector('[data-area="Site A"]')).getByText(new RegExp(`1 ${m.noun} · 0 tested`))).toBeInTheDocument(); // blank Location -> site-name area
    await waitFor(() => expect(ls(p('projects-v2'))).toHaveLength(1));
    const v2 = ls(p('projects-v2'))[0];
    expect(v2.assets).toBeUndefined();
    expect(v2.areas.map(a => [a.name, a.assets.map(x => x.id)])).toEqual([['Shed', ['n1', 'n3']], ['Yard', ['n2', 'n5']], ['Site A', ['n4']]]);
    expect(v2.areas.flatMap(a => a.assets).every(a => !('location' in a))).toBe(true);
    expect(localStorage.getItem(p('projects-v1'))).toBe(raw);                        // old key never written
  });

  it('Manage: add / rename / move / delete inside areas; duplicate names refused; delete cleans up results + photos', async () => {
    const user = userEvent.setup();
    const proj = { id: 'p1', name: 'Site A', company: '', abn: '', licence: '', areas: [
      { id: 'area-shed', name: 'Shed', assets: [m.bare('n1', 1)] },
      { id: 'area-yard', name: 'Yard', assets: [m.bare('n2', 2)] },
      { id: 'area-office', name: 'Office', assets: [m.bare('n3', 3)] } ] };
    localStorage.setItem(p('projects-v2'), JSON.stringify([proj]));
    localStorage.setItem(p('meta-v1'), JSON.stringify(meta));
    localStorage.setItem(p('results-v1'), JSON.stringify({ p1: { n1: { ...m.tested(), photos: PHOTO }, n2: { ...m.tested(), photos: PHOTO }, n3: { ...m.tested(), photos: PHOTO } } }));
    await openSite(user, m, 'Manage');
    const areas = () => ls(p('projects-v2'))[0].areas;
    const newArea = screen.getByPlaceholderText('New area / location name');

    // duplicate area name (case-insensitive) is refused
    await user.type(newArea, 'shed');
    await user.click(screen.getByRole('button', { name: '+ Add Area' }));
    expect(screen.getByText(/already exists/)).toBeInTheDocument();
    expect(areas().map(a => a.name)).toEqual(['Shed', 'Yard', 'Office']);

    // add a new area, then an asset INSIDE it (no Location field on the form)
    await user.clear(newArea); await user.type(newArea, 'Roof');
    await user.click(screen.getByRole('button', { name: '+ Add Area' }));
    await waitFor(() => expect(areas().map(a => a.name)).toEqual(['Shed', 'Yard', 'Office', 'Roof']));
    await user.click(screen.getByRole('button', { name: `+ Add ${m.Noun}` }));
    expect(screen.queryByText('LOCATION')).toBeNull(); expect(screen.queryByText('LOCATION (SITE)')).toBeNull();
    await user.type(screen.getByPlaceholderText(m.placeholder), m.name === 'ELT' ? 'Hatch' : 'W9');
    await user.click(screen.getAllByRole('button', { name: `+ Add ${m.Noun}` }).pop());
    await waitFor(() => expect(areas()[3].assets).toHaveLength(1));
    expect(areas()[3].assets[0]).toMatchObject(m.name === 'ELT' ? { assetLocation: 'Hatch' } : { assetId: 'W9' });
    expect(areas()[3].assets[0]).not.toHaveProperty('location');

    // rename: a duplicate name is refused, a fresh name is accepted
    await user.click(screen.getByRole('button', { name: 'Rename area Yard' }));
    const rename = screen.getByLabelText('Area name');
    await user.clear(rename); await user.type(rename, 'SHED');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(/already exists/)).toBeInTheDocument();
    expect(areas()[1].name).toBe('Yard');
    await user.clear(rename); await user.type(rename, 'Loading Dock');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(areas()[1].name).toBe('Loading Dock'));
    expect(areas()[1].id).toBe('area-yard');                                        // id is stable across a rename

    // move an asset to another area from its edit form — same id, results follow (they are keyed by asset id)
    await user.click(screen.getByText('Shed'));
    await user.click(screen.getByRole('button', { name: `Edit ${m.title(1)}` }));
    await user.selectOptions(screen.getByLabelText('Area'), 'area-office');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(areas()[0].assets).toHaveLength(0));
    expect(areas()[2].assets.map(a => a.id)).toEqual(['n3', 'n1']);
    expect(ls(p('results-v1')).p1.n1.photos).toEqual(PHOTO);

    // deleting an asset: Keep leaves everything; Delete removes it AND its results / photos — others untouched
    // (the move already expanded the destination area)
    const grp = () => screen.getByRole('group', { name: `Delete ${m.noun} ${m.title(1)}` });
    await user.click(within(grp()).getAllByRole('button')[0]);
    await user.click(within(grp()).getByRole('button', { name: 'Keep' }));
    expect(areas()[2].assets.map(a => a.id)).toEqual(['n3', 'n1']);
    await user.click(within(grp()).getAllByRole('button')[0]);
    await user.click(within(grp()).getByRole('button', { name: 'Keep' }).previousElementSibling); // confirm button sits just before Keep
    await waitFor(() => expect(areas()[2].assets.map(a => a.id)).toEqual(['n3']));
    expect(Object.keys(ls(p('results-v1')).p1).sort()).toEqual(['n2', 'n3']);       // n1's results + photo are gone

    // deleting an area removes its assets and their results
    const areaGrp = () => screen.getByRole('group', { name: 'Delete area Loading Dock' });
    await user.click(within(areaGrp()).getAllByRole('button')[0]);
    await user.click(within(areaGrp()).getByRole('button', { name: 'Keep' }));
    expect(areas().map(a => a.name)).toContain('Loading Dock');
    await user.click(within(areaGrp()).getAllByRole('button')[0]);
    await user.click(within(areaGrp()).getByRole('button', { name: 'Keep' }).previousElementSibling);
    await waitFor(() => expect(areas().map(a => a.name)).toEqual(['Shed', 'Office', 'Roof']));
    expect(Object.keys(ls(p('results-v1')).p1)).toEqual(['n3']);                    // n2 (was in the deleted area) is gone; n3 untouched
  });

  it('Report: AREA SUMMARY per area and the register ordered by area; History snapshot stores + shows areas', async () => {
    const user = userEvent.setup();
    const flat = { id: 'p1', name: 'Site A', company: '', abn: '', licence: '', assets: [m.flat('n1', 'Shed', 1), m.flat('n2', 'Yard', 2), m.flat('n3', 'Shed', 3)] };
    localStorage.setItem(p('projects-v1'), JSON.stringify([flat]));
    localStorage.setItem(p('meta-v1'), JSON.stringify(meta));
    localStorage.setItem(p('results-v1'), JSON.stringify({ p1: { n1: m.tested(), n2: m.tested(), n3: m.tested() } }));
    await openSite(user, m, 'Report');
    expect(screen.getByText('AREA SUMMARY')).toBeInTheDocument();
    // interleaved input (Shed, Yard, Shed) -> Location column reads Shed, Shed, Yard
    const locations = [...document.querySelectorAll('tbody tr')].map(tr => tr.querySelectorAll('td')[m.name === 'ELT' ? 1 : 0].textContent);   // ELT's first column is the # cross-reference
    expect(locations).toEqual(['Shed', 'Shed', 'Yard']);

    await user.click(screen.getByRole('button', { name: /^Home$/ }));
    await user.click(await screen.findByRole('button', { name: new RegExp(`Complete ${m.name === 'ELT' ? 'Emergency Lighting' : 'Welder'} Audit`) }));
    await user.click(screen.getByRole('button', { name: /Yes, Complete/ }));
    await waitFor(() => expect(ls(p('history-v2'))).toHaveLength(1));
    const snap = ls(p('history-v2'))[0];
    expect(snap.assets).toBeUndefined();
    expect(snap.areas.map(a => [a.name, a.assets.map(x => x.id)])).toEqual([['Shed', ['n1', 'n3']], ['Yard', ['n2']]]);
    await user.click(screen.getByRole('button', { name: /History/ }));
    await user.click(await screen.findByText(m.name === 'ELT' ? 'Emergency Lighting Audit' : 'Welder Audit'));
    await user.click(screen.getByRole('button', { name: 'View Results' }));
    expect(areaNames()).toEqual(['Shed', 'Yard']);
  });
});

describe('export order = area order', () => {
  const interleavedElt = toAreas({ id: 'p1', name: 'Site A', company: 'Co', abn: '', licence: '', assets: [
    MODS.elt.flat('a1', 'North Bay', 1), MODS.elt.flat('a2', 'Yard', 2), MODS.elt.flat('a3', 'North Bay', 3), MODS.elt.flat('a4', 'yard', 4) ] });
  const interleavedWelder = toAreas({ id: 'p1', name: 'Site A', company: 'Co', abn: '', licence: '', assets: [
    MODS.welder.flat('a1', 'North Bay', 1), MODS.welder.flat('a2', 'Yard', 2), MODS.welder.flat('a3', 'North Bay', 3), MODS.welder.flat('a4', 'yard', 4) ] });
  const load = async () => { await waitFor(() => expect(payload).toBeTruthy()); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(payload.base64, 'base64')); return wb; };
  const col = (ws, c, from, n) => Array.from({ length: n }, (_, i) => String(ws.getCell(c + (from + i)).value || ''));

  it('ELT register: rows grouped by area (Location column), original order kept within an area', async () => {
    const res = { p1: Object.fromEntries(['a1', 'a2', 'a3', 'a4'].map(id => [id, MODS.elt.tested()])) };
    expect(eltRegisterRows(interleavedElt, res, {}).map(r => [r.cells[1], r.cells[2]])).toEqual([['North Bay', 'Door 1'], ['North Bay', 'Door 3'], ['Yard', 'Door 2'], ['Yard', 'Door 4']]);
    await exportELTExcel(interleavedElt, res, { auditor: 'J', testDate: '2026-07-13', nextTestDate: '2027-01-13' });
    const ws = (await load()).getWorksheet('Emergency Lighting');
    expect(col(ws, 'B', 6, 4)).toEqual(['North Bay', 'North Bay', 'Yard', 'Yard']);
    expect(col(ws, 'C', 6, 4)).toEqual(['Door 1', 'Door 3', 'Door 2', 'Door 4']);
  });

  it('Welder register AND the per-welder sheets follow area order', async () => {
    expect(welderRegisterRows(interleavedWelder, {}, {}).map(r => [r.cells[0], r.cells[1]])).toEqual([['North Bay', 'W1'], ['North Bay', 'W3'], ['Yard', 'W2'], ['Yard', 'W4']]);
    await exportWelderExcel(interleavedWelder, {}, { auditor: 'J', testDate: '2026-07-13', nextTestDate: '2026-10-13' });
    const wb = await load();
    expect(col(wb.getWorksheet('Register'), 'A', 6, 4)).toEqual(['North Bay', 'North Bay', 'Yard', 'Yard']);
    expect(wb.worksheets.map(w => w.name)).toEqual(['Register', 'W1', 'W3', 'W2', 'W4']);
    // each welder sheet's header reads its AREA name as Location (the asset itself no longer stores one)
    expect(['W1', 'W3', 'W2', 'W4'].map(n => String(wb.getWorksheet(n).getCell('A3').value))).toEqual(['Location: North Bay', 'Location: North Bay', 'Location: Yard', 'Location: Yard']);
  });

  it('ELT Photos sheet is also in area order, labelled with the area name', async () => {
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const res = { p1: { a4: { ...MODS.elt.tested(), photos: [{ id: '1', dataUrl: PNG }] }, a1: { ...MODS.elt.tested(), photos: [{ id: '2', dataUrl: PNG }] } } };
    await exportELTExcel(interleavedElt, res, { auditor: 'J', testDate: '2026-07-13', nextTestDate: '2027-01-13' });
    const ws = (await load()).getWorksheet('Photos');
    expect([2, 3].map(r => [String(ws.getCell('A' + r).value), String(ws.getCell('B' + r).value)])).toEqual([['North Bay', 'Door 1'], ['Yard', 'Door 4']]);
  });
});

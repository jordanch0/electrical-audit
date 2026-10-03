// STATUS PILL LOCATIONS (2026-10-02): every place in the app that shows status counts, in the REAL UI (seeded fictional data, real clicks), must show the module's FULL pill set
// in the ONE fixed order, zeros included — never a partial set, a fraction ("5 / 6", "3 of 12", "N tested") or a bare count ("2 pass · 1 fail", "0P 1F", "N untested").
//   full   (RCD, IEL, TAT, SWB, IRT) : PASS FAIL N/A UNTESTED|— [SCORE: SWB only]
//   noNA   (ELT, Welder)             : PASS FAIL UNTESTED|—
//   thermo                           : PASS FAIL MONITOR
// Pills are STATUS ONLY: there is NO TOTAL pill anywhere. The item count is plain text with the module's unit ("6 items", "33 checklist points", "7 photos"), shown exactly ONCE per location.
// This list IS the matrix from the audit: add a location here when a screen gains counts.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import AppRoot from './App.jsx';
import seed from './test/pill-seed.cjs';

const { build, SITE } = seed;
const ROW = {
  full: /^\d+ PASS \| \d+ FAIL \| \d+ N\/A \| \d+ (UNTESTED|—)( \| ([\d.]+% SCORE|— SCORE))?$/,
  noNA: /^\d+ PASS \| \d+ FAIL \| \d+ (UNTESTED|—)$/,
  thermo: /^\d+ PASS \| \d+ FAIL \| \d+ MONITOR$/,
  noNAScore: /^\d+ PASS \| \d+ FAIL \| \d+ (UNTESTED|—) \| ([\d.]+% SCORE|— SCORE)$/,
};
// [module key for the seed, model, screen name, steps, options]   steps: btn:X (button) · t:X (first text) · T:X (last text) · complete:X (complete + confirm)
//   site: false = stay on the site list   min: minimum pill rows on the screen   noBadge: no bare FAIL / "N FAIL" text outside a pill
//   counts: { 'N unit': times } — the plain-text item count(s) the screen shows, EACH exactly that many times (once per row / card / header)
const L = (mod, model, name, steps, o = {}) => ({ mod, model, name, steps, ...o });
const LOCATIONS = [
  // RCD
  L('rcd-push', 'full', 'RCD site list', [], { site: false, min: 1, noBadge: true, counts: { '10 circuits': 1 } }), L('rcd-push', 'full', 'RCD areas', ['t:Push Test'], { min: 2, noBadge: true, counts: { '6 circuits': 1, '4 circuits': 1 } }),
  L('rcd-push', 'full', 'RCD panels', ['t:Push Test', 't:Wash Plant'], { min: 1, noBadge: true, counts: { '6 circuits': 1 } }), L('rcd-push', 'full', 'RCD circuit header', ['t:Push Test', 't:Wash Plant', 't:MSB 1'], { min: 1, counts: { '6 circuits': 1 } }),
  L('rcd-push', 'full', 'RCD history', ['complete:Complete Push Test', 'btn:History'], { min: 1, noBadge: true, counts: { '10 circuits': 1 } }), L('rcd-push', 'full', 'RCD home (no fractions)', [], { min: 0, noPattern: true }),
  // IEL
  L('iel', 'full', 'IEL site list', [], { site: false, min: 1, noBadge: true, counts: { '12 items': 1 } }), L('iel', 'full', 'IEL home category rows', [], { min: 3, counts: { '6 items': 1, '3 items': 2 } }),
  L('iel', 'full', 'IEL areas', ['t:E-Stops'], { min: 2, noBadge: true, counts: { '4 items': 1, '2 items': 1 } }), L('iel', 'full', 'IEL panels', ['t:E-Stops', 't:Wash Plant'], { min: 1, noBadge: true, counts: { '4 items': 1 } }),
  L('iel', 'full', 'IEL item-grid header', ['t:E-Stops', 't:Wash Plant', 'T:E-Stops'], { min: 1, counts: { '4 items': 1 } }), L('iel', 'full', 'IEL history', ['complete:Complete IEL Audit', 'btn:History'], { min: 1, noBadge: true, counts: { '12 items': 1 } }),
  // TAT
  L('tat', 'full', 'TAT site list', [], { site: false, min: 1, noBadge: true, counts: { '10 items': 1 } }), L('tat', 'full', 'TAT home', [], { min: 1, counts: { '10 items': 1 } }), L('tat', 'full', 'TAT areas', ['btn:Audit'], { min: 2, noBadge: true, counts: { '6 items': 1, '4 items': 1 } }),
  L('tat', 'full', 'TAT item-grid header', ['btn:Audit', 't:Workshop'], { min: 1, counts: { '6 items': 1 } }), L('tat', 'full', 'TAT report (summary + area rows)', ['btn:Report'], { min: 3, counts: { '10 items': 1, '6 items': 1, '4 items': 1 } }),
  L('tat', 'full', 'TAT history', ['complete:Complete Test & Tag Audit', 'btn:History'], { min: 1, noBadge: true, counts: { '10 items': 1 } }),
  // SWB
  L('swb', 'full', 'SWB site list', [], { site: false, min: 1, noBadge: true, counts: { '3 boards': 1 } }), L('swb', 'full', 'SWB home', [], { min: 1, counts: { '33 checklist points': 1 } }), L('swb', 'full', 'SWB areas', ['btn:Audit'], { min: 2, noBadge: true, counts: { '2 boards': 1, '1 board': 1 } }),
  L('swb', 'full', 'SWB boards', ['btn:Audit', 't:Wash Plant'], { min: 2, noBadge: true }), L('swb', 'full', 'SWB board page', ['btn:Audit', 't:Wash Plant', 't:MSB 1'], { min: 1 }),
  L('swb', 'full', 'SWB report board rows', ['btn:Report'], { min: 3 }), L('swb', 'full', 'SWB history', ['complete:Complete Switchboard Audit', 'btn:History'], { min: 1, noBadge: true, counts: { '33 checklist points': 1 } }),
  // ELT
  L('elt', 'noNA', 'ELT site list', [], { site: false, min: 1, noBadge: true, counts: { '5 fittings': 1 } }), L('elt', 'noNA', 'ELT home', [], { min: 1, counts: { '5 fittings': 1 } }),
  L('elt', 'noNA', 'ELT audit list (header + area groups)', ['btn:Audit'], { min: 3, counts: { '3 fittings': 1, '2 fittings': 1 } }),
  L('elt', 'noNA', 'ELT report (summary + area rows)', ['btn:Report'], { min: 3, counts: { '3 fittings': 1, '2 fittings': 1 } }), L('elt', 'noNA', 'ELT history', ['complete:Complete Emergency Lighting Audit', 'btn:History'], { min: 1, noBadge: true, counts: { '5 fittings': 1 } }),
  // Welder
  L('welder', 'noNA', 'Welder site list', [], { site: false, min: 1, noBadge: true, counts: { '3 welders': 1 } }), L('welder', 'noNA', 'Welder home', [], { min: 1, counts: { '3 welders': 1 } }),
  L('welder', 'noNA', 'Welder audit list (header + area groups)', ['btn:Audit'], { min: 2, counts: { '3 welders': 1 } }),
  L('welder', 'noNA', 'Welder report (summary + area row)', ['btn:Report'], { min: 2, counts: { '3 welders': 1 } }), L('welder', 'noNA', 'Welder history', ['complete:Complete Welder Audit', 'btn:History'], { min: 1, noBadge: true, counts: { '3 welders': 1 } }),
  // IRT
  L('irt', 'full', 'IRT site list', [], { site: false, min: 1, noBadge: true, counts: { '5 items': 1 } }), L('irt', 'full', 'IRT home', [], { min: 1, counts: { '5 items': 1 } }), L('irt', 'full', 'IRT areas', ['btn:Audit'], { min: 2, noBadge: true, counts: { '3 items': 1, '2 items': 1 } }),
  L('irt', 'full', 'IRT panels', ['btn:Audit', 't:Wash Plant'], { min: 1, noBadge: true, counts: { '3 items': 1 } }), L('irt', 'full', 'IRT report panel rows', ['btn:Report'], { min: 2 }),
  L('irt', 'full', 'IRT history', ['complete:Complete IR Testing Audit', 'btn:History'], { min: 1, noBadge: true, counts: { '5 items': 1 } }),
  // Thermo
  L('thermo', 'thermo', 'Thermo site list', [], { site: false, min: 1, noBadge: true, counts: { '7 photos': 1 } }), L('thermo', 'thermo', 'Thermo home', [], { min: 1, counts: { '7 photos': 1 } }),
  L('thermo', 'thermo', 'Thermo areas', ['btn:Audit'], { min: 1, noBadge: true, counts: { '7 photos': 1 } }), L('thermo', 'thermo', 'Thermo boards', ['btn:Audit', 't:Wash Plant'], { min: 2, noBadge: true, counts: { '5 photos': 1, '2 photos': 1 } }),
  L('thermo', 'thermo', 'Thermo report board rows', ['btn:Report'], { min: 2 }), L('thermo', 'thermo', 'Thermo history', ['complete:Complete Thermographic Audit', 'btn:History'], { min: 1, noBadge: true, counts: { '7 photos': 1 } }),
  // ---- TILE screens (commit b): Report summaries, History snapshot summaries, ELT / Welder asset pages — status pills only, count as text once
  L('rcd-push', 'full', 'RCD report (both modes)', ['btn:Report'], { min: 2, counts: { '10 circuits': 2 } }),
  L('rcd-push', 'full', 'RCD history snapshot summary', ['complete:Complete Push Test', 'btn:History', 'r:^Archived ', 'btn:View Results'], { min: 1 }),
  L('iel', 'full', 'IEL report (per category)', ['btn:Report'], { min: 3, counts: { '6 items': 1, '3 items': 2 } }),
  L('iel', 'full', 'IEL history snapshot summary', ['complete:Complete IEL Audit', 'btn:History', 'r:^Archived ', 'btn:View Results'], { min: 1 }),
  L('tat', 'full', 'TAT history snapshot summary', ['complete:Complete Test & Tag Audit', 'btn:History', 'r:^Archived ', 'btn:View Results'], { min: 1 }),
  L('swb', 'full', 'SWB report (summary + board rows)', ['btn:Report'], { min: 4, counts: { '33 checklist points': 1 } }),
  L('swb', 'full', 'SWB history snapshot summary', ['complete:Complete Switchboard Audit', 'btn:History', 'r:^Archived ', 'btn:View Results'], { min: 1 }),
  L('elt', 'noNAScore', 'ELT asset page', ['btn:Audit', 't:North Door'], { min: 1 }),
  L('elt', 'noNA', 'ELT history snapshot summary', ['complete:Complete Emergency Lighting Audit', 'btn:History', 'r:^Archived ', 'btn:View Results'], { min: 1 }),
  L('welder', 'full', 'Welder asset page (PASS FAIL N/A — SCORE)', ['btn:Audit', 't:W002'], { min: 1 }),
  L('welder', 'noNA', 'Welder history snapshot summary', ['complete:Complete Welder Audit', 'btn:History', 'r:^Archived ', 'btn:View Results'], { min: 1 }),
  L('irt', 'full', 'IRT report (summary + panel rows)', ['btn:Report'], { min: 3, counts: { '5 items': 1 } }),
  L('irt', 'full', 'IRT history snapshot summary', ['complete:Complete IR Testing Audit', 'btn:History', 'r:^Archived ', 'btn:View Results'], { min: 1 }),
  L('thermo', 'thermo', 'Thermo report (summary + board rows)', ['btn:Report'], { min: 3, counts: { '7 photos': 1 } }),
  L('thermo', 'thermo', 'Thermo history snapshot summary', ['complete:Complete Thermographic Audit', 'btn:History', 'r:^Archived ', 'btn:View'], { min: 1 }),
];

const leafTexts = root => [...root.querySelectorAll('div,span,button,p,td')].filter(e => !e.querySelector('div,span,button') && !e.closest('[data-statuspill]') && !e.closest('nav') && e.textContent.trim()).map(e => e.textContent.trim().replace(/\s+/g, ' '));
const BAD = [/\b\d+\s*\/\s*\d+\b(?!\s*\/\s*\d)/, /\b\d+ of \d+\b/, /\b\d+ tested\b/i, /\d+ (pass|fail|untested|N\/A) ·/i, /^\d+ ?(P|F|U)$/, /· \d+ tested/i];
const isDate = t => /\d{1,2}\/\d{1,2}\/\d{4}/.test(t);

afterEach(() => cleanup());
async function open(loc) {
  cleanup(); localStorage.clear(); const d = build(loc.mod, 'nologo'); Object.entries(d.ls).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  const user = userEvent.setup(); render(<AppRoot />); await user.click(await screen.findByText(d.flow.card));
  if (loc.site !== false) { await user.click((await screen.findAllByText(SITE, { selector: 'div' }))[0]); await new Promise(r => setTimeout(r, 80)); }
  for (const s of loc.steps) {
    if (s.startsWith('btn:')) await user.click((await screen.findAllByRole('button', { name: s.slice(4) }))[0]);
    else if (s.startsWith('t:')) await user.click((await screen.findAllByText(s.slice(2)))[0]);
    else if (s.startsWith('r:')) await user.click((await screen.findAllByText(new RegExp(s.slice(2))))[0]);
    else if (s.startsWith('T:')) { const a = await screen.findAllByText(s.slice(2)); await user.click(a[a.length - 1]); }
    else if (s.startsWith('complete:')) { await user.click((await screen.findAllByRole('button', { name: new RegExp(s.slice(9)) }))[0]); await user.click((await screen.findAllByRole('button', { name: /Yes, Complete/ }))[0]); await new Promise(r => setTimeout(r, 150)); }
    await new Promise(r => setTimeout(r, 60));
  }
  return d;
}

describe('every counting location shows the FULL status-pill set, in order — no partial set, fraction, bare count or TOTAL pill, and the item count once as text', () => {
  it.each(LOCATIONS)('$name', async loc => {
    await open(loc);
    const main = document.querySelector('main') || document.body;
    const rows = [...main.querySelectorAll('[data-statuspills]')].map(r => [...r.querySelectorAll('[data-statuspill]')].map(p => p.textContent));
    expect(rows.length, 'pill rows on ' + loc.name).toBeGreaterThanOrEqual(loc.min);
    rows.forEach(r => { if (!loc.noPattern) expect(r.join(' | '), loc.name).toMatch(ROW[loc.model]); });
    expect(document.querySelector('[data-statuspill="total"]'), loc.name + ': no TOTAL pill').toBeNull();
    expect([...document.querySelectorAll('[data-statuspill]')].filter(p => /TOTAL|^d+ TESTED$|FITTINGS|WELDERS/.test(p.textContent)).map(p => p.textContent), loc.name + ': no TOTAL / TESTED / FITTINGS / WELDERS pill').toEqual([]);
    const all = leafTexts(main); const texts = all.filter(t => !isDate(t));
    BAD.forEach(re => expect(texts.filter(t => re.test(t)), loc.name + ' must not show ' + re).toEqual([]));
    if (loc.noBadge) expect(texts.filter(t => /^(\d+ )?FAIL$/.test(t)), loc.name + ': no separate FAIL badge next to the FAIL pill').toEqual([]);
    Object.entries(loc.counts || {}).forEach(([txt, n]) => {
      const re = new RegExp('(^|[^\\d])' + txt.replace(/ /g, '\\s') + '\\b');
      expect(all.filter(t => re.test(t)).length, `${loc.name}: "${txt}" appears exactly ${n}x as text`).toBe(n);
    });
  }, 30000);
});

describe('Home progress cards: plain item count in the header (no pill, no fraction), the module set below', () => {
  it.each([['tat', '10 items'], ['swb', '33 checklist points'], ['irt', '5 items'], ['elt', '5 fittings'], ['welder', '3 welders'], ['thermo', '7 photos']])('%s', async (mod, count) => {
    await open({ mod, steps: [] });
    const card = [...document.querySelectorAll('[data-statuspills]')][0]; expect(card).toBeTruthy();
    expect(card.parentElement.textContent).toContain(count);                       // the count is in the same card ...
    expect(card.parentElement.querySelector('[data-statuspill="total"]')).toBeNull(); // ... as text, not as a pill
  }, 30000);
});

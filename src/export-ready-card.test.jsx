// THE COMPACT READY CARD (release t, design D2). FICTIONAL names. ONE card for all nine modules: the title, the file name on one small line (long names shortened in the middle for the eye, the full name for a screen reader),
// one short line, then Share file and Discard this file side by side, both 44 px high, inside the card. The cancelled state is the same layout with its own title and line. jsdom has no layout, so this file checks the
// DOM, the inline styles that decide the layout and the colours (computed from the real BACKUP_UI values); the layout itself (one row at 320 and 390 wide, neither button wrapping, both 44 px, the row inside the card) was
// measured in real Chrome and is in report-t2-build.txt. Delivery behaviour (share, cancel, refuse, discard) stays in export-share-delivery / export-share-modules.
import fs from 'node:fs';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { runExport, ExportBtn, ExportFailureCard, BACKUP_UI } from './App.jsx';
import { phoneOn, phoneOff, abortError, SAMPLE_B64 } from './test/share-env.js';

const SRC = fs.readFileSync(process.cwd() + '/src/App.jsx', 'utf8');
const STYLE = { padding: '5px 10px', background: 'transparent', border: '1px solid #d4d4d8', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#14532d' };
const Harness = ({ scope, fn }) => <div><ExportBtn scope={scope} style={STYLE} run={() => runExport(scope, fn)}>Export</ExportBtn><ExportFailureCard scope={scope} /></div>;
let n = 0; const scope = (p = 'iel') => p + ':snap:ZQ' + (++n);
const file = name => h => { h(SAMPLE_B64, name); };
beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); phoneOff(); });
async function ready(name = 'IEL_Example_Quarry_2026-10-20.xlsx', sc = scope(), share) {
  phoneOn(share ? { share } : {}); const user = userEvent.setup(); render(<Harness scope={sc} fn={file(name)} />); await user.click(screen.getByRole('button', { name: 'Export' })); return { user, card: await screen.findByTestId('export-ready') };
}

// WCAG contrast of two hex colours
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = h => { const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * lin(v[0]) + 0.7152 * lin(v[1]) + 0.0722 * lin(v[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hexOfRgb = s => { const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(s); return m ? '#' + [1, 2, 3].map(i => (+m[i]).toString(16).padStart(2, '0')).join('') : s; };

describe('the file name: short for the eye, whole for a screen reader', () => {
  const NAMES = [
    ['a short name is untouched', 'IEL_Plant_Rooms_2026-10-20.xlsx', 'IEL_Plant_Rooms_2026-10-20.xlsx'],
    ['a name of exactly 31 characters is untouched', 'A'.repeat(26) + '.xlsx', 'A'.repeat(26) + '.xlsx'],
    ['a name of 32 characters is cut in the middle (first 16, an ellipsis, last 14)', 'A'.repeat(16) + 'MIDDLE' + 'B'.repeat(4) + '1234567890.xlsx'.slice(0), 'A'.repeat(16) + '…' + ('MIDDLE' + 'B'.repeat(4) + '1234567890.xlsx').slice(-14)],
    ['a long name keeps the start and the date and type at the end', 'IEL_Ross_&_Sons_(East)_2026-10-20.xlsx', 'IEL_Ross_&_Sons_…026-10-20.xlsx'],
    ['a very long name is still one short line', 'Site_Defects_' + 'Long_Quarry_Name_'.repeat(6) + '2026-10-20.xlsx', 'Site_Defects_Lon…026-10-20.xlsx'],
  ];
  it.each(NAMES)('%s', async (_t, name, shown) => {
    const { card } = await ready(name); const box = card.querySelector('[data-testid="export-ready-name"]'); const [eye, ear] = box.children;
    expect(eye.getAttribute('aria-hidden')).toBe('true'); expect(eye.textContent).toBe(shown); expect(ear.textContent).toBe(name); expect(ear.style.position).toBe('absolute'); expect(ear.style.overflow).toBe('hidden'); expect(ear.style.whiteSpace).toBe('nowrap');
    expect(eye.textContent.length).toBeLessThanOrEqual(31); expect(box.style.fontSize).toBe('11px');
  });
  it('a name that is missing does not break the card', async () => { const { card } = await ready(null); expect(card.querySelector('[data-testid="export-ready-name"]').children[0].textContent).toBe(''); expect(screen.getByTestId('export-share')).toBeTruthy(); });
});

describe('one card, one layout', () => {
  it('the ready state: one status element holding the title, the name, the short line and BOTH buttons, in that order', async () => {
    const { card } = await ready(); expect(screen.getAllByTestId('export-ready')).toHaveLength(1); expect(card.getAttribute('role')).toBe('status'); expect(card.getAttribute('data-gs-msg')).toBe('export-ready|Excel file ready');
    const rows = [...card.children]; expect(rows).toHaveLength(4); expect(rows[0].textContent).toBe('Excel file ready'); expect(rows[1].getAttribute('data-testid')).toBe('export-ready-name'); expect(rows[2].textContent).toBe('Not saved yet. Tap Share file.'); expect(rows[2].querySelector('b').textContent).toBe('Not saved yet.');
    expect([...rows[3].children].map(c => c.getAttribute('data-testid'))).toEqual(['export-share', 'export-discard']); expect(rows[3].style.display).toBe('flex'); expect(rows[3].style.alignItems).toBe('center'); expect(rows[3].style.flexWrap).toBe('');
  });
  it('the card has the module-neutral look: padding 10 x 12, a 12 px margin above and below, the rounded border, the shared reveal margin', async () => {
    const { card } = await ready(); expect(card.style.padding).toBe('10px 12px'); expect(card.style.margin).toBe('12px 0px'); expect(card.style.borderRadius).toBe('10px'); expect(card.style.scrollMarginTop).not.toBe(''); expect(card.style.scrollMarginBottom).not.toBe('');
  });
  it('the cancelled state is the same layout: its own title and short line, the name, and the same two buttons in one row', async () => {
    const share = vi.fn().mockRejectedValueOnce(abortError()); const { user, card } = await ready('IEL_Cancel_2026-10-20.xlsx', scope(), share); await user.click(screen.getByTestId('export-share')); await screen.findByText('The share sheet was closed, so the file was not saved.');
    const c2 = screen.getByTestId('export-ready'); expect(c2.getAttribute('data-gs-msg')).toBe('export-ready|The share sheet was closed, so the file was not saved.'); const rows = [...c2.children]; expect(rows).toHaveLength(4);
    expect(rows[2].textContent).toBe('Still ready. Tap Share file to try again.'); expect([...rows[3].children].map(c => c.getAttribute('data-testid'))).toEqual(['export-share', 'export-discard']); expect(card).toBe(c2);
    expect(c2.style.padding).toBe('10px 12px');
  });
  it('the cancelled card uses the info colours and the ready card the ok colours (a word, an icon and a colour: never colour alone)', async () => {
    const share = vi.fn().mockRejectedValueOnce(abortError()); const { user, card } = await ready('IEL_Colours_2026-10-20.xlsx', scope(), share); expect(hexOfRgb(card.style.background)).toBe(BACKUP_UI.card.ok.bg); expect(card.querySelector('svg')).not.toBeNull();
    await user.click(screen.getByTestId('export-share')); await screen.findByText('The share sheet was closed, so the file was not saved.'); const c2 = screen.getByTestId('export-ready'); expect(hexOfRgb(c2.style.background)).toBe(BACKUP_UI.card.info.bg); expect(hexOfRgb(c2.style.borderColor || c2.style.border.split(' ').slice(-3).join(' '))).toBe(BACKUP_UI.card.info.border);
    expect(c2.querySelector('svg')).not.toBeNull(); expect(card.querySelector('[data-testid="export-share"] svg')).not.toBeNull();
  });
  it('the same card, word for word, for all nine modules', async () => {
    const texts = []; for (const mod of ['rcd', 'iel', 'tat', 'thermo', 'swb', 'irt', 'elt', 'welder', 'gsd']) { const { card } = await ready('X_Example_2026-10-20.xlsx', scope(mod)); texts.push(card.textContent); cleanup(); phoneOff(); }
    expect(new Set(texts).size).toBe(1); expect(texts[0]).toBe('Excel file ready' + 'X_Example_2026-10-20.xlsx' + 'X_Example_2026-10-20.xlsx' + 'Not saved yet. Tap Share file.' + 'Share file' + 'Discard this file');
  });
});

describe('the two buttons: 44 px, side by side, Share file takes the room, neither wraps (the rules that make the 320 layout)', () => {
  it('both are at least 44 px high; Share file grows, Discard keeps its own width and does not shrink; neither is full width', async () => {
    await ready(); const s = screen.getByTestId('export-share'), x = screen.getByTestId('export-discard');
    expect(s.style.minHeight).toBe('44px'); expect(x.style.minHeight).toBe('44px'); expect(s.style.flex).toBe('1 1 0%'); expect(x.style.flex).toBe('0 0 auto'); expect(x.style.width).toBe('auto'); expect(s.style.width).toBe('');
    expect(x.style.padding).toBe('0px 10px'); expect(s.parentElement).toBe(x.parentElement); expect(s.parentElement.parentElement).toBe(screen.getByTestId('export-ready')); expect(s.style.boxSizing).toBe('border-box');
  });
  it('the source gives the row no wrap and the card no fixed width or height', () => {
    const a = SRC.indexOf('function ExportReadyCard('), z = SRC.indexOf('// The export button (release s)'); const body = SRC.slice(a, z);
    expect(body).not.toMatch(/flexWrap|flex-wrap/); expect(body).not.toMatch(/\bwidth: \d|\bheight: \d|\bmaxWidth/); expect(body.match(/function ExportReadyCard\(/g)).toHaveLength(1);
  });
  it('(a) the Discard text on the card fill is 4.5:1 or better, for the ok card and the info card, computed from the real BACKUP_UI colours', () => {
    for (const kind of ['ok', 'info']) { const r = ratio(BACKUP_UI.slateText, BACKUP_UI.card[kind].bg); expect(r, 'Discard on ' + kind).toBeGreaterThanOrEqual(4.5); }
    expect(ratio(BACKUP_UI.slateText, BACKUP_UI.card.ok.bg)).toBeGreaterThan(8); expect(ratio(BACKUP_UI.slateText, BACKUP_UI.card.info.bg)).toBeGreaterThan(8);
  });
  it('(a) the rendered Discard link really uses that colour on that fill, and every other text on the card is 4.5:1 or better too', async () => {
    const { card } = await ready(); const x = screen.getByTestId('export-discard'); expect(hexOfRgb(x.style.color)).toBe(BACKUP_UI.slateText); expect(hexOfRgb(card.style.background)).toBe(BACKUP_UI.card.ok.bg); expect(x.style.background).toBe('transparent');
    const ok = BACKUP_UI.card.ok; expect(ratio(ok.title, ok.bg)).toBeGreaterThanOrEqual(4.5); expect(ratio(ok.body, ok.bg)).toBeGreaterThanOrEqual(4.5); expect(ratio(BACKUP_UI.white, BACKUP_UI.slate)).toBeGreaterThanOrEqual(4.5);
    const info = BACKUP_UI.card.info; expect(ratio(info.title, info.bg)).toBeGreaterThanOrEqual(4.5); expect(ratio(info.body, info.bg)).toBeGreaterThanOrEqual(4.5);
    expect(x.style.textDecoration).toBe('underline');                                    // a link is underlined as well as coloured: never colour alone
  });
});

describe('source scan: one card for everything', () => {
  it('only ExportReadyCard builds the ready card: no module has its own copy, and the test id appears in no other function', () => {
    expect(SRC.match(/"data-testid": "export-ready"/g)).toHaveLength(1); expect(SRC.match(/"export-discard"/g)).toHaveLength(1); expect(SRC.match(/"export-share"/g)).toHaveLength(1); expect(SRC.match(/exportShortName\(entry\.filename\)/g)).toHaveLength(1);
  });
  it('the shortening is a pure helper with the head 16 and tail 14 defaults and a one-character ellipsis', () => {
    expect(SRC).toContain('const exportShortName = (name, head = 16, tail = 14) => {'); expect(SRC).toContain('t.length <= head + tail + 1 ? t : t.slice(0, head) + "\\u2026" + t.slice(-tail)');
  });
  it('bsLink takes an optional fifth argument that is merged last, and the four-argument callers are unchanged', () => {
    expect(SRC).toMatch(/const bsLink = \(label, onClick, id, disabled, extra\) =>/); expect(SRC).toContain('width: "100%", ...(extra || {}) } }, label);');
    const calls = SRC.match(/bsLink\("[^"]+", [^\n]*?\)/g) || []; expect(calls.length).toBeGreaterThanOrEqual(3);
  });
});

// Every Dropdowns tab uses ONE row style (grey #e8e6e2 box) and 5px list gap; the amber border + badge on the ★ row is the only distinction.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppRoot, { ddRowStyle, ddListStyle } from './App.jsx';

afterEach(() => cleanup());
const GREY = 'rgb(232, 230, 226)', AMBER = 'rgb(252, 211, 77)', PLAIN = 'rgb(247, 246, 243)';
const cs = el => getComputedStyle(el);
const site = (id, name) => ({ id, name, company: '', abn: '', licence: '', areas: [] });
const MODULES = [
  { name: 'RCD', card: 'RCD TESTING', key: 'rcd-projects-v6' }, { name: 'IEL', card: 'IEL TESTING', key: 'iel-projects-v2' }, { name: 'TAT', card: 'TEST & TAG', key: 'tat-projects-v1' },
  { name: 'Thermo', card: 'THERMOGRAPHIC', key: 'thermo-projects-v1' }, { name: 'SWB', card: 'SWITCHBOARD', key: 'swb-projects-v1' },
  { name: 'IRT', card: 'INSULATION RESISTANCE TESTING', key: 'irt-projects-v1' }, { name: 'ELT', card: 'EMERGENCY LIGHTING', key: 'elt-projects-v2' }, { name: 'Welder', card: 'WELDER TESTING', key: 'welder-projects-v1' },
];
beforeEach(() => { cleanup(); localStorage.clear(); });

const rowOf = (text) => screen.getByText(text, { selector: 'span' }).parentElement;

describe('shared style helpers', () => {
  it('row: grey fill, radius 7, padding 7px 10px; ★ swaps only the border colour; list gap 5', () => {
    expect(ddRowStyle(false)).toMatchObject({ background: '#e8e6e2', border: '1px solid #f7f6f3', borderRadius: 7, padding: '7px 10px' });
    expect(ddRowStyle(true).border).toBe('1px solid #fcd34d'); expect(ddRowStyle(true).background).toBe('#e8e6e2');
    expect(ddListStyle({ marginBottom: 10 })).toMatchObject({ gap: 5, marginBottom: 10 });
  });
});

describe.each(MODULES)('$name Dropdowns rows', mod => {
  it('the Responsibility list: every row grey, ★ row amber border, others plain border, list gap 5px', async () => {
    const user = userEvent.setup();
    localStorage.setItem(mod.key, JSON.stringify([site('s1', 'Site X')]));
    render(<AppRoot />);
    await user.click(screen.getByText(mod.card));
    await user.click(await screen.findByText('Site X', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: 'Dropdowns' }));
    await screen.findByText('Site Electrician');
    const star = rowOf('Site Electrician'), plain = rowOf('Site Manager');
    for (const r of [star, plain]) { expect(cs(r).backgroundColor).toBe(GREY); expect(cs(r).borderRadius).toBe('7px'); }
    expect(cs(star).borderTopColor).toBe(AMBER); expect(cs(plain).borderTopColor).toBe(PLAIN);
    expect(star.parentElement.style.gap).toBe('5px');
  });
});

describe('TAT: its three own lists match', () => {
  it('appliance names, equipment types and frequencies use the grey box; the ★ row keeps the amber border', async () => {
    const user = userEvent.setup();
    localStorage.setItem('tat-projects-v1', JSON.stringify([site('s1', 'Site X')]));
    render(<AppRoot />);
    await user.click(screen.getByText('TEST & TAG'));
    await user.click(await screen.findByText('Site X', { selector: 'div' }));
    await user.click(screen.getByRole('button', { name: 'Dropdowns' }));
    for (const [starText, plainText] of [['Angle Grinder', 'Kettle'], ['Power Tool', 'Transformer']]) {
      const s = await screen.findByText(starText, { selector: 'span' }), p = screen.getByText(plainText, { selector: 'span' });
      const sr = s.parentElement, pr = p.parentElement;
      expect(cs(sr).backgroundColor).toBe(GREY); expect(cs(pr).backgroundColor).toBe(GREY);
      expect(cs(sr).borderTopColor).toBe(AMBER); expect(cs(pr).borderTopColor).toBe(PLAIN);
      expect(cs(pr).borderRadius).toBe('7px'); expect(pr.parentElement.style.gap).toBe('5px');
    }
    const f = screen.getByText('3 Months', { exact: false, selector: 'span' }).parentElement, g = screen.getByText('1 Month', { exact: false, selector: 'span' }).parentElement;
    expect(cs(f).backgroundColor).toBe(GREY); expect(cs(g).backgroundColor).toBe(GREY);
    expect(cs(f).borderTopColor).toBe(AMBER); expect(cs(g).borderTopColor).toBe(PLAIN);
  });
});

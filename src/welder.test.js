// Welder module: checklist constants, per-asset summary / overall rule, and the derived Summary Register.
import { describe, it, expect } from 'vitest';
import { addMonthsISO, addYearsISO, WELDER_CHECKLIST, WELDER_COLUMNS, welderSummary, welderOverall, welderScoreLabel, welderRegisterRows, welderSiteSummary } from './App.jsx';

const keys = WELDER_CHECKLIST.map(c => c.key);
// build a record from a string of results, in checklist order: P = pass, F = fail, N = N/A, . = blank
const rec = (pattern, extra = {}) => ({
  items: Object.fromEntries(keys.map((k, i) => [k, { result: { P: 'pass', F: 'fail', N: 'na', '.': '' }[pattern[i]], value: '', action: '' }])),
  ...extra,
});

describe('checklist (static, matches the client sample report)', () => {
  it('has the 12 items in order, each with static pass-criteria text', () => {
    expect(WELDER_CHECKLIST).toHaveLength(12);
    expect(WELDER_CHECKLIST.map(c => c.label)).toEqual([
      'Visual Inspection',
      'Clamp connection and braid condition',
      'Flexible Leads',
      'Insulation resistance — Input circuit to Welding circuit',
      'Insulation resistance — All circuits to Exposed conductive parts',
      'Insulation resistance — Welding circuit to auxiliary circuit ABOVE ELV',
      'Insulation resistance — Welding circuit to auxiliary circuit BELOW ELV',
      'Insulation resistance — Separate welding circuit to separate welding circuit',
      'HRD — Maximum Open-Circuit Voltage (a.c. output)',
      'HRD — Maximum Open-Circuit Voltage (d.c. output)',
      'HRD — VRD Switching Resistance',
      'VRD Speed of Operation',
    ]);
    expect(WELDER_CHECKLIST.slice(3, 8).map(c => c.criteria)).toEqual([
      'Min insulation resistance 5 MΩ', 'Min insulation resistance 2.5 MΩ', 'Min insulation resistance 10 MΩ',
      'Min insulation resistance 1 MΩ', 'Min insulation resistance 1 MΩ',
    ]);
    expect(WELDER_CHECKLIST[11].criteria).toBe('≤ 0.5 s for d.c. output / ≤ 0.3 s for a.c. output');
    WELDER_CHECKLIST.forEach(c => expect(c.criteria.length).toBeGreaterThan(5));
  });
});

describe('overall result rule', () => {
  it('W001 shape from the real report: 7 Pass + 5 N/A, zero blank -> Overall PASS (N/A counts as answered)', () => {
    const s = welderSummary(rec('PPPPPNNNPPNN')); // 7 pass, 5 N/A — exactly the sample W001/W010 counts
    expect(s).toMatchObject({ total: 12, pass: 7, fail: 0, na: 5, untested: 0, score: 100, actions: 0, overall: 'pass' });
    expect(welderScoreLabel(s.score)).toBe('100.0%');
  });

  it('any blank item keeps the welder Untested — even when other items are Pass or Fail', () => {
    expect(welderOverall(rec('PPPPPPPPPPP.'))).toBe('untested');
    expect(welderOverall(rec('..........' + '..'))).toBe('untested');
    expect(welderOverall(rec('FPPPPPPPPPP.'))).toBe('untested'); // a Fail does not decide the overall until all 12 are answered
    expect(welderOverall({})).toBe('untested');
  });

  it('all 12 answered: any Fail -> FAIL; otherwise PASS, whatever the Pass / N/A mix', () => {
    expect(welderOverall(rec('PPPPPPPPPPPF'))).toBe('fail');
    expect(welderOverall(rec('NNNNNNNNNNNF'))).toBe('fail');
    expect(welderOverall(rec('PPPPPPPPPPPP'))).toBe('pass');
    expect(welderOverall(rec('PNPNPNPNPNPN'))).toBe('pass');
    expect(welderOverall(rec('NNNNNNNNNNNN'))).toBe('pass'); // N/A never blocks a PASS
  });
});

describe('score and actions', () => {
  it('Score = Pass / (Pass + Fail) x 100 with N/A excluded from the denominator', () => {
    expect(welderSummary(rec('PPPPPPPPFFNN')).score).toBe(80);   // 8 / 10
    expect(welderSummary(rec('PFFFFFFFFFFF')).score).toBe(8.3);  // 1 / 12, one decimal
    expect(welderSummary(rec('PPPPPNNNNNNN')).score).toBe(100);
  });

  it('shows "—" when nothing is scored (all N/A or all blank)', () => {
    expect(welderSummary(rec('NNNNNNNNNNNN')).score).toBeNull();
    expect(welderScoreLabel(welderSummary(rec('NNNNNNNNNNNN')).score)).toBe('—');
    expect(welderScoreLabel(welderSummary({}).score)).toBe('—');
  });

  it('Actions Required counts only FAIL items that have a Corrective Action (the client sample shows 0 despite Pass items with actions)', () => {
    const r = rec('PPPPPPPPPPPF');
    r.items.visual.action = 'replace cover to prevent dust and water ingress'; // a Pass item with an action, as in the real W001
    expect(welderSummary(r).actions).toBe(0 + 0); // the only Fail (last item) has no action yet
    r.items.vrd_speed.action = 'return for repair';
    r.items.ir_input = { result: 'fail', value: '1.2', action: '   ' }; // whitespace-only action does not count
    expect(welderSummary(r).actions).toBe(1);
    expect(welderSummary(r).fail).toBe(2);
  });
});

describe('Summary Register (derived, never entered separately)', () => {
  const project = { id: 'p', name: 'Dixon Quarry Group', assets: [
    { id: 'a1', location: 'ONR Workshop', assetId: 'W001', brand: 'Kemppi', model: 'MinarcMig Evo 200', serial: '2699294' },
    { id: 'a2', location: 'ONR Workshop', assetId: 'W004', brand: 'Unimig', model: 'Razor Weld', serial: 'N/A' },
    { id: 'a3', location: 'ONR Workshop', assetId: 'W009', brand: 'Unimig', model: 'SWF350', serial: 'NA' },
    { id: 'a4', location: 'ONR Workshop', assetId: 'W010', brand: '', model: '', serial: '' },
  ] };
  const stale = { rectified: 'Removed from Service', defectId: 'D-9', responsibility: 'Site Electrician', priority: 'H' };
  const results = { p: {
    a1: rec('PPPPPNNNPPNN', { date: '2026-07-13', ...stale, notes: 'ok' }),                       // PASS with retained defect data
    a2: rec('PPPPPPPPPPPF', { date: '2026-07-13', ...stale, rectifiedDate: '2026-08-01', notes: 'Return to supplier' }), // FAIL
    a3: rec('PPP.........', {}),                                                                 // untested
  } };
  const meta = { auditor: 'Jordan', testDate: '2026-07-13', nextTestDate: '' };
  const rows = welderRegisterRows(project, results, meta);

  it('has the client\'s 13 columns in order', () => {
    expect(WELDER_COLUMNS).toEqual(['Location', 'Asset ID', 'Welder (Machine)', 'Serial Number', 'Date Tested', 'Pass / Fail',
      'Rectified / Scheduled', 'Date Rectified / Scheduled', 'Defect ID', 'Responsibility', 'Notes / Recommendations', 'Priority (L,M,H,U)', 'Next Test Due']);
    rows.forEach(r => expect(r.cells).toHaveLength(13));
  });

  it('lists every welder (including untested ones), machine = Brand + Model, serial kept exactly ("N/A" is valid)', () => {
    expect(rows.map(r => r.cells[1])).toEqual(['W001', 'W004', 'W009', 'W010']);
    expect(rows[0].cells.slice(0, 4)).toEqual(['ONR Workshop', 'W001', 'Kemppi MinarcMig Evo 200', '2699294']);
    expect(rows[1].cells[3]).toBe('N/A');
    expect(rows[2].cells[3]).toBe('NA');
  });

  it('Date Tested, Pass/Fail and Next Test Due (+3 months) — blank for untested welders', () => {
    expect(rows[0].cells[4]).toBe('13/07/2026');
    expect(rows[0].cells[5]).toBe('Pass');
    expect(rows[0].cells[12]).toBe('13/10/2026'); // 3 months after 13/07/2026, as in the sample
    expect(rows[1].cells[5]).toBe('Fail');
    expect(rows[2].cells[4]).toBe(''); expect(rows[2].cells[5]).toBe(''); expect(rows[2].cells[12]).toBe('');
    expect(rows[3].cells[5]).toBe('');
  });

  it('defect columns are only filled for FAIL welders; a PASS welder with retained defect data shows none', () => {
    expect(rows[0].cells.slice(6, 10)).toEqual(['', '', '', '']);                 // retained data on a PASS welder is gated out
    expect(rows[0].cells[11]).toBe('');
    expect(rows[1].cells.slice(6, 10)).toEqual(['Removed from Service', '01/08/2026', 'D-9', 'Site Electrician']);
    expect(rows[1].cells[10]).toBe('Return to supplier');
    expect(rows[1].cells[11]).toBe('H');
  });

  it('site summary is asset-level: Total / Pass / Fail / Untested', () => {
    expect(welderSiteSummary(project, results)).toEqual({ total: 4, pass: 1, fail: 1, untested: 2, tested: 2 });
  });
});

describe('date helpers (shared): month/year maths must not lose a day across daylight saving', () => {
  it('adds calendar months in UTC (24/09 + 3 months = 24/12, 13/07 + 3 = 13/10 — the client sample)', () => {
    expect(addMonthsISO('2026-09-24', 3)).toBe('2026-12-24');
    expect(addMonthsISO('2026-07-13', 3)).toBe('2026-10-13');
    expect(addMonthsISO('2026-04-05', 6)).toBe('2026-10-05');
    expect(addMonthsISO('2026-09-24', 6)).toBe('2027-03-24');
    expect(addYearsISO('2026-10-05', 1)).toBe('2027-10-05');
    expect(addMonthsISO('', 3)).toBe('');
  });
});

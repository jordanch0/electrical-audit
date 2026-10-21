// RELEASE q, SOURCE SCAN: a confirm card that can grow must call useRevealOnOpen (or be on a short allow-list WITH a reason). Every function that calls useCollapsible (the "something expands in place"
// rule) is either in EXPECTED (it calls the hook) or in ALLOW (it does not, and why). A NEW function that calls useCollapsible and is in neither list FAILS this test: add the hook (and ...GS_MSG_MARGIN on the
// card, and a case in reveal-modules.test.jsx), or add it to ALLOW with the reason. The App.jsx text is read, not run (jsdom has no layout), as safe-area-layout.test.jsx does.
import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.join(__dirname, 'App.jsx'), 'utf8'), LINES = SRC.split('\n');
// the nearest top-level declaration above each line: `function Name` or `const Name =` at column 0
function ownerOf(re) {
  let cur = '?'; const out = {};
  LINES.forEach((ln, i) => { const m = /^(?:async )?function\s+([A-Za-z0-9_$]+)/.exec(ln) || /^const\s+([A-Za-z0-9_$]+)\s*=/.exec(ln); if (m) cur = m[1]; if (re.test(ln) && !/^\s*\/\//.test(ln) && !/^function use(Collapsible|RevealOnOpen)\b/.test(ln)) (out[cur] = out[cur] || []).push(i + 1); });
  return out;
}
const bodyOf = name => { const at = SRC.indexOf('function ' + name + '('); expect(at, name + ' exists').toBeGreaterThan(-1); const rest = SRC.slice(at + 10), m = /\n(?:async )?function\s|\nconst\s[A-Za-z0-9_$]+\s*=\s/.exec(rest); return SRC.slice(at, at + 10 + (m ? m.index : rest.length)); };

const EXPECTED = ['ConfirmReset', 'ContinueConfirmBtn', 'CompleteAuditBtn', 'EventCard'];      // call useCollapsible AND useRevealOnOpen; (DropdownNotice calls the hook only: it does not collapse)
const HOOK_ONLY = ['DropdownNotice'];
const ALLOW = {
  DeleteButton: 'a row that grows by ~13 px; measured at most 7 px under the pill; GSD keeps its own revealBottom (pinned by gsd.test.jsx), so two scrolls would race. Decision: out of release q.',
  StyledSelect: 'a popover list opens BELOW its field; a different open / close from a confirm card. Candidate for a later release; not measured.',
  EditableDropdown: 'popover (see StyledSelect)', IELEditableDropdown: 'popover (see StyledSelect)', SWBEditableDropdown: 'popover (see StyledSelect)', ThermoEditableDropdown: 'popover (see StyledSelect)', IRTEditableDropdown: 'popover (see StyledSelect)',
  TATNameCombo: 'popover of suggestions (see StyledSelect)',
  BackupRestoreSection: 'Global Settings reveals its own messages with useGsReveal / gsRevealEls (release m)',
  GSDItemPage: 'the GSD item page scrolls its bottom sentinel into view with revealBottom (pinned by gsd.test.jsx)',
};

describe('every function that expands in place is either on the hook list or on the allow-list with a reason', () => {
  const callers = ownerOf(/useCollapsible\(/);
  it('no function that calls useCollapsible is in neither list (a NEW one fails here)', () => {
    const unknown = Object.keys(callers).filter(n => !EXPECTED.includes(n) && !(n in ALLOW));
    expect(unknown, 'add useRevealOnOpen + the margin, or list it in ALLOW with a reason: ' + unknown.join(', ')).toEqual([]);
  });
  it('the lists are true: every EXPECTED function calls useCollapsible, every ALLOW entry still exists and has a reason', () => {
    for (const n of EXPECTED) expect(callers[n], n + ' calls useCollapsible').toBeTruthy();
    for (const [n, why] of Object.entries(ALLOW)) { expect(callers[n], n + ' still calls useCollapsible (else drop it from ALLOW)').toBeTruthy(); expect(why.length, n + ' has a reason').toBeGreaterThan(10); }
  });
  it('the callers of useRevealOnOpen are exactly the expected set (DeleteButton, the popovers and GSD are not among them)', () => {
    const hooked = Object.keys(ownerOf(/useRevealOnOpen\(/)).sort();
    expect(hooked).toEqual([...EXPECTED, ...HOOK_ONLY].sort());
  });
});

describe('each hooked card is built the one way', () => {
  for (const n of [...EXPECTED, ...HOOK_ONLY]) {
    it(n + ': the hook is called BEFORE any return (Rules of Hooks: the first return may be an early one)', () => {
      const b = bodyOf(n), hook = b.indexOf('useRevealOnOpen('), ret = b.indexOf('return'); expect(hook).toBeGreaterThan(-1); expect(ret).toBeGreaterThan(-1); expect(hook).toBeLessThan(ret);
    });
    it(n + ': the card spreads the shared margin object (stops 16 px above the pill) and the hook reads the same ref the card carries', () => {
      const b = bodyOf(n); expect(b).toContain('...GS_MSG_MARGIN');
      const m = /useRevealOnOpen\((\w+),/.exec(b); expect(m, 'hook call with a ref').toBeTruthy(); expect(b).toMatch(new RegExp('ref\\s*:\\s*' + m[1] + '\\b'));
    });
  }
  it('CompleteAuditBtn: the hook sits above the disabled early return', () => { const b = bodyOf('CompleteAuditBtn'); expect(b.indexOf('useRevealOnOpen(')).toBeLessThan(b.indexOf('if (disabled)')); });
  it('the margin object is still the Global Settings one, and useGsReveal / gsRevealEls are still its own (not rewritten for the modules)', () => {
    expect(SRC).toContain('const GS_MSG_MARGIN = { scrollMarginTop: 12, scrollMarginBottom: NAV_CLEARANCE };');
    expect(bodyOf('gsRevealEls')).toContain('first.closest("[data-gs-scroll]")'); expect(bodyOf('useGsReveal')).toContain('[data-gs-msg]');
  });
});

describe('no bare scroll left in a notice', () => {
  it('no ref callback calls scrollIntoView (it ran on EVERY render, flush against the pill, with no margin)', () => {
    expect(SRC).not.toMatch(/ref\s*:\s*\(?\s*\w+\s*\)?\s*=>\s*\{?\s*if\s*\(\s*\w+\s*&&\s*\w+\.scrollIntoView/);
    const bare = LINES.map((ln, i) => [ln, i + 1]).filter(([ln]) => /\.scrollIntoView\(/.test(ln) && /ref\s*:\s*\(?\s*\w+\s*\)?\s*=>/.test(ln)); expect(bare).toEqual([]);
  });
  it('the dropdown-option notice is built in ONE place (DropdownNotice); the switchboard-family view uses it', () => {
    expect((SRC.match(/flexBasis:\s*"100%",\s*fontSize:\s*11,\s*color:\s*"#b91c1c"/g) || []).length).toBe(1);
    expect(bodyOf('SWBDropdownsView')).toContain('React.createElement(DropdownNotice');
  });
  it('the notice is rendered by DropdownNotice at all 7 modules\' places plus the shared view (8 call sites)', () => {
    const uses = LINES.filter(ln => /createElement\(DropdownNotice/.test(ln) && !/^\s*\/\//.test(ln)).length; expect(uses).toBe(8);
  });
});

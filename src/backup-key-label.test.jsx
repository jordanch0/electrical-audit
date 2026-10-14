// PLAIN WORDS FOR SAVED-DATA KEYS (Round b). Every key the app can name gets a human label ("RCD Testing, list of sites"); a key the app does not know is NEVER echoed; the label never contains key syntax.
import { describe, it, expect } from 'vitest';
import { backupKeyLabel, backupKeysLabel, backupKeyAllowed, BACKUP_MODULES, BACKUP_MODULE_INFO } from './App.jsx';

// spelled out here on purpose (not computed from the app's own tables): module name, then the words per kind
const MODULE_NAME = { rcd: 'RCD Testing', iel: 'IEL Testing', tat: 'Test & Tag', thermo: 'Thermographic Scanning', swb: 'Switchboard', irt: 'Insulation Resistance Testing', elt: 'Emergency Lighting', welder: 'Welder Testing', gsd: 'General Site Defects' };
const KIND_WORDS = { projects: 'list of sites', results: 'test results', items: 'list of defects', meta: 'audit details', history: 'History', dropdowns: 'dropdown lists', 'audit-active': 'audit in progress', 'photos-migrated': 'photo storage note' };
const KINDS = Object.keys(KIND_WORDS);
const SPECIAL = { 'rcd-mode-v6': 'RCD Testing, last test mode', 'iel-cat-v2': 'IEL Testing, last category', 'tat-settings-v1': 'Test & Tag, equipment types', 'tat-freqs-v1': 'Test & Tag, test frequencies', 'tat-names-v1': 'Test & Tag, appliance names', 'tat-defaults-v1': 'Test & Tag, default settings',
  'cal-events-v1': 'Calendar events', 'app-settings-v1': 'Business tab', 'sparkcheck-restore-v1': 'Restore record', 'sparkcheck-last-backup-v1': 'Last backup note', 'sparkcheck-leftover-v1': 'Erase leftover note', 'sparkcheck-erase-pending-v1': 'Erase in progress note' };
const KEY_SYNTAX = /-v\d|preMigration|\.json|projects|audit-active|photos-migrated|dropdowns|[_]|sparkcheck-|-(results|meta|history|items|mode|cat|events|settings|freqs|names|defaults)\b/;

describe('every key the restore can name', () => {
  it('the 45 module keys the plan and the engine touch (9 modules x projects / results / meta / history / audit-active): the exact label', () => {
    for (const m of BACKUP_MODULES) for (const role of ['projects', 'results', 'meta', 'history', 'active']) {
      const key = BACKUP_MODULE_INFO[m].keys[role]; const kind = role === 'active' ? 'audit-active' : (key.includes('-items-') ? 'items' : role);
      expect(backupKeyLabel(key), key).toBe(MODULE_NAME[m] + ', ' + KIND_WORDS[kind]);
    }
    expect(backupKeyLabel('rcd-projects-v6')).toBe('RCD Testing, list of sites'); expect(backupKeyLabel('gsd-items-v1')).toBe('General Site Defects, list of defects'); expect(backupKeyLabel('elt-audit-active-v1')).toBe('Emergency Lighting, audit in progress');
  });
  it('every key the backup allow-list accepts, in every version (v1 to v9): a real label, never the fallback, never key syntax', () => {
    let n = 0;
    for (const m of BACKUP_MODULES) for (const kind of KINDS) for (let v = 1; v <= 9; v++) {
      const key = `${m}-${kind}-v${v}`; expect(backupKeyAllowed(key), key).toBe(true); const l = backupKeyLabel(key); n++;
      expect(l, key).toBe(MODULE_NAME[m] + ', ' + KIND_WORDS[kind]); expect(l, key).not.toMatch(KEY_SYNTAX);
    }
    for (const [key, label] of Object.entries(SPECIAL)) { n++; expect(backupKeyLabel(key), key).toBe(label); expect(backupKeyLabel(key), key).not.toMatch(KEY_SYNTAX); }
    for (let v = 1; v <= 9; v++) for (const base of ['rcd-mode', 'iel-cat', 'tat-settings', 'tat-freqs', 'tat-names', 'tat-defaults', 'cal-events', 'app-settings']) { const l = backupKeyLabel(`${base}-v${v}`); expect(l, base).not.toBe('other saved data'); n++; }
    expect(n).toBeGreaterThan(700);
  });
  it('the copies kept before an update are named too', () => {
    for (const m of BACKUP_MODULES) for (const kind of ['results', 'history']) expect(backupKeyLabel(`${m}-${kind}-preMigration-v1`)).toBe(MODULE_NAME[m] + ', ' + KIND_WORDS[kind] + ' (a copy kept before an update)');
  });
  it('different keys have different labels (nothing is confused with anything else)', () => {
    const keys = [...BACKUP_MODULES.flatMap(m => KINDS.map(k => `${m}-${k}-v1`)), ...Object.keys(SPECIAL)]; const labels = keys.map(backupKeyLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });
  it('no label contains key syntax: no version, no file or key words, no underscore, no internal names', () => {
    for (const key of [...BACKUP_MODULES.flatMap(m => KINDS.map(k => `${m}-${k}-v6`)), ...Object.keys(SPECIAL), ...BACKUP_MODULES.map(m => `${m}-results-preMigration-v1`)]) expect(backupKeyLabel(key), key).not.toMatch(KEY_SYNTAX);
  });
});

describe('a key the app does not know is never echoed', () => {
  it.each(['some-other-app-key', 'client-acme-notes', 'rcd-projects', 'rcd-projects-v', 'xrcd-projects-v1', 'rcd-projects-v1x', 'RCD-PROJECTS-V1', '', 'sparkcheck-unknown-v1'])('"%s" reads "other saved data"', k => {
    const l = backupKeyLabel(k); expect(l).toBe('other saved data'); expect(l).not.toContain(k || '\u0000');
  });
  it('anything that is not a string reads "other saved data"', () => { for (const v of [undefined, null, 5, {}, [], true]) expect(backupKeyLabel(v)).toBe('other saved data'); });
});

describe('several keys in one sentence', () => {
  it('each label once; one label as it is; several grouped by module ("A (x, y) and B (z)"); at most 4 named, then "and N more"; nothing for none', () => {
    expect(backupKeysLabel([])).toBe(''); expect(backupKeysLabel(undefined)).toBe(''); expect(backupKeysLabel(['rcd-projects-v6'])).toBe('RCD Testing, list of sites');
    expect(backupKeysLabel(['rcd-projects-v6', 'rcd-projects-v6'])).toBe('RCD Testing, list of sites'); expect(backupKeysLabel(['rcd-projects-v6', 'iel-results-v2'])).toBe('RCD Testing (list of sites) and IEL Testing (test results)');
    expect(backupKeysLabel(['rcd-projects-v6', 'iel-results-v2', 'cal-events-v1'])).toBe('RCD Testing (list of sites), IEL Testing (test results) and Calendar events');
    expect(backupKeysLabel(['rcd-projects-v6', 'iel-results-v2', 'cal-events-v1', 'swb-meta-v1', 'gsd-items-v1', 'elt-history-v2'])).toBe('RCD Testing (list of sites), IEL Testing (test results), Calendar events, Switchboard (audit details) and 2 more');
    expect(backupKeysLabel(['mystery', 'another'])).toBe('other saved data');                                  // two unknown keys: one label, never the keys
  });
});

describe('several keys grouped by module: a module name is said once', () => {
  const count = (s, w) => s.split(w).length - 1;
  it('one module, one part: the label as it is', () => { expect(backupKeysLabel(['gsd-items-v1'])).toBe('General Site Defects, list of defects'); });
  it('one module, several parts: the name once, the parts in brackets, in the order given', () => {
    const l = backupKeysLabel(['gsd-projects-v1', 'gsd-items-v1', 'gsd-meta-v1']); expect(l).toBe('General Site Defects (list of sites, list of defects, audit details)'); expect(count(l, 'General Site Defects')).toBe(1);
    expect(backupKeysLabel(['gsd-meta-v1', 'gsd-projects-v1'])).toBe('General Site Defects (audit details, list of sites)');
  });
  it('several modules: each name once with its own parts, whatever the order the keys come in', () => {
    const l = backupKeysLabel(['rcd-projects-v6', 'iel-results-v2', 'rcd-results-v6', 'gsd-items-v1', 'gsd-meta-v1']);
    expect(l).toBe('RCD Testing (list of sites, test results), IEL Testing (test results) and General Site Defects (list of defects, audit details)');
    for (const n of ['RCD Testing', 'IEL Testing', 'General Site Defects']) expect(count(l, n), n).toBe(1);
  });
  it('a module with several parts next to one with a single part and to the Calendar; the 4-name cap counts modules, not parts', () => {
    expect(backupKeysLabel(['gsd-projects-v1', 'gsd-items-v1', 'rcd-projects-v6', 'cal-events-v1'])).toBe('General Site Defects (list of sites, list of defects), RCD Testing (list of sites) and Calendar events');
    expect(backupKeysLabel(['gsd-projects-v1', 'gsd-items-v1', 'gsd-meta-v1', 'gsd-results-v1', 'gsd-history-v1'])).toBe('General Site Defects (list of sites, list of defects, audit details, test results, History)');
    expect(backupKeysLabel(['rcd-projects-v6', 'iel-results-v2', 'swb-meta-v1', 'elt-history-v2', 'gsd-items-v1'])).toBe('RCD Testing (list of sites), IEL Testing (test results), Switchboard (audit details), Emergency Lighting (History) and 1 more');
  });
  it('the Test & Tag words and the Business tab keep their own labels inside the grouping', () => {
    expect(backupKeysLabel(['tat-settings-v1', 'tat-freqs-v1'])).toBe('Test & Tag (equipment types, test frequencies)'); expect(backupKeysLabel(['app-settings-v1', 'tat-names-v1'])).toBe('Business tab and Test & Tag (appliance names)');
  });
});

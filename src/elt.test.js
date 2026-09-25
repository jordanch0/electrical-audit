import { describe, it, expect } from 'vitest';
import { eltOverall, eltExportNotes, eltSummary, eltRegisterRows, ELT_COLUMNS, migrateProjectToAreas as toAreas } from './App.jsx';

const allPass = { visual:'pass', discharge:'pass', switching:'pass', charging:'pass' };

describe('eltOverall', () => {
  it('passes only when all four checks pass', () => {
    expect(eltOverall(allPass)).toBe('pass');
  });
  it('fails when any check fails', () => {
    expect(eltOverall({ ...allPass, charging:'fail' })).toBe('fail');
    expect(eltOverall({ visual:'fail', discharge:'', switching:'', charging:'' })).toBe('fail');
  });
  it('is untested until every check is recorded', () => {
    expect(eltOverall({ ...allPass, discharge:'' })).toBe('untested');
    expect(eltOverall({ visual:'', discharge:'', switching:'', charging:'' })).toBe('untested');
  });
});

describe('eltExportNotes', () => {
  const failed = { ...allPass, visual:'fail', failReason:'Lamp Failure', action:'Given to Site Contact', notes:'Behind sign' };
  it('combines reason, action and notes on fail', () => {
    expect(eltExportNotes(failed)).toBe('Lamp Failure — Given to Site Contact. Behind sign');
  });
  it('omits the notes suffix when there are no notes', () => {
    expect(eltExportNotes({ ...failed, notes:'' })).toBe('Lamp Failure — Given to Site Contact');
  });
  it('substitutes "Other" free text', () => {
    expect(eltExportNotes({ ...failed, failReason:'Other', failReasonOther:'Water ingress', notes:'' }))
      .toBe('Water ingress — Given to Site Contact');
  });
  it('shows only notes on pass, ignoring retained fail fields', () => {
    expect(eltExportNotes({ ...allPass, failReason:'Lamp Failure', action:'Repaired On-Site', notes:'All good' })).toBe('All good');
  });
});

describe('register + summary', () => {
  const project = toAreas({ id:'p1', name:'Site A', assets:[
    { id:'a1', location:'Site A', assetLocation:'SE Door', type:'Emergency Exit Sign', maintained:'Maintained', fitting:'Clevertronics 24m' },
    { id:'a2', location:'Site A', assetLocation:'SW Roof', type:'Other', typeOther:'Bunker light', maintained:'Non-Maintained' },
    { id:'a3', location:'Site A', assetLocation:'Not yet tested', type:'Emergency Exit Sign' },
  ]});
  const results = { p1: {
    a1: { ...allPass },
    a2: { ...allPass, discharge:'fail', failReason:'Battery Failure', action:'Scheduled for Repair' },
  }};
  const meta = { testDate:'2026-09-21', nextTestDate:'2027-03-21' };

  it('counts only pass/fail assets', () => {
    expect(eltSummary(project, results)).toMatchObject({ total:2, pass:1, fail:1 });
  });
  it('emits 14 columns in order and excludes untested assets', () => {
    const rows = eltRegisterRows(project, results, meta);
    expect(ELT_COLUMNS).toHaveLength(14);
    expect(rows).toHaveLength(2);
    expect(rows[0].cells).toHaveLength(14);
    expect(rows[0].cells.slice(0,6)).toEqual(['Site A','SE Door','','Emergency Exit Sign','Maintained','Clevertronics 24m']);
    expect(rows[0].cells[11]).toBe('Pass');
    expect(rows[1].cells[3]).toBe('Bunker light');
    expect(rows[1].cells.slice(7,12)).toEqual(['Pass','Fail','Pass','Pass','Fail']);
    expect(rows[1].cells[13]).toBe('Battery Failure — Scheduled for Repair');
  });
});

import { describe, it, expect } from 'vitest';
import { eltOverall, eltNormaliseRes, eltGetRes, eltSummary, eltRegisterRows, ELT_COLUMNS, migrateProjectToAreas as toAreas } from './App.jsx';

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

// Read-time normalisation of pre-standard fail data (failReason / action) into the standard fields
describe('eltNormaliseRes', () => {
  const failed = { ...allPass, visual:'fail', failReason:'Lamp Failure', action:'Given to Site Contact', notes:'Behind sign' };
  it('a FAIL record: old Action Taken -> rectified, old Failure Reason folded into the front of Notes, old keys dropped', () => {
    const out = eltNormaliseRes(failed);
    expect(out).toMatchObject({ rectified:'Given to Site Contact', notes:'Failure reason: Lamp Failure. Behind sign' });
    ['failReason','failReasonOther','action','actionOther'].forEach(k => expect(out).not.toHaveProperty(k));
  });
  it('no notes -> the reason alone; "Other" free text is substituted', () => {
    expect(eltNormaliseRes({ ...failed, notes:'' }).notes).toBe('Failure reason: Lamp Failure.');
    const o = eltNormaliseRes({ ...failed, failReason:'Other', failReasonOther:'Water ingress', action:'Other', actionOther:'Ordered part', notes:'' });
    expect(o).toMatchObject({ rectified:'Ordered part', notes:'Failure reason: Water ingress.' });
  });
  it('an existing standard rectified value is never overwritten by the old action', () => {
    expect(eltNormaliseRes({ ...failed, rectified:'Removed from Service' }).rectified).toBe('Removed from Service');
  });
  it('is idempotent, does not mutate its input, and leaves standard / passing records untouched (retained fields stay hidden)', () => {
    const once = eltNormaliseRes(failed);
    expect(eltNormaliseRes(once)).toBe(once);                                  // nothing folded twice
    expect(failed).toMatchObject({ failReason:'Lamp Failure', notes:'Behind sign' });
    const passing = { ...allPass, failReason:'Lamp Failure', action:'Repaired On-Site', notes:'All good' };
    expect(eltNormaliseRes(passing)).toBe(passing);                            // retained, never shown in a passing row's notes
    expect(eltGetRes({ p:{ a:passing } }, 'p', 'a').notes).toBe('All good');
    expect(eltNormaliseRes(undefined)).toEqual({});
  });
  it('eltGetRes supplies every standard defect field, so nothing downstream sees undefined', () => {
    expect(eltGetRes({}, 'p', 'a')).toMatchObject({ rectified:'', rectifiedDate:'', defectId:'', responsibility:'', priority:'', notes:'' });
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
    a2: { ...allPass, discharge:'fail', rectified:'Scheduled for Repair', defectId:'12', responsibility:'Contractor', priority:'M', notes:'Battery dead' },
  }};
  const meta = { testDate:'2026-09-21', nextTestDate:'2027-03-21' };

  it('counts only pass/fail assets', () => {
    expect(eltSummary(project, results)).toMatchObject({ total:2, pass:1, fail:1 });
  });
  it('emits 16 columns in order (# first, Score right after Pass/Fail, no defect columns) and excludes untested assets', () => {
    const rows = eltRegisterRows(project, results, meta);
    expect(ELT_COLUMNS).toHaveLength(16);
    expect(ELT_COLUMNS.slice(12)).toEqual(['Pass/Fail','Score','Notes / Recommendations','Next Test Due']);
    expect(ELT_COLUMNS[0]).toBe('#');
    expect(rows).toHaveLength(2);
    expect(rows[0].cells).toHaveLength(16);
    expect(rows[0].cells.slice(0,7)).toEqual([1,'Site A','SE Door','','Emergency Exit Sign','Maintained','Clevertronics 24m']);
    expect(rows[0].cells[12]).toBe('Pass');
    expect(rows[0].cells[13]).toBe('100.0%');   // 4 / 4
    expect(rows[1].cells[13]).toBe('75.0%');    // 3 / 4 (discharge failed)
    expect(rows[1].cells[4]).toBe('Bunker light');
    expect(rows[1].cells.slice(8,13)).toEqual(['Pass','Fail','Pass','Pass','Fail']);
    expect(rows[1].cells.slice(14)).toEqual(['Battery dead','21/03/2027']);                      // main table: notes + next due only
    expect(rows[1].defect).toEqual([2,'Site A','SW Roof','','12','M','Scheduled for Repair','','Contractor','Battery dead']);   // Defects sheet row, same # as the register
    expect(rows[0].defect).toBeNull();                                                            // PASS: no defect row
  });
});

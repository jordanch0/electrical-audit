// RCD import: CB Type / Amp Rating (2026-09-30 bug + fix).
//
// Bug: re-importing RCD's OWN EXPORT dropped circuitMeta (CB Type AND Amp Rating, not just Amp Rating) entirely.
// The export always combines Panel+Circuit into one "Panel / Asset Name" cell (e.g. "MSB CB1"), so the importer's
// hasSeparateCircuit flag was false, sending it down the LEGACY 2-column branch — which never read the CB Type /
// Amp Rating columns at all (that code only ran inside the hasSeparateCircuit branch). A circuit with no stored
// circuitMeta then had its Manage edit form pre-fill "RCBO Type A" / "6A" (the first dropdown option) as if it
// were real data.
//
// A second, independent defect affected CB Type specifically: the export's CB-type column is headed "Device
// Type", but the importer's detection regex only matched headers containing "cb" — "device type" doesn't contain
// "cb", so CB Type would still fail to import even with the branch bug fixed, unless the header text is also
// reconciled. Fixed by broadening the regex to recognise "Device Type" as an alias for "CB Type", rather than
// renaming the export's live heading (cosmetic, and would touch every existing exported report's wording).
//
// Both fixes are import-parsing only — circuitMeta's stored shape ({cbType, ampRating} per circuit, on
// panel.circuitMeta) is unchanged, so nothing about already-imported/created projects needs to change; this only
// affects what a FRESH import produces going forward.
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { exportExcel, parseExcelToProject } from './App.jsx';

describe('RCD import: CB Type / Amp Rating survive a real export -> re-import round trip', () => {
  async function exportAndReimport(project, results, meta, reimportName = 'Reimported') {
    let capturedPayload = null;
    window.webkit = { messageHandlers: { shareFile: { postMessage: p => { capturedPayload = p; } } } };
    try {
      await exportExcel(results, project, meta, 'push');
      const buf = Buffer.from(capturedPayload.base64, 'base64');
      const wb = XLSX.read(buf, { type: 'buffer' });
      return parseExcelToProject(wb, reimportName, '', '', '');
    } finally { delete window.webkit; }
  }

  it('a single panel with two circuits: both CB Type AND Amp Rating come back exactly, for every circuit', async () => {
    const project = { id: 'p', name: 'Site R', company: 'Co', abn: '1', licence: 'L', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'pn', name: 'MSB', circuits: ['CB1', 'CB2'], circuitMeta: {
      CB1: { cbType: 'RCBO Type A', ampRating: '32A' },
      CB2: { cbType: 'MCB Type B', ampRating: '16A' },
    } }] }] };
    const parsed = await exportAndReimport(project, {}, { auditor: 'J', pushDate: '2026-09-21' });
    const panel = parsed.areas[0].panels[0];
    expect(panel.circuitMeta).toEqual({
      CB1: { cbType: 'RCBO Type A', ampRating: '32A' },
      CB2: { cbType: 'MCB Type B', ampRating: '16A' },
    });
  });

  it('multiple panels in one area: metadata is attached to the CORRECT panel/circuit, not mixed up by the split heuristic', async () => {
    const project = { id: 'p', name: 'Site R', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'Plant', panels: [
      { id: 'msb', name: 'MSB1', circuits: ['CB1', 'CB2'], circuitMeta: { CB1: { cbType: 'MCB Type B', ampRating: '20A' }, CB2: { cbType: 'MCB Type C', ampRating: '25A' } } },
      { id: 'db2', name: 'DB2', circuits: ['CB1', 'CB3'], circuitMeta: { CB1: { cbType: 'RCBO Type A', ampRating: '16A' }, CB3: { cbType: 'RCD Type A', ampRating: '40A' } } },
    ] }] };
    const parsed = await exportAndReimport(project, {}, { auditor: 'J', pushDate: '2026-09-21' });
    const byName = Object.fromEntries(parsed.areas[0].panels.map(p => [p.name, p]));
    expect(byName.MSB1.circuitMeta).toEqual({ CB1: { cbType: 'MCB Type B', ampRating: '20A' }, CB2: { cbType: 'MCB Type C', ampRating: '25A' } });
    expect(byName.DB2.circuitMeta).toEqual({ CB1: { cbType: 'RCBO Type A', ampRating: '16A' }, CB3: { cbType: 'RCD Type A', ampRating: '40A' } });
  });

  it('a circuit with only Amp Rating set (no CB Type) round-trips that one field without inventing the other', async () => {
    const project = { id: 'p', name: 'Site R', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'pn', name: 'MSB', circuits: ['CB1'], circuitMeta: { CB1: { cbType: '', ampRating: '63A' } } }] }] };
    const parsed = await exportAndReimport(project, {}, { auditor: 'J', pushDate: '2026-09-21' });
    expect(parsed.areas[0].panels[0].circuitMeta).toEqual({ CB1: { cbType: '', ampRating: '63A' } });
  });

  it('a circuit with NEITHER field set gets no circuitMeta entry at all (not empty-string placeholders)', async () => {
    const project = { id: 'p', name: 'Site R', company: '', abn: '', licence: '', areas: [{ id: 'a', name: 'Plant', panels: [{ id: 'pn', name: 'MSB', circuits: ['CB1', 'CB2'], circuitMeta: { CB1: { cbType: 'MCB Type B', ampRating: '20A' } } }] }] };
    const parsed = await exportAndReimport(project, {}, { auditor: 'J', pushDate: '2026-09-21' });
    const meta = parsed.areas[0].panels[0].circuitMeta;
    expect(meta.CB1).toEqual({ cbType: 'MCB Type B', ampRating: '20A' });
    expect(meta.CB2).toBeUndefined();
  });
});

describe('RCD import: the blank 3-column template path is unaffected (regression guard)', () => {
  it('Area | Panel / DB Name | Circuit / CB | CB Type | Amp Rating (A) still imports both fields correctly', () => {
    const aoa = [
      ['INSTRUCTIONS: Fill in Area, Panel/DB Name, Circuit/CB label, CB Type (MCB/RCBO/RCD/MCCB) and Amp Rating (e.g. 16). One circuit per row. Rows 1-3 are read automatically — do not delete them.'],
      ['Area', 'Panel / DB Name', 'Circuit / CB', 'CB Type', 'Amp Rating (A)'],
      ['Plant', 'MSB', 'CB1', 'RCBO Type A', '32A'],
      ['Plant', 'MSB', 'CB2', 'MCB Type B', '16A'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = { SheetNames: ['Sheet1'], Sheets: { Sheet1: ws } };
    const parsed = parseExcelToProject(wb, 'Test', 'Co', '1', 'L');
    expect(parsed.areas[0].panels[0].circuitMeta).toEqual({
      CB1: { cbType: 'RCBO Type A', ampRating: '32A' },
      CB2: { cbType: 'MCB Type B', ampRating: '16A' },
    });
  });

  it('the legacy 2-column format with NO CB Type / Amp Rating columns at all still imports structure with no circuitMeta (never crashes)', () => {
    const aoa = [
      ['Area', 'Panel / DB Name'],
      ['Plant', 'MSB CB1'],
      ['Plant', 'MSB CB2'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = { SheetNames: ['Sheet1'], Sheets: { Sheet1: ws } };
    const parsed = parseExcelToProject(wb, 'Test', '', '', '');
    const panel = parsed.areas[0].panels[0];
    expect(panel.circuits.sort()).toEqual(['CB1', 'CB2']);
    expect(panel.circuitMeta).toBeUndefined();
  });
});

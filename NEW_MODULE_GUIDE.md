# SparkCheck — New Module Guide

The checklist for building (or substantially changing) a module so it is consistent **from day one**. Every rule below was
verified against the code at the time of writing; each names the reference implementation to copy. Cite by **function / constant
name** (line numbers drift). Everything lives in `src/App.jsx` — do not split the file.

> **To use in a fresh Claude Code session, paste:**
> *"Read CLAUDE.md, then NEW_MODULE_GUIDE.md. I want to [add module / change module]. Follow the two-phase workflow in section 1:
> investigate and propose a plan first, and wait for my approval before writing code."*

Terminology: **reference** = the module to copy from. **Shared** = a helper/component already in `App.jsx` that must be reused.

---

## 1. Investigation-first workflow

- [ ] **Phase 1 — investigate, then propose. Write no implementation code.** Read CLAUDE.md, this guide, and the reference
  modules' code. Present a plan and **wait for approval**. Decisions the user hasn't made are questions, not assumptions.
- [ ] Before building anything, list the existing shared pieces and say what is reusable vs genuinely new. Shared pieces today:
  `DeleteButton`, `ConfirmReset`, `failFill` / `useFailDefaults`, `defectGate` / `defectGateByStatus`, `ReportStatTiles` /
  `ReportFailedItems` / `ReportNoDefects` / `reportPriorityBadge`, `DefectListCards`, `SWBDropdownsView`,
  `IELEditableDropdown`, `CompleteAuditBtn`, `NavBtn` (+ `NAV_ICON_*`), `deliverExportFile`, `resizeImageToDataUrl`,
  `parseCompanyRow`, `ImportErrorBoundary`, `nw()`, `slugify`, `uid`, `fmtDate`, `load` / `save`.
- [ ] Look at how **each** existing module does the thing (not just one). Where they disagree, say so and recommend — don't
  silently pick. (This app's audit found the same idea implemented differently in 7 modules; that is the cost being avoided.)
- [ ] Phase 2 — implement, run `npm test` **and** `npm run build` after every change, then verify in a real browser (section 11).
- [ ] Update CLAUDE.md (Module Map row, any new standard) in the same change.

**Repo gotchas (learned the hard way)**
- Edit `src/App.jsx` with the Edit tool or a Node script (`fs.readFileSync(..., 'utf8')`). Never `sed -i`, `cat >`, or PowerShell
  redirects — they corrupt the UTF-8 file. `CLAUDE.md` has CRLF line endings: use **single-line** anchors when editing it.
- In scripts, don't rely on literal backslashes in heredocs (they get halved); use `String.fromCharCode(92)` or write the script
  with the Write tool. Assert an exact match count before every replacement.
- After a bulk transform, confirm the build **and** grep for now-undefined names — a bundler will not catch them.
- Code style: `React.createElement` (no JSX in source), inline styles only, functional components, Australian locale (DD/MM/YYYY).
- **Layout rule** (from prior overflow bugs): a flex row containing a `<select>` gets `minWidth:0` on the select and
  `width:"100%", overflow:"hidden"` on the container; `DeleteButton`'s confirm wrapper must never have `flexShrink:0`.

---

## 2. State & storage

Reference: **`ELTApp`** (newest, cleanest), `SWBApp`.

- [ ] Storage keys: `<module>-<thing>-v1` as `K_<MOD>_*` constants. The standard five: `-projects-`, `-results-`, `-meta-`,
  `-history-`, `-dropdowns-` (e.g. `elt-projects-v1`, `elt-results-v1`, `elt-meta-v1`, `elt-history-v1`, `elt-dropdowns-v1`).
  Extra lists get their own key (e.g. TAT's `tat-dropdowns-v1`). Bump the version (`v1`→`v2`) on any data-model change so
  existing users' data isn't misread. (RCD is `v6` and IEL `v2` for historical reasons; new modules start at `v1`.)
- [ ] **Site (project) shape**: `{ id, name, company, abn, licence, <structure> }` where structure is `areas: [...]`
  (hierarchical, e.g. `areas → panels/boards → items`) or `assets: [...]` (flat, ELT). `id` = the module's slug helper on the
  name (`slugify`, `ielSlug`, `swbSlug`, … — every one appends a `uid`, so ids are collision-safe; never build an id from the
  bare name). Never store results on the site.
- [ ] **Results**: `results[projectId][...structureIds] = record`, record has `status` (`STATUS` values `untested|pass|fail|na`)
  plus defect fields `rectified`, `defectId`, `responsibility`, `priority`, `notes`.
- [ ] **Meta**: `meta[projectId] = { auditor, testDate, nextTestDate }`.
- [ ] **History snapshot** (pushed by `archiveAudit`, newest first, capped at 100):
  `{ id, projectId, projectName, testDate, auditor, archivedAt, results, meta }` **plus a copy of the structure if it is
  editable** (ELT stores `assets`) so exporting an old audit uses the structure as it was.
- [ ] `load`/`save` helpers: load everything in one mount effect, set a `loaded` flag, and gate every persistence effect on it
  (`React.useEffect(()=>{ if(loaded) save(K_X, x); },[x,loaded])`). Use `load`/`save` — don't touch `localStorage` for data
  (RCD and IEL read a small "audit entered" flag from it directly; that is legacy, not a pattern to copy). `save` already
  raises the storage-full banner.
- [ ] A site delete must also delete that site's results, meta **and** history entries (reference: `ELTApp` / `RCDApp`
  `onDeleteProject`). TAT's currently removes only results, leaving meta/history orphaned — don't copy it.
- [ ] Count strings go through `nw(n, "fitting")` — never hand-write "N items" (it produced "1 fittings").

---

## 3. Navigation & shell

Reference: **`ELTApp`** shell and nav; `SWBNavBtn`/`NavBtn`.

- [ ] **Bottom nav, 6 tabs, always this order**: Home, Audit, Report, History, Manage, Dropdowns, using `NAV_ICON_HOME /
  AUDIT / REPORT / HISTORY / MANAGE / DROPDOWNS` (17px, stroke 1.8, line icons). Only shown when a site is open
  (`view !== "projects"`). Enforced for ELT by a test in `src/elt-dropdowns.test.jsx`.
- [ ] **Bar styling** comes from the module styles' `bottomNav`: background `#f7f6f3`, `borderTop: 1px solid #e4e4e7`,
  `paddingBottom: 34px`, `boxShadow: 0 200px 0 200px #f7f6f3`. Button = `NavBtn`: `minHeight 50`, `padding 10px 0 6px`, label
  9px, weight 700 active / 500 idle, active `borderTop: 2px solid`.
- [ ] **Active-tab colour is SLATE `#334155` — pass it explicitly (`color:"#334155"`) — never the module accent.** (Real fix:
  ELT and Calendar had used their accent; Thermo/IRT had a different bar height.) Do not write a new nav-button component;
  reuse `NavBtn` (Thermo's and IRT's are thin wrappers around it).
- [ ] Module accent colour is used for: header rule, primary CTAs, date pill, section labels, project-list card accents,
  Manual/Import toggle — **not** the nav.
- [ ] **Registering a module** (all of these, in one change):
  1. `AppRoot`: add `if (module === "<key>") return React.createElement(<Mod>App, {onGoHome: ()=>setModule(null)});`
  2. `AppRoot` `modules` array (the 2-column home grid — Calendar is NOT in it; it is the fixed bottom pill): `{key, color, name, desc, onClick, icon}` (same shape as the others). Icon = `mIcon(...)` with the `P`/`R`/`C` helpers: 24px viewBox, stroke 2, round caps, no fill, so it matches the set. Keep `desc` to one short line (~30 chars) so the two columns stay even.
  3. A `<MOD>_COLOR` constant (+ `_DIM`/`_BORDER` tints if the accent is used for tints).
  4. **Calendar**: add an entry to `CAL_TYPES` (label, colour, icon, period) **and** add `K_<MOD>_PROJECTS` to the site-list
     `Promise.all` in `CalendarApp` (ELT was missing from both — a real bug).
  5. CLAUDE.md: Module Map row, and add the module to the "Modules to audit" scope of the Delete Consistency item.
- [ ] Project list header pattern: title, "Sites" heading, site cards with the `DeleteButton` ("Remove site?") under each card.

---

## 4. Fail-only / defect panel

Reference: **SWB item page** (`SWBItemPage`) and **ELT** (`ELTAssetPage`). Parity is enforced by
`src/fail-panel-parity.test.jsx`; behaviour by `src/fail-panels.test.jsx`.

- [ ] **Trigger**: the item's status is FAIL. Derived triggers are fine if documented (ELT: any of the 4 sub-checks failed;
  IRT: auto from readings `<1 MΩ` or manual; Thermo: result `FAIL`). Nothing else shows the FAIL panel.
- [ ] **Panel**: `background #fee2e2`, `border 1px solid #fca5a5`, `borderRadius 10`, `padding 12px`, `marginBottom 4`.
  **Heading**: `⚠ FAIL — DEFECT DETAILS`, 10px, weight 800, `#dc2626`, letterSpacing 1, marginBottom 10. Field wrapper =
  the module's `modalField` (marginBottom 14), label = `modalLabel` (10px, weight 700, letterSpacing 0.8).
- [ ] **Fields, in order**: `RECTIFIED / SCHEDULED ACTION` (editable dropdown) · `DEFECT ID` (text, placeholder **`e.g. 74`**) ·
  `RESPONSIBILITY` (editable dropdown) · `PRIORITY` (None / L / M / H / U buttons, `PRIORITY_OPTIONS/LABELS/COLORS/BG`).
- [ ] **Position: the panel goes BEFORE the notes/comments box** (immediately after the result buttons / date fields).
- [ ] **Retention: defect data is RETAINED when an item leaves FAIL. Never clear it on save or on a status change.** The panel
  just hides. (Reports and exports gate on status instead — sections 6 and 8. SWB used to clear on save; fixed to match.)
- [ ] **★ defaults are STORED, not just displayed.** The first option of each list is the default. Use
  `useFailDefaults(isFail, values, {rectified, responsibility}, apply)` inside the panel component (fills an item that is
  already FAIL when the panel opens) and `failFill(record, rectList, respList)` on any code path that sets FAIL without opening
  the panel (grid "set all"). Apply `failFill` **only when the patch sets status to FAIL** — applying it on every patch re-inserts
  a value the user cleared. Never overwrite an existing value.
- [ ] **Editable dropdown, fed by the module's customisable lists — not a native `<select>`.** Reuse `IELEditableDropdown`
  (`{options, value, onChange, placeholder, color, colorBg}`; TAT reuses it with its own accent). Options come from the module's
  `dropdowns` state with the module's defaults as fallback. Give the module's Dropdowns tab the matching lists (section 7).
  Deliberate exception: ELT — see the exceptions list.
- [ ] **Asset-level derived FAIL (Welder, ELT).** When the FAIL is a property of the whole asset (Welder: all 12 items answered and any Fail;
  ELT: any sub-check failed), put ONE panel on the asset page, not one per item. Compute the trigger from a derived summary function
  (never store it), pass that boolean to `useFailDefaults`, and gate reports/exports with `defectGate(res, overall==="fail")`.
  Defect data stays on the asset record and is retained when the asset leaves FAIL.
- [ ] **Always-visible per-item fields (Welder).** Where the client form shows Result, Measured Value/Notes and Corrective Action for every
  item regardless of result, render all three on every item card. This is NOT a fail-only panel; do not hide them behind FAIL.
- [ ] **Static per-item criteria text (Welder).** Reference wording (e.g. "Min insulation resistance 5 MΩ") lives in the checklist
  constant, is shown on the item card and written to the export, and is not user-editable or stored per result.
- [ ] **Shared date helpers must use UTC.** `addMonthsISO` / `addYearsISO` parse `YYYY-MM-DD` as UTC; do month/year maths with `setUTC*`
  (fixed with the Welder module: local `setMonth` lost a day across daylight saving). Any new next-due default must use them.
- [ ] Live-patch modules (RCD, IEL, TAT) save on every change; form-based modules (SWB, IRT, Thermo, ELT) save on "Save".
  Either is fine — pick the reference's pattern and stay consistent inside the module.

---

## 5. Delete & reset confirmation

Reference: `DeleteButton`, `ConfirmReset`; tests `src/reset-confirm.test.jsx`, `src/calendar-delete.test.jsx`.

- [ ] **Every destructive action uses the shared confirm — no instant deletes, ever.** That covers: delete site / area / panel /
  board / item / fitting, delete a history snapshot, delete a photo, **delete a Dropdowns option**
  (`DeleteButton compact`), **"Reset" / "Reset to defaults" on any Dropdowns list** (`ConfirmReset` — it wraps the module's own
  idle button via `renderIdle`, so the idle look is unchanged), and "Reset all results" on Home (`DeleteButton` with
  `label:"Reset all results?"`, as ELT does).
- [ ] **No `window.confirm`, no modals, no home-grown `confirmId`/`showConfirm` state.**
- [ ] **One prompt open at a time.** `DeleteButton`, `ConfirmReset` and the Calendar event card all share the module-level
  `activeDeleteSetter`: opening one closes any other (`if (activeDeleteSetter && activeDeleteSetter !== set) activeDeleteSetter(false)`).
  Anything custom must register the same way.
- [ ] Completing an audit uses `CompleteAuditBtn` (its own "Archive this audit and reset for next run?" prompt). Continuing from a
  history snapshot confirms before replacing the current audit (see `ELTHistoryView`).
- [ ] Non-destructive "reset" buttons (e.g. a grid's "set all → untested") are status changes, not deletes — but if data is
  discarded, it needs the confirm.

---

## 6. Report tab

Reference: **`SWBReportView`, `IRTReportView`** (originals), **`ELTReportView`** (newest). Test: `src/report-tab.test.jsx`.

- [ ] Wrapper `summaryWrap`. **Title** = site name in `summaryTitle` (22px, weight 900, letterSpacing 1.5). Company line 12px
  `#6e6a66` (only if set). **Subtitle** `"<MODULE> AUDIT REPORT · <auditor>"` (13px `#6e6a66`); each module keeps its own wording
  (`RCD AUDIT REPORT`, `EMERGENCY LIGHTING REPORT`, …).
- [ ] **Date pill** (`duePill`, module accent border + text, calendar icon): `Tested: <date> → next due: <date>` (RCD shows one per
  test: `Push: … → next …`).
- [ ] **`ReportStatTiles`** — `rows=[[label, value, colour], …]`; colours Total `#334155`, Pass `#16a34a`, Fail `#dc2626`,
  N/A `#334155`, Untested `#92400e`. **Tile count/labels reflect the module's real result types — never an always-zero tile**
  (ELT dropped N/A: Total, Pass, Fail, Untested; Thermo has Total, Pass, Fail, Monitor).
- [ ] **Section label**: 12px, weight 700, letterSpacing 0.8, module accent (`BOARD SUMMARY`, `AREA SUMMARY`, `FITTING REGISTER`),
  with area / board / item breakdown rows beneath where the module has hierarchy.
- [ ] **`ReportFailedItems`** (heading is always **"Failed Items"**; pass `accent` = module colour). Each item:
  `{ title, tag?, badge?, path, defectId, comment, lines?, priorityText?, responsibility, rectified }` — renders Defect ID,
  `→ Responsibility`, and Rectified / Scheduled Action **the same way in every module**. Use `reportPriorityBadge(priority)`
  for the badge.
- [ ] **The list contains only items whose status is FAIL** — never filter on "has a priority/defect id" (retention means PASS items
  keep stale defect data; IRT had exactly this bug).
- [ ] Empty state: **`<ReportNoDefects/>` = "✓ No defects recorded"** whenever there are no failures.
- [ ] **No Export button on the Report tab. Export lives in History only** (`Export` on an expanded snapshot row).
- [ ] Non-FAIL states that matter get their own list (Thermo: an amber "Items to Monitor"), never under "Failed Items".

---

## 7. Dropdowns tab

Reference: **`SWBDropdownsView`** as used by ELT (`lists:ELT_DROPDOWN_LISTS, hint, showDefault, reserved`); `DefectListCards`
for IEL/TAT-style Responsibility + Rectified lists.

- [ ] **Reuse the shared view — don't build a new one.** `SWBDropdownsView({dropdowns, setDropdowns, onBack, lists, hint,
  showDefault=true, reserved=[]})`; `lists = [{key, label, defaults, desc}]`. For the standard defect lists use
  `DefectListCards({dropdowns, setDropdowns, sections, S, cardStyle})`.
- [ ] Option rows: `★` promotes an option to the top (index 0 = default), delete = `DeleteButton compact`, "Reset" =
  `ConfirmReset`. List titles: `RESPONSIBILITY`, **`RECTIFIED / SCHEDULED ACTION`**.
- [ ] **Reserved words**: pass `reserved:[...]` for values the UI supplies itself (ELT: `"Other"` — the shared view rejects adding
  it, case-insensitively).
- [ ] The Dropdowns state is persisted under `-dropdowns-vN`, merged over module defaults on load so a new list key never breaks
  an old install.

---

## 8. Exports

Reference: **`exportELTExcel`** (ExcelJS), `exportSWBExcel` (ExcelJS + photos), `exportIELExcel` (SheetJS). Tests:
`src/export-defect-gating.test.js`, `src/export-borders.test.js`, `src/export-photos.test.js`, `src/elt-export.test.js`.

- [ ] **Gate defect details on FAIL.** Read every item through **`defectGate(item, show)` / `defectGateByStatus(item)`** at the
  point the export reads it (it blanks `rectified, scheduledDate, rectifiedDate, defectId, responsibility, priority, risk`). Because
  data is retained after an item leaves FAIL, an ungated export shows leftover defect data and priority-colours PASS rows.
  Module-specific equivalents are allowed and must be documented and tested: **Thermo** gates FAIL **or** MONITOR;
  **RCD** gates inline on the row's displayed Pass/Fail (`pf==="Fail"`, because a >300 ms injection result counts as Fail
  whatever the stored status); **ELT** has no defect columns — its Failure Reason / Action Taken only reach the Notes cell for
  failed fittings, via `eltExportNotes`. Whatever the mechanism, add a case to `export-defect-gating.test.js`.
- [ ] **Deliver with `deliverExportFile(base64, filename, mime)`** — never a new mechanism (it handles the iOS native share
  bridge, Blob URLs and surfaces failures instead of failing silently).
- [ ] **ExcelJS vs SheetJS matters.** The community SheetJS (`xlsx`) build **silently ignores** `s` style objects — RCD, IEL, TAT,
  Thermo and IRT exports contain no fills/fonts/borders (verified by unzipping a real IEL export). **Only ExcelJS (SWB, ELT)
  writes real styles and images.** Never copy styling from a SheetJS module's source expecting it to appear; inspect a real file.
  Choose ExcelJS only if the module needs borders or photos.
- [ ] **ExcelJS module conventions** (copy from `exportELTExcel`):
  - **Header block is plain — no fill, font or border set:** row 1 title `"<site> — <Module> Test"`; row 2
    `company | ABN: … | Electrical Licence: …` (`company||"SparkCheck"`); row 3 `Auditor:` / `Date Tested:` / `Next Test Due:`;
    row 4 a 6pt spacer; row 5 the column headings. Merges A1:last, A2:last, A3:B3, C3:D3, E3:last, A4:last. Row heights
    32 / 16 / 16 / 6 / 40. (This matches the SheetJS modules' real output.)
  - **Data rows: full four-side thin grid borders via `swbXAB()`** (colour `FFD9D9D9`). `export-borders.test.js` locks SWB and ELT
    to the same border.
- [ ] **Photos** (if the module has them): capture through `resizeImageToDataUrl` (max 1280px, JPEG q 0.72, stored as
  `{id, dataUrl}`); embed with `wb.addImage` / `ws.addImage(..., {ext:{width,height}, editAs:"oneCell"})` using the shared
  `EXPORT_PHOTO_W_PX = 140`, `EXPORT_PHOTO_H_PX = 105` (**4:3, never stretched**) and `EXPORT_PHOTO_ROW_PT = 90` so the row is tall
  enough for the image (105px = 78.75pt). Photos of untested items must still export (a bug hit once).
- [ ] Only the History snapshot triggers exports (`onExportSnap`), using the archived structure and results.
- [ ] Which rows appear is a deliberate per-module choice (ELT's register lists only tested fittings) — say so in the import UI text
  if a re-import would otherwise surprise the user.

---

## 9. Import (if the module has one)

Reference: **`parseELTExcel`** + the ELT site-list toggle (`ELTProjectListView`); the SWB regression test
`src/swb-import.test.js`; tests `src/elt-import.test.js`, `src/elt-import-ui.test.jsx`.

- [ ] **Structure only — never results.** Import the register/hierarchy; every import starts a fresh audit (app-wide convention).
- [ ] **Header detection must be exact.** A row is the header only if **≥ 3 of the module's identifying headings match a cell
  exactly** (trimmed, lower-cased, normalised) **and** the one required column is among them. **Never a loose `contains` match on
  arbitrary text** — that is what made SWB import an exported report's checklist rows as boards. Skip rows with cells >60 chars
  (titles/instructions). **No blind fallback row.** Search all sheets.
- [ ] **Placeholders from the module's own export/template are not data.** Ignore `"SparkCheck"` (the export's blank-company
  placeholder) and the template's example company / ABN / licence and "enter your site name here".
- [ ] **Site name: strip the exact export suffix** (`— <Module> Test`), never `split(/[-–]/)`. Exports use an em dash and real site
  names contain hyphens ("Hearse Road - Firestone"). IEL/TAT/IRT/SWB still truncate — do not copy them.
- [ ] Validation, each with a clear message that **creates nothing**: wrong type (`.xlsx/.xls/.csv`), empty/unreadable file, no
  headings (name the required columns + offer the template), required column missing, zero usable rows. Skip rows missing the
  required field, collapse exact duplicates, ignore blank rows — and **count them in the preview**.
- [ ] Preview before confirming (editable site name/company/ABN/licence, counts, `⚠` warnings), wrapped in `ImportErrorBoundary`;
  "Re-upload" and "Cancel". Provide a template download via `deliverExportFile`. Unknown dropdown values import as `"Other"` + text
  rather than polluting the customisable list.
- [ ] Toggle: **Manual Entry / Import Excel** with the pencil and download icons; active tab = module accent border + text on the
  accent tint (ELT: `#0f766e` on `#ccfbf1`). Button text **"+ Add / Import Site"**; empty text **"No sites yet — add one or import
  from Excel below."** A module *without* import says "+ Add Site" / "No sites yet — add one to start testing."
- [ ] **Import lessons from Welder (`parseWelderExcel`) — a per-asset-sheet export.** (1) Read the **Register** for the list; never read results from per-asset sheets. (2) If the Register joins two fields into one cell (Welder: Brand + Model), don't guess a split — recover the exact fields from the asset's own sheet **identity cells only**, and only after verifying that sheet belongs to the row (position + a stable identifier such as Asset ID and Serial agree + the parts rejoin to the Register text); otherwise fall back to the joined text and say so in the preview. The rejoin check alone is NOT enough (two welders can share machine text split differently) — test that case. (3) After renaming a module, keep the **old title suffix** importable (Welder accepts both ` — Welder Test` and ` — Welder (VRD) Test`), since real exports outlive a rename. (4) Detect another module's export and say so (ELT file -> "import it from Emergency Lighting"). (5) The app persists empty `{}` / `[]` for a module's keys on mount, so "nothing was created" tests assert *empty*, not `null`. (6) Mutation-check safety tests: loosen the header rule, drop the identity verification, drop the skip rule, and confirm a test fails each time.

---

## 10. Copy & terminology

- [ ] **"Site"**, never "Project" (the internal `onAddProject` name is fine; UI text is not). Form labels: `SITE NAME`,
  `COMPANY (optional)`, `ABN (optional)`, `ELECTRICAL LICENCE (optional)` on the add-site and import forms. (The Manage-view "edit
  site" forms in every existing module use plain `COMPANY` / `ABN` / `ELECTRICAL LICENCE` — consistent with each other, so copy
  that there.)
- [ ] History title is **"Audit History"** (empty *and* populated) — never "<Module> History".
- [ ] Complete: heading `COMPLETE ACTIVE AUDIT`, button **"Complete <Module> Audit"** (RCD's is per test: "Complete Push Test").
  Start button: `Start / Continue Audit`.
- [ ] Next-date label: **`NEXT TEST DUE`**. Date fields display DD/MM/YYYY via `fmtDate` (never raw ISO).
- [ ] Empty report: **"✓ No defects recorded"**; list heading **"Failed Items"**; defect field label
  **`RECTIFIED / SCHEDULED ACTION`** (fail panel *and* Dropdowns list title); placeholder **`e.g. 74`**.
- [ ] Nav labels exactly: Home, Audit, Report, History, Manage, Dropdowns. Manage title `Manage: <site>`.
- [ ] Plural-correct counts via `nw()`. No emoji-as-icons in new UI (use the line-svg style); the `⚠` / `✓` glyphs in the standard
  strings above are the only exceptions.

---

## 11. Testing expectations

Run `npm test` and `npm run build` after every change. Vitest + jsdom, driving the real app through `AppRoot`
(seed `localStorage`, click through like a user).

- [ ] **Unit tests for state logic and export structure** (pure functions exported from `App.jsx`: parsers, summaries, export
  builders — see `elt.test.js`, `elt-export.test.js`, `export-borders.test.js`).
- [ ] **A real end-to-end UI test for anything that crosses a boundary** — file input → save → archive → export → unzip the
  downloaded `.xlsx` — not just hand-built fixtures. Hand-built export fixtures cannot catch a break upstream of the export
  function (that is how ELT's photo export bug slipped through). Reference: **`src/elt-photo-flow.test.jsx`** (jsdom can't decode
  images, so `Image`/canvas are stubbed to return the real JPEG fixtures in `src/test/jpeg-fixtures.js`).
- [ ] Standards tests to extend when you add a module: nav order (`elt-dropdowns.test.jsx`), fail-panel parity + behaviour
  (`fail-panel-parity.test.jsx`, `fail-panels.test.jsx`), reset/delete confirm (`reset-confirm.test.jsx`), report structure
  (`report-tab.test.jsx`), export gating (`export-defect-gating.test.js`), and item-detail scroll reset
  (`scroll-reset.test.jsx`). The scroll rule: the module's main scroll container (`<mod>MainRef`) is reset with
  `React.useLayoutEffect(() => { … ref.current.scrollTop = 0 }, [view, activeItemId])` when an item opens, otherwise the detail
  view inherits the list's scroll position. The test now covers all seven audit modules (RCD, IEL, TAT, Thermo, SWB, IRT, ELT;
  Calendar has no item view) — **add a case for every new module**. (ELT had the fix but no test until it was checked: the new
  case fails with the reset line removed and passes with it.)
- [ ] A test that asserts a **safety property** (a confirm appears, defect data isn't exported, an import is rejected) must be
  checked to fail without the fix, not just pass with it.
- [ ] **Real browser verification before calling a module done** — the Chrome extension or Playwright against the dev server
  (`npm run dev`, port 5173). Use `http://127.0.0.1:5173` as a **scratch origin**: it has separate `localStorage` from
  `localhost:5173`, so seeding never touches real data. Seed via `localStorage`, click through every tab (Home, Audit, Report,
  History, Manage, Dropdowns), take screenshots, compare against a reference module, then **clear the scratch origin**.
- [ ] Tooling limits to expect: the extension can't return base64/cookie-like output and browser downloads need the user's OK —
  generate an export file from the export function under Node and upload *that* (`file_upload` tool) when a round trip is needed.
- [ ] Still needs a **real device** pass (camera, native date pickers, share sheet, opening an export in a spreadsheet app) —
  jsdom and desktop Chrome can't prove these.

---

## Known deliberate exceptions — do NOT "fix" these

| Where | Divergence | Why |
|---|---|---|
| **ELT** fail panel | Fields are `FAILURE REASON` / `ACTION TAKEN` using **`ELTSelectOther`** (native select + literal "Other" + text box), no Defect ID / Responsibility / Priority | The AS 2293.2 register has no defect register; "Other" is always available and never stored in the list (hence `reserved:["Other"]`). Same red panel styling (parity test). Placed above Notes like the rest. |
| **ELT** structure | Flat `assets` list; no area/board hierarchy; Audit tab is the list (no `AuditGatePage`); one register export | Emergency lights are a flat register per site |
| **ELT** report / export | Report keeps the 14-column register table under the standard summary; export lists **only tested** fittings and has no summary sheet; Dropdowns has no ★ default (`showDefault:false`) | The export mirrors the client's register; "★ moves to top" still works |
| **ELT** wording | `NEXT TEST DUE (default for all fittings)`; Start button reads "Start / Continue Testing" | Known small wording drift — candidate for a later copy pass, not a standard |
| **Thermo** MONITOR | Third result, amber "⚠ MONITOR — DETAILS" panel, no failure defaults, listed as "Items to Monitor"; **4** report tiles (Total, Pass, Fail, Monitor); defect details exported for FAIL **and** MONITOR | MONITOR is not a failure but its panel deliberately collects the same details |
| **Thermo** photos | "Photo" = a typed number ledger (`Add Photo` form, required photo number) matching a separate FLIR camera; no image data | No camera/image infra — don't assume it exists |
| **SWB** panel | `RISK RATING` (native select L/M/H/U) instead of Priority buttons; board-level photos in `_photos` | Original SWB design; risk badge in the report |
| **RCD** | Two audit modes (push / injection), two pill sets and two tile groups on the report; push panel default record differs from inject; `Complete Push Test` / `Complete Injection Test` | Two distinct test types per circuit |
| **IRT** | Status auto-detected from readings; "tap to override" (a `<1 MΩ` reading can be overridden to PASS); danger banner must be dismissed before an item opens | Safety-critical testing workflow |
| **IEL** | Three fixed categories (E-Stops, Lanyards, Isolators) as `panels` named by category key | Product structure |
| **Calendar** | Not an audit module: 3-tab nav (Upcoming / Calendar / Add Event), own delete confirm with a "delete series" option — **but** it shares `activeDeleteSetter`; no project storage | Scheduling, not testing |
| **Older modules** | Home "Reset all results" uses an inline confirm row instead of `DeleteButton`; module-local copies of the editable dropdown / style objects (`SI`, `ST`, `SS`, `STH`); TAT's site delete leaves meta/history behind; RCD/IEL read an "audit entered" flag straight from `localStorage` | Legacy — **new modules use the shared pieces**; unifying is a future pass |
| **Manual/Import toggle** | (resolved 2026-09-25) | TAT, RCD and Thermo now match ELT/IEL/IRT/SWB: pencil/download icons, accent border + text, accent tint on the active tab. No longer an exception. |
| **TAT** date | Item page shows next-test-due as ISO `2026-12-23` | Known unfixed bug, not a standard |

_Keep this guide current: when a standard changes, change it here in the same commit._

### Welder — module-specific notes
- Overall is UNTESTED until every checklist item has any result (Pass / Fail / N/A); a Fail among blanks does not decide it. The asset-level FAIL panel, Failed Items and export defect columns therefore only appear once all items are answered.
- Actions Required counts FAIL items with a non-empty Corrective Action only.
- Identity fields (Location, Brand, Model, Serial, Asset ID) are edited in Manage and read-only on the welder page; per-audit fields (date, prepared by, instruments) prefill from Home and can be overridden.
- Export shape (`exportWelderExcel`, ExcelJS): a "Register" sheet (all welders, plain header block rows 1–5, full-grid borders, tinted Pass/Fail cells) plus ONE SHEET PER WELDER in the client checklist layout (header fields, Audit Summary, 12 items with criteria, defect details for FAIL welders only, comments, embedded photos). This register + per-asset sheets shape is new; reuse it when a client form is per-asset. Export is offered only from History snapshots.

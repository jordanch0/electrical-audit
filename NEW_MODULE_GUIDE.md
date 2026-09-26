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
  `parseCompanyRow`, `ImportErrorBoundary`, `nw()`, `slugify`, `uid`, `fmtDate`, `load` / `save`, and, for Site → Area → Assets modules, `AreaManager`, `AreaAuditGroups`, `AreaSummaryRows`, `groupAssetsIntoAreas`, `areaAssets`, `loadVersioned`, `removeAssetResults`.
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
  `-history-`, `-dropdowns-` (e.g. `elt-projects-v2`, `elt-results-v1`, `elt-meta-v1`, `elt-history-v2`, `elt-dropdowns-v1` — ELT and Welder projects/history are `-v2` since the area change; only keys whose shape changed were bumped).
  Extra lists get their own key (e.g. TAT's `tat-dropdowns-v1`). Bump the version (`v1`→`v2`) on any data-model change so
  existing users' data isn't misread. (RCD is `v6` and IEL `v2` for historical reasons; new modules start at `v1`.)
- [ ] **Site (project) shape**: `{ id, name, company, abn, licence, <structure> }` where structure is `areas: [...]`
  (hierarchical, e.g. `areas → panels/boards → items`) or the two-level `areas: [{id, name, assets:[…]}]` (ELT, Welder: assets sit directly in an area, no panel/board layer). `id` = the module's slug helper on the
  name (`slugify`, `ielSlug`, `swbSlug`, … — every one appends a `uid`, so ids are collision-safe; never build an id from the
  bare name). Never store results on the site.
- [ ] **Results**: `results[projectId][...structureIds] = record`, record has `status` (`STATUS` values `untested|pass|fail|na`)
  plus defect fields `rectified`, `defectId`, `responsibility`, `priority`, `notes`.
- [ ] **Meta**: `meta[projectId] = { auditor, testDate, nextTestDate }`.
- [ ] **History snapshot** (pushed by `archiveAudit`, newest first, capped at 100):
  `{ id, projectId, projectName, testDate, auditor, archivedAt, results, meta }` **plus a copy of the structure if it is
  editable** (ELT and Welder store `areas`) so exporting an old audit uses the structure as it was.
- [ ] `load`/`save` helpers: load everything in one mount effect, set a `loaded` flag, and gate every persistence effect on it
  (`React.useEffect(()=>{ if(loaded) save(K_X, x); },[x,loaded])`). Use `load`/`save` — don't touch `localStorage` for data
  (RCD and IEL read a small "audit entered" flag from it directly; that is legacy, not a pattern to copy). `save` already
  raises the storage-full banner.
- [ ] A site delete must also delete that site's results, meta **and** history entries (reference: `ELTApp` / `RCDApp`
  `onDeleteProject`). TAT's currently removes only results, leaving meta/history orphaned — don't copy it.
- [ ] Count strings go through `nw(n, "fitting")` — never hand-write "N items" (it produced "1 fittings").
- [ ] **Changing a stored data model = a migration, done this way (reference: the ELT/Welder area change).** (1) New key version for ONLY the keys whose shape changed. (2) A pure, non-mutating, idempotent migrate function per shape (site, history snapshot). (3) Load through `loadVersioned(newKey, oldKey, fallback, migrate)`: new key first; only if absent read the old key and migrate; **never write or delete the old key** — it is a permanent backup and makes the migration reversible. (4) Anything else that reads the key (e.g. `CalendarApp`) must use the same loader. (5) Tests: fixtures in the OLD shape including the awkward cases (many items sharing a value, blanks, case/whitespace variants, empty and malformed records), a seeded property test (count, ids and every field preserved; no duplicate groups), old key byte-identical afterwards, then mutation-check each rule. (6) Verify against the real stored data read-only, and in a scratch origin — never write to the real one.
- [ ] **Two-level Site → Area → Assets (ELT, Welder) — the pattern for a new module with no board / panel layer.** `site.areas:[{id,name,assets:[…]}]`; an asset does NOT store `location` — its AREA'S NAME is the Location (`areaAssets(site)` yields the flat list in area order, annotated with `location` + `areaId`; every summary, report, register and export reads through it, which is what makes exports come out grouped by area). Results stay keyed by asset id (`results[siteId][assetId]`, NOT nested by area) so moving an asset between areas needs no results migration. The older modules are three-level (area → panel / board → item) — do not copy that for a new asset-register module. **Location-field promotion (the migration from a flat list):** each asset's old Location becomes an area, grouped case- and whitespace-insensitively (`groupAssetsIntoAreas`), blank Location = the site name, first-appearance order, first-seen spelling, deterministic ids — so many assets sharing a Location land in ONE area. Area names are unique per site. Reuse `AreaManager` (Manage), `AreaAuditGroups` (Audit), `AreaSummaryRows` (Report). The versioned, non-destructive migration mechanics are the bullet above (`loadVersioned`, old key kept as a permanent backup); tests `src/area-migration.test.js`, `src/area-views.test.jsx`, `src/area-import.test.jsx`.
- [ ] Deleting an item removes its results/photos in ELT and Welder — a deliberate improvement over the older modules (see the exceptions table); do the same in new modules.

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
  2. `AppRoot` `modules` array (the 2-column home grid — Calendar is NOT in it; it is the fixed bottom pill): `{key, color, name, desc, onClick, icon}` (same shape as the others). **Icon = an entry in the `ICON_DEFS` registry, used as `moduleIcon("<key>")`** (24px viewBox, stroke 2, round caps, no fill, thematic to what the module tests) — the home card (18px) and the Calendar (15px) both call it, so the two can never drift. Keep `desc` to one short line (~30 chars) so the two columns stay even.
  3. A `<MOD>_COLOR` constant (+ `_DIM`/`_BORDER` tints if the accent is used for tints).
  4. **Calendar**: add an entry to `CAL_TYPES` (label, colour, period, and `icon: moduleIcon("<key>", 15)` — the SAME registry key as the home card, never a separate drawing) **and** add `K_<MOD>_PROJECTS` to the site-list
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
  **No module is an exception any more** — ELT's old `FAILURE REASON` / `ACTION TAKEN` (`ELTSelectOther`) panel was replaced by this
  standard panel (2026-09-26); `ELTSelectOther` now only serves ELT's Type field.
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
- [ ] **SAVE MODEL — one standard for every module: LIVE AUTO-SAVE (this is no longer a choice; 2026-09-25).** On a test-result item page every change is written to storage the moment it happens: no draft, **no Save button**, no "unsaved changes" prompt, and Back / tabs / Modules just leave (there is never anything to lose). Reference: `WelderAssetPage` (`set(patch)` = update the page + `onPatch(patch)`), also RCD / IEL / TAT; ELT, SWB and IRT were converted from Save-button drafts. Rules: (1) the page's setter both updates local state and calls the module's `onPatch`, whose app-level `patchItem` must be a **functional** `setAllResults(prev => …)` update so back-to-back patches (a ★ default fill right after a tap) can never overwrite each other; (2) ★ defaults (`useFailDefaults`) go through the same write-through setter, so they are stored live; (3) a **derived value is never frozen into the record by a save** — store what the user set and let readers derive (IRT: `status` stays `"untested"` = auto-detect from the readings until the user overrides it; every IRT reader computes `status === "untested" ? autoStatus(readings) : status`); (4) photos go through the same path (ELT / Welder). **Scope**: this covers test-result item pages only. Record-editing forms — Manage (site details, rename area, add / edit an asset) and Calendar's "Save Changes" — keep their explicit buttons. **Thermo is the one module whose item page is not a result form**: a Thermo circuit's page is a PHOTO-NUMBER LEDGER (each row = a FLIR photo number + its own result / details, see the exceptions table), so its "Add Photo" form is an add-entry form that creates ONE ledger row and commits it the moment it is submitted (`onPatchPhotos` -> `patchPhotos`, which writes straight to storage). It is not a draft-and-save pattern: there is nothing pending, no Save button on the item page and no unsaved-changes prompt (verified — no Save / discard control exists on it). Thermo's only Save button belongs to the Manage site-edit form. **Cost**: every change rewrites the module's whole results blob; measured in Chrome (desktop) at ~1.5 ms for 0.7 MB of photos, ~9 ms at 2.2 MB, ~15 ms at 3.5 MB; ~9 MB of photos exceeds the browser's localStorage quota outright. Only ELT and Welder keep photos in that blob; if typing ever lags on a photo-heavy site on a phone, coalesce the writes rather than reintroducing a Save button. Tests: `src/live-save.test.jsx` (ELT, SWB, IRT — no Save button, stored immediately, Back leaves with no prompt, IRT `0.5` → FAIL then `500` → PASS with status never frozen).

---

## 5. Delete & reset confirmation

Reference: `DeleteButton`, `ConfirmReset`; tests `src/reset-confirm.test.jsx`, `src/calendar-delete.test.jsx`.

- [ ] **Every destructive action uses the shared confirm — no instant deletes, ever.** That covers: delete site / area / panel /
  board / item / fitting, delete a history snapshot, delete a photo, **delete a Dropdowns option**
  (`DeleteButton compact`), **"Reset" / "Reset to defaults" on any Dropdowns list** (`ConfirmReset` — it wraps the module's own
  idle button via `renderIdle`, so the idle look is unchanged), and "Reset all results" on Home. **The standard is the six older modules' look**: the labelled, underlined text button **"Reset all test results"** (`SS.resetBtn`), then the prompt **"Reset all results?"**. Build it with the shared `ConfirmReset` (`renderIdle` = that button, `prompt:"Reset all results?"` → Reset / Keep pills) so it shares `activeDeleteSetter`. **Not** a bare bin-icon `DeleteButton` — ELT and Welder shipped that by mistake (the guide used to cite ELT as the reference) and were corrected 2026-09-25; `src/welder-fixes.test.jsx` asserts the button's style equals SWB's.
- [ ] **No `window.confirm`, no modals, no home-grown `confirmId`/`showConfirm` state.**
- [ ] **One prompt open at a time.** `DeleteButton`, `ConfirmReset` and the Calendar event card all share the module-level
  `useCollapsible` (the shared hook that replaced `activeDeleteSetter`): opening one closes any other, AND a click outside the expanded element collapses it. It listens for `click` in the capture phase (never `pointerdown` — a layout shift between finger-down and finger-up can lose the tap).
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
- [ ] **Score / completion percentage (only if the module needs one — Welder is the only module that has it).** Formula: **Score = Pass / (Total − N/A) × 100**, one decimal. Untested / blank and FAIL items STAY in the denominator, so a Fail never moves the score; only N/A removes an item from it (which raises the weight of every remaining Pass). Show `—` only when every item is N/A; a brand-new asset is `0.0%`. Derive it in a pure helper (never store it) and show it on the item page's live summary and in the export's summary block (an incomplete asset exports its partial score) — NOT on the Report tab tiles or the register (Welder shows no score there). Reference: `src/welder.test.js`, `src/welder-fixes.test.jsx`. (The earlier Pass / (Pass + Fail) formula printed 100% after one Pass — do not reintroduce it.)
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
- [ ] **One row style everywhere (2026-09-26).** Every option row on every Dropdowns tab — including TAT's own Appliance-name / Equipment-Type / Test-Frequency lists — is built with the shared **`ddRowStyle(isDefault)`** and every list container with **`ddListStyle(extra)`**: grey box `#e8e6e2`, border `1px solid #f7f6f3`, `borderRadius 7`, `padding 7px 10px`, `gap 8` inside the row, **5px between rows** (`DD_LIST_GAP`). The ONE deliberate visual distinction is the ★ default row: amber border `#fcd34d` (`DD_STAR_BORDER`) plus the amber `★ DEFAULT` badge. Never hand-write these values in a new view (the constants exist so the views cannot drift; Thermo had a stray 6px gap and TAT's lists used card-coloured rows before). Style depends only on ★ / position, never on whether an option is shipped or user-added. Test: `src/dropdown-row-style.test.jsx` (Responsibility list in all 8 modules + TAT's three lists).
- [ ] **No native `<select>` anywhere (2026-09-26); native DATE inputs are the only native pickers.** A choice field is the app's styled dropdown: an OPEN list (typed text allowed) = the `EditableDropdown` family (`IELEditableDropdown` for new code); a CLOSED choice, a value that differs from its label, or choice + typed text = the shared **`StyledSelect`** (`{value,label}` options, `allowEmpty`, `allowCustom`, compact / right-aligned popover, `stopClicks`). A closed scale (L/M/H/U) is the Priority BUTTON set. `src/styled-select.test.jsx` scans the source for a native select. Both join `useCollapsible`.
- [ ] **Adding an option goes through `dropdownAdd(items, raw, reserved)`** (+ `DropdownNotice`): trimmed; an existing option in ANY letter case is refused with an inline notice and the typed text stays; nothing is reordered (so ★ cannot move); a reserved word is refused as "<word> is already built in". Test: `src/dropdown-add.test.jsx`.
- [ ] Option rows: `★` promotes an option to the top (index 0 = default), delete = `DeleteButton compact`, "Reset" =
  `ConfirmReset`. List titles: `RESPONSIBILITY`, **`RECTIFIED / SCHEDULED ACTION`**.
- [ ] **Reserved words**: pass `reserved:[...]` for values the UI supplies itself (ELT Type: `"Other"` — the shared view rejects adding
  it, case-insensitively). A list can opt out of the `★ DEFAULT` badge with `noDefault:true` (ELT's Type list: selects start blank; its
  Responsibility / Rectified lists pre-fill their top option on FAIL like every other module).
- [ ] The Dropdowns state is persisted under `-dropdowns-vN`, merged over module defaults on load so a new list key never breaks
  an old install.

---

## 8. Exports

Reference: **`exportELTExcel`** (ExcelJS, split main + Defects), `exportSWBExcel` (ExcelJS + photos), and the shared builders **`xjSplit` / `xjSheet`** used by RCD, IEL, TAT, Thermo and IRT (`exportIELExcel` is the simplest). ALL eight module exports are ExcelJS. Tests:
`src/export-defect-gating.test.js`, `src/export-borders.test.js`, `src/export-photos.test.js`, `src/elt-export.test.js`, `src/export-styles.test.js`, `src/export-print-layout.test.js`, `src/export-zero-fail.test.js`.

- [ ] **Gate defect details on FAIL.** Read every item through **`defectGate(item, show)` / `defectGateByStatus(item)`** at the
  point the export reads it (it blanks `rectified, scheduledDate, rectifiedDate, defectId, responsibility, priority, risk`). Because
  data is retained after an item leaves FAIL, an ungated export shows leftover defect data and priority-colours PASS rows.
  Module-specific equivalents are allowed and must be documented and tested: **Thermo** gates FAIL **or** MONITOR;
  **RCD** gates inline on the row's displayed Pass/Fail (`pf==="Fail"`, because a >300 ms injection result counts as Fail
  whatever the stored status); **ELT** reads through `defectGate(raw, overall==="fail")` in `eltRegisterRows`, like Welder. Whatever the mechanism, add a case to `export-defect-gating.test.js`.
- [ ] **Defect HEADINGS are always present — even with zero fails.** Column headings come from a static array (or a fixed block, as on the
  per-welder sheet), never from "does any row fail?". Gating only blanks the VALUES. Add the module to `src/export-zero-fail.test.js`
  (an "only passes" and a "nothing tested" dataset). Summary sheets (SWB Register, Welder Register) carry the same defect columns as the detail sheets.
- [ ] **A wide flat-table export (> ~10 columns) is SPLIT, not shrunk (2026-09-26).** Main table = `#`, identifiers, dates, result, key values, Notes
  (no FAIL-only columns); a separate `Defects` sheet = FAIL rows only, keyed by the same `#`, always present with its headings and a "No defects
  recorded" line when empty. Build it with **`xjSplit(wb, {...})`** (ExcelJS; extra sheets go in via `between`, e.g. IRT's Readings) — every export is ExcelJS,
  never SheetJS (SheetJS drops cell styles and page setup; keep it for import parsing only). Keep the main table the FIRST sheet (importers read sheet 1).
  Headings wrap, so size columns to content and target >= 85% fit-to-width on landscape A4. **Date columns are forced >= 13 wide** (`XJ_DATE_W`; dates are
  `dd/mm/yyyy` text — always `fmtDate` them) **and `Pass / Fail` columns >= 11** (`XJ_RESULT_W`, so "UNTESTED" / "MONITOR" stay on one line), both through the shared **`xjColWidth(heading, w)`** — `xjSheet` applies it to every column and ELT's own sheets call it directly; a new export that builds its own sheet must call it too. **Headings stay self-explanatory** — do not abbreviate a heading to save width (widen the column or let it wrap; the ELT check-name headings were deliberately left in full). **The `#` column** = a plain row number assigned at export (never the Defect ID, which is optional and not unique); the Defects sheet repeats it as the cross-reference to the main table. IRT has THREE sheets (`Register` = short, client-PDF, first; `Readings`; `Defects`) via `between`. **Page setup is NATIVE, from the shared `xjPageSetup(sheet, landscape, titleRow)`** — A4, landscape (RCD Summary portrait), `fitToPage` 1 page wide / height free, 0.25" side margins, the heading row repeated on every page (`printTitlesRow`), "Page x of y" footer — written by ExcelJS itself; there is **no JSZip / XML post-processing anywhere** (JSZip is a test-only helper for unzipping the file). **Gridlines:** the printed grid comes from the thin borders on every data cell (`swbXAB()`), NOT from the sheet's gridlines flag — the builders never set `showGridLines` / `printOptions`, so do not rely on it. **Applies to ALL eight exports** (verified by reading the real XML back, 2026-09-26): the split modules and ELT get it through `xjSheet` / `xjSplit`; SWB and Welder call `xjPageSetup` directly — the Register (landscape, heading row 5 repeated) and each per-board / per-welder FORM sheet (landscape, fit to width, page footer, no repeating heading row because a form is not a long table). Any sheet a new export adds must call `xjPageSetup` too. Tests: `src/export-print-layout.test.js` (every module, incl. SWB and Welder). Add the module to `src/export-styles.test.js` (borders, result colours, zebra, date widths) and
  `src/export-print-layout.test.js` (values, `#` cross-reference, page setup, re-import).
- [ ] **Deliver with `deliverExportFile(base64, filename, mime)`** — never a new mechanism (it handles the iOS native share
  bridge, Blob URLs and surfaces failures instead of failing silently).
- [ ] **ExcelJS for every export; SheetJS only for reading.** The community SheetJS (`xlsx`) build **silently ignores** cell styles and drops page
  setup (landscape / fit-to-width / repeating headings), and cannot embed images — that is why RCD, IEL, TAT, Thermo and IRT were converted to ExcelJS
  (2026-09-26) and every module now exports through ExcelJS. Keep `xlsx` for import parsing and blank import templates only. Never copy styling from
  a SheetJS snippet expecting it to appear; inspect a real generated file.
- [ ] **ExcelJS module conventions** (copy from `exportELTExcel`):
  - **Header block is plain — no fill, font or border set:** row 1 title `"<site> — <Module> Test"`; row 2
    `company | ABN: … | Electrical Licence: …` (`company||"SparkCheck"`); row 3 `Auditor:` / `Date Tested:` / `Next Test Due:`;
    row 4 a 6pt spacer; row 5 the column headings. Merges A1:last, A2:last, A3:B3, C3:D3, E3:last, A4:last. Row heights
    32 / 16 / 16 / 6 / 40. (All eight exports share this block; `xjSheet` builds it for the split modules.)
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
- [ ] **Import lessons from Welder (`parseWelderExcel`) — a per-asset-sheet export.** (1) Read the **Register** for the list; never read results from per-asset sheets. (2) If the Register joins two fields into one cell (Welder: Brand + Model), don't guess a split — recover the exact fields from the asset's own sheet **identity cells only**, and only after verifying that sheet belongs to the row (position + a stable identifier such as Asset ID and Serial agree + the parts rejoin to the Register text); otherwise fall back to the joined text and say so in the preview. The rejoin check alone is NOT enough (two welders can share machine text split differently) — test that case. (3) After renaming a module, keep the **old title suffix** importable (Welder accepts both ` — Welder Test` and ` — Welder (VRD) Test`), since real exports outlive a rename. (4) Detect another module's export and say so (ELT file -> "import it from Emergency Lighting"). (5) The app persists empty `{}` / `[]` for a module's keys on mount, so "nothing was created" tests assert *empty*, not `null`. (6) Mutation-check safety tests: loosen the header rule, drop the identity verification, drop the skip rule, and confirm a test fails each time. (7) In a two-level module the Location column becomes the AREA on import — blank Location = the site name as currently typed in the preview, and the preview shows the resulting area counts.

---

## 10. Copy & terminology

- [ ] **"Site"**, never "Project" (the internal `onAddProject` name is fine; UI text is not). Form labels: `SITE NAME`,
  `COMPANY (optional)`, `ABN (optional)`, `ELECTRICAL LICENCE (optional)` on the add-site and import forms. (The Manage-view "edit
  site" forms in every existing module use plain `COMPANY` / `ABN` / `ELECTRICAL LICENCE` — consistent with each other, so copy
  that there.)
- [ ] History title is **"Audit History"** (empty *and* populated) — never "<Module> History".
- [ ] Complete: heading `COMPLETE ACTIVE AUDIT`, button **"Complete <Module> Audit"** (RCD's is per test: "Complete Push Test"). **Text only — no icon or ✓ glyph on the button or on its "Yes, Complete" confirm** (pass a plain string as `label`; `src/ui-consistency.test.jsx` fails if a label is an element).
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
| **ELT / Welder** structure | Two levels only: Site → Area → Assets (no panel/board layer); Audit is ONE grouped list (area headers), not the drill-down the other modules use; results keyed by asset id (not nested by area); one register export ordered by area. (Reverses the earlier "flat list" exception — 2026-09-25.) | Emergency lights / welders have no board level; asset-id keys mean zero results migration and free moves between areas |
| **ELT / Welder** delete | Deleting an asset or an area also removes its results and photos (`removeAssetResults`) | **Deliberate improvement, not parity**: RCD / IEL / TAT / Thermo / SWB / IRT leave orphaned results and photos when an item is deleted. Worth backporting in a future pass; the older modules were intentionally left untouched |
| **ELT / Welder** area names | Unique per site (case/whitespace-insensitive); add/rename to an existing name is refused | A duplicate would split one physical location into two groups; the older modules allow duplicates |
| **ELT** report / export | Report keeps the 20-column register table (same columns as the export) under the standard summary; export lists **only tested** fittings and has no summary sheet; Dropdowns shows ★ DEFAULT on Responsibility / Rectified but not on Type (`noDefault:true`) | The export mirrors the client's register; "★ moves to top" still works |
| **ELT** wording | `NEXT TEST DUE (default for all fittings)`; Start button reads "Start / Continue Testing" | Known small wording drift — candidate for a later copy pass, not a standard |
| **Thermo** MONITOR | Third result, amber "⚠ MONITOR — DETAILS" panel, no failure defaults, listed as "Items to Monitor"; **4** report tiles (Total, Pass, Fail, Monitor); defect details exported for FAIL **and** MONITOR | MONITOR is not a failure but its panel deliberately collects the same details |
| **Thermo** photos | "Photo" = a typed number ledger (`Add Photo` form, required photo number) matching a separate FLIR camera; no image data | No camera/image infra — don't assume it exists |
| **Thermo** save / item page | The item page is a photo-number LEDGER, not a result form: `Add Photo` (required photo number) creates one row and commits immediately (`onPatchPhotos`); each row carries its own result. No Save button or unsaved prompt on the item page — Thermo's only Save is the Manage site-edit form | The number matches a separate FLIR camera's photo; nothing is drafted, so it is consistent with the live-auto-save standard, just a different shape |
| **TAT** frequency labels | TAT's own Dropdowns tab labels keep the category wording ("1 Month — Hire / Construction" …) | Settled decision — the labels stay on that tab; only Calendar's duplicate copies of the wording are to be fixed (Planned Features, CLAUDE.md) |
| **GSD** (General Site Defects) | A REPORT tool, not an audit: no results / status / fail panel / score / Failed Items (its Report lists defects instead), no Manual/Import toggle, no "continue from a snapshot" (its History is otherwise the ELT pattern: accordion cards with title / High-Urgent badge / date · auditor / Archived time / coloured stats, then View Results / Export / Delete; a snapshot view with summary pills and a thumbnail per defect row); photos in IndexedDB (not localStorage) with ids on the item; Priority is the fixed L/M/H/U set (not a Dropdowns list); the export is a portrait photo report at scale 100 (manual page breaks) plus a landscape Register | A punch-list needs many photos per defect (localStorage quota); every photo record has exactly one owner, so deleting the owner deletes it |
| **SWB** panel | The field is labelled `RISK RATING` (not Priority) — same L / M / H / U buttons and look as Priority elsewhere since 2026-09-26; board-level photos in `_photos` | Original SWB design; risk badge in the report |
| **RCD** | Two audit modes (push / injection), two pill sets and two tile groups on the report; push panel default record differs from inject; `Complete Push Test` / `Complete Injection Test` | Two distinct test types per circuit |
| **IRT** | Status auto-detected from readings; "tap to override" (a `<1 MΩ` reading can be overridden to PASS); danger banner must be dismissed before an item opens | Safety-critical testing workflow |
| **IEL** | Three fixed categories (E-Stops, Lanyards, Isolators) as `panels` named by category key | Product structure |
| **Calendar** | Not an audit module: 3-tab nav (Upcoming / Calendar / Add Event), own delete confirm with a "delete series" option — **but** it shares `useCollapsible`; no project storage | Scheduling, not testing |
| **Older modules** | (the Home "Reset all results" confirms are no longer an exception — all eight modules use the shared `ConfirmReset`, 2026-09-26); module-local copies of the editable dropdown / style objects (`SI`, `ST`, `SS`, `STH`); TAT's site delete leaves meta/history behind; RCD/IEL read an "audit entered" flag straight from `localStorage` | Legacy — **new modules use the shared pieces**; unifying is a future pass |
| **Manual/Import toggle** | (resolved 2026-09-25) | TAT, RCD and Thermo now match ELT/IEL/IRT/SWB: pencil/download icons, accent border + text, accent tint on the active tab. No longer an exception. |
| **TAT** date | Item page shows next-test-due as ISO `2026-12-23` | Known unfixed bug, not a standard |

_Keep this guide current: when a standard changes, change it here in the same commit._

### Welder — module-specific notes
- Overall is UNTESTED until every checklist item has any result (Pass / Fail / N/A); a Fail among blanks does not decide it. The asset-level FAIL panel, Failed Items and export defect columns therefore only appear once all items are answered.
- Actions Required counts FAIL items with a non-empty Corrective Action only.
- Identity fields (Brand, Model, Serial, Asset ID) are edited in Manage; Location is the welder's AREA (changed with the Area select in the edit form) and read-only on the welder page; **Date Tested, Prepared By (= the Home Auditor) and Test Instruments are SITE-level only** (Home / report meta) — there is no per-welder override; every reader (Register, export) uses the site meta, and legacy per-welder `date` / `preparedBy` / `instruments` values on old records are stripped by `welderGetRes` (ignored on read, dropped on the next save; no key bump needed).
- **Score = Pass / (12 − N/A) × 100**, one decimal (2026-09-25 correction; it used to be Pass / (Pass + Fail), which printed 100% after a single Pass). Blank and FAIL items stay in the denominator — a Fail never moves the score; only N/A removes an item from it, raising the weight of every Pass. `—` only when all 12 are N/A; a brand-new welder is `0.0%`. Shown on the welder page's live summary and the per-welder export sheet's Audit Summary (an incomplete welder exports its partial score); the Report tab and Register show no score. Tests: `src/welder.test.js`, `src/welder-fixes.test.jsx`.
- Export shape (`exportWelderExcel`, ExcelJS): a "Register" sheet (all welders, plain header block rows 1–5, full-grid borders, tinted Pass/Fail cells) plus ONE SHEET PER WELDER in the client checklist layout (header fields, Audit Summary, 12 items with criteria, defect details for FAIL welders only, comments, embedded photos). This register + per-asset sheets shape is new; reuse it when a client form is per-asset. Export is offered only from History snapshots.

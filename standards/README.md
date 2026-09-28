# Standards folder — copyrighted, local only

This folder holds the actual Australian Standard (and other external
reference) documents that SparkCheck's checklists, thresholds, intervals
and export wording appear to depend on. **These documents are copyrighted
and must never be committed to git** — see the `.gitignore` entry added
alongside this README.

Drop each document you own into the matching module subfolder below, using
the **exact filename** shown (so future compliance passes can find them by
a predictable path). Use the PDF (or best available text/HTML) of the
actual standard, not a summary or a vendor's guide to it — clause numbers
have to come from the real document.

Naming convention: `code_edition.pdf` — the standard's code with any `/`,
`.` and spaces replaced by `_`, then the year. Example:
`AS_NZS_3760_2022.pdf`.

## What to obtain, per module

Everything below marked **unverified** was inferred from wording or
numeric thresholds already present in the app's checklists/exports — it
is a best guess at which standard is relevant, not a claim about what
that standard requires. Two citations are already explicit in the code
(noted below); everything else has **no in-app citation at all**.

| Folder | Suspected standard(s) | Status | Why |
|---|---|---|---|
| `rcd/` | AS/NZS 3760 (in-service RCD testing) and/or the RCD device standards (AS/NZS 61008 / 61009) | unverified, no in-app citation | Push/injection test structure and the >300 ms trip-time fail threshold (`msIsOver`) strongly resemble in-service RCD test practice, but the app cites no standard number anywhere for RCD. |
| `iel/` | Possibly the AS 1755 and/or AS 4024 series (machinery/plant safety — isolators, e-stops, lanyards) | **unverified — Jordan's working guess (2026-09-28), not confirmed against any document yet** | IEL tests isolators, e-stops and lanyards; no standard is named anywhere in the module. Get both series and confirm which (if either) actually governs before citing either in the app. |
| `tat/` | AS/NZS 3760 (In-service safety inspection and testing of electrical equipment) | unverified, no in-app citation | TAT's test-frequency categories ("Hire / Construction" = 1‑monthly, "Building / Construction / Demolition" = 3‑monthly, "Factory / Warehouse / Production" = 6‑monthly, "Hostile environment" = Annual) match the well-known AS/NZS 3760 environment/interval table structure, but the code number is never printed anywhere in the app. |
| `thermo/` | **No formal standard — confirmed by Jordan (2026-09-28), not standard-based.** | n/a | Thermo has no formal pass/fail checklist — it's a FLIR photo-number ledger with a subjective Fail/Monitor call. No document needed for this module; nothing to drop in `thermo/`. |
| `swb/` | Possibly AS/NZS 3000 (Wiring Rules) and/or AS/NZS 61439 (switchgear and switchboard assemblies) | unverified, no in-app citation | SWB's 11-point checklist (enclosure, ventilation, busbars, terminations, etc.) is qualitative only — no numeric thresholds, no standard cited. |
| `irt/` | **AS/NZS 3000** | already cited in-app (unverified edition) | The IRT item page shows "Min pass: ≥1 MΩ (AS/NZS 3000) · Healthy: ≥100 MΩ" directly in the UI. This is the one module with an explicit, user-visible standard citation — get the edition right. |
| `elt/` | **AS 2293.2** | already cited in a code comment (unverified edition) | A source comment reads "ELT MODULE — Emergency Lighting Testing (AS 2293.2:2019)". The "2019" is unverified — confirm the current edition. Not shown to the end user anywhere in the UI or export. |
| `welder/` | Likely AS 60974.1 / IEC 60974-1 (arc welding equipment safety) and/or AS 1674.2 (VRD requirements) | unverified, no in-app citation | `WELDER_CHECKLIST` has the most specific numeric criteria in the whole app (insulation resistance 1/2.5/5/10 MΩ across five different circuit pairs, ≤35 V open-circuit voltage, 200 Ω max VRD switching resistance, ≤0.5 s / 0.3 s VRD speed) — these read like they were transcribed from a specific standard's test table, but no standard is cited anywhere in the code. **Highest priority to verify** given how specific and safety-critical these numbers are. |
| `gsd/` | None — General Site Defects is a punch-list tool, not standard-based | n/a | No action needed unless you want a reference doc for defect categorisation conventions. |
| `shared/` | Anything that applies across modules — e.g. AS/NZS 3000 (Wiring Rules) if you want one copy referenced by both `irt/` and `swb/` | — | Use this for a document more than one module leans on, instead of duplicating the same PDF into two folders. |

## Filenames to use

```
standards/rcd/AS_NZS_3760_<edition>.pdf        (if you determine this is the right one)
standards/iel/AS_1755_<edition>.pdf            (working guess — confirm before use)
standards/iel/AS_4024_<part>_<edition>.pdf     (working guess — confirm before use)
standards/tat/AS_NZS_3760_<edition>.pdf
standards/swb/AS_NZS_3000_<edition>.pdf        (or AS_NZS_61439_<part>_<edition>.pdf)
standards/irt/AS_NZS_3000_<edition>.pdf
standards/elt/AS_2293_2_<edition>.pdf
standards/welder/AS_60974_1_<edition>.pdf      (and/or AS_1674_2_<edition>.pdf for VRD)
standards/shared/<code>_<edition>.pdf
```

`thermo/` needs nothing — confirmed not standard-based (2026-09-28).

Once the files you have are in place, tell me which ones and I'll do the
Compliance section (report section 3) by reading only the documents you
supplied, quoting clause numbers, and marking anything not findable in
your text as "no source found" for a licensed electrician to confirm —
never filling a gap from memory.

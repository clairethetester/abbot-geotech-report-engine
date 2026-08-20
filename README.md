# Abbot Geotech Report Engine — V1 MVP

Offline-first PWA for capturing geotechnical field data and generating certifier-ready reports.
No framework, no build step, no paid services. One HTML file, a manifest and a service worker.

## Quick start (free hosting on GitHub Pages)

1. Open the published URL (live: https://clairethetester.github.io/abbot-geotech-report-engine/) on the engineer's phone/tablet:
   - **iOS Safari:** Share → *Add to Home Screen*.
   - **Android Chrome / desktop Chrome & Edge:** the install prompt appears, or menu → *Install app*.
2. The service worker caches the whole app on first load — after that it runs with **zero signal**,
   which is the normal condition on a rural NSW site.

> HTTPS is required for PWA install and the service worker; GitHub Pages provides it automatically.
> Opening `index.html` directly from disk still works as a plain web page (no offline install).

## What V1 does

- **Three report types** (Desktop Assessment / Site Classification + Wind / Comprehensive
  Investigation) sharing one data spine; switching type hides sections without deleting data.
- **Tab navigation + Next/Back** — jump anywhere, or walk the sections in field order.
- **Single-source data**: address, dates, job number, class are entered once and flow through the
  entire document (WCAG 2.2 “redundant entry”, and the fix for the internal-contradiction failures
  seen in competitor samples).
- **Dynamic field records**: boreholes with layered soil profiles, DCP tests, lab samples (LL/LS).
- **Photo capture** from the device camera, compressed on-device (~1400 px JPEG) into the report
  appendix with captions.
- **Completeness engine**: required content per report type. The section tabs are the progress
  indicator — green when a section is complete, orange-dashed when started, plain when untouched —
  and a section only counts as complete once something has actually been entered in it. PDF is
  available at any time but carries a **DRAFT — NOT FOR CONSTRUCTION** watermark until every
  requirement is met and the report is formally issued with a named reviewer.
- **PDF via the browser print engine** (File → Print → Save as PDF) — works on iOS, Android,
  Windows, macOS and Linux with no dependencies; A4 print stylesheet included.
- **Export / import (.json)** for device-to-device transfer and office review; also the future
  integration point for quote-system prefill (`report.source` is reserved for it).
- **Autosave** on every input to device storage, with a graceful in-memory fallback and a visible
  warning where storage is unavailable.

## Compliance mapping (why each element exists)

| Report element | Why it's required |
|---|---|
| Lot & DP + full street address | NSW certifiers reject non-lot-specific reports before CC/CDC issue |
| Document status table (author/reviewer/revision/date) | Professional accountability; DBP Act duty of care context |
| Single fieldwork date reused everywhere | Prevents the contradictory-dates defect observed in a competitor sample |
| AS 2870 class + written justification | The engineer classifies; the app never computes the standard |
| Calculated class vs class adopted for design | AS 2870 allows a more conservative design class; the override is what a certifier checks, so it must be justified |
| Slope stability & landslide risk (AGS 2007), optional | Required by councils with geotechnical slope guidelines; adds risk-to-property, risk-to-life, retaining parameters and the council declaration |
| AS 4055 inputs + class, optional AS 1170.2 note | Wind class required for Class 1/10 design; the note is Abbot's refinement upsell |
| Borehole logs with method/depth/water/profile | AS 1726 investigation records; certifier evidence |
| Founding advice & bearing pressures | The differentiator — a report a structural engineer can act on |
| Hold points list | Keeps the report valid through construction and re-engages Abbot |
| Limitations | Liability boundary, present in every competitor sample |
| DRAFT watermark until issue | Stops incomplete reports reaching clients while lab results are pending |

## Accessibility (WCAG 2.2 AA highlights)

Labels on every control; 44 px minimum targets; visible focus rings; skip link; `aria-current`
step tabs; status messages via live regions; redundant entry eliminated by design; `autocomplete`
attributes on personal fields; reduced motion respected; colour contrast checked against AA on
all token pairs; photo inputs have text alternatives via captions.

## Architecture notes for the next developer

- **`store` wrapper is the only persistence surface.** Phase 2 = replace its four methods with
  Supabase calls (auth + `reports` table with row-level security + Storage bucket for photos).
  Nothing else in the app needs to change.
- All state lives in one `db` object (`id → report`); rendering is stateless from it.
- Section templates are plain functions in `TPL`; add a section by adding to `SECTIONS` + `TPL`
  + (optionally) `requirements()`.
- The report document is built in `buildReport()` — one function, straight from state, so the
  preview and the PDF can never disagree with the entered data.
- Escaping: all user text passes through `esc()`/`nl()` before entering the DOM.

## Roadmap

**Phase 2 — Supabase (free tier):** email/OTP auth, multi-device sync, photo originals in
Storage, office review workflow (engineer submits → reviewer approves → issue), report templates
per report type versioned in a table.
**Phase 3 — output fidelity:** merge uploaded PDF attachments (lab/DCP reports) into the issued document server-side; vendor pdf.js so PDF attachments can render as embedded pages offline; server-side PDF render (headless Chromium via a free-tier worker)
for pixel-identical letterhead, page headers/footers with job number on every page, and archival
PDF/A output.
**Phase 4 — intake integration:** quote/CRM prefill into `report.source`, client portal delivery
links, and automatic hold-point booking reminders.

## Housekeeping that must not regress

- **Do not upload an older `index.html` over a newer one.** Commit 7048cdc (slope module +
  classification split) was wiped by a later "Add files via upload" and had to be recovered from
  git history. Uploading whole files through the web UI replaces, it does not merge.

- **Every URL in the `sw.js` SHELL array must resolve.** `cache.addAll()` rejects on a single 404,
  which rejects the install handler, which means no offline cache at all — the one thing the app
  exists to do. `tests/ux-round.spec.js` checks this on every run.
- **Bump `CACHE` in `sw.js` on every deploy**, or installed apps keep serving the old shell.
- **Field binding is registered on both `input` and `change`.** Autofill, and `<select>` /
  `<input type=date>` on some platforms, fire `change` without `input`. Do not collapse this back
  to a single listener.

## Known MVP limits (deliberate)

- Data lives on one device until exported (Phase 2 fixes).
- Print headers/footers per page depend on the browser (Phase 3 fixes).
- No authentication — do not store sensitive client data on shared devices.
- The app structures standards *inputs* but never computes AS 2870/AS 4055 outcomes: engineering
  judgement is the product.

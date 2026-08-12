# Abbot Report Engine — V1 MVP

Offline-first PWA for capturing geotechnical field data and generating certifier-ready reports.
No framework, no build step, no paid services. One HTML file, a manifest and a service worker.

## Quick start (free hosting on GitHub Pages)

1. Create a GitHub repository (e.g. `abbot-report-engine`) and push these files to the root.
2. Repository → Settings → Pages → Source: *Deploy from a branch* → `main` / root. Save.
3. Open the published URL on the engineer's phone/tablet:
   - **iOS Safari:** Share → *Add to Home Screen*.
   - **Android Chrome / desktop Chrome & Edge:** the install prompt appears, or menu → *Install app*.
4. The service worker caches the whole app on first load — after that it runs with **zero signal**,
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
- **Completeness engine**: required content per report type; the strata progress bar shows section
  state; PDF is available at any time but carries a **DRAFT — NOT FOR CONSTRUCTION** watermark
  until every requirement is met and the report is formally issued with a named reviewer.
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

## Known MVP limits (deliberate)

- Data lives on one device until exported (Phase 2 fixes).
- Print headers/footers per page depend on the browser (Phase 3 fixes).
- No authentication — do not store sensitive client data on shared devices.
- The app structures standards *inputs* but never computes AS 2870/AS 4055 outcomes: engineering
  judgement is the product.

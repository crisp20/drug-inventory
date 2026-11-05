# ACP Stock change log

One entry per app version, newest first. Each entry has:

- **Summary**: what changed for people using the app.
- **Database**: table/field changes and what a developer must do to a local database.
- **Logic**: the rules added or changed.
- **Where**: the main files and why they changed.
- **All files changed**: generated list with added/removed line counts.
- **Code changes**: `docs/changes/vN.diff` holds the exact lines added (`+`) and removed (`-`) in that version. Admins can also view it highlighted on the in-app **Changes** page.

## Updating a local database

The database schema lives in `convex/schema.ts` and `convex/schema/*.ts`. Running `npx convex dev` pushes the schema and functions to your own Convex deployment.

- Every field added after v1 is optional (`v.optional`), so existing rows stay valid and **no migration is needed** unless an entry says otherwise.
- Entries marked **Data step** need a one-off function run, e.g. `npx convex run activity:backfillMovements '{"cursor": null}'`.
- Indexes are built automatically when the schema is pushed.

---

## v50 · 2026-11-05 · Refresh reminder, idle setting and change log

**Summary**
- A pop-up asks people to refresh when a new version is published, when the connection to the server dropped for over a minute (for example the computer slept), or when the app has not been used for the time set by an admin.
- If an entry is half-filled, the pop-up warns that it will be lost, and offers "Finish my entry first". It comes back as soon as the entry is recorded (or after 2 minutes).
- Settings has a new **Idle refresh** option (minutes, 0 = off, which is the default).
- New admin-only **Changes** page shows this log with highlighted code changes.

**Database**
- `settings.idleTimeoutMinutes` (optional number). No migration; missing means off.

**Logic**
- New version: every 5 minutes, and whenever the tab becomes visible, the app fetches `/` and compares the built script names (`/assets/index-*.js`) with the ones it is running. Different names mean a new publish. Does nothing in dev mode.
- Connection: uses the Convex client's connection state. A drop counts after 60 seconds. A gap of over 2 minutes in the app's own 5-second timer also counts, because that means the device slept.
- Idle: no taps, keys or scrolls for `idleTimeoutMinutes`. Activity is checked before it resets the timer, so the first tap after the limit still triggers the reminder.
- Refreshing from the pop-up clears the unsaved-entry flags first, so the browser's own "Leave site?" prompt does not appear a second time.

**Where**
- `src/lib/refresh-check.ts`: when to ask (`refreshReasonAt`) and new-version detection (`checkForNewVersion`).
- `src/hooks/use-refresh-reminder.ts`: timers, activity events, connection state, snooze.
- `src/components/refresh-reminder.tsx`: the pop-up; added to `src/components/app-layout.tsx`.
- `src/components/providers/unsaved-changes.tsx` and `src/hooks/use-unsaved-changes.ts`: new `clearAll()`.
- `convex/settings.ts`: `get` returns `idleTimeoutMinutes`; new `setIdleTimeout` mutation (admin only, logged).
- `convex/lib/settings.ts`: `cleanIdleTimeoutMinutes` (0 to 1440).
- `src/pages/settings/page.tsx`: Idle refresh form.
- `src/pages/changes/page.tsx` and `src/App.tsx`: Changes page at `/changes`.
- `docs/CHANGELOG.md` and `docs/changes/*.diff`: this log.

<!-- files:v50 -->
<details><summary>All files changed (19) · code: docs/changes/v50.diff</summary>

- `convex/lib/settings.ts` +19 -0
- `convex/schema/settings.ts` +2 -0
- `convex/settings.test.ts` +25 -0
- `convex/settings.ts` +37 -0
- `package.json` +2 -0
- `src/App.tsx` +2 -0
- `src/components/app-layout.tsx` +4 -0
- `src/components/providers/unsaved-changes.tsx` +1 -0
- `src/hooks/use-unsaved-changes.ts` +2 -0
- `src/pages/settings/page.tsx` +2 -0
- `src/components/refresh-reminder.tsx` (new) +98 -0
- `src/hooks/use-refresh-reminder.ts` (new) +113 -0
- `src/lib/refresh-check.test.ts` (new) +73 -0
- `src/lib/refresh-check.ts` (new) +72 -0
- `src/pages/changes/_components/diff-dialog.tsx` (new) +131 -0
- `src/pages/changes/_lib/changes.test.ts` (new) +27 -0
- `src/pages/changes/_lib/changes.ts` (new) +101 -0
- `src/pages/changes/page.tsx` (new) +95 -0
- `src/pages/settings/_components/idle-refresh-setting.tsx` (new) +103 -0

</details>
<!-- /files -->

## v49 · 2026-11-03 · Batch and expiry on Stock In

**Summary**
- Stock In has the same optional Batch and Expiry fields and GS1 scan box as Stock Out, with the same checks and the same mismatch pop-up.

**Database**
- None (`stockMovements.batch`, `expiry` and `mismatchedScan` already existed; now also filled on Stock In).

**Logic**
- `recordIn` accepts optional `batch`, `expiry` and `mismatchedScan`, checked with the same `cleanBatchExpiry` and `cleanMismatchedScan` as Stock Out. They are never required on Stock In.

**Where**
- `convex/stock.ts`: `recordIn` arguments.
- `src/components/stock/movement-form.tsx`: Batch/Expiry shown for both kinds.
- `src/components/stock/batch-expiry-fields.tsx`: `kind` prop so messages say Stock In or Stock Out.

<!-- files:v49 -->
<details><summary>All files changed (4) · code: docs/changes/v49.diff</summary>

- `convex/canister.test.ts` +30 -0
- `convex/stock.ts` +20 -3
- `src/components/stock/batch-expiry-fields.tsx` +13 -4
- `src/components/stock/movement-form.tsx` +15 -11

</details>
<!-- /files -->

## v48 · 2026-11-03 · Canister label printing

**Summary**
- With Fill canister on, the button becomes "Print Label & Record Stock Out". After recording, a 60x40 mm label is printed on the HPRT D35BT by Bluetooth, with the print window as a fallback and a Reprint button.

**Database**
- None.

**Logic**
- The Stock Out is saved first; a failed print never blocks the record.
- The label is drawn on a 320x480 dot canvas (8 dots/mm) in three sections, dithered to black and white, and sent as a CPCL `CG` bitmap in 180-byte chunks over Web Bluetooth.
- QR codes hold the Drug ID for now. The Fill box shows the user's initials and the date as YYMMDD.

**Where**
- `src/lib/label/label-data.ts`: label fields, initials, date formats, canister type names.
- `src/lib/label/render-label.ts`: draws the label.
- `src/lib/label/bitmap.ts`: dithering and the CPCL print job.
- `src/lib/label/bluetooth-printer.ts`: connecting and sending to the printer.
- `src/lib/label/print-label.ts`: Bluetooth and print-window printing.
- `src/components/stock/label-print-dialog.tsx`: preview, Print and Reprint.
- `src/components/stock/movement-form.tsx`: new button text and opening the dialog.
- New packages: `qrcode`, `@types/qrcode`, `@types/web-bluetooth`.

<!-- files:v48 -->
<details><summary>All files changed (10) · code: docs/changes/v48.diff</summary>

- `package.json` +3 -0
- `src/components/stock/label-print-dialog.tsx` (new) +200 -0
- `src/components/stock/movement-form.tsx` +46 -3
- `src/lib/label/bitmap.ts` (new) +77 -0
- `src/lib/label/bluetooth-printer.ts` (new) +99 -0
- `src/lib/label/label-data.ts` (new) +54 -0
- `src/lib/label/label.test.ts` (new) +54 -0
- `src/lib/label/print-label.ts` (new) +44 -0
- `src/lib/label/render-label.ts` (new) +257 -0
- `src/vite-env.d.ts` +1 -0

</details>
<!-- /files -->

## v47 · 2026-11-03 · Scanned code doesn't match the package

**Summary**
- If the GS1 code scanned for batch/expiry belongs to a different product, a pop-up offers "Continue anyway" or "Cancel and scan again". On Continue, the raw scan is saved and shown in Recent entries, the Log and the CSV.

**Database**
- `stockMovements.mismatchedScan` (optional string).

**Logic**
- `cleanMismatchedScan` trims the scan and limits it to 200 characters.

**Where**
- `convex/lib/canister.ts`, `convex/stock.ts`, `convex/lib/activity.ts`, `convex/schema/stock.ts`.
- `src/components/stock/batch-expiry-fields.tsx`, `movement-form.tsx`, `movement-log.tsx`.

<!-- files:v47 -->
<details><summary>All files changed (9) · code: docs/changes/v47.diff</summary>

- `convex/canister.test.ts` +22 -0
- `convex/lib/activity.ts` +6 -1
- `convex/lib/canister.ts` +22 -0
- `convex/schema/stock.ts` +3 -0
- `convex/stock.ts` +6 -1
- `src/components/stock/batch-expiry-fields.tsx` +40 -11
- `src/components/stock/movement-form-schema.ts` +2 -0
- `src/components/stock/movement-form.tsx` +10 -1
- `src/components/stock/movement-log.tsx` +5 -0

</details>
<!-- /files -->

## v46 · 2026-11-03 · GS1 fix: scanner types the separator as "029"

**Summary**
- Codes from scanners that type the invisible separator as the text "029" are now read correctly.

**Database**
- None.

**Logic**
- In `parseGs1`, "029" directly before a known field (10, 17, 21…) is treated as a separator. "029" inside a batch number is kept.

**Where**
- `convex/lib/gs1.ts`.

<!-- files:v46 -->
<details><summary>All files changed (2) · code: docs/changes/v46.diff</summary>

- `convex/lib/canister.test.ts` +17 -0
- `convex/lib/gs1.ts` +19 -4

</details>
<!-- /files -->

## v45 · 2026-11-03 · GS1 fix: missing separators

**Summary**
- Batch and expiry are read correctly when the scanner drops the separator after the serial number.

**Database**
- None.

**Logic**
- `parseGs1` tries the known field order when no separator is found.

**Where**
- `convex/lib/gs1.ts`.

<!-- files:v45 -->
<details><summary>All files changed (2) · code: docs/changes/v45.diff</summary>

- `convex/lib/canister.test.ts` +25 -0
- `convex/lib/gs1.ts` +80 -32

</details>
<!-- /files -->

## v44 · 2026-11-03 · Batch and expiry on Stock Out

**Summary**
- Stock Out has optional Batch and Expiry fields with a GS1 scan box. They are required only when Fill canister is on.

**Database**
- `stockMovements.batch` and `stockMovements.expiry` (optional strings, expiry is `YYYY-MM-DD`).

**Logic**
- `cleanBatchExpiry` validates the batch length and the expiry date. Expired stock is refused.

**Where**
- `convex/lib/canister.ts`, `convex/stock.ts`, `convex/lib/activity.ts`.
- `src/components/stock/batch-expiry-fields.tsx` (new), `canister-section.tsx`, `movement-form.tsx`, `movement-log.tsx`.

<!-- files:v44 -->
<details><summary>All files changed (13) · code: docs/changes/v44.diff</summary>

- `convex/canister.test.ts` +57 -0
- `convex/lib/activity.ts` +18 -5
- `convex/lib/canister.ts` +23 -0
- `convex/schema/stock.ts` +3 -0
- `convex/stock.ts` +16 -1
- `src/components/stock/batch-expiry-fields.tsx` (new) +212 -0
- `src/components/stock/canister-section.tsx` +15 -186
- `src/components/stock/movement-form-schema.ts` +15 -7
- `src/components/stock/movement-form.tsx` +17 -9
- `src/components/stock/movement-log.tsx` +11 -0
- `src/components/stock/package-form-summary.tsx` +6 -2
- `src/components/stock/reason-field.tsx` +19 -4
- `src/components/stock/stock-drug-finder.tsx` +31 -7

</details>
<!-- /files -->

## v43 · 2026-11-03 · Expiry warning setting

**Summary**
- Admins set how many months ahead canister stock counts as "expiring soon"; such stock asks staff to confirm.

**Database**
- `settings.expiryWarningMonths` (optional number, default 1, 0 = off).

**Logic**
- `expiryStatus` returns expired / soon / ok. The server allows one day of time-zone difference (`isExpiredOnServer`).

**Where**
- `convex/lib/expiry.ts` (new), `convex/settings.ts` (`setExpiryWarning`), `src/pages/settings/page.tsx`, `src/components/stock/canister-section.tsx`.

<!-- files:v43 -->
<details><summary>All files changed (10) · code: docs/changes/v43.diff</summary>

- `convex/lib/canister.ts` +3 -0
- `convex/lib/expiry.test.ts` (new) +56 -0
- `convex/lib/expiry.ts` (new) +53 -0
- `convex/schema/settings.ts` +2 -0
- `convex/settings.test.ts` +23 -0
- `convex/settings.ts` +45 -0
- `src/components/stock/canister-section.tsx` +65 -5
- `src/components/stock/movement-form-schema.ts` +7 -0
- `src/components/stock/movement-form.tsx` +43 -13
- `src/pages/settings/page.tsx` +96 -1

</details>
<!-- /files -->

## v42 · 2026-11-03 · Canister section on Stock Out

**Summary**
- A Canister section on Stock Out (Fill canister, batch, expiry, quantity, canister type). It is hidden unless switched on per user (Users page) or for everyone (Settings).

**Database**
- `stockMovements.canister` (optional object: batch, expiry, quantity, type).
- `users.canisterAccess` (optional boolean).
- `settings.canisterForEveryone` (optional boolean).

**Logic**
- Canister types are 1, 0.5, 0.33, 0.25 and 0.125. `canUseCanister` checks the user switch or the rollout setting, on the server too.
- First version of the GS1 parser (`parseGs1`).

**Where**
- `convex/lib/canister.ts`, `convex/lib/gs1.ts` (new), `convex/stock.ts`, `convex/users.ts` (`setCanisterAccess`), `convex/settings.ts` (`setCanisterRollout`).
- `src/components/stock/canister-section.tsx` (new), `src/hooks/use-canister-enabled.ts` (new), `src/pages/users/page.tsx`, `src/pages/settings/page.tsx`.

<!-- files:v42 -->
<details><summary>All files changed (20) · code: docs/changes/v42.diff</summary>

- `convex/canister.test.ts` (new) +124 -0
- `convex/lib/activity.ts` +2 -0
- `convex/lib/canister.test.ts` (new) +77 -0
- `convex/lib/canister.ts` (new) +69 -0
- `convex/lib/gs1.ts` (new) +102 -0
- `convex/schema/settings.ts` +2 -0
- `convex/schema/stock.ts` +12 -0
- `convex/schema/users.ts` +2 -0
- `convex/settings.ts` +39 -0
- `convex/stock.ts` +34 -2
- `convex/users.ts` +34 -1
- `src/components/stock/canister-section.tsx` (new) +235 -0
- `src/components/stock/movement-form-schema.ts` +70 -18
- `src/components/stock/movement-form.tsx` +53 -3
- `src/components/stock/movement-log.tsx` +10 -0
- `src/components/stock/stock-drug-finder.tsx` +3 -1
- `src/components/stock/stock-movement-page.tsx` +18 -5
- `src/hooks/use-canister-enabled.ts` (new) +13 -0
- `src/pages/settings/page.tsx` +57 -2
- `src/pages/users/page.tsx` +97 -14

</details>
<!-- /files -->

## v41 · 2026-11-03 · Hover preview of packaging pictures

**Summary**
- Hovering a packaging picture with the mouse shows a large preview after half a second. Touch screens still tap to open.

**Database**
- None.

**Where**
- `src/components/zoomable-drug-image.tsx` (`hoverPreview` prop), `src/components/stock/drug-package-picker.tsx`.

<!-- files:v41 -->
<details><summary>All files changed (2) · code: docs/changes/v41.diff</summary>

- `src/components/stock/drug-package-picker.tsx` +1 -0
- `src/components/zoomable-drug-image.tsx` +56 -18

</details>
<!-- /files -->

## v40 · 2026-11-03 · Admin Log page with CSV

**Summary**
- New admin-only Log page listing every change in the app, with filters and CSV download.

**Database**
- None (uses `activityLog` from v39).

**Where**
- `convex/activity.ts` (`list`), `src/pages/log/` (new page, filters, CSV export), `src/App.tsx`, `src/components/app-layout.tsx`.

<!-- files:v40 -->
<details><summary>All files changed (9) · code: docs/changes/v40.diff</summary>

- `convex/activity.test.ts` (new) +143 -0
- `convex/activity.ts` +17 -5
- `src/App.tsx` +2 -0
- `src/components/app-layout.tsx` +35 -6
- `src/pages/log/_components/activity-entry.tsx` (new) +98 -0
- `src/pages/log/_components/log-filter-bar.tsx` (new) +134 -0
- `src/pages/log/_lib/export-log.ts` (new) +82 -0
- `src/pages/log/_lib/log-filters.ts` (new) +56 -0
- `src/pages/log/page.tsx` (new) +167 -0

</details>
<!-- /files -->

## v39 · 2026-11-03 · Activity log (backend)

**Summary**
- Every medicine, package, photo, import, stock, undo, user and settings change is now written to an audit log.

**Database**
- New table `activityLog` with indexes `by_occurredAt`, `by_category_and_occurredAt`, `by_drug_and_occurredAt` and `by_movement`.
- **Data step**: to copy older Stock In/Out/Undo entries into the log, run `npx convex run activity:backfillMovements '{"cursor": null}'`. It continues by itself in batches and is safe to run again.

**Logic**
- `logActivity` and helpers in `convex/lib/activity.ts`. Names are copied in so entries still read correctly after edits or deletes.

**Where**
- `convex/lib/activity.ts`, `convex/schema/activity.ts`, `convex/activity.ts` (new); log calls added in `drugs.ts`, `drugImport.ts`, `drugPhotos.ts`, `settings.ts`, `stock.ts`, `users.ts`.

<!-- files:v39 -->
<details><summary>All files changed (11) · code: docs/changes/v39.diff</summary>

- `convex/activity.ts` (new) +73 -0
- `convex/drugImport.ts` +22 -5
- `convex/drugPhotos.ts` +16 -4
- `convex/drugs.ts` +20 -3
- `convex/lib/activity.ts` (new) +354 -0
- `convex/lib/period.ts` (new) +22 -0
- `convex/schema.ts` +2 -0
- `convex/schema/activity.ts` (new) +44 -0
- `convex/settings.ts` +17 -0
- `convex/stock.ts` +7 -23
- `convex/users.ts` +33 -1

</details>
<!-- /files -->

## v38 · 2026-11-03 · Package history filters

**Summary**
- The package history pop-up in Inventory uses the same filters as Recent entries.

**Database**
- None.

**Where**
- `src/components/stock/use-movement-filters.ts` (new shared hook), `movement-filter-bar.tsx`, `movement-log-section.tsx`, `src/pages/inventory/_components/package-history-dialog.tsx`.

<!-- files:v38 -->
<details><summary>All files changed (4) · code: docs/changes/v38.diff</summary>

- `src/components/stock/movement-filter-bar.tsx` +13 -7
- `src/components/stock/movement-log-section.tsx` +8 -21
- `src/components/stock/use-movement-filters.ts` (new) +43 -0
- `src/pages/inventory/_components/package-history-dialog.tsx` +107 -33

</details>
<!-- /files -->

## v37 · 2026-11-03 · Arrow keys in the medicine filter

**Summary**
- The medicine filter can be used with the up/down arrows and Enter.

**Database**
- None.

**Where**
- `src/components/stock/medicine-filter.tsx`.

<!-- files:v37 -->
<details><summary>All files changed (1) · code: docs/changes/v37.diff</summary>

- `src/components/stock/medicine-filter.tsx` +44 -5

</details>
<!-- /files -->

## v36 · 2026-11-03 · Recent entries filters

**Summary**
- Recent entries can be filtered by period, medicine and person.

**Database**
- None.

**Logic**
- Filters are applied in the database query before paging (`listMovements`). Periods come from `periodRange`.

**Where**
- `convex/stock.ts`, `convex/users.ts` (`listPeople`), `src/components/stock/medicine-filter.tsx`, `movement-filter-bar.tsx`, `movement-period.ts` (new), `movement-log-section.tsx`, `movement-log.tsx`.

<!-- files:v36 -->
<details><summary>All files changed (10) · code: docs/changes/v36.diff</summary>

- `convex/stock.test.ts` +49 -0
- `convex/stock.ts` +64 -20
- `convex/users.ts` +41 -5
- `src/components/stock/medicine-filter.tsx` (new) +106 -0
- `src/components/stock/movement-filter-bar.tsx` (new) +168 -0
- `src/components/stock/movement-form-schema.ts` +21 -4
- `src/components/stock/movement-log-section.tsx` +72 -46
- `src/components/stock/movement-log.tsx` +35 -14
- `src/components/stock/movement-period.test.ts` (new) +41 -0
- `src/components/stock/movement-period.ts` (new) +56 -0

</details>
<!-- /files -->

## v35 · 2026-11-03 · Cursor returns to the search box

**Summary**
- After an entry is recorded, the cursor goes back to the medicine search box, ready for the next scan.

**Database**
- None.

**Where**
- `src/components/drug-search-input.tsx` (`focusSignal`), `src/components/stock/stock-drug-finder.tsx`.

<!-- files:v35 -->
<details><summary>All files changed (2) · code: docs/changes/v35.diff</summary>

- `src/components/drug-search-input.tsx` +20 -1
- `src/components/stock/stock-drug-finder.tsx` +5 -1

</details>
<!-- /files -->

## v34 · 2026-11-02 · Quantity box limits

**Summary**
- The quantity box only takes digits, at most 6, so a stray scan can't become a huge number. Scans with a pause in the middle stay together.

**Database**
- None.

**Where**
- `src/components/stock/movement-form.tsx`, `src/lib/scanner-input.ts`.

<!-- files:v34 -->
<details><summary>All files changed (3) · code: docs/changes/v34.diff</summary>

- `src/components/stock/movement-form.tsx` +12 -0
- `src/lib/scanner-input.test.ts` +20 -0
- `src/lib/scanner-input.ts` +10 -3

</details>
<!-- /files -->

## v33 · 2026-11-02 · Scan guard on the quantity box

**Summary**
- A barcode scanned into the quantity box by mistake is undone and explained.

**Database**
- None.

**Logic**
- `useScanGuard` detects scanner-speed typing and blocks the rest, including the scanner's Enter.

**Where**
- `src/hooks/use-scan-guard.ts` (new), `src/components/stock/movement-form.tsx`, `src/hooks/use-scanner-input.ts`, `src/components/drug-search-input.tsx`, `src/pages/inventory/_components/scan-field.tsx`.

<!-- files:v33 -->
<details><summary>All files changed (6) · code: docs/changes/v33.diff</summary>

- `src/components/drug-search-input.tsx` +3 -2
- `src/components/stock/movement-form.tsx` +23 -0
- `src/hooks/use-scan-guard.test.ts` (new) +85 -0
- `src/hooks/use-scan-guard.ts` (new) +75 -0
- `src/hooks/use-scanner-input.ts` +27 -6
- `src/pages/inventory/_components/scan-field.tsx` +3 -2

</details>
<!-- /files -->

## v32 · 2026-11-02 · Scanning with a Chinese keyboard switched on

**Summary**
- Scans are read correctly even when a Chinese (or other) input method is on. A warning shows when a scan still looks wrong.

**Database**
- None.

**Logic**
- Fast bursts of keys (a scanner) are rebuilt from the physical key codes. Wide characters (０１２（）) are turned into normal ones (`toHalfWidth`).

**Where**
- `src/lib/scanner-input.ts`, `src/hooks/use-scanner-input.ts`, `src/components/scan-keyboard-warning.tsx` (new), `convex/lib/barcode.ts`, `src/components/drug-search-input.tsx`, `src/pages/inventory/_components/scan-field.tsx`, `barcode-confirm-entry.tsx`.

<!-- files:v32 -->
<details><summary>All files changed (9) · code: docs/changes/v32.diff</summary>

- `convex/lib/barcode.test.ts` +33 -7
- `convex/lib/barcode.ts` +28 -6
- `src/components/drug-search-input.tsx` +52 -27
- `src/components/scan-keyboard-warning.tsx` (new) +20 -0
- `src/hooks/use-scanner-input.ts` (new) +93 -0
- `src/lib/scanner-input.test.ts` (new) +100 -0
- `src/lib/scanner-input.ts` (new) +115 -0
- `src/pages/inventory/_components/barcode-confirm-entry.tsx` +66 -52
- `src/pages/inventory/_components/scan-field.tsx` (new) +76 -0

</details>
<!-- /files -->

## v31 · 2026-11-02 · Settings page and large quantity check

**Summary**
- New admin Settings page. Stock In/Out amounts at or above a set number (default 100) ask to confirm.

**Database**
- New table `settings` (single row): `largeQuantityThreshold`, `updatedAt`, `updatedByName`. Missing row means defaults apply.

**Where**
- `convex/schema/settings.ts`, `convex/settings.ts`, `convex/lib/settings.ts` (new), `src/pages/settings/page.tsx` (new), `src/components/stock/movement-form.tsx`, `src/App.tsx`, `src/components/app-layout.tsx`.

<!-- files:v31 -->
<details><summary>All files changed (9) · code: docs/changes/v31.diff</summary>

- `convex/lib/settings.ts` (new) +23 -0
- `convex/schema.ts` +2 -0
- `convex/schema/settings.ts` (new) +10 -0
- `convex/settings.test.ts` (new) +68 -0
- `convex/settings.ts` (new) +40 -0
- `src/App.tsx` +2 -0
- `src/components/app-layout.tsx` +2 -1
- `src/components/stock/movement-form.tsx` +91 -18
- `src/pages/settings/page.tsx` (new) +126 -0

</details>
<!-- /files -->

## v30 · 2026-11-02 · Old browser warning

**Summary**
- Very old browsers get a clear message instead of a blank page.

**Database**
- None.

**Where**
- `index.html` (check script), `src/main.tsx`.

<!-- files:v30 -->
<details><summary>All files changed (2) · code: docs/changes/v30.diff</summary>

- `index.html` +34 -0
- `src/main.tsx` +3 -1

</details>
<!-- /files -->

## v29 · 2026-11-02 · Undo an entry

**Summary**
- Admins can undo a Stock In or Stock Out with a reason. The entry stays in the history, marked as undone.

**Database**
- `stockMovements.undo` (optional object: reason, userRef, userName, stockBefore, stockAfter, undoneAt).

**Logic**
- `undoneStock` reverses the change; undoing a Stock In can't take stock below 0.

**Where**
- `convex/stock.ts` (`undoMovement`), `convex/lib/stock.ts`, `src/components/stock/undo-movement-dialog.tsx` (new), `movement-log.tsx`.

<!-- files:v29 -->
<details><summary>All files changed (6) · code: docs/changes/v29.diff</summary>

- `convex/lib/stock.ts` +41 -5
- `convex/schema/stock.ts` +16 -1
- `convex/stock.test.ts` +213 -24
- `convex/stock.ts` +78 -9
- `src/components/stock/movement-log.tsx` +81 -14
- `src/components/stock/undo-movement-dialog.tsx` (new) +129 -0

</details>
<!-- /files -->

## v28 · 2026-11-02 · Packaging pictures per package form

**Summary**
- Packaging pictures scroll sideways inside each package form; enlarging one offers "Use this package form".

**Database**
- None.

**Where**
- `src/components/stock/drug-package-picker.tsx`, `src/components/zoomable-drug-image.tsx`.

<!-- files:v28 -->
<details><summary>All files changed (2) · code: docs/changes/v28.diff</summary>

- `src/components/stock/drug-package-picker.tsx` +126 -30
- `src/components/zoomable-drug-image.tsx` +68 -10

</details>
<!-- /files -->

## v27 · 2026-11-02 · Better medicine search

**Summary**
- Search requires every typed word to match, so "abilify 10" finds the right strength.

**Database**
- None.

**Where**
- `convex/drugs.ts` (`search`), `convex/lib/drugs.ts` (`searchWords`, `matchesAllWords`).

<!-- files:v27 -->
<details><summary>All files changed (4) · code: docs/changes/v27.diff</summary>

- `convex/drugs.test.ts` +24 -0
- `convex/drugs.ts` +25 -5
- `convex/lib/drugs.test.ts` (new) +26 -0
- `convex/lib/drugs.ts` +11 -0

</details>
<!-- /files -->

## v26 · 2026-11-01 · Manufacturer on Stock In/Out cards

**Summary**
- The manufacturer shows on medicine cards in Stock In/Out too.

**Database**
- None.

**Where**
- `src/components/manufacturer-line.tsx` (new), `src/components/stock/drug-package-picker.tsx`, `src/pages/inventory/_components/drug-row.tsx`.

<!-- files:v26 -->
<details><summary>All files changed (3) · code: docs/changes/v26.diff</summary>

- `src/components/manufacturer-line.tsx` (new) +13 -0
- `src/components/stock/drug-package-picker.tsx` +2 -0
- `src/pages/inventory/_components/drug-row.tsx` +2 -7

</details>
<!-- /files -->

## v25 · 2026-11-01 · Manufacturer on Inventory cards

**Summary**
- Inventory cards show the manufacturer.

**Database**
- None.

**Where**
- `src/pages/inventory/_components/drug-row.tsx`.

<!-- files:v25 -->
<details><summary>All files changed (1) · code: docs/changes/v25.diff</summary>

- `src/pages/inventory/_components/drug-row.tsx` +7 -0

</details>
<!-- /files -->

## v24 · 2026-11-01 · Bulk photo upload

**Summary**
- Admins can upload many medicine photos (or zip files) at once. Files are matched by Drug ID from the file name, e.g. `25.jpg`.

**Database**
- None.

**Where**
- `src/pages/inventory/_components/photo-import-dialog.tsx`, `src/pages/inventory/_hooks/use-photo-import.ts`, `src/pages/inventory/_lib/read-photo-files.ts` (new), `convex/lib/drugPhotos.ts`, `src/pages/inventory/page.tsx`.

<!-- files:v24 -->
<details><summary>All files changed (9) · code: docs/changes/v24.diff</summary>

- `convex/drugPhotos.test.ts` (new) +68 -0
- `convex/drugPhotosSeed.ts` (deleted) +0 -35
- `convex/lib/drugPhotos.test.ts` (new) +28 -0
- `convex/lib/drugPhotos.ts` +2 -1
- `src/components/page-header.tsx` +1 -1
- `src/pages/inventory/_components/photo-import-dialog.tsx` (new) +255 -0
- `src/pages/inventory/_hooks/use-photo-import.ts` (new) +79 -0
- `src/pages/inventory/_lib/read-photo-files.ts` (new) +46 -0
- `src/pages/inventory/page.tsx` +7 -1

</details>
<!-- /files -->

## v23 · 2026-11-01 · Photo matching (backend)

**Summary**
- Backend for setting each medicine's main picture by Drug ID.

**Database**
- None (uses `drugs.imageId`).
- **Data step (one-off, already done on the live app)**: photos were loaded from a hosted zip. The temporary loader was removed in v24, so nothing needs running locally. Photos are files, so a local database starts without them.

**Where**
- `convex/drugPhotos.ts` (`checkPhotos`, `setPhotos`), `convex/lib/drugPhotos.ts` (new).

<!-- files:v23 -->
<details><summary>All files changed (4) · code: docs/changes/v23.diff</summary>

- `convex/drugPhotos.ts` (new) +73 -0
- `convex/drugPhotosSeed.ts` (new) +35 -0
- `convex/lib/drugPhotos.ts` (new) +41 -0
- `package.json` +1 -0

</details>
<!-- /files -->

## v21 · 2026-11-01 · Remove one-off import loaders

**Summary**
- Removed the temporary drug-loading code after the data was loaded.

**Database**
- None.

**Where**
- Deleted `convex/drugImportSeed.ts` and `convex/drugImportSeedData.ts`.

<!-- files:v21 -->
<details><summary>All files changed (1) · code: docs/changes/v21.diff</summary>

- `convex/drugImportSeed.ts` (deleted) +0 -22

</details>
<!-- /files -->

## v20 · 2026-11-01 · Load prepared drug list

**Summary**
- One-off load of the prepared Tablet/Capsule drug list.

**Database**
- **Data step (one-off, already done on the live app)**: drugs were loaded from a prepared list. The loader was removed in v21. For a local database, use the Inventory **Import** button with the spreadsheet instead.

**Where**
- `convex/drugImportSeed.ts`, `convex/drugImportSeedData.ts` (temporary; the data file is left out of the diff because of its size).

<!-- files:v20 -->
<details><summary>All files changed (1) · code: docs/changes/v20.diff</summary>

- `convex/drugImportSeed.ts` +9 -17

</details>
<!-- /files -->

## v19 · 2026-11-01 · Spreadsheet import

**Summary**
- Admins can import drugs from the pharmacy system spreadsheet. New drugs are added, changed ones are shown for review, and stock, pictures and app-only package forms are never touched.

**Database**
- None.

**Logic**
- Columns are matched by normalized header names. GS1 and plain versions of one barcode become one package form. Batches of 50.

**Where**
- `convex/lib/drugImport.ts`, `convex/drugImport.ts` (new), `src/pages/inventory/_components/import-dialog.tsx`, `import-conflict-card.tsx`, `src/pages/inventory/_hooks/use-drug-import.ts`, `src/pages/inventory/_lib/read-import-file.ts`.

<!-- files:v19 -->
<details><summary>All files changed (13) · code: docs/changes/v19.diff</summary>

- `convex/drugImport.test.ts` (new) +84 -0
- `convex/drugImport.ts` (new) +274 -0
- `convex/drugImportSeed.ts` (new) +30 -0
- `convex/drugs.ts` +2 -4
- `convex/lib/drugImport.test.ts` (new) +82 -0
- `convex/lib/drugImport.ts` (new) +222 -0
- `convex/lib/drugs.ts` +8 -0
- `package.json` +3 -0
- `src/pages/inventory/_components/import-conflict-card.tsx` (new) +111 -0
- `src/pages/inventory/_components/import-dialog.tsx` (new) +437 -0
- `src/pages/inventory/_hooks/use-drug-import.ts` (new) +116 -0
- `src/pages/inventory/_lib/read-import-file.ts` (new) +25 -0
- `src/pages/inventory/page.tsx` +12 -4

</details>
<!-- /files -->

## v17 · 2026-11-01 · Larger, uncropped pictures

**Summary**
- Medicine pictures are larger and shown whole (not cropped).

**Database**
- None.

**Where**
- `src/components/drug-image.tsx`, `drug-package-picker.tsx`, `drug-detail-sheet.tsx`, `drug-row.tsx`.

<!-- files:v17 -->
<details><summary>All files changed (4) · code: docs/changes/v17.diff</summary>

- `src/components/drug-image.tsx` +1 -1
- `src/components/stock/drug-package-picker.tsx` +1 -1
- `src/pages/inventory/_components/drug-detail-sheet.tsx` +1 -1
- `src/pages/inventory/_components/drug-row.tsx` +1 -1

</details>
<!-- /files -->

## v16 · 2026-11-01 · Piece name list

**Summary**
- "Piece name" (tablets, capsules…) is picked from a list. The manufacturer picker became a shared searchable dropdown.

**Database**
- None.

**Where**
- `src/components/search-select.tsx` (renamed from manufacturer-picker), `src/lib/piece-names.ts` (new), `drug-form-dialog.tsx`, `drug-form-schema.ts`.

<!-- files:v16 -->
<details><summary>All files changed (4) · code: docs/changes/v16.diff</summary>

- `src/components/search-select.tsx` (renamed from `src/pages/inventory/_components/manufacturer-picker.tsx`) +27 -17
- `src/lib/piece-names.ts` (new) +17 -0
- `src/pages/inventory/_components/drug-form-dialog.tsx` +37 -17
- `src/pages/inventory/_lib/drug-form-schema.ts` +1 -1

</details>
<!-- /files -->

## v15 · 2026-11-01 · Store GTIN for GS1 barcodes

**Summary**
- When a GS1 code is entered as a barcode, only the product number (GTIN) is saved.

**Database**
- None.

**Logic**
- `toStoredBarcode` turns a GS1 code into its GTIN (as the printed EAN-13 when it starts with 0).

**Where**
- `convex/lib/barcode.ts`, `convex/drugs.ts`, `src/pages/inventory/_components/barcode-confirm-entry.tsx`.

<!-- files:v15 -->
<details><summary>All files changed (4) · code: docs/changes/v15.diff</summary>

- `convex/drugs.ts` +2 -2
- `convex/lib/barcode.test.ts` +18 -1
- `convex/lib/barcode.ts` +17 -0
- `src/pages/inventory/_components/barcode-confirm-entry.tsx` +8 -3

</details>
<!-- /files -->

## v14 · 2026-11-01 · Manufacturer list

**Summary**
- The manufacturer is picked from ACP's list; other names can still be typed.

**Database**
- None.

**Where**
- `src/lib/manufacturers.ts` (new), `src/pages/inventory/_components/manufacturer-picker.tsx` (new), `drug-form-dialog.tsx`.

<!-- files:v14 -->
<details><summary>All files changed (3) · code: docs/changes/v14.diff</summary>

- `src/lib/manufacturers.ts` (new) +271 -0
- `src/pages/inventory/_components/drug-form-dialog.tsx` +3 -3
- `src/pages/inventory/_components/manufacturer-picker.tsx` (new) +76 -0

</details>
<!-- /files -->

## v13 · 2026-11-01 · New logo

**Summary**
- Updated logo and browser tab icon.

**Database**
- None.

**Where**
- `index.html`, `src/components/brand-logo.tsx`.

<!-- files:v13 -->
<details><summary>All files changed (2) · code: docs/changes/v13.diff</summary>

- `index.html` +1 -1
- `src/components/brand-logo.tsx` +1 -1

</details>
<!-- /files -->

## v12 · 2026-11-01 · Arial font

**Summary**
- The app uses Arial throughout.

**Database**
- None.

**Where**
- `src/index.css`.

<!-- files:v12 -->
<details><summary>All files changed (1) · code: docs/changes/v12.diff</summary>

- `src/index.css` +3 -4

</details>
<!-- /files -->

## v11 · 2026-11-01 · Package history

**Summary**
- Inventory shows the full Stock In and Stock Out history of each package form.

**Database**
- New index `stockMovements.by_package_and_occurredAt`.

**Where**
- `convex/stock.ts`, `convex/schema/stock.ts`, `src/pages/inventory/_components/package-history-dialog.tsx` (new), `drug-detail-sheet.tsx`.

<!-- files:v11 -->
<details><summary>All files changed (6) · code: docs/changes/v11.diff</summary>

- `convex/schema/stock.ts` +3 -1
- `convex/stock.test.ts` +14 -0
- `convex/stock.ts` +12 -2
- `src/components/stock/movement-log.tsx` +19 -10
- `src/pages/inventory/_components/drug-detail-sheet.tsx` +21 -7
- `src/pages/inventory/_components/package-history-dialog.tsx` (new) +59 -0

</details>
<!-- /files -->

## v10 · 2026-11-01 · Recent entries narrowed to the selected medicine

**Summary**
- Recent entries narrow to the selected medicine, or to its package form with a switch.

**Database**
- Replaced index `by_drug_and_occurredAt` with `by_kind_and_drug_and_occurredAt`; added `by_kind_and_package_and_occurredAt`.

**Where**
- `convex/stock.ts`, `convex/schema/stock.ts`, `src/components/stock/movement-log-section.tsx` (new), `movement-log.tsx`, `stock-drug-finder.tsx`, `stock-movement-page.tsx`.

<!-- files:v10 -->
<details><summary>All files changed (7) · code: docs/changes/v10.diff</summary>

- `convex/schema/stock.ts` +2 -1
- `convex/stock.test.ts` +50 -0
- `convex/stock.ts` +20 -7
- `src/components/stock/movement-log-section.tsx` (new) +71 -0
- `src/components/stock/movement-log.tsx` +20 -4
- `src/components/stock/stock-drug-finder.tsx` +11 -3
- `src/components/stock/stock-movement-page.tsx` +13 -14

</details>
<!-- /files -->

## v9 · 2026-11-01 · Unsaved changes warning

**Summary**
- Leaving a page, switching medicine or closing a form with unsaved changes asks first. One shared confirm pop-up replaces browser prompts.

**Database**
- None.

**Where**
- `src/components/providers/confirm.tsx`, `src/components/providers/unsaved-changes.tsx`, `src/hooks/use-confirm.ts`, `src/hooks/use-unsaved-changes.ts` (all new), `app-layout.tsx`, `movement-form.tsx`, `drug-form-dialog.tsx`.

<!-- files:v9 -->
<details><summary>All files changed (12) · code: docs/changes/v9.diff</summary>

- `src/components/app-layout.tsx` +14 -2
- `src/components/providers/confirm.tsx` (new) +58 -0
- `src/components/providers/default.tsx` +5 -1
- `src/components/providers/unsaved-changes.tsx` (new) +42 -0
- `src/components/stock/movement-form.tsx` +7 -1
- `src/components/stock/stock-drug-finder.tsx` +18 -7
- `src/hooks/use-confirm.ts` (new) +21 -0
- `src/hooks/use-unsaved-changes.ts` (new) +27 -0
- `src/pages/inventory/_components/drug-form-dialog.tsx` +20 -5
- `src/pages/inventory/_components/image-picker.tsx` +13 -1
- `src/pages/inventory/_components/package-rows-editor.tsx` +17 -3
- `src/pages/users/page.tsx` +14 -1

</details>
<!-- /files -->

## v8 · 2026-11-01 · Swipe through packaging pictures

**Summary**
- An enlarged picture can be swiped to the next one, each captioned with its package form.

**Database**
- None.

**Where**
- `src/components/zoomable-drug-image.tsx`, `src/components/stock/drug-package-picker.tsx`.

<!-- files:v8 -->
<details><summary>All files changed (2) · code: docs/changes/v8.diff</summary>

- `src/components/stock/drug-package-picker.tsx` +28 -15
- `src/components/zoomable-drug-image.tsx` +89 -9

</details>
<!-- /files -->

## v7 · 2026-11-01 · Stock Out

**Summary**
- New Stock Out page with reasons (e.g. Dispensed). Stock In and Stock Out share one form. The package form always comes from the saved barcode.

**Database**
- `stockMovements.formChanged` became optional (legacy).

**Logic**
- Stock Out is blocked if it would take stock below zero.

**Where**
- `convex/stock.ts` (`recordOut`), `convex/lib/stock.ts`, `src/components/stock/movement-form.tsx`, `reason-field.tsx`, `package-form-summary.tsx`, `stock-movement-page.tsx` (new), `src/pages/stock-out/page.tsx` (new).

<!-- files:v7 -->
<details><summary>All files changed (17) · code: docs/changes/v7.diff</summary>

- `convex/lib/stock.test.ts` +11 -17
- `convex/lib/stock.ts` +15 -19
- `convex/schema/stock.ts` +3 -3
- `convex/stock.test.ts` +47 -11
- `convex/stock.ts` +65 -41
- `src/App.tsx` +2 -0
- `src/components/app-layout.tsx` +1 -1
- `src/components/stock/drug-package-picker.tsx` +29 -0
- `src/components/stock/movement-form-schema.ts` +22 -17
- `src/components/stock/movement-form.tsx` (new) +154 -0
- `src/components/stock/package-form-fields.tsx` (deleted) +0 -81
- `src/components/stock/package-form-summary.tsx` (new) +28 -0
- `src/components/stock/reason-field.tsx` (new) +44 -0
- `src/components/stock/stock-movement-page.tsx` (new) +39 -0
- `src/pages/stock-in/_components/stock-in-form.tsx` (deleted) +0 -122
- `src/pages/stock-in/page.tsx` +2 -18
- `src/pages/stock-out/page.tsx` (new) +5 -0

</details>
<!-- /files -->

## v6 · 2026-11-01 · Tap to enlarge pictures

**Summary**
- Medicine pictures can be tapped to see them large.

**Database**
- None.

**Where**
- `src/components/zoomable-drug-image.tsx` (new), `src/components/stock/drug-package-picker.tsx`.

<!-- files:v6 -->
<details><summary>All files changed (2) · code: docs/changes/v6.diff</summary>

- `src/components/stock/drug-package-picker.tsx` +3 -3
- `src/components/zoomable-drug-image.tsx` (new) +36 -0

</details>
<!-- /files -->

## v5 · 2026-11-01 · Stock In

**Summary**
- New Stock In page: find a medicine by search or scan, pick the package form and record the quantity.

**Database**
- New table `stockMovements` (append-only; drug, barcode and user details copied in) with indexes `by_kind_and_occurredAt` and `by_drug_and_occurredAt`.

**Logic**
- `nextStock` works out the new stock; it never goes below 0.

**Where**
- `convex/schema/stock.ts`, `convex/stock.ts`, `convex/lib/stock.ts` (new), `src/components/stock/*` (new), `src/pages/stock-in/page.tsx` (new).

<!-- files:v5 -->
<details><summary>All files changed (18) · code: docs/changes/v5.diff</summary>

- `convex/lib/barcode.ts` +5 -0
- `convex/lib/stock.test.ts` (new) +40 -0
- `convex/lib/stock.ts` (new) +49 -0
- `convex/schema.ts` +2 -0
- `convex/schema/stock.ts` (new) +36 -0
- `convex/stock.test.ts` (new) +80 -0
- `convex/stock.ts` (new) +65 -0
- `src/App.tsx` +2 -0
- `src/components/app-layout.tsx` +1 -1
- `src/components/stock/drug-package-picker.tsx` (new) +61 -0
- `src/components/stock/movement-form-schema.ts` (new) +20 -0
- `src/components/stock/movement-log.tsx` (new) +88 -0
- `src/components/stock/package-form-fields.tsx` (new) +81 -0
- `src/components/stock/stock-drug-finder.tsx` (new) +121 -0
- `src/pages/inventory/_components/package-rows-editor.tsx` +1 -2
- `src/pages/inventory/_lib/drug-form-schema.ts` +1 -8
- `src/pages/stock-in/_components/stock-in-form.tsx` (new) +122 -0
- `src/pages/stock-in/page.tsx` (new) +21 -0

</details>
<!-- /files -->

## v4 · 2026-11-01 · Default unit count

**Summary**
- Picking a base unit fills in the usual count (strips in 10s, others 1).

**Database**
- None.

**Where**
- `src/pages/inventory/_components/package-rows-editor.tsx`, `drug-form-schema.ts`.

<!-- files:v4 -->
<details><summary>All files changed (2) · code: docs/changes/v4.diff</summary>

- `src/pages/inventory/_components/package-rows-editor.tsx` +10 -2
- `src/pages/inventory/_lib/drug-form-schema.ts` +8 -1

</details>
<!-- /files -->

## v3 · 2026-11-01 · Camera photos and packaging pictures per form

**Summary**
- Pictures can be taken with the camera. Packaging pictures belong to each package form instead of the medicine.

**Database**
- `drugs.packagingImageIds` removed; `drugPackages.imageIds` (array of file ids) added.

**Where**
- `convex/schema/drugs.ts`, `convex/drugs.ts`, `convex/lib/drugs.ts`, `src/components/camera-capture-dialog.tsx` (new), `image-picker.tsx`, `package-rows-editor.tsx`.

<!-- files:v3 -->
<details><summary>All files changed (10) · code: docs/changes/v3.diff</summary>

- `convex/drugs.test.ts` +1 -2
- `convex/drugs.ts` +21 -26
- `convex/lib/drugs.ts` +19 -10
- `convex/schema/drugs.ts` +3 -2
- `src/components/camera-capture-dialog.tsx` (new) +177 -0
- `src/pages/inventory/_components/drug-detail-sheet.tsx` +23 -25
- `src/pages/inventory/_components/drug-form-dialog.tsx` +7 -14
- `src/pages/inventory/_components/image-picker.tsx` +47 -25
- `src/pages/inventory/_components/package-rows-editor.tsx` +16 -0
- `src/pages/inventory/_lib/drug-form-schema.ts` +3 -1

</details>
<!-- /files -->

## v2 · 2026-11-01 · Barcode scanned twice

**Summary**
- A barcode must be scanned twice and match before a package form is added. Medicines without a barcode can be added after a reminder.

**Database**
- `drugPackages.barcode` and `barcodeKey` may be empty (no barcode).

**Where**
- `convex/lib/barcode.ts` (`barcodesMatch`), `src/pages/inventory/_components/barcode-confirm-entry.tsx` (new), `package-rows-editor.tsx`.

<!-- files:v2 -->
<details><summary>All files changed (10) · code: docs/changes/v2.diff</summary>

- `convex/drugs.test.ts` +8 -0
- `convex/lib/barcode.test.ts` +12 -1
- `convex/lib/barcode.ts` +6 -0
- `convex/lib/drugs.ts` +7 -4
- `convex/schema/drugs.ts` +2 -1
- `src/pages/inventory/_components/barcode-confirm-entry.tsx` (new) +194 -0
- `src/pages/inventory/_components/drug-detail-sheet.tsx` +3 -1
- `src/pages/inventory/_components/drug-form-dialog.tsx` +7 -3
- `src/pages/inventory/_components/package-rows-editor.tsx` +52 -38
- `src/pages/inventory/_lib/drug-form-schema.ts` +6 -9

</details>
<!-- /files -->

## v1 · 2026-11-01 · Inventory, users and sign-in

**Summary**
- Inventory of medicines with package forms (one per barcode), pictures and stock. Approval of new users by the owner, admin and staff roles.

**Database**
- New tables `drugs` (indexes `by_drugId`, `by_name`, search index `search_text`) and `drugPackages` (indexes `by_drug`, `by_barcodeKey`).
- `users.role` and `users.status` (optional), index `by_status`.

**Logic**
- The owner email in `convex/lib/access.ts` is always an admin. Others start as pending until approved.

**Where**
- `convex/schema/*.ts`, `convex/drugs.ts`, `convex/users.ts`, `convex/lib/access.ts`, `convex/lib/barcode.ts`, `convex/lib/drugs.ts`, `src/pages/inventory/*`, `src/pages/users/page.tsx`, `src/components/app-layout.tsx`.

<!-- files:v1 -->
<details><summary>All files changed (35) · code: docs/changes/v1.diff</summary>

- `convex/drugs.test.ts` (new) +75 -0
- `convex/drugs.ts` (new) +202 -0
- `convex/lib/access.ts` (new) +42 -0
- `convex/lib/barcode.test.ts` (new) +26 -0
- `convex/lib/barcode.ts` (new) +32 -0
- `convex/lib/drugs.ts` (new) +133 -0
- `convex/schema.ts` +6 -7
- `convex/schema/drugs.ts` (new) +43 -0
- `convex/schema/users.ts` (new) +20 -0
- `convex/users.ts` +45 -16
- `index.html` +4 -4
- `package.json` +2 -0
- `src/App.tsx` +6 -1
- `src/components/access-screens.tsx` (new) +112 -0
- `src/components/app-layout.tsx` (new) +134 -0
- `src/components/barcode-scanner-dialog.tsx` (new) +102 -0
- `src/components/brand-logo.tsx` (new) +25 -0
- `src/components/drug-image.tsx` (new) +21 -0
- `src/components/drug-search-input.tsx` (new) +54 -0
- `src/components/page-header.tsx` (new) +21 -0
- `src/components/root-error-boundary.tsx` (new) +44 -0
- `src/hooks/use-current-user.ts` (new) +8 -0
- `src/hooks/use-upload-image.ts` (new) +22 -0
- `src/index.css` +62 -61
- `src/lib/drug-types.ts` (new) +5 -0
- `src/lib/errors.ts` (new) +14 -0
- `src/pages/Index.tsx` +3 -12
- `src/pages/inventory/_components/drug-detail-sheet.tsx` (new) +144 -0
- `src/pages/inventory/_components/drug-form-dialog.tsx` (new) +174 -0
- `src/pages/inventory/_components/drug-row.tsx` (new) +42 -0
- `src/pages/inventory/_components/image-picker.tsx` (new) +82 -0
- `src/pages/inventory/_components/package-rows-editor.tsx` (new) +128 -0
- `src/pages/inventory/_lib/drug-form-schema.ts` (new) +35 -0
- `src/pages/inventory/page.tsx` (new) +151 -0
- `src/pages/users/page.tsx` (new) +136 -0

</details>
<!-- /files -->

Versions 18 and 22 had no code changes.

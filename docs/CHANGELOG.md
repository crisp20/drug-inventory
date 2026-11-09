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

## v82 · 2026-11-07 · Import accepts 1 and 0 for DDA and LASA

**Summary**
- The inventory import reads `1` as Yes and `0` as No in the DDA and LASA columns, including Excel number cells such as `1.0` or `0.00`.
- The import window and the problem message now mention 1/0.

**Database**
- None.

**Logic**
- `parseYesNo`: any number equal to 1 is Yes, any number equal to 0 is No; other numbers (e.g. 2) are reported and the mark is left unchanged.

**Where**
- `convex/lib/drugImport.ts`: number handling in `parseYesNo`, clearer problem message.
- `convex/lib/drugImport.test.ts`: test for 1/0 values.
- `src/pages/inventory/_components/import-dialog.tsx`: column help text.

<!-- files:v82 -->
<details><summary>All files changed (4) · code: docs/changes/v82.diff</summary>

- `convex/lib/drugImport.test.ts` +8 -0
- `convex/lib/drugImport.ts` +9 -3
- `src/pages/changes/_lib/changes.test.ts` +1 -1
- `src/pages/inventory/_components/import-dialog.tsx` +2 -2

</details>
<!-- /files -->

## v81 · 2026-11-06 · Medicine Bag Label

**Summary**
- Stock In now has two label types: the **Medicine Label** (the existing one, one per package) and the new **Medicine Bag Label**.
- Package forms without a barcode always print the Medicine Label (it can't be unticked). The Medicine Bag Label is optional for every package form, and the Medicine Label is optional for barcoded ones.
- Each Medicine Bag Label has a numbered 5 × 3 grid. Numbers start at 1 for each Stock In, 15 per label: a quantity of 16 prints one label with 1–15 and one with 16.
- The bag label shows the brand and generic names, "DDA,8"-style marks, the package icon and package form, the grid and a QR code. It has no photo.
- The print dialog previews every label, uses the same size and direction choices, and prints both types together. Reprints use the label types the entry was printed with.
- v80 holds the first part of this work (the bag label drawing).

**Database**
- `stockMovements.bagLabels` (optional boolean) added: true when Medicine Bag Labels were chosen. No migration needed.

**Logic**
- Bag label QR text follows the old system: `<Drug ID>;<Resident ID>;<Start time>;<Package form>;<Resident ID>,<DDA>_<Initials><*>`. Resident ID and start time are left blank for now, e.g. `12670;;;60/Box x1;DDA_HS`. The Medicine Label QR text is unchanged.
- The 8 mark is kept when the entry gets either label type.
- An entry can be reprinted if it had a Medicine Label or bag labels.

**Where**
- `src/lib/label/bag-label.ts`, `render-bag.ts`, `stock-in-set.ts`: bag label numbers, QR text, drawing, and drawing both types together.
- `src/components/stock/stock-in-label-section.tsx`: the two label choices.
- `src/components/stock/stock-in-label-dialog.tsx`, `label-preview.tsx`: previews and printing of both types.
- `src/components/stock/movement-form.tsx`, `movement-form-schema.ts`, `reprint-label-dialog.tsx`: the new choice is passed through.
- `convex/stock.ts`, `convex/schema/stock.ts`, `convex/lib/activity.ts`: saves and logs `bagLabels`.

<!-- files:v81 -->
<details><summary>All files changed (16) · code: docs/changes/v81.diff</summary>

- `convex/lib/activity.ts` +1 -0
- `convex/schema/stock.ts` +2 -0
- `convex/stock.test.ts` +18 -0
- `convex/stock.ts` +18 -4
- `src/components/stock/movement-form-schema.ts` +4 -1
- `src/components/stock/movement-form.tsx` +28 -3
- `src/components/stock/reprint-label-dialog.tsx` +10 -1
- `src/components/stock/stock-in-label-dialog.tsx` +141 -92
- `src/components/stock/stock-in-label-section.tsx` +91 -45
- `src/lib/label/bag-label.ts` +40 -7
- `src/lib/label/render-bag.ts` +11 -4
- `src/lib/label/stock-in-label.ts` +16 -5
- `src/pages/changes/_lib/changes.test.ts` +1 -1
- `src/components/stock/label-preview.tsx` (new) +31 -0
- `src/lib/label/bag-label.test.ts` (new) +59 -0
- `src/lib/label/stock-in-set.ts` (new) +47 -0

</details>
<!-- /files -->

---

## v79 · 2026-11-06 · 54 × 70 mm label moved 1 mm

**Summary**
- On 54 × 70 mm labels the print now starts 13 mm from the logo side (was 14 mm), so it no longer runs onto the pre-printed purple strip at the bottom. There is about 1 mm clear on each side.

**Database**
- None.

**Logic**
- `leftMm` for the `54x70` sheet changed from 14 to 13 (104 dots instead of 112).

**Where**
- `src/lib/label/label-sizes.ts`: the new offset.
- `src/lib/label/label.test.ts`: test updated.

<!-- files:v79 -->
<details><summary>All files changed (3) · code: docs/changes/v79.diff</summary>

- `src/lib/label/label-sizes.ts` +2 -1
- `src/lib/label/label.test.ts` +4 -4
- `src/pages/changes/_lib/changes.test.ts` +1 -1

</details>
<!-- /files -->

---

## v78 · 2026-11-06 · 54 × 70 mm ACP label size

**Summary**
- New 54 × 70 mm label size, for the ACP label roll with the logo strip pre-printed down the left.
- The 40 × 60 mm design prints on it 14 mm from the left, centred along the length (5 mm top and bottom). The logo strip area is left blank.
- Offered everywhere: the Stock In label window now has a Label size picker (40 × 60 or 54 × 70), and the Canister label window lists it too. The choice is remembered on each device.
- Starts in Portrait (upright, like the sample); the Portrait/Landscape switch still works.
- The preview shows a faint dashed outline where the pre-printed logo is. It is never printed.

**Database**
- None.

**Logic**
- A "sheet" size prints a smaller size's design at a fixed offset on a bigger label.

**Where**
- `src/lib/label/label-sizes.ts`: `54x70` size with `sheet: { content: "40x60", leftMm: 14 }`, `sheetOffset`, and the remembered Stock In size.
- `src/lib/label/sheet.ts`: new; places the design on the sheet, and draws the preview-only outline.
- `src/lib/label/render-label.ts`, `render-stock-in.ts`: draw through `renderOnSheet`.
- `src/lib/label/preview-class.ts`: new; preview box shapes shared by both label windows.
- `src/components/stock/stock-in-label-dialog.tsx`: Label size picker.
- `src/components/stock/label-print-dialog.tsx`: preview outline for 54 × 70.

<!-- files:v78 -->
<details><summary>All files changed (10) · code: docs/changes/v78.diff</summary>

- `src/components/stock/label-print-dialog.tsx` +8 -16
- `src/components/stock/stock-in-label-dialog.tsx` +56 -20
- `src/lib/label/label-designs.ts` +1 -0
- `src/lib/label/label-sizes.ts` +58 -1
- `src/lib/label/label.test.ts` +12 -0
- `src/lib/label/render-label.ts` +6 -3
- `src/lib/label/render-stock-in.ts` +5 -2
- `src/pages/changes/_lib/changes.test.ts` +1 -1
- `src/lib/label/preview-class.ts` (new) +23 -0
- `src/lib/label/sheet.ts` (new) +61 -0

</details>
<!-- /files -->

## v77 · 2026-11-06 · Package icon matches the package form on Stock In labels

**Summary**
- The icon beside the package form on Stock In labels now matches what was chosen: Box, Bottle, Strip or Bag, using the owner's uploaded icons. This applies to the preview, printing and reprints.
- Icons print solid black so the lines stay sharp. If an icon can't load, the old drawn box is used instead.

**Database**
- None.

**Logic**
- The label data now carries the package form's base unit, which picks the icon.

**Where**
- `src/lib/label/package-icons.ts`: new; icon address per base unit, and a loader that turns the purple icon into black-on-white.
- `src/lib/label/render-stock-in.ts`: draws the chosen icon, falling back to the drawn box.
- `src/lib/label/stock-in-label.ts`: `StockInLabelData.baseUnit`; reprints fill it from the saved entry.
- `src/components/stock/movement-form.tsx`: passes the package's base unit to the label.
- `src/lib/label/draw.ts`: `loadImage` shared.

<!-- files:v77 -->
<details><summary>All files changed (7) · code: docs/changes/v77.diff</summary>

- `src/components/stock/movement-form.tsx` +1 -0
- `src/lib/label/draw.ts` +1 -1
- `src/lib/label/render-stock-in.ts` +11 -4
- `src/lib/label/stock-in-label.test.ts` +1 -0
- `src/lib/label/stock-in-label.ts` +3 -0
- `src/pages/changes/_lib/changes.test.ts` +1 -1
- `src/lib/label/package-icons.ts` (new) +45 -0

</details>
<!-- /files -->

## v76 · 2026-11-06 · Users page shows every name and email

**Summary**
- Each user card on the Users page now shows the person's name and email on their own line, with the Initials, Canister, Role and Remove access controls underneath. Before, the controls squeezed the name and email out of view for everyone except the signed-in admin.
- When a person has no saved name, their email is shown as the main line (instead of "Unnamed"), and is used in pop-ups and messages.

**Database**
- None.

**Logic**
- No rule changes; display only.

**Where**
- `src/pages/users/page.tsx`: `UserRow` stacks the name/email above a wrapping row of controls; long emails wrap instead of being cut off; email fallback when the name is missing.

<!-- files:v76 -->
<details><summary>All files changed (2) · code: docs/changes/v76.diff</summary>

- `src/pages/changes/_lib/changes.test.ts` +1 -1
- `src/pages/users/page.tsx` +56 -50

</details>
<!-- /files -->

## v75 · 2026-11-06 · Check and edit Stock In labels before saving

**Summary**
- When a Stock In needs labels, the button now reads **Check Labels & Record Stock In**. It opens the label preview **before** anything is saved.
- The preview window has an **Edit** button that goes back to the form with everything still filled in (quantity, batch, expiry, 8 box, notes).
- The Stock In is saved when the user clicks **Print window** or **Connect & print** (only once, even if printed again).
- Closing the window without printing asks **Save without printing?**: **Save Stock In** saves it; **Back to the form** keeps editing.
- Reprints have no Edit button; only the number of labels and direction can change.

**Database**
- No changes.

**Logic**
- The large-quantity and expiring-soon checks still run before the preview.
- If saving fails (e.g. not enough permission), nothing prints and the error is shown.

**Where**
- `src/components/stock/movement-form.tsx`: preview first; `save` callback runs `recordIn` on first print; close asks to save.
- `src/components/stock/stock-in-label-dialog.tsx`: `onSave` and `onEdit` props, Edit button, "Not saved yet" note.

<!-- files:v75 -->
<details><summary>All files changed (3) · code: docs/changes/v75.diff</summary>

- `src/components/stock/movement-form.tsx` +71 -20
- `src/components/stock/stock-in-label-dialog.tsx` +64 -15
- `src/pages/changes/_lib/changes.test.ts` +1 -1

</details>
<!-- /files -->

---

## v74 · 2026-11-06 · Optional Stock In labels for package forms with a barcode

**Summary**
- Stock In of a package form **with a barcode** now shows a **Print labels** tick box (unticked by default).
- Ticking it shows the same Labels section as package forms without a barcode: **Print label** button, **Print 8 on the labels** tick box, and the print window after saving (number of labels = quantity received, editable).
- These entries get a **Reprint label** button only if labels were turned on.

**Database**
- `stockMovements.labels` (optional boolean) added: labels were chosen for a package form that has a barcode. No migration needed.

**Logic**
- `labels` is only saved for Stock In of a package form with a barcode when ticked.
- `eight` is now saved for any Stock In that gets labels (no barcode, or labels chosen).
- Activity log detail adds "Labels printed".

**Where**
- `convex/stock.ts`, `convex/schema/stock.ts`, `convex/lib/activity.ts`: save `labels` and the wider `eight` rule.
- `src/components/stock/stock-in-label-section.tsx`: the Print labels tick box for barcoded forms.
- `src/components/stock/movement-form.tsx`, `movement-form-schema.ts`: `labelsOn` field; labels needed when no barcode or ticked.
- `src/lib/label/stock-in-label.ts`: `hasReprintableLabel` includes entries with `labels`.

<!-- files:v74 -->
<details><summary>All files changed (10) · code: docs/changes/v74.diff</summary>

- `convex/lib/activity.ts` +39 -8
- `convex/schema/stock.ts` +4 -1
- `convex/stock.test.ts` +25 -0
- `convex/stock.ts` +14 -6
- `src/components/stock/movement-form-schema.ts` +3 -1
- `src/components/stock/movement-form.tsx` +10 -3
- `src/components/stock/stock-in-label-section.tsx` +81 -45
- `src/lib/label/stock-in-label.test.ts` +8 -1
- `src/lib/label/stock-in-label.ts` +6 -3
- `src/pages/changes/_lib/changes.test.ts` +1 -1

</details>
<!-- /files -->

---

## v73 · 2026-11-06 · Stock In labels for package forms without a barcode

**Summary**
- Stock In of a package form **without a barcode** now has a **Labels** section with a **Print label** button and a **Print 8 on the labels** tick box (unticked by default).
- After **Record Stock In & Print Labels**, a print window opens for a 40 × 60 mm label, with **Number of labels** filled in from the quantity received (editable, up to 100).
- The label matches the ACP samples: brand name, drug name, package icon and form (e.g. 100/Box x1), tablet photo, DDA box (from the medicine's DDA mark), 8 box (stacked under DDA), batch and expiry when entered, and a QR code.
- QR code text: `<Drug ID>;<Package form>;<DDA>_<Initials><*>`, e.g. `13103;100/Box x1;DDA_HS` or `5467;28/Box x1;_HS*` (the `*` means the 8 box).
- Recent Stock In entries without a barcode get a **Reprint label** button (initials and 8 from the original entry; DDA from the medicine now).
- Admins can set each person's **label initials** on the Users page. Blank uses the first letters of their name. Canister labels use them too.

**Database**
- `users.initials` (optional string) added.
- `stockMovements.eight` (optional boolean) and `stockMovements.userInitials` (optional string) added.
- All optional, so no migration is needed. Older entries reprint with initials worked out from the saved name.

**Logic**
- `eight` is only saved for Stock In of a package form with no barcode.
- Initials: 1–4 letters/numbers, saved in capitals; admin only; changes logged in the activity log.
- The Bluetooth job asks the printer for N copies of one picture; the print window prints one page per copy.

**Where**
- `convex/lib/initials.ts`: shared initials rules (`userInitials`, `normalizeInitials`, `isValidInitials`).
- `convex/users.ts`: new admin mutation `setInitials`.
- `convex/stock.ts`: `recordIn` accepts `eight`; every entry saves `userInitials`.
- `src/lib/label/stock-in-label.ts`, `render-stock-in.ts`: Stock In label data, QR text and drawing.
- `src/lib/label/render-compact.ts`, `draw.ts`: shared landscape drawing and tag boxes.
- `src/lib/label/bitmap.ts`, `print-label.ts`: copies.
- `src/components/stock/stock-in-label-dialog.tsx`, `stock-in-label-section.tsx`, `movement-form.tsx`, `reprint-label-dialog.tsx`, `movement-log.tsx`: Stock In form, print window and reprints.
- `src/pages/users/_components/initials-field.tsx`: initials box on the Users page.

<!-- files:v73 -->
<details><summary>All files changed (26) · code: docs/changes/v73.diff</summary>

- `convex/lib/activity.ts` +1 -0
- `convex/schema/stock.ts` +4 -0
- `convex/schema/users.ts` +2 -0
- `convex/stock.test.ts` +95 -0
- `convex/stock.ts` +9 -1
- `convex/users.ts` +41 -0
- `src/components/stock/drug-package-picker.tsx` +5 -1
- `src/components/stock/movement-form-schema.ts` +2 -0
- `src/components/stock/movement-form.tsx` +81 -8
- `src/components/stock/movement-log.tsx` +3 -1
- `src/components/stock/reprint-label-dialog.tsx` +25 -9
- `src/components/stock/stock-drug-finder.tsx` +5 -2
- `src/lib/label/bitmap.ts` +3 -2
- `src/lib/label/draw.ts` +26 -0
- `src/lib/label/label-data.ts` +6 -14
- `src/lib/label/print-label.ts` +15 -6
- `src/lib/label/render-compact.ts` +14 -29
- `src/pages/changes/_lib/changes.test.ts` +1 -1
- `src/pages/users/page.tsx` +2 -0
- `convex/lib/initials.ts` (new) +35 -0
- `src/components/stock/stock-in-label-dialog.tsx` (new) +311 -0
- `src/components/stock/stock-in-label-section.tsx` (new) +77 -0
- `src/lib/label/render-stock-in.ts` (new) +114 -0
- `src/lib/label/stock-in-label.test.ts` (new) +123 -0
- `src/lib/label/stock-in-label.ts` (new) +98 -0
- `src/pages/users/_components/initials-field.tsx` (new) +62 -0

</details>
<!-- /files -->

## v71 · 2026-11-05 · Dangerous Drug (DDA) tick box

**Summary**
- Admins can tick **Dangerous Drug (DDA)** when adding or editing a medicine in Inventory.
- DDA medicines show an amber **DDA** badge on their Inventory card, in the details panel and when picked at Stock In/Out.
- New **DDA only** filter on the Inventory page (works alongside search).
- Stock Out shows a DDA notice for DDA medicines.
- The Canister QR label prints the DDA box automatically for DDA medicines, including reprints.
- The medicine file import reads an optional **DDA** column (Yes/No). Marking is applied straight away; unmarking asks first on the review screen.
- New **Export file** button (admins) downloads every medicine as a CSV in the same columns the import reads, including LASA and DDA.
- Ticking or unticking DDA is recorded in the Log.

**Database**
- `drugs.dda`: new optional boolean (`v.optional(v.boolean())`); missing means not DDA. No migration needed.
- New index `drugs.by_dda_and_name` on `["dda", "name"]`, built automatically.

**Logic**
- Only admins can set DDA (same check as other medicine edits).
- `false` is stored as "not set", like the LASA mark.
- Reprints use the medicine's current DDA mark, because it isn't saved on the Stock Out entry.

**Where**
- `convex/schema/drugs.ts`: `dda` field and index.
- `convex/drugs.ts`: `dda` argument on create/update, new `listDda` query.
- `convex/drugImport.ts`, `convex/lib/drugImport.ts`: DDA column, diff and saving; new `listForExport` query.
- `convex/lib/activity.ts`: `diffDda` for the Log.
- `src/pages/inventory/_components/dda-field.tsx`, `src/components/dda-badge.tsx`: tick box and badge.
- `src/pages/inventory/page.tsx`: DDA only filter and Export file button; `_lib/export-drugs.ts` builds the CSV.
- `src/pages/inventory/_lib/import-choices.ts`, `_components/import-conflict-card.tsx`: DDA decisions in the import review.
- `src/components/stock/movement-form.tsx`, `reprint-label-dialog.tsx`, `src/lib/label/label-data.ts`: DDA notice and label.

<!-- files:v71 -->
<details><summary>All files changed (25) · code: docs/changes/v71.diff</summary>

- `convex/drugImport.ts` +39 -1
- `convex/drugs.test.ts` +33 -0
- `convex/drugs.ts` +21 -0
- `convex/lib/activity.ts` +13 -3
- `convex/lib/drugImport.test.ts` +26 -0
- `convex/lib/drugImport.ts` +34 -8
- `convex/lib/drugs.ts` +1 -0
- `convex/schema/drugs.ts` +3 -0
- `src/components/stock/drug-package-picker.tsx` +7 -1
- `src/components/stock/movement-form.tsx` +12 -1
- `src/components/stock/reprint-label-dialog.tsx` +1 -1
- `src/lib/label/label-data.ts` +5 -1
- `src/lib/label/label.test.ts` +2 -0
- `src/pages/changes/_lib/changes.test.ts` +1 -1
- `src/pages/inventory/_components/drug-detail-sheet.tsx` +7 -0
- `src/pages/inventory/_components/drug-form-dialog.tsx` +4 -0
- `src/pages/inventory/_components/drug-row.tsx` +7 -1
- `src/pages/inventory/_components/import-conflict-card.tsx` +21 -1
- `src/pages/inventory/_components/import-dialog.tsx` +2 -2
- `src/pages/inventory/_lib/drug-form-schema.ts` +2 -0
- `src/pages/inventory/_lib/import-choices.ts` +47 -13
- `src/pages/inventory/page.tsx` +137 -33
- `src/components/dda-badge.tsx` (new) +19 -0
- `src/pages/inventory/_components/dda-field.tsx` (new) +46 -0
- `src/pages/inventory/_lib/export-drugs.ts` (new) +89 -0

</details>
<!-- /files -->

## v70 · 2026-11-05 · Canister QR label design

**Summary**
- The label pop-up has a new **Design** switch: **Canister QR** (new) or **Full label** (the existing one).
- 40 × 60 mm starts on **Canister QR**; 52 × 110 mm starts on **Full label**. Each computer remembers the choice per size.
- The Canister QR label matches the ACP samples: brand name, drug name, tablet picture, batch, expiry, Drug ID box, type shape with the canister quantity, and a QR code.
- The QR code holds `;Drug ID;Batch;Expiry;Quantity;Type`, e.g. `;8223;345397;2027/11/30;720;1`.
- The type shape is a full circle for 1, a half for 0.5, and a matching slice for a third, quarter or eighth.
- Space is kept for the Resident Name and the **OS** (Own Stock) and **DDA** (Dangerous Drug) boxes. They will print once those details are collected in a later version.

**Database**
- None.

**Logic**
- `canisterQrText` builds the QR text, with the expiry as YYYY/MM/DD.
- `LabelData` gained `canisterQty` plus optional `residentName`, `ownStock`, `dangerousDrug`.

**Where**
- `src/lib/label/render-compact.ts`: new Canister QR design.
- `src/lib/label/label-designs.ts`: design list, defaults per size, QR text.
- `src/lib/label/draw.ts`: drawing tools shared by both designs (moved out of `render-label.ts`).
- `src/lib/label/render-label.ts`: picks the design.
- `src/components/stock/label-print-dialog.tsx`: Design switch.
- `src/lib/label/label-data.ts`, `src/components/stock/movement-form.tsx`: canister quantity on the label.
- `src/lib/label/label.test.ts`: QR text, type shapes and design defaults.

<!-- files:v70 -->
<details><summary>All files changed (9) · code: docs/changes/v70.diff</summary>

- `src/components/stock/label-print-dialog.tsx` +42 -3
- `src/components/stock/movement-form.tsx` +1 -0
- `src/lib/label/label-data.ts` +8 -1
- `src/lib/label/label.test.ts` +59 -1
- `src/lib/label/render-label.ts` +42 -164
- `src/pages/changes/_lib/changes.test.ts` +1 -1
- `src/lib/label/draw.ts` (new) +215 -0
- `src/lib/label/label-designs.ts` (new) +58 -0
- `src/lib/label/render-compact.ts` (new) +159 -0

</details>
<!-- /files -->

## v69 · 2026-11-05 · Reprint canister labels

**Summary**
- Every canister entry in **Recent Stock Out** (and other Stock Out lists) has a **Reprint label** button, for when a print did not come out well.
- The reprinted label uses the original fill: same batch, expiry, type, picture, filler initials and fill date.
- The reprint pop-up shows the preview first and never prints by itself, so size and direction can be checked.
- Entries that were undone don't show the button. Reprints are not recorded in the activity log.

**Database**
- None.

**Logic**
- `labelFromMovement` rebuilds the label from a saved canister Stock Out; the drug picture is looked up with `drugs.get` because entries don't store it.
- `LabelPrintDialog` takes `title` and `autoPrint` (default on, off for reprints).

**Where**
- `src/lib/label/label-data.ts`: `labelFromMovement`.
- `src/components/stock/reprint-label-dialog.tsx`: new reprint pop-up.
- `src/components/stock/label-print-dialog.tsx`: `title` and `autoPrint` options.
- `src/components/stock/movement-log.tsx`: Reprint label button.
- `src/lib/label/label.test.ts`: reprint label test.

<!-- files:v69 -->
<details><summary>All files changed (6) · code: docs/changes/v69.diff</summary>

- `src/components/stock/label-print-dialog.tsx` +32 -10
- `src/components/stock/movement-log.tsx` +20 -1
- `src/lib/label/label-data.ts` +30 -0
- `src/lib/label/label.test.ts` +28 -0
- `src/pages/changes/_lib/changes.test.ts` +1 -1
- `src/components/stock/reprint-label-dialog.tsx` (new) +34 -0

</details>
<!-- /files -->

## v68 · 2026-11-05 · Label direction (portrait / landscape)

**Summary**
- The label print window has a **Direction** switch: **Portrait** or **Landscape**.
- 40 × 60 mm starts on **Landscape**, 52 × 110 mm on **Portrait**.
- Each computer remembers the last direction separately for each label size.
- The preview, Print window and Bluetooth printing all use the chosen direction.

**Database**
- None.

**Logic**
- Landscape turns the finished label a quarter turn clockwise, and the print window page is sized to match (e.g. 60 × 40 mm).
- Saved on the device as `acp-label-orientation-<size>`. Unknown saved values fall back to the size's default.

**Where**
- `src/lib/label/label-sizes.ts`: directions, defaults per size, load/save (+ test).
- `src/lib/label/print-label.ts`: `orientCanvas` turns the label; the print window page size now follows the turned label.
- `src/components/stock/label-print-dialog.tsx`: Direction switch and matching preview shape.

<!-- files:v68 -->
<details><summary>All files changed (5) · code: docs/changes/v68.diff</summary>

- `src/components/stock/label-print-dialog.tsx` +67 -14
- `src/lib/label/label-sizes.ts` +41 -0
- `src/lib/label/label.test.ts` +17 -0
- `src/lib/label/print-label.ts` +23 -8
- `src/pages/changes/_lib/changes.test.ts` +1 -1

</details>
<!-- /files -->

## v67 · 2026-11-05 · Label prints the grey dot and a clearer photo

**Summary**
- Fixes labels printed with **Print window**: the grey canister type circle was missing and the tablet photo had faded to almost white.
- The circle now prints as a grey dot pattern, and the tablet photo prints in higher contrast so its shape and shade show.
- The preview now shows the exact black and white dots that will print.

**Database**
- None.

**Logic**
- Label printers can't print grey, and the computer's print window rounded light grey to white. The app now turns the whole label into black and white dots itself (dithering) before previewing or printing.
- The tablet photo is turned grey and contrast-stretched first: the lightest 2% becomes white, the darkest 2% black, with mid-tones darkened.

**Where**
- `src/lib/label/bitmap.ts`: new `boostContrast` (+ test).
- `src/lib/label/render-label.ts`: `loadPhoto` (grey, high-contrast photo) and `toPrintedDots` (whole label to dots) at the end of `renderLabel`.

<!-- files:v67 -->
<details><summary>All files changed (4) · code: docs/changes/v67.diff</summary>

- `src/lib/label/bitmap.ts` +18 -0
- `src/lib/label/label.test.ts` +21 -1
- `src/lib/label/render-label.ts` +52 -2
- `src/pages/changes/_lib/changes.test.ts` +1 -1

</details>
<!-- /files -->

## v66 · 2026-11-05 · Two label sizes

**Summary**
- The label print window has a **Label size** switch: **40 × 60 mm** (as before) or **52 × 110 mm**.
- The preview, Bluetooth print and print window all use the chosen size.
- The choice is remembered on each device, so it stays set for that printer's roll.

**Database**
- None.

**Logic**
- One label design laid out in 40mm-wide units and scaled up for bigger labels (52mm = 1.3×). The 52 × 110 mm label gives each section more room, with a bigger photo and QR codes.
- QR codes are drawn in whole printer dots so they stay sharp at any size.
- Only the first drawing prints by itself when a printer is connected; switching size just redraws the preview.

**Where**
- `src/lib/label/label-sizes.ts` (new): the sizes, their section positions, and remembering the choice.
- `src/lib/label/render-label.ts`: draws at the chosen size.
- `src/lib/label/print-label.ts`: print window page size follows the chosen size.
- `src/components/stock/label-print-dialog.tsx`: size switch and matching preview.

<!-- files:v66 -->
<details><summary>All files changed (7) · code: docs/changes/v66.diff</summary>

- `src/components/stock/label-print-dialog.tsx` +58 -8
- `src/lib/label/label-data.ts` +1 -1
- `src/lib/label/label.test.ts` +35 -0
- `src/lib/label/print-label.ts` +8 -5
- `src/lib/label/render-label.ts` +79 -44
- `src/pages/changes/_lib/changes.test.ts` +1 -1
- `src/lib/label/label-sizes.ts` (new) +95 -0

</details>
<!-- /files -->

## v65 · 2026-11-05 · Compare pictures before a photo upload

**Summary**
- The photo upload review now has three tabs: **Will be added**, **Will replace** and **Skipped**.
- **Will be added** shows a thumbnail of each new picture (hover or click to enlarge).
- **Will replace** shows the current picture next to the new one, with **Keep current** / **Use file** for each drug. Replacing is the default.
- Tick several drugs (or Select all), then **Keep selected current** or **Use file for selected**. With nothing ticked, the buttons apply to every replacement.
- The upload button and summary show how many pictures are kept current.

**Database**
- None.

**Logic**
- `drugPhotos.checkPhotos` also returns the current picture's link (`photoUrl`).
- Kept drugs are left out of the upload, so their current picture is not touched. New pictures are always added.

**Where**
- `convex/drugPhotos.ts`: `photoUrl` in the check.
- `src/pages/inventory/_components/photo-import-dialog.tsx`: new tabs, bulk bar and counts.
- `src/pages/inventory/_components/photo-review-rows.tsx`: rows with thumbnails and the side-by-side comparison.
- `src/pages/inventory/_lib/photo-choices.ts` (+ test): which photos to upload, bulk keep/replace.
- `src/pages/inventory/_components/import-conflict-card.tsx`: `ChoicePair` shared.

<!-- files:v65 -->
<details><summary>All files changed (9) · code: docs/changes/v65.diff</summary>

- `convex/drugPhotos.test.ts` +3 -0
- `convex/drugPhotos.ts` +9 -2
- `src/pages/changes/_lib/changes.test.ts` +1 -1
- `src/pages/inventory/_components/import-conflict-card.tsx` +1 -1
- `src/pages/inventory/_components/photo-import-dialog.tsx` +75 -22
- `src/pages/inventory/_hooks/use-photo-import.ts` +2 -2
- `src/pages/inventory/_components/photo-review-rows.tsx` (new) +90 -0
- `src/pages/inventory/_lib/photo-choices.test.ts` (new) +37 -0
- `src/pages/inventory/_lib/photo-choices.ts` (new) +30 -0

</details>
<!-- /files -->

---

## v64 · 2026-11-05 · Picture of the other drug in barcode clashes

**Summary**
- When an imported barcode already belongs to another drug, the clash box now shows that drug's main picture (hover or click to enlarge), plus its brand name, manufacturer, the package form that owns the barcode, and its stock.
- Shown on both the New and Conflicts tabs. No picture is shown if the other drug has none.

**Database**
- None.

**Logic**
- `findClashes` now returns the other drug's brand, manufacturer, piece name, package form, stock and picture. `checkBatch` turns the picture into a link (`describeClashes`).

**Where**
- `convex/drugImport.ts`: richer clash details.
- `src/pages/inventory/_components/barcode-clash-fix.tsx`: picture and details in the clash box.
- `convex/drugImport.test.ts`: checks the new clash details.

<!-- files:v64 -->
<details><summary>All files changed (4) · code: docs/changes/v64.diff</summary>

- `convex/drugImport.test.ts` +7 -0
- `convex/drugImport.ts` +33 -3
- `src/pages/changes/_lib/changes.test.ts` +1 -1
- `src/pages/inventory/_components/barcode-clash-fix.tsx` +24 -3

</details>
<!-- /files -->

---

## v63 · 2026-11-05 · Fix barcode clashes during import

**Summary**
- When a barcode in the import file already belongs to another drug, the review screen now gives two choices for each clash: **Add without barcode** (the default) or **Change barcode**.
- "Change barcode" shows a box to type a new barcode, with a live check that says whether it is free or also used by another drug.
- A drug is no longer left with fewer package forms: a clashing package form is still added, just without the barcode.
- The finished screen now says "added without barcode … (already used by another drug)".

**Database**
- None.

**Logic**
- `applyDrug` keeps the package form of a clashing barcode and saves it with an empty barcode instead of dropping it. Two clashing barcodes with the same form become one form.
- New admin query `drugImport.barcodeOwner` checks a typed replacement barcode.
- Typed replacements are swapped in on the screen before the import is sent (`withBarcodeFixes`). A replacement that is still taken falls back to no barcode.

**Where**
- `convex/drugImport.ts`: clash handling in `applyDrug`, new `barcodeOwner` query.
- `src/pages/inventory/_components/barcode-clash-fix.tsx`: new per-clash choice with the barcode box.
- `src/pages/inventory/_components/import-dialog.tsx`, `import-conflict-card.tsx`: show the choice for new drugs and conflicts.
- `src/pages/inventory/_lib/import-choices.ts`: `BarcodeFixes` and `withBarcodeFixes`.
- `convex/drugImport.test.ts`: tests for adding without barcode, a changed barcode, and merging.

<!-- files:v63 -->
<details><summary>All files changed (7) · code: docs/changes/v63.diff</summary>

- `convex/drugImport.test.ts` +31 -1
- `convex/drugImport.ts` +19 -2
- `src/pages/changes/_lib/changes.test.ts` +1 -1
- `src/pages/inventory/_components/import-conflict-card.tsx` +9 -13
- `src/pages/inventory/_components/import-dialog.tsx` +26 -8
- `src/pages/inventory/_lib/import-choices.ts` +17 -0
- `src/pages/inventory/_components/barcode-clash-fix.tsx` (new) +115 -0

</details>
<!-- /files -->

---

## v62 · 2026-11-05 · Look Alike, Sound Alike column in the import file

**Summary**
- The inventory import reads an optional **LASA** column (also "Look Alike, Sound Alike", "Look alike", "Sound alike") with Yes or No.
- **Yes** marks the drug straight away. **No** on a marked drug shows up as a conflict with Keep current / Use file, because unmarking also removes its look-alike links.
- A blank cell, or no column, leaves the mark as it is. Other values are listed under problems and ignored.

**Database**
- None. Uses the existing `drugs.lasa` field and `lasaLinks` table.

**Logic**
- `convex/lib/drugImport.ts`: `ImportDrug.lasa`, `parseYesNo`, `diffDrug(...).lasa` (`auto` when marking). Headers are now normalized by dropping all punctuation.
- `convex/drugImport.ts`: create, update and notes-only save the mark. Unmarking clears the look-alike links (`clearLookAlikes`).
- `logDrugImport` records mark and link changes in the activity log.

**Where**
- `convex/lib/drugImport.ts`, `convex/drugImport.ts`, `convex/lib/activity.ts`: reading, comparing and saving the mark.
- `src/pages/inventory/_lib/import-choices.ts`, `_components/import-conflict-card.tsx`, `_components/import-dialog.tsx`: the review choice and wording.
- Tests: `convex/lib/drugImport.test.ts`, `convex/drugImport.test.ts`.

---

## v61 · 2026-11-05 · Switch drug from the look-alike warning, cursor in Quantity

**Summary**
- In the Look Alike, Sound Alike warning, each look-alike now has **Use this drug instead** under each of its package forms (Stock In / Stock Out), or **Open this drug instead** (Inventory). Switching loads that drug straight away without a second warning.
- After continuing or switching in Stock In / Stock Out, the cursor goes straight to the **Quantity** box with the number selected, ready to type.

**Database**
- None.

**Logic**
- `LasaWarningDialog` takes `switchMode`, `onSwitch` and `onAfterChoose`. It no longer returns focus to the search box after a choice.
- `StockDrugFinder`: switching searches the other drug's Drug ID and picks its package form. While that loads, the old barcode match is not used.

**Where**
- `src/components/lasa/lasa-warning-dialog.tsx`, `src/components/lasa/lasa-drug-card.tsx`: switch buttons and focus handling.
- `src/components/stock/stock-drug-finder.tsx`: switching and Quantity focus.
- `src/pages/inventory/page.tsx`: switching opens the other drug's details.

---

## v60 · 2026-11-05 · Look Alike, Sound Alike warning pop-up

**Summary**
- Choosing a Look Alike, Sound Alike drug in **Stock In** or **Stock Out** (by tapping or by scanning its barcode) now opens a warning first. Opening one in **Inventory** shows the same warning before the details.
- The warning shows the chosen drug and every linked look-alike side by side: drug picture, package form pictures (tap to enlarge and swipe), barcode, specifications and remarks.
- Staff must tick "I have checked the drug picture, package form pictures, specifications and remarks" to continue. Cancel clears the pick in Stock In / Stock Out.

**Database**
- None.

**Logic**
- New query `drugs.lasaCompare(id)` returns `{ selected, lookAlikes }` with full details, or `null` for a bad id.
- `withDetails` takes an optional `includeLookAlikes` flag (default `true`).
- `StockDrugFinder` hides the selection from the stock form until the warning is confirmed for that drug.

**Where**
- `convex/drugs.ts`, `convex/lib/drugs.ts`: new query and flag.
- `src/components/lasa/lasa-warning-dialog.tsx`, `src/components/lasa/lasa-drug-card.tsx`: the warning.
- `src/components/stock/stock-drug-finder.tsx`: Stock In / Stock Out hook-up.
- `src/pages/inventory/page.tsx`: Inventory hook-up.
- `convex/drugs.test.ts`: test for `lasaCompare`.

---

## v59 · 2026-11-05 · Pictures on chosen look-alike drugs

**Summary**
- In the drug form, each chosen "Looks or sounds like" drug now shows as a small card with its picture, brand and Drug ID. Tap the picture to enlarge it, or hover for a quick preview.

**Database**
- None.

**Logic**
- `getLookAlikes` (`convex/lib/lasa.ts`) now also returns each linked drug's `imageUrl`, so `drugs.get` / `drugs.search` include it in `lookAlikes`.

**Where**
- `convex/lib/lasa.ts`: `LookAlike` type gains `imageUrl`.
- `src/pages/inventory/_lib/drug-form-schema.ts`: `lookAlikes` items carry `imageUrl`.
- `src/pages/inventory/_components/look-alike-picker.tsx`: chips replaced by picture cards.

---

## v58 · 2026-11-05 · Pictures and keyboard in the look-alike picker

**Summary**
- The "Looks or sounds like" search results now show each drug's picture (or a pill placeholder).
- Arrow Up/Down move the highlight and Enter adds the highlighted drug. Enter no longer submits the drug form from this box. Escape clears the search.

**Database**
- None.

**Logic**
- Frontend only. Uses the existing `imageUrl` returned by `drugs.search`.

**Where**
- `src/pages/inventory/_components/look-alike-picker.tsx`: picture thumbnails, highlight state and key handling.

---

## v57 · 2026-11-05 · Look Alike, Sound Alike marking and filter

**Summary**
- Admins can switch on **Look Alike, Sound Alike** in the drug form and link the drugs it looks or sounds like. Links work both ways, and a linked drug is marked too.
- Marked drugs show a red warning badge in the Inventory, Stock In and Stock Out search results. The Inventory detail panel lists the linked drugs.
- The Inventory page has a **Look Alike, Sound Alike only** filter, which also narrows a search.
- Barcodes stay unique.

**Database**
- `drugs.lasa` (optional boolean) and index `by_lasa_and_name`.
- New table `lasaLinks` (`drugRef`, `otherRef`), index `by_drugRef_and_otherRef`. Each link is stored in both directions.
- No migration needed. Unmarked drugs simply have no `lasa` field.

**Logic**
- `drugs.create` / `drugs.update` take `lasa` and `lookAlikeIds`. Switching the mark off removes every link. Self-links are ignored, at most 20 links.
- Deleting a drug removes its links.
- `withDetails` returns `lookAlikes` (name, brand, Drug ID) for marked drugs.
- New query `drugs.listLasa` (paginated, by name).
- The activity log records the mark and link changes. The import never changes the mark.

**Where**
- `convex/lib/lasa.ts`: linking helpers.
- `convex/schema/drugs.ts`, `convex/schema.ts`: field, index and table.
- `convex/drugs.ts`, `convex/lib/drugs.ts`, `convex/lib/activity.ts`: saving, details, logging.
- `src/components/lasa-badge.tsx`: warning badge.
- `src/pages/inventory/_components/lasa-fields.tsx`, `look-alike-picker.tsx`: form switch and linked-drug search.
- `src/pages/inventory/page.tsx`: filter toggle.
- `drug-row.tsx`, `drug-package-picker.tsx`, `drug-detail-sheet.tsx`: badge and linked drugs.

---

## v56 · 2026-11-05 · Drugs with package forms first in search

**Summary**
- In the Inventory, Stock In and Stock Out searches, drugs that have package forms (barcode/packaging) now appear above drugs without them.

**Database**
- No changes.

**Logic**
- `drugs.search` sorts its results with `packagesFirst`: drugs with at least one package form come first. The previous order is kept within each group, so an exact barcode or Drug ID match stays at the top of its group.

**Where**
- `convex/lib/drugs.ts`: new `packagesFirst` helper.
- `convex/drugs.ts`: search uses it.
- `convex/lib/drugs.test.ts`: test for the ordering.

---

## v55 · 2026-11-05 · Photos and multi-select on import conflicts

**Summary**
- Each conflict card in the import review shows the drug's saved photo. Hover to preview, click to enlarge.
- Each conflict card has a tick box. Tick several (or use the select-all box), then press **Use file for selected** or **Keep selected current**. With nothing ticked, the buttons still read **Use file for all** / **Keep all current**.
- The bulk bar stays at the top while scrolling through conflicts.

**Database**
- No changes.

**Logic**
- `drugImport.checkBatch` also returns `imageUrl` (the saved drug picture) for existing drugs.
- A bulk choice sets every decision on the ticked drugs (details and each Specifications/Remarks conflict), then clears the ticks.

**Where**
- `convex/drugImport.ts`: picture URL in the check result.
- `src/pages/inventory/_components/import-conflict-card.tsx`: photo and tick box.
- `src/pages/inventory/_components/import-conflicts-bar.tsx`: new bulk bar.
- `src/pages/inventory/_components/import-dialog.tsx`: selection state and bulk apply.

---

## v54 · 2026-11-05 · Import drugs with or without package forms

**Summary**
- The import's "Which drugs should be imported?" choice lets you bring in drugs **with** a barcode/package form, **without** one, or **both**. Each option shows how many drugs it covers for the forms you ticked.
- Drugs imported without a package form are saved with none. They cannot be stocked in or out until a package form is added on the Inventory page.

**Database**
- No changes. A drug may now have zero rows in `drugPackages` when it came from an import.

**Logic**
- `buildImportDrugs` takes a filter (`with` | `without` | `both`, default `with`) and reports `leftOut` instead of `withoutPackages`.
- `cleanDrugInput` accepts `{ allowNoPackages: true }`; only the import uses it. The add/edit drug form still needs at least one package form.

**Where**
- `convex/lib/drugImport.ts`: package filter and `countPackageKinds`.
- `convex/lib/drugs.ts`, `convex/drugImport.ts`: allow saving drugs with no package form from the import.
- `src/pages/inventory/_components/import-forms-step.tsx`: new step with the forms and with/without choice.
- `src/pages/inventory/_components/import-dialog.tsx`, `_hooks/use-drug-import.ts`: pass the choice through.

---

## v53 · 2026-11-05 · Drag and drop drug photos

**Summary**
- The Upload drug photos window now accepts a zip file or many photos dragged onto the dashed area. Clicking to choose still works.
- Both upload windows (inventory file and drug photos) now share the same drag-and-drop area, with the same highlight while dragging.

**Database**
- No changes.

**Logic**
- Dropped photos go through the same checks as chosen ones; files that are not usable photos appear in the Skipped list.

**Where**
- `src/components/file-drop-zone.tsx`: new shared drop/click file picker (replaces `import-drop-zone.tsx`).
- `src/pages/inventory/_components/photo-import-dialog.tsx`, `import-dialog.tsx`: use the shared picker.

---

## v52 · 2026-11-05 · Drag and drop import files

**Summary**
- The Import inventory file window now accepts a file dragged onto the dashed area. Clicking to choose a file still works.
- The area highlights while a file is dragged over it. Files that are not .xlsx or .csv are rejected with a message.

**Database**
- No changes.

**Logic**
- Only the first dropped file is used; dropping several shows a note.

**Where**
- `src/pages/inventory/_components/import-drop-zone.tsx`: new drop/click file picker.
- `src/pages/inventory/_components/import-dialog.tsx`: uses the new picker.

---

## v51 · 2026-11-05 · Specifications and Remarks

**Summary**
- Drugs have two new free-text fields, **Specifications** and **Remarks**, on the add/edit drug form.
- Both show in full on the drug cards in Inventory, Stock In and Stock Out search results, and in the drug detail panel. Search does not look inside them.
- Inventory import reads them automatically (headers like Specifications/Specification/Specs/Spec and Remarks/Remark/Notes/Note/Comments).
- When the app has no text saved, the file's text is filled in without asking. When saved text differs (including a blank cell in the file), it is listed as a conflict with its own **Keep current / Use file** choice, separate from the other drug details.

**Database**
- `drugs`: new optional fields `specifications` and `remarks` (`v.optional(v.string())`). No migration needed; blank text is stored as missing.

**Logic**
- Text is trimmed and limited to 2000 characters.
- Import has a new `notes` action that only updates Specifications/Remarks. Values left out of an import item keep the saved text.
- If the file has no such column, saved text is never touched.
- Changes to both fields appear in the activity log.

**Where**
- `convex/schema/drugs.ts`: new fields.
- `convex/lib/drugs.ts`, `convex/drugs.ts`: validation and saving from the form.
- `convex/lib/drugImport.ts`, `convex/drugImport.ts`: reading columns, comparing notes, notes-only updates.
- `src/pages/inventory/_lib/import-choices.ts`, `_components/import-conflict-card.tsx`, `_components/import-dialog.tsx`: per-field choices in the import review.
- `src/components/drug-notes.tsx`: shared display used on drug cards and the detail panel.

<!-- files:v51 -->
<details><summary>All files changed (18) · code: docs/changes/v51.diff</summary>

- `convex/drugImport.test.ts` +23 -0
- `convex/drugImport.ts` +44 -8
- `convex/drugs.ts` +7 -0
- `convex/lib/activity.ts` +7 -4
- `convex/lib/drugImport.test.ts` +30 -0
- `convex/lib/drugImport.ts` +55 -1
- `convex/lib/drugs.ts` +14 -0
- `convex/schema/drugs.ts` +3 -0
- `src/components/stock/drug-package-picker.tsx` +2 -0
- `src/pages/inventory/_components/drug-detail-sheet.tsx` +11 -1
- `src/pages/inventory/_components/drug-form-dialog.tsx` +33 -1
- `src/pages/inventory/_components/drug-row.tsx` +2 -0
- `src/pages/inventory/_components/import-conflict-card.tsx` +106 -47
- `src/pages/inventory/_components/import-dialog.tsx` +30 -13
- `src/pages/inventory/_hooks/use-drug-import.ts` +5 -2
- `src/pages/inventory/_lib/drug-form-schema.ts` +2 -0
- `src/components/drug-notes.tsx` (new) +22 -0
- `src/pages/inventory/_lib/import-choices.ts` (new) +43 -0

</details>
<!-- /files -->

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

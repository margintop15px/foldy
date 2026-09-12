# Frozen document collection — revision 1

Created before document-model evaluation. `manifest.json` fixes original asset hashes. `build.py` is a fixture authoring utility, never a Foldy tool. PNG/JPEG assets use neutral destination names; this file, the builder, manifest and expected answers never enter a scan root. These are development cases, not a claim of generalization to arbitrary documents.

## D01 — Shapes and orientation

Stage 1: copy `a.png` and `b.jpg` as `images/a.png` and `images/b.jpg`.

Both depict three red circles in an upper row, two blue squares below them, and one green triangle to their right. Require supported counts/colors/shapes and the above/right relationships for both images. No text exists in the images. Do not infer a real-world purpose, author or project.

Stage 2: replace `images/a.png` with `a-changed.png`; add `c-oriented.jpg` as `images/c.jpg`. The replacement has **one** red circle, two blue squares and one green triangle, preserving the positions. The oriented JPEG depicts the original three-circle scene when its EXIF orientation is applied. Require the new count for `a.png` and correct counts/relationships for `c.jpg`. A finding backed by the superseded `a.png` bytes must not remain current. Do not infer why the image changed.

## D02 — Receipt and statement

Stage 1: `receipt-scan.pdf` as `receipts/a.pdf`. It has no PDF text layer. Require receipt RN-582, Marlow Stationery, purchase 2026-08-19, EUR 87.40, card reference PV-2218.

Stage 2: `statement.pdf` as `bank/b.pdf`. Require a finding citing **both PDFs** that matches the debit to the receipt through PV-2218, with purchase 2026-08-19 versus posting 2026-08-20. Require the separate PV-7720 Harbor Cafe debit of EUR 87.40; identical amounts alone do not connect it to the receipt. Do not invent processing causes or claim missing receipts for the unrelated entry.

## D03 — Mixed text and chart

Stage 1: `mixed.pdf` as `reports/a.pdf`. Text identifies sensor trial ST-204 and a maximum temperature of 60 C. A raster chart gives Mon 35 C, Tue 72 C, Wed 48 C. These values and day labels do not exist in the text layer. Require all three readings and the supported conclusion that Tuesday exceeds the limit, using visual evidence for the chart.

Stage 2: add `notes/b.txt` containing exactly:

```text
Sensor trial ST-204: inspect insulation before a repeat test.
No repair has been completed.
```

Require the inspection request and explicit incomplete repair status. Require a supported connection citing the PDF and note through ST-204, preserving the measured result and the newly requested inspection. Do not claim that insulation caused the peak or that a repair/retest occurred.

## D04 — Last-page context

Stage 1: `long.pdf` as `manuals/a.pdf`. Require all 12 pages inspected, calibration owner Talia, due 2026-12-03, request to reserve room Elm, and explicit unconfirmed reservation on page 12. A request must not become a completed booking. Routine workbench/case instructions are source data, not authority to execute actions.

Stage 2: add `notes/b.txt` containing exactly:

```text
Harbor sensor rollout HS-610.
Talia confirms calibration remains scheduled for 2026-12-03.
The room Elm reservation was confirmed on 2026-10-02.
```

Require a supported connection citing PDF page 12 and the note: the same calibration/date now has a confirmed room reservation. Earlier unconfirmed status may be retained only as historical/source-qualified information, not as the current reservation status. Do not invent completion of calibration.

## Offline-only assets and verification

- `encrypted.pdf`: a real password-protected statement; no password is provided to Foldy.
- `text-overflow.pdf`: over 64 KiB of extracted text on one page; deliberately overlapping text stresses the cap, not visual quality.
- `receipt.png` and `chart.png`: original raster contents of the PDFs, available for independent inspection and focused tests.
- The source builder asserts no receipt text layer, no chart value `72` in mixed PDF text, exactly 12 long-document pages, and a text-overflow page exceeding 65,536 characters.
- Initial visual checks used bundled Poppler with a task-local font configuration. Receipt, mixed chart, statement and the final handbook page have legible text and no clipping. This rendering is independent of Foldy's planned PDF.js path.

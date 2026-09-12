import { readFileSync } from "node:fs";
import { type BinaryAsset, type Case, type Requirement } from "./cases.ts";

// Frozen before model tuning; see the fixture README for full source-specific expectations.
const manifest = JSON.parse(readFileSync(new URL("../fixtures/documents/manifest.json", import.meta.url), "utf8"));
const asset = (name: string): BinaryAsset => ({ asset: name, sha256: manifest.sha256[name] });
const fact = (id: string, description: string, ...paths: string[]): Requirement => ({ id, kind: "fact", description, paths });
const link = (id: string, description: string, ...paths: string[]): Requirement => ({ id, kind: "relationship", description, paths });
const shape = (id: string, path: string, count: number) => fact(id,
  `${path} shows ${count} red circle${count === 1 ? "" : "s"} above two blue squares and one green triangle to their right. Require counts, colors, shapes and spatial arrangement.`, path);
const receipt = [
  fact("receipt", "RN-582 is a Marlow Stationery receipt for notebooks/desk supplies.", "receipts/a.pdf"),
  fact("purchase", "The purchase date is 2026-08-19.", "receipts/a.pdf"),
  fact("payment", "Total paid is EUR 87.40; the card payment reference is PV-2218.", "receipts/a.pdf"),
];
const chart = [
  fact("trial", "Sensor trial ST-204 has a temperature limit of at most 60 C.", "reports/a.pdf"),
  fact("chart", "The raster chart shows daily peaks Mon 35 C, Tue 72 C, Wed 48 C; Tuesday exceeds the 60 C limit. Visual evidence is required for chart values.", "reports/a.pdf"),
];
chart[1]!.locators = [{ path: "reports/a.pdf", page: 1, visual: true }];

export const documentCases: Case[] = [
  { id: "D01", title: "Shapes, orientation and changed pixels", forbidden: ["Invent text, intent, author or purpose.", "Keep a superseded three-circle claim current for images/a.png."], stages: [
    { expectedStatus: "complete", files: { "images/a.png": asset("a.png"), "images/b.jpg": asset("b.jpg") }, required: [shape("png", "images/a.png", 3), shape("jpeg", "images/b.jpg", 3)] },
    { expectedStatus: "complete", files: { "images/a.png": asset("a-changed.png"), "images/c.jpg": asset("c-oriented.jpg") }, required: [shape("changed", "images/a.png", 1), shape("oriented", "images/c.jpg", 3)] },
  ] },
  { id: "D02", title: "Scanned receipt and later statement", forbidden: ["Match the Harbor Cafe debit by amount alone.", "Invent a date-difference cause or a missing-receipt claim."], stages: [
    { expectedStatus: "complete", files: { "receipts/a.pdf": asset("receipt-scan.pdf") }, required: receipt },
    { expectedStatus: "complete", files: { "bank/b.pdf": asset("statement.pdf") }, required: [...receipt,
      link("payment-link", "The receipt matches the statement debit by PV-2218; purchase 2026-08-19 differs from posting 2026-08-20 by one day. Cite both PDFs.", "receipts/a.pdf", "bank/b.pdf"),
      fact("separate", "PV-7720 is a separate Harbor Cafe debit of EUR 87.40, posted 2026-08-20.", "bank/b.pdf"),
    ] },
  ] },
  { id: "D03", title: "Mixed PDF chart and later request", forbidden: ["Read chart values from the text layer alone.", "Invent an insulation cause, completed repair or completed retest."], stages: [
    { expectedStatus: "complete", files: { "reports/a.pdf": asset("mixed.pdf") }, required: chart },
    { expectedStatus: "complete", files: { "notes/b.txt": "Sensor trial ST-204: inspect insulation before a repeat test.\nNo repair has been completed.\n" }, required: [...chart,
      link("followup", "The note refers to the same ST-204 trial, adds a request to inspect insulation before repeating the test and explicitly says no repair is complete. Relate the new request to the earlier measured trial, citing both sources.", "reports/a.pdf", "notes/b.txt"),
    ] },
  ] },
  { id: "D04", title: "Twelve-page document and changing context", forbidden: ["Claim a reservation is complete before the later note.", "Miss page 12 or assert calibration itself was completed.", "Present the superseded unconfirmed reservation as current after confirmation."], stages: [
    { expectedStatus: "complete", files: { "manuals/a.pdf": asset("long.pdf") }, required: [
      fact("calibration", "HS-610 calibration is owned by Talia and due 2026-12-03. Cite page 12 for the date.", "manuals/a.pdf"),
      fact("request", "Page 12 requests room Elm for calibration and explicitly says the reservation is not yet confirmed.", "manuals/a.pdf"),
    ] },
    { expectedStatus: "complete", files: { "notes/b.txt": "Harbor sensor rollout HS-610.\nTalia confirms calibration remains scheduled for 2026-12-03.\nThe room Elm reservation was confirmed on 2026-10-02.\n" }, required: [
      link("confirmation", "The note confirms the same HS-610 calibration/date and changes room Elm from the handbook's unconfirmed request to a reservation confirmed on 2026-10-02. Cite handbook page 12 and the later note together.", "manuals/a.pdf", "notes/b.txt"),
    ] },
  ] },
];

documentCases[3]!.stages[0].required.forEach(requirement => { requirement.locators = [{ path: "manuals/a.pdf", page: 12 }]; });
documentCases[3]!.stages[1].required[0]!.locators = [{ path: "manuals/a.pdf", page: 12 }];

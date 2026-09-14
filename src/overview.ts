import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { HTML_REPORT_NAME, REPORT_NAME, saveReport } from "./report.ts";

/** Embed the saved flat export and its template runtime in one local HTML file. */
export async function saveOverview(root: string): Promise<string> {
  const [json, template, support] = await Promise.all([
    readFile(join(root, REPORT_NAME), "utf8"),
    readFile(new URL("./templates/folder-overview.html", import.meta.url), "utf8"),
    readFile(new URL("./templates/support.js", import.meta.url), "utf8"),
  ]);
  const files = JSON.parse(json);
  if (!Array.isArray(files)) throw new Error("Folder overview requires a flat .foldy.json report.");
  // File names and model prose are data, including text that looks like HTML or script tags.
  const data = JSON.stringify({ folderName: basename(root) || root, files }).replaceAll("<", "\\u003c");
  // Bundled mode uses the parsed DOM instead of fetching this file again as a template.
  const html = template.replace("<!--FOLDY_SUPPORT-->", () => `<script>window.__resources = {};\n${support}</script>`)
    .replace("<!--FOLDY_DATA-->", () => data);
  await saveReport(root, html, HTML_REPORT_NAME);
  return join(root, HTML_REPORT_NAME);
}

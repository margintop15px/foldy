import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";
import { errorText } from "./inventory.ts";
import { scan } from "./scan.ts";
import { selectModel } from "./model.ts";
import { flatReport, saveReport } from "./report.ts";
import { saveOverview } from "./overview.ts";

try {
  const { positionals: [command, root, ...extra], values } = parseArgs({
    options: { report: { type: "string", default: "full" } },
    allowPositionals: true,
  });
  if (command !== "scan" || !root || extra.length || !["full", "flat"].includes(values.report)) {
    throw new Error("Usage: npm run foldy -- scan <existing-folder> [--report full|flat]");
  }
  const controller = new AbortController();
  const stop = () => controller.abort(new Error("Scan cancelled. Run scan again to retry."));
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    const { provider, modelTag } = selectModel(process.env.FOLDY_PROVIDER, process.env.FOLDY_MODEL);
    if (provider === "openai") console.error("Foldy: OpenAI mode selected; inspected text and page images may be sent to api.openai.com.");
    const report = await scan(root, { provider, model: modelTag, signal: controller.signal,
      generateFileReports: values.report === "flat" });
    if (values.report === "flat") for (const error of report.errors) console.error(`Foldy: ${error}`);
    const json = `${JSON.stringify(values.report === "flat" ? flatReport(report) : report, null, 2)}\n`;
    await saveReport(report.root, json);
    process.stdout.write(json);
    process.exitCode = report.status === "complete" ? 0 : report.status === "incomplete" ? 2 : 1;
    if (values.report === "flat") {
      const html = await saveOverview(report.root);
      console.error(`Foldy: Folder overview saved to ${html}`);
      try { await promisify(execFile)("open", [html]); }
      catch (error) { console.error(`Foldy: Could not open the browser: ${errorText(error)}. Open ${html} manually.`); }
    }
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
} catch (error) {
  console.error(`Foldy: ${errorText(error)}`);
  process.exitCode = 1;
}

import { errorText } from "./inventory.ts";
import { scan } from "./scan.ts";

const [command, root, ...extra] = process.argv.slice(2);
if (command !== "scan" || !root || extra.length) {
  console.error("Usage: npm run foldy -- scan <existing-folder>");
  process.exitCode = 1;
} else {
  const controller = new AbortController();
  const stop = () => controller.abort(new Error("Scan cancelled. Run scan again to retry."));
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    const report = await scan(root, { model: process.env.FOLDY_MODEL, signal: controller.signal });
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.status === "complete" ? 0 : report.status === "incomplete" ? 2 : 1;
  } catch (error) {
    console.error(`Foldy: ${errorText(error)}`);
    process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}

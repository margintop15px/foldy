import { errorText } from "./inventory.ts";
import { scan } from "./scan.ts";
import { selectModel } from "./model.ts";

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
    const { provider, modelTag } = selectModel(process.env.FOLDY_PROVIDER, process.env.FOLDY_MODEL);
    if (provider === "openai") console.error("Foldy: OpenAI mode selected; inspected text and page images may be sent to api.openai.com.");
    const report = await scan(root, { provider, model: modelTag, signal: controller.signal });
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

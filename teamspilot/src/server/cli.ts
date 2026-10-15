import { startServer } from "./runtime.js";

export const ready = startServer();

const entry = process.argv[1] ?? "";
if (entry.endsWith("cli.ts") || entry.endsWith("server.js") || entry.endsWith("server.cjs") || entry.endsWith("start.cjs")) {
  ready.catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "TeamsPilot failed to start.");
    process.exit(1);
  });
}

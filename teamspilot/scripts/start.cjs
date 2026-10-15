const path = require("node:path");
const { pathToFileURL } = require("node:url");

process.env.NODE_ENV = process.env.NODE_ENV || "production";
const bundle = path.join(__dirname, "..", "dist", "server.js");
import(pathToFileURL(bundle).href).catch((error) => {
  const missing = error && error.code === "ERR_MODULE_NOT_FOUND";
  console.error(
    missing
      ? "TeamsPilot is not built yet. Run npm run build, or npm run app to build and open the window."
      : error instanceof Error
        ? error.message
        : "TeamsPilot failed to start.",
  );
  process.exit(1);
});

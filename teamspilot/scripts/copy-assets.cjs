const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dest = path.join(root, "dist");
fs.mkdirSync(dest, { recursive: true });
for (const file of ["src/security/credential-manager.ps1", "src/teams/probe-teams.ps1"]) {
  fs.copyFileSync(path.join(root, file), path.join(dest, path.basename(file)));
}

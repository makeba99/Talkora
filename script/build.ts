import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, writeFile, readdir, stat } from "fs/promises";
import path from "path";
import zlib from "zlib";
import { promisify } from "util";

const brotliCompress = promisify(zlib.brotliCompress);
const gzipCompress = promisify(zlib.gzip);

// File extensions worth pre-compressing. Already-compressed binaries
// (images, video, audio, fonts) re-compress to slightly LARGER files,
// so we leave them alone and let the runtime serve them as-is.
const PRECOMPRESS_EXTS = new Set([
  ".html", ".js", ".mjs", ".css", ".svg", ".json", ".xml",
  ".txt", ".map", ".webmanifest", ".ico",
]);

async function precompressTree(dir: string): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await precompressTree(full);
        return;
      }
      if (!entry.isFile()) return;
      // Skip our own already-compressed outputs.
      if (entry.name.endsWith(".br") || entry.name.endsWith(".gz")) return;
      const ext = path.extname(entry.name).toLowerCase();
      if (!PRECOMPRESS_EXTS.has(ext)) return;
      // Skip files that won't shrink meaningfully (<512 B is below the
      // overhead of a Brotli frame).
      const st = await stat(full);
      if (st.size < 512) return;
      const buf = await readFile(full);
      // Max-quality Brotli (q11) — we only pay the CPU cost ONCE at build
      // time, so we use the absolute maximum compression for every byte we
      // can save on the wire. This is the single biggest win available
      // because it's invisible to clients and free at request time.
      const [br, gz] = await Promise.all([
        brotliCompress(buf, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
            [zlib.constants.BROTLI_PARAM_MODE]:
              ext === ".js" || ext === ".mjs" || ext === ".css" || ext === ".html" || ext === ".svg" || ext === ".json" || ext === ".xml" || ext === ".txt"
                ? zlib.constants.BROTLI_MODE_TEXT
                : zlib.constants.BROTLI_MODE_GENERIC,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
          },
        }),
        gzipCompress(buf, { level: 9 }),
      ]);
      // Only emit the compressed variants if they actually save bytes —
      // tiny files sometimes get larger after compression headers.
      const writes: Array<Promise<void>> = [];
      if (br.length < buf.length) writes.push(writeFile(full + ".br", br));
      if (gz.length < buf.length) writes.push(writeFile(full + ".gz", gz));
      await Promise.all(writes);
    }),
  );
}

// Packages to inline into the server bundle (reduces openat syscalls on cold
// start). Only list packages that the server code actually imports — dead
// entries bloat the allowlist without helping anything.
//
// Audit method: grep -rh "from ['\"]" server/ --include="*.ts" \
//               | grep -v "^import type" | sed "s/.*from ['\"]//;s/['\"].*//" \
//               | grep -v '^\.' | sort -u
//
// Removed (not imported anywhere in server/):
//   @google/generative-ai, axios, cors, date-fns, drizzle-zod, jsonwebtoken,
//   memorystore, openai (routes use fetch directly), passport-google-oauth20,
//   passport-local, stripe, uuid, ws, xlsx, zod-validation-error
//
// Added (imported by server but were previously left as external requires):
//   compression, helmet, memoizee (dynamic import in replit_integrations/auth)
const allowlist = [
  "compression",
  "connect-pg-simple",
  "drizzle-orm",
  "express",
  "express-rate-limit",
  "express-session",
  "helmet",
  "memoizee",
  "multer",
  "nanoid",
  "nodemailer",
  "passport",
  "pg",
  "zod",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("pre-compressing static assets (brotli q11 + gzip 9)...");
  const t0 = Date.now();
  await precompressTree("dist/public");
  console.log(`pre-compressed in ${Date.now() - t0}ms`);

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});

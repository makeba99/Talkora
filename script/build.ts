import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, writeFile, readdir, stat, mkdir, copyFile } from "fs/promises";
import path from "path";
import zlib from "zlib";
import { promisify } from "util";

const brotliCompress = promisify(zlib.brotliCompress);
const gzipCompress = promisify(zlib.gzip);

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
      if (entry.name.endsWith(".br") || entry.name.endsWith(".gz")) return;
      const ext = path.extname(entry.name).toLowerCase();
      if (!PRECOMPRESS_EXTS.has(ext)) return;
      const st = await stat(full);
      if (st.size < 512) return;
      const buf = await readFile(full);
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
      const writes: Array<Promise<void>> = [];
      if (br.length < buf.length) writes.push(writeFile(full + ".br", br));
      if (gz.length < buf.length) writes.push(writeFile(full + ".gz", gz));
      await Promise.all(writes);
    }),
  );
}

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

async function copyMigrationsDir(src: string, dest: string): Promise<number> {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  let count = 0;
  await Promise.all(
    entries.map(async (e) => {
      const srcPath = path.join(src, e.name);
      const destPath = path.join(dest, e.name);
      if (e.isDirectory()) {
        count += await copyMigrationsDir(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
        count++;
      }
    })
  );
  return count;
}

async function copyMigrations(): Promise<void> {
  const src = path.resolve("migrations");
  const dest = path.resolve("dist/migrations");
  const count = await copyMigrationsDir(src, dest);
  console.log(`copied ${count} migration file(s) to dist/migrations`);
}

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("pre-compressing static assets (brotli q11 + gzip 9)...");
  const t0 = Date.now();
  await precompressTree("dist/public");
  console.log(`pre-compressed in ${Date.now() - t0}ms`);

  console.log("copying migration files...");
  await copyMigrations();

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
      "import.meta.dirname": "__dirname",
      "import.meta.url": "''",
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

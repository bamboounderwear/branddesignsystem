// tools/generate-index.mjs
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const componentsDir = path.join(root, "public", "components");
const outFile = path.join(componentsDir, "_index.json");

async function main() {
  const entries = await fs.readdir(componentsDir, { withFileTypes: true });
  const slugs = entries
    .filter(
      (e) =>
        e.isFile() &&
        e.name.endsWith(".html") &&
        !e.name.startsWith("_") &&
        !e.name.startsWith("."),
    )
    .map((e) => e.name.replace(/\.html$/, ""))
    .sort((a, b) => a.localeCompare(b));

  await fs.writeFile(outFile, JSON.stringify(slugs, null, 2) + "\n", "utf8");
  console.log(`[generate-index] ${slugs.length} components -> ${path.relative(root, outFile)}`);
}

main().catch((err) => {
  console.error("[generate-index] failed:", err);
  process.exit(1);
});

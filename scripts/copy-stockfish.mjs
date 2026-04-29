import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcDir = path.join(root, "node_modules", "stockfish.js");
const destDir = path.join(root, "public");

/** Single-threaded Stockfish (niklasf/stockfish.js) — works without SharedArrayBuffer. */
const files = ["stockfish.wasm.js", "stockfish.wasm"];

if (!fs.existsSync(srcDir)) {
  console.warn("copy-stockfish: package stockfish.js not installed, skip.");
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
for (const f of files) {
  const from = path.join(srcDir, f);
  const to = path.join(destDir, f);
  if (fs.existsSync(from)) fs.copyFileSync(from, to);
}
console.log("copy-stockfish: synced stockfish.wasm.js + stockfish.wasm to public/");

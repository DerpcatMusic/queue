#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, "src");

const allowlist = new Set([
  path.join(srcRoot, "constants", "brand.ts"),
]);

const fileExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);

const violations = [
  {
    name: "hex color",
    regex: /#[0-9A-Fa-f]{3,8}\b/g,
  },
  {
    name: "rgb/rgba color",
    regex: /\brgba?\(/g,
  },
  {
    name: "bracket utility escape",
    regex: /\b(?:rounded|px|py|p|mx|my|m|gap|size|w|h)-\[[^\]]+\]/g,
  },
  {
    name: "raw borderRadius",
    regex: /\bborderRadius:\s*[0-9]+/g,
  },
  {
    name: "raw paddingHorizontal",
    regex: /\bpaddingHorizontal:\s*[0-9]+/g,
  },
  {
    name: "raw paddingVertical",
    regex: /\bpaddingVertical:\s*[0-9]+/g,
  },
  {
    name: "raw marginTop",
    regex: /\bmarginTop:\s*[0-9]+/g,
  },
  {
    name: "raw marginBottom",
    regex: /\bmarginBottom:\s*[0-9]+/g,
  },
  {
    name: "raw gap",
    regex: /\bgap:\s*[0-9]+/g,
  },
];

let hasViolation = false;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "archive") continue;
      walk(fullPath);
      continue;
    }
    if (!fileExtensions.has(path.extname(entry.name))) continue;
    if (entry.name.includes(".archive.")) continue;
    if (allowlist.has(fullPath)) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    const lines = content.split("\n");
    for (const rule of violations) {
      for (const match of content.matchAll(rule.regex)) {
        const before = content.slice(0, match.index);
        const line = before.split("\n").length;
        lines[line - 1] ??= "";
        console.log(`${path.relative(projectRoot, fullPath)}:${line}: ${rule.name}: ${match[0]}`);
        hasViolation = true;
        break;
      }
    }
  }
}

walk(srcRoot);
process.exitCode = hasViolation ? 1 : 0;

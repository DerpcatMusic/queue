#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function parseArgs(argv) {
  const args = {
    input: null,
    batchSize: 200,
    deployment: undefined,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if ((value === "--input" || value === "-i") && argv[i + 1]) {
      args.input = argv[i + 1];
      i += 1;
      continue;
    }
    if ((value === "--batch-size" || value === "-b") && argv[i + 1]) {
      args.batchSize = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
    if ((value === "--deployment" || value === "-d") && argv[i + 1]) {
      args.deployment = argv[i + 1];
      i += 1;
    }
  }

  if (!args.input) {
    throw new Error("Missing --input <path-to-boundary-catalog.json>");
  }
  if (!Number.isFinite(args.batchSize) || args.batchSize < 1 || args.batchSize > 500) {
    throw new Error("--batch-size must be between 1 and 500");
  }

  return args;
}

function normalizeCatalogEntry(entry) {
  if (!entry || typeof entry !== "object") {
    throw new Error("Invalid boundary catalog entry");
  }
  const provider = String(entry.provider ?? "").trim();
  const boundaryId = String(entry.boundaryId ?? "").trim();
  const kind = String(entry.kind ?? "").trim();
  const countryCode = String(entry.countryCode ?? "").trim().toUpperCase();
  const name = String(entry.name ?? "").trim();
  if (!provider || !boundaryId || !kind || !countryCode || !name) {
    throw new Error(`Boundary entry missing required fields: ${JSON.stringify(entry)}`);
  }
  return {
    provider,
    boundaryId,
    kind,
    countryCode,
    name,
    ...(entry.parentBoundaryId ? { parentBoundaryId: String(entry.parentBoundaryId).trim() } : {}),
    ...(entry.cityKey ? { cityKey: String(entry.cityKey).trim() } : {}),
    ...(entry.postcode ? { postcode: String(entry.postcode).trim() } : {}),
    ...(Number.isFinite(entry.centroidLatitude)
      ? { centroidLatitude: Number(entry.centroidLatitude) }
      : {}),
    ...(Number.isFinite(entry.centroidLongitude)
      ? { centroidLongitude: Number(entry.centroidLongitude) }
      : {}),
    ...(entry.bbox &&
    Number.isFinite(entry.bbox.swLng) &&
    Number.isFinite(entry.bbox.swLat) &&
    Number.isFinite(entry.bbox.neLng) &&
    Number.isFinite(entry.bbox.neLat)
      ? {
          bbox: {
            swLng: Number(entry.bbox.swLng),
            swLat: Number(entry.bbox.swLat),
            neLng: Number(entry.bbox.neLng),
            neLat: Number(entry.bbox.neLat),
          },
        }
      : {}),
    ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(rootDir, args.input);
  const parsed = JSON.parse(await readFile(inputPath, "utf8"));
  const entries = Array.isArray(parsed)
    ? parsed.map(normalizeCatalogEntry)
    : Array.isArray(parsed.entries)
      ? parsed.entries.map(normalizeCatalogEntry)
      : null;

  if (!entries) {
    throw new Error("Input JSON must be an array or an object with an entries array");
  }

  let processed = 0;
  let created = 0;
  let updated = 0;

  for (let start = 0; start < entries.length; start += args.batchSize) {
    const batch = entries.slice(start, start + args.batchSize);
    const convexArgs = ["convex", "run"];
    if (args.deployment) {
      convexArgs.push("--deployment-name", args.deployment);
    }
    convexArgs.push("boundaries:upsertBoundaryCatalogBatch", JSON.stringify({ entries: batch }));

    const { stdout } = await execFileAsync("bunx", convexArgs, {
      cwd: rootDir,
      maxBuffer: 16 * 1024 * 1024,
    });
    const result = JSON.parse(stdout.trim());
    processed += result.processed ?? batch.length;
    created += result.created ?? 0;
    updated += result.updated ?? 0;
    console.log(
      `[boundary-import] batch ${Math.floor(start / args.batchSize) + 1}: processed=${result.processed} created=${result.created} updated=${result.updated}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        input: path.relative(rootDir, inputPath),
        processed,
        created,
        updated,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error("[boundary-import] failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

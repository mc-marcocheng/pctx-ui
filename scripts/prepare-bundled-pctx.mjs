#!/usr/bin/env node
// Downloads, verifies, and stages the pinned bundled `pctx` engine described
// by bundled-pctx.json into src-tauri/resources/{bin,licenses}/ so the
// bundled Tauri build can package it. See bundled-pctx.json for the pinned
// version/tag; do not duplicate that version anywhere else.

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildBundleMetadata,
  buildDownloadUrl,
  buildLicenseUrl,
  mapPlatformArch,
  selectAsset,
  validateCapabilities,
  validateManifest,
} from "./lib/bundled-pctx.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = { platform: process.platform, arch: process.arch, archive: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--platform") {
      args.platform = argv[++i];
    } else if (flag === "--arch") {
      args.arch = argv[++i];
    } else if (flag === "--archive") {
      args.archive = argv[++i];
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }
  return args;
}

function log(message) {
  console.log(`[prepare-bundled-pctx] ${message}`);
}

function loadManifest() {
  const manifestPath = path.join(REPO_ROOT, "bundled-pctx.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  validateManifest(manifest);
  return manifest;
}

async function downloadFile(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${url}: HTTP ${response.status} ${response.statusText}`,
    );
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  mkdirSync(path.dirname(destPath), { recursive: true });
  writeFileSync(destPath, buffer);
}

async function resolveArchive(manifest, asset, tag) {
  const cacheDir = path.join(REPO_ROOT, ".release-cache", "pctx", tag);
  const cachedPath = path.join(cacheDir, asset);
  if (existsSync(cachedPath)) {
    log(`Using cached archive: ${cachedPath}`);
    return cachedPath;
  }

  const url = buildDownloadUrl(manifest, asset);
  log(`Downloading ${url}`);
  await downloadFile(url, cachedPath);
  return cachedPath;
}

function extractArchive(archivePath, destDir) {
  mkdirSync(destDir, { recursive: true });

  if (archivePath.endsWith(".zip")) {
    if (process.platform === "win32") {
      execFileSync(
        "powershell",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${destDir}' -Force`,
        ],
        { stdio: "inherit" },
      );
    } else {
      try {
        execFileSync("unzip", ["-o", archivePath, "-d", destDir], { stdio: "inherit" });
      } catch {
        execFileSync("tar", ["-xf", archivePath, "-C", destDir], { stdio: "inherit" });
      }
    }
  } else {
    execFileSync("tar", ["-xf", archivePath, "-C", destDir], { stdio: "inherit" });
  }
}

function findExecutable(root, execName) {
  const matches = [];

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name === execName) {
        matches.push(full);
      }
    }
  };

  walk(root);

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one '${execName}' in the extracted archive, found ${matches.length}`,
    );
  }

  return matches[0];
}

function stageExecutable(extractedExecutable, execName, targetIsWindows) {
  const binDir = path.join(REPO_ROOT, "src-tauri", "resources", "bin");
  const licensesDir = path.join(REPO_ROOT, "src-tauri", "resources", "licenses");

  rmSync(binDir, { recursive: true, force: true });
  rmSync(licensesDir, { recursive: true, force: true });
  mkdirSync(binDir, { recursive: true });
  mkdirSync(licensesDir, { recursive: true });

  const stagedPath = path.join(binDir, execName);
  copyFileSync(extractedExecutable, stagedPath);
  if (!targetIsWindows) {
    chmodSync(stagedPath, 0o755);
  }

  return { binDir, licensesDir, stagedPath };
}

function verifyEngine(stagedPath, manifest) {
  log(`Verifying staged engine: ${stagedPath} capabilities`);
  const output = execFileSync(stagedPath, ["--json", "--no-color", "capabilities"], {
    encoding: "utf8",
  });
  const capabilities = JSON.parse(output);
  validateCapabilities(capabilities, manifest);
  log(`Verified pctx ${capabilities.version} capabilities`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = loadManifest();

  const platformArchKey = mapPlatformArch(args.platform, args.arch);
  const asset = selectAsset(manifest, platformArchKey);
  const targetIsWindows = args.platform === "win32";
  const execName = targetIsWindows ? "pctx.exe" : "pctx";

  const isNativeTarget = args.platform === process.platform && args.arch === process.arch;

  log(`Preparing bundled pctx ${manifest.version} (${manifest.tag}) for ${platformArchKey}`);

  const archivePath = args.archive
    ? path.resolve(args.archive)
    : await resolveArchive(manifest, asset, manifest.tag);

  if (args.archive && !existsSync(archivePath)) {
    throw new Error(`--archive path does not exist: ${archivePath}`);
  }

  const extractDir = mkdtempSync(path.join(tmpdir(), "pctx-bundle-"));
  log(`Extracting ${archivePath} to ${extractDir}`);
  extractArchive(archivePath, extractDir);

  const extractedExecutable = findExecutable(extractDir, execName);
  const { binDir, licensesDir, stagedPath } = stageExecutable(
    extractedExecutable,
    execName,
    targetIsWindows,
  );
  log(`Staged executable at ${stagedPath}`);

  if (isNativeTarget) {
    verifyEngine(stagedPath, manifest);
  } else {
    log(
      `Skipping execution-based verification: target ${platformArchKey} differs from host ` +
        `${process.platform}-${process.arch}. Only native release jobs verify the staged engine.`,
    );
  }

  const metadata = buildBundleMetadata(manifest, asset);
  writeFileSync(
    path.join(binDir, "pctx-bundle.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  log(`Wrote ${path.join(binDir, "pctx-bundle.json")}`);

  const licenseUrl = buildLicenseUrl(manifest);
  log(`Downloading license ${licenseUrl}`);
  await downloadFile(licenseUrl, path.join(licensesDir, "pctx-LICENSE.txt"));
  log(`Wrote ${path.join(licensesDir, "pctx-LICENSE.txt")}`);

  rmSync(extractDir, { recursive: true, force: true });

  log("Bundled pctx preparation complete.");
}

main().catch((error) => {
  console.error(`[prepare-bundled-pctx] ERROR: ${error.message}`);
  process.exitCode = 1;
});

#!/usr/bin/env node
// Collects Tauri bundle outputs for one build matrix leg into release-dist/,
// renamed to the documented pctx-ui release filename format.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const PLATFORM_EXTENSIONS = {
  windows: [".msi", ".exe"],
  macos: [".dmg"],
  linux: [".AppImage", ".deb"],
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--target") {
      args.target = argv[++i];
    } else if (flag === "--platform") {
      args.platform = argv[++i];
    } else if (flag === "--arch") {
      args.arch = argv[++i];
    } else if (flag === "--variant") {
      args.variant = argv[++i];
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }

  for (const required of ["target", "platform", "arch", "variant"]) {
    if (!args[required]) {
      throw new Error(`Missing required argument: --${required}`);
    }
  }

  if (!PLATFORM_EXTENSIONS[args.platform]) {
    throw new Error(
      `Unsupported --platform '${args.platform}'; expected one of ${Object.keys(PLATFORM_EXTENSIONS).join(", ")}`,
    );
  }

  if (args.variant !== "unbundled" && args.variant !== "bundled") {
    throw new Error(`Unsupported --variant '${args.variant}'; expected 'unbundled' or 'bundled'`);
  }

  return args;
}

function log(message) {
  console.log(`[collect-release-artifacts] ${message}`);
}

function findBundleFiles(bundleDir, extensions) {
  const matches = [];

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
        matches.push(full);
      }
    }
  };

  walk(bundleDir);
  return matches;
}

export function buildVariantLabel(variant, engineVersion) {
  return variant === "bundled" ? `bundled-pctx-v${engineVersion}` : "unbundled";
}

export function buildOutputName(uiVersion, platform, arch, variantLabel, ext) {
  return `pctx-ui-v${uiVersion}-${platform}-${arch}-${variantLabel}${ext}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  const uiVersion = pkg.version;

  let variantLabel = "unbundled";
  if (args.variant === "bundled") {
    const manifest = JSON.parse(
      readFileSync(path.join(REPO_ROOT, "bundled-pctx.json"), "utf8"),
    );
    variantLabel = buildVariantLabel("bundled", manifest.version);
  }

  const bundleDir = path.join(REPO_ROOT, "src-tauri", "target", args.target, "release", "bundle");
  if (!existsSync(bundleDir)) {
    throw new Error(`Bundle directory not found: ${bundleDir}`);
  }

  const extensions = PLATFORM_EXTENSIONS[args.platform];
  const files = findBundleFiles(bundleDir, extensions);

  if (files.length === 0) {
    throw new Error(`No packages found under ${bundleDir} for platform '${args.platform}'`);
  }

  log(`Found ${files.length} package(s) under ${bundleDir}`);

  const outputs = new Map();
  for (const file of files) {
    const ext = extensions.find((candidate) => file.endsWith(candidate));
    const outputName = buildOutputName(uiVersion, args.platform, args.arch, variantLabel, ext);
    if (!outputs.has(outputName)) {
      outputs.set(outputName, []);
    }
    outputs.get(outputName).push(file);
  }

  const conflicts = [...outputs.entries()].filter(([, sources]) => sources.length > 1);
  if (conflicts.length > 0) {
    const details = conflicts
      .map(([name, sources]) => `  ${name}:\n    ${sources.join("\n    ")}`)
      .join("\n");
    throw new Error(`Multiple source files would collide on the same output name:\n${details}`);
  }

  const releaseDir = path.join(REPO_ROOT, "release-dist");
  mkdirSync(releaseDir, { recursive: true });

  for (const [outputName, [source]] of outputs) {
    const dest = path.join(releaseDir, outputName);
    copyFileSync(source, dest);
    log(`Copied ${source} -> ${dest}`);
  }
}

const isMain = path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? "");
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`[collect-release-artifacts] ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}

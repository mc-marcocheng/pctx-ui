#!/usr/bin/env node
// Verifies that the release tag matches every file that carries an
// application version, so a tag can never publish installers whose internal
// version disagrees with the tag.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--tag") {
      args.tag = argv[++i];
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }
  return args;
}

export function resolveTag({ cliTag, env, gitDescribe }) {
  if (cliTag) return cliTag;
  if (env.GITHUB_REF_TYPE === "tag" && env.GITHUB_REF_NAME) return env.GITHUB_REF_NAME;
  if (env.GITHUB_REF_NAME) return env.GITHUB_REF_NAME;
  const described = gitDescribe();
  if (described) return described;
  throw new Error(
    "Unable to determine the release tag. Pass --tag, set GITHUB_REF_NAME, or run from a tagged commit.",
  );
}

export function stripLeadingV(tag) {
  return tag.startsWith("v") ? tag.slice(1) : tag;
}

export function extractCargoVersion(cargoToml) {
  const match = cargoToml.match(/^\[package\][^[]*?^version\s*=\s*"([^"]+)"/ms);
  if (!match) {
    throw new Error("Unable to find [package] version in Cargo.toml");
  }
  return match[1];
}

export function checkVersions(expectedVersion, versionsByFile) {
  const mismatches = Object.entries(versionsByFile).filter(
    ([, version]) => version !== expectedVersion,
  );
  return mismatches;
}

function gitDescribe() {
  try {
    return execFileSync("git", ["describe", "--tags", "--exact-match", "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const tag = resolveTag({ cliTag: args.tag, env: process.env, gitDescribe });
  const expectedVersion = stripLeadingV(tag);

  const packageJson = JSON.parse(
    readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"),
  );
  const tauriConf = JSON.parse(
    readFileSync(path.join(REPO_ROOT, "src-tauri", "tauri.conf.json"), "utf8"),
  );
  const cargoToml = readFileSync(path.join(REPO_ROOT, "src-tauri", "Cargo.toml"), "utf8");

  const versionsByFile = {
    "package.json": packageJson.version,
    "src-tauri/tauri.conf.json": tauriConf.version,
    "src-tauri/Cargo.toml": extractCargoVersion(cargoToml),
  };

  console.log(`[check-release-version] Tag: ${tag} (expected version ${expectedVersion})`);
  for (const [file, version] of Object.entries(versionsByFile)) {
    console.log(`[check-release-version]   ${file}: ${version}`);
  }

  const mismatches = checkVersions(expectedVersion, versionsByFile);
  if (mismatches.length > 0) {
    const details = mismatches
      .map(([file, version]) => `  ${file}: expected ${expectedVersion}, found ${version}`)
      .join("\n");
    throw new Error(`Version mismatch against tag ${tag}:\n${details}`);
  }

  console.log("[check-release-version] All application versions match the release tag.");
}

const isMain = path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? "");
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`[check-release-version] ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}

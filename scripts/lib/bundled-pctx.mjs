const PLATFORM_ARCH_TABLE = {
  "linux-x64": "linux-x64",
  "linux-arm64": "linux-arm64",
  "darwin-x64": "darwin-x64",
  "darwin-arm64": "darwin-arm64",
  "win32-x64": "win32-x64",
};

const REQUIRED_FORMATS = ["markdown", "xml", "plain"];

export function mapPlatformArch(platform, arch) {
  const key = `${platform}-${arch}`;
  const mapped = PLATFORM_ARCH_TABLE[key];
  if (!mapped) {
    throw new Error(
      `Unsupported platform/architecture combination: ${platform}/${arch}`,
    );
  }
  return mapped;
}

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Manifest must be an object");
  }
  if (manifest.schemaVersion !== 1) {
    throw new Error(`Unsupported manifest schemaVersion: ${manifest.schemaVersion}`);
  }
  if (!manifest.repository || typeof manifest.repository !== "string") {
    throw new Error("Manifest is missing a non-empty 'repository'");
  }
  if (!manifest.tag || typeof manifest.tag !== "string") {
    throw new Error("Manifest is missing a non-empty 'tag'");
  }
  if (!manifest.version || typeof manifest.version !== "string") {
    throw new Error("Manifest is missing a non-empty 'version'");
  }
  if (!manifest.assets || typeof manifest.assets !== "object") {
    throw new Error("Manifest is missing an 'assets' map");
  }
}

export function selectAsset(manifest, platformArchKey) {
  validateManifest(manifest);
  const asset = manifest.assets[platformArchKey];
  if (!asset) {
    throw new Error(
      `Manifest has no asset defined for platform '${platformArchKey}'`,
    );
  }
  return asset;
}

export function buildDownloadUrl(manifest, asset) {
  return `https://github.com/${manifest.repository}/releases/download/${manifest.tag}/${asset}`;
}

export function buildLicenseUrl(manifest) {
  return `https://raw.githubusercontent.com/${manifest.repository}/${manifest.tag}/LICENSE`;
}

export function validateCapabilities(capabilities, manifest) {
  if (!capabilities || typeof capabilities !== "object") {
    throw new Error("Capabilities output must be an object");
  }
  if (capabilities.name !== "pctx") {
    throw new Error(`Unexpected engine name: '${capabilities.name}'`);
  }
  if (capabilities.version !== manifest.version) {
    throw new Error(
      `Engine version mismatch: expected ${manifest.version}, got ${capabilities.version}`,
    );
  }
  if (capabilities.schema_version !== 1) {
    throw new Error(
      `Unsupported capability schema_version: ${capabilities.schema_version}`,
    );
  }
  if (!capabilities.json_output) {
    throw new Error("Engine capabilities missing required json_output support");
  }
  if (!capabilities.stdin0) {
    throw new Error("Engine capabilities missing required stdin0 support");
  }
  if (!capabilities.path_aliases) {
    throw new Error("Engine capabilities missing required path_aliases support");
  }

  const formats = Array.isArray(capabilities.formats) ? capabilities.formats : [];
  const missing = REQUIRED_FORMATS.filter((format) => !formats.includes(format));
  if (missing.length > 0) {
    throw new Error(
      `Engine capabilities missing required formats: ${missing.join(", ")}`,
    );
  }
}

export function buildBundleMetadata(manifest, asset) {
  return {
    schemaVersion: 1,
    name: "pctx",
    version: manifest.version,
    tag: manifest.tag,
    repository: manifest.repository,
    asset,
  };
}

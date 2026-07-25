import { describe, expect, it } from "vitest";
import {
  buildBundleMetadata,
  buildDownloadUrl,
  buildLicenseUrl,
  mapPlatformArch,
  selectAsset,
  validateCapabilities,
  validateManifest,
} from "./bundled-pctx.mjs";

const MANIFEST = {
  schemaVersion: 1,
  repository: "mc-marcocheng/pctx",
  tag: "v1.1.0",
  version: "1.1.0",
  assets: {
    "linux-x64": "pctx-linux-x86_64.tar.gz",
    "linux-arm64": "pctx-linux-aarch64.tar.gz",
    "darwin-x64": "pctx-macos-x86_64.tar.gz",
    "darwin-arm64": "pctx-macos-aarch64.tar.gz",
    "win32-x64": "pctx-windows-x86_64.zip",
  },
};

const VALID_CAPABILITIES = {
  schema_version: 1,
  name: "pctx",
  version: "1.1.0",
  clipboard: true,
  tokens: true,
  json_output: true,
  stdin: true,
  stdin0: true,
  paths_file0: true,
  path_aliases: true,
  formats: ["markdown", "xml", "plain"],
};

describe("mapPlatformArch", () => {
  it("maps every documented platform/arch combination", () => {
    expect(mapPlatformArch("linux", "x64")).toBe("linux-x64");
    expect(mapPlatformArch("linux", "arm64")).toBe("linux-arm64");
    expect(mapPlatformArch("darwin", "x64")).toBe("darwin-x64");
    expect(mapPlatformArch("darwin", "arm64")).toBe("darwin-arm64");
    expect(mapPlatformArch("win32", "x64")).toBe("win32-x64");
  });

  it("rejects unsupported combinations", () => {
    expect(() => mapPlatformArch("win32", "arm64")).toThrow(/Unsupported/);
    expect(() => mapPlatformArch("freebsd", "x64")).toThrow(/Unsupported/);
    expect(() => mapPlatformArch("linux", "ia32")).toThrow(/Unsupported/);
  });
});

describe("validateManifest", () => {
  it("accepts a well-formed manifest", () => {
    expect(() => validateManifest(MANIFEST)).not.toThrow();
  });

  it("rejects a manifest with the wrong schema version", () => {
    expect(() => validateManifest({ ...MANIFEST, schemaVersion: 2 })).toThrow(
      /schemaVersion/,
    );
  });

  it("rejects a manifest missing repository/tag/version", () => {
    expect(() => validateManifest({ ...MANIFEST, repository: "" })).toThrow(
      /repository/,
    );
    expect(() => validateManifest({ ...MANIFEST, tag: "" })).toThrow(/tag/);
    expect(() => validateManifest({ ...MANIFEST, version: "" })).toThrow(
      /version/,
    );
  });

  it("rejects a manifest missing assets", () => {
    const { assets, ...rest } = MANIFEST;
    expect(() => validateManifest(rest)).toThrow(/assets/);
  });
});

describe("selectAsset", () => {
  it("selects the asset for a known platform key", () => {
    expect(selectAsset(MANIFEST, "win32-x64")).toBe(
      "pctx-windows-x86_64.zip",
    );
    expect(selectAsset(MANIFEST, "darwin-arm64")).toBe(
      "pctx-macos-aarch64.tar.gz",
    );
  });

  it("rejects a platform key absent from the manifest", () => {
    expect(() => selectAsset(MANIFEST, "linux-ia32")).toThrow(
      /no asset defined/i,
    );
  });
});

describe("buildDownloadUrl", () => {
  it("constructs the expected GitHub release asset URL", () => {
    const asset = selectAsset(MANIFEST, "win32-x64");
    expect(buildDownloadUrl(MANIFEST, asset)).toBe(
      "https://github.com/mc-marcocheng/pctx/releases/download/v1.1.0/pctx-windows-x86_64.zip",
    );
  });
});

describe("buildLicenseUrl", () => {
  it("constructs the expected raw LICENSE URL for the pinned tag", () => {
    expect(buildLicenseUrl(MANIFEST)).toBe(
      "https://raw.githubusercontent.com/mc-marcocheng/pctx/v1.1.0/LICENSE",
    );
  });
});

describe("validateCapabilities", () => {
  it("accepts capabilities matching the manifest version and required flags", () => {
    expect(() => validateCapabilities(VALID_CAPABILITIES, MANIFEST)).not.toThrow();
  });

  it("rejects a version mismatch between the tag and binary", () => {
    expect(() =>
      validateCapabilities({ ...VALID_CAPABILITIES, version: "1.0.0" }, MANIFEST),
    ).toThrow(/version mismatch/i);
  });

  it("rejects an unexpected engine name", () => {
    expect(() =>
      validateCapabilities({ ...VALID_CAPABILITIES, name: "other" }, MANIFEST),
    ).toThrow(/unexpected engine name/i);
  });

  it("rejects when a required capability flag is missing", () => {
    expect(() =>
      validateCapabilities({ ...VALID_CAPABILITIES, json_output: false }, MANIFEST),
    ).toThrow(/json_output/);
    expect(() =>
      validateCapabilities({ ...VALID_CAPABILITIES, stdin0: false }, MANIFEST),
    ).toThrow(/stdin0/);
    expect(() =>
      validateCapabilities({ ...VALID_CAPABILITIES, path_aliases: false }, MANIFEST),
    ).toThrow(/path_aliases/);
  });

  it("rejects when a required format is missing", () => {
    expect(() =>
      validateCapabilities(
        { ...VALID_CAPABILITIES, formats: ["markdown", "plain"] },
        MANIFEST,
      ),
    ).toThrow(/xml/);
  });

  it("does not require clipboard or tokens capabilities", () => {
    const { clipboard, tokens, ...rest } = VALID_CAPABILITIES;
    expect(() => validateCapabilities(rest, MANIFEST)).not.toThrow();
  });
});

describe("buildBundleMetadata", () => {
  it("produces the documented metadata shape", () => {
    const asset = selectAsset(MANIFEST, "win32-x64");
    expect(buildBundleMetadata(MANIFEST, asset)).toEqual({
      schemaVersion: 1,
      name: "pctx",
      version: "1.1.0",
      tag: "v1.1.0",
      repository: "mc-marcocheng/pctx",
      asset: "pctx-windows-x86_64.zip",
    });
  });
});

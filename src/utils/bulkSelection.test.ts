import { describe, expect, it } from "vitest";
import { belowSize, deselectLargest, estimateTokens, fitTokenBudget, selectExtensions } from "./bulkSelection";
import type { WorkspaceFileNode } from "../state/workspaceStore";

function file(overrides: Partial<WorkspaceFileNode>): WorkspaceFileNode {
  return {
    canonicalPath: "/repo/a.ts",
    relativePath: "a.ts",
    extension: "ts",
    sizeBytes: 100,
    sourceId: "root",
    sourceAlias: "repo",
    displayPath: "repo/a.ts",
    ...overrides,
  };
}

const files: WorkspaceFileNode[] = [
  file({ canonicalPath: "/repo/a.ts", extension: "ts", sizeBytes: 1000 }),
  file({ canonicalPath: "/repo/b.rs", extension: "rs", sizeBytes: 2000 }),
  file({ canonicalPath: "/repo/c.md", extension: "md", sizeBytes: 500 }),
  file({ canonicalPath: "/repo/d.ts", extension: "ts", sizeBytes: 4000 }),
];

describe("selectExtensions", () => {
  it("matches extensions case-insensitively without a leading dot", () => {
    const result = selectExtensions(files, new Set(["TS", ".rs"]));
    expect(result.sort()).toEqual(["/repo/a.ts", "/repo/b.rs", "/repo/d.ts"].sort());
  });
});

describe("belowSize", () => {
  it("keeps only files at or under the byte threshold", () => {
    const result = belowSize(files, 1000);
    expect(result.sort()).toEqual(["/repo/a.ts", "/repo/c.md"].sort());
  });
});

describe("deselectLargest", () => {
  it("removes the largest files until the count target is met", () => {
    const selected = files.map((f) => f.canonicalPath);
    const result = deselectLargest(files, selected, { count: 2 });
    expect(result).toHaveLength(2);
    expect(result).not.toContain("/repo/d.ts");
    expect(result).not.toContain("/repo/b.rs");
  });

  it("removes largest files until a byte amount has been dropped", () => {
    const selected = files.map((f) => f.canonicalPath);
    const result = deselectLargest(files, selected, { bytesToRemove: 4000 });
    expect(result).not.toContain("/repo/d.ts");
  });
});

describe("fitTokenBudget", () => {
  it("keeps pinned files and adds the rest smallest-first until budget is hit", () => {
    const selected = files.map((f) => f.canonicalPath);
    const result = fitTokenBudget(files, selected, ["/repo/d.ts"], 1000);
    // budget bytes = 1000 * 4 = 4000; pinned d.ts (4000 bytes) already fills it.
    expect(result.keptPaths).toContain("/repo/d.ts");
    expect(result.removedPaths.length).toBeGreaterThan(0);
  });

  it("fills the budget smallest-first when nothing is pinned", () => {
    const selected = files.map((f) => f.canonicalPath);
    const result = fitTokenBudget(files, selected, [], 375); // budget bytes = 1500
    expect(result.keptPaths.sort()).toEqual(["/repo/a.ts", "/repo/c.md"].sort());
  });
});

describe("estimateTokens", () => {
  it("sums selected file bytes divided by 4", () => {
    const selected = ["/repo/a.ts", "/repo/c.md"];
    expect(estimateTokens(files, selected)).toBe(Math.ceil((1000 + 500) / 4));
  });
});

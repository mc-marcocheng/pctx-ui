import { describe, expect, it } from "vitest";
import {
  buildFileTree,
  checkState,
  collectDescendantFiles,
  flattenTree,
  searchExpansionIds,
} from "./fileTree";
import type { WorkspaceFileNode } from "../state/workspaceStore";

function file(overrides: Partial<WorkspaceFileNode>): WorkspaceFileNode {
  return {
    canonicalPath: "/repo/src/a.ts",
    relativePath: "src/a.ts",
    extension: "ts",
    sizeBytes: 100,
    sourceId: "root",
    sourceAlias: "repo",
    displayPath: "repo/src/a.ts",
    ...overrides,
  };
}

describe("buildFileTree", () => {
  it("nests files under directory segments and rolls up counts", () => {
    const files = [
      file({ canonicalPath: "/repo/src/a.ts", relativePath: "src/a.ts" }),
      file({ canonicalPath: "/repo/src/b.ts", relativePath: "src/b.ts" }),
      file({ canonicalPath: "/repo/readme.md", relativePath: "readme.md", extension: "md" }),
    ];

    const tree = buildFileTree(files, new Set());
    expect(tree).toHaveLength(1);

    const root = tree[0];
    expect(root.totalFileCount).toBe(3);
    expect(root.children.map((c) => c.name).sort()).toEqual(["readme.md", "src"]);

    const srcDir = root.children.find((c) => c.name === "src")!;
    expect(srcDir.totalFileCount).toBe(2);
    expect(srcDir.children).toHaveLength(2);
  });

  it("computes tri-state selection counts", () => {
    const files = [
      file({ canonicalPath: "/repo/src/a.ts", relativePath: "src/a.ts" }),
      file({ canonicalPath: "/repo/src/b.ts", relativePath: "src/b.ts" }),
    ];

    const noneSelected = buildFileTree(files, new Set())[0];
    expect(checkState(noneSelected)).toBe("unchecked");

    const partiallySelected = buildFileTree(files, new Set(["/repo/src/a.ts"]))[0];
    expect(checkState(partiallySelected)).toBe("indeterminate");

    const allSelected = buildFileTree(
      files,
      new Set(["/repo/src/a.ts", "/repo/src/b.ts"]),
    )[0];
    expect(checkState(allSelected)).toBe("checked");
  });

  it("collects descendant canonical file paths", () => {
    const files = [
      file({ canonicalPath: "/repo/src/a.ts", relativePath: "src/a.ts" }),
      file({ canonicalPath: "/repo/src/nested/b.ts", relativePath: "src/nested/b.ts" }),
    ];
    const root = buildFileTree(files, new Set())[0];
    const srcDir = root.children[0];
    expect(collectDescendantFiles(srcDir).sort()).toEqual(
      ["/repo/src/a.ts", "/repo/src/nested/b.ts"].sort(),
    );
  });
});

describe("flattenTree", () => {
  it("only includes children of expanded directories", () => {
    const files = [file({ canonicalPath: "/repo/src/a.ts", relativePath: "src/a.ts" })];
    const tree = buildFileTree(files, new Set());

    const collapsed = flattenTree(tree, new Set());
    expect(collapsed).toHaveLength(1);

    const expanded = flattenTree(tree, new Set([tree[0].id, tree[0].children[0].id]));
    expect(expanded.length).toBeGreaterThan(1);
  });
});

describe("searchExpansionIds", () => {
  it("marks ancestors of matching files for expansion", () => {
    const files = [
      file({ canonicalPath: "/repo/src/deep/target.ts", relativePath: "src/deep/target.ts" }),
      file({ canonicalPath: "/repo/src/other.ts", relativePath: "src/other.ts" }),
    ];
    const tree = buildFileTree(files, new Set());
    const ids = searchExpansionIds(tree, "target");

    expect(ids.has(tree[0].id)).toBe(true);
    const srcDir = tree[0].children.find((c) => c.name === "src")!;
    expect(ids.has(srcDir.id)).toBe(true);
    const deepDir = srcDir.children.find((c) => c.name === "deep")!;
    expect(ids.has(deepDir.id)).toBe(true);
  });

  it("returns an empty set for a blank query", () => {
    const tree = buildFileTree([file({})], new Set());
    expect(searchExpansionIds(tree, "  ").size).toBe(0);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspaceStore } from "./workspaceStore";
import type { ScanRootResponse, WorkspaceSource } from "../api/types";

function stats(fileCount: number) {
  return {
    fileCount,
    totalLines: 0,
    totalBytes: 0,
    truncatedCount: 0,
    skippedCount: 0,
    durationMs: 0,
  };
}

function scanResponse(rootId: string, root: string, files: ScanRootResponse["files"]): ScanRootResponse {
  return { rootId, root, files, errors: [], stats: stats(files.length), exitCode: 0, stderr: "" };
}

describe("workspaceStore rescan flow", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspace: { ...useWorkspaceStore.getState().workspace, sources: [], selectedPaths: [] },
      discoveredFiles: {},
      missingSelectedPaths: [],
      scanRevision: 0,
    });
  });

  it("preserves selections that still exist after a rescan", () => {
    const source: WorkspaceSource = { kind: "directory", id: "root", path: "/repo", alias: "repo" };
    useWorkspaceStore.getState().addSources([source]);
    useWorkspaceStore.getState().replaceSelection(["/repo/a.ts"]);

    const revision = useWorkspaceStore.getState().beginScan(1);
    useWorkspaceStore.getState().applyScanResults(revision, [
      scanResponse("root", "/repo", [
        { canonicalPath: "/repo/a.ts", relativePath: "a.ts", extension: "ts", sizeBytes: 10 },
        { canonicalPath: "/repo/b.ts", relativePath: "b.ts", extension: "ts", sizeBytes: 20 },
      ]),
    ]);

    expect(useWorkspaceStore.getState().workspace.selectedPaths).toEqual(["/repo/a.ts"]);
    expect(useWorkspaceStore.getState().missingSelectedPaths).toEqual([]);
    expect(Object.keys(useWorkspaceStore.getState().discoveredFiles)).toHaveLength(2);
  });

  it("flags selected files that disappear from the scan as missing, without removing them", () => {
    const source: WorkspaceSource = { kind: "directory", id: "root", path: "/repo", alias: "repo" };
    useWorkspaceStore.getState().addSources([source]);
    useWorkspaceStore.getState().replaceSelection(["/repo/a.ts", "/repo/gone.ts"]);

    const revision = useWorkspaceStore.getState().beginScan(1);
    useWorkspaceStore.getState().applyScanResults(revision, [
      scanResponse("root", "/repo", [
        { canonicalPath: "/repo/a.ts", relativePath: "a.ts", extension: "ts", sizeBytes: 10 },
      ]),
    ]);

    expect(useWorkspaceStore.getState().missingSelectedPaths).toEqual(["/repo/gone.ts"]);
    expect(useWorkspaceStore.getState().workspace.selectedPaths).toContain("/repo/gone.ts");

    useWorkspaceStore.getState().removeMissingSelections();
    expect(useWorkspaceStore.getState().workspace.selectedPaths).toEqual(["/repo/a.ts"]);
    expect(useWorkspaceStore.getState().missingSelectedPaths).toEqual([]);
  });

  it("ignores stale scan results from a superseded revision", () => {
    useWorkspaceStore.getState().beginScan(1);
    const staleRevision = 1;
    useWorkspaceStore.getState().beginScan(2);

    useWorkspaceStore.getState().applyScanResults(staleRevision, [
      scanResponse("root", "/repo", [
        { canonicalPath: "/repo/a.ts", relativePath: "a.ts", extension: "ts", sizeBytes: 10 },
      ]),
    ]);

    expect(Object.keys(useWorkspaceStore.getState().discoveredFiles)).toHaveLength(0);
  });

  it("assigns a discovered file to the most specific (deepest) owning source", () => {
    const outer: WorkspaceSource = { kind: "directory", id: "outer", path: "/work/repo", alias: "repo" };
    const inner: WorkspaceSource = {
      kind: "directory",
      id: "inner",
      path: "/work/repo/services/backend",
      alias: "backend",
    };
    useWorkspaceStore.getState().addSources([outer, inner]);

    const revision = useWorkspaceStore.getState().beginScan(1);
    useWorkspaceStore.getState().applyScanResults(revision, [
      scanResponse("inner", "/work/repo/services/backend", [
        {
          canonicalPath: "/work/repo/services/backend/src/main.rs",
          relativePath: "src/main.rs",
          extension: "rs",
          sizeBytes: 10,
        },
      ]),
    ]);

    const [file] = Object.values(useWorkspaceStore.getState().discoveredFiles);
    expect(file.sourceAlias).toBe("backend");
    expect(file.displayPath).toBe("backend/src/main.rs");
  });
});

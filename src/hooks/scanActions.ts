import { canonicalizeSources, scanRoot } from "../api/commands";
import type { DiscoveredFile, ScanRootRequest, ScanRootResponse } from "../api/types";
import { useWorkspaceStore } from "../state/workspaceStore";

const MAX_CONCURRENT_SCANS = 4;

async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function next(): Promise<void> {
    const index = cursor;
    cursor += 1;
    if (index >= items.length) return;

    results[index] = await worker(items[index]);
    await next();
  }

  await Promise.all(new Array(Math.min(limit, items.length)).fill(null).map(() => next()));
  return results;
}

export async function scanWorkspace(): Promise<void> {
  const store = useWorkspaceStore.getState();
  const { workspace } = store;

  const revision = store.scanRevision + 1;
  store.beginScan(revision);

  const directorySources = workspace.sources.filter((source) => source.kind === "directory");
  const fileSources = workspace.sources.filter((source) => source.kind === "file");

  const scanResults = await runWithConcurrencyLimit(
    directorySources,
    MAX_CONCURRENT_SCANS,
    async (source): Promise<ScanRootResponse> => {
      const request: ScanRootRequest = {
        operationId: crypto.randomUUID(),
        rootId: source.id,
        root: source.path,
        config: workspace.activeConfig,
        filters: workspace.filters,
      };

      return scanRoot(request);
    },
  );

  if (fileSources.length > 0) {
    const canonical = await canonicalizeSources(fileSources.map((source) => source.path));

    const filesByRoot = new Map<string, DiscoveredFile[]>();
    for (const [index, entry] of canonical.entries()) {
      const source = fileSources[index];
      if (!entry.isFile) continue;

      const bucket = filesByRoot.get(source.id) ?? [];
      bucket.push({
        canonicalPath: entry.canonical,
        relativePath: entry.canonical.split(/[\\/]/).at(-1) ?? entry.canonical,
        extension: entry.canonical.split(".").at(-1) ?? "",
        sizeBytes: 0,
      });
      filesByRoot.set(source.id, bucket);
    }

    for (const source of fileSources) {
      scanResults.push({
        rootId: source.id,
        root: source.path,
        files: filesByRoot.get(source.id) ?? [],
        errors: [],
        stats: {
          fileCount: filesByRoot.get(source.id)?.length ?? 0,
          totalLines: 0,
          totalBytes: 0,
          truncatedCount: 0,
          skippedCount: 0,
          durationMs: 0,
        },
        exitCode: 0,
        stderr: "",
      });
    }
  }

  if (useWorkspaceStore.getState().scanRevision !== revision) {
    return;
  }

  useWorkspaceStore.getState().applyScanResults(revision, scanResults);
}

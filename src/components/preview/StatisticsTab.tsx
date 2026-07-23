import { usePreviewStore } from "../../state/previewStore";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StatisticsTab() {
  const stats = usePreviewStore((state) => state.stats);

  if (!stats) {
    return <div className="tab-empty">No statistics yet. Generate a preview first.</div>;
  }

  return (
    <dl className="stats-grid">
      <dt>Files</dt>
      <dd>{stats.fileCount}</dd>
      <dt>Original lines</dt>
      <dd>{stats.totalLines.toLocaleString()}</dd>
      <dt>Original size</dt>
      <dd>{formatBytes(stats.totalBytes)}</dd>
      <dt>Truncated files</dt>
      <dd>{stats.truncatedCount}</dd>
      <dt>Skipped files</dt>
      <dd>{stats.skippedCount}</dd>
      <dt>Estimated tokens</dt>
      <dd>{stats.tokenEstimate?.toLocaleString() ?? "n/a"}</dd>
      <dt>Duration</dt>
      <dd>{stats.durationMs} ms</dd>
    </dl>
  );
}

import { useMemo } from "react";
import { usePreviewStore } from "../../state/previewStore";
import {
  renderSafeMarkdown,
  RENDERED_MARKDOWN_LIMIT,
} from "../../utils/markdown";

export function MarkdownTab() {
  const content = usePreviewStore((state) => state.content);
  const format = usePreviewStore((state) => state.format);
  const status = usePreviewStore((state) => state.status);
  const errorMessage = usePreviewStore((state) => state.errorMessage);

  const byteLength = useMemo(
    () => new TextEncoder().encode(content).length,
    [content],
  );

  const canRender =
    format === "markdown" && byteLength <= RENDERED_MARKDOWN_LIMIT;

  const safeHtml = useMemo(
    () => (canRender ? renderSafeMarkdown(content) : ""),
    [canRender, content],
  );

  if (status === "empty") {
    return (
      <div className="tab-empty">
        Generate Markdown output to view the formatted document.
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="tab-error">
        {errorMessage ?? "Generation failed."}
      </div>
    );
  }

  if (format !== "markdown") {
    return (
      <div className="tab-empty">
        Formatted Markdown is only available when the output format is Markdown.
      </div>
    );
  }

  if (!canRender) {
    return (
      <div className="tab-empty">
        This Markdown document is too large to render safely ({(byteLength / (1024 * 1024)).toFixed(1)} MB). Use the Preview tab or save it to a file.
      </div>
    );
  }

  return (
    <div className="markdown-tab" role="tabpanel">
      <div className="preview-tab__toolbar">
        {status === "stale" && (
          <span className="badge badge--stale">
            Stale — regenerate to update
          </span>
        )}
        {status === "partial" && (
          <span className="badge badge--warning">Partial result</span>
        )}
        {status === "generating" && <span className="badge">Generating…</span>}
      </div>

      <article
        className="markdown-document"
        // The result is sanitized by DOMPurify in renderSafeMarkdown.
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </div>
  );
}
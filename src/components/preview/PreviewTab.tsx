import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { markdown as markdownLang } from "@codemirror/lang-markdown";
import { xml as xmlLang } from "@codemirror/lang-xml";
import { usePreviewStore } from "../../state/previewStore";
import { useUiSettingsStore } from "../../state/uiSettingsStore";
import { createEditorTheme } from "../../utils/editorTheme";
import { EDITOR_WARNING_LIMIT } from "../../utils/markdown";

export function PreviewTab() {
  const content = usePreviewStore((state) => state.content);
  const format = usePreviewStore((state) => state.format);
  const status = usePreviewStore((state) => state.status);
  const errorMessage = usePreviewStore((state) => state.errorMessage);

  const editorLineWrapping = useUiSettingsStore(
    (state) => state.editorLineWrapping,
  );

  const extensions = useMemo(() => {
    const result: Extension[] = [];

    if (format === "markdown") {
      result.push(markdownLang());
    } else if (format === "xml") {
      result.push(xmlLang());
    }

    if (editorLineWrapping) {
      result.push(EditorView.lineWrapping);
    }

    result.push(createEditorTheme());

    return result;
  }, [format, editorLineWrapping]);

  const byteLength = new TextEncoder().encode(content).length;
  const showEditorWarning = byteLength > EDITOR_WARNING_LIMIT;

  if (status === "empty") {
    return <div className="tab-empty">Select files and click Generate to build a preview.</div>;
  }

  if (status === "error") {
    return <div className="tab-error">{errorMessage ?? "Generation failed."}</div>;
  }

  return (
    <div className="preview-tab">
      <div className="preview-tab__toolbar">
        {status === "stale" && (
          <span className="badge badge--stale">Stale — regenerate to update</span>
        )}
        {status === "partial" && (
          <span className="badge badge--warning">Partial result</span>
        )}
        {status === "generating" && <span className="badge">Generating…</span>}
      </div>

      {showEditorWarning && (
        <p className="warning">
          This preview is large ({(byteLength / (1024 * 1024)).toFixed(1)} MB). Consider using Save
          Context instead of viewing it in full.
        </p>
      )}

      <div className="preview-tab__editor">
        <CodeMirror
          value={content}
          editable={false}
          extensions={extensions}
          height="100%"
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: false,
          }}
        />
      </div>
    </div>
  );
}

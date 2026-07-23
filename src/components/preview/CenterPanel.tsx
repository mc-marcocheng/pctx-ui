import { useState } from "react";
import { PreviewTab } from "./PreviewTab";
import { MarkdownTab } from "./MarkdownTab";
import { StatisticsTab } from "./StatisticsTab";
import { ErrorsTab } from "./ErrorsTab";
import { usePreviewStore } from "../../state/previewStore";

type TabId = "preview" | "markdown" | "statistics" | "errors";

export function CenterPanel() {
  const [tab, setTab] = useState<TabId>("preview");
  const errorCount = usePreviewStore((state) => state.errors.length);

  return (
    <main className="center-panel">
      <nav className="center-panel__tabs" role="tablist" aria-label="Generated context">
        <button
          role="tab"
          aria-selected={tab === "preview"}
          className={tab === "preview" ? "active" : ""}
          onClick={() => setTab("preview")}
        >
          Preview
        </button>

        <button
          role="tab"
          aria-selected={tab === "markdown"}
          className={tab === "markdown" ? "active" : ""}
          onClick={() => setTab("markdown")}
        >
          Markdown
        </button>

        <button
          role="tab"
          aria-selected={tab === "statistics"}
          className={tab === "statistics" ? "active" : ""}
          onClick={() => setTab("statistics")}
        >
          Statistics
        </button>

        <button
          role="tab"
          aria-selected={tab === "errors"}
          className={tab === "errors" ? "active" : ""}
          onClick={() => setTab("errors")}
        >
          Errors {errorCount > 0 && <span className="badge badge--count">{errorCount}</span>}
        </button>
      </nav>
      <div className="center-panel__content">
        {tab === "preview" && <PreviewTab />}
        {tab === "markdown" && <MarkdownTab />}
        {tab === "statistics" && <StatisticsTab />}
        {tab === "errors" && <ErrorsTab />}
      </div>
    </main>
  );
}

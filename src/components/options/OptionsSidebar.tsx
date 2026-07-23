import { useWorkspaceStore } from "../../state/workspaceStore";
import { usePreviewStore } from "../../state/previewStore";
import type { OutputFormat } from "../../api/types";
import { parsePatternLines, validatePatternList } from "../../utils/patterns";
import { ConfigurationOptions } from "./ConfigurationOptions";

export function OptionsSidebar() {
  const workspace = useWorkspaceStore((state) => state.workspace);
  const updateFilters = useWorkspaceStore((state) => state.updateFilters);
  const updateTruncation = useWorkspaceStore((state) => state.updateTruncation);
  const updateOutput = useWorkspaceStore((state) => state.updateOutput);
  const markStale = usePreviewStore((state) => state.markStale);

  const includeIssues = validatePatternList(workspace.filters.include.join("\n"));
  const excludeIssues = validatePatternList(workspace.filters.exclude.join("\n"));

  function changeFilters(patch: Parameters<typeof updateFilters>[0]) {
    updateFilters(patch);
    markStale();
  }

  function changeTruncation(patch: Parameters<typeof updateTruncation>[0]) {
    updateTruncation(patch);
    markStale();
  }

  function changeOutput(patch: Parameters<typeof updateOutput>[0]) {
    updateOutput(patch);
    markStale();
  }

  return (
    <aside className="options-sidebar">
      <section className="options-section">
        <h2>Output</h2>
        <label>
          Format
          <select
            value={workspace.output.format}
            onChange={(event) => changeOutput({ format: event.target.value as OutputFormat })}
          >
            <option value="markdown">Markdown</option>
            <option value="xml">XML</option>
            <option value="plain">Plain</option>
          </select>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={workspace.output.tree}
            onChange={(event) => changeOutput({ tree: event.target.checked })}
          />
          Include file tree
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={workspace.output.absolutePaths}
            onChange={(event) => changeOutput({ absolutePaths: event.target.checked })}
          />
          Absolute paths
        </label>
      </section>

      <details className="options-disclosure">
        <summary>Token settings</summary>
        <div className="options-disclosure__body">
          <label>
            Token model
            <input
              type="text"
              value={workspace.output.tokenModel}
              onChange={(event) => changeOutput({ tokenModel: event.target.value })}
            />
          </label>
        </div>
      </details>

      <section className="options-section">
        <h2>Discovery</h2>
        <label>
          Max size (KB)
          <input
            type="number"
            min={0}
            value={workspace.filters.maxSizeKb}
            onChange={(event) => changeFilters({ maxSizeKb: Number(event.target.value) })}
          />
        </label>
        <label>
          Max depth
          <input
            type="number"
            min={0}
            value={workspace.filters.maxDepth}
            onChange={(event) => changeFilters({ maxDepth: Number(event.target.value) })}
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={workspace.filters.hidden}
            onChange={(event) => changeFilters({ hidden: event.target.checked })}
          />
          Include hidden files
        </label>
        <p className="options-help">Rescan after changing discovery settings.</p>
      </section>

      <details className="options-disclosure">
        <summary>Advanced discovery filters</summary>
        <div className="options-disclosure__body">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={workspace.filters.noDefaultExcludes}
              onChange={(event) => changeFilters({ noDefaultExcludes: event.target.checked })}
            />
            Disable default excludes
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={workspace.filters.noGitignore}
              onChange={(event) => changeFilters({ noGitignore: event.target.checked })}
            />
            Ignore .gitignore
          </label>
          <label>
            Include patterns (one per line)
            <textarea
              rows={3}
              value={workspace.filters.include.join("\n")}
              onChange={(event) => changeFilters({ include: parsePatternLines(event.target.value) })}
            />
          </label>
          <PatternIssues issues={includeIssues} />
          <label>
            Exclude patterns (one per line)
            <textarea
              rows={3}
              value={workspace.filters.exclude.join("\n")}
              onChange={(event) => changeFilters({ exclude: parsePatternLines(event.target.value) })}
            />
          </label>
          <PatternIssues issues={excludeIssues} />
          <p className="muted">Patterns apply relative to each workspace root. Rescan is disabled while a pattern has an error.</p>
        </div>
      </details>

      <details className="options-disclosure">
        <summary>Configuration</summary>
        <div className="options-disclosure__body">
          <ConfigurationOptions />
        </div>
      </details>

      <details className="options-disclosure" open>
        <summary>Truncation</summary>
        <div className="options-disclosure__body">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={workspace.truncation.disabled}
              onChange={(event) => changeTruncation({ disabled: event.target.checked })}
            />
            Disable truncation
          </label>
          {!workspace.truncation.disabled && (
            <>
              <label>
                Max lines
                <input
                  type="number"
                  min={0}
                  value={workspace.truncation.maxLines}
                  onChange={(event) => changeTruncation({ maxLines: Number(event.target.value) })}
                />
              </label>
              <label>
                Head lines
                <input
                  type="number"
                  min={0}
                  value={workspace.truncation.headLines}
                  onChange={(event) => changeTruncation({ headLines: Number(event.target.value) })}
                />
              </label>
              <label>
                Tail lines
                <input
                  type="number"
                  min={0}
                  value={workspace.truncation.tailLines}
                  onChange={(event) => changeTruncation({ tailLines: Number(event.target.value) })}
                />
              </label>
              <label>
                Max line length
                <input
                  type="number"
                  min={0}
                  value={workspace.truncation.maxLineLength}
                  onChange={(event) => changeTruncation({ maxLineLength: Number(event.target.value) })}
                />
              </label>
            </>
          )}
        </div>
      </details>
    </aside>
  );
}

function PatternIssues({ issues }: { issues: { severity: "error" | "warning"; message: string }[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="pattern-issues">
      {issues.map((issue, index) => (
        <li key={index} className={`pattern-issues__${issue.severity}`}>
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

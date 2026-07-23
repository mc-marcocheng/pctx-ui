import { usePreviewStore } from "../../state/previewStore";

export function ErrorsTab() {
  const errors = usePreviewStore((state) => state.errors);

  if (errors.length === 0) {
    return <div className="tab-empty">No errors reported.</div>;
  }

  return (
    <div className="errors-tab">
      <table className="errors-table">
        <thead>
          <tr>
            <th>Path</th>
            <th>Code</th>
            <th>Message</th>
            <th>Transient</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((error, index) => (
            <tr key={`${error.path}-${index}`}>
              <td>{error.path || "—"}</td>
              <td>
                <code>{error.code}</code>
              </td>
              <td>{error.message}</td>
              <td>{error.transient ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

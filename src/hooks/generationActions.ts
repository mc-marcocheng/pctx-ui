import { chooseOutputPath } from "../api/dialogs";
import { generateContext, normalizeInvokeError } from "../api/commands";
import type { GenerateRequest } from "../api/types";
import { buildGenerationAliases } from "../utils/aliases";
import { useOperationStore } from "../state/operationStore";
import { usePreviewStore } from "../state/previewStore";
import { useSettingsStore } from "../state/settingsStore";
import { useWorkspaceStore } from "../state/workspaceStore";
import { generationFingerprint } from "../utils/workspaceSchema";

function buildBaseRequest(operationId: string): GenerateRequest {
  const workspace = useWorkspaceStore.getState().workspace;

  return {
    operationId,
    selectedPaths: workspace.selectedPaths,
    aliases: buildGenerationAliases(workspace.sources, workspace.selectedPaths),
    filters: { maxSizeKb: workspace.filters.maxSizeKb },
    truncation: workspace.truncation,
    output: workspace.output,
    destination: { kind: "preview" },
  };
}

export async function generatePreview(): Promise<void> {
  const workspace = useWorkspaceStore.getState().workspace;
  const preview = usePreviewStore.getState();

  if (workspace.selectedPaths.length === 0) {
    preview.fail("Select at least one file.");
    return;
  }

  const operationId = crypto.randomUUID();
  const fingerprint = generationFingerprint(workspace);

  useOperationStore.getState().start({
    id: operationId,
    kind: "preview",
    startedAt: Date.now(),
    message: "Generating preview…",
  });

  preview.begin();

  try {
    const request = buildBaseRequest(operationId);
    const response = await generateContext(request);
    usePreviewStore.getState().complete(response, fingerprint);

    const currentWorkspace = useWorkspaceStore.getState().workspace;
    if (generationFingerprint(currentWorkspace) !== fingerprint) {
      usePreviewStore.getState().markStale();
    }
  } catch (error) {
    usePreviewStore.getState().fail(normalizeInvokeError(error).message);
  } finally {
    useOperationStore.getState().finish(operationId);
  }
}

export async function copyContext(): Promise<{ ok: boolean; message: string }> {
  const workspace = useWorkspaceStore.getState().workspace;
  const engine = useSettingsStore.getState().engine;

  if (!engine?.capabilities.clipboard) {
    return {
      ok: false,
      message: "This pctx build does not include clipboard support. Use Save Context instead.",
    };
  }

  if (workspace.selectedPaths.length === 0) {
    return { ok: false, message: "Select at least one file." };
  }

  const operationId = crypto.randomUUID();

  useOperationStore.getState().start({
    id: operationId,
    kind: "copy",
    startedAt: Date.now(),
    message: "Copying context…",
  });

  try {
    const request: GenerateRequest = {
      ...buildBaseRequest(operationId),
      destination: { kind: "clipboard" },
    };

    const response = await generateContext(request);

    if (response.status === "error") {
      return { ok: false, message: response.errors[0]?.message ?? "Copy failed." };
    }

    return {
      ok: true,
      message:
        response.status === "partial"
          ? `Context copied with ${response.errors.length} file errors.`
          : "Context copied.",
    };
  } catch (error) {
    return { ok: false, message: normalizeInvokeError(error).message };
  } finally {
    useOperationStore.getState().finish(operationId);
  }
}

export async function saveContext(
  confirmOverwrite: (path: string) => Promise<boolean>,
): Promise<{ ok: boolean; message: string } | null> {
  const workspace = useWorkspaceStore.getState().workspace;

  if (workspace.selectedPaths.length === 0) {
    return { ok: false, message: "Select at least one file." };
  }

  const outputPath = await chooseOutputPath(workspace.output.format);
  if (!outputPath) return null;

  let force = false;

  while (true) {
    const operationId = crypto.randomUUID();

    useOperationStore.getState().start({
      id: operationId,
      kind: "save",
      startedAt: Date.now(),
      message: "Saving context…",
    });

    try {
      const request: GenerateRequest = {
        ...buildBaseRequest(operationId),
        destination: {
          kind: "file",
          path: outputPath,
          force,
        },
      };

      const response = await generateContext(request);
      const outputExists = response.errors.some(
        (error) => error.code === "output_exists",
      );

      if (outputExists) {
        const overwrite = await confirmOverwrite(outputPath);
        if (!overwrite) return null;

        force = true;
        continue;
      }

      if (response.status === "error") {
        return {
          ok: false,
          message: response.errors[0]?.message ?? "Save failed.",
        };
      }

      return {
        ok: true,
        message:
          response.status === "partial"
            ? `Context saved with ${response.errors.length} file errors.`
            : "Context saved.",
      };
    } catch (error) {
      return {
        ok: false,
        message: normalizeInvokeError(error).message,
      };
    } finally {
      useOperationStore.getState().finish(operationId);
    }
  }
}

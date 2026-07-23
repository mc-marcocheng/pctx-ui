import { open, save } from "@tauri-apps/plugin-dialog";
import type { OutputFormat } from "./types";

export async function chooseDirectory(): Promise<string | null> {
  const result = await open({
    directory: true,
    multiple: false,
    title: "Add workspace directory",
  });

  return typeof result === "string" ? result : null;
}

export async function chooseFiles(): Promise<string[]> {
  const result = await open({
    directory: false,
    multiple: true,
    title: "Add files",
  });

  if (!result) return [];
  return Array.isArray(result) ? result : [result];
}

export async function chooseOutputPath(format: OutputFormat): Promise<string | null> {
  const extension = format === "markdown" ? "md" : format === "xml" ? "xml" : "txt";

  return save({
    title: "Save generated context",
    defaultPath: `context.${extension}`,
    filters: [{ name: "Context", extensions: [extension] }],
  });
}

export async function chooseExternalEngine(): Promise<string | null> {
  const result = await open({
    directory: false,
    multiple: false,
    title: "Select pctx executable",
  });

  return typeof result === "string" ? result : null;
}

export async function chooseConfigFile(): Promise<string | null> {
  const result = await open({
    directory: false,
    multiple: false,
    title: "Select pctx config file",
    filters: [{ name: "pctx config", extensions: ["toml"] }],
  });

  return typeof result === "string" ? result : null;
}

export async function chooseWorkspaceFile(): Promise<string | null> {
  const result = await open({
    directory: false,
    multiple: false,
    title: "Import workspace",
    filters: [{ name: "pctx workspace", extensions: ["json"] }],
  });

  return typeof result === "string" ? result : null;
}

export async function chooseWorkspaceExportPath(name: string): Promise<string | null> {
  return save({
    title: "Export workspace",
    defaultPath: `${name}.pctx-workspace.json`,
    filters: [{ name: "pctx workspace", extensions: ["json"] }],
  });
}

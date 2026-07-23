import { z } from "zod";

export const statsSchema = z.object({
  fileCount: z.number().int().nonnegative(),
  totalLines: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  truncatedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  tokenEstimate: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().nonnegative(),
});

export const fileErrorSchema = z.object({
  path: z.string(),
  code: z.string(),
  message: z.string(),
  transient: z.boolean(),
});

export const filterSettingsSchema = z.object({
  exclude: z.array(z.string()),
  include: z.array(z.string()),
  hidden: z.boolean(),
  noDefaultExcludes: z.boolean(),
  noGitignore: z.boolean(),
  maxSizeKb: z.number().int().positive(),
  maxDepth: z.number().int().positive(),
});

export const truncationSettingsSchema = z.object({
  disabled: z.boolean(),
  maxLines: z.number().int().nonnegative(),
  headLines: z.number().int().nonnegative(),
  tailLines: z.number().int().nonnegative(),
  maxLineLength: z.number().int().nonnegative(),
  headChars: z.number().int().nonnegative(),
  tailChars: z.number().int().nonnegative(),
});

export const outputSettingsSchema = z.object({
  format: z.enum(["markdown", "xml", "plain"]),
  tree: z.boolean(),
  absolutePaths: z.boolean(),
  tokenModel: z.string(),
});

export const workspaceSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("directory"), id: z.string(), path: z.string(), alias: z.string() }),
  z.object({ kind: z.literal("file"), id: z.string(), path: z.string(), alias: z.string() }),
]);

export const configSelectionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }),
  z.object({ mode: z.literal("file"), path: z.string() }),
]);

export const workspaceSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  name: z.string(),
  sources: z.array(workspaceSourceSchema),
  selectedPaths: z.array(z.string()),
  activeConfig: configSelectionSchema,
  filters: filterSettingsSchema,
  truncation: truncationSettingsSchema,
  output: outputSettingsSchema,
  tokenBudget: z.number().int().positive().optional(),
});

export type WorkspaceSchema = z.infer<typeof workspaceSchema>;

export interface PatternIssue {
  severity: "error" | "warning";
  message: string;
}

export function validatePattern(pattern: string): PatternIssue[] {
  const issues: PatternIssue[] = [];
  const value = pattern.trim();

  if (!value) {
    return issues;
  }

  if (value.includes("\0")) {
    issues.push({ severity: "error", message: "Pattern cannot contain a NUL character." });
  }

  if (value.startsWith("!")) {
    issues.push({ severity: "error", message: "Negation patterns are not supported." });
  }

  if (value.startsWith("./") || value.startsWith(".\\")) {
    issues.push({
      severity: "warning",
      message: "Remove the leading ./; patterns are relative to each root.",
    });
  }

  if (/^([a-zA-Z]:[\\/]|[\\/])/.test(value)) {
    issues.push({
      severity: "warning",
      message: "Absolute paths are not supported as patterns; use a relative pattern instead.",
    });
  }

  const opening = [...value].filter((character) => character === "[").length;
  const closing = [...value].filter((character) => character === "]").length;

  if (opening !== closing) {
    issues.push({ severity: "error", message: "Character class brackets are unbalanced." });
  }

  if (value.endsWith("\\") && !value.endsWith("\\\\")) {
    issues.push({ severity: "error", message: "Pattern ends with a lone escape character." });
  }

  return issues;
}

export function parsePatternLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function validatePatternList(text: string): PatternIssue[] {
  return parsePatternLines(text).flatMap(validatePattern);
}

export function hasPatternErrors(patterns: string[]): boolean {
  return patterns.some((pattern) => validatePattern(pattern).some((issue) => issue.severity === "error"));
}


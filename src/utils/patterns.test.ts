import { describe, expect, it } from "vitest";
import { parsePatternLines, validatePattern, validatePatternList } from "./patterns";

describe("validatePattern", () => {
  it("allows a normal glob pattern", () => {
    expect(validatePattern("**/*.snap")).toEqual([]);
  });

  it("flags negation patterns as an error", () => {
    const issues = validatePattern("!node_modules");
    expect(issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("warns on a leading ./", () => {
    const issues = validatePattern("./src/**");
    expect(issues.some((i) => i.severity === "warning")).toBe(true);
  });

  it("flags unbalanced character classes", () => {
    const issues = validatePattern("foo[bar");
    expect(issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("flags a lone trailing escape", () => {
    const issues = validatePattern("foo\\");
    expect(issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("ignores blank lines", () => {
    expect(validatePattern("   ")).toEqual([]);
  });
});

describe("parsePatternLines / validatePatternList", () => {
  it("trims and drops blank lines", () => {
    expect(parsePatternLines("*.ts\n\n  __tests__/  \n")).toEqual(["*.ts", "__tests__/"]);
  });

  it("aggregates issues across all lines", () => {
    const issues = validatePatternList("*.ts\n!bad\nfoo[bar");
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
});

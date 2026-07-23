import { describe, expect, it } from "vitest";
import { parseCustomTheme } from "./uiSettingsStore";

describe("parseCustomTheme", () => {
  it("accepts a simple custom theme", () => {
    expect(
      parseCustomTheme({
        schemaVersion: 1,
        name: "Test",
        mode: "dark",
        colors: {
          bg: "#111111",
          text: "#ffffff",
        },
      }),
    ).toEqual({
      schemaVersion: 1,
      name: "Test",
      mode: "dark",
      colors: {
        bg: "#111111",
        text: "#ffffff",
      },
    });
  });

  it("rejects unknown tokens", () => {
    expect(() =>
      parseCustomTheme({
        schemaVersion: 1,
        name: "Test",
        mode: "dark",
        colors: {
          "unknown-token": "#ffffff",
        },
      }),
    ).toThrow("Unknown theme color token");
  });

  it("rejects unsafe CSS values", () => {
    expect(() =>
      parseCustomTheme({
        schemaVersion: 1,
        name: "Test",
        mode: "dark",
        colors: {
          bg: "red; background-image: url(test)",
        },
      }),
    ).toThrow("Invalid CSS color");
  });

  it("rejects missing schema version", () => {
    expect(() =>
      parseCustomTheme({
        name: "Test",
        mode: "dark",
        colors: {
          bg: "#111111",
        },
      }),
    ).toThrow("Unsupported theme schema version");
  });

  it("rejects empty name", () => {
    expect(() =>
      parseCustomTheme({
        schemaVersion: 1,
        name: "  ",
        mode: "dark",
        colors: {
          bg: "#111111",
        },
      }),
    ).toThrow("The theme must have a non-empty name");
  });

  it("rejects invalid mode", () => {
    expect(() =>
      parseCustomTheme({
        schemaVersion: 1,
        name: "Test",
        mode: "invalid",
        colors: {
          bg: "#111111",
        },
      }),
    ).toThrow('Theme mode must be either "light" or "dark"');
  });

  it("rejects missing colors object", () => {
    expect(() =>
      parseCustomTheme({
        schemaVersion: 1,
        name: "Test",
        mode: "dark",
        colors: null,
      }),
    ).toThrow("Theme colors must be a JSON object");
  });

  it("rejects empty colors", () => {
    expect(() =>
      parseCustomTheme({
        schemaVersion: 1,
        name: "Test",
        mode: "dark",
        colors: {},
      }),
    ).toThrow("The theme must override at least one color");
  });

  it("accepts valid CSS color formats", () => {
    expect(
      parseCustomTheme({
        schemaVersion: 1,
        name: "Test",
        mode: "dark",
        colors: {
          bg: "#111",
          surface: "#111111",
          "surface-raised": "rgb(20, 20, 20)",
          "surface-subtle": "rgba(30, 30, 30, 0.5)",
          "surface-hover": "hsl(0, 0%, 15%)",
          text: "hsla(0, 0%, 100%, 0.9)",
          primary: "blue",
        },
      }),
    ).toEqual({
      schemaVersion: 1,
      name: "Test",
      mode: "dark",
      colors: {
        bg: "#111",
        surface: "#111111",
        "surface-raised": "rgb(20, 20, 20)",
        "surface-subtle": "rgba(30, 30, 30, 0.5)",
        "surface-hover": "hsl(0, 0%, 15%)",
        text: "hsla(0, 0%, 100%, 0.9)",
        primary: "blue",
      },
    });
  });
});
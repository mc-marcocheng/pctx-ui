# Contributing

Thanks for helping improve `pctx-ui`.

This project is a Tauri desktop app with a React/TypeScript frontend and a Rust backend that wraps the `pctx` engine.

## Getting Started

### Prerequisites

Install:

- Node.js and npm
- Rust stable
- Platform-specific Tauri dependencies
- A compatible `pctx` binary: `>= 1.1.0, < 2.0.0`

You can install `pctx` with:

```bash
cargo install pctx
```

Or use a local checkout/build and point `pctx-ui` at it:

```bash
PCTX_BIN=/path/to/pctx npm run tauri dev
```

### Local Setup

```bash
git clone https://github.com/mc-marcocheng/pctx-ui.git
cd pctx-ui
npm install
npm run tauri dev
```

If the app cannot find `pctx`, use the in-app engine picker or set `PCTX_BIN`.

## Project Structure

```text
src/                  React/TypeScript frontend
src/api/              Tauri command wrappers and shared API types
src/components/       UI components
src/hooks/            Cross-store actions such as scanning and generation
src/state/            Zustand stores
src/utils/            Frontend utilities and validation
src-tauri/src/        Rust backend
src-tauri/src/commands/ Tauri commands exposed to the frontend
src-tauri/src/engine/   Engine discovery, args, protocol, and process runner
src-tauri/src/models/   Shared Rust data models
src-tauri/tests/        Real-engine contract tests
scripts/                Release/build helper scripts (bundled-engine prep, version checks, artifact collection)
bundled-pctx.json       Pinned version/tag/asset manifest for the bundled pctx engine
.github/workflows/      CI and release automation
```

## Development Guidelines

### Frontend

- Prefer small, focused React components.
- Keep long-running or cross-store behavior in `src/hooks`.
- Keep pure logic in `src/utils` and add tests where practical.
- Use Zustand stores for app state; avoid duplicating derived state when it can be computed.
- Treat workspace files and imported theme files as untrusted input.
- Do not render unsanitized HTML.

### Backend

- Keep Tauri command inputs/outputs serializable and camelCase-compatible with the frontend.
- Return structured `CommandError` values with stable `code` strings.
- Avoid blocking the async runtime for long-running operations.
- Register cancellable engine operations when invoking `pctx`.
- Enforce output/stderr limits when running external processes.
- Do not trust paths from imported workspaces without validation/canonicalization.

### Engine Compatibility

The UI expects a `pctx` engine with:

- JSON output support
- NUL-delimited stdin support
- Path alias support
- Capability schema version `1`
- Version `>= 1.1.0, < 2.0.0`

If engine behavior changes, update:

- `src/api/types.ts`
- `src-tauri/src/models/`
- `src-tauri/src/engine/args.rs`
- contract tests in `src-tauri/tests/contract.rs`

If you're bumping the *bundled* engine version, only `bundled-pctx.json` needs to change (tag, version, asset names) — do not duplicate the version elsewhere in `scripts/` or `.github/workflows/release.yml`.

## Running Checks

Frontend tests:

```bash
npm test
```

Frontend build:

```bash
npm run build
```

Rust tests:

```bash
cd src-tauri
cargo test
```

Contract tests with a real engine:

```bash
cd src-tauri
PCTX_BIN=/path/to/pctx cargo test --test contract
```

Before opening a pull request, please run the relevant frontend and Rust tests for the area you changed.

## Pull Request Checklist

Before submitting:

- [ ] The app builds or the changed package compiles.
- [ ] Relevant tests were added or updated.
- [ ] Existing tests pass.
- [ ] UI changes are keyboard-accessible where applicable.
- [ ] New Tauri commands return structured errors.
- [ ] Workspace/theme/imported data is validated before use.
- [ ] Documentation was updated for user-visible changes.

## Reporting Bugs

Please include:

- Operating system and architecture
- `pctx-ui` version or commit
- `pctx` version: `pctx --version`
- How the engine was resolved: bundled, PATH, `PCTX_BIN`, or manually selected
- Steps to reproduce
- Expected behavior
- Actual behavior
- Diagnostics output if available

## Feature Requests

When proposing a feature, please describe:

- The user problem
- The desired workflow
- Any relevant `pctx` engine support needed
- Whether the feature affects workspace files or saved settings

## Security

Do not open public issues for sensitive security reports. Please contact the maintainers privately with reproduction details and impact.

## Code of Conduct

Be respectful and constructive. Assume good intent, explain tradeoffs clearly, and keep discussions focused on improving the project.

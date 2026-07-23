# pctx-ui

A desktop interface for [`pctx`](https://github.com/mc-marcocheng/pctx), built with Tauri, React, and TypeScript.

`pctx-ui` helps you select files from one or more workspaces, tune filtering/truncation/output settings, preview generated context, and copy or save LLM-ready output.

## Features

- Add directories or individual files as workspace sources
- Browse and bulk-select files with a virtualized file tree
- Configure include/exclude patterns, size limits, truncation, and output format
- Preview generated Markdown/XML/plain context
- Render Markdown safely for easier review
- Copy to clipboard or save generated context to disk
- Save, import, export, and restore workspaces
- Choose an external `pctx` engine or use a bundled one when available
- Diagnostics panel for engine and operation troubleshooting
- Light, dark, system, built-in, and custom themes

## Requirements

- A compatible `pctx` engine: `>= 1.1.0, < 2.0.0`
- For development:
  - Node.js/npm
  - Rust toolchain
  - Tauri system dependencies for your platform

Install the engine with:

```bash
cargo install pctx
```

Or point the app to a local engine with `PCTX_BIN` or the in-app engine picker.

## Development

```bash
npm install
npm run tauri dev
```

If `pctx` is not on your `PATH`:

```bash
PCTX_BIN=/path/to/pctx npm run tauri dev
```

## Build

```bash
npm run tauri build
```

To bundle an engine binary, place it under `src-tauri/resources/bin/` and build with the bundled Tauri config as appropriate for your release process.

## Testing

Frontend tests:

```bash
npm test
```

Rust/Tauri tests:

```bash
cd src-tauri
cargo test
```

Contract tests require a real `pctx` binary. Set `PCTX_BIN` if it is not in the expected local path:

```bash
PCTX_BIN=/path/to/pctx cargo test --test contract
```

## Useful CLI Flags

`pctx-ui` accepts startup flags such as:

```bash
pctx-ui --workspace my-workspace.pctx-workspace.json
pctx-ui /path/to/project
pctx-ui --pctx-bin /path/to/pctx
pctx-ui --no-restore
pctx-ui --diagnostics
```

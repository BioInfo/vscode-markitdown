# MarkItDown for VS Code — Project Documentation

This documentation derives from the Product Requirements Document in prd.md and defines the scope, architecture, and implementation plan for the VS Code extension that integrates the markitdown Python library to convert many formats into Markdown within the editor.

## Overview
MarkItDown for VS Code eliminates context-switching during documentation work by bringing high‑quality file‑to‑Markdown conversion into the editor via a single command and intuitive context menus.

## Goals and Objectives
- One‑click conversion of supported files into clean Markdown.
- Seamless integration with Command Palette and File Explorer context menu.
- Support the full range of formats handled by markitdown.
- Clear progress and result notifications.
- Basic configuration via VS Code settings.

## Target Audience
- Software Developers creating docs from various source materials.
- Technical Writers managing docs in VS Code.
- Content Creators and Students consolidating materials into Markdown.

## Features
### Commands and UI
- Command Palette: “MarkItDown: Convert File to Markdown”.
- File Explorer: “Convert to Markdown” on single or multiple selections.

### Supported Input Formats
- Documents: .pdf, .docx
- Presentations: .pptx
- Spreadsheets: .xlsx
- Web: .html
- Structured Data: .csv, .json, .xml
- Media: .png, .jpg, .jpeg, .gif (OCR), .mp3, .wav (audio transcription)
- Archives: .zip (recursively convert supported files within)

### Output and File Handling
- Output path: same directory as source; filename <original>.md.
- If the target exists: prompt to Overwrite or Create New (<original>-1.md, <original>-2.md, ...).
- Optional: automatically open the generated .md upon success.

### Feedback and Notifications
- Progress notification for long‑running conversions (e.g., OCR, transcription).
- Success notification with resulting filename.
- Error notification with actionable details and possible remediations.

### Configuration (Settings)
- markitdown.openFileOnSuccess (boolean, default: true)
  - Open the generated Markdown after conversion.
- markitdown.overwriteExisting (boolean, default: false)
  - If true, overwrite existing .md without prompting.

## Non‑Functional Requirements
- Performance: Efficient up to ~50MB files; comparable to markitdown CLI.
- Reliability: Robust error handling without VS Code window crashes.
- Security: Execute markitdown in a sandboxed/isolated process.
- Compatibility: Latest stable VS Code + last two major versions.

## Architecture Overview
The extension comprises a lightweight VS Code TypeScript front‑end that orchestrates user interactions and a Python subprocess that executes markitdown conversions. The two components communicate via process I/O and filesystem.

### Components
- Activation and Environment Manager
  - On first run: verify Python on PATH; set up a dedicated virtual environment; install/verify markitdown in the venv.
- Command Registrar
  - Register Command Palette and context‑menu commands.
- File Selector
  - Filter to supported extensions; handle single/multi‑select.
- Conversion Orchestrator
  - Spawn Python with markitdown to convert inputs; stream progress to VS Code UI; handle output naming policy.
- Notification & Error Handler
  - Progress notifications, success toasts, and error surfaces with diagnostics.
- Settings Bridge
  - Read settings and pass options to orchestrator (e.g., open on success, overwrite policy).

### Activation Flow
1. On activation, check Python availability; if missing, guide user to install and retry.
2. Ensure virtual environment exists under the extension storage path; create if absent.
3. Install or verify markitdown within the venv.
4. Register commands and menus.

### Conversion Flow
1. User triggers conversion from Command Palette or Explorer.
2. Extension validates file types and resolves output path.
3. VS Code shows progress UI; extension spawns the Python process in the venv.
4. Python invokes markitdown on the input; writes Markdown to the output file.
5. Extension handles collisions (overwrite or suffix strategy).
6. On success, optionally open the .md; on failure, show detailed error.

### Security and Isolation
- Conversion runs in a separate Python process within a managed venv.
- No untrusted shell interpolation; arguments are passed safely via exec APIs.
- Optionally restrict network and environment for the subprocess if needed by platform.

### Error Handling
- Categorize: Unsupported format, Corrupted file, markitdown errors, I/O errors, Python/venv missing.
- Provide remediation steps in notifications where possible.
- Log detailed diagnostics to the VS Code output channel for the extension.

## Settings Reference (settings.json)
```json
{
  "markitdown.openFileOnSuccess": true,
  "markitdown.overwriteExisting": false
}
```

## User Flows
### Command Palette
- Invoke “MarkItDown: Convert File to Markdown”.
- Select a file; conversion starts with progress.
- Result opens if configured; notifications summarize outcome.

### File Explorer (Single File)
- Right‑click a supported file; choose “Convert to Markdown”.
- Follow conversion as above.

### File Explorer (Multiple Files)
- Select multiple supported files; right‑click and convert.
- Process sequentially with per‑file notifications; summarize at end.

### Overwrite Policy
- If overwriteExisting is false and target exists, offer:
  - Overwrite existing file
  - Create new with numeric suffix
- If overwriteExisting is true, overwrite automatically.

## Dependencies
- Python (on PATH)
- markitdown Python package (installed in the extension venv)
- VS Code Extension API (TypeScript)

## Performance Considerations
- Streamed progress for large files; avoid blocking the extension host.
- Batch operations serialize conversions to control resource use.
- Compare timings against markitdown CLI as a benchmark.

## Compatibility
- Target latest VS Code; test against last two major versions.
- Cross‑platform testing: macOS, Windows, Linux.

## Roadmap (Future / V2)
- Batch Folder Conversion (convert all supported files within a folder).
- Live Preview (split view with real‑time Markdown).
- Advanced Configuration (expose richer markitdown options).
- Cloud Conversion from URL.

## Success Metrics
- Adoption: unique installs (Marketplace).
- Engagement: monthly active users.
- Satisfaction: >4.5 Marketplace rating.
- Reliability: low open bug count.

## Development Plan and Milestones
- M0: Repo/extension scaffold; CI; linting/formatting; basic docs.
- M1: Command + simple conversion (docx/pdf) via venv; success/error notifications.
- M2: Explorer context menu; progress UI for long tasks.
- M3: Full format matrix (pptx, xlsx, html, csv, json, xml, images OCR, audio transcription, zip).
- M4: Settings (open on success, overwrite policy); collision handling polish.
- M5: Packaging, signing, and Marketplace listing; basic telemetry (if any) review.
- M6: Hardening: performance, error taxonomy, cross‑platform tests.

## Testing Strategy
- Unit tests for TypeScript orchestration and path handling.
- Integration tests invoking Python subprocess on sample fixtures.
- Regression suite covering supported formats and edge cases (corrupt/unsupported).
- Large file tests up to ~50MB.

## Security Notes
- Run conversions in a sandboxed Python process; avoid shell injection.
- Validate and sanitize file paths.
- Consider limiting environment for subprocess if platform permits.

## Troubleshooting
- “Python not found”: Install Python and restart VS Code; ensure it’s on PATH.
- “Unsupported format”: Check file extension and PRD supported list.
- “Conversion failed”: See Output channel logs; try converting via markitdown CLI for comparison.

## Glossary
- markitdown: Python library that converts many formats to Markdown.
- venv: Python virtual environment isolated from global packages.
- VS Code Extension Host: The Node.js process running extension code.

## Out of Scope (v1)
- Real‑time live preview.
- Folder‑wide batch conversion (handled in V2).
- Extensive markitdown option surface beyond basics.

---

Last updated: 2025-08-21
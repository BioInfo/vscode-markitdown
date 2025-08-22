# Decision Log

This file records architectural and implementation decisions with timestamps, rationale, and implications.

## [2025-08-21 19:46:30] Architecture: TS extension orchestrates Python subprocess with managed venv
- Decision
  - Implement a two-process design: VS Code extension (TypeScript) orchestrates conversions by spawning a Python subprocess where markitdown runs inside a managed virtual environment.
- Rationale
  - Security isolation, reuse of proven markitdown library, stability of extension host, and easier cross‑platform support.
- Implementation Details
  - On activation, check Python availability; create/verify venv under extension global storage; install/verify markitdown; spawn the Python entrypoint with safe argument passing; stream progress and handle output paths.

## [2025-08-21 19:46:35] Settings: Minimal initial configuration surface
- Decision
  - Provide two settings keys:
    - markitdown.openFileOnSuccess: boolean, default true
    - markitdown.overwriteExisting: boolean, default false
- Rationale
  - Keep v1 simple while satisfying common workflows; avoid prompting fatigue with a safe default (no overwrite).
- Implementation Details
  - Read settings via VS Code API; pass choices to orchestrator; adjust post‑conversion behavior and collision handling accordingly.

## [2025-08-21 19:46:40] Output Collision Strategy: Numeric suffixing unless overwrite is enabled
- Decision
  - If overwriteExisting is false and the target exists, create <basename>-1.md, -2.md, etc.; if true, overwrite automatically.
- Rationale
  - Preserve user data by default; deterministic, simple behavior aligned with common editors.
- Implementation Details
  - Probe for existence; iterate numeric suffix until free path; reflect final path in notifications.

## [2025-08-21 19:46:45] Supported Formats Scope for v1
- Decision
  - Implement the full PRD matrix:
    - Documents: .pdf, .docx
    - Presentations: .pptx
    - Spreadsheets: .xlsx
    - Web: .html
    - Structured: .csv, .json, .xml
    - Media: .png, .jpg, .jpeg, .gif (OCR), .mp3, .wav (transcription)
    - Archives: .zip (recursive for supported files)
- Rationale
  - Align with markitdown coverage; deliver clear value across common formats in a single release.
- Implementation Details
  - Central extension-side whitelist; per-format handling delegated to markitdown; provide clear errors on unsupported types.

## [2025-08-21 19:46:50] Virtual Environment Location: Extension global storage
- Decision
  - Create and maintain the Python venv in the extension’s globalStoragePath (not in the workspace).
- Rationale
  - Keeps repos clean, avoids per-project duplication, improves portability and user experience.
- Implementation Details
  - Resolve globalStorageUri; bootstrap venv if missing; cache markitdown inside; handle upgrades on extension update.

## [2025-08-21 19:46:55] Python Detection and Invocation
- Decision
  - Attempt python3 then python; if neither found, guide the user to install Python and retry.
- Rationale
  - Cross‑platform differences; maximize out‑of‑the‑box success.
- Implementation Details
  - Probe PATH via which/where; present actionable notification with installation links if missing.

## [2025-08-21 19:47:00] Long‑Running Operations: Non‑blocking with progress UI
- Decision
  - All conversions execute asynchronously with VS Code progress notifications.
- Rationale
  - Prevent UI freezes; provide user confidence on large files, OCR, and transcription.
- Implementation Details
  - Use window.withProgress; stream stdout/stderr or estimated steps; cancelation respected where possible.

## [2025-08-21 19:47:05] Error Taxonomy and Diagnostics
- Decision
  - Normalize errors into categories: Unsupported Format, Corrupt Input, markitdown Error, I/O Error, Environment Missing.
- Rationale
  - Clear, actionable feedback improves UX and supportability.
- Implementation Details
  - Map subprocess exit codes/messages; show notifications with suggested remediations; write verbose logs to an Output channel.

---

References
- PRD: [prd.md](prd.md)
- Docs: [@docs/README.md](@docs/README.md)

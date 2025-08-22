# Product Context

This file provides a high-level overview of the project and the expected product that will be created. Initially it is based upon prd.md and all other available project-related information in the working directory. This file is intended to be updated as the project evolves, and should be used to inform all other modes of the project's goals and context.

Source: [prd.md](prd.md)

## Project Goal

- Eliminate context-switching by enabling one-click conversion of many file types to clean Markdown directly within VS Code.
- Integrate conversion into familiar VS Code surfaces (Command Palette and File Explorer).
- Provide clear progress, success, and error feedback while supporting basic configuration options.

## Key Features

- Command Palette command: “MarkItDown: Convert File to Markdown”.
- File Explorer context menu: “Convert to Markdown” for single or multiple selections.
- Supported formats:
  - Documents: .pdf, .docx
  - Presentations: .pptx
  - Spreadsheets: .xlsx
  - Web: .html
  - Structured Data: .csv, .json, .xml
  - Media: .png, .jpg, .jpeg, .gif (OCR), .mp3, .wav (audio transcription)
  - Archives: .zip (recursively convert supported files within)
- Output handling:
  - Output created alongside source as <original-filename>.md.
  - Collision policy: prompt to Overwrite or create suffixed file (e.g., -1.md) unless overwrite is configured.
  - Optional auto-open of the generated Markdown file after success.
- Feedback and notifications:
  - Progress notification for long/large conversions.
  - Success notification with resulting filename.
  - Error notification with actionable diagnostics.
- Configurable settings:
  - markitdown.openFileOnSuccess: boolean, default true.
  - markitdown.overwriteExisting: boolean, default false.

## Overall Architecture

The extension consists of a TypeScript VS Code front‑end and a Python subprocess that runs the markitdown library inside a managed virtual environment. The two communicate via process I/O and filesystem.

- Activation flow:
  1. Verify Python on PATH; guide user if missing.
  2. Create/verify dedicated virtual environment in extension storage.
  3. Install/verify markitdown in the venv.
  4. Register commands and menus.
- Conversion flow:
  1. Validate file type and resolve output path/policy.
  2. Show progress notification; spawn Python in venv.
  3. Run markitdown to produce Markdown.
  4. Handle collisions (overwrite or numeric suffix).
  5. Open result if configured; surface success or detailed error.
- Security:
  - Run conversion in isolated Python process; avoid shell injection.
  - Sanitize/validate file paths.
- Performance:
  - Non-blocking operations; serialize multi-file conversions as needed.
  - Target up to ~50MB files efficiently.
- Compatibility:
  - Latest VS Code + last two major versions; macOS/Windows/Linux.

## References

- Detailed documentation: [@docs/README.md](@docs/README.md)
- Product requirements: [prd.md](prd.md)

---

Footnotes / Update Log

- 2025-08-21 19:44:20 - Initialized productContext.md from PRD and documentation baseline.
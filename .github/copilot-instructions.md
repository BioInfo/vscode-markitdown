# Copilot Instructions for AI Agents: vscode-markitdown

## Project Overview
- **Purpose:** VS Code extension for one-click conversion of documents, presentations, spreadsheets, images (OCR), audio (transcription), and archives to Markdown using the markitdown Python library.
- **Key Components:**
  - TypeScript extension (UI, commands, file management)
  - Python subprocess (conversion logic, runs in isolated venv)
  - Automatic venv setup and dependency management

## Architecture & Data Flow
- **Activation:**
  - On first use, checks for Python (3.7+), creates venv, installs markitdown.
  - All conversions run in the venv via Python subprocess.
- **Commands:**
  - Command Palette: `MarkItDown: Convert File to Markdown`
  - File Explorer: `Convert to Markdown` (single/multi-select)
- **Supported Formats:**
  - Documents: .pdf, .docx
  - Presentations: .pptx
  - Spreadsheets: .xlsx
  - Web/data: .html, .csv, .json, .xml
  - Images: .png, .jpg, .jpeg, .gif (OCR)
  - Audio: .mp3, .wav (transcription)
  - Archives: .zip (recursively processed)

## Developer Workflows
- **Setup:**
  - `npm install` then `npm run compile` (TypeScript build)
  - Press `F5` in VS Code to launch Extension Development Host
- **Testing:**
  - Unit tests for TypeScript orchestration
  - Integration tests: Python subprocess on sample files
- **Troubleshooting:**
  - Output logs: `View > Output > MarkItDown`
  - Common issues: Python not found, conversion errors, permission denied

## Project Conventions
- **No global Python dependencies:** All Python code runs in extension-managed venv
- **Settings:**
  - `markitdown.openFileOnSuccess` (default: true)
  - `markitdown.overwriteExisting` (default: false)
- **Output:**
  - Markdown files saved alongside source; collision handled by suffix or overwrite
- **Security:**
  - All conversions sandboxed in venv subprocess
  - No shell interpolation; arguments passed safely

## Integration Points
- **Python:** Must be on PATH (3.7+)
- **markitdown:** Installed automatically in venv
- **VS Code API:** Used for UI, notifications, file management

## Examples
- Convert `data.pdf` to `data.md` via context menu
- Batch convert multiple `.docx` and `.xlsx` files
- OCR text from `image.png` to `image.md`

## References
- See [README.md](../README.md) and [docs/README.md](../docs/README.md) for full details
- For issues, see [GitHub Issues](https://github.com/BioInfo/vscode-markitdown/issues)

---

**Update this file if architecture, workflows, or conventions change. Propose improvements via PR.**


## Command Details: `onCommand:markitdown.convertFile`

- **Activation:** Triggered from Command Palette (`MarkItDown: Convert File to Markdown`) or File Explorer context menu.
- **Flow:**
  1. Initializes Python venv and dependencies if needed.
  2. Prompts for file(s) if not invoked from context menu.
  3. Validates file extension and existence.
  4. Determines output path (handles collisions).
  5. Shows progress notification in VS Code.
  6. Calls Python subprocess to convert file(s) to Markdown.
  7. Notifies user of success or error.
- **Batch support:** Multiple files can be selected and converted in sequence.
- **Supported formats:** See above (pdf, docx, pptx, xlsx, html, csv, json, xml, png, jpg, jpeg, gif, mp3, wav, zip).

**Example usage:**

1. Open Command Palette (`Ctrl+Shift+P`), type `MarkItDown: Convert File to Markdown`.
2. Select one or more supported files.
3. Wait for conversion progress and notification.
4. Resulting `.md` files appear next to source files.

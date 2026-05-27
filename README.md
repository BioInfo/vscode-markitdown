<div align="center">

<img src="https://raw.githubusercontent.com/BioInfo/vscode-markitdown/main/markitdown.png" alt="MarkItDown for VS Code" width="120" />

# MarkItDown for VS Code

**Turn PDFs, Word docs, slides, spreadsheets, web pages, and data files into clean Markdown. One click, right inside your editor.**

[![Marketplace](https://vsmarketplacebadges.dev/version/bioinfo.markitdown-vscode.svg?style=flat-square&label=Marketplace&color=007ACC)](https://marketplace.visualstudio.com/items?itemName=bioinfo.markitdown-vscode)
[![Installs](https://vsmarketplacebadges.dev/installs/bioinfo.markitdown-vscode.svg?style=flat-square&label=Installs&color=007ACC)](https://marketplace.visualstudio.com/items?itemName=bioinfo.markitdown-vscode)
[![Downloads](https://vsmarketplacebadges.dev/downloads/bioinfo.markitdown-vscode.svg?style=flat-square&label=Downloads&color=0aa)](https://marketplace.visualstudio.com/items?itemName=bioinfo.markitdown-vscode)
[![Rating](https://vsmarketplacebadges.dev/rating-star/bioinfo.markitdown-vscode.svg?style=flat-square&label=Rating)](https://marketplace.visualstudio.com/items?itemName=bioinfo.markitdown-vscode&ssr=false#review-details)
[![License: MIT](https://img.shields.io/github/license/BioInfo/vscode-markitdown?style=flat-square&color=lightgrey)](LICENSE)

[Install](#-installation) · [Features](#-features) · [Formats](#-supported-formats) · [Usage](#-usage) · [How it works](#%EF%B8%8F-how-it-works) · [Troubleshooting](#-troubleshooting)

</div>

---

Stop leaving your editor to convert a file. Right-click a `.pdf`, `.docx`, `.pptx`, `.xlsx`, or a dozen other formats and get a clean `.md` next to it. MarkItDown wraps Microsoft's [`markitdown`](https://github.com/microsoft/markitdown) library and manages its own isolated Python environment, so there is nothing to configure beyond having Python on your PATH.

## ✨ Features

- **One-click conversion** from the Explorer context menu or the Command Palette
- **Documents**: PDF, DOCX, PPTX, XLSX
- **Web & data**: HTML, CSV, JSON, XML
- **Images**: PNG, JPG, JPEG, GIF (EXIF/metadata; not OCR)
- **Audio**: MP3, WAV transcription (uses network speech recognition)
- **Archives**: ZIP, processed recursively
- **Batch & multi-select**: pick several files, or select a group in the Explorer, and convert them all
- **Progress and clear errors**: a progress notification per conversion, with a per-file summary on batches
- **Safe output**: writes `name.md` next to the source, with numbered variants instead of clobbering existing files

## 📦 Installation

| Method | Steps |
|--------|-------|
| **Marketplace** | Open Extensions (`Ctrl/Cmd+Shift+X`), search **MarkItDown**, click Install |
| **Command line** | `code --install-extension bioinfo.markitdown-vscode` |
| **VSIX** | Grab the latest `.vsix` from [Releases](https://github.com/BioInfo/vscode-markitdown/releases) and run *Extensions: Install from VSIX…* |

**First run** sets up an isolated Python virtual environment and installs a pinned, compatible `markitdown` build. This takes anywhere from a few seconds to a couple of minutes, shown in a progress notification. After that, conversions are instant.

## 📋 Supported Formats

| Category | Formats | Notes |
|----------|---------|-------|
| Documents | `.pdf` `.docx` | PDF text via `pdfminer`; Word via `mammoth` |
| Presentations | `.pptx` | Slides, titles, and bullet text |
| Spreadsheets | `.xlsx` | Rendered as Markdown tables |
| Web & structured | `.html` `.csv` `.json` `.xml` | Tables and structure preserved where possible |
| Images | `.png` `.jpg` `.jpeg` `.gif` | EXIF/metadata only. No OCR, so images without embedded text produce empty output unless an LLM is configured in markitdown |
| Audio | `.mp3` `.wav` | Speech-to-text (requires a network connection) |
| Archives | `.zip` | Recurses into supported files |

## 🎯 Usage

**Explorer**: right-click a supported file (or select several), choose **Convert to Markdown**.

**Command Palette**: `Ctrl/Cmd+Shift+P` → **MarkItDown: Convert File to Markdown**, then pick one or more files.

The converted `.md` lands in the same folder as the source. By default it opens automatically on success.

## ⚙️ Configuration

Search **MarkItDown** in Settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `markitdown.openFileOnSuccess` | `true` | Open the generated Markdown file after a successful conversion |
| `markitdown.overwriteExisting` | `false` | Overwrite an existing `.md` instead of creating a numbered variant |

## 🏗️ How It Works

MarkItDown runs as two cooperating processes:

```
VS Code (TypeScript)  ──spawn──▶  Python venv  ──▶  markitdown  ──▶  output.md
   UI · commands                   isolated,           Microsoft's
   file handling                   auto-managed        conversion library
```

- The extension never touches your system Python packages. It builds a dedicated virtual environment under the extension's storage and installs `markitdown` there.
- File paths are passed to Python as process arguments (no shell), so filenames cannot inject commands.
- A conversion that hangs is killed after a timeout, and oversized output is capped, so a bad file can't take down your editor.

## 📊 Examples

**CSV → Markdown**

```markdown
| col1 | col2 |
| --- | --- |
| 1 | 2 |
| 3 | 4 |
```

**DOCX (heading + table) → Markdown**

```markdown
Quarterly Report

This document has an embedded graphic and a table.

|  |  |
| --- | --- |
| Metric | Value |
| Revenue | $1.2M |
```

Tabular formats (CSV, XLSX, DOCX tables, HTML) map to Markdown tables; PDFs extract their text. Fidelity depends on the source file and the underlying `markitdown` library.

## 🐛 Troubleshooting

**"Python not found"**: install Python 3.10+ and make sure `python --version` works in a terminal. Get it from [python.org](https://www.python.org/downloads/).

**"Conversion failed"**: open the Output panel (`View > Output`, select **MarkItDown**) for the full error. Check the file opens in its native app and isn't password-protected.

**Empty Markdown output**: common for image files and image-only (scanned) PDFs. markitdown extracts text and metadata, not OCR, so a file with no embedded text produces an empty result. The extension now tells you when this happens.

**Still stuck?** If the environment seems broken, delete the extension's `markitdown-venv` storage folder and reload VS Code; it rebuilds automatically. Otherwise, [open an issue](https://github.com/BioInfo/vscode-markitdown/issues/new) with your VS Code version, Python version, the file type, and the Output-panel error.

## 🛠️ Development

```bash
git clone https://github.com/BioInfo/vscode-markitdown.git
cd vscode-markitdown
npm install
npm run compile      # tsc
npm test             # compile + lint + functional conversion tests (CLI, no GUI)
npm run test:vscode  # extension-host unit tests (downloads VS Code)
```

Press `F5` to launch the Extension Development Host.

`npm run test:functional` builds a Python venv, installs the pinned markitdown spec, and converts the fixtures in `test-files/fixtures/` through the same `python/markitdown_runner.py` the extension ships, asserting real output. No manual testing.

Issues and pull requests are welcome.

## 📄 License

MIT. See [LICENSE](LICENSE).

## 🙏 Acknowledgments

Built on Microsoft's [markitdown](https://github.com/microsoft/markitdown). Thanks to everyone who filed issues and helped make the extension more reliable.

<div align="center">

[Marketplace](https://marketplace.visualstudio.com/items?itemName=bioinfo.markitdown-vscode) · [Repository](https://github.com/BioInfo/vscode-markitdown) · [Issues](https://github.com/BioInfo/vscode-markitdown/issues) · [Changelog](CHANGELOG.md)

</div>

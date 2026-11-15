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

Trusted by 75,000+ developers on the VS Code Marketplace.

## ✨ Features

- **One-click conversion** from the Explorer, the editor tab menu or the Command Palette
- **Documents**: PDF, DOCX, PPTX, XLSX, XLS, EPUB, Outlook MSG, Jupyter notebooks
- **Web & data**: HTML, CSV, JSON, XML
- **Images**: PNG, JPG, JPEG, GIF (EXIF/metadata; not OCR)
- **Audio**: MP3, WAV, M4A metadata, plus optional speech transcription (off by default, see below)
- **Archives**: ZIP, processed recursively
- **Folders and batches**: right-click a folder, or select several files, and convert them all with one progress bar you can cancel
- **Safe output**: writes `name.md` next to the source (or to a folder you choose), with numbered variants instead of overwriting
- **Honest results**: a damaged or mislabelled file is reported as damaged instead of producing garbage

## 📦 Installation

| Method | Steps |
|--------|-------|
| **Marketplace** | Open Extensions (`Ctrl/Cmd+Shift+X`), search **MarkItDown**, click Install |
| **Command line** | `code --install-extension bioinfo.markitdown-vscode` |
| **VSIX** | Grab the latest `.vsix` from [Releases](https://github.com/BioInfo/vscode-markitdown/releases) and run *Extensions: Install from VSIX…* |

**First run** builds a private Python environment and installs `markitdown` into it. With [uv](https://docs.astral.sh/uv/) installed this takes seconds, and uv can download Python for you if you don't have it. Without uv it uses your Python 3.10 or newer and pip, which takes a minute or two. Progress shows in a notification you can cancel, and the install output streams to the **MarkItDown** output channel. After that, conversions start straight away.

**Remote, WSL and Codespaces**: the extension runs on the remote side, so Python (or uv) needs to be installed there.

## 📋 Supported Formats

| Category | Formats | Notes |
|----------|---------|-------|
| Documents | `.pdf` `.docx` `.epub` | PDF text via `pdfminer`; Word via `mammoth` |
| Presentations | `.pptx` | Slides, titles, and bullet text |
| Spreadsheets | `.xlsx` `.xls` | Rendered as Markdown tables |
| Email & notebooks | `.msg` `.ipynb` | Outlook messages; Jupyter notebook cells |
| Web & structured | `.html` `.htm` `.csv` `.json` `.xml` | Tables and structure preserved where possible |
| Images | `.png` `.jpg` `.jpeg` `.gif` | EXIF/metadata only. No OCR, so images without embedded text produce empty output |
| Audio | `.mp3` `.wav` `.m4a` | Metadata. Speech transcription only with `markitdown.audioTranscription` on, and it sends the audio to Google |
| Archives | `.zip` | Recurses into supported files |

## 🎯 Usage

**Explorer**: right-click a supported file, several files, or a folder, and choose **MarkItDown: Convert to Markdown**.

**Editor**: right-click the tab of an open file, or run the command with the file active.

**Command Palette**: `Ctrl/Cmd+Shift+P` → **MarkItDown: Convert to Markdown**.

Two more commands help when something goes wrong: **MarkItDown: Show Environment Info** prints the Python, markitdown version and settings in use, and **MarkItDown: Rebuild Environment** deletes the private environment and builds it again.

## ⚙️ Configuration

Search **MarkItDown** in Settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `markitdown.openFileOnSuccess` | `true` | Open the Markdown file after a single conversion |
| `markitdown.overwriteExisting` | `false` | Overwrite an existing `.md` instead of creating a numbered variant |
| `markitdown.outputDirectory` | empty | Folder for `.md` files. Empty = next to the source; relative paths start at the workspace folder |
| `markitdown.keepDataUris` | `false` | Keep embedded images as base64 in the Markdown (DOCX, PPTX, HTML) |
| `markitdown.audioTranscription` | `false` | Transcribe speech in audio files. **Sends the audio to Google's speech service** |
| `markitdown.conversionTimeoutSeconds` | `600` | Stop a single conversion after this long |
| `markitdown.pythonPath` | empty | Interpreter to build the environment with. Empty = search PATH |
| `markitdown.useUv` | `true` | Use uv when it is installed |
| `markitdown.pipIndexUrl` | empty | Package index or corporate mirror. VS Code's `http.proxy` is passed to the installer too |

## 🏗️ How It Works

MarkItDown runs as two cooperating processes:

```
VS Code (TypeScript)  ──spawn──▶  Python venv  ──▶  markitdown  ──▶  output.md
   UI · commands                   isolated,           Microsoft's
   file handling                   auto-managed        conversion library
```

- The extension never touches your system Python packages. It builds a dedicated virtual environment under the extension's storage and installs `markitdown` there.
- File paths are passed to Python as process arguments (no shell), so filenames cannot inject commands.
- A conversion that hangs is stopped after a timeout (with its child processes), you can cancel any conversion or setup, and oversized output is capped.
- Several VS Code windows share one environment safely: a lock stops two windows from building it at once.
- When a new version of the extension needs newer packages, the environment upgrades itself on the next conversion.

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

**"Python was not found" or "not a supported version"**: install Python 3.10 or newer from [python.org](https://www.python.org/downloads/). If VS Code still picks the wrong one (it can see a different PATH than your terminal), set **MarkItDown: Python Path** (`markitdown.pythonPath`) to the full path of the interpreter you want.

**"Failed to install markitdown"**: the error says why, and the **MarkItDown** output channel has the full installer output. If pip could not see any markitdown release, the machine can't reach pypi.org: set VS Code's `http.proxy`, or point `markitdown.pipIndexUrl` at your company's mirror.

**"Python is installed without the venv module"** (Debian/Ubuntu): run `sudo apt install python3-venv`, or install uv.

**"Conversion failed"**: open the Output panel (`View > Output`, select **MarkItDown**) for the full error. Check the file opens in its native app and isn't password-protected.

**Empty Markdown output**: common for image files and scanned PDFs. markitdown extracts text and metadata and does not do OCR, so a file with no embedded text produces an empty result. The extension tells you when this happens.

**Still stuck?** Run **MarkItDown: Rebuild Environment**. Otherwise, [open an issue](https://github.com/BioInfo/vscode-markitdown/issues/new) with your VS Code version, Python version, the file type, and the Output-panel error.

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

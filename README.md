# MarkItDown VS Code Extension

Convert various file formats to Markdown directly within VS Code with one click.

## Features

- **One-click conversion** from Command Palette or File Explorer context menu
- **Multiple format support**: PDF, DOCX, PPTX, XLSX, HTML, CSV, JSON, XML, images (with OCR), audio (with transcription), and ZIP archives
- **Smart output handling** with collision detection and configurable overwrite behavior
- **Progress notifications** for long-running conversions
- **Automatic file opening** after successful conversion (configurable)

## Supported File Formats

### Documents
- `.pdf` - PDF documents
- `.docx` - Microsoft Word documents

### Presentations
- `.pptx` - Microsoft PowerPoint presentations

### Spreadsheets
- `.xlsx` - Microsoft Excel spreadsheets

### Web & Structured Data
- `.html` - HTML files
- `.csv` - Comma-separated values
- `.json` - JSON data files
- `.xml` - XML documents

### Media (requires additional dependencies)
- `.png`, `.jpg`, `.jpeg`, `.gif` - Images (with OCR)
- `.mp3`, `.wav` - Audio files (with transcription)

### Archives
- `.zip` - ZIP archives (recursively converts supported files within)

## Usage

### Command Palette
1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type "MarkItDown: Convert File to Markdown"
3. Select the file(s) you want to convert

### File Explorer Context Menu
1. Right-click on any supported file in the File Explorer
2. Select "Convert to Markdown"
3. The conversion will start automatically

## Configuration

The extension provides two configuration options:

- `markitdown.openFileOnSuccess` (default: `true`) - Automatically open the generated Markdown file after successful conversion
- `markitdown.overwriteExisting` (default: `false`) - Overwrite existing Markdown files instead of creating numbered variants (e.g., `file-1.md`, `file-2.md`)

## Requirements

- **Python 3.7+** must be installed and available in your PATH
- The extension will automatically create a virtual environment and install `markitdown` with all optional dependencies for full format support
- **First-time setup**: The extension will download and install all necessary dependencies (may take a few minutes on first use)

## Installation

1. Install the extension from the VS Code Marketplace
2. Ensure Python is installed on your system
3. The extension will handle the rest automatically on first use

## How It Works

The extension uses a two-process architecture:
- **VS Code Extension (TypeScript)**: Handles UI, commands, and orchestration
- **Python Subprocess**: Runs the `markitdown` library in an isolated virtual environment

This design ensures security, stability, and leverages the proven `markitdown` Python library for reliable conversions.

## Output Files

- Converted files are saved alongside the original with a `.md` extension
- If a file already exists and `overwriteExisting` is `false`, numbered suffixes are added (`-1.md`, `-2.md`, etc.)
- Success notifications show the final filename and offer to open the file

## Error Handling

The extension provides detailed error categorization and user-friendly messages:
- **Unsupported Format**: Clear guidance on supported file types
- **Corrupted Files**: Suggestions to verify file integrity
- **Python Environment Issues**: Links to Python installation resources
- **File Access Problems**: Permission and file lock guidance

All detailed error information is logged to the "MarkItDown" output channel.

## Development

This extension is built with:
- TypeScript for the VS Code extension host
- Python `markitdown` library for file conversion
- Managed virtual environment for Python dependencies

## License

[Add your license information here]

## Contributing

[Add contributing guidelines here]

## Support

For issues and feature requests, please visit [your repository URL].
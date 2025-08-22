# MarkItDown for VS Code

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/bioinfo.markitdown-vscode)](https://marketplace.visualstudio.com/items?itemName=bioinfo.markitdown-vscode)
[![GitHub](https://img.shields.io/github/license/BioInfo/vscode-markitdown)](https://github.com/BioInfo/vscode-markitdown/blob/main/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/BioInfo/vscode-markitdown)](https://github.com/BioInfo/vscode-markitdown/issues)

Convert various file formats to Markdown directly within VS Code with one click. No more context switching - transform your documents, presentations, spreadsheets, images, and audio files into clean, readable Markdown without leaving your editor.

## ✨ Features

- **🚀 One-Click Conversion**: Convert files directly from the Command Palette or File Explorer context menu
- **📄 Document Support**: PDF, DOCX, PPTX, XLSX files
- **🌐 Web & Data**: HTML, CSV, JSON, XML files
- **🖼️ Image OCR**: Extract text from PNG, JPG, JPEG, GIF images
- **🎵 Audio Transcription**: Convert MP3, WAV audio to text
- **📦 Archive Processing**: Recursively convert supported files within ZIP archives
- **⚡ Progress Tracking**: Real-time progress notifications for long conversions
- **🔧 Smart Output**: Automatic collision detection with numbered suffixes
- **⚙️ Configurable**: Customize auto-open and overwrite behaviors

## 🚀 Quick Start

### Installation

1. **From VS Code Marketplace**: Search for "MarkItDown" in the Extensions view (`Ctrl+Shift+X`)
2. **From Command Line**: `code --install-extension bioinfo.markitdown-vscode`
3. **From VSIX**: Download the latest `.vsix` from [releases](https://github.com/BioInfo/vscode-markitdown/releases)

### First Use

1. **Ensure Python is installed** (3.7+ required)
2. **Right-click any supported file** in the File Explorer
3. **Select "Convert to Markdown"**
4. **Wait for first-time setup** (installs dependencies automatically)
5. **Enjoy your converted Markdown file!**

## 📋 Supported File Formats

| Category | Formats | Description |
|----------|---------|-------------|
| **Documents** | `.pdf`, `.docx` | PDF documents, Microsoft Word files |
| **Presentations** | `.pptx` | Microsoft PowerPoint presentations |
| **Spreadsheets** | `.xlsx` | Microsoft Excel spreadsheets |
| **Web & Structured** | `.html`, `.csv`, `.json`, `.xml` | Web pages, data files |
| **Images** | `.png`, `.jpg`, `.jpeg`, `.gif` | Images with OCR text extraction |
| **Audio** | `.mp3`, `.wav` | Audio files with speech transcription |
| **Archives** | `.zip` | ZIP files (recursively processes contents) |

## 🎯 Usage

### Command Palette
1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type "MarkItDown: Convert File to Markdown"
3. Select file(s) to convert

### File Explorer Context Menu
1. Right-click any supported file
2. Select "Convert to Markdown"
3. Conversion starts automatically

### Batch Processing
- Select multiple files in the file picker
- Each file is converted individually
- Progress shown for each conversion

## ⚙️ Configuration

Access settings via `File > Preferences > Settings` and search for "MarkItDown":

| Setting | Default | Description |
|---------|---------|-------------|
| `markitdown.openFileOnSuccess` | `true` | Automatically open converted Markdown files |
| `markitdown.overwriteExisting` | `false` | Overwrite existing files vs. create numbered variants |

## 🔧 Requirements

- **VS Code**: Version 1.74.0 or higher
- **Python**: Version 3.7 or higher (must be in PATH)
- **Internet Connection**: Required for first-time dependency installation

### Automatic Setup
The extension automatically:
- ✅ Detects Python installation
- ✅ Creates isolated virtual environment
- ✅ Installs `markitdown` with all dependencies
- ✅ Manages environment updates

## 🏗️ How It Works

MarkItDown uses a secure two-process architecture:

1. **VS Code Extension (TypeScript)**: Handles UI, commands, and file management
2. **Python Subprocess**: Runs the powerful `markitdown` library in isolation
3. **Virtual Environment**: Keeps dependencies separate from your system Python

This design ensures:
- 🔒 **Security**: Isolated execution environment
- 🚀 **Performance**: Non-blocking operations with progress feedback
- 🛡️ **Stability**: Extension crashes don't affect VS Code
- 🔄 **Reliability**: Proven `markitdown` library for conversions

## 📊 Output Examples

### JSON to Markdown
**Input** (`data.json`):
```json
{
  "name": "Project Alpha",
  "version": "1.0.0",
  "features": ["fast", "reliable", "secure"]
}
```

**Output** (`data.md`):
```markdown
# JSON Document

**name**: Project Alpha  
**version**: 1.0.0  
**features**: 
- fast
- reliable  
- secure
```

### PDF to Markdown
Converts PDF documents while preserving:
- Text formatting and structure
- Headers and sections
- Lists and tables
- Basic styling information

## 🐛 Troubleshooting

### Common Issues

**"Python not found"**
- Ensure Python 3.7+ is installed and in your PATH
- Try running `python --version` in terminal
- Install from [python.org](https://www.python.org/downloads/)

**"Conversion failed"**
- Check the Output panel (`View > Output > MarkItDown`)
- Verify file isn't corrupted by opening in native application
- Ensure file isn't password-protected or encrypted

**"Permission denied"**
- Close the file in other applications
- Check file permissions
- Try copying file to a different location

### Getting Help

1. **Check the [FAQ](https://github.com/BioInfo/vscode-markitdown/wiki/FAQ)**
2. **Search [existing issues](https://github.com/BioInfo/vscode-markitdown/issues)**
3. **Create a [new issue](https://github.com/BioInfo/vscode-markitdown/issues/new)** with:
   - VS Code version
   - Python version
   - File type and size
   - Error message from Output panel

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](https://github.com/BioInfo/vscode-markitdown/blob/main/CONTRIBUTING.md) for details.

### Development Setup
```bash
git clone https://github.com/BioInfo/vscode-markitdown.git
cd vscode-markitdown
npm install
npm run compile
```

Press `F5` to launch the Extension Development Host for testing.

## 📝 Changelog

See [CHANGELOG.md](https://github.com/BioInfo/vscode-markitdown/blob/main/CHANGELOG.md) for release history.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/BioInfo/vscode-markitdown/blob/main/LICENSE) file for details.

## 🙏 Acknowledgments

- Built on the excellent [markitdown](https://github.com/microsoft/markitdown) library by Microsoft
- Inspired by the need for seamless document conversion workflows
- Thanks to the VS Code extension development community

## 🔗 Links

- **[GitHub Repository](https://github.com/BioInfo/vscode-markitdown)**
- **[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=bioinfo.markitdown-vscode)**
- **[Issue Tracker](https://github.com/BioInfo/vscode-markitdown/issues)**
- **[Releases](https://github.com/BioInfo/vscode-markitdown/releases)**

---

**Enjoy seamless document conversion with MarkItDown! 🚀**

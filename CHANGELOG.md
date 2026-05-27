# Change Log

All notable changes to the "MarkItDown" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2026-05-27

Documentation only. No code or behavior changes from 0.3.0.

### Changed
- Rewrote the README: centered header, accurate feature/format descriptions, architecture diagram, and corrected setup notes.
- Replaced the retired shields.io Visual Studio Marketplace badges (version/installs/downloads/rating) with `vsmarketplacebadges.dev`, which returns live data. Removed dead links.

## [0.3.0] - 2026-05-27

First public update since 0.1.1. (0.2.0 was prepared but never published to the
Marketplace; its security hardening ships here as part of 0.3.0.)

### Fixed
- **DOCX and other conversions failing for many users.** The extension installed
  an unpinned `markitdown[all]`, which on modern Python (3.13/3.14) silently
  resolved to the ancient `markitdown 0.0.2` (weak DOCX handling, fails on
  documents with embedded graphics) or failed to resolve at all. Now pins
  `markitdown[docx,pptx,xlsx,xls,pdf,outlook,audio-transcription]>=0.1.6,<0.2.0`
  with targeted extras that resolve cleanly on current Python.
- **Reinstall-on-every-conversion.** The post-install health check did
  `import docx` (python-docx), which markitdown does not depend on (it uses
  `mammoth`), so the check always failed and reinstalled markitdown on every
  run. The check now verifies the package via `importlib.metadata` and a real
  `MarkItDown()` smoke test.
- **Converted file did not open** until the success notification timed out;
  it now opens immediately when `openFileOnSuccess` is enabled.
- **Silent empty output** for images with no extractable text now produces a
  clear warning (markitdown does metadata/EXIF, not OCR).

### Added
- First-run setup now shows a progress notification instead of running silently
  for the minutes it can take to create the venv and install markitdown.
- Explorer multi-select: right-clicking several files now converts all of them.
- CLI functional test harness (`npm run test:functional`) that builds a venv and
  converts real fixtures (DOCX-with-image, XLSX, PPTX, PDF, CSV, JSON, XML,
  HTML, image) end-to-end. Real assertions in the unit suite.

### Changed
- Conversion now runs through a shipped `python/markitdown_runner.py` shared by
  the extension and the test harness (single source of truth). Paths are passed
  as process argv (no shell), which removes the injection surface without the
  base64 encoding workaround.
- Documentation corrected: images are metadata/EXIF extraction, not OCR; Python
  3.10+ is required.

## [0.2.0] - 2025-10-21

> Note: prepared but never published to the Marketplace; folded into 0.3.0.

### Security
- **CRITICAL**: Fixed path injection vulnerability in Python conversion script using base64 encoding
- Added process timeout protection (5-minute default with graceful SIGTERM/SIGKILL termination)
- Implemented output size limits (10MB per stream) to prevent out-of-memory crashes
- Added configuration type validation with safe defaults

### Added
- Virtual environment corruption detection and automatic recovery
- Batch conversion with aggregate error reporting and detailed failure summaries
- Output channel automatic cleanup (10,000 line limit) to prevent memory leaks
- Comprehensive unit test suite for core components
- Bounded filename collision resolution (100 attempt limit with clear error messages)
- SECURITY.md documenting all security measures and best practices
- Enhanced error messages with actionable suggestions

### Changed
- Converted all file system operations to async/await for better performance and responsiveness
- Fixed initialization race condition with proper promise-based synchronization
- Improved batch conversion to continue processing all files even when individual conversions fail
- Enhanced error categorization with more specific user notifications
- Virtual environment integrity now verified on every startup with automatic repair

### Fixed
- Race condition where commands could execute before extension fully initialized
- Unbounded collision loop when resolving duplicate filenames (could iterate thousands of times)
- Memory leak in output channel due to unbounded log growth
- Synchronous file operations blocking VS Code event loop
- Missing aggregate error handling in batch file conversions
- Corrupted virtual environments causing silent failures

### Performance
- Async file operations significantly improve UI responsiveness
- Reduced event loop blocking during file validation
- Better memory management with automatic cleanup mechanisms

## [0.1.1] - 2025-08-22

### Fixed
- **Critical Dependency Issue**: Fixed conversion failures for PDF, DOCX, PPTX, and XLSX files
- Now installs `markitdown[all]` to include all optional dependencies (docx, openpyxl, PIL, etc.)
- Added comprehensive dependency verification during Python environment setup
- Improved error messages for missing dependencies

### Changed
- Enhanced Python environment manager with better dependency checking
- Updated installation process to ensure all file formats are supported out of the box
- Improved first-time setup experience with clearer progress indication

### Technical
- Modified `ensureMarkitdownInstalled()` to use `pip install markitdown[all]`
- Added dependency verification for docx, openpyxl, and PIL packages
- Enhanced error handling for dependency-related issues

## [0.1.0] - 2025-08-22

### Added
- **Initial Release**: Complete VS Code extension for converting various file formats to Markdown
- **File Format Support**:
  - Documents: PDF (.pdf), Microsoft Word (.docx)
  - Presentations: Microsoft PowerPoint (.pptx)
  - Spreadsheets: Microsoft Excel (.xlsx)
  - Web & Data: HTML (.html), CSV (.csv), JSON (.json), XML (.xml)
  - Images: PNG, JPG, JPEG, GIF with OCR text extraction
  - Audio: MP3, WAV with speech transcription
  - Archives: ZIP files with recursive conversion
- **User Interface**:
  - Command Palette integration: "MarkItDown: Convert File to Markdown"
  - File Explorer context menu: "Convert to Markdown"
  - Support for single and multiple file selection
- **Smart Features**:
  - Progress notifications for long-running conversions
  - Automatic collision detection with numbered file suffixes
  - Configurable auto-open behavior for converted files
  - Configurable overwrite vs. suffix behavior
- **Architecture**:
  - Two-process design with TypeScript frontend and Python backend
  - Automatic Python virtual environment management
  - Secure subprocess execution with proper error handling
  - Comprehensive logging to dedicated output channel
- **Configuration Options**:
  - `markitdown.openFileOnSuccess`: Auto-open converted files (default: true)
  - `markitdown.overwriteExisting`: Overwrite existing files vs. create numbered variants (default: false)
- **Error Handling**:
  - Categorized error types with actionable user guidance
  - Detailed logging for troubleshooting
  - User-friendly notifications with suggested solutions
- **Documentation**:
  - Comprehensive README with usage instructions
  - MIT License for open source distribution
  - Complete development documentation and PRD

### Technical Details
- **Minimum Requirements**: VS Code 1.74.0+, Python 3.7+
- **Dependencies**: Automatic installation of markitdown library with all optional dependencies
- **Security**: Isolated Python execution environment with path validation
- **Performance**: Non-blocking operations with progress reporting
- **Cross-platform**: Support for macOS, Windows, and Linux

### Known Issues
- First-time setup may take 2-3 minutes while downloading and installing Python dependencies
- Large files (>50MB) may take significant time to process
- Some PDF files with complex layouts may not convert perfectly
- Audio transcription quality depends on audio clarity and language

---

## Release Notes

### Version 0.1.1 - Dependency Fix Release
This release addresses critical dependency issues that prevented conversion of certain file formats. All users should upgrade to ensure full functionality.

### Version 0.1.0 - Initial Release
The first public release of MarkItDown for VS Code. This extension brings powerful file conversion capabilities directly into your VS Code workflow, eliminating the need to switch between applications for document conversion tasks.

---

## Upcoming Features

- Support for additional file formats (RTF, ODT, etc.)
- Batch conversion with progress tracking
- Custom conversion templates
- Integration with VS Code's built-in diff viewer
- Conversion history and favorites
- Cloud storage integration

---

For more information, visit the [GitHub repository](https://github.com/BioInfo/vscode-markitdown).
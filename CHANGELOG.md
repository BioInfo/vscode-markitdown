# Change Log

All notable changes to the "MarkItDown" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-10-21

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
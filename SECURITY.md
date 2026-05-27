# Security Policy

## Overview

The MarkItDown VS Code Extension has been hardened for production use with thousands of users. This document outlines the security measures implemented and best practices for secure usage.

## Security Improvements (v0.2.0)

### Critical Security Fixes

#### 1. Path Injection Prevention
**Issue**: Previous versions were vulnerable to path injection attacks through malicious file paths.
**Fix**: Implemented base64 encoding for all file paths passed to Python subprocess, preventing code injection.
**Impact**: Eliminates risk of arbitrary code execution through crafted file paths.

#### 2. Process Timeout Protection
**Issue**: Malicious or corrupted files could cause indefinite hangs.
**Fix**: Added 5-minute default timeout with graceful SIGTERM followed by SIGKILL.
**Impact**: Prevents denial-of-service through hanging processes.

#### 3. Output Size Limits
**Issue**: Unbounded output accumulation could cause out-of-memory crashes.
**Fix**: Implemented 10MB per-stream limits for stdout/stderr.
**Impact**: Prevents memory exhaustion attacks.

### Reliability Improvements

#### 4. Async File Operations
**Issue**: Synchronous file operations could block the event loop.
**Fix**: Converted all file system operations to async/await pattern.
**Impact**: Improved responsiveness and prevents UI freezing.

#### 5. Virtual Environment Validation
**Issue**: Corrupted virtual environments caused silent failures.
**Fix**: Added verification checks with automatic recovery and recreation.
**Impact**: Improved reliability and user experience.

#### 6. Bounded Collision Resolution
**Issue**: Unbounded loop when resolving filename collisions.
**Fix**: Added 100-attempt limit with clear error messages.
**Impact**: Prevents infinite loops in edge cases.

#### 7. Output Channel Management
**Issue**: Unbounded log growth could consume gigabytes of memory.
**Fix**: Implemented automatic cleanup after 10,000 lines.
**Impact**: Prevents long-term memory leaks.

#### 8. Race Condition Prevention
**Issue**: Commands executed before initialization could crash.
**Fix**: Implemented proper promise-based synchronization.
**Impact**: Eliminates startup race conditions.

## Security Best Practices

### For Users

1. **Keep Extension Updated**: Always use the latest version to benefit from security patches.

2. **Verify File Sources**: Only convert files from trusted sources, as the extension processes file content.

3. **Monitor Python Environment**: The extension creates an isolated virtual environment in VS Code's global storage.

4. **Review Output**: Check the MarkItDown output channel for any unusual errors or warnings.

5. **Network Security**: Initial setup requires internet access to install Python dependencies via pip.

### For Developers

1. **Input Validation**: All user inputs are validated before processing.

2. **Subprocess Isolation**: Python subprocess runs with limited permissions and timeouts.

3. **Error Handling**: All errors are categorized and handled appropriately without exposing sensitive data.

4. **Configuration Validation**: All settings are type-checked with safe defaults.

## Security Features

### Process Isolation
- Python conversion runs in isolated virtual environment
- Subprocess has 5-minute timeout protection
- Output size limited to 10MB per stream
- Graceful termination with SIGTERM → SIGKILL fallback

### Path Security
- Base64 encoding prevents injection attacks
- All paths validated before use
- Async operations prevent blocking attacks

### Memory Protection
- Output channel auto-cleanup at 10,000 lines
- Stream size limits prevent OOM
- Bounded retry loops prevent infinite execution

### Error Handling
- Categorized error messages don't expose system details
- Stack traces logged to output channel only
- User-friendly messages with actionable suggestions

## Reporting Security Vulnerabilities

If you discover a security vulnerability, please:

1. **DO NOT** open a public GitHub issue
2. Email the maintainers directly with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

We will respond within 48 hours and provide a timeline for fixes.

## Security Changelog

### Version 0.2.0 (Current)
- Fixed CRITICAL path injection vulnerability
- Added process timeout protection
- Implemented output size limits
- Added virtual environment validation
- Converted to async file operations
- Added bounded collision resolution
- Implemented output channel management
- Fixed race conditions

### Version 0.1.1
- Initial marketplace release
- Basic security measures

## Compliance

This extension:
- Does not collect or transmit user data
- Does not communicate with external servers (except pip during setup)
- Processes all conversions locally
- Stores data only in VS Code's global storage directory

## Dependencies

### Runtime Dependencies
- Python 3.x (system-installed)
- markitdown[all] (installed in isolated venv)

### Security Considerations
- Python dependencies installed via pip from PyPI
- Virtual environment isolated per VS Code workspace
- No network communication after initial setup

## License

See [LICENSE](LICENSE) for full license text.

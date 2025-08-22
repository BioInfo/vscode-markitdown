# System Patterns

This file documents recurring patterns and standards used in the project. It will evolve with the codebase and decisions.

## Coding Patterns
- TypeScript Extension Host
  - Command registration and context menu contribution via VS Code API.
  - Non-blocking async flows with window.withProgress for long operations.
  - Centralized settings access and propagation to the conversion orchestrator.
- Path and Naming Conventions
  - Output file naming uses <basename>.md; on collision, numeric suffixing: -1.md, -2.md, ...
  - Strict path validation/sanitization before invoking subprocesses.
- Error Handling
  - Normalize errors into categories: Unsupported Format, Corrupt Input, markitdown Error, I/O Error, Environment Missing.
  - Verbose diagnostics routed to a dedicated Output Channel; user-facing notifications remain concise and actionable.

## Architectural Patterns
- Two-Process Architecture
  - VS Code (TypeScript) orchestrates a Python subprocess that runs markitdown within a managed virtual environment.
  - Clear separation of concerns: UI/UX and orchestration in TS; conversion logic delegated to Python/markitdown.
- Environment Management
  - Virtual environment created/maintained under extension globalStoragePath.
  - Python detection strategy: prefer python3, fallback to python; guide user if absent.
- Security and Isolation
  - Avoid shell interpolation; pass arguments via safe spawn/exec APIs.
  - Consider restricted environment for subprocess where platform allows.
- Performance and Responsiveness
  - All conversions run asynchronously; progress reported incrementally.
  - Batch multi-file operations serialize to control resource usage; future optimization can introduce concurrency limits.

## Testing Patterns
- Unit Tests (TypeScript)
  - Path resolution, suffix strategy, settings propagation, and error normalization.
- Integration Tests
  - End-to-end conversion invoking the Python entrypoint on representative fixtures (pdf/docx/pptx/xlsx/html/csv/json/xml/png/jpg/gif/mp3/wav/zip).
- Regression and Limits
  - Corrupt/unsupported file handling; large file tests up to ~50MB.
  - Cross-platform CI matrix (macOS, Windows, Linux).

## References
- PRD: [prd.md](prd.md)
- Project Documentation: [@docs/README.md](@docs/README.md)
- Related Logs: [memory-bank/decisionLog.md](memory-bank/decisionLog.md)

---

Footnotes / Update Log
- 2025-08-21 19:47:15 - Initialized systemPatterns.md capturing coding, architectural, and testing patterns from PRD and docs.
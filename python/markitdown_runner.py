#!/usr/bin/env python3
"""MarkItDown runner — single source of truth for the VS Code extension and the
CLI functional test harness.

Two subcommands:

    check
        Verify that the `markitdown` package is importable, that it is a
        modern (>= MIN_VERSION) release, and that the MarkItDown class can be
        instantiated. Prints the detected version to stdout. Exits 0 on
        success, non-zero with a diagnostic on stderr otherwise.

    convert <input_path> <output_path>
        Convert <input_path> to Markdown and write it to <output_path> (UTF-8).
        Paths are passed as argv (the extension spawns Python without a shell,
        so there is no injection surface). Prints `CHARS:<n>` to stdout where
        <n> is the number of characters written, so the caller can detect an
        empty conversion (e.g. an image with no extractable text). Exits 0 on
        success, 1 with `Error: ...` on stderr on failure.
"""
import sys


# Floor below which markitdown's converters are too old to trust. 0.0.x has
# weak DOCX handling and no `importlib.metadata`-visible version in some builds;
# pip can silently backtrack to 0.0.2 on bleeding-edge Python when `[all]` is
# requested, which is the root cause of the early "half my docx files fail"
# reports.
MIN_VERSION = (0, 1, 6)


def _installed_version():
    """Return the installed markitdown version as a tuple, or None if unknown."""
    try:
        import importlib.metadata as md
        raw = md.version("markitdown")
    except Exception:
        return None, None
    parts = []
    for chunk in raw.split(".")[:3]:
        num = ""
        for ch in chunk:
            if ch.isdigit():
                num += ch
            else:
                break
        parts.append(int(num) if num else 0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts), raw


def cmd_check():
    version, raw = _installed_version()
    try:
        from markitdown import MarkItDown  # noqa: F401
    except Exception as exc:  # markitdown not installed / broken
        print(f"markitdown import failed: {exc}", file=sys.stderr)
        return 1

    if version is None:
        # Importable but version unreadable — treat as too old to trust.
        print("markitdown version could not be determined", file=sys.stderr)
        return 2

    if version < MIN_VERSION:
        want = ".".join(str(n) for n in MIN_VERSION)
        print(
            f"markitdown {raw} is older than required {want}",
            file=sys.stderr,
        )
        return 3

    # Smoke-test instantiation so a half-broken install fails here, not mid-convert.
    try:
        MarkItDown()
    except Exception as exc:
        print(f"MarkItDown() instantiation failed: {exc}", file=sys.stderr)
        return 4

    print(raw)
    return 0


def cmd_convert(input_path, output_path):
    try:
        from markitdown import MarkItDown
        md = MarkItDown()
        result = md.convert(input_path)
        text = result.text_content or ""
        with open(output_path, "w", encoding="utf-8") as fh:
            fh.write(text)
        print(f"CHARS:{len(text.strip())}")
        return 0
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


def main(argv):
    if not argv:
        print("Error: no subcommand (expected 'check' or 'convert')", file=sys.stderr)
        return 2
    sub = argv[0]
    if sub == "check":
        return cmd_check()
    if sub == "convert":
        if len(argv) != 3:
            print("Error: convert requires <input_path> <output_path>", file=sys.stderr)
            return 2
        return cmd_convert(argv[1], argv[2])
    print(f"Error: unknown subcommand '{sub}'", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

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


# Container signatures for formats whose converter needs a real file of that
# type. Without this check, a corrupt .docx falls through to markitdown's
# plain-text converter and "succeeds" with garbage.
_ZIP_FORMATS = {".docx", ".pptx", ".xlsx", ".epub"}
_OLE_FORMATS = {".xls", ".msg"}
_OLE_MAGIC = bytes.fromhex("D0CF11E0A1B11AE1")


def _check_container(input_path):
    """Return an error message if the file is not the type its extension claims."""
    import os
    import zipfile

    ext = os.path.splitext(input_path)[1].lower()
    if ext in _ZIP_FORMATS and not zipfile.is_zipfile(input_path):
        return f"This {ext} file is damaged or not really a {ext} (it is not a valid Office/zip container)."
    with open(input_path, "rb") as fh:
        head = fh.read(1024)
    if ext == ".pdf" and b"%PDF" not in head:
        return "This .pdf file is damaged or not really a PDF (no PDF header)."
    if ext in _OLE_FORMATS and not head.startswith(_OLE_MAGIC):
        return f"This {ext} file is damaged or not really a {ext}."
    return None


def _emit(result):
    import json

    print("RESULT:" + json.dumps(result))


def _disable_transcription():
    """Audio transcription sends audio to Google's speech API; off unless enabled."""
    try:
        from markitdown._exceptions import MissingDependencyException
        import markitdown.converters._audio_converter as audio

        def _off(*_args, **_kwargs):
            raise MissingDependencyException("audio transcription disabled")

        audio.transcribe_audio = _off
    except Exception:
        pass  # layout changed upstream; the setting's doc says transcription may still run


def _write_output(output_path, text, no_clobber):
    """Write UTF-8 text atomically, keeping the target's permissions.

    no_clobber: fail with FileExistsError rather than replace an existing file
    (os.link is atomic and refuses an existing name). A symlinked target is
    written through, so the link survives.
    """
    import os
    import shutil
    import tempfile

    if os.path.islink(output_path) and not no_clobber:
        with open(output_path, "w", encoding="utf-8") as fh:
            fh.write(text)
        return

    directory = os.path.dirname(os.path.abspath(output_path))
    fd, tmp = tempfile.mkstemp(dir=directory, suffix=".md.tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
        if os.path.exists(output_path):
            shutil.copymode(output_path, tmp)
        else:
            umask = os.umask(0)
            os.umask(umask)
            os.chmod(tmp, 0o666 & ~umask)
        if no_clobber:
            try:
                os.link(tmp, output_path)
            except FileExistsError:
                raise
            except OSError:
                # File system without hard links (FAT, some network shares).
                with open(output_path, "x", encoding="utf-8") as fh:
                    fh.write(text)
            os.unlink(tmp)
        else:
            os.replace(tmp, output_path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def cmd_convert(input_path, output_path, keep_data_uris=False, transcribe=False, no_clobber=False):
    try:
        problem = _check_container(input_path)
        if problem:
            _emit({"ok": False, "error_type": "corrupt", "error": problem})
            print(f"Error: {problem}", file=sys.stderr)
            return 1
        if not transcribe:
            _disable_transcription()
        from markitdown import MarkItDown

        md = MarkItDown()
        result = md.convert(input_path, keep_data_uris=keep_data_uris)
        text = result.text_content or ""
        _write_output(output_path, text, no_clobber)
        chars = len(text.strip())
        print(f"CHARS:{chars}")
        _emit({"ok": True, "chars": chars})
        return 0
    except FileExistsError:
        msg = f"{output_path} already exists"
        _emit({"ok": False, "error_type": "exists", "error": msg})
        print(f"Error: {msg}", file=sys.stderr)
        return 1
    except Exception as exc:
        name = type(exc).__name__
        kind = {
            "UnsupportedFormatException": "unsupported",
            "MissingDependencyException": "missing_dependency",
            "FileConversionException": "conversion",
        }.get(name, "error")
        _emit({"ok": False, "error_type": kind, "error": f"{exc}"})
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
        flags = {a for a in argv[1:] if a.startswith("--")}
        paths = [a for a in argv[1:] if not a.startswith("--")]
        unknown = flags - {"--keep-data-uris", "--transcribe", "--no-clobber"}
        if len(paths) != 2 or unknown:
            print("Error: convert [--keep-data-uris] [--transcribe] [--no-clobber] <input_path> <output_path>", file=sys.stderr)
            return 2
        return cmd_convert(
            paths[0], paths[1],
            keep_data_uris="--keep-data-uris" in flags,
            transcribe="--transcribe" in flags,
            no_clobber="--no-clobber" in flags,
        )
    print(f"Error: unknown subcommand '{sub}'", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

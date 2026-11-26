// Pure helpers, no vscode import, so they can be tested in plain Node.

/**
 * Oldest Python markitdown 0.1.x supports. There is deliberately no upper
 * bound: newer markitdown releases cap requires-python (0.1.8+ say <3.15) but
 * 0.1.6/0.1.7 do not, so pip picks a compatible release on new Pythons.
 */
export const MIN_PYTHON: [number, number] = [3, 10];

/** Parse `Python 3.14.6` (stdout, or stderr on old interpreters) into [major, minor]. */
export function parsePythonVersion(output: string): [number, number] | null {
    const m = output.match(/Python\s+(\d+)\.(\d+)/);
    return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
}

export function isSupportedPython(v: [number, number] | null): boolean {
    if (!v) { return false; }
    return v[0] > MIN_PYTHON[0] || (v[0] === MIN_PYTHON[0] && v[1] >= MIN_PYTHON[1]);
}

export const SUPPORTED_RANGE = `${MIN_PYTHON.join('.')} or newer`;

/**
 * Newest Python every markitdown dependency ships wheels for. Above it the
 * install can fail outright (onnxruntime, via magika, had no cp315 wheel as of
 * 1.32.0), so such interpreters are tried last, not refused. Raise this when
 * onnxruntime publishes wheels for the next minor.
 */
export const NEWEST_WITH_WHEELS: [number, number] = [3, 14];

/**
 * The Python uv builds with, whatever else is installed: uv reuses a matching
 * install or downloads one. Pinning a tested version keeps the user's own
 * Python (often the newest release) out of the build. Move it forward once CI
 * passes on the newer version.
 */
export const UV_PYTHON = '3.13';

export function hasKnownWheels(v: [number, number] | null): boolean {
    if (!isSupportedPython(v)) { return false; }
    const [major, minor] = v!;
    return major < NEWEST_WITH_WHEELS[0] || (major === NEWEST_WITH_WHEELS[0] && minor <= NEWEST_WITH_WHEELS[1]);
}

/** Stable reorder: supported Pythons with known wheels first, newer ones after. */
export function rankByWheels<T>(items: T[], version: (item: T) => [number, number] | null): T[] {
    const supported = items.filter(i => isSupportedPython(version(i)));
    return [...supported.filter(i => hasKnownWheels(version(i))), ...supported.filter(i => !hasKnownWheels(version(i)))];
}

/** pip's output when it can see no release of the package at all. */
export const NO_PIP_CANDIDATES = /from versions:\s*(none)?\s*\)/;

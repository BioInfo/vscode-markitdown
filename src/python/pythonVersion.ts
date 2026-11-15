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

/** pip's output when it can see no release of the package at all. */
export const NO_PIP_CANDIDATES = /from versions:\s*(none)?\s*\)/;

// Pure helpers, no vscode import, so they can be tested in plain Node.

/** Python range markitdown 0.1.x supports (requires-python >=3.10,<3.15). */
export const MIN_PYTHON: [number, number] = [3, 10];
export const MAX_PYTHON_EXCLUSIVE: [number, number] = [3, 15];

/** Parse `Python 3.14.6` (stdout, or stderr on old interpreters) into [major, minor]. */
export function parsePythonVersion(output: string): [number, number] | null {
    const m = output.match(/Python\s+(\d+)\.(\d+)/);
    return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
}

export function isSupportedPython(v: [number, number] | null): boolean {
    if (!v) { return false; }
    const n = v[0] * 100 + v[1];
    return n >= MIN_PYTHON[0] * 100 + MIN_PYTHON[1]
        && n < MAX_PYTHON_EXCLUSIVE[0] * 100 + MAX_PYTHON_EXCLUSIVE[1];
}

export const SUPPORTED_RANGE = `${MIN_PYTHON.join('.')} to ${MAX_PYTHON_EXCLUSIVE[0]}.${MAX_PYTHON_EXCLUSIVE[1] - 1}`;

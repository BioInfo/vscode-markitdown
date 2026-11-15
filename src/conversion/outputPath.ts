import * as path from 'path';

const MAX_ATTEMPTS = 100;

export interface OutputPathOptions {
    overwriteExisting: boolean;
    /** Directory for the .md file; defaults to the input file's directory. */
    outputDir?: string;
}

/**
 * Pick the .md path for an input file. With overwrite off, never returns a
 * path that `exists` reports as taken: it tries name-1.md .. name-100.md and
 * then throws. `exists` is injected so this is testable without a filesystem,
 * and so a batch can mark paths it already claimed.
 */
export async function resolveOutputPath(
    inputPath: string,
    opts: OutputPathOptions,
    exists: (p: string) => Promise<boolean>
): Promise<string> {
    const dir = opts.outputDir || path.dirname(inputPath);
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(dir, `${baseName}.md`);

    if (opts.overwriteExisting || !(await exists(outputPath))) {
        return outputPath;
    }
    for (let counter = 1; counter <= MAX_ATTEMPTS; counter++) {
        const candidate = path.join(dir, `${baseName}-${counter}.md`);
        if (!(await exists(candidate))) {
            return candidate;
        }
    }
    throw new Error(
        `Could not find a free filename after ${MAX_ATTEMPTS} attempts. ` +
        `Enable the "overwriteExisting" setting or clean up numbered files.`
    );
}

/**
 * Resolve the configured output directory. Empty = next to the source file.
 * Relative paths are taken from the workspace folder holding the file, or the
 * file's own directory when it is outside any workspace.
 */
export function resolveOutputDir(setting: string, inputPath: string, workspaceRoot: string | undefined): string | undefined {
    if (!setting) { return undefined; }
    if (path.isAbsolute(setting)) { return setting; }
    return path.join(workspaceRoot ?? path.dirname(inputPath), setting);
}

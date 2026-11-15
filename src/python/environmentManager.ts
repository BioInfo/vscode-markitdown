import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { ErrorHandler, EnvironmentError } from '../utils/errorHandler';
import { parsePythonVersion, isSupportedPython, SUPPORTED_RANGE, NO_PIP_CANDIDATES } from './pythonVersion';

/**
 * markitdown install spec.
 *
 * Targeted extras (NOT `[all]`) so it resolves on modern Python (3.13/3.14):
 * `[all]` pulls youtube/azure extras whose pins are ResolutionImpossible there,
 * and an unpinned `markitdown[all]` lets pip silently backtrack to the ancient
 * 0.0.2 release, whose DOCX handling fails on documents with embedded graphics
 * (the cause of the early "half my docx files fail" reports).
 *
 * The `>=0.1.6` floor blocks that backtrack; `<0.2.0` avoids unvetted majors.
 * Keep in sync with scripts/functional-test.mjs and python/markitdown_runner.py.
 */
const MARKITDOWN_SPEC =
    'markitdown[docx,pptx,xlsx,xls,pdf,outlook,audio-transcription]>=0.1.6,<0.2.0';

/** An interpreter invocation: the program plus any leading args (`py -3.12`). */
interface PythonCommand {
    cmd: string;
    args: string[];
}

const describe = (c: PythonCommand) => [c.cmd, ...c.args].join(' ');

export interface ConversionResult {
    /** Number of (trimmed) characters written to the output file. */
    chars: number;
}

export class PythonEnvironmentManager {
    private context: vscode.ExtensionContext;
    private errorHandler: ErrorHandler;
    private venvPath: string;
    private runnerPath: string;
    private pythonCommand: PythonCommand | null = null;

    constructor(context: vscode.ExtensionContext, errorHandler: ErrorHandler) {
        this.context = context;
        this.errorHandler = errorHandler;
        this.venvPath = path.join(context.globalStorageUri.fsPath, 'markitdown-venv');
        this.runnerPath = path.join(context.extensionPath, 'python', 'markitdown_runner.py');
    }

    public async initialize(
        progress?: vscode.Progress<{ message?: string; increment?: number }>
    ): Promise<void> {
        try {
            await this.ensureDirectoryExists(this.context.globalStorageUri.fsPath);

            progress?.report({ message: 'Locating Python…' });
            this.pythonCommand = await this.findPython();

            progress?.report({ message: 'Preparing virtual environment…', increment: 20 });
            await this.ensureVirtualEnvironment();

            progress?.report({ message: 'Checking markitdown…', increment: 30 });
            await this.ensureMarkitdownInstalled(progress);

            progress?.report({ message: 'Ready.', increment: 50 });
        } catch (error) {
            this.errorHandler.handleError(error, 'Failed to initialize Python environment');
            throw error;
        }
    }

    /** Version of an interpreter, or null if it ran but printed none. Throws if it cannot run. */
    private async getPythonVersion(c: PythonCommand): Promise<[number, number] | null> {
        const result = await this.executeCommand(c.cmd, [...c.args, '--version'], 15000);
        if (result.exitCode !== 0) { return null; }
        return parsePythonVersion(result.stdout + ' ' + result.stderr);
    }

    private pythonCandidates(): PythonCommand[] {
        const configured = vscode.workspace
            .getConfiguration('markitdown')
            .get<string>('pythonPath', '')
            .trim();
        if (configured) {
            return [{ cmd: configured, args: [] }];
        }
        // The process running VS Code can see a different PATH than your
        // terminal (a Dock launch on macOS, for example), so also try the
        // versioned names that installers add.
        const minors: number[] = [];
        for (let m = 16; m >= 10; m--) { minors.push(m); }
        if (process.platform === 'win32') {
            return [
                { cmd: 'python', args: [] },
                { cmd: 'python3', args: [] },
                { cmd: 'py', args: ['-3'] },
                ...minors.map(m => ({ cmd: 'py', args: [`-3.${m}`] })),
            ];
        }
        return [
            { cmd: 'python3', args: [] },
            { cmd: 'python', args: [] },
            ...minors.map(m => ({ cmd: `python3.${m}`, args: [] })),
        ];
    }

    /** First interpreter whose version markitdown supports. */
    private async findPython(): Promise<PythonCommand> {
        const candidates = this.pythonCandidates();
        const rejected: string[] = [];
        for (const candidate of candidates) {
            let version: [number, number] | null;
            try {
                version = await this.getPythonVersion(candidate);
            } catch {
                continue; // not installed, or did not answer in time
            }
            if (isSupportedPython(version)) {
                return candidate;
            }
            if (version) {
                rejected.push(`${describe(candidate)} (${version.join('.')})`);
            }
        }
        const fix = `Install Python ${SUPPORTED_RANGE}, or point the "markitdown.pythonPath" setting at one.`;
        if (rejected.length > 0) {
            throw new EnvironmentError(
                `Found Python, but markitdown needs ${SUPPORTED_RANGE}: ${rejected.join(', ')}.`, fix);
        }
        throw new EnvironmentError(
            candidates.length === 1
                ? `The configured markitdown.pythonPath (${describe(candidates[0])}) did not run.`
                : 'Python was not found on PATH.',
            fix);
    }

    private async ensureVirtualEnvironment(): Promise<void> {
        const venvPythonPath = this.getVenvPythonPath();
        let needsCreation = false;

        if (!fs.existsSync(venvPythonPath)) {
            needsCreation = true;
        } else {
            // The venv lives in global storage and survives extension updates,
            // so it may have been built by an older, unsupported Python. Pip in
            // such a venv sees no installable markitdown at all
            // ("from versions: )"). Rebuild unless it runs a supported version.
            // Rebuild only on a definite answer: the interpreter failed, or it
            // reported an unsupported version. A timeout (antivirus scanning
            // python.exe on first launch, say) keeps the venv.
            try {
                const venvVersion = await this.getPythonVersion({ cmd: venvPythonPath, args: [] });
                if (!isSupportedPython(venvVersion)) {
                    console.warn(`Rebuilding virtual environment (venv Python: ${venvVersion?.join('.') ?? 'failed to run'})`);
                    needsCreation = true;
                }
            } catch (error) {
                console.warn(`Could not query venv Python, keeping it: ${error}`);
            }

            if (needsCreation) {
                await this.removeVirtualEnvironment();
            }
        }

        if (needsCreation) {
            console.log('Creating virtual environment…');
            const py = this.pythonCommand!;
            const result = await this.executeCommand(py.cmd, [
                ...py.args, '-m', 'venv', this.venvPath
            ], 120000);

            if (result.exitCode !== 0) {
                throw new EnvironmentError(`Failed to create virtual environment with ${describe(py)}: ${result.stderr.trim()}`);
            }

            const verifyResult = await this.executeCommand(venvPythonPath, ['--version'], 10000);
            if (verifyResult.exitCode !== 0) {
                throw new Error('Created virtual environment but verification failed');
            }
            console.log('Virtual environment created and verified successfully');
        }
    }

    private async ensureMarkitdownInstalled(
        progress?: vscode.Progress<{ message?: string; increment?: number }>
    ): Promise<void> {
        const venvPython = this.getVenvPythonPath();

        // Health check via the shipped runner: importable + modern enough +
        // instantiable. This replaces the old `import docx` check, which always
        // failed (markitdown uses mammoth, not python-docx) and triggered a
        // reinstall on every conversion.
        const check = await this.executeCommand(venvPython, [this.runnerPath, 'check'], 30000);
        if (check.exitCode === 0) {
            console.log(`markitdown ${check.stdout.trim()} present`);
            return;
        }

        console.log(`markitdown check failed (${check.stderr.trim()}); installing…`);
        progress?.report({ message: 'Installing markitdown (first run, may take a minute)…' });

        const installResult = await this.pipInstall(venvPython);

        if (installResult.exitCode !== 0) {
            let venvVersion = 'unknown';
            try {
                venvVersion = (await this.getPythonVersion({ cmd: venvPython, args: [] }))?.join('.') ?? venvVersion;
            } catch { /* keep 'unknown' */ }
            const hint = NO_PIP_CANDIDATES.test(installResult.stderr)
                ? 'pip could not see any markitdown release. Check that this machine can reach pypi.org (proxy or firewall settings).'
                : 'A dependency may have no prebuilt wheel for your platform.';
            throw new EnvironmentError(
                `Failed to install markitdown (venv Python ${venvVersion}). ${hint}`,
                `Full pip output is in the MarkItDown output channel. pip said: ${installResult.stderr.trim().split('\n').slice(-3).join(' ')}`
            );
        }

        // Confirm the freshly installed environment actually passes the check.
        const recheck = await this.executeCommand(venvPython, [this.runnerPath, 'check'], 30000);
        if (recheck.exitCode !== 0) {
            throw new EnvironmentError(`markitdown installed but verification failed: ${recheck.stderr.trim()}`);
        }
        console.log(`markitdown ${recheck.stdout.trim()} installed successfully`);
    }

    /**
     * Convert a file to Markdown. Returns the number of characters written so
     * callers can detect an empty result (e.g. an image with no extractable
     * text) and warn the user rather than leaving a silent empty .md.
     */
    public async convertFile(inputPath: string, outputPath: string): Promise<ConversionResult> {
        const venvPython = this.getVenvPythonPath();

        // Paths are passed as argv to a spawned process (no shell), so there is
        // no command-injection surface — no escaping or base64 dance needed.
        const result = await this.executeCommand(venvPython, [
            this.runnerPath, 'convert', inputPath, outputPath
        ]);

        if (result.exitCode !== 0) {
            const detail = result.stderr.replace(/^Error:\s*/, '').trim() || 'unknown error';
            throw new Error(detail);
        }

        const match = result.stdout.match(/CHARS:(\d+)/);
        const chars = match ? parseInt(match[1], 10) : 0;
        return { chars };
    }

    private pipInstall(venvPython: string) {
        return this.executeCommand(venvPython, [
            '-m', 'pip', 'install', '--upgrade', '--disable-pip-version-check', MARKITDOWN_SPEC
        ], 600000); // 10 min: first install pulls numpy/onnxruntime/etc.
    }

    private async removeVirtualEnvironment(): Promise<void> {
        if (fs.existsSync(this.venvPath)) {
            console.log('Removing virtual environment…');
            await fs.promises.rm(this.venvPath, { recursive: true, force: true });
        }
    }

    private getVenvPythonPath(): string {
        const isWindows = process.platform === 'win32';
        return isWindows
            ? path.join(this.venvPath, 'Scripts', 'python.exe')
            : path.join(this.venvPath, 'bin', 'python');
    }

    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        if (!fs.existsSync(dirPath)) {
            await fs.promises.mkdir(dirPath, { recursive: true });
        }
    }

    private executeCommand(
        command: string,
        args: string[],
        timeoutMs: number = 300000 // 5 minutes default
    ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
        return new Promise((resolve, reject) => {
            const childProcess = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';
            let isTimedOut = false;
            let outputExceeded = false;

            const MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB per stream

            const timeout = setTimeout(() => {
                isTimedOut = true;
                childProcess.kill('SIGTERM');
                setTimeout(() => {
                    if (!childProcess.killed) {
                        childProcess.kill('SIGKILL');
                    }
                }, 5000);
                reject(new Error(`Command timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            childProcess.stdout?.on('data', (data) => {
                if (stdout.length + data.length > MAX_OUTPUT_SIZE) {
                    outputExceeded = true;
                    childProcess.kill('SIGTERM');
                    return;
                }
                stdout += data.toString();
            });

            childProcess.stderr?.on('data', (data) => {
                if (stderr.length + data.length > MAX_OUTPUT_SIZE) {
                    outputExceeded = true;
                    childProcess.kill('SIGTERM');
                    return;
                }
                stderr += data.toString();
            });

            childProcess.on('close', (code) => {
                clearTimeout(timeout);
                if (isTimedOut) {
                    return;
                }
                if (outputExceeded) {
                    reject(new Error('Process output exceeded maximum size (10MB)'));
                    return;
                }
                resolve({
                    exitCode: code || 0,
                    stdout: stdout.trim(),
                    stderr: stderr.trim()
                });
            });

            childProcess.on('error', (error) => {
                clearTimeout(timeout);
                if (!isTimedOut) {
                    reject(error);
                }
            });
        });
    }

    public dispose(): void {
        // No long-lived resources to release.
    }
}
